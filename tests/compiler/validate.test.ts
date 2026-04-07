import { describe, expect, it } from "vitest";
import {
	always,
	capture,
	predicate,
	when,
	withinMs,
	withinSteps,
} from "../../src/builder/factory.js";
import { compile } from "../../src/compiler/compile.js";
import { validate } from "../../src/compiler/validate.js";
import { captureName, predicateId, selectorId } from "../../src/core/ids.js";

describe("validate", () => {
	it("passes for valid formula", () => {
		const doc = compile(always(predicate(predicateId("p"))));
		expect(validate(doc)).toEqual([]);
	});

	it("detects when referencing out-of-scope capture", () => {
		const cn = captureName("x");
		const sid = selectorId("val");
		const expr = when(cn, sid, predicate(predicateId("p")));
		const doc = compile(expr);
		const errors = validate(doc);
		expect(errors.length).toBeGreaterThan(0);
		expect(errors[0]?.message).toContain("not in scope");
	});

	it("passes for when inside capture", () => {
		const cn = captureName("x");
		const sid = selectorId("val");
		const expr = capture(cn, sid, when(cn, sid, predicate(predicateId("p"))));
		const doc = compile(expr);
		expect(validate(doc)).toEqual([]);
	});

	it("detects invalid withinSteps bounds", () => {
		const doc = compile(withinSteps(0, predicate(predicateId("p"))));
		const errors = validate(doc);
		expect(errors.length).toBeGreaterThan(0);
		expect(errors[0]?.message).toContain("positive integer");
	});

	it("detects invalid withinMs bounds", () => {
		for (const ms of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1]) {
			const doc = compile(withinMs(ms, predicate(predicateId("p"))));
			const errors = validate(doc);
			expect(errors.length).toBeGreaterThan(0);
			expect(errors[0]?.message).toContain("positive number");
		}
	});
});
