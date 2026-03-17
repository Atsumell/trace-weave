import type { FormulaNode } from "../core/formula-node.js";
import type { ActivationId, EnvId, NodeId } from "../core/ids.js";
import { activationId } from "../core/ids.js";
import type { ActivationRecord, MonitorState } from "./types.js";

export function ensureActivation<TEvent>(
	state: MonitorState<TEvent>,
	nodeId: NodeId,
	envIdVal: EnvId,
): ActivationId {
	const existing = state.nodeActivations.get(nodeId);
	if (existing) {
		for (const aid of existing) {
			const act = state.activations.get(aid);
			if (act && act.envId === envIdVal) return aid;
		}
	}

	const aid = activationId(`act_${nodeId}_${envIdVal}_${state.step}`);
	const record: ActivationRecord = {
		id: aid,
		nodeId,
		envId: envIdVal,
		startStep: state.step,
		verdict: "pending",
		prevVerdict: "pending",
	};
	state.activations.set(aid, record);

	if (!state.nodeActivations.has(nodeId)) {
		state.nodeActivations.set(nodeId, new Set());
	}
	state.nodeActivations.get(nodeId)!.add(aid);

	return aid;
}

export function materializeTreeActivations<TEvent>(
	state: MonitorState<TEvent>,
	nodeId: NodeId,
	envIdVal: EnvId,
): void {
	ensureActivation(state, nodeId, envIdVal);

	const node = state.compiled.document.nodes[nodeId];
	if (!node) return;

	const childIds = getChildNodeIds(node);
	for (const childId of childIds) {
		materializeTreeActivations(state, childId, envIdVal);
	}
}

function getChildNodeIds(node: FormulaNode): NodeId[] {
	switch (node.kind) {
		case "literal":
		case "predicate":
			return [];
		case "not":
		case "always":
		case "eventually":
		case "next":
		case "weakNext":
		case "once":
		case "historically":
		case "withinSteps":
		case "withinMs":
		case "when":
		case "capture":
			return [node.child];
		case "and":
		case "or":
			return [...node.children];
		case "implies":
		case "until":
		case "release":
		case "since":
			return [node.left, node.right];
	}
}
