# Getting Started

Japanese version: [getting-started.ja.md](./getting-started.ja.md)

trace-weave is a finite-trace temporal test oracle framework based on LTLf (Linear Temporal Logic over finite traces) for TypeScript. It lets you express temporal properties about event traces and verify them programmatically.

## Installation

```bash
npm install @atsumell/trace-weave
```

trace-weave requires Node.js 20 or later. It ships as ESM only.

## Runnable Examples

If you are working from the repository, build once and then run the examples from [../examples/README.md](../examples/README.md):

```bash
npm run build
node examples/basic-oracle.mjs
```

### Optional Peer Dependencies

| Package    | Required for               |
|------------|----------------------------|
| fast-check | Property-based testing     |
| vitest     | Custom matchers            |

```bash
npm install fast-check vitest  # install whichever you need
```

## Core Concepts

1. **Events** -- Your application produces a sequence of events (a *trace*).
2. **Formulas** -- You write temporal formulas that describe correct behavior.
3. **Runtime** -- You supply predicate and selector functions that bridge your event type to the formula world.
4. **Oracle** -- The oracle evaluates the formula against the trace and returns a verdict: `"satisfied"`, `"violated"`, or `"pending"`.

## First Example

Suppose you have a system that emits events with a `type` field. You want to verify that every `"request"` event is eventually followed by a `"response"` event.

```typescript
import { predicate, always, implies, eventually } from "@atsumell/trace-weave/builder";
import { predicateId } from "@atsumell/trace-weave/core";
import { runOracle } from "@atsumell/trace-weave/monitor";
import type { MonitorRuntime, PredicateId, SelectorId, JsonValue } from "@atsumell/trace-weave/core";

// 1. Define your event type
interface AppEvent {
  type: string;
  payload?: unknown;
}

// 2. Register predicate IDs
const isRequest = predicateId("isRequest");
const isResponse = predicateId("isResponse");

// 3. Build the runtime that connects predicates to your event type
const runtime: MonitorRuntime<AppEvent> = {
  predicates: {
    [isRequest]: (e) => e.type === "request",
    [isResponse]: (e) => e.type === "response",
  } as Record<PredicateId, (e: AppEvent, args: readonly JsonValue[]) => boolean>,
  selectors: {} as Record<SelectorId, (e: AppEvent) => JsonValue>,
};

// 4. Build the formula: G(isRequest -> F isResponse)
const formula = always(
  implies(predicate(isRequest), eventually(predicate(isResponse)))
);

// 5. Define a trace
const trace: AppEvent[] = [
  { type: "request" },
  { type: "processing" },
  { type: "response" },
  { type: "request" },
  { type: "response" },
];

// 6. Run the oracle
const result = runOracle(formula, runtime, trace);

console.log(result.verdict); // "satisfied"
console.log(result.steps);   // 5
console.log(result.report);  // null (no violation)
```

### A Failing Trace

```typescript
const badTrace: AppEvent[] = [
  { type: "request" },
  { type: "processing" },
  // no response ever arrives
];

const badResult = runOracle(formula, runtime, badTrace);

console.log(badResult.verdict);         // "violated"
console.log(badResult.report?.summary); // "Formula violated."
```

## Using High-Level Patterns

Instead of manually composing `always(implies(..., eventually(...)))`, you can use the built-in `response` pattern:

```typescript
import { response } from "@atsumell/trace-weave/patterns";
import { predicate } from "@atsumell/trace-weave/builder";

const formula = response(predicate(isRequest), predicate(isResponse));
// Equivalent to: always(implies(predicate(isRequest), eventually(predicate(isResponse))))
```

See [Patterns](./patterns.md) for all available patterns.

## Subpath Exports

trace-weave uses subpath exports. Import from the specific module you need:

| Import path             | Contents                                    |
|-------------------------|---------------------------------------------|
| `@atsumell/trace-weave/core`      | Types, IDs, verdict algebra                 |
| `@atsumell/trace-weave/builder`   | Formula builder functions                   |
| `@atsumell/trace-weave/compiler`  | compile, prepare, validate, print           |
| `@atsumell/trace-weave/monitor`   | evaluateFormula, runOracle, online monitor  |
| `@atsumell/trace-weave/patterns`  | High-level temporal patterns                |
| `@atsumell/trace-weave/fast-check`| Property-based testing integration          |
| `@atsumell/trace-weave/vitest`    | Custom vitest matchers                      |
| `@atsumell/trace-weave/ai`        | JSON schema, metadata, report formatting    |

## Next Steps

- [Docs Index](./README.md) -- Guide map by task
- [Examples](../examples/README.md) -- Runnable repository examples
- [Patterns](./patterns.md) -- Pre-built temporal patterns with LTLf encodings
- [Formulas](./formulas.md) -- Raw builder API and all temporal operators
- [Monitor](./monitor.md) -- Three-valued verdict system and evaluation modes
- [Capture](./capture.md) -- Value correlation with capture/when operators
- [fast-check Integration](./fast-check.md) -- Property-based testing
- [Vitest Integration](./vitest.md) -- Custom matchers
- [AI Integration](./ai-integration.md) -- LLM-friendly output
- [API Reference](./api-reference.md) -- Complete type reference
