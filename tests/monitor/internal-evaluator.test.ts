import { describe, expect, it } from "vitest";
import {
	always,
	capture,
	eventually,
	implies,
	predicate,
	weakNext,
	when,
	withinMs,
} from "../../src/builder/factory.js";
import { compile } from "../../src/compiler/compile.js";
import { captureName, predicateId, selectorId } from "../../src/core/ids.js";
import type { PredicateId, SelectorId } from "../../src/core/ids.js";
import type { MonitorRuntime } from "../../src/core/runtime.js";
import type { JsonValue } from "../../src/core/values.js";
import { buildCounterexampleReport } from "../../src/monitor/diagnostics.js";
import { evaluateObservedPrefix } from "../../src/monitor/evaluate-prefix.js";
import { evaluateFormula } from "../../src/monitor/evaluate.js";

interface TestEvent {
	readonly tags: readonly string[];
	readonly id?: number;
	readonly at?: number;
}

const isA = predicateId("isA");
const isB = predicateId("isB");
const isRequest = predicateId("isRequest");
const isResponse = predicateId("isResponse");
const idSel = selectorId("id");
const requestId = captureName("requestId");

const runtime: MonitorRuntime<TestEvent> = {
	predicates: {
		[isA]: (event) => event.tags.includes("a"),
		[isB]: (event) => event.tags.includes("b"),
		[isRequest]: (event) => event.tags.includes("request"),
		[isResponse]: (event) => event.tags.includes("response"),
	} as Record<PredicateId, (event: TestEvent, args: readonly JsonValue[]) => boolean>,
	selectors: {
		[idSel]: (event) => event.id ?? null,
	} as Record<SelectorId, (event: TestEvent) => JsonValue>,
	timestamp: (event) => event.at ?? 0,
};

function event(tags: readonly string[], id?: number, at?: number): TestEvent {
	return {
		tags,
		...(id === undefined ? {} : { id }),
		...(at === undefined ? {} : { at }),
	};
}

describe("internal monitor evaluators", () => {
	it("keeps weakNext pending on an observed prefix while final evaluation resolves it", () => {
		const doc = compile(weakNext(predicate(isB)));
		const trace = [event(["a"])];

		expect(evaluateObservedPrefix(doc, runtime, trace)).toBe("pending");
		expect(evaluateFormula(doc, runtime, trace)).toBe("satisfied");
	});

	it("keeps withinMs pending before the deadline on a prefix while finite evaluation resolves the trace", () => {
		const doc = compile(withinMs(1000, predicate(isB)));
		const trace = [event(["a"], undefined, 0), event(["a"], undefined, 500)];

		expect(evaluateObservedPrefix(doc, runtime, trace)).toBe("pending");
		expect(evaluateFormula(doc, runtime, trace)).toBe("violated");
	});

	it("builds a failure path consistent with finite evaluation", () => {
		const doc = compile(always(predicate(isA)));
		const trace = [event(["a"]), event(["other"])];

		expect(evaluateFormula(doc, runtime, trace)).toBe("violated");
		expect(
			buildCounterexampleReport(doc, runtime, trace)?.failurePath.map((snap) => snap.step),
		).toEqual([0, 1]);
	});

	it("keeps capture/when diagnostics non-empty on violated traces", () => {
		const doc = compile(
			always(
				implies(
					predicate(isRequest),
					capture(requestId, idSel, eventually(when(requestId, idSel, predicate(isResponse)))),
				),
			),
		);
		const trace = [event(["request"], 1), event(["response"], 2)];
		const report = buildCounterexampleReport(doc, runtime, trace);

		expect(evaluateFormula(doc, runtime, trace)).toBe("violated");
		expect(report).not.toBeNull();
		expect(report?.failurePath.length).toBeGreaterThan(0);
		expect(report?.summary).toContain("Formula violated:");
	});
});
