import type { CompiledFormula } from "../compiler/prepare.js";
import type { ActivationId, NodeId } from "../core/ids.js";
import type { MonitorRuntime } from "../core/runtime.js";
import type { Verdict } from "../core/verdict.js";

export interface MonitorState<TEvent> {
	readonly compiled: CompiledFormula;
	readonly runtime: MonitorRuntime<TEvent>;
	step: number;
	readonly trace: TEvent[];
	currentVerdict: Verdict;
	finalized: boolean;
}

export interface InternalMonitorState<TEvent> extends MonitorState<TEvent> {
	finalVerdict: Verdict | null;
	finalReport: CounterexampleReport | null;
}

export interface OracleRunResult {
	readonly verdict: Verdict;
	readonly steps: number;
	readonly report: CounterexampleReport | null;
}

export interface ObligationSnapshot {
	readonly nodeId: NodeId;
	readonly activationId: ActivationId;
	readonly verdict: Verdict;
	readonly step: number;
}

export interface CounterexampleReport {
	readonly verdict: Verdict;
	readonly failurePath: readonly ObligationSnapshot[];
	readonly traceSlice: readonly { step: number; event: unknown }[];
	readonly summary: string;
}
