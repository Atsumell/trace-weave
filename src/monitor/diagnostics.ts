import { print } from "../compiler/printer.js";
import type { FormulaDocument } from "../core/formula-document.js";
import type { FormulaNode } from "../core/formula-node.js";
import { type ActivationId, type NodeId, activationId } from "../core/ids.js";
import type { MonitorRuntime } from "../core/runtime.js";
import type { JsonValue } from "../core/values.js";
import type { Verdict } from "../core/verdict.js";
import { andV } from "../core/verdict.js";
import { type EvalEnv, envKey, jsonEqual } from "./eval-common.js";
import {
	type FiniteEvalContext,
	createFiniteEvalContext,
	evaluateFiniteNode,
} from "./evaluate-finite.js";
import { getTimestamp } from "./time.js";
import type { CounterexampleReport, ObligationSnapshot } from "./types.js";

export function buildCounterexampleReport<TEvent>(
	doc: FormulaDocument,
	runtime: MonitorRuntime<TEvent>,
	trace: readonly TEvent[],
): CounterexampleReport | null {
	const ctx = createFiniteEvalContext(doc, runtime, trace);
	const env: EvalEnv = new Map();
	const verdict = evaluateFiniteNode(ctx, doc.root, 0, env);
	if (verdict !== "violated") {
		return null;
	}

	const failurePath: ObligationSnapshot[] = [];
	collectFailurePath(ctx, doc.root, 0, env, failurePath);

	return {
		verdict: "violated",
		failurePath,
		traceSlice: trace.map((event, i) => ({ step: i + 1, event })),
		summary: `Formula violated: ${print(doc)}`,
	};
}

function collectFailurePath<TEvent>(
	ctx: FiniteEvalContext<TEvent>,
	nodeId: NodeId,
	pos: number,
	env: EvalEnv,
	path: ObligationSnapshot[],
): void {
	const verdict = evaluateFiniteNode(ctx, nodeId, pos, env);
	path.push({
		nodeId,
		activationId: toActivationId(nodeId, pos, env),
		verdict,
		step: pos,
	});

	const node = ctx.doc.nodes[nodeId];
	if (!node) {
		return;
	}

	switch (node.kind) {
		case "literal":
		case "predicate":
			return;

		case "when": {
			if (pos >= ctx.trace.length) {
				return;
			}
			const captured = env.get(node.captureName as string);
			if (captured === undefined) {
				return;
			}
			const selectorFn = ctx.runtime.selectors[node.selectorId];
			if (!selectorFn) {
				return;
			}
			const currentVal = selectorFn(ctx.trace[pos]!);
			if (!jsonEqual(captured, currentVal)) {
				return;
			}
			collectFailurePath(ctx, node.child, pos, env, path);
			return;
		}

		case "capture": {
			if (pos >= ctx.trace.length) {
				return;
			}
			const selectorFn = ctx.runtime.selectors[node.selectorId];
			if (!selectorFn) {
				return;
			}
			const nextEnv = new Map(env);
			nextEnv.set(node.captureName as string, selectorFn(ctx.trace[pos]!));
			collectFailurePath(ctx, node.child, pos, nextEnv, path);
			return;
		}

		case "not":
			collectFailurePath(ctx, node.child, pos, env, path);
			return;

		case "and":
		case "or": {
			const childId = pickBooleanChild(ctx, node, pos, env, verdict);
			if (childId) {
				collectFailurePath(ctx, childId, pos, env, path);
			}
			return;
		}

		case "implies": {
			const leftVerdict = evaluateFiniteNode(ctx, node.left, pos, env);
			const rightVerdict = evaluateFiniteNode(ctx, node.right, pos, env);
			if (verdict === "violated") {
				collectFailurePath(ctx, node.right, pos, env, path);
				return;
			}
			if (rightVerdict === "satisfied") {
				collectFailurePath(ctx, node.right, pos, env, path);
				return;
			}
			if (leftVerdict !== verdict || rightVerdict === "pending") {
				collectFailurePath(ctx, node.left, pos, env, path);
				return;
			}
			return;
		}

		case "always": {
			const childPos =
				verdict === "violated"
					? findFirstPosition(ctx, node.child, pos, ctx.trace.length - 1, env, "violated")
					: pos < ctx.trace.length
						? pos
						: null;
			if (childPos !== null) {
				collectFailurePath(ctx, node.child, childPos, env, path);
			}
			return;
		}

		case "eventually": {
			const childPos =
				verdict === "satisfied"
					? findFirstPosition(ctx, node.child, pos, ctx.trace.length - 1, env, "satisfied")
					: findLastPosition(ctx, node.child, pos, ctx.trace.length - 1, env, "violated");
			if (childPos !== null) {
				collectFailurePath(ctx, node.child, childPos, env, path);
			}
			return;
		}

		case "next":
		case "weakNext":
			if (pos + 1 < ctx.trace.length) {
				collectFailurePath(ctx, node.child, pos + 1, env, path);
			}
			return;

		case "until": {
			const witness = findUntilFailureOrWitness(ctx, node, pos, env, verdict);
			if (witness) {
				collectFailurePath(ctx, witness.nodeId, witness.pos, env, path);
			}
			return;
		}

		case "release": {
			const witness = findReleaseFailureOrWitness(ctx, node, pos, env, verdict);
			if (witness) {
				collectFailurePath(ctx, witness.nodeId, witness.pos, env, path);
			}
			return;
		}

		case "once": {
			const childPos =
				verdict === "satisfied"
					? findLastPosition(ctx, node.child, 0, pos, env, "satisfied")
					: pos < ctx.trace.length
						? pos
						: null;
			if (childPos !== null) {
				collectFailurePath(ctx, node.child, childPos, env, path);
			}
			return;
		}

		case "historically": {
			const childPos =
				verdict === "violated"
					? findFirstPosition(ctx, node.child, 0, pos, env, "violated")
					: pos < ctx.trace.length
						? pos
						: null;
			if (childPos !== null) {
				collectFailurePath(ctx, node.child, childPos, env, path);
			}
			return;
		}

		case "since": {
			const witness = findSinceFailureOrWitness(ctx, node, pos, env, verdict);
			if (witness) {
				collectFailurePath(ctx, witness.nodeId, witness.pos, env, path);
			}
			return;
		}

		case "withinSteps": {
			const upper = Math.min(pos + node.steps - 1, ctx.trace.length - 1);
			const childPos =
				verdict === "satisfied"
					? findFirstPosition(ctx, node.child, pos, upper, env, "satisfied")
					: findLastPosition(ctx, node.child, pos, upper, env, "violated");
			if (childPos !== null) {
				collectFailurePath(ctx, node.child, childPos, env, path);
			}
			return;
		}

		case "withinMs": {
			if (pos >= ctx.trace.length) {
				return;
			}
			const startTs = getTimestamp(ctx.runtime, ctx.trace[pos]!);
			let lastInBudget: number | null = null;
			for (let i = pos; i < ctx.trace.length; i++) {
				const currentTs = getTimestamp(ctx.runtime, ctx.trace[i]!);
				if (currentTs - startTs > node.ms) {
					break;
				}
				lastInBudget = i;
				if (
					verdict === "satisfied" &&
					evaluateFiniteNode(ctx, node.child, i, env) === "satisfied"
				) {
					collectFailurePath(ctx, node.child, i, env, path);
					return;
				}
			}
			if (verdict === "violated" && lastInBudget !== null) {
				const childPos = findLastPosition(ctx, node.child, pos, lastInBudget, env, "violated");
				if (childPos !== null) {
					collectFailurePath(ctx, node.child, childPos, env, path);
				}
			}
		}
	}
}

function pickBooleanChild<TEvent>(
	ctx: FiniteEvalContext<TEvent>,
	node: Extract<FormulaNode, { kind: "and" | "or" }>,
	pos: number,
	env: EvalEnv,
	verdict: Verdict,
): NodeId | null {
	for (const childId of node.children) {
		const childVerdict = evaluateFiniteNode(ctx, childId, pos, env);
		if (verdict === "violated" && childVerdict === "violated") {
			return childId;
		}
		if (verdict === "satisfied" && childVerdict === "satisfied") {
			return childId;
		}
		if (verdict === "pending" && childVerdict === "pending") {
			return childId;
		}
	}
	return node.children[0] ?? null;
}

function findUntilFailureOrWitness<TEvent>(
	ctx: FiniteEvalContext<TEvent>,
	node: Extract<FormulaNode, { kind: "until" }>,
	pos: number,
	env: EvalEnv,
	verdict: Verdict,
): { readonly nodeId: NodeId; readonly pos: number } | null {
	if (pos >= ctx.trace.length) {
		return null;
	}

	let leftAcc: Verdict = "satisfied";
	for (let j = pos; j < ctx.trace.length; j++) {
		const rightVerdict = evaluateFiniteNode(ctx, node.right, j, env);
		if (rightVerdict === "satisfied" && leftAcc === "satisfied") {
			return verdict === "satisfied" ? { nodeId: node.right, pos: j } : null;
		}

		const leftVerdict = evaluateFiniteNode(ctx, node.left, j, env);
		if (verdict === "violated" && leftAcc === "satisfied" && leftVerdict === "violated") {
			return { nodeId: node.left, pos: j };
		}
		leftAcc = j === pos ? leftVerdict : andV(leftAcc, leftVerdict);
		if (leftAcc === "violated") {
			break;
		}
	}

	if (verdict === "violated") {
		const rightPos = findLastPosition(ctx, node.right, pos, ctx.trace.length - 1, env, "violated");
		if (rightPos !== null) {
			return { nodeId: node.right, pos: rightPos };
		}
	}

	return null;
}

function findReleaseFailureOrWitness<TEvent>(
	ctx: FiniteEvalContext<TEvent>,
	node: Extract<FormulaNode, { kind: "release" }>,
	pos: number,
	env: EvalEnv,
	verdict: Verdict,
): { readonly nodeId: NodeId; readonly pos: number } | null {
	if (pos >= ctx.trace.length) {
		return null;
	}

	let allRight: Verdict = "satisfied";
	for (let j = pos; j < ctx.trace.length; j++) {
		const rightVerdict = evaluateFiniteNode(ctx, node.right, j, env);
		if (verdict === "violated" && allRight === "satisfied" && rightVerdict === "violated") {
			return { nodeId: node.right, pos: j };
		}

		allRight = andV(allRight, rightVerdict);
		const leftVerdict = evaluateFiniteNode(ctx, node.left, j, env);
		if (leftVerdict === "satisfied" && allRight === "satisfied") {
			return verdict === "satisfied" ? { nodeId: node.left, pos: j } : null;
		}
		if (allRight === "violated") {
			break;
		}
	}

	if (verdict === "satisfied" && pos < ctx.trace.length) {
		return { nodeId: node.right, pos };
	}

	return null;
}

function findSinceFailureOrWitness<TEvent>(
	ctx: FiniteEvalContext<TEvent>,
	node: Extract<FormulaNode, { kind: "since" }>,
	pos: number,
	env: EvalEnv,
	verdict: Verdict,
): { readonly nodeId: NodeId; readonly pos: number } | null {
	if (pos >= ctx.trace.length) {
		return null;
	}

	for (let j = pos; j >= 0; j--) {
		const rightVerdict = evaluateFiniteNode(ctx, node.right, j, env);
		if (rightVerdict === "satisfied") {
			let leftOk: Verdict = "satisfied";
			for (let i = j + 1; i <= pos; i++) {
				const leftVerdict = evaluateFiniteNode(ctx, node.left, i, env);
				if (verdict === "violated" && leftVerdict === "violated") {
					return { nodeId: node.left, pos: i };
				}
				leftOk = andV(leftOk, leftVerdict);
				if (leftOk === "violated") {
					break;
				}
			}
			if (leftOk === "satisfied") {
				return verdict === "satisfied" ? { nodeId: node.right, pos: j } : null;
			}
		}
	}

	if (verdict === "violated") {
		const rightPos = findFirstPosition(ctx, node.right, 0, pos, env, "violated");
		if (rightPos !== null) {
			return { nodeId: node.right, pos: rightPos };
		}
	}

	return null;
}

function findFirstPosition<TEvent>(
	ctx: FiniteEvalContext<TEvent>,
	nodeId: NodeId,
	start: number,
	end: number,
	env: EvalEnv,
	verdict: Verdict,
): number | null {
	if (start > end) {
		return null;
	}
	for (let pos = start; pos <= end; pos++) {
		if (evaluateFiniteNode(ctx, nodeId, pos, env) === verdict) {
			return pos;
		}
	}
	return null;
}

function findLastPosition<TEvent>(
	ctx: FiniteEvalContext<TEvent>,
	nodeId: NodeId,
	start: number,
	end: number,
	env: EvalEnv,
	verdict: Verdict,
): number | null {
	if (start > end) {
		return null;
	}
	for (let pos = end; pos >= start; pos--) {
		if (evaluateFiniteNode(ctx, nodeId, pos, env) === verdict) {
			return pos;
		}
	}
	return null;
}
function toActivationId(nodeId: NodeId, pos: number, env: EvalEnv): ActivationId {
	return activationId(`${nodeId}:${pos}:${encodeURIComponent(envKey(env))}`);
}
