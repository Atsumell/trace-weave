import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { always, predicate } from "../../src/builder/factory.js";
import { predicateId } from "../../src/core/ids.js";
import type { PredicateId, SelectorId } from "../../src/core/ids.js";
import type { MonitorRuntime } from "../../src/core/runtime.js";
import type { JsonValue } from "../../src/core/values.js";
import {
	commandAdapter,
	commandProperty,
	traceArbitrary,
	traceProperty,
} from "../../src/fast-check/index.js";

interface TestEvent {
	readonly tags: readonly string[];
}

interface CounterModel {
	count: number;
}

class RealCounter {
	count = 0;

	increment(): void {
		this.count += 1;
	}

	decrement(): void {
		this.count -= 1;
	}
}

const isOk = predicateId("isOk");

const runtime: MonitorRuntime<TestEvent> = {
	predicates: {
		[isOk]: (event) => event.tags.includes("ok"),
	} as Record<PredicateId, (event: TestEvent, args: readonly JsonValue[]) => boolean>,
	selectors: {} as Record<SelectorId, (event: TestEvent) => JsonValue>,
};

describe("fast-check integration", () => {
	it("traceArbitrary respects configured bounds", () => {
		const traces = fc.sample(
			traceArbitrary({
				eventArbitrary: fc.record({
					tags: fc.constant(["ok"] as const),
				}),
				minLength: 2,
				maxLength: 4,
			}),
			20,
		);

		for (const trace of traces) {
			expect(trace.length).toBeGreaterThanOrEqual(2);
			expect(trace.length).toBeLessThanOrEqual(4);
		}
	});

	it("commandAdapter omits commands whose preconditions fail", () => {
		const blockedDecrement: fc.Command<CounterModel, RealCounter> = {
			check: (model) => model.count > 0,
			run: (model, real) => {
				model.count -= 1;
				real.decrement();
			},
			toString: () => "decrement",
		};

		const traces = fc.sample(
			commandAdapter({
				commands: [fc.constant(blockedDecrement)],
				initialModel: () => ({ count: 0 }),
				initialReal: () => new RealCounter(),
			}),
			20,
		);

		for (const events of traces) {
			expect(events).toEqual([]);
		}
	});

	it("commandAdapter records exact before/after model snapshots for executed commands", () => {
		const increment: fc.Command<CounterModel, RealCounter> = {
			check: () => true,
			run: (model, real) => {
				model.count += 1;
				real.increment();
			},
			toString: () => "increment",
		};

		const decrement: fc.Command<CounterModel, RealCounter> = {
			check: (model) => model.count > 0,
			run: (model, real) => {
				model.count -= 1;
				real.decrement();
			},
			toString: () => "decrement",
		};

		const traces = fc.sample(
			commandAdapter({
				commands: [fc.constant(increment), fc.constant(decrement)],
				initialModel: () => ({ count: 0 }),
				initialReal: () => new RealCounter(),
			}),
			50,
		);

		expect(traces.some((events) => events.length > 0)).toBe(true);

		for (const events of traces) {
			for (let index = 0; index < events.length; index++) {
				const current = events[index]!;
				const previousAfter =
					index === 0 ? 0 : (events[index - 1]?.modelAfter as CounterModel).count;
				const before = (current.modelBefore as CounterModel).count;
				const after = (current.modelAfter as CounterModel).count;

				expect(before).toBe(previousAfter);
				if (current.type === "increment") {
					expect(after).toBe(before + 1);
				} else {
					expect(current.type).toBe("decrement");
					expect(before).toBeGreaterThan(0);
					expect(after).toBe(before - 1);
				}
			}
		}
	});

	it("traceProperty passes satisfied traces and fails violated traces", () => {
		const formula = always(predicate(isOk));

		const passing = traceProperty({
			formula,
			runtime,
			traceArbitrary: fc.constant([{ tags: ["ok"] }, { tags: ["ok"] }]),
		});
		const failing = traceProperty({
			formula,
			runtime,
			traceArbitrary: fc.constant([{ tags: ["ok"] }, { tags: ["bad"] }]),
		});

		expect(() => fc.assert(passing, { numRuns: 1 })).not.toThrow();
		expect(() => fc.assert(failing, { numRuns: 1 })).toThrowError(/Formula violated/);
	});

	it("commandProperty forwards traces through the same oracle semantics", () => {
		const formula = always(predicate(isOk));
		const property = commandProperty(formula, runtime, fc.constant([{ tags: ["ok"] }]));

		expect(() => fc.assert(property, { numRuns: 1 })).not.toThrow();
	});

	it("commandProperty fails when the adapted trace violates the formula", () => {
		const formula = always(predicate(isOk));
		const property = commandProperty(formula, runtime, fc.constant([{ tags: ["bad"] }]));

		expect(() => fc.assert(property, { numRuns: 1 })).toThrowError(/Formula violated/);
	});
});
