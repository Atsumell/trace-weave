import { expect } from "vitest";
import type { FormulaExpr } from "../core/formula-expr.js";
import type { MonitorRuntime } from "../core/runtime.js";
import { createMatchers } from "./matchers.js";

declare module "vitest" {
	interface CustomMatchers<R> {
		toSatisfy<TEvent>(formula: FormulaExpr, runtime: MonitorRuntime<TEvent>): R;
		toViolate<TEvent>(formula: FormulaExpr, runtime: MonitorRuntime<TEvent>): R;
	}
}

export function installMatchers(): void {
	expect.extend(createMatchers());
}
