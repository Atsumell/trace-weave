import { not, predicate } from "trace-weave/builder";
import { predicateId } from "trace-weave/core";
import { runOracle } from "trace-weave/monitor";
import { between, boundedResponse, response } from "trace-weave/patterns";

const isA = predicateId("isA");
const isB = predicateId("isB");
const isC = predicateId("isC");

const runtime = {
	predicates: {
		[isA]: (event) => event.type === "A",
		[isB]: (event) => event.type === "B",
		[isC]: (event) => event.type === "C",
	},
	selectors: {},
};

const verdicts = {
	response: runOracle(response(predicate(isA), predicate(isB)), runtime, [
		{ type: "A" },
		{ type: "B" },
	]).verdict,
	boundedResponse: runOracle(boundedResponse(predicate(isA), predicate(isB), 2), runtime, [
		{ type: "A" },
		{ type: "C" },
		{ type: "B" },
	]).verdict,
	between: runOracle(between(predicate(isA), predicate(isC), not(predicate(isB))), runtime, [
		{ type: "A" },
		{ type: "A" },
		{ type: "C" },
		{ type: "B" },
	]).verdict,
};

if (verdicts.response !== "satisfied") {
	throw new Error(`expected response to be satisfied, got ${verdicts.response}`);
}

if (verdicts.boundedResponse !== "violated") {
	throw new Error(`expected boundedResponse to be violated, got ${verdicts.boundedResponse}`);
}

if (verdicts.between !== "satisfied") {
	throw new Error(`expected between to be satisfied, got ${verdicts.between}`);
}

console.log(verdicts);
