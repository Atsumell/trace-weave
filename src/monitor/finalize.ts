import { print } from "../compiler/printer.js";
import type { Verdict } from "../core/verdict.js";
import { evaluateFormula } from "./evaluate.js";
import type { MonitorState } from "./types.js";

export function finalize<TEvent>(state: MonitorState<TEvent>, lastEvent: TEvent): Verdict {
	if (state.finalized) {
		return (
			state.finalVerdict ?? state.activations.get(state.rootActivationId)?.verdict ?? "pending"
		);
	}

	state.finalized = true;

	if (state.trace.length === 0) {
		state.trace.push(lastEvent);
	}

	const verdict = evaluateFormula(state.compiled.document, state.runtime, state.trace);
	state.finalVerdict = verdict;

	const rootAct = state.activations.get(state.rootActivationId);
	if (rootAct) {
		rootAct.verdict = verdict;
	}

	state.finalReport =
		verdict === "violated"
			? {
					verdict: "violated",
					failurePath: [],
					traceSlice: state.trace.map((event, i) => ({ step: i + 1, event })),
					summary: `Formula violated: ${print(state.compiled.document)}`,
				}
			: null;

	return rootAct?.verdict ?? verdict;
}
