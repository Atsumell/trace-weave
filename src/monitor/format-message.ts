import { printNodeAt } from "../compiler/printer.js";
import type { FormulaDocument } from "../core/formula-document.js";
import type { CounterexampleReport } from "./types.js";

function stringifyEvent(value: unknown): string {
	const json = JSON.stringify(value);
	return json ?? String(value);
}

export function formatCounterexampleMessage(
	report: CounterexampleReport,
	doc?: FormulaDocument,
): string {
	const lines = [report.summary];
	const terminal = report.failurePath.at(-1);

	if (terminal) {
		if (doc) {
			lines.push(`Focused obligation: ${printNodeAt(terminal.nodeId, doc)}`);
		} else {
			lines.push(`Focused obligation node: ${terminal.nodeId}`);
		}

		const traceEntry = report.traceSlice[terminal.step];
		if (traceEntry) {
			lines.push(`Observed event at step ${traceEntry.step}: ${stringifyEvent(traceEntry.event)}`);
		} else {
			lines.push("Failure point is at trace end; no event exists at that position.");
		}

		lines.push("");
		lines.push("Failure path:");
		for (const snapshot of report.failurePath) {
			const label = doc ? printNodeAt(snapshot.nodeId, doc) : snapshot.nodeId;
			lines.push(`- position ${snapshot.step}: ${label} => ${snapshot.verdict}`);
		}
	}

	if (report.traceSlice.length > 0) {
		lines.push("");
		lines.push("Trace:");
		for (const entry of report.traceSlice) {
			lines.push(`- step ${entry.step}: ${stringifyEvent(entry.event)}`);
		}
	}

	return lines.join("\n");
}
