import { predicate } from "@atsumell/trace-weave/builder";
import { compile, prepare } from "@atsumell/trace-weave/compiler";
import { predicateId } from "@atsumell/trace-weave/core";
import {
	buildReport,
	createMonitor,
	evaluateStep,
	finalize,
	finalizeEmpty,
} from "@atsumell/trace-weave/monitor";
import { response } from "@atsumell/trace-weave/patterns";

const isRequest = predicateId("isRequest");
const isResponse = predicateId("isResponse");

const runtime = {
	predicates: {
		[isRequest]: (event) => event.type === "request",
		[isResponse]: (event) => event.type === "response",
	},
	selectors: {},
};

const formula = response(predicate(isRequest), predicate(isResponse));
const compiled = prepare(compile(formula));
const trace = [{ type: "request" }, { type: "processing" }, { type: "response" }];

const monitor = createMonitor(compiled, runtime);
const stepVerdicts = trace.map((event) => evaluateStep(monitor, event));
const finalVerdict = finalize(monitor, trace.at(-1));

if (finalVerdict !== "satisfied") {
	throw new Error(`expected satisfied verdict, got ${finalVerdict}`);
}

const emptyMonitor = createMonitor(compiled, runtime);
const emptyVerdict = finalizeEmpty(emptyMonitor);

if (emptyVerdict !== "satisfied") {
	throw new Error(`expected empty-trace verdict to be satisfied, got ${emptyVerdict}`);
}

console.log("step verdicts:", stepVerdicts.join(" -> "));
console.log("final verdict:", finalVerdict);
console.log("report:", buildReport(monitor, trace));
console.log("empty trace verdict:", emptyVerdict);
