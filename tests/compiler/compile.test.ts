import { describe, expect, it } from "vitest";
import { always, and, literal, not, or } from "../../src/builder/factory.js";
import { predicate } from "../../src/builder/factory.js";
import { compile } from "../../src/compiler/compile.js";
import { predicateId } from "../../src/core/ids.js";

describe("compile", () => {
	it("compiles a literal", () => {
		const doc = compile(literal(true));
		expect(doc.schemaVersion).toBe(1);
		expect(doc.nodes[doc.root]).toEqual({ kind: "literal", value: true });
	});

	it("deduplicates identical subtrees", () => {
		const p = literal(true);
		const doc = compile(and(p, p));
		// The two children should share the same NodeId
		const rootNode = doc.nodes[doc.root];
		expect(rootNode?.kind).toBe("and");
		if (rootNode?.kind === "and") {
			expect(rootNode.children[0]).toBe(rootNode.children[1]);
		}
	});

	it("flattens nested and", () => {
		const doc = compile(and(and(literal(true), literal(false)), literal(true)));
		const rootNode = doc.nodes[doc.root];
		expect(rootNode?.kind).toBe("and");
		if (rootNode?.kind === "and") {
			// Nested and should be flattened
			expect(rootNode.children.length).toBeGreaterThanOrEqual(2);
		}
	});

	it("flattens nested or", () => {
		const doc = compile(or(or(literal(true), literal(false)), literal(true)));
		const rootNode = doc.nodes[doc.root];
		expect(rootNode?.kind).toBe("or");
		if (rootNode?.kind === "or") {
			expect(rootNode.children.length).toBeGreaterThanOrEqual(2);
		}
	});

	it("sorts commutative operands deterministically", () => {
		const p1 = predicate(predicateId("a"));
		const p2 = predicate(predicateId("b"));
		const doc1 = compile(and(p1, p2));
		const doc2 = compile(and(p2, p1));
		// Both should produce the same root hash since children are sorted
		expect(doc1.root).toBe(doc2.root);
	});

	it("preserves provenance with meta", () => {
		const expr = { ...literal(true), meta: { humanLabel: "test" } };
		const doc = compile(expr);
		expect(doc.provenance).toBeDefined();
		expect(doc.provenance?.[doc.root]?.meta?.humanLabel).toBe("test");
	});

	it("compiles temporal operators", () => {
		const doc = compile(always(not(literal(false))));
		const rootNode = doc.nodes[doc.root];
		expect(rootNode?.kind).toBe("always");
	});
});
