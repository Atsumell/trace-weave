import { formatReport } from "@atsumell/trace-weave/ai";
import { always, annotate, predicate } from "@atsumell/trace-weave/builder";
import { compile } from "@atsumell/trace-weave/compiler";
import { predicateId } from "@atsumell/trace-weave/core";
import { runOracle } from "@atsumell/trace-weave/monitor";

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
