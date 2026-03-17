import type { FormulaNode } from "../core/formula-node.js";
import type { EnvId, NodeId } from "../core/ids.js";
import type { JsonValue, ValueExprArg } from "../core/values.js";
import type { Verdict } from "../core/verdict.js";
import { andV, impliesV, notV, orV } from "../core/verdict.js";
import { allocChildEnv, resolveCapture } from "./env.js";
import { scheduleNext } from "./schedule.js";
import type { ActivationRecord, MonitorState } from "./types.js";

function resolveArg<TEvent>(
	arg: ValueExprArg,
	event: TEvent,
	activation: ActivationRecord,
	state: MonitorState<TEvent>,
): JsonValue {
	if (arg.kind === "literal") return arg.value;
	const selectorFn = state.runtime.selectors[arg.selectorId];
	if (!selectorFn) return null;
	return selectorFn(event);
}

function getChildVerdict<TEvent>(
	state: MonitorState<TEvent>,
	childNodeId: NodeId,
	parentActivation: ActivationRecord,
): Verdict {
	const childActivations = state.nodeActivations.get(childNodeId);
	if (!childActivations) return "pending";

	for (const aid of childActivations) {
		const act = state.activations.get(aid);
		if (act && act.envId === parentActivation.envId) {
			return act.verdict;
		}
	}
	return "pending";
}

function succOr(defaultVerdict: Verdict, futureVerdict: Verdict): Verdict {
	if (futureVerdict !== "pending") return futureVerdict;
	return defaultVerdict;
}

export function recompute<TEvent>(
	state: MonitorState<TEvent>,
	activation: ActivationRecord,
	event: TEvent,
	isTraceEnd: boolean,
): Verdict {
	const node = state.compiled.document.nodes[activation.nodeId];
	if (!node) return "pending";

	return recomputeNode(state, node, activation, event, isTraceEnd);
}

function recomputeNode<TEvent>(
	state: MonitorState<TEvent>,
	node: FormulaNode,
	activation: ActivationRecord,
	event: TEvent,
	isTraceEnd: boolean,
): Verdict {
	switch (node.kind) {
		case "literal":
			return node.value ? "satisfied" : "violated";

		case "predicate": {
			const predicateFn = state.runtime.predicates[node.predicateId];
			if (!predicateFn) return "violated";
			const args = (node.args ?? []).map((a) => resolveArg(a, event, activation, state));
			return predicateFn(event, args) ? "satisfied" : "violated";
		}

		case "when": {
			const captured = resolveCapture(state, activation.envId, node.captureName);
			if (captured === undefined) return "violated";
			const selectorFn = state.runtime.selectors[node.selectorId];
			if (!selectorFn) return "violated";
			const currentVal = selectorFn(event);
			if (!jsonEqual(captured, currentVal)) return "violated";
			return getChildVerdict(state, node.child, activation);
		}

		case "capture": {
			const selectorFn = state.runtime.selectors[node.selectorId];
			if (!selectorFn) return "violated";
			const val = selectorFn(event);
			const childEnvId = allocChildEnv(state, activation.envId, node.captureName, val);

			ensureChildActivation(state, node.child, childEnvId, activation);
			const childActs = state.nodeActivations.get(node.child);
			if (childActs) {
				for (const aid of childActs) {
					const act = state.activations.get(aid);
					if (act && act.envId === childEnvId) {
						return act.verdict;
					}
				}
			}
			return "pending";
		}

		case "not":
			return notV(getChildVerdict(state, node.child, activation));

		case "and": {
			let result: Verdict = "satisfied";
			for (const childId of node.children) {
				result = andV(result, getChildVerdict(state, childId, activation));
			}
			return result;
		}

		case "or": {
			let result: Verdict = "violated";
			for (const childId of node.children) {
				result = orV(result, getChildVerdict(state, childId, activation));
			}
			return result;
		}

		case "implies":
			return impliesV(
				getChildVerdict(state, node.left, activation),
				getChildVerdict(state, node.right, activation),
			);

		case "always": {
			const childNow = getChildVerdict(state, node.child, activation);
			if (isTraceEnd) {
				return childNow === "pending" ? "satisfied" : childNow;
			}
			const future = succOr("satisfied", activation.prevVerdict);
			scheduleNext(state, activation.nodeId, activation.id);
			return andV(childNow, future);
		}

		case "eventually": {
			const childNow = getChildVerdict(state, node.child, activation);
			if (isTraceEnd) {
				return childNow === "pending" ? "violated" : childNow;
			}
			const future = succOr("violated", activation.prevVerdict);
			scheduleNext(state, activation.nodeId, activation.id);
			return orV(childNow, future);
		}

		case "next": {
			if (isTraceEnd) return "violated";
			scheduleNext(state, activation.nodeId, activation.id);
			if (activation.prevVerdict !== "pending") {
				return getChildVerdict(state, node.child, activation);
			}
			return "pending";
		}

		case "weakNext": {
			if (isTraceEnd) return "satisfied";
			scheduleNext(state, activation.nodeId, activation.id);
			if (activation.prevVerdict !== "pending") {
				return getChildVerdict(state, node.child, activation);
			}
			return "pending";
		}

		case "until": {
			const rightNow = getChildVerdict(state, node.right, activation);
			if (rightNow === "satisfied") return "satisfied";
			const leftNow = getChildVerdict(state, node.left, activation);
			if (isTraceEnd) {
				return rightNow;
			}
			const future = succOr("violated", activation.prevVerdict);
			scheduleNext(state, activation.nodeId, activation.id);
			return orV(rightNow, andV(leftNow, future));
		}

		case "release": {
			const rightNow = getChildVerdict(state, node.right, activation);
			const leftNow = getChildVerdict(state, node.left, activation);
			if (leftNow === "satisfied" && rightNow === "satisfied") return "satisfied";
			if (isTraceEnd) {
				return rightNow;
			}
			const future = succOr("satisfied", activation.prevVerdict);
			scheduleNext(state, activation.nodeId, activation.id);
			return andV(rightNow, orV(leftNow, future));
		}

		case "once": {
			const childNow = getChildVerdict(state, node.child, activation);
			if (childNow === "satisfied") return "satisfied";
			return orV(childNow, activation.prevVerdict);
		}

		case "historically": {
			const childNow = getChildVerdict(state, node.child, activation);
			if (childNow === "violated") return "violated";
			return andV(
				childNow,
				activation.prevVerdict === "pending" ? "satisfied" : activation.prevVerdict,
			);
		}

		case "since": {
			const rightNow = getChildVerdict(state, node.right, activation);
			if (rightNow === "satisfied") return "satisfied";
			const leftNow = getChildVerdict(state, node.left, activation);
			const prev = activation.prevVerdict === "pending" ? "violated" : activation.prevVerdict;
			return orV(rightNow, andV(leftNow, prev));
		}

		case "withinSteps": {
			const childNow = getChildVerdict(state, node.child, activation);
			if (childNow === "satisfied") return "satisfied";
			const elapsed = state.step - activation.startStep;
			if (elapsed >= node.steps || isTraceEnd) return "violated";
			scheduleNext(state, activation.nodeId, activation.id);
			return "pending";
		}

		case "withinMs": {
			const childNow = getChildVerdict(state, node.child, activation);
			if (childNow === "satisfied") return "satisfied";
			if (isTraceEnd) return "violated";
			scheduleNext(state, activation.nodeId, activation.id);
			return "pending";
		}
	}
}

function ensureChildActivation<TEvent>(
	state: MonitorState<TEvent>,
	childNodeId: NodeId,
	childEnvId: EnvId,
	_parentActivation: ActivationRecord,
): void {
	const existing = state.nodeActivations.get(childNodeId);
	if (existing) {
		for (const aid of existing) {
			const act = state.activations.get(aid);
			if (act && act.envId === childEnvId) return;
		}
	}

	const aid = makeActivationId(`act_${childNodeId}_${childEnvId}_${state.step}`);
	const record: ActivationRecord = {
		id: aid,
		nodeId: childNodeId,
		envId: childEnvId,
		startStep: state.step,
		verdict: "pending",
		prevVerdict: "pending",
	};
	state.activations.set(aid, record);
	if (!state.nodeActivations.has(childNodeId)) {
		state.nodeActivations.set(childNodeId, new Set());
	}
	state.nodeActivations.get(childNodeId)!.add(aid);
	state.dirtyQueue.push({ nodeId: childNodeId, activationId: aid });
}

function makeActivationId(s: string): import("../core/ids.js").ActivationId {
	return s as import("../core/ids.js").ActivationId;
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
