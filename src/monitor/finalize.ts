import { print } from "../compiler/printer.js";
import type { Verdict } from "../core/verdict.js";
import { evaluateFormula } from "./evaluate.js";
import type { MonitorState } from "./types.js";

export function finalize<TEvent>(state: MonitorState<TEvent>, lastEvent: TEvent): Verdict {
	void lastEvent;

	if (state.finalized) {
		return getFinalizedVerdict(state);
	}

	if (state.trace.length === 0) {
		throw new Error(
			"Cannot finalize an empty monitor with finalize(); use finalizeEmpty() instead",
		);
	}

	return finalizeObservedTrace(state);
}

export function finalizeEmpty<TEvent>(state: MonitorState<TEvent>): Verdict {
	if (state.finalized) {
		return getFinalizedVerdict(state);
	}

	if (state.trace.length > 0) {
		throw new Error("Cannot finalize a non-empty monitor with finalizeEmpty(); use finalize()");
	}

	return finalizeObservedTrace(state);
}

function getFinalizedVerdict<TEvent>(state: MonitorState<TEvent>): Verdict {
	return state.finalVerdict ?? state.activations.get(state.rootActivationId)?.verdict ?? "pending";
}

function finalizeObservedTrace<TEvent>(state: MonitorState<TEvent>): Verdict {
	state.finalized = true;

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
