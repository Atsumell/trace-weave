import { describe, expect, it } from "vitest";
import {
	always,
	and,
	annotate,
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
	toExpr,
	until,
	weakNext,
	withinMs,
	withinSteps,
} from "../../src/builder/factory.js";
import { predicateId } from "../../src/core/ids.js";

describe("builder factory", () => {
	it("toExpr converts boolean to literal", () => {
		expect(toExpr(true)).toEqual({ kind: "literal", value: true });
		expect(toExpr(false)).toEqual({ kind: "literal", value: false });
	});

	it("toExpr passes through FormulaExpr", () => {
		const expr = literal(true);
		expect(toExpr(expr)).toBe(expr);
	});

	it("literal creates LiteralExpr", () => {
		expect(literal(true)).toEqual({ kind: "literal", value: true });
	});

	it("predicate creates PredicateExpr", () => {
		const pid = predicateId("isError");
		expect(predicate(pid)).toEqual({ kind: "predicate", predicateId: pid });
	});

	it("not wraps child", () => {
		const expr = not(literal(true));
		expect(expr.kind).toBe("not");
		expect(expr.child).toEqual(literal(true));
	});

	it("and creates variadic children", () => {
		const expr = and(true, false, literal(true));
		expect(expr.kind).toBe("and");
		expect(expr.children).toHaveLength(3);
	});

	it("or creates variadic children", () => {
		const expr = or(true, false);
		expect(expr.kind).toBe("or");
		expect(expr.children).toHaveLength(2);
	});

	it("implies creates binary expr", () => {
		const expr = implies(true, false);
		expect(expr.kind).toBe("implies");
	});

	it("always wraps child", () => {
		const expr = always(literal(true));
		expect(expr.kind).toBe("always");
	});

	it("eventually wraps child", () => {
		const expr = eventually(literal(true));
		expect(expr.kind).toBe("eventually");
	});

	it("next wraps child", () => {
		const expr = next(literal(true));
		expect(expr.kind).toBe("next");
	});

	it("weakNext wraps child", () => {
		const expr = weakNext(literal(true));
		expect(expr.kind).toBe("weakNext");
	});

	it("until creates binary expr", () => {
		const expr = until(literal(true), literal(false));
		expect(expr.kind).toBe("until");
	});

	it("release creates binary expr", () => {
		const expr = release(literal(true), literal(false));
		expect(expr.kind).toBe("release");
	});

	it("once wraps child", () => {
		const expr = once(literal(true));
		expect(expr.kind).toBe("once");
	});

	it("historically wraps child", () => {
		const expr = historically(literal(true));
		expect(expr.kind).toBe("historically");
	});

	it("since creates binary expr", () => {
		const expr = since(literal(true), literal(false));
		expect(expr.kind).toBe("since");
	});

	it("withinSteps with positive integer", () => {
		const expr = withinSteps(3, literal(true));
		expect(expr.kind).toBe("withinSteps");
		expect(expr.steps).toBe(3);
	});

	it("withinMs with positive number", () => {
		const expr = withinMs(1000, literal(true));
		expect(expr.kind).toBe("withinMs");
		expect(expr.ms).toBe(1000);
	});

	it("annotate adds metadata", () => {
		const expr = annotate(literal(true), { humanLabel: "test" });
		expect(expr.meta).toEqual({ humanLabel: "test" });
	});
});
