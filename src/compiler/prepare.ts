import type { FormulaDocument } from "../core/formula-document.js";

export interface CompiledFormula {
	readonly document: FormulaDocument;
}

export function prepare(doc: FormulaDocument): CompiledFormula {
	return {
		document: doc,
	};
}
