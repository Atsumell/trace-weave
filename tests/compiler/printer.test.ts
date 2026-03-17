import { describe, expect, it } from "vitest";
import { always, and, eventually, implies, literal, next, not } from "../../src/builder/factory.js";
import { predicate } from "../../src/builder/factory.js";
import { compile } from "../../src/compiler/compile.js";
import { print } from "../../src/compiler/printer.js";
import { predicateId } from "../../src/core/ids.js";

describe("printer", () => {
	it("prints literal", () => {
		expect(print(compile(literal(true)))).toBe("true");
		expect(print(compile(literal(false)))).toBe("false");
	});

	it("prints predicate", () => {
		expect(print(compile(predicate(predicateId("isError"))))).toBe("isError");
	});

	it("prints not", () => {
		expect(print(compile(not(literal(true))))).toBe("!true");
	});

	it("prints always", () => {
		const p = predicate(predicateId("p"));
		expect(print(compile(always(p)))).toBe("G p");
	});

	it("prints eventually", () => {
		const p = predicate(predicateId("p"));
		expect(print(compile(eventually(p)))).toBe("F p");
	});

	it("prints next", () => {
		const p = predicate(predicateId("p"));
		expect(print(compile(next(p)))).toBe("X p");
	});

	it("prints implies with parens", () => {
		const p = predicate(predicateId("p"));
		const q = predicate(predicateId("q"));
		expect(print(compile(always(implies(p, q))))).toBe("G (p -> q)");
	});
});
