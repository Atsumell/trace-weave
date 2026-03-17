import type { CompiledFormula } from "../compiler/prepare.js";
import type { ActivationId, EnvId, NodeId } from "../core/ids.js";
import type { MonitorRuntime } from "../core/runtime.js";
import type { JsonValue } from "../core/values.js";
import type { Verdict } from "../core/verdict.js";

export interface EnvFrame {
	readonly id: EnvId;
	readonly parent: EnvId | null;
	readonly bindings: Readonly<Record<string, JsonValue>>;
}

export interface ActivationRecord {
	readonly id: ActivationId;
	readonly nodeId: NodeId;
	readonly envId: EnvId;
	readonly startStep: number;
	verdict: Verdict;
	prevVerdict: Verdict;
}

export interface DirtyEntry {
	readonly nodeId: NodeId;
	readonly activationId: ActivationId;
}

export interface ScheduledObligation {
	readonly step: number;
	readonly nodeId: NodeId;
	readonly activationId: ActivationId;
}

export interface MonitorState<TEvent> {
	readonly compiled: CompiledFormula;
	readonly runtime: MonitorRuntime<TEvent>;
	step: number;
	readonly trace: TEvent[];
	readonly envs: Map<EnvId, EnvFrame>;
	readonly activations: Map<ActivationId, ActivationRecord>;
	readonly nodeActivations: Map<NodeId, Set<ActivationId>>;
	readonly scheduled: ScheduledObligation[];
	readonly dirtyQueue: DirtyEntry[];
	rootActivationId: ActivationId;
	finalized: boolean;
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
