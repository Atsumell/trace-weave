import type { FormulaDocument } from "../core/formula-document.js";
import type { NodeId } from "../core/ids.js";
import type { FormulaMeta, NodeProvenance } from "../core/meta.js";

export function getNodeLabel(doc: FormulaDocument, nodeId: NodeId): string {
	const provenance = doc.provenance?.[nodeId];
	if (provenance?.meta?.humanLabel) return provenance.meta.humanLabel;

	const node = doc.nodes[nodeId];
	return node?.kind ?? "unknown";
}

export function getNodeProvenance(
	doc: FormulaDocument,
	nodeId: NodeId,
): NodeProvenance | undefined {
	return doc.provenance?.[nodeId];
}

export function getAllLabels(doc: FormulaDocument): Record<NodeId, string> {
	const labels: Record<string, string> = {};
	for (const nodeId of Object.keys(doc.nodes)) {
		labels[nodeId] = getNodeLabel(doc, nodeId as NodeId);
	}
	return labels as Record<NodeId, string>;
}
