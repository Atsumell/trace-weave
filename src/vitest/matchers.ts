import { compile } from "../compiler/compile.js";
import { print } from "../compiler/printer.js";
import type { FormulaExpr } from "../core/formula-expr.js";
import type { MonitorRuntime } from "../core/runtime.js";
import { formatCounterexampleMessage } from "../monitor/format-message.js";
import { runOracle } from "../monitor/run-oracle.js";

export interface TraceMatcherOptions<TEvent> {
	readonly formula: FormulaExpr;
	readonly runtime: MonitorRuntime<TEvent>;
}

export function createMatchers() {
	return {
		toSatisfy<TEvent>(received: TEvent[], formula: FormulaExpr, runtime: MonitorRuntime<TEvent>) {
			const doc = compile(formula);
			const renderedFormula = print(doc);
			const result = runOracle(formula, runtime, received);
			const pass = result.verdict === "satisfied";
			return {
				pass,
				message: () =>
					pass
						? "Expected trace NOT to satisfy formula, but it did"
						: result.report
							? `Expected trace to satisfy formula, but got verdict: ${result.verdict}\n${formatCounterexampleMessage(result.report, doc)}`
							: `Expected trace to satisfy formula ${renderedFormula}, but got verdict: ${result.verdict}`,
			};
		},

		toViolate<TEvent>(received: TEvent[], formula: FormulaExpr, runtime: MonitorRuntime<TEvent>) {
			const renderedFormula = print(compile(formula));
			const result = runOracle(formula, runtime, received);
			const pass = result.verdict === "violated";
			return {
				pass,
				message: () =>
					pass
						? "Expected trace NOT to violate formula, but it did"
						: `Expected trace to violate formula ${renderedFormula}, but got verdict: ${result.verdict}`,
			};
		},
	};
}
