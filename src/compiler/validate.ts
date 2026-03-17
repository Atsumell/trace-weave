import type { FormulaDocument } from "../core/formula-document.js";
import type { NodeId } from "../core/ids.js";

export interface ValidationError {
	readonly nodeId: NodeId;
	readonly message: string;
}

export function validate(doc: FormulaDocument): ValidationError[] {
	const errors: ValidationError[] = [];

	function walk(nid: NodeId, scopedCaptures: Set<string>): void {
		const node = doc.nodes[nid];
		if (!node) {
			errors.push({ nodeId: nid, message: `Node ${nid} not found in document` });
			return;
		}

		switch (node.kind) {
			case "capture": {
				const name = node.captureName as string;
				if (scopedCaptures.has(name)) {
					errors.push({
						nodeId: nid,
						message: `Capture name "${name}" shadows an outer capture`,
					});
				}
				const inner = new Set(scopedCaptures);
				inner.add(name);
				walk(node.child, inner);
				break;
			}

			case "when": {
				const name = node.captureName as string;
				if (!scopedCaptures.has(name)) {
					errors.push({
						nodeId: nid,
						message: `When references capture "${name}" which is not in scope`,
					});
				}
				walk(node.child, scopedCaptures);
				break;
			}

			case "withinSteps":
				if (node.steps <= 0 || !Number.isInteger(node.steps)) {
					errors.push({
						nodeId: nid,
						message: `withinSteps requires a positive integer, got ${node.steps}`,
					});
				}
				walk(node.child, scopedCaptures);
				break;

			case "withinMs":
				if (node.ms <= 0) {
					errors.push({
						nodeId: nid,
						message: `withinMs requires a positive number, got ${node.ms}`,
					});
				}
				walk(node.child, scopedCaptures);
				break;

			case "not":
			case "always":
			case "eventually":
			case "next":
			case "weakNext":
			case "once":
			case "historically":
				walk(node.child, scopedCaptures);
				break;

			case "and":
			case "or":
				for (const child of node.children) {
					walk(child, scopedCaptures);
				}
				break;

			case "implies":
			case "until":
			case "release":
			case "since":
				walk(node.left, scopedCaptures);
				walk(node.right, scopedCaptures);
				break;

			case "literal":
			case "predicate":
				break;
		}
	}

	walk(doc.root, new Set());
	return errors;
}
