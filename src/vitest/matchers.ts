import type { FormulaExpr } from "../core/formula-expr.js";
import type { MonitorRuntime } from "../core/runtime.js";
import { runOracle } from "../monitor/run-oracle.js";

export interface TraceMatcherOptions<TEvent> {
	readonly formula: FormulaExpr;
	readonly runtime: MonitorRuntime<TEvent>;
}

export function createMatchers() {
	return {
		toSatisfy<TEvent>(received: TEvent[], formula: FormulaExpr, runtime: MonitorRuntime<TEvent>) {
			const result = runOracle(formula, runtime, received);
			const pass = result.verdict === "satisfied";
			return {
				pass,
				message: () =>
					pass
						? "Expected trace NOT to satisfy formula, but it did"
						: `Expected trace to satisfy formula, but got verdict: ${result.verdict}\n${result.report?.summary ?? ""}`,
			};
		},

		toViolate<TEvent>(received: TEvent[], formula: FormulaExpr, runtime: MonitorRuntime<TEvent>) {
			const result = runOracle(formula, runtime, received);
			const pass = result.verdict === "violated";
			return {
				pass,
				message: () =>
					pass
						? "Expected trace NOT to violate formula, but it did"
						: `Expected trace to violate formula, but got verdict: ${result.verdict}`,
			};
		},
	};
}
