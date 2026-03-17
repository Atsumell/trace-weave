import { formatReport } from "trace-weave/ai";
import { always, annotate, predicate } from "trace-weave/builder";
import { compile } from "trace-weave/compiler";
import { predicateId } from "trace-weave/core";
import { runOracle } from "trace-weave/monitor";

const isOk = predicateId("isOk");

const runtime = {
	predicates: {
		[isOk]: (event) => event.type === "ok",
	},
	selectors: {},
};

const formula = annotate(always(predicate(isOk)), {
	humanLabel: "All events stay ok",
});
const trace = [{ type: "ok" }, { type: "error" }];
const result = runOracle(formula, runtime, trace);

if (!result.report) {
	throw new Error("expected a violation report");
}

const formatted = formatReport(result.report, compile(formula));

console.log(JSON.stringify(formatted.structured, null, 2));
console.log(formatted.text);
