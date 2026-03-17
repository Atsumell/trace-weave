import { describe, expect, it } from "vitest";
import { andV, impliesV, notV, orV } from "../../src/core/verdict.js";

describe("verdict combinators", () => {
	describe("notV", () => {
		it("negates satisfied to violated", () => {
			expect(notV("satisfied")).toBe("violated");
		});
		it("negates violated to satisfied", () => {
			expect(notV("violated")).toBe("satisfied");
		});
		it("leaves pending as pending", () => {
			expect(notV("pending")).toBe("pending");
		});
	});

	describe("andV truth table", () => {
		const cases: [string, string, string][] = [
			["satisfied", "satisfied", "satisfied"],
			["satisfied", "violated", "violated"],
			["satisfied", "pending", "pending"],
			["violated", "satisfied", "violated"],
			["violated", "violated", "violated"],
			["violated", "pending", "violated"],
			["pending", "satisfied", "pending"],
			["pending", "violated", "violated"],
			["pending", "pending", "pending"],
		];

		for (const [a, b, expected] of cases) {
			it(`andV(${a}, ${b}) = ${expected}`, () => {
				expect(andV(a as any, b as any)).toBe(expected);
			});
		}
	});

	describe("orV truth table", () => {
		const cases: [string, string, string][] = [
			["satisfied", "satisfied", "satisfied"],
			["satisfied", "violated", "satisfied"],
			["satisfied", "pending", "satisfied"],
			["violated", "satisfied", "satisfied"],
			["violated", "violated", "violated"],
			["violated", "pending", "pending"],
			["pending", "satisfied", "satisfied"],
			["pending", "violated", "pending"],
			["pending", "pending", "pending"],
		];

		for (const [a, b, expected] of cases) {
			it(`orV(${a}, ${b}) = ${expected}`, () => {
				expect(orV(a as any, b as any)).toBe(expected);
			});
		}
	});

	describe("impliesV", () => {
		it("satisfied -> satisfied = satisfied", () => {
			expect(impliesV("satisfied", "satisfied")).toBe("satisfied");
		});
		it("satisfied -> violated = violated", () => {
			expect(impliesV("satisfied", "violated")).toBe("violated");
		});
		it("violated -> anything = satisfied", () => {
			expect(impliesV("violated", "violated")).toBe("satisfied");
			expect(impliesV("violated", "satisfied")).toBe("satisfied");
		});
	});
});
