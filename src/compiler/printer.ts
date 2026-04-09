import type { FormulaDocument } from "../core/formula-document.js";
import type { FormulaNode } from "../core/formula-node.js";
import type { NodeId } from "../core/ids.js";

function needsParens(node: FormulaNode): boolean {
	switch (node.kind) {
		case "and":
		case "or":
		case "implies":
		case "until":
		case "release":
		case "since":
			return true;
		default:
			return false;
	}
}

export function printNodeAt(nid: NodeId, doc: FormulaDocument): string {
	const node = doc.nodes[nid];
	if (!node) return `<unknown:${nid}>`;

	function child(cid: NodeId): string {
		const cnode = doc.nodes[cid];
		const s = printNodeAt(cid, doc);
		return cnode && needsParens(cnode) ? `(${s})` : s;
	}

	switch (node.kind) {
		case "literal":
			return node.value ? "true" : "false";
		case "predicate":
			return node.args && node.args.length > 0
				? `${node.predicateId}(${node.args.map((a) => (a.kind === "literal" ? JSON.stringify(a.value) : `$${a.selectorId}`)).join(", ")})`
				: String(node.predicateId);
		case "when":
			return `when(${node.captureName}, $${node.selectorId}, ${child(node.child)})`;
		case "capture":
			return `capture(${node.captureName}, $${node.selectorId}, ${child(node.child)})`;
		case "not":
			return `!${child(node.child)}`;
		case "and":
			return node.children.map((c) => child(c)).join(" & ");
		case "or":
			return node.children.map((c) => child(c)).join(" | ");
		case "implies":
			return `${child(node.left)} -> ${child(node.right)}`;
		case "always":
			return `G ${child(node.child)}`;
		case "eventually":
			return `F ${child(node.child)}`;
		case "next":
			return `X ${child(node.child)}`;
		case "weakNext":
			return `Xw ${child(node.child)}`;
		case "until":
			return `${child(node.left)} U ${child(node.right)}`;
		case "release":
			return `${child(node.left)} R ${child(node.right)}`;
		case "once":
			return `P ${child(node.child)}`;
		case "historically":
			return `H ${child(node.child)}`;
		case "since":
			return `${child(node.left)} S ${child(node.right)}`;
		case "withinSteps":
			return `within[${node.steps}] ${child(node.child)}`;
		case "withinMs":
			return `withinMs[${node.ms}] ${child(node.child)}`;
	}
}

export function print(doc: FormulaDocument): string {
	return printNodeAt(doc.root, doc);
}
