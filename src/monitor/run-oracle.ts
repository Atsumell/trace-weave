import { compile } from "../compiler/compile.js";
import { print } from "../compiler/printer.js";
import { validate } from "../compiler/validate.js";
import type { FormulaExpr } from "../core/formula-expr.js";
import type { MonitorRuntime } from "../core/runtime.js";
import { evaluateFormula } from "./evaluate.js";
import type { CounterexampleReport, OracleRunResult } from "./types.js";

export function runOracle<TEvent>(
	formula: FormulaExpr,
	runtime: MonitorRuntime<TEvent>,
	trace: readonly TEvent[],
): OracleRunResult {
	const doc = compile(formula);

	const errors = validate(doc);
	if (errors.length > 0) {
		const messages = errors.map((e) => `${e.nodeId}: ${e.message}`).join("; ");
		throw new Error(`Invalid formula: ${messages}`);
	}

	const verdict = evaluateFormula(doc, runtime, trace);

	let report: CounterexampleReport | null = null;
	if (verdict === "violated") {
		const formulaStr = print(doc);
		report = {
			verdict: "violated",
			failurePath: [],
			traceSlice: trace.map((event, i) => ({ step: i + 1, event })),
			summary: `Formula violated: ${formulaStr}`,
		};
	}

	return {
		verdict,
		steps: trace.length,
		report,
	};
}
