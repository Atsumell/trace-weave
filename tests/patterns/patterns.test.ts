import { describe, expect, it } from "vitest";
import { predicate } from "../../src/builder/factory.js";
import { predicateId } from "../../src/core/ids.js";
import type { PredicateId, SelectorId } from "../../src/core/ids.js";
import type { MonitorRuntime } from "../../src/core/runtime.js";
import { runOracle } from "../../src/monitor/run-oracle.js";
import { absence, persistence, precedence, response } from "../../src/patterns/patterns.js";

interface TestEvent {
	type: string;
}

const pId = predicateId("isA");
const qId = predicateId("isB");

const runtime: MonitorRuntime<TestEvent> = {
	predicates: {
		[pId]: (e) => e.type === "A",
		[qId]: (e) => e.type === "B",
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
});
