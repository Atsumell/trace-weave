import { print } from "../compiler/printer.js";
import type { FormulaDocument } from "../core/formula-document.js";
import type { FormulaNode } from "../core/formula-node.js";
import { type ActivationId, type NodeId, activationId } from "../core/ids.js";
import type { MonitorRuntime } from "../core/runtime.js";
import type { JsonValue, ValueExprArg } from "../core/values.js";
import type { Verdict } from "../core/verdict.js";
import { andV, impliesV, notV, orV } from "../core/verdict.js";
import { assertTimeSupportForTrace, getTimestamp } from "./time.js";
import type { CounterexampleReport, ObligationSnapshot } from "./types.js";

interface EvalContext<TEvent> {
	readonly doc: FormulaDocument;
	readonly runtime: MonitorRuntime<TEvent>;
	readonly trace: readonly TEvent[];
	readonly cache: Map<string, Verdict>;
}

export function buildCounterexampleReport<TEvent>(
	doc: FormulaDocument,
	runtime: MonitorRuntime<TEvent>,
	trace: readonly TEvent[],
): CounterexampleReport | null {
	assertTimeSupportForTrace(doc, runtime, trace);

	const ctx: EvalContext<TEvent> = {
		doc,
		runtime,
		trace,
		cache: new Map(),
	};
	const env = new Map<string, JsonValue>();
	const verdict = evalNode(ctx, doc.root, 0, env);
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
	ctx: EvalContext<TEvent>,
	nodeId: NodeId,
	pos: number,
	env: Map<string, JsonValue>,
	path: ObligationSnapshot[],
): void {
	const verdict = evalNode(ctx, nodeId, pos, env);
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
			const leftVerdict = evalNode(ctx, node.left, pos, env);
			const rightVerdict = evalNode(ctx, node.right, pos, env);
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
				if (verdict === "satisfied" && evalNode(ctx, node.child, i, env) === "satisfied") {
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
	ctx: EvalContext<TEvent>,
	node: Extract<FormulaNode, { kind: "and" | "or" }>,
	pos: number,
	env: Map<string, JsonValue>,
	verdict: Verdict,
): NodeId | null {
	for (const childId of node.children) {
		const childVerdict = evalNode(ctx, childId, pos, env);
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
	ctx: EvalContext<TEvent>,
	node: Extract<FormulaNode, { kind: "until" }>,
	pos: number,
	env: Map<string, JsonValue>,
	verdict: Verdict,
): { readonly nodeId: NodeId; readonly pos: number } | null {
	if (pos >= ctx.trace.length) {
		return null;
	}

	let leftAcc: Verdict = "satisfied";
	for (let j = pos; j < ctx.trace.length; j++) {
		const rightVerdict = evalNode(ctx, node.right, j, env);
		if (rightVerdict === "satisfied" && leftAcc === "satisfied") {
			return verdict === "satisfied" ? { nodeId: node.right, pos: j } : null;
		}

		const leftVerdict = evalNode(ctx, node.left, j, env);
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
	ctx: EvalContext<TEvent>,
	node: Extract<FormulaNode, { kind: "release" }>,
	pos: number,
	env: Map<string, JsonValue>,
	verdict: Verdict,
): { readonly nodeId: NodeId; readonly pos: number } | null {
	if (pos >= ctx.trace.length) {
		return null;
	}

	let allRight: Verdict = "satisfied";
	for (let j = pos; j < ctx.trace.length; j++) {
		const rightVerdict = evalNode(ctx, node.right, j, env);
		if (verdict === "violated" && allRight === "satisfied" && rightVerdict === "violated") {
			return { nodeId: node.right, pos: j };
		}

		allRight = andV(allRight, rightVerdict);
		const leftVerdict = evalNode(ctx, node.left, j, env);
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
	ctx: EvalContext<TEvent>,
	node: Extract<FormulaNode, { kind: "since" }>,
	pos: number,
	env: Map<string, JsonValue>,
	verdict: Verdict,
): { readonly nodeId: NodeId; readonly pos: number } | null {
	if (pos >= ctx.trace.length) {
		return null;
	}

	for (let j = pos; j >= 0; j--) {
		const rightVerdict = evalNode(ctx, node.right, j, env);
		if (rightVerdict === "satisfied") {
			let leftOk: Verdict = "satisfied";
			for (let i = j + 1; i <= pos; i++) {
				const leftVerdict = evalNode(ctx, node.left, i, env);
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
	ctx: EvalContext<TEvent>,
	nodeId: NodeId,
	start: number,
	end: number,
	env: Map<string, JsonValue>,
	verdict: Verdict,
): number | null {
	if (start > end) {
		return null;
	}
	for (let pos = start; pos <= end; pos++) {
		if (evalNode(ctx, nodeId, pos, env) === verdict) {
			return pos;
		}
	}
	return null;
}

function findLastPosition<TEvent>(
	ctx: EvalContext<TEvent>,
	nodeId: NodeId,
	start: number,
	end: number,
	env: Map<string, JsonValue>,
	verdict: Verdict,
): number | null {
	if (start > end) {
		return null;
	}
	for (let pos = end; pos >= start; pos--) {
		if (evalNode(ctx, nodeId, pos, env) === verdict) {
			return pos;
		}
	}
	return null;
}

function evalNode<TEvent>(
	ctx: EvalContext<TEvent>,
	nodeId: NodeId,
	pos: number,
	env: Map<string, JsonValue>,
): Verdict {
	const cacheEntry = cacheKey(nodeId, pos, env);
	const cached = ctx.cache.get(cacheEntry);
	if (cached !== undefined) {
		return cached;
	}

	const node = ctx.doc.nodes[nodeId];
	if (!node) {
		return "violated";
	}

	ctx.cache.set(cacheEntry, "pending");
	const verdict = evalNodeInner(ctx, node, pos, env);
	ctx.cache.set(cacheEntry, verdict);
	return verdict;
}

function evalNodeInner<TEvent>(
	ctx: EvalContext<TEvent>,
	node: FormulaNode,
	pos: number,
	env: Map<string, JsonValue>,
): Verdict {
	const len = ctx.trace.length;

	switch (node.kind) {
		case "literal":
			return node.value ? "satisfied" : "violated";

		case "predicate": {
			if (pos >= len) {
				return "violated";
			}
			const predicateFn = ctx.runtime.predicates[node.predicateId];
			if (!predicateFn) {
				return "violated";
			}
			const event = ctx.trace[pos]!;
			const args = (node.args ?? []).map((arg) => resolveArg(arg, event, ctx));
			return predicateFn(event, args) ? "satisfied" : "violated";
		}

		case "when": {
			if (pos >= len) {
				return "violated";
			}
			const captured = env.get(node.captureName as string);
			if (captured === undefined) {
				return "violated";
			}
			const selectorFn = ctx.runtime.selectors[node.selectorId];
			if (!selectorFn) {
				return "violated";
			}
			const currentVal = selectorFn(ctx.trace[pos]!);
			if (!jsonEqual(captured, currentVal)) {
				return "violated";
			}
			return evalNode(ctx, node.child, pos, env);
		}

		case "capture": {
			if (pos >= len) {
				return "violated";
			}
			const selectorFn = ctx.runtime.selectors[node.selectorId];
			if (!selectorFn) {
				return "violated";
			}
			const nextEnv = new Map(env);
			nextEnv.set(node.captureName as string, selectorFn(ctx.trace[pos]!));
			return evalNode(ctx, node.child, pos, nextEnv);
		}

		case "not":
			return notV(evalNode(ctx, node.child, pos, env));

		case "and": {
			let result: Verdict = "satisfied";
			for (const childId of node.children) {
				result = andV(result, evalNode(ctx, childId, pos, env));
				if (result === "violated") {
					break;
				}
			}
			return result;
		}

		case "or": {
			let result: Verdict = "violated";
			for (const childId of node.children) {
				result = orV(result, evalNode(ctx, childId, pos, env));
				if (result === "satisfied") {
					break;
				}
			}
			return result;
		}

		case "implies":
			return impliesV(evalNode(ctx, node.left, pos, env), evalNode(ctx, node.right, pos, env));

		case "always": {
			if (pos >= len) {
				return "satisfied";
			}
			let result: Verdict = "satisfied";
			for (let i = pos; i < len; i++) {
				result = andV(result, evalNode(ctx, node.child, i, env));
				if (result === "violated") {
					break;
				}
			}
			return result;
		}

		case "eventually": {
			if (pos >= len) {
				return "violated";
			}
			let result: Verdict = "violated";
			for (let i = pos; i < len; i++) {
				result = orV(result, evalNode(ctx, node.child, i, env));
				if (result === "satisfied") {
					break;
				}
			}
			return result;
		}

		case "next": {
			if (pos + 1 >= len) {
				return "violated";
			}
			return evalNode(ctx, node.child, pos + 1, env);
		}

		case "weakNext": {
			if (pos + 1 >= len) {
				return "satisfied";
			}
			return evalNode(ctx, node.child, pos + 1, env);
		}

		case "until": {
			if (pos >= len) {
				return "violated";
			}
			let leftAcc: Verdict = "satisfied";
			for (let j = pos; j < len; j++) {
				const rightVerdict = evalNode(ctx, node.right, j, env);
				if (rightVerdict === "satisfied" && leftAcc === "satisfied") {
					return "satisfied";
				}
				const leftVerdict = evalNode(ctx, node.left, j, env);
				leftAcc = j === pos ? leftVerdict : andV(leftAcc, leftVerdict);
				if (leftAcc === "violated") {
					break;
				}
			}
			return "violated";
		}

		case "release": {
			if (pos >= len) {
				return "satisfied";
			}
			let allRight: Verdict = "satisfied";
			for (let j = pos; j < len; j++) {
				const rightVerdict = evalNode(ctx, node.right, j, env);
				allRight = andV(allRight, rightVerdict);
				const leftVerdict = evalNode(ctx, node.left, j, env);
				if (leftVerdict === "satisfied" && allRight === "satisfied") {
					return "satisfied";
				}
				if (allRight === "violated") {
					break;
				}
			}
			return allRight === "satisfied" ? "satisfied" : "violated";
		}

		case "once": {
			if (pos >= len) {
				return "violated";
			}
			for (let i = pos; i >= 0; i--) {
				if (evalNode(ctx, node.child, i, env) === "satisfied") {
					return "satisfied";
				}
			}
			return "violated";
		}

		case "historically": {
			if (pos >= len) {
				return "satisfied";
			}
			for (let i = 0; i <= pos; i++) {
				if (evalNode(ctx, node.child, i, env) === "violated") {
					return "violated";
				}
			}
			return "satisfied";
		}

		case "since": {
			if (pos >= len) {
				return "violated";
			}
			for (let j = pos; j >= 0; j--) {
				if (evalNode(ctx, node.right, j, env) === "satisfied") {
					let leftOk: Verdict = "satisfied";
					for (let i = j + 1; i <= pos; i++) {
						leftOk = andV(leftOk, evalNode(ctx, node.left, i, env));
						if (leftOk === "violated") {
							break;
						}
					}
					if (leftOk === "satisfied") {
						return "satisfied";
					}
				}
			}
			return "violated";
		}

		case "withinSteps": {
			const upper = Math.min(pos + node.steps, len);
			for (let i = pos; i < upper; i++) {
				if (evalNode(ctx, node.child, i, env) === "satisfied") {
					return "satisfied";
				}
			}
			return "violated";
		}

		case "withinMs": {
			if (pos >= len) {
				return "violated";
			}
			const startTs = getTimestamp(ctx.runtime, ctx.trace[pos]!);
			for (let i = pos; i < len; i++) {
				const currentTs = getTimestamp(ctx.runtime, ctx.trace[i]!);
				if (currentTs - startTs > node.ms) {
					break;
				}
				if (evalNode(ctx, node.child, i, env) === "satisfied") {
					return "satisfied";
				}
			}
			return "violated";
		}
	}
}

function resolveArg<TEvent>(arg: ValueExprArg, event: TEvent, ctx: EvalContext<TEvent>): JsonValue {
	if (arg.kind === "literal") {
		return arg.value;
	}
	const selectorFn = ctx.runtime.selectors[arg.selectorId];
	if (!selectorFn) {
		return null;
	}
	return selectorFn(event);
}

function cacheKey(nodeId: NodeId, pos: number, env: Map<string, JsonValue>): string {
	return `${nodeId}:${pos}:${envKey(env)}`;
}

function envKey(env: Map<string, JsonValue>): string {
	const entries = [...env.entries()].sort(([left], [right]) => left.localeCompare(right));
	return JSON.stringify(entries);
}

function toActivationId(nodeId: NodeId, pos: number, env: Map<string, JsonValue>): ActivationId {
	return activationId(`${nodeId}:${pos}:${encodeURIComponent(envKey(env))}`);
}

function jsonEqual(a: JsonValue, b: JsonValue): boolean {
	if (a === b) {
		return true;
	}
	if (a === null || b === null) {
		return a === b;
	}
	if (typeof a !== typeof b) {
		return false;
	}
	if (typeof a !== "object") {
		return a === b;
	}
	if (Array.isArray(a)) {
		if (!Array.isArray(b) || a.length !== b.length) {
			return false;
		}
		return a.every((value, index) => jsonEqual(value, b[index]!));
	}
	if (Array.isArray(b)) {
		return false;
	}
	const aObject = a as Record<string, JsonValue>;
	const bObject = b as Record<string, JsonValue>;
	const aKeys = Object.keys(aObject).sort();
	const bKeys = Object.keys(bObject).sort();
	if (aKeys.length !== bKeys.length) {
		return false;
	}
	return aKeys.every(
		(key, index) => key === bKeys[index] && jsonEqual(aObject[key]!, bObject[key]!),
	);
}
