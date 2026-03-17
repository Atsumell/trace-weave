# Test Templates

Use these shapes as defaults.

## `runOracle` unit test

```ts
import { predicate } from "trace-weave/builder";
import { predicateId } from "trace-weave/core";
import { runOracle } from "trace-weave/monitor";
import { response } from "trace-weave/patterns";

const isRequest = predicateId("isRequest");
const isResponse = predicateId("isResponse");

const runtime = {
  predicates: {
    [isRequest]: (event) => event.type === "request",
    [isResponse]: (event) => event.type === "response",
  },
  selectors: {},
};

const formula = response(predicate(isRequest), predicate(isResponse));

expect(
  runOracle(formula, runtime, [{ type: "request" }, { type: "response" }]).verdict
).toBe("satisfied");

expect(
  runOracle(formula, runtime, [{ type: "request" }]).verdict
).toBe("violated");
```

## Vitest matcher test

```ts
import { predicate } from "trace-weave/builder";
import { predicateId } from "trace-weave/core";
import { response } from "trace-weave/patterns";
import { installMatchers } from "trace-weave/vitest";

installMatchers();

const formula = response(predicate(isRequest), predicate(isResponse));
expect([{ type: "request" }, { type: "response" }]).toSatisfy(formula, runtime);
expect([{ type: "request" }]).toViolate(formula, runtime);
```

## Value-correlation test

```ts
const formula = always(
  implies(
    predicate(isRequest),
    capture(
      requestId,
      idSel,
      eventually(when(requestId, idSel, predicate(isResponse)))
    )
  )
);
```

## Online monitor test

Use only when the requirement is incremental:

```ts
const monitor = createMonitor(prepare(compile(formula)), runtime);
evaluateStep(monitor, event1);
evaluateStep(monitor, event2);
expect(finalize(monitor, event2)).toBe("satisfied");
```
