import { describe, expect, it } from "vitest";
import { always, predicate } from "../../src/builder/factory.js";
import { predicateId } from "../../src/core/ids.js";
import type { PredicateId, SelectorId } from "../../src/core/ids.js";
import type { MonitorRuntime } from "../../src/core/runtime.js";
import type { JsonValue } from "../../src/core/values.js";
import { installMatchers } from "../../src/vitest/index.js";

interface TestEvent {
	readonly tags: readonly string[];
}

const isOk = predicateId("isOk");

const runtime: MonitorRuntime<TestEvent> = {
	predicates: {
		[isOk]: (event) => event.tags.includes("ok"),
	} as Record<PredicateId, (event: TestEvent, args: readonly JsonValue[]) => boolean>,
	selectors: {} as Record<SelectorId, (event: TestEvent) => JsonValue>,
};

installMatchers();

describe("vitest matchers", () => {
	const formula = always(predicate(isOk));

	it("toSatisfy passes for satisfied traces", () => {
		expect([{ tags: ["ok"] }, { tags: ["ok"] }]).toSatisfy(formula, runtime);
	});

	it("toViolate passes for violated traces", () => {
		expect([{ tags: ["ok"] }, { tags: ["bad"] }]).toViolate(formula, runtime);
	});

	it("surfaces informative matcher messages on failure", () => {
		let satisfyMessage = "";
		try {
			expect([{ tags: ["bad"] }]).toSatisfy(formula, runtime);
		} catch (error) {
			satisfyMessage = error instanceof Error ? error.message : String(error);
		}

		expect(satisfyMessage).toContain("got verdict: violated");
		expect(satisfyMessage).toContain("position 0 (step 1)");
		expect(satisfyMessage).toContain('Observed event at step 1: {"tags":["bad"]}');
		expect(satisfyMessage).toContain("Failure path:");
		expect(satisfyMessage).toContain("Trace:");

		expect(() => expect([{ tags: ["ok"] }]).toViolate(formula, runtime)).toThrowError(
			/got verdict: satisfied/,
		);
	});

	it("keeps matcher failures readable for circular events", () => {
		const circular = { tags: ["bad"] } as TestEvent & { self?: unknown };
		circular.self = circular;

		expect(() => expect([circular]).toSatisfy(formula, runtime)).toThrowError(/\[Circular\]/);
	});
});
