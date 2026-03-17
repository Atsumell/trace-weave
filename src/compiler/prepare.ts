import type { FormulaDocument } from "../core/formula-document.js";
import type { FormulaNode } from "../core/formula-node.js";
import type { NodeId } from "../core/ids.js";

export type SweepDirection = "future" | "past" | "none";

export interface CompiledFormula {
	readonly document: FormulaDocument;
	readonly topoOrder: readonly NodeId[];
	readonly reverseTopoOrder: readonly NodeId[];
	readonly children: Readonly<Record<NodeId, readonly NodeId[]>>;
	readonly parents: Readonly<Record<NodeId, readonly NodeId[]>>;
	readonly sweepDirection: Readonly<Record<NodeId, SweepDirection>>;
}

function getChildIds(node: FormulaNode): NodeId[] {
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

function getSweepDirection(kind: FormulaNode["kind"]): SweepDirection {
	switch (kind) {
		case "always":
		case "eventually":
		case "next":
		case "weakNext":
		case "until":
		case "release":
		case "withinSteps":
		case "withinMs":
			return "future";
		case "once":
		case "historically":
		case "since":
			return "past";
		default:
			return "none";
	}
}

export function prepare(doc: FormulaDocument): CompiledFormula {
	const children: Record<string, NodeId[]> = {};
	const parents: Record<string, NodeId[]> = {};
	const sweepDirection: Record<string, SweepDirection> = {};

	for (const [id, node] of Object.entries(doc.nodes)) {
		const nid = id as NodeId;
		const childIds = getChildIds(node);
		children[nid] = childIds;
		sweepDirection[nid] = getSweepDirection(node.kind);

		for (const childId of childIds) {
			if (!parents[childId]) parents[childId] = [];
			parents[childId]!.push(nid);
		}

		if (!parents[nid]) parents[nid] = [];
	}

	// Kahn's algorithm for topological sort (leaves first)
	const inDegree: Record<string, number> = {};
	for (const id of Object.keys(doc.nodes)) {
		inDegree[id] = children[id]?.length ?? 0;
	}

	const queue: NodeId[] = [];
	for (const [id, deg] of Object.entries(inDegree)) {
		if (deg === 0) queue.push(id as NodeId);
	}

	const topoOrder: NodeId[] = [];
	while (queue.length > 0) {
		const current = queue.shift()!;
		topoOrder.push(current);
		for (const parent of parents[current] ?? []) {
			inDegree[parent] = (inDegree[parent] ?? 1) - 1;
			if (inDegree[parent] === 0) queue.push(parent);
		}
	}

	return {
		document: doc,
		topoOrder,
		reverseTopoOrder: [...topoOrder].reverse(),
		children: children as Record<NodeId, NodeId[]>,
		parents: parents as Record<NodeId, NodeId[]>,
		sweepDirection: sweepDirection as Record<NodeId, SweepDirection>,
	};
}
