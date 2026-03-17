# Vitest Integration

trace-weave provides custom vitest matchers for ergonomic temporal property assertions in test files.

Runnable example: [`../examples/vitest-response.test.mjs`](../examples/vitest-response.test.mjs) with [`../examples/vitest.config.mjs`](../examples/vitest.config.mjs)

```typescript
import { installMatchers } from "trace-weave/vitest";
```

Requires `vitest >= 2.0.0` as a peer dependency.

---

## Setup

Call `installMatchers()` once before your tests run. The recommended approach is to call it in a setup file or at the top of your test file.

### Option 1: Setup File

Create a setup file (e.g., `tests/setup.ts`):

```typescript
import { installMatchers } from "trace-weave/vitest";

installMatchers();
```

Reference it in your `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./tests/setup.ts"],
  },
});
```

### Option 2: Per-File Setup

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { installMatchers } from "trace-weave/vitest";

beforeAll(() => {
  installMatchers();
});
```

---

## Matchers

### toSatisfy(formula, runtime)

Asserts that a trace satisfies the given formula under the given runtime.

```typescript
import { predicate, always } from "trace-weave/builder";
import { predicateId } from "trace-weave/core";
import type { MonitorRuntime, PredicateId, SelectorId, JsonValue } from "trace-weave/core";

interface Event { type: string }

const isOk = predicateId("isOk");
const runtime: MonitorRuntime<Event> = {
  predicates: {
    [isOk]: (e) => e.type === "ok",
  } as Record<PredicateId, (e: Event, args: readonly JsonValue[]) => boolean>,
  selectors: {} as Record<SelectorId, (e: Event) => JsonValue>,
};

const formula = always(predicate(isOk));

it("all events are ok", () => {
  const trace = [{ type: "ok" }, { type: "ok" }];
  expect(trace).toSatisfy(formula, runtime);
});
```

On failure, the error message includes the verdict and the counterexample report summary:

```
Expected trace to satisfy formula, but got verdict: violated
Formula violated.
```

### toViolate(formula, runtime)

Asserts that a trace violates the given formula.

```typescript
it("trace contains a non-ok event", () => {
  const trace = [{ type: "ok" }, { type: "error" }];
  expect(trace).toViolate(formula, runtime);
});
```

On failure:

```
Expected trace to violate formula, but got verdict: satisfied
```

---

## Negated Matchers

Vitest's `.not` modifier works as expected:

```typescript
it("trace does not violate the formula", () => {
  const trace = [{ type: "ok" }];
  expect(trace).not.toViolate(formula, runtime);
});

it("trace does not satisfy the formula", () => {
  const trace = [{ type: "error" }];
  expect(trace).not.toSatisfy(formula, runtime);
});
```

---

## Full Example

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { installMatchers } from "trace-weave/vitest";
import { predicate, always, implies, eventually } from "trace-weave/builder";
import { predicateId } from "trace-weave/core";
import { response } from "trace-weave/patterns";
import type { MonitorRuntime, PredicateId, SelectorId, JsonValue } from "trace-weave/core";

beforeAll(() => {
  installMatchers();
});

interface Event { type: string }

const isReq = predicateId("isReq");
const isRes = predicateId("isRes");

const runtime: MonitorRuntime<Event> = {
  predicates: {
    [isReq]: (e) => e.type === "request",
    [isRes]: (e) => e.type === "response",
  } as Record<PredicateId, (e: Event, args: readonly JsonValue[]) => boolean>,
  selectors: {} as Record<SelectorId, (e: Event) => JsonValue>,
};

describe("request-response protocol", () => {
  const formula = response(predicate(isReq), predicate(isRes));

  it("satisfies when every request has a response", () => {
    expect([
      { type: "request" },
      { type: "response" },
    ]).toSatisfy(formula, runtime);
  });

  it("violates when a request has no response", () => {
    expect([
      { type: "request" },
      { type: "request" },
    ]).toViolate(formula, runtime);
  });
});
```

---

## Type Augmentation

`installMatchers` extends vitest's `expect` with the custom matchers through module augmentation. The type declarations are included automatically when you import from `trace-weave/vitest`. Your IDE should provide full autocomplete for `toSatisfy` and `toViolate`.

If TypeScript does not pick up the augmented types, ensure your `tsconfig.json` includes the trace-weave type declarations:

```json
{
  "compilerOptions": {
    "types": ["vitest"]
  }
}
```
