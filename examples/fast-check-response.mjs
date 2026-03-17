import * as fc from "fast-check";
import { always, predicate } from "trace-weave/builder";
import { predicateId } from "trace-weave/core";
import { traceArbitrary, traceProperty } from "trace-weave/fast-check";

const isOk = predicateId("isOk");

const runtime = {
	predicates: {
		[isOk]: (event) => event.tags.includes("ok"),
	},
	selectors: {},
};

const formula = always(predicate(isOk));

fc.assert(
	traceProperty({
		formula,
		runtime,
		traceArbitrary: traceArbitrary({
			eventArbitrary: fc.record({
				tags: fc.constant(["ok"]),
			}),
			minLength: 1,
			maxLength: 5,
		}),
	}),
	{ numRuns: 10 },
);

let failureMessage = "";

try {
	fc.assert(
		traceProperty({
			formula,
			runtime,
			traceArbitrary: fc.constant([{ tags: ["ok"] }, { tags: ["bad"] }]),
		}),
		{ numRuns: 1 },
	);
} catch (error) {
	failureMessage = error instanceof Error ? error.message : String(error);
}

if (!failureMessage.includes("Formula violated")) {
	throw new Error("expected a violation message from the failing sample");
}

console.log("passing property: ok");
console.log("failing sample:", failureMessage.split("\n")[0]);
