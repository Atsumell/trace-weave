import type { FormulaDocument } from "../core/formula-document.js";
import type { MonitorRuntime } from "../core/runtime.js";
import type { Verdict } from "../core/verdict.js";
import { evaluateFiniteFormula } from "./evaluate-finite.js";

export function evaluateFormula<TEvent>(
	doc: FormulaDocument,
	runtime: MonitorRuntime<TEvent>,
	trace: readonly TEvent[],
): Verdict {
	return evaluateFiniteFormula(doc, runtime, trace);
}
