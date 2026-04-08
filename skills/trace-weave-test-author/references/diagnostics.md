# Diagnostics

Use diagnostics when the task needs explanations, failure slices, or LLM-friendly summaries.

## `runOracle` report

`runOracle` returns:

- `verdict`
- `steps`
- `report`

When `verdict === "violated"`, inspect:

- `report.summary`
- `report.traceSlice`
- `report.failurePath`

## `formatReport`

Use `@atsumell/trace-weave/ai` when the consumer is another LLM or a UI that needs structured output.

```ts
const result = runOracle(formula, runtime, trace);
const doc = compile(formula);
const formatted = formatReport(result.report!, doc);
```

Use this when the user asks for:

- machine-readable violation output
- AI explanations of why a trace failed
- a prompt-ready failure summary

## Online monitor finalization

- use `finalize(monitor, lastEvent)` for non-empty traces
- use `finalizeEmpty(monitor)` for true empty-trace semantics
- call `buildReport(monitor, trace)` after finalization when you need a counterexample report

## Default behavior

If the user only wants a unit test, keep diagnostics minimal. Add report assertions only when they improve failure readability or are part of the requested behavior.
