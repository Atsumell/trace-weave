import type { FormulaNode } from "./formula-node.js";
import type { NodeId } from "./ids.js";
import type { NodeProvenance } from "./meta.js";

export interface FormulaDocument {
	readonly schemaVersion: 1;
	readonly root: NodeId;
	readonly nodes: Readonly<Record<NodeId, FormulaNode>>;
	readonly provenance?: Readonly<Record<NodeId, NodeProvenance>>;
}
