import { describe, expect, it } from "vitest";
import {
	formatReport,
	formulaDocumentSchema,
	getAllLabels,
	getNodeLabel,
	getNodeProvenance,
} from "../../src/ai/index.js";
import { always, annotate, predicate } from "../../src/builder/factory.js";
import { compile } from "../../src/compiler/index.js";
import { predicateId } from "../../src/core/ids.js";
import type { PredicateId, SelectorId } from "../../src/core/ids.js";
import type { MonitorRuntime } from "../../src/core/runtime.js";
import type { JsonValue } from "../../src/core/values.js";
import { runOracle } from "../../src/monitor/index.js";

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

describe("ai integration", () => {
	it("preserves schema and provenance metadata helpers", () => {
		const formula = annotate(always(predicate(isOk)), {
			humanLabel: "All events stay ok",
			confidence: 0.9,
		});
		const doc = compile(formula);

		expect((formulaDocumentSchema as { readonly title?: string }).title).toBe("FormulaDocument");
		expect(getNodeLabel(doc, doc.root)).toBe("All events stay ok");
		expect(getNodeProvenance(doc, doc.root)?.origin).toBe("user");
		expect(getAllLabels(doc)[doc.root]).toBe("All events stay ok");
	});

	it("formats violation reports into structured and text output", () => {
		const formula = annotate(always(predicate(isOk)), {
			humanLabel: "All events stay ok",
		});
		const trace = [{ tags: ["ok"] }, { tags: ["bad"] }];
		const result = runOracle(formula, runtime, trace);
		const doc = compile(formula);

		expect(result.report).not.toBeNull();

		const formatted = formatReport(result.report!, doc);
		expect(formatted.structured.verdict).toBe("violated");
		expect(formatted.structured.steps).toEqual([]);
		expect(formatted.structured.traceSlice).toEqual([
			{ step: 1, event: { tags: ["ok"] } },
			{ step: 2, event: { tags: ["bad"] } },
		]);
		expect(formatted.text).toContain("Verdict: violated");
		expect(formatted.text).toContain("Failure Path:");
		expect(formatted.text).toContain("Trace:");
	});
});
