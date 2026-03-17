import { describe, expect, it } from "vitest";
import {
	always,
	capture,
	eventually,
	historically,
	implies,
	literal,
	next,
	not,
	once,
	predicate,
	release,
	since,
	until,
	weakNext,
	when,
	withinMs,
	withinSteps,
} from "../../src/builder/factory.js";
import { compile, prepare } from "../../src/compiler/index.js";
import { captureName, predicateId, selectorId } from "../../src/core/ids.js";
import type { PredicateId, SelectorId } from "../../src/core/ids.js";
import type { FormulaExpr } from "../../src/core/index.js";
import type { JsonValue, Verdict } from "../../src/core/index.js";
import type { MonitorRuntime } from "../../src/core/runtime.js";
import {
	buildReport,
	createMonitor,
	evaluateStep,
	finalize,
	finalizeEmpty,
	runOracle,
} from "../../src/monitor/index.js";

interface TestEvent {
	readonly tags: readonly string[];
	readonly id?: number;
	readonly at?: number;
}

const isA = predicateId("isA");
const isB = predicateId("isB");
const isC = predicateId("isC");
const isRequest = predicateId("isRequest");
const isResponse = predicateId("isResponse");
const idSel = selectorId("id");
const requestId = captureName("requestId");

const runtime: MonitorRuntime<TestEvent> = {
	predicates: {
		[isA]: (event) => event.tags.includes("a"),
		[isB]: (event) => event.tags.includes("b"),
		[isC]: (event) => event.tags.includes("c"),
		[isRequest]: (event) => event.tags.includes("request"),
		[isResponse]: (event) => event.tags.includes("response"),
	} as Record<PredicateId, (event: TestEvent, args: readonly JsonValue[]) => boolean>,
	selectors: {
		[idSel]: (event) => event.id ?? null,
	} as Record<SelectorId, (event: TestEvent) => JsonValue>,
	timestamp: (event) => event.at ?? 0,
};

function event(tags: readonly string[], id?: number, at?: number): TestEvent {
	if (id === undefined && at === undefined) return { tags };
	return {
		tags,
		...(id === undefined ? {} : { id }),
		...(at === undefined ? {} : { at }),
	};
}

function runOnline(
	formula: FormulaExpr,
	trace: readonly TestEvent[],
): { readonly verdict: Verdict; readonly report: ReturnType<typeof buildReport<TestEvent>> } {
	const compiled = prepare(compile(formula));
	const monitor = createMonitor(compiled, runtime);

	for (const step of trace) {
		evaluateStep(monitor, step);
	}

	const verdict =
		trace.length === 0 ? finalizeEmpty(monitor) : finalize(monitor, trace[trace.length - 1]!);
	return {
		verdict,
		report: buildReport(monitor, trace),
	};
}

function stepVerdicts(formula: FormulaExpr, trace: readonly TestEvent[]): readonly Verdict[] {
	const compiled = prepare(compile(formula));
	const monitor = createMonitor(compiled, runtime);
	return trace.map((step) => evaluateStep(monitor, step));
}

describe("online monitor parity", () => {
	it.each([
		{
			name: "always on empty trace",
			formula: always(predicate(isA)),
			trace: [],
			expected: "satisfied",
		},
		{
			name: "always satisfied",
			formula: always(predicate(isA)),
			trace: [event(["a"]), event(["a"])],
			expected: "satisfied",
		},
		{
			name: "always violated",
			formula: always(predicate(isA)),
			trace: [event(["a"]), event(["c"])],
			expected: "violated",
		},
		{
			name: "eventually on empty trace",
			formula: eventually(predicate(isB)),
			trace: [],
			expected: "violated",
		},
		{
			name: "eventually satisfied",
			formula: eventually(predicate(isB)),
			trace: [event(["a"]), event(["b"])],
			expected: "satisfied",
		},
		{
			name: "next on empty trace",
			formula: next(predicate(isB)),
			trace: [],
			expected: "violated",
		},
		{
			name: "next on successor",
			formula: next(predicate(isB)),
			trace: [event(["a"]), event(["b"])],
			expected: "satisfied",
		},
		{
			name: "weakNext on empty trace",
			formula: weakNext(predicate(isB)),
			trace: [],
			expected: "satisfied",
		},
		{
			name: "weakNext at trace end",
			formula: weakNext(predicate(isB)),
			trace: [event(["a"])],
			expected: "satisfied",
		},
		{
			name: "until",
			formula: until(predicate(isA), predicate(isB)),
			trace: [event(["a"]), event(["a"]), event(["b"])],
			expected: "satisfied",
		},
		{
			name: "release",
			formula: release(predicate(isA), predicate(isB)),
			trace: [event(["b"]), event(["b"])],
			expected: "satisfied",
		},
		{
			name: "release violated when right fails before left can discharge it",
			formula: release(predicate(isA), predicate(isB)),
			trace: [event(["c"])],
			expected: "violated",
		},
		{
			name: "once via implication",
			formula: always(implies(predicate(isB), once(predicate(isA)))),
			trace: [event(["a"]), event(["b"])],
			expected: "satisfied",
		},
		{
			name: "historically via implication",
			formula: always(implies(predicate(isB), historically(not(predicate(isC))))),
			trace: [event(["a"]), event(["b"])],
			expected: "satisfied",
		},
		{
			name: "since via implication",
			formula: always(implies(predicate(isB), since(literal(true), predicate(isA)))),
			trace: [event(["a"]), event(["b"])],
			expected: "satisfied",
		},
		{
			name: "since via implication violated when the witness never appears",
			formula: always(implies(predicate(isB), since(literal(true), predicate(isA)))),
			trace: [event(["c"]), event(["b"])],
			expected: "violated",
		},
		{
			name: "withinSteps",
			formula: withinSteps(2, predicate(isB)),
			trace: [event(["a"]), event(["b"])],
			expected: "satisfied",
		},
	] satisfies readonly {
		readonly name: string;
		readonly formula: FormulaExpr;
		readonly trace: readonly TestEvent[];
		readonly expected: Verdict;
	}[])("$name matches batch evaluation", ({ formula, trace, expected }) => {
		const batch = runOracle(formula, runtime, trace);
		const online = runOnline(formula, trace);

		expect(batch.verdict).toBe(expected);
		expect(online.verdict).toBe(expected);
	});

	it("preserves legacy finalize(emptyMonitor, lastEvent) behavior for backward compatibility", () => {
		const formula = always(predicate(isA));
		const satisfiedMonitor = createMonitor(prepare(compile(formula)), runtime);
		const violatedMonitor = createMonitor(prepare(compile(formula)), runtime);

		expect(finalize(satisfiedMonitor, event(["a"]))).toBe("satisfied");
		expect(finalize(violatedMonitor, event(["c"]))).toBe("violated");
		expect(buildReport(violatedMonitor, [])?.traceSlice).toEqual([
			{ step: 1, event: event(["c"]) },
		]);
	});

	it("keeps capture/when verdicts aligned across satisfied and violated traces", () => {
		const formula = always(
			implies(
				predicate(isRequest),
				capture(requestId, idSel, eventually(when(requestId, idSel, predicate(isResponse)))),
			),
		);

		const satisfiedTrace = [event(["request"], 1), event(["other"], 9), event(["response"], 1)];
		const violatedTrace = [event(["request"], 1), event(["response"], 2)];

		const batchSatisfied = runOracle(formula, runtime, satisfiedTrace);
		const onlineSatisfied = runOnline(formula, satisfiedTrace);
		expect(batchSatisfied.verdict).toBe("satisfied");
		expect(onlineSatisfied.verdict).toBe("satisfied");

		const batchViolated = runOracle(formula, runtime, violatedTrace);
		const onlineViolated = runOnline(formula, violatedTrace);
		expect(batchViolated.verdict).toBe("violated");
		expect(onlineViolated.verdict).toBe("violated");
		expect(batchViolated.report).not.toBeNull();
		expect(onlineViolated.report).not.toBeNull();
		expect(onlineViolated.report?.summary).toBe(batchViolated.report?.summary);
	});

	it("supports withinMs in both batch and online monitoring", () => {
		const formula = withinMs(1000, predicate(isB));
		const trace = [event(["a"], undefined, 0), event(["b"], undefined, 900)];

		const batch = runOracle(formula, runtime, trace);
		const online = runOnline(formula, trace);

		expect(batch.verdict).toBe("satisfied");
		expect(online.verdict).toBe("satisfied");
	});

	it("requires timestamp support when using withinMs", () => {
		const formula = withinMs(1000, predicate(isB));
		const runtimeWithoutTimestamp: MonitorRuntime<TestEvent> = {
			predicates: runtime.predicates,
			selectors: runtime.selectors,
		};

		expect(() =>
			runOracle(formula, runtimeWithoutTimestamp, [event(["b"], undefined, 0)]),
		).toThrowError(/MonitorRuntime.timestamp/);
		expect(() => createMonitor(prepare(compile(formula)), runtimeWithoutTimestamp)).toThrowError(
			/MonitorRuntime.timestamp/,
		);
	});

	it.each([
		{
			name: "always stays pending while no violation is observed",
			formula: always(predicate(isA)),
			trace: [event(["a"]), event(["a"])],
			expected: ["pending", "pending"],
		},
		{
			name: "always becomes violated on the first counterexample",
			formula: always(predicate(isA)),
			trace: [event(["a"]), event(["c"])],
			expected: ["pending", "violated"],
		},
		{
			name: "eventually stays pending until a witness appears",
			formula: eventually(predicate(isB)),
			trace: [event(["a"]), event(["b"])],
			expected: ["pending", "satisfied"],
		},
		{
			name: "next resolves when the successor arrives",
			formula: next(predicate(isB)),
			trace: [event(["a"]), event(["b"])],
			expected: ["pending", "satisfied"],
		},
		{
			name: "weakNext remains pending until the trace is finalized",
			formula: weakNext(predicate(isB)),
			trace: [event(["a"])],
			expected: ["pending"],
		},
		{
			name: "until stays pending while the obligation is still open",
			formula: until(predicate(isA), predicate(isB)),
			trace: [event(["a"]), event(["b"])],
			expected: ["pending", "satisfied"],
		},
		{
			name: "release can satisfy immediately when both sides hold",
			formula: release(predicate(isA), predicate(isB)),
			trace: [event(["a", "b"])],
			expected: ["satisfied"],
		},
		{
			name: "release becomes violated as soon as right fails",
			formula: release(predicate(isA), predicate(isB)),
			trace: [event(["c"])],
			expected: ["violated"],
		},
		{
			name: "since via implication becomes violated when the witness never appears",
			formula: always(implies(predicate(isB), since(literal(true), predicate(isA)))),
			trace: [event(["c"]), event(["b"])],
			expected: ["pending", "violated"],
		},
		{
			name: "withinSteps becomes violated once the observed budget expires",
			formula: withinSteps(2, predicate(isB)),
			trace: [event(["a"]), event(["a"])],
			expected: ["pending", "violated"],
		},
		{
			name: "withinMs stays pending while the deadline has not yet passed",
			formula: withinMs(1000, predicate(isB)),
			trace: [event(["a"], undefined, 0), event(["a"], undefined, 500)],
			expected: ["pending", "pending"],
		},
		{
			name: "withinMs becomes violated after the deadline passes without a witness",
			formula: withinMs(1000, predicate(isB)),
			trace: [event(["a"], undefined, 0), event(["a"], undefined, 1500)],
			expected: ["pending", "violated"],
		},
		{
			name: "withinMs becomes satisfied when a witness arrives in time",
			formula: withinMs(1000, predicate(isB)),
			trace: [event(["a"], undefined, 0), event(["b"], undefined, 900)],
			expected: ["pending", "satisfied"],
		},
		{
			name: "capture/when stays pending until the matching event is observed",
			formula: capture(requestId, idSel, eventually(when(requestId, idSel, predicate(isResponse)))),
			trace: [event(["request"], 1), event(["response"], 1)],
			expected: ["pending", "satisfied"],
		},
	] satisfies readonly {
		readonly name: string;
		readonly formula: FormulaExpr;
		readonly trace: readonly TestEvent[];
		readonly expected: readonly Verdict[];
	}[])("$name", ({ formula, trace, expected }) => {
		expect(stepVerdicts(formula, trace)).toEqual(expected);
	});
});
