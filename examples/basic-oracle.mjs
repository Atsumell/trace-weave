import { always, eventually, implies, predicate } from "trace-weave/builder";
import { predicateId } from "trace-weave/core";
import { runOracle } from "trace-weave/monitor";

const isRequest = predicateId("isRequest");
const isResponse = predicateId("isResponse");

const runtime = {
	predicates: {
		[isRequest]: (event) => event.type === "request",
		[isResponse]: (event) => event.type === "response",
	},
	selectors: {},
};

const formula = always(implies(predicate(isRequest), eventually(predicate(isResponse))));

const trace = [{ type: "request" }, { type: "processing" }, { type: "response" }];

const result = runOracle(formula, runtime, trace);

if (result.verdict !== "satisfied") {
	throw new Error(`expected satisfied verdict, got ${result.verdict}`);
}

console.log("verdict:", result.verdict);
console.log("steps:", result.steps);
