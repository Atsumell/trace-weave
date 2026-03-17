import { describe, expect, it } from "vitest";
import {
	always,
	and,
	eventually,
	historically,
	implies,
	literal,
	next,
	not,
	once,
	or,
	predicate,
	release,
	since,
	until,
	weakNext,
	withinMs,
	withinSteps,
} from "../../src/builder/factory.js";
import { predicateId, selectorId } from "../../src/core/ids.js";
import type { PredicateId, SelectorId } from "../../src/core/ids.js";
import type { MonitorRuntime } from "../../src/core/runtime.js";
import { runOracle } from "../../src/monitor/run-oracle.js";

interface TestEvent {
	type: string;
	value?: number;
	at?: number;
}

const pId = predicateId("isA");
const qId = predicateId("isB");
const valSel = selectorId("value");

const runtime: MonitorRuntime<TestEvent> = {
	predicates: {
		[pId]: (e) => e.type === "A",
		[qId]: (e) => e.type === "B",
	} as Record<
		PredicateId,
		(e: TestEvent, args: readonly import("../../src/core/values.js").JsonValue[]) => boolean
	>,
	selectors: {
		[valSel]: (e) => e.value ?? null,
	} as Record<SelectorId, (e: TestEvent) => import("../../src/core/values.js").JsonValue>,
	timestamp: (e) => e.at ?? 0,
};

describe("runOracle", () => {
	describe("literals", () => {
		it("true literal is always satisfied", () => {
			const result = runOracle(literal(true), runtime, [{ type: "A" }]);
			expect(result.verdict).toBe("satisfied");
		});

		it("false literal is always violated", () => {
			const result = runOracle(literal(false), runtime, [{ type: "A" }]);
			expect(result.verdict).toBe("violated");
		});
	});

	describe("predicates", () => {
		it("satisfied when predicate matches", () => {
			const result = runOracle(predicate(pId), runtime, [{ type: "A" }]);
			expect(result.verdict).toBe("satisfied");
		});

		it("violated when predicate does not match", () => {
			const result = runOracle(predicate(pId), runtime, [{ type: "B" }]);
			expect(result.verdict).toBe("violated");
		});
	});

	describe("boolean operators", () => {
		it("not negates", () => {
			const result = runOracle(not(predicate(pId)), runtime, [{ type: "B" }]);
			expect(result.verdict).toBe("satisfied");
		});

		it("and requires both", () => {
			expect(runOracle(and(literal(true), literal(true)), runtime, [{ type: "A" }]).verdict).toBe(
				"satisfied",
			);
			expect(runOracle(and(literal(true), literal(false)), runtime, [{ type: "A" }]).verdict).toBe(
				"violated",
			);
		});

		it("or requires at least one", () => {
			expect(runOracle(or(literal(false), literal(true)), runtime, [{ type: "A" }]).verdict).toBe(
				"satisfied",
			);
			expect(runOracle(or(literal(false), literal(false)), runtime, [{ type: "A" }]).verdict).toBe(
				"violated",
			);
		});

		it("implies: false -> anything = satisfied", () => {
			expect(
				runOracle(implies(literal(false), literal(false)), runtime, [{ type: "A" }]).verdict,
			).toBe("satisfied");
		});
	});

	describe("always (G)", () => {
		it("satisfied when predicate holds at every step", () => {
			const result = runOracle(always(predicate(pId)), runtime, [
				{ type: "A" },
				{ type: "A" },
				{ type: "A" },
			]);
			expect(result.verdict).toBe("satisfied");
		});

		it("violated when predicate fails at any step", () => {
			const result = runOracle(always(predicate(pId)), runtime, [
				{ type: "A" },
				{ type: "B" },
				{ type: "A" },
			]);
			expect(result.verdict).toBe("violated");
		});
	});

	describe("eventually (F)", () => {
		it("satisfied when predicate holds at some step", () => {
			const result = runOracle(eventually(predicate(pId)), runtime, [
				{ type: "B" },
				{ type: "B" },
				{ type: "A" },
			]);
			expect(result.verdict).toBe("satisfied");
		});

		it("violated when predicate never holds", () => {
			const result = runOracle(eventually(predicate(pId)), runtime, [{ type: "B" }, { type: "B" }]);
			expect(result.verdict).toBe("violated");
		});
	});

	describe("end-of-trace semantics", () => {
		it("next at end of trace -> violated", () => {
			const result = runOracle(next(predicate(pId)), runtime, [{ type: "A" }]);
			expect(result.verdict).toBe("violated");
		});

		it("weakNext at end of trace -> satisfied", () => {
			const result = runOracle(weakNext(predicate(pId)), runtime, [{ type: "A" }]);
			expect(result.verdict).toBe("satisfied");
		});

		it("next with successor -> evaluates child at next step", () => {
			const result = runOracle(next(predicate(pId)), runtime, [{ type: "B" }, { type: "A" }]);
			expect(result.verdict).toBe("satisfied");
		});

		it("always on empty trace -> satisfied", () => {
			const result = runOracle(always(predicate(pId)), runtime, []);
			expect(result.verdict).toBe("satisfied");
		});

		it("eventually on empty trace -> violated", () => {
			const result = runOracle(eventually(predicate(pId)), runtime, []);
			// Empty trace: no step exists where p can hold → violated
			expect(result.verdict).toBe("violated");
		});
	});

	describe("until (U)", () => {
		it("satisfied when right becomes true", () => {
			const result = runOracle(until(predicate(pId), predicate(qId)), runtime, [
				{ type: "A" },
				{ type: "A" },
				{ type: "B" },
			]);
			expect(result.verdict).toBe("satisfied");
		});

		it("violated when left fails before right holds", () => {
			const result = runOracle(until(predicate(pId), predicate(qId)), runtime, [
				{ type: "A" },
				{ type: "C" } as TestEvent,
			]);
			expect(result.verdict).toBe("violated");
		});
	});

	describe("release (R)", () => {
		it("satisfied when right always holds", () => {
			const result = runOracle(release(predicate(pId), predicate(qId)), runtime, [
				{ type: "B" },
				{ type: "B" },
			]);
			expect(result.verdict).toBe("satisfied");
		});

		it("satisfied when left is trivially true and right holds at the current step", () => {
			const result = runOracle(release(literal(true), predicate(qId)), runtime, [{ type: "B" }]);
			expect(result.verdict).toBe("satisfied");
		});

		it("violated when right fails before left ever holds", () => {
			const result = runOracle(release(predicate(pId), predicate(qId)), runtime, [
				{ type: "C" } as TestEvent,
			]);
			expect(result.verdict).toBe("violated");
		});
	});

	describe("past operators", () => {
		it("once: satisfied after predicate has held", () => {
			const result = runOracle(always(implies(once(predicate(pId)), predicate(qId))), runtime, [
				{ type: "A" },
				{ type: "B" },
				{ type: "B" },
			]);
			// After A appears, B must hold. At step 1 (A), once(A)=true, need B? No, A is at step 1.
			// Actually once(A) is true at step 1 (A matches), but qId(A) is false at step 1...
			// This should be violated because at step 1, once(A)=true but B is false
			expect(result.verdict).toBe("violated");
		});

		it("historically: satisfied when predicate always held in past", () => {
			const result = runOracle(historically(predicate(pId)), runtime, [
				{ type: "A" },
				{ type: "A" },
			]);
			expect(result.verdict).toBe("satisfied");
		});

		it("historically: violated when predicate failed in past", () => {
			const result = runOracle(historically(predicate(pId)), runtime, [
				{ type: "B" },
				{ type: "A" },
			]);
			expect(result.verdict).toBe("violated");
		});

		it("since: satisfied when the witness has occurred before the trigger", () => {
			const result = runOracle(
				always(implies(predicate(qId), since(literal(true), predicate(pId)))),
				runtime,
				[{ type: "A" }, { type: "B" }],
			);
			expect(result.verdict).toBe("satisfied");
		});

		it("since: violated when the witness never occurred before the trigger", () => {
			const result = runOracle(
				always(implies(predicate(qId), since(literal(true), predicate(pId)))),
				runtime,
				[{ type: "C" } as TestEvent, { type: "B" }],
			);
			expect(result.verdict).toBe("violated");
		});
	});

	describe("bounded operators", () => {
		it("withinSteps: satisfied when child holds within budget", () => {
			const result = runOracle(withinSteps(3, predicate(pId)), runtime, [
				{ type: "B" },
				{ type: "A" },
			]);
			expect(result.verdict).toBe("satisfied");
		});

		it("withinSteps: violated when budget expires", () => {
			const result = runOracle(withinSteps(2, predicate(pId)), runtime, [
				{ type: "B" },
				{ type: "B" },
				{ type: "A" },
			]);
			expect(result.verdict).toBe("violated");
		});

		it("withinMs: satisfied when child holds before deadline", () => {
			const result = runOracle(withinMs(1000, predicate(pId)), runtime, [
				{ type: "B", at: 0 },
				{ type: "A", at: 900 },
			]);
			expect(result.verdict).toBe("satisfied");
		});

		it("withinMs: violated when first witness is after deadline", () => {
			const result = runOracle(withinMs(1000, predicate(pId)), runtime, [
				{ type: "B", at: 0 },
				{ type: "A", at: 1500 },
			]);
			expect(result.verdict).toBe("violated");
		});

		it("withinMs: throws when runtime has no timestamp support", () => {
			const runtimeWithoutTimestamp: MonitorRuntime<TestEvent> = {
				predicates: runtime.predicates,
				selectors: runtime.selectors,
			};
			expect(() =>
				runOracle(withinMs(1000, predicate(pId)), runtimeWithoutTimestamp, [{ type: "A", at: 0 }]),
			).toThrowError(/MonitorRuntime.timestamp/);
		});

		it("withinMs: throws on non-monotonic timestamps", () => {
			expect(() =>
				runOracle(withinMs(1000, predicate(pId)), runtime, [
					{ type: "B", at: 1000 },
					{ type: "A", at: 500 },
				]),
			).toThrowError(/non-decreasing/);
		});
	});

	describe("response pattern (G(p -> F q))", () => {
		it("satisfied when every A is followed by B", () => {
			const result = runOracle(
				always(implies(predicate(pId), eventually(predicate(qId)))),
				runtime,
				[{ type: "A" }, { type: "B" }, { type: "A" }, { type: "B" }],
			);
			expect(result.verdict).toBe("satisfied");
		});

		it("violated when A is not followed by B", () => {
			const result = runOracle(
				always(implies(predicate(pId), eventually(predicate(qId)))),
				runtime,
				[{ type: "A" }, { type: "A" }],
			);
			expect(result.verdict).toBe("violated");
		});
	});

	describe("report", () => {
		it("provides counterexample report on violation", () => {
			const result = runOracle(always(predicate(pId)), runtime, [{ type: "A" }, { type: "B" }]);
			expect(result.verdict).toBe("violated");
			expect(result.report).not.toBeNull();
			expect(result.report?.verdict).toBe("violated");
			expect(result.report?.summary).toContain("violated");
		});

		it("no report on satisfaction", () => {
			const result = runOracle(always(predicate(pId)), runtime, [{ type: "A" }]);
			expect(result.verdict).toBe("satisfied");
			expect(result.report).toBeNull();
		});
	});
});
