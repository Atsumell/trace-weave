import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { always, and, eventually, implies, not, or, predicate } from "../../src/builder/factory.js";
import { predicateId } from "../../src/core/ids.js";
import type { PredicateId, SelectorId } from "../../src/core/ids.js";
import type { MonitorRuntime } from "../../src/core/runtime.js";
import { runOracle } from "../../src/monitor/run-oracle.js";

interface E {
	val: boolean;
}

const pId = predicateId("p");
const qId = predicateId("q");

const runtime: MonitorRuntime<E> = {
	predicates: {
		[pId]: (e) => e.val,
		[qId]: (e) => !e.val,
	} as Record<
		PredicateId,
		(e: E, args: readonly import("../../src/core/values.js").JsonValue[]) => boolean
	>,
	selectors: {} as Record<SelectorId, (e: E) => import("../../src/core/values.js").JsonValue>,
};

const eventArb = fc.record({ val: fc.boolean() });
const traceArb = fc.array(eventArb, { minLength: 0, maxLength: 20 });

describe("property-based meta-tests", () => {
	it("duality: !G(p) == F(!p)", () => {
		fc.assert(
			fc.property(traceArb, (trace) => {
				const lhs = runOracle(not(always(predicate(pId))), runtime, trace).verdict;
				const rhs = runOracle(eventually(not(predicate(pId))), runtime, trace).verdict;
				expect(lhs).toBe(rhs);
			}),
		);
	});

	it("duality: !F(p) == G(!p)", () => {
		fc.assert(
			fc.property(traceArb, (trace) => {
				const lhs = runOracle(not(eventually(predicate(pId))), runtime, trace).verdict;
				const rhs = runOracle(always(not(predicate(pId))), runtime, trace).verdict;
				expect(lhs).toBe(rhs);
			}),
		);
	});

	it("idempotence: G(G(p)) == G(p)", () => {
		fc.assert(
			fc.property(traceArb, (trace) => {
				const lhs = runOracle(always(always(predicate(pId))), runtime, trace).verdict;
				const rhs = runOracle(always(predicate(pId)), runtime, trace).verdict;
				expect(lhs).toBe(rhs);
			}),
		);
	});

	it("idempotence: F(F(p)) == F(p)", () => {
		fc.assert(
			fc.property(traceArb, (trace) => {
				const lhs = runOracle(eventually(eventually(predicate(pId))), runtime, trace).verdict;
				const rhs = runOracle(eventually(predicate(pId)), runtime, trace).verdict;
				expect(lhs).toBe(rhs);
			}),
		);
	});

	it("boolean: p & true == p", () => {
		fc.assert(
			fc.property(traceArb, (trace) => {
				const lhs = runOracle(
					and(predicate(pId), { kind: "literal", value: true }),
					runtime,
					trace,
				).verdict;
				const rhs = runOracle(predicate(pId), runtime, trace).verdict;
				expect(lhs).toBe(rhs);
			}),
		);
	});

	it("boolean: p | false == p", () => {
		fc.assert(
			fc.property(traceArb, (trace) => {
				const lhs = runOracle(
					or(predicate(pId), { kind: "literal", value: false }),
					runtime,
					trace,
				).verdict;
				const rhs = runOracle(predicate(pId), runtime, trace).verdict;
				expect(lhs).toBe(rhs);
			}),
		);
	});

	it("implies equivalence: (p -> q) == (!p | q)", () => {
		fc.assert(
			fc.property(traceArb, (trace) => {
				const lhs = runOracle(implies(predicate(pId), predicate(qId)), runtime, trace).verdict;
				const rhs = runOracle(or(not(predicate(pId)), predicate(qId)), runtime, trace).verdict;
				expect(lhs).toBe(rhs);
			}),
		);
	});

	it("double negation: !!p == p", () => {
		fc.assert(
			fc.property(traceArb, (trace) => {
				const lhs = runOracle(not(not(predicate(pId))), runtime, trace).verdict;
				const rhs = runOracle(predicate(pId), runtime, trace).verdict;
				expect(lhs).toBe(rhs);
			}),
		);
	});
});
