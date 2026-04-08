import {
	always,
	capture,
	eventually,
	implies,
	predicate,
	when,
} from "@atsumell/trace-weave/builder";
import { captureName, predicateId, selectorId } from "@atsumell/trace-weave/core";
import { runOracle } from "@atsumell/trace-weave/monitor";

const isRequest = predicateId("isRequest");
const isResponse = predicateId("isResponse");
const idSel = selectorId("id");
const requestId = captureName("requestId");

const runtime = {
	predicates: {
		[isRequest]: (event) => event.type === "request",
		[isResponse]: (event) => event.type === "response",
	},
	selectors: {
		[idSel]: (event) => event.id,
	},
};

const formula = always(
	implies(
		predicate(isRequest),
		capture(requestId, idSel, eventually(when(requestId, idSel, predicate(isResponse)))),
	),
);

const trace = [
	{ type: "request", id: 1 },
	{ type: "request", id: 2 },
	{ type: "response", id: 1 },
	{ type: "response", id: 2 },
];

const result = runOracle(formula, runtime, trace);

if (result.verdict !== "satisfied") {
	throw new Error(`expected satisfied verdict, got ${result.verdict}`);
}

console.log("verdict:", result.verdict);
console.log("report:", result.report);
