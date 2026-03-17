import { predicate } from "trace-weave/builder";
import { predicateId } from "trace-weave/core";
import { response } from "trace-weave/patterns";
import { installMatchers } from "trace-weave/vitest";
import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
	installMatchers();
});

const isRequest = predicateId("isRequest");
const isResponse = predicateId("isResponse");

const runtime = {
	predicates: {
		[isRequest]: (event) => event.type === "request",
		[isResponse]: (event) => event.type === "response",
	},
	selectors: {},
};

describe("response pattern", () => {
	const formula = response(predicate(isRequest), predicate(isResponse));

	it("accepts a satisfied trace", () => {
		expect([{ type: "request" }, { type: "response" }]).toSatisfy(formula, runtime);
	});

	it("accepts an expected violation", () => {
		expect([{ type: "request" }, { type: "request" }]).toViolate(formula, runtime);
	});
});
