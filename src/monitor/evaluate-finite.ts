import type { FormulaDocument } from "../core/formula-document.js";
import type { FormulaNode } from "../core/formula-node.js";
import type { NodeId } from "../core/ids.js";
import type { MonitorRuntime } from "../core/runtime.js";
import type { Verdict } from "../core/verdict.js";
import { andV, impliesV, notV, orV } from "../core/verdict.js";
import { type EvalEnv, cacheKey, jsonEqual, resolveArg } from "./eval-common.js";
import { assertTimeSupportForTrace, getTimestamp } from "./time.js";

export interface FiniteEvalContext<TEvent> {
	readonly doc: FormulaDocument;
	readonly runtime: MonitorRuntime<TEvent>;
	readonly trace: readonly TEvent[];
	readonly cache: Map<string, Verdict>;
}

export function createFiniteEvalContext<TEvent>(
	doc: FormulaDocument,
	runtime: MonitorRuntime<TEvent>,
	trace: readonly TEvent[],
): FiniteEvalContext<TEvent> {
	assertTimeSupportForTrace(doc, runtime, trace);

	return {
		doc,
		runtime,
		trace,
		cache: new Map(),
	};
}

export function evaluateFiniteFormula<TEvent>(
	doc: FormulaDocument,
	runtime: MonitorRuntime<TEvent>,
	trace: readonly TEvent[],
): Verdict {
	const ctx = createFiniteEvalContext(doc, runtime, trace);
	return evaluateFiniteNode(ctx, doc.root, 0, new Map());
}

export function evaluateFiniteNode<TEvent>(
	ctx: FiniteEvalContext<TEvent>,
	nodeId: NodeId,
	pos: number,
	env: EvalEnv,
): Verdict {
	const entryKey = cacheKey(nodeId, pos, env);
	const cached = ctx.cache.get(entryKey);
	if (cached !== undefined) {
		return cached;
	}

	const node = ctx.doc.nodes[nodeId];
	if (!node) {
		return "violated";
	}

	// Prevent infinite recursion by marking the current evaluation as open.
	ctx.cache.set(entryKey, "pending");
	const verdict = evaluateFiniteNodeInner(ctx, node, pos, env);
	ctx.cache.set(entryKey, verdict);
	return verdict;
}

function evaluateFiniteNodeInner<TEvent>(
	ctx: FiniteEvalContext<TEvent>,
	node: FormulaNode,
	pos: number,
	env: EvalEnv,
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
			const args = (node.args ?? []).map((arg) => resolveArg(arg, event, ctx.runtime));
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

			const currentValue = selectorFn(ctx.trace[pos]!);
			if (!jsonEqual(captured, currentValue)) {
				return "violated";
			}

			return evaluateFiniteNode(ctx, node.child, pos, env);
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
			return evaluateFiniteNode(ctx, node.child, pos, nextEnv);
		}

		case "not":
			return notV(evaluateFiniteNode(ctx, node.child, pos, env));

		case "and": {
			let result: Verdict = "satisfied";
			for (const childId of node.children) {
				result = andV(result, evaluateFiniteNode(ctx, childId, pos, env));
				if (result === "violated") {
					break;
				}
			}
			return result;
		}

		case "or": {
			let result: Verdict = "violated";
			for (const childId of node.children) {
				result = orV(result, evaluateFiniteNode(ctx, childId, pos, env));
				if (result === "satisfied") {
					break;
				}
			}
			return result;
		}

		case "implies":
			return impliesV(
				evaluateFiniteNode(ctx, node.left, pos, env),
				evaluateFiniteNode(ctx, node.right, pos, env),
			);

		case "always": {
			if (pos >= len) {
				return "satisfied";
			}

			let result: Verdict = "satisfied";
			for (let step = pos; step < len; step++) {
				result = andV(result, evaluateFiniteNode(ctx, node.child, step, env));
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
			for (let step = pos; step < len; step++) {
				result = orV(result, evaluateFiniteNode(ctx, node.child, step, env));
				if (result === "satisfied") {
					break;
				}
			}
			return result;
		}

		case "next":
			return pos + 1 >= len ? "violated" : evaluateFiniteNode(ctx, node.child, pos + 1, env);

		case "weakNext":
			return pos + 1 >= len ? "satisfied" : evaluateFiniteNode(ctx, node.child, pos + 1, env);

		case "until": {
			if (pos >= len) {
				return "violated";
			}

			let leftAccumulator: Verdict = "satisfied";
			for (let step = pos; step < len; step++) {
				const rightVerdict = evaluateFiniteNode(ctx, node.right, step, env);
				if (rightVerdict === "satisfied" && leftAccumulator === "satisfied") {
					return "satisfied";
				}

				const leftVerdict = evaluateFiniteNode(ctx, node.left, step, env);
				leftAccumulator = step === pos ? leftVerdict : andV(leftAccumulator, leftVerdict);
				if (leftAccumulator === "violated") {
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
			for (let step = pos; step < len; step++) {
				allRight = andV(allRight, evaluateFiniteNode(ctx, node.right, step, env));
				const leftVerdict = evaluateFiniteNode(ctx, node.left, step, env);
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

			for (let step = pos; step >= 0; step--) {
				if (evaluateFiniteNode(ctx, node.child, step, env) === "satisfied") {
					return "satisfied";
				}
			}

			return "violated";
		}

		case "historically": {
			if (pos >= len) {
				return "satisfied";
			}

			for (let step = 0; step <= pos; step++) {
				if (evaluateFiniteNode(ctx, node.child, step, env) === "violated") {
					return "violated";
				}
			}

			return "satisfied";
		}

		case "since": {
			if (pos >= len) {
				return "violated";
			}

			for (let witness = pos; witness >= 0; witness--) {
				if (evaluateFiniteNode(ctx, node.right, witness, env) !== "satisfied") {
					continue;
				}

				let leftOk: Verdict = "satisfied";
				for (let step = witness + 1; step <= pos; step++) {
					leftOk = andV(leftOk, evaluateFiniteNode(ctx, node.left, step, env));
					if (leftOk === "violated") {
						break;
					}
				}

				if (leftOk === "satisfied") {
					return "satisfied";
				}
			}

			return "violated";
		}

		case "withinSteps": {
			const upper = Math.min(pos + node.steps, len);
			for (let step = pos; step < upper; step++) {
				if (evaluateFiniteNode(ctx, node.child, step, env) === "satisfied") {
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
			for (let step = pos; step < len; step++) {
				const currentTs = getTimestamp(ctx.runtime, ctx.trace[step]!);
				if (currentTs - startTs > node.ms) {
					break;
				}
				if (evaluateFiniteNode(ctx, node.child, step, env) === "satisfied") {
					return "satisfied";
				}
			}

			return "violated";
		}
	}
}
