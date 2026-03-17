import type { FormulaDocument } from "../core/formula-document.js";
import type { CounterexampleReport } from "../monitor/types.js";
import { getNodeLabel } from "./metadata.js";

export interface FormattedReport {
	readonly structured: {
		readonly verdict: string;
		readonly steps: readonly {
			readonly nodeId: string;
			readonly label: string;
			readonly verdict: string;
			readonly step: number;
		}[];
		readonly traceSlice: readonly { step: number; event: unknown }[];
	};
	readonly text: string;
}

export function formatReport(report: CounterexampleReport, doc: FormulaDocument): FormattedReport {
	const steps = report.failurePath.map((snap) => ({
		nodeId: snap.nodeId as string,
		label: getNodeLabel(doc, snap.nodeId),
		verdict: snap.verdict,
		step: snap.step,
	}));

	const structured = {
		verdict: report.verdict,
		steps,
		traceSlice: report.traceSlice,
	};

	const textParts: string[] = [
		`Verdict: ${report.verdict}`,
		"",
		"Failure Path:",
		...steps.map((s) => `  [step ${s.step}] ${s.label} (${s.nodeId}): ${s.verdict}`),
		"",
		"Trace:",
		...report.traceSlice.map((t) => `  step ${t.step}: ${JSON.stringify(t.event)}`),
		"",
		report.summary,
	];

	return {
		structured,
		text: textParts.join("\n"),
	};
}
