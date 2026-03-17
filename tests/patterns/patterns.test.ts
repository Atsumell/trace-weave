import { describe, expect, it } from "vitest";
import { not, predicate } from "../../src/builder/factory.js";
import { predicateId } from "../../src/core/ids.js";
import type { PredicateId, SelectorId } from "../../src/core/ids.js";
import type { MonitorRuntime } from "../../src/core/runtime.js";
import { runOracle } from "../../src/monitor/run-oracle.js";
import {
	absence,
	between,
	boundedResponse,
	globally,
	after as patternAfter,
	before as patternBefore,
	persistence,
	precedence,
	response,
	stability,
} from "../../src/patterns/index.js";

interface TestEvent {
	type: string;
}

const pId = predicateId("isA");
const qId = predicateId("isB");
const rId = predicateId("isC");

const runtime: MonitorRuntime<TestEvent> = {
	predicates: {
		[pId]: (e) => e.type === "A",
		[qId]: (e) => e.type === "B",
		[rId]: (e) => e.type === "C",
	} as Record<
		PredicateId,
		(e: TestEvent, args: readonly import("../../src/core/values.js").JsonValue[]) => boolean
	>,
	selectors: {} as Record<
		SelectorId,
		(e: TestEvent) => import("../../src/core/values.js").JsonValue
	>,
};

describe("patterns", () => {
	describe("absence", () => {
		it("satisfied when p never appears", () => {
			const result = runOracle(absence(predicate(pId)), runtime, [{ type: "B" }, { type: "B" }]);
			expect(result.verdict).toBe("satisfied");
		});

		it("violated when p appears", () => {
			const result = runOracle(absence(predicate(pId)), runtime, [{ type: "B" }, { type: "A" }]);
			expect(result.verdict).toBe("violated");
		});
	});

	describe("response", () => {
		it("satisfied: every A followed by B", () => {
			const result = runOracle(response(predicate(pId), predicate(qId)), runtime, [
				{ type: "A" },
				{ type: "B" },
			]);
			expect(result.verdict).toBe("satisfied");
		});

		it("violated: A not followed by B", () => {
			const result = runOracle(response(predicate(pId), predicate(qId)), runtime, [
				{ type: "A" },
				{ type: "A" },
			]);
			expect(result.verdict).toBe("violated");
		});
	});

	describe("boundedResponse", () => {
		it("satisfied when the response arrives within the step budget", () => {
			const result = runOracle(boundedResponse(predicate(pId), predicate(qId), 2), runtime, [
				{ type: "A" },
				{ type: "B" },
			]);
			expect(result.verdict).toBe("satisfied");
		});

		it("violated when the response arrives after the step budget", () => {
			const result = runOracle(boundedResponse(predicate(pId), predicate(qId), 2), runtime, [
				{ type: "A" },
				{ type: "C" },
				{ type: "B" },
			]);
			expect(result.verdict).toBe("violated");
		});
	});

	describe("precedence", () => {
		it("satisfied: q only after p", () => {
			const result = runOracle(precedence(predicate(pId), predicate(qId)), runtime, [
				{ type: "A" },
				{ type: "B" },
			]);
			expect(result.verdict).toBe("satisfied");
		});

		it("violated: q before p", () => {
			const result = runOracle(precedence(predicate(pId), predicate(qId)), runtime, [
				{ type: "B" },
				{ type: "A" },
			]);
			expect(result.verdict).toBe("violated");
		});
	});

	describe("persistence", () => {
		it("satisfied: once p, always p", () => {
			const result = runOracle(persistence(predicate(pId)), runtime, [
				{ type: "B" },
				{ type: "A" },
				{ type: "A" },
			]);
			expect(result.verdict).toBe("satisfied");
		});

		it("violated: p then not-p", () => {
			const result = runOracle(persistence(predicate(pId)), runtime, [
				{ type: "A" },
				{ type: "B" },
			]);
			expect(result.verdict).toBe("violated");
		});
	});

	describe("stability", () => {
		it("satisfied when the post-trigger property keeps holding", () => {
			const result = runOracle(stability(predicate(pId), not(predicate(rId))), runtime, [
				{ type: "B" },
				{ type: "A" },
				{ type: "B" },
			]);
			expect(result.verdict).toBe("satisfied");
		});

		it("violated when the post-trigger property breaks later", () => {
			const result = runOracle(stability(predicate(pId), not(predicate(rId))), runtime, [
				{ type: "B" },
				{ type: "A" },
				{ type: "C" },
			]);
			expect(result.verdict).toBe("violated");
		});
	});

	describe("globally", () => {
		it("wraps a pattern over the whole trace", () => {
			const result = runOracle(globally(not(predicate(rId))), runtime, [
				{ type: "A" },
				{ type: "B" },
			]);
			expect(result.verdict).toBe("satisfied");
		});

		it("violates when the wrapped pattern fails anywhere", () => {
			const result = runOracle(globally(not(predicate(rId))), runtime, [
				{ type: "A" },
				{ type: "C" },
			]);
			expect(result.verdict).toBe("violated");
		});
	});

	describe("after", () => {
		it("starts enforcing the pattern only after the trigger", () => {
			const result = runOracle(patternAfter(predicate(pId), not(predicate(rId))), runtime, [
				{ type: "B" },
				{ type: "A" },
				{ type: "B" },
			]);
			expect(result.verdict).toBe("satisfied");
		});

		it("violates when the pattern fails after the trigger", () => {
			const result = runOracle(patternAfter(predicate(pId), not(predicate(rId))), runtime, [
				{ type: "A" },
				{ type: "C" },
			]);
			expect(result.verdict).toBe("violated");
		});
	});

	describe("before", () => {
		it("enforces the pattern only before the boundary event", () => {
			const result = runOracle(patternBefore(predicate(rId), not(predicate(qId))), runtime, [
				{ type: "A" },
				{ type: "C" },
				{ type: "B" },
			]);
			expect(result.verdict).toBe("satisfied");
		});

		it("violates when the pattern fails before the boundary event", () => {
			const result = runOracle(patternBefore(predicate(rId), not(predicate(qId))), runtime, [
				{ type: "B" },
				{ type: "C" },
			]);
			expect(result.verdict).toBe("violated");
		});
	});

	describe("between", () => {
		it("satisfied when the pattern holds throughout the active interval", () => {
			const result = runOracle(
				between(predicate(pId), predicate(rId), not(predicate(qId))),
				runtime,
				[{ type: "A" }, { type: "A" }, { type: "C" }, { type: "B" }],
			);
			expect(result.verdict).toBe("satisfied");
		});

		it("reactivates after a closing boundary and can violate on re-entry", () => {
			const result = runOracle(
				between(predicate(pId), predicate(rId), not(predicate(qId))),
				runtime,
				[{ type: "A" }, { type: "C" }, { type: "A" }, { type: "B" }],
			);
			expect(result.verdict).toBe("violated");
		});
	});
});
