import type { FormulaDocument } from "../core/formula-document.js";
import type { FormulaNode } from "../core/formula-node.js";
import type { NodeId } from "../core/ids.js";
import type { MonitorRuntime } from "../core/runtime.js";
import type { JsonValue, ValueExprArg } from "../core/values.js";
import type { Verdict } from "../core/verdict.js";
import { andV, impliesV, notV, orV } from "../core/verdict.js";
import { assertTimeSupportForTrace, getTimestamp } from "./time.js";

interface EvalContext<TEvent> {
	readonly doc: FormulaDocument;
	readonly runtime: MonitorRuntime<TEvent>;
	readonly trace: readonly TEvent[];
	readonly envStack: Map<string, JsonValue>;
	readonly cache: Map<string, Verdict>;
}

function cacheKey(nodeId: NodeId, pos: number, envKey: string): string {
	return `${nodeId}:${pos}:${envKey}`;
}

function envKey(env: Map<string, JsonValue>): string {
	const entries = [...env.entries()].sort(([a], [b]) => a.localeCompare(b));
	return JSON.stringify(entries);
}

function resolveArg<TEvent>(arg: ValueExprArg, event: TEvent, ctx: EvalContext<TEvent>): JsonValue {
	if (arg.kind === "literal") return arg.value;
	const selectorFn = ctx.runtime.selectors[arg.selectorId];
	if (!selectorFn) return null;
	return selectorFn(event);
}

function evalNode<TEvent>(ctx: EvalContext<TEvent>, nodeId: NodeId, pos: number): Verdict {
	const ek = envKey(ctx.envStack);
	const ck = cacheKey(nodeId, pos, ek);
	const cached = ctx.cache.get(ck);
	if (cached !== undefined) return cached;

	const node = ctx.doc.nodes[nodeId];
	if (!node) return "violated";

	// Prevent infinite recursion by setting pending first
	ctx.cache.set(ck, "pending");

	const result = evalNodeInner(ctx, node, nodeId, pos);
	ctx.cache.set(ck, result);
	return result;
}

function evalNodeInner<TEvent>(
	ctx: EvalContext<TEvent>,
	node: FormulaNode,
	nodeId: NodeId,
	pos: number,
): Verdict {
	const len = ctx.trace.length;

	switch (node.kind) {
		case "literal":
			return node.value ? "satisfied" : "violated";

		case "predicate": {
			if (pos >= len) return "violated";
			const event = ctx.trace[pos]!;
			const predicateFn = ctx.runtime.predicates[node.predicateId];
			if (!predicateFn) return "violated";
			const args = (node.args ?? []).map((a) => resolveArg(a, event, ctx));
			return predicateFn(event, args) ? "satisfied" : "violated";
		}

		case "when": {
			if (pos >= len) return "violated";
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
			if (pos >= len) return "violated";
			const event = ctx.trace[pos]!;
			const selectorFn = ctx.runtime.selectors[node.selectorId];
			if (!selectorFn) return "violated";
			const val = selectorFn(event);
			const newEnv = new Map(ctx.envStack);
			newEnv.set(node.captureName as string, val);
			const childCtx: EvalContext<TEvent> = { ...ctx, envStack: newEnv };
			return evalNode(childCtx, node.child, pos);
		}

		case "not":
			return notV(evalNode(ctx, node.child, pos));

		case "and": {
			let result: Verdict = "satisfied";
			for (const childId of node.children) {
				result = andV(result, evalNode(ctx, childId, pos));
				if (result === "violated") break;
			}
			return result;
		}

		case "or": {
			let result: Verdict = "violated";
			for (const childId of node.children) {
				result = orV(result, evalNode(ctx, childId, pos));
				if (result === "satisfied") break;
			}
			return result;
		}

		case "implies":
			return impliesV(evalNode(ctx, node.left, pos), evalNode(ctx, node.right, pos));

		case "always": {
			// G(p) at pos = p[pos] & p[pos+1] & ... & p[len-1]
			// If pos >= len, vacuously satisfied
			if (pos >= len) return "satisfied";
			let result: Verdict = "satisfied";
			for (let i = pos; i < len; i++) {
				result = andV(result, evalNode(ctx, node.child, i));
				if (result === "violated") break;
			}
			return result;
		}

		case "eventually": {
			// F(p) at pos = p[pos] | p[pos+1] | ... | p[len-1]
			// If pos >= len, violated (no step exists)
			if (pos >= len) return "violated";
			let result: Verdict = "violated";
			for (let i = pos; i < len; i++) {
				result = orV(result, evalNode(ctx, node.child, i));
				if (result === "satisfied") break;
			}
			return result;
		}

		case "next": {
			// X(p) at pos: p at pos+1. If pos+1 >= len, violated (strong next)
			if (pos + 1 >= len) return "violated";
			return evalNode(ctx, node.child, pos + 1);
		}

		case "weakNext": {
			// Xw(p) at pos: p at pos+1. If pos+1 >= len, satisfied (weak next)
			if (pos + 1 >= len) return "satisfied";
			return evalNode(ctx, node.child, pos + 1);
		}

		case "until": {
			// p U q at pos: exists j >= pos: q[j] & forall i in [pos,j): p[i]
			if (pos >= len) return "violated";
			let leftAcc: Verdict = "satisfied";
			for (let j = pos; j < len; j++) {
				const rightJ = evalNode(ctx, node.right, j);
				if (rightJ === "satisfied" && leftAcc === "satisfied") return "satisfied";
				if (j === pos) {
					leftAcc = evalNode(ctx, node.left, j);
				} else {
					leftAcc = andV(leftAcc, evalNode(ctx, node.left, j));
				}
				if (leftAcc === "violated") break;
			}
			// Check if q holds at any remaining position
			// If we get here without returning, q never held while p held
			return "violated";
		}

		case "release": {
			// p R q at pos: q holds at all positions, or there exists j where p[j] and q holds up to j
			// Dual: p R q = !(!p U !q)
			if (pos >= len) return "satisfied";
			let allQ: Verdict = "satisfied";
			for (let j = pos; j < len; j++) {
				const rightJ = evalNode(ctx, node.right, j);
				allQ = andV(allQ, rightJ);
				const leftJ = evalNode(ctx, node.left, j);
				// If p holds at j and q held from pos..j, then release is satisfied
				if (leftJ === "satisfied" && allQ === "satisfied") return "satisfied";
				if (allQ === "violated") break;
			}
			// If q held at all positions, satisfied (even if p never held)
			if (allQ === "satisfied") return "satisfied";
			return "violated";
		}

		case "once": {
			// P(p) at pos: exists i in [0,pos] ∩ [0,len): p[i]
			if (pos >= len) return "violated";
			for (let i = pos; i >= 0; i--) {
				if (evalNode(ctx, node.child, i) === "satisfied") return "satisfied";
			}
			return "violated";
		}

		case "historically": {
			// H(p) at pos: forall i in [0,pos] ∩ [0,len): p[i]
			if (pos >= len) return "satisfied";
			for (let i = 0; i <= pos; i++) {
				if (evalNode(ctx, node.child, i) === "violated") return "violated";
			}
			return "satisfied";
		}

		case "since": {
			// p S q at pos: exists j <= pos: q[j] & forall i in (j,pos]: p[i]
			if (pos >= len) return "violated";
			for (let j = pos; j >= 0; j--) {
				if (evalNode(ctx, node.right, j) === "satisfied") {
					let leftOk: Verdict = "satisfied";
					for (let i = j + 1; i <= pos; i++) {
						leftOk = andV(leftOk, evalNode(ctx, node.left, i));
						if (leftOk === "violated") break;
					}
					if (leftOk === "satisfied") return "satisfied";
				}
			}
			return "violated";
		}

		case "withinSteps": {
			// F_{<n}(p) at pos: exists i in [pos, pos+n): p[i]
			const bound = Math.min(pos + node.steps, len);
			for (let i = pos; i < bound; i++) {
				if (evalNode(ctx, node.child, i) === "satisfied") return "satisfied";
			}
			return "violated";
		}

		case "withinMs": {
			if (pos >= len) return "violated";
			const startTs = getTimestamp(ctx.runtime, ctx.trace[pos]!);
			for (let i = pos; i < len; i++) {
				const currentTs = getTimestamp(ctx.runtime, ctx.trace[i]!);
				if (currentTs - startTs > node.ms) break;
				if (evalNode(ctx, node.child, i) === "satisfied") return "satisfied";
			}
			return "violated";
		}
	}
}

export function evaluateFormula<TEvent>(
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

function jsonEqual(a: JsonValue, b: JsonValue): boolean {
	if (a === b) return true;
	if (a === null || b === null) return a === b;
	if (typeof a !== typeof b) return false;
	if (typeof a !== "object") return a === b;
	if (Array.isArray(a)) {
		if (!Array.isArray(b)) return false;
		if (a.length !== b.length) return false;
		return a.every((v, i) => jsonEqual(v, b[i]!));
	}
	if (Array.isArray(b)) return false;
	const aObj = a as Record<string, JsonValue>;
	const bObj = b as Record<string, JsonValue>;
	const aKeys = Object.keys(aObj);
	const bKeys = Object.keys(bObj);
	if (aKeys.length !== bKeys.length) return false;
	return aKeys.every((k) => jsonEqual(aObj[k]!, bObj[k]!));
}
