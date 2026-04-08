import type { FormulaDocument } from "../core/formula-document.js";
import type { FormulaNode } from "../core/formula-node.js";
import type { NodeId } from "../core/ids.js";
import type { MonitorRuntime } from "../core/runtime.js";
import type { JsonValue } from "../core/values.js";
import type { Verdict } from "../core/verdict.js";
import { andV, impliesV, notV, orV } from "../core/verdict.js";
import { type EvalEnv, cacheKey, jsonEqual, resolveArg } from "./eval-common.js";
import { assertTimeSupportForTrace, getTimestamp } from "./time.js";

interface EvalContext<TEvent> {
	readonly doc: FormulaDocument;
	readonly runtime: MonitorRuntime<TEvent>;
	readonly trace: readonly TEvent[];
	readonly envStack: EvalEnv;
	readonly cache: Map<string, Verdict>;
}

function evalNode<TEvent>(ctx: EvalContext<TEvent>, nodeId: NodeId, pos: number): Verdict {
	const ck = cacheKey(nodeId, pos, ctx.envStack);
	const cached = ctx.cache.get(ck);
	if (cached !== undefined) return cached;

	const node = ctx.doc.nodes[nodeId];
	if (!node) return "violated";

	ctx.cache.set(ck, "pending");
	const result = evalNodeInner(ctx, node, pos);
	ctx.cache.set(ck, result);
	return result;
}

function evalNodeInner<TEvent>(ctx: EvalContext<TEvent>, node: FormulaNode, pos: number): Verdict {
	const len = ctx.trace.length;

	switch (node.kind) {
		case "literal":
			return node.value ? "satisfied" : "violated";

		case "predicate": {
			if (pos >= len) return "pending";
			const event = ctx.trace[pos]!;
			const predicateFn = ctx.runtime.predicates[node.predicateId];
			if (!predicateFn) return "violated";
			const args = (node.args ?? []).map((arg) => resolveArg(arg, event, ctx.runtime));
			return predicateFn(event, args) ? "satisfied" : "violated";
		}

		case "when": {
			if (pos >= len) return "pending";
			const event = ctx.trace[pos]!;
			const captured = ctx.envStack.get(node.captureName as string);
			if (captured === undefined) return "violated";
			const selectorFn = ctx.runtime.selectors[node.selectorId];
			if (!selectorFn) return "violated";
			const currentVal = selectorFn(event);
			if (!jsonEqual(captured, currentVal)) return "violated";
			return evalNode(ctx, node.child, pos);
		}

		case "capture": {
			if (pos >= len) return "pending";
			const event = ctx.trace[pos]!;
			const selectorFn = ctx.runtime.selectors[node.selectorId];
			if (!selectorFn) return "violated";
			const value = selectorFn(event);
			const newEnv = new Map(ctx.envStack);
			newEnv.set(node.captureName as string, value);
			return evalNode({ ...ctx, envStack: newEnv }, node.child, pos);
		}

		case "not":
			return notV(evalNode(ctx, node.child, pos));

		case "and":
			return node.children.reduce<Verdict>(
				(result, childId) => andV(result, evalNode(ctx, childId, pos)),
				"satisfied",
			);

		case "or":
			return node.children.reduce<Verdict>(
				(result, childId) => orV(result, evalNode(ctx, childId, pos)),
				"violated",
			);

		case "implies":
			return impliesV(evalNode(ctx, node.left, pos), evalNode(ctx, node.right, pos));

		case "always":
			if (pos >= len) return "pending";
			return andV(evalNode(ctx, node.child, pos), evalNodeInner(ctx, node, pos + 1));

		case "eventually":
			if (pos >= len) return "pending";
			return orV(evalNode(ctx, node.child, pos), evalNodeInner(ctx, node, pos + 1));

		case "next":
			if (pos + 1 >= len) return "pending";
			return evalNode(ctx, node.child, pos + 1);

		case "weakNext":
			if (pos + 1 >= len) return "pending";
			return evalNode(ctx, node.child, pos + 1);

		case "until":
			if (pos >= len) return "pending";
			return orV(
				evalNode(ctx, node.right, pos),
				andV(evalNode(ctx, node.left, pos), evalNodeInner(ctx, node, pos + 1)),
			);

		case "release":
			if (pos >= len) return "pending";
			return andV(
				evalNode(ctx, node.right, pos),
				orV(evalNode(ctx, node.left, pos), evalNodeInner(ctx, node, pos + 1)),
			);

		case "once":
			if (pos < 0) return "violated";
			return orV(evalNode(ctx, node.child, pos), evalNodeInner(ctx, node, pos - 1));

		case "historically":
			if (pos < 0) return "satisfied";
			return andV(evalNode(ctx, node.child, pos), evalNodeInner(ctx, node, pos - 1));

		case "since":
			if (pos < 0) return "violated";
			return orV(
				evalNode(ctx, node.right, pos),
				andV(evalNode(ctx, node.left, pos), evalNodeInner(ctx, node, pos - 1)),
			);

		case "withinSteps": {
			if (pos >= len) return "pending";
			const bound = pos + node.steps;
			let sawPending = false;
			for (let i = pos; i < Math.min(bound, len); i++) {
				const verdict = evalNode(ctx, node.child, i);
				if (verdict === "satisfied") return "satisfied";
				if (verdict === "pending") sawPending = true;
			}
			if (sawPending) return "pending";
			return len >= bound ? "violated" : "pending";
		}

		case "withinMs": {
			if (pos >= len) return "pending";
			const startTs = getTimestamp(ctx.runtime, ctx.trace[pos]!);
			let sawPending = false;
			let sawPastDeadline = false;
			for (let i = pos; i < len; i++) {
				const currentTs = getTimestamp(ctx.runtime, ctx.trace[i]!);
				if (currentTs - startTs > node.ms) {
					sawPastDeadline = true;
					break;
				}
				const verdict = evalNode(ctx, node.child, i);
				if (verdict === "satisfied") return "satisfied";
				if (verdict === "pending") sawPending = true;
			}
			if (sawPending) return "pending";
			return sawPastDeadline ? "violated" : "pending";
		}
	}
}

export function evaluateObservedPrefix<TEvent>(
	doc: FormulaDocument,
	runtime: MonitorRuntime<TEvent>,
	trace: readonly TEvent[],
): Verdict {
	assertTimeSupportForTrace(doc, runtime, trace);
	const ctx: EvalContext<TEvent> = {
		doc,
		runtime,
		trace,
		envStack: new Map(),
		cache: new Map(),
	};
	return evalNode(ctx, doc.root, 0);
}
