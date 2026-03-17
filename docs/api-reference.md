# API Reference

Complete type reference for all trace-weave subpath exports.

---

## trace-weave/core

Core types, branded IDs, verdict algebra, and runtime interfaces.

### Types

```typescript
// Verdict
type Verdict = "satisfied" | "violated" | "pending";

// Branded IDs
type NodeId = string & { readonly [__brand]: "NodeId" };
type PredicateId = string & { readonly [__brand]: "PredicateId" };
type SelectorId = string & { readonly [__brand]: "SelectorId" };
type CaptureName = string & { readonly [__brand]: "CaptureName" };
type ActivationId = string & { readonly [__brand]: "ActivationId" };
type EnvId = string & { readonly [__brand]: "EnvId" };

// JSON-safe value type
type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

// Value expression arguments for predicates
type ValueExprArg =
  | { readonly kind: "currentSelector"; readonly selectorId: SelectorId }
  | { readonly kind: "literal"; readonly value: JsonValue };

// Metadata
interface SourceSpan {
  readonly file?: string;
  readonly line?: number;
  readonly column?: number;
}

interface FormulaMeta {
  readonly humanLabel?: string;
  readonly sourceSpan?: SourceSpan;
  readonly confidence?: number;
}

interface NodeProvenance {
  readonly nodeId: NodeId;
  readonly origin: "user" | "compiler" | "pattern";
  readonly sourceExprKind?: string;
  readonly meta?: FormulaMeta;
}

// Runtime binding
interface MonitorRuntime<TEvent> {
  readonly predicates: Readonly<
    Record<PredicateId, (event: TEvent, args: readonly JsonValue[]) => boolean>
  >;
  readonly selectors: Readonly<
    Record<SelectorId, (event: TEvent) => JsonValue>
  >;
  readonly timestamp?: (event: TEvent) => number;
}

`timestamp` is optional in general and required only for formulas that use `withinMs`. It must return finite, non-decreasing millisecond timestamps.

// Formula expression tree (builder output)
type FormulaExpr =
  | LiteralExpr | PredicateExpr | WhenExpr | CaptureExpr
  | NotExpr | AndExpr | OrExpr | ImpliesExpr
  | AlwaysExpr | EventuallyExpr | NextExpr | WeakNextExpr
  | UntilExpr | ReleaseExpr
  | OnceExpr | HistoricallyExpr | SinceExpr
  | WithinStepsExpr | WithinMsExpr;

// Formula node (compiled, uses NodeId references)
type FormulaNode =
  | LiteralNode | PredicateNode | WhenNode | CaptureNode
  | NotNode | AndNode | OrNode | ImpliesNode
  | AlwaysNode | EventuallyNode | NextNode | WeakNextNode
  | UntilNode | ReleaseNode
  | OnceNode | HistoricallyNode | SinceNode
  | WithinStepsNode | WithinMsNode;

// Compiled document
interface FormulaDocument {
  readonly schemaVersion: 1;
  readonly root: NodeId;
  readonly nodes: Readonly<Record<NodeId, FormulaNode>>;
  readonly provenance?: Readonly<Record<NodeId, NodeProvenance>>;
}
```

### Functions

```typescript
// ID constructors
function nodeId(s: string): NodeId;
function predicateId(s: string): PredicateId;
function selectorId(s: string): SelectorId;
function captureName(s: string): CaptureName;
function activationId(s: string): ActivationId;
function envId(s: string): EnvId;

// Value expression constructors
function current(selectorId: SelectorId): ValueExprArg;
function value(v: JsonValue): ValueExprArg;

// Verdict algebra
function notV(v: Verdict): Verdict;
function andV(a: Verdict, b: Verdict): Verdict;
function orV(a: Verdict, b: Verdict): Verdict;
function impliesV(a: Verdict, b: Verdict): Verdict;
```

---

## trace-weave/builder

Formula expression constructors.

### Functions

```typescript
function toExpr(v: boolean | FormulaExpr): FormulaExpr;
function annotate(expr: FormulaExpr, meta: FormulaMeta): FormulaExpr;

// Leaf nodes
function literal(value: boolean): LiteralExpr;
function predicate(predicateId: PredicateId, ...args: readonly ValueExprArg[]): PredicateExpr;

// Value correlation
function capture(captureName: CaptureName, selectorId: SelectorId, child: boolean | FormulaExpr): CaptureExpr;
function when(captureName: CaptureName, selectorId: SelectorId, child: boolean | FormulaExpr): WhenExpr;

// Boolean operators
function not(child: boolean | FormulaExpr): NotExpr;
function and(...children: readonly (boolean | FormulaExpr)[]): AndExpr;
function or(...children: readonly (boolean | FormulaExpr)[]): OrExpr;
function implies(left: boolean | FormulaExpr, right: boolean | FormulaExpr): ImpliesExpr;

// Future temporal operators
function always(child: boolean | FormulaExpr): AlwaysExpr;
function eventually(child: boolean | FormulaExpr): EventuallyExpr;
function next(child: boolean | FormulaExpr): NextExpr;
function weakNext(child: boolean | FormulaExpr): WeakNextExpr;
function until(left: boolean | FormulaExpr, right: boolean | FormulaExpr): UntilExpr;
function release(left: boolean | FormulaExpr, right: boolean | FormulaExpr): ReleaseExpr;

// Past temporal operators
function once(child: boolean | FormulaExpr): OnceExpr;
function historically(child: boolean | FormulaExpr): HistoricallyExpr;
function since(left: boolean | FormulaExpr, right: boolean | FormulaExpr): SinceExpr;

// Bounded operators
function withinSteps(steps: number, child: boolean | FormulaExpr): WithinStepsExpr;
function withinMs(ms: number, child: boolean | FormulaExpr): WithinMsExpr;
```

`withinMs` requires `MonitorRuntime.timestamp`. Executing it without a timestamp function, or with non-monotonic timestamps, throws an error.

---

## trace-weave/compiler

Compilation, analysis, validation, and printing of formula documents.

### Types

```typescript
type SweepDirection = "future" | "past" | "none";

interface CompiledFormula {
  readonly document: FormulaDocument;
  readonly topoOrder: readonly NodeId[];
  readonly reverseTopoOrder: readonly NodeId[];
  readonly children: Readonly<Record<NodeId, readonly NodeId[]>>;
  readonly parents: Readonly<Record<NodeId, readonly NodeId[]>>;
  readonly sweepDirection: Readonly<Record<NodeId, SweepDirection>>;
}

interface ValidationError {
  readonly nodeId: NodeId;
  readonly message: string;
}
```

### Functions

```typescript
// Compile a FormulaExpr tree into a FormulaDocument (DAG with content-hashed NodeIds)
function compile(expr: FormulaExpr): FormulaDocument;

// Prepare a compiled document for online monitoring (topology, parent/child maps)
function prepare(doc: FormulaDocument): CompiledFormula;

// Validate a document for structural errors (capture scoping, bounds)
function validate(doc: FormulaDocument): ValidationError[];

// Pretty-print a document as an LTLf formula string
function print(doc: FormulaDocument): string;

// Content hashing utilities
function contentHash(input: string): string;
function fnv1a(input: string): number;
```

---

## trace-weave/monitor

Evaluation engines and online monitoring.

### Types

```typescript
interface OracleRunResult {
  readonly verdict: Verdict;
  readonly steps: number;
  readonly report: CounterexampleReport | null;
}

interface CounterexampleReport {
  readonly verdict: Verdict;
  readonly failurePath: readonly ObligationSnapshot[];
  readonly traceSlice: readonly { step: number; event: unknown }[];
  readonly summary: string;
}

interface ObligationSnapshot {
  readonly nodeId: NodeId;
  readonly activationId: ActivationId;
  readonly verdict: Verdict;
  readonly step: number;
}

interface MonitorState<TEvent> {
  readonly compiled: CompiledFormula;
  readonly runtime: MonitorRuntime<TEvent>;
  step: number;
  readonly envs: Map<EnvId, EnvFrame>;
  readonly activations: Map<ActivationId, ActivationRecord>;
  readonly nodeActivations: Map<NodeId, Set<ActivationId>>;
  readonly scheduled: ScheduledObligation[];
  readonly dirtyQueue: DirtyEntry[];
  rootActivationId: ActivationId;
  finalized: boolean;
}

interface EnvFrame {
  readonly id: EnvId;
  readonly parent: EnvId | null;
  readonly bindings: Readonly<Record<string, JsonValue>>;
}

interface ActivationRecord {
  readonly id: ActivationId;
  readonly nodeId: NodeId;
  readonly envId: EnvId;
  readonly startStep: number;
  verdict: Verdict;
  prevVerdict: Verdict;
}

interface DirtyEntry {
  readonly nodeId: NodeId;
  readonly activationId: ActivationId;
}

interface ScheduledObligation {
  readonly step: number;
  readonly nodeId: NodeId;
  readonly activationId: ActivationId;
}
```

### Functions

```typescript
// Batch evaluation: evaluate a formula over a complete trace
function evaluateFormula<TEvent>(
  doc: FormulaDocument,
  runtime: MonitorRuntime<TEvent>,
  trace: readonly TEvent[],
): Verdict;

// Convenience: compile + evaluate + report in one call
function runOracle<TEvent>(
  formula: FormulaExpr,
  runtime: MonitorRuntime<TEvent>,
  trace: readonly TEvent[],
): OracleRunResult;

// Online monitoring
function createMonitor<TEvent>(
  compiled: CompiledFormula,
  runtime: MonitorRuntime<TEvent>,
): MonitorState<TEvent>;

function evaluateStep<TEvent>(
  state: MonitorState<TEvent>,
  event: TEvent,
): Verdict;

function finalize<TEvent>(
  state: MonitorState<TEvent>,
  lastEvent: TEvent,
): Verdict;

function finalizeEmpty<TEvent>(
  state: MonitorState<TEvent>,
): Verdict;

function buildReport<TEvent>(
  state: MonitorState<TEvent>,
  trace: readonly TEvent[],
): CounterexampleReport | null;
```

`createMonitor` rejects `withinMs` formulas only when `runtime.timestamp` is missing.
Use `finalize` after at least one `evaluateStep` call. Use `finalizeEmpty` when the monitor has observed no events.

---

## trace-weave/patterns

High-level temporal specification patterns.

### Functions

```typescript
// Core patterns
function absence(p: FormulaExpr): FormulaExpr;
function response(p: FormulaExpr, q: FormulaExpr): FormulaExpr;
function boundedResponse(p: FormulaExpr, q: FormulaExpr, steps: number): FormulaExpr;
function precedence(p: FormulaExpr, q: FormulaExpr): FormulaExpr;
function persistence(p: FormulaExpr): FormulaExpr;
function stability(p: FormulaExpr, q: FormulaExpr): FormulaExpr;

// Scope modifiers
function globally(pattern: FormulaExpr): FormulaExpr;
function after(q: FormulaExpr, pattern: FormulaExpr): FormulaExpr;
function before(r: FormulaExpr, pattern: FormulaExpr): FormulaExpr;
function between(q: FormulaExpr, r: FormulaExpr, pattern: FormulaExpr): FormulaExpr;
```

---

## trace-weave/fast-check

Property-based testing integration with fast-check.

### Types

```typescript
interface TraceConfig<TEvent> {
  readonly eventArbitrary: fc.Arbitrary<TEvent>;
  readonly minLength?: number;  // default: 1
  readonly maxLength?: number;  // default: 50
}

interface TraceEvent<TModel> {
  readonly type: string;
  readonly payload?: unknown;
  readonly modelBefore?: TModel;
  readonly modelAfter?: TModel;
}

interface CommandAdapterConfig<TModel extends object, TReal> {
  readonly commands: fc.Arbitrary<fc.Command<TModel, TReal>>[];
  readonly initialModel: () => TModel;
  readonly initialReal: () => TReal;
}

interface TracePropertyConfig<TEvent> {
  readonly formula: FormulaExpr;
  readonly runtime: MonitorRuntime<TEvent>;
  readonly traceArbitrary: fc.Arbitrary<TEvent[]>;
}
```

### Functions

```typescript
function traceArbitrary<TEvent>(config: TraceConfig<TEvent>): fc.Arbitrary<TEvent[]>;

function commandAdapter<TModel extends object, TReal>(
  config: CommandAdapterConfig<TModel, TReal>,
): fc.Arbitrary<TraceEvent<TModel>[]>;

function traceProperty<TEvent>(
  config: TracePropertyConfig<TEvent>,
): fc.IPropertyWithHooks<[TEvent[]]>;

function commandProperty<TEvent>(
  formula: FormulaExpr,
  runtime: MonitorRuntime<TEvent>,
  commandArbitrary: fc.Arbitrary<TEvent[]>,
): fc.IPropertyWithHooks<[TEvent[]]>;
```

---

## trace-weave/vitest

Custom vitest matchers for temporal property assertions.

### Functions

```typescript
function createMatchers(): {
  toSatisfy<TEvent>(
    received: TEvent[],
    formula: FormulaExpr,
    runtime: MonitorRuntime<TEvent>,
  ): { pass: boolean; message: () => string };

  toViolate<TEvent>(
    received: TEvent[],
    formula: FormulaExpr,
    runtime: MonitorRuntime<TEvent>,
  ): { pass: boolean; message: () => string };
};

function installMatchers(): void;
```

### Module Augmentation

After calling `installMatchers`, these matchers are available on `expect`:

```typescript
interface CustomMatchers<R> {
  toSatisfy<TEvent>(formula: FormulaExpr, runtime: MonitorRuntime<TEvent>): R;
  toViolate<TEvent>(formula: FormulaExpr, runtime: MonitorRuntime<TEvent>): R;
}
```

---

## trace-weave/ai

AI/LLM integration utilities.

### Types

```typescript
interface FormattedReport {
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
```

### Constants

```typescript
// JSON Schema (draft-07) describing FormulaDocument
const formulaDocumentSchema: JsonValue;
```

### Functions

```typescript
function getNodeLabel(doc: FormulaDocument, nodeId: NodeId): string;
function getNodeProvenance(doc: FormulaDocument, nodeId: NodeId): NodeProvenance | undefined;
function getAllLabels(doc: FormulaDocument): Record<NodeId, string>;
function formatReport(report: CounterexampleReport, doc: FormulaDocument): FormattedReport;
```
