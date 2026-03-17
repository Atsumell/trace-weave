# fast-check Integration

trace-weave integrates with [fast-check](https://github.com/dubzzz/fast-check) for property-based testing of temporal properties. This lets you verify that your formulas hold across randomly generated traces.

```typescript
import {
  traceArbitrary, commandAdapter,
  traceProperty, commandProperty,
} from "trace-weave/fast-check";
```

Requires `fast-check >= 3.0.0` as a peer dependency.

---

## traceArbitrary

Generates random arrays of events.

```typescript
import * as fc from "fast-check";
import { traceArbitrary } from "trace-weave/fast-check";

interface Event {
  type: string;
  value: number;
}

const eventArb: fc.Arbitrary<Event> = fc.record({
  type: fc.constantFrom("request", "response", "error"),
  value: fc.integer({ min: 0, max: 100 }),
});

const traces = traceArbitrary({
  eventArbitrary: eventArb,
  minLength: 1,   // default: 1
  maxLength: 50,  // default: 50
});
```

### TraceConfig

```typescript
interface TraceConfig<TEvent> {
  readonly eventArbitrary: fc.Arbitrary<TEvent>;
  readonly minLength?: number;  // default: 1
  readonly maxLength?: number;  // default: 50
}
```

---

## traceProperty

Creates a fast-check property that runs the oracle on each generated trace. If the formula is violated, the property throws an error with the counterexample report.

```typescript
import * as fc from "fast-check";
import { traceArbitrary, traceProperty } from "trace-weave/fast-check";
import { always, predicate, implies, eventually } from "trace-weave/builder";
import { predicateId } from "trace-weave/core";
import type { MonitorRuntime, PredicateId, SelectorId, JsonValue } from "trace-weave/core";

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

const formula = always(implies(predicate(isReq), eventually(predicate(isRes))));

const prop = traceProperty({
  formula,
  runtime,
  traceArbitrary: traceArbitrary({
    eventArbitrary: fc.record({
      type: fc.constantFrom("request", "response"),
    }),
  }),
});

// Run as a fast-check assertion
fc.assert(prop);
```

### TracePropertyConfig

```typescript
interface TracePropertyConfig<TEvent> {
  readonly formula: FormulaExpr;
  readonly runtime: MonitorRuntime<TEvent>;
  readonly traceArbitrary: fc.Arbitrary<TEvent[]>;
}
```

---

## commandAdapter

Bridges fast-check's command-based model checking to trace-weave. It takes a set of `fc.Command` instances and converts the model-checking execution into an array of `TraceEvent` objects.

```typescript
import * as fc from "fast-check";
import { commandAdapter } from "trace-weave/fast-check";

interface CounterModel {
  count: number;
}

class RealCounter {
  count = 0;
  increment() { this.count++; }
  decrement() { this.count--; }
}

const incrementCmd: fc.Command<CounterModel, RealCounter> = {
  check: () => true,
  run: (model, real) => {
    model.count++;
    real.increment();
  },
  toString: () => "increment",
};

const decrementCmd: fc.Command<CounterModel, RealCounter> = {
  check: (model) => model.count > 0,
  run: (model, real) => {
    model.count--;
    real.decrement();
  },
  toString: () => "decrement",
};

const traceFromCommands = commandAdapter({
  commands: [fc.constant(incrementCmd), fc.constant(decrementCmd)],
  initialModel: () => ({ count: 0 }),
  initialReal: () => new RealCounter(),
});
```

### TraceEvent

Each step in the resulting trace includes model snapshots:

```typescript
interface TraceEvent<TModel> {
  readonly type: string;        // from cmd.toString()
  readonly payload?: unknown;
  readonly modelBefore?: TModel; // deep-cloned model before command
  readonly modelAfter?: TModel;  // deep-cloned model after command
}
```

### CommandAdapterConfig

```typescript
interface CommandAdapterConfig<TModel extends object, TReal> {
  readonly commands: fc.Arbitrary<fc.Command<TModel, TReal>>[];
  readonly initialModel: () => TModel;
  readonly initialReal: () => TReal;
}
```

---

## commandProperty

Convenience function that combines `commandAdapter` output with `traceProperty`. It creates a fast-check property from a formula, runtime, and command-generated trace arbitrary.

```typescript
import { commandProperty } from "trace-weave/fast-check";

const prop = commandProperty(formula, runtime, traceFromCommands);
fc.assert(prop);
```

---

## Using with vitest

Combine fast-check with vitest for integrated test suites:

```typescript
import { describe, it } from "vitest";
import * as fc from "fast-check";
import { traceProperty, traceArbitrary } from "trace-weave/fast-check";

describe("temporal properties", () => {
  it("response pattern holds across random traces", () => {
    fc.assert(
      traceProperty({
        formula,
        runtime,
        traceArbitrary: traceArbitrary({
          eventArbitrary: eventArb,
          maxLength: 20,
        }),
      })
    );
  });
});
```

---

## Verifying LTLf Identities

Property-based testing is useful for verifying LTLf algebraic identities:

```typescript
import { not, always, eventually, predicate } from "trace-weave/builder";
import { runOracle } from "trace-weave/monitor";

// Duality: !G(p) == F(!p)
fc.assert(
  fc.property(traceArb, (trace) => {
    const lhs = runOracle(not(always(predicate(p))), runtime, trace).verdict;
    const rhs = runOracle(eventually(not(predicate(p))), runtime, trace).verdict;
    return lhs === rhs;
  })
);

// Idempotence: G(G(p)) == G(p)
fc.assert(
  fc.property(traceArb, (trace) => {
    const lhs = runOracle(always(always(predicate(p))), runtime, trace).verdict;
    const rhs = runOracle(always(predicate(p)), runtime, trace).verdict;
    return lhs === rhs;
  })
);
```
