import * as fc from "fast-check";
import type { FormulaExpr } from "../core/formula-expr.js";
import type { MonitorRuntime } from "../core/runtime.js";
import { runOracle } from "../monitor/run-oracle.js";

export interface TracePropertyConfig<TEvent> {
	readonly formula: FormulaExpr;
	readonly runtime: MonitorRuntime<TEvent>;
	readonly traceArbitrary: fc.Arbitrary<TEvent[]>;
}

export function traceProperty<TEvent>(
	config: TracePropertyConfig<TEvent>,
): fc.IPropertyWithHooks<[TEvent[]]> {
	return fc.property(config.traceArbitrary, (trace) => {
		const result = runOracle(config.formula, config.runtime, trace);
		if (result.verdict === "violated") {
			const msg = result.report?.summary ?? "Formula violated";
			throw new Error(msg);
		}
	});
}

export function commandProperty<TEvent>(
	formula: FormulaExpr,
	runtime: MonitorRuntime<TEvent>,
	commandArbitrary: fc.Arbitrary<TEvent[]>,
): fc.IPropertyWithHooks<[TEvent[]]> {
	return traceProperty({
		formula,
		runtime,
		traceArbitrary: commandArbitrary,
	});
}
