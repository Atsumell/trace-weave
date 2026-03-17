# Monitor and Evaluation

The `trace-weave/monitor` module provides two evaluation strategies and a three-valued verdict system for checking temporal formulas against event traces.

```typescript
import {
  evaluateFormula, runOracle,
  createMonitor, evaluateStep, finalize, buildReport,
} from "trace-weave/monitor";
```

`runOracle` is the recommended entrypoint for correctness-focused testing. Use the online monitor when you need incremental integration, then call `finalize` to resolve the complete finite-trace verdict.

---

## Three-Valued Verdict

Every evaluation produces one of three verdicts:

| Verdict       | Meaning                                                              |
|---------------|----------------------------------------------------------------------|
| `"satisfied"` | The formula definitely holds on the given trace.                     |
| `"violated"`  | The formula definitely does not hold on the given trace.             |
| `"pending"`   | The formula's truth value cannot yet be determined (needs more data).|

The verdict algebra is defined in `trace-weave/core`:

```typescript
import { notV, andV, orV, impliesV } from "trace-weave/core";

notV("satisfied");           // "violated"
notV("violated");            // "satisfied"
notV("pending");             // "pending"

andV("satisfied", "pending"); // "pending"
andV("satisfied", "violated");// "violated"

orV("violated", "pending");   // "pending"
orV("violated", "satisfied"); // "satisfied"

impliesV("violated", "violated"); // "satisfied" (false -> anything)
```

---

## Batch Evaluation: evaluateFormula

`evaluateFormula` takes a compiled `FormulaDocument`, a `MonitorRuntime`, and a complete trace. It evaluates the entire formula tree against the full trace using recursive descent with memoization.

```typescript
import { evaluateFormula } from "trace-weave/monitor";
import { compile } from "trace-weave/compiler";
import type { MonitorRuntime } from "trace-weave/core";

const doc = compile(formula);
const verdict = evaluateFormula(doc, runtime, trace);
// verdict: "satisfied" | "violated" | "pending"
```

This is the most straightforward evaluation method. It processes the trace as a whole and returns a definitive verdict. Internally it uses position-indexed caching, so repeated sub-formula evaluations at the same trace position are computed only once.

`withinMs` is executable when `MonitorRuntime.timestamp` is defined. The timestamp function must return finite, non-decreasing millisecond values for the trace.

### How It Works

1. Start at the root node, position 0.
2. For each node, evaluate according to LTLf semantics (see [Formulas](./formulas.md)).
3. Temporal operators (always, eventually, until, etc.) iterate over subsequent trace positions.
4. Past operators (once, historically, since) iterate backwards.
5. Results are memoized by `(nodeId, position, envKey)`.

---

## Convenience: runOracle

`runOracle` is the simplest entry point. It accepts a raw `FormulaExpr` (no need to compile first), compiles it, evaluates it, and returns a structured result.

```typescript
import { runOracle } from "trace-weave/monitor";

const result = runOracle(formula, runtime, trace);
```

### OracleRunResult

```typescript
interface OracleRunResult {
  readonly verdict: Verdict;            // "satisfied" | "violated" | "pending"
  readonly steps: number;               // length of the trace
  readonly report: CounterexampleReport | null; // non-null on violation
}
```

### CounterexampleReport

When the verdict is `"violated"`, the report provides diagnostic information:

```typescript
interface CounterexampleReport {
  readonly verdict: Verdict;
  readonly failurePath: readonly ObligationSnapshot[];
  readonly traceSlice: readonly { step: number; event: unknown }[];
  readonly summary: string;
}
```

- **failurePath**: The chain of nodes from root to the point of violation.
- **traceSlice**: The events indexed by step number.
- **summary**: A human-readable explanation.

Example usage:

```typescript
const result = runOracle(always(predicate(isOk)), runtime, trace);

if (result.verdict === "violated") {
  console.log(result.report!.summary);
  // "Formula violated."

  for (const event of result.report!.traceSlice) {
    console.log(`Step ${event.step}: ${JSON.stringify(event.event)}`);
  }
}
```

---

## Online Monitoring

For scenarios where events arrive incrementally (streaming, long-running processes), trace-weave provides an online monitor.

The online monitor requires the same timestamp contract for `withinMs`. Creating a monitor for a formula that uses `withinMs` without `runtime.timestamp` throws immediately.

### Creating a Monitor

```typescript
import { compile, prepare } from "trace-weave/compiler";
import { createMonitor, evaluateStep, finalize, finalizeEmpty } from "trace-weave/monitor";

const doc = compile(formula);
const compiled = prepare(doc);
const monitor = createMonitor(compiled, runtime);
```

### Feeding Events

Call `evaluateStep` for each new event. It returns the current verdict after that step.

```typescript
const v1 = evaluateStep(monitor, { type: "request" }); // might be "pending"
const v2 = evaluateStep(monitor, { type: "response" }); // might be "satisfied"
```

`evaluateStep` uses prefix semantics over the events observed so far. Open-ended future operators such as `always`, `eventually`, `until`, and `weakNext` often remain `"pending"` until enough evidence arrives or the trace is finalized.

The monitor maintains internal state including:
- **Activation records** for each node in the formula graph.
- **Scheduled obligations** for temporal operators that need to check future steps.
- **Environment frames** for capture/when value correlation.

### Finalizing

When the trace is complete, call `finalize` with the last observed event:

```typescript
const finalVerdict = finalize(monitor, lastEvent);
```

For true empty-trace semantics, call `finalizeEmpty` instead:

```typescript
const finalVerdict = finalizeEmpty(monitor);
```

`finalize` remains backward-compatible with earlier releases: if it is called on an empty monitor, it materializes a single-event trace from the provided `lastEvent`. `finalizeEmpty` is the explicit API for resolving a monitor against a genuinely empty trace.

Both functions resolve the monitor against the complete observed trace using the batch evaluator. This gives the same final verdict as `runOracle` on the same formula and trace, and it applies the trace-end rules below:

| Operator    | During trace | At trace end     |
|-------------|-------------|------------------|
| `always`    | pending     | satisfied (vacuously)  |
| `eventually`| pending     | violated               |
| `next`      | pending     | violated (strong next) |
| `weakNext`  | pending     | satisfied (weak next)  |
| `until`     | pending     | checks right at last step |
| `release`   | pending     | checks right at last step |

### Building a Report from Online Monitor

After finalization, use `buildReport` to generate a counterexample report:

```typescript
import { buildReport } from "trace-weave/monitor";

const report = buildReport(monitor, trace);
if (report) {
  console.log(report.summary);
}
```

---

## Trace-End Semantics

In LTLf (finite-trace LTL), the end of the trace has specific implications:

1. **always (G)**: If pending at trace end, resolves to `"satisfied"` (the property held at all observed steps, and there are no more steps to violate it).

2. **eventually (F)**: If pending at trace end, resolves to `"violated"` (the event never appeared, and there are no more chances).

3. **next (X)**: At trace end, resolves to `"violated"` (there is no next step -- strong next requires one to exist).

4. **weakNext (Xw)**: At trace end, resolves to `"satisfied"` (there is no next step, and weak next is vacuously true when the successor does not exist).

5. **until (U)**: At trace end, checks whether the right operand holds at the final step.

6. **release (R)**: At trace end, checks whether the right operand holds at the final step.

7. **withinSteps**: At trace end, if the child has not been satisfied, resolves to `"violated"`.

8. **withinMs**: Resolves to `"violated"` at trace end if no satisfying position was observed within the millisecond window.

These semantics are consistent with the standard LTLf interpretation where formulas are evaluated over finite, complete traces.

---

## Choosing an Evaluation Strategy

| Strategy           | Use case                                | Performance         |
|--------------------|----------------------------------------|---------------------|
| `runOracle`        | Testing, one-shot verification          | Simple, fast        |
| `evaluateFormula`  | When you already have a `FormulaDocument`| Direct, memoized   |
| Online monitoring  | Streaming events, long traces          | Incremental         |

For most testing scenarios, `runOracle` is the recommended entry point.
