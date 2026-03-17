import type { NodeId } from "./ids.js";

export interface SourceSpan {
	readonly file?: string;
	readonly line?: number;
	readonly column?: number;
}

export interface FormulaMeta {
	readonly humanLabel?: string;
	readonly sourceSpan?: SourceSpan;
	readonly confidence?: number;
}

export interface NodeProvenance {
	readonly nodeId: NodeId;
	readonly origin: "user" | "compiler" | "pattern";
	readonly sourceExprKind?: string;
	readonly meta?: FormulaMeta;
}
