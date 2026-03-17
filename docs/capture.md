# Value Correlation with Capture and When

The `capture` and `when` operators enable **value correlation** across events in a trace. They let you snapshot a value from one event and then check that the same value appears in a later event.

Runnable example: [`../examples/capture-correlation.mjs`](../examples/capture-correlation.mjs)

```typescript
import { capture, when } from "trace-weave/builder";
import { captureName, selectorId } from "trace-weave/core";
```

---

## Problem

Many temporal properties need to relate values across events. For example:

> "Every request must be followed by a response **with the same request ID**."

Standard temporal operators can express "request followed by response," but they cannot express value equality across time steps. Capture/when solves this.

---

## How It Works

### capture(name, selectorId, child)

`capture` evaluates the selector on the current event and binds the result to a named variable. The child formula is then evaluated with that binding in scope.

- `name`: A `CaptureName` identifying the variable.
- `selectorId`: A `SelectorId` referencing a selector function in the runtime.
- `child`: The formula to evaluate with the binding in scope.

### when(name, selectorId, child)

`when` checks that the current event's selector value **equals** the previously captured value, then evaluates the child.

- `name`: The same `CaptureName` used in a parent `capture`.
- `selectorId`: A `SelectorId` to extract the value from the current event.
- `child`: The formula to evaluate if the values match.

If the values do not match, `when` evaluates to `"violated"`.

---

## Example: Matching Request and Response IDs

```typescript
import { capture, when, predicate, always, implies, eventually } from "trace-weave/builder";
import { predicateId, selectorId, captureName } from "trace-weave/core";
import { runOracle } from "trace-weave/monitor";
import type { MonitorRuntime, PredicateId, SelectorId, CaptureName, JsonValue } from "trace-weave/core";

// Event type
interface Event {
  type: "request" | "response" | "other";
  id: number;
}

// IDs
const isRequest = predicateId("isRequest");
const isResponse = predicateId("isResponse");
const idSel = selectorId("id");
const reqId = captureName("reqId");

// Runtime
const runtime: MonitorRuntime<Event> = {
  predicates: {
    [isRequest]: (e) => e.type === "request",
    [isResponse]: (e) => e.type === "response",
  } as Record<PredicateId, (e: Event, args: readonly JsonValue[]) => boolean>,
  selectors: {
    [idSel]: (e) => e.id,
  } as Record<SelectorId, (e: Event) => JsonValue>,
};

// Formula: G(isRequest -> capture(reqId, id, F(isResponse & when(reqId, id, true))))
// "Every request is eventually followed by a response with the same ID."
const formula = always(
  implies(
    predicate(isRequest),
    capture(reqId, idSel,
      eventually(
        when(reqId, idSel, predicate(isResponse))
      )
    )
  )
);

// Trace where request 1 gets response 1, and request 2 gets response 2
const trace: Event[] = [
  { type: "request", id: 1 },
  { type: "request", id: 2 },
  { type: "response", id: 1 },
  { type: "response", id: 2 },
];

const result = runOracle(formula, runtime, trace);
console.log(result.verdict); // "satisfied"
```

### How the Evaluation Flows

1. At step 0 (`{type: "request", id: 1}`):
   - `isRequest` matches, so the implication's antecedent is true.
   - `capture` snapshots `id=1` and binds it to `reqId`.
   - `eventually` searches forward for a matching `when`.
   - At step 2 (`{type: "response", id: 1}`): `when(reqId, id, ...)` compares captured `1` with current `id=1` -- match. `isResponse` also holds. Satisfied.

2. At step 1 (`{type: "request", id: 2}`):
   - `capture` snapshots `id=2`.
   - At step 3 (`{type: "response", id: 2}`): match. Satisfied.

---

## Scoping Rules

- `capture` creates a **new environment frame** that is a child of the current environment.
- `when` **reads** from the nearest matching capture in the ancestor chain.
- Capture names must not shadow an outer capture of the same name (the compiler's `validate` function checks this).
- A `when` referencing a name that is not in scope produces a validation error.

```typescript
import { validate } from "trace-weave/compiler";

// After compiling, you can check for scoping errors:
const doc = compile(formula);
const errors = validate(doc);
// errors is empty if all captures/whens are properly scoped
```

---

## Value Comparison

The `when` operator uses deep JSON equality to compare the captured value with the current selector value. This means:

- Primitive values (string, number, boolean, null) are compared by value.
- Arrays are compared element-by-element.
- Objects are compared by key set and values.

---

## Selectors

Selectors extract values from events. Register them in your `MonitorRuntime`:

```typescript
const runtime: MonitorRuntime<Event> = {
  predicates: { /* ... */ },
  selectors: {
    [selectorId("id")]: (e) => e.id,
    [selectorId("userId")]: (e) => e.userId,
    [selectorId("amount")]: (e) => e.amount,
  } as Record<SelectorId, (e: Event) => JsonValue>,
};
```

Selector return values must be `JsonValue` (string, number, boolean, null, or nested arrays/objects of these).

---

## Using Selectors with Predicate Arguments

Selectors can also be used as arguments to predicates via `current()`:

```typescript
import { current, value } from "trace-weave/core";

const gt = predicateId("gt");

// Predicate that checks: event.amount > 100
predicate(gt, current(selectorId("amount")), value(100));
```

In the runtime:

```typescript
const runtime: MonitorRuntime<Event> = {
  predicates: {
    [gt]: (_event, args) => (args[0] as number) > (args[1] as number),
  },
  selectors: {
    [selectorId("amount")]: (e) => e.amount,
  },
};
```
