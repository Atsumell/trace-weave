# Formula Builder API

The `@atsumell/trace-weave/builder` module provides functions to construct `FormulaExpr` trees. These are the raw building blocks that the higher-level [patterns](./patterns.md) are composed from.

```typescript
import {
  literal, predicate, not, and, or, implies,
  always, eventually, next, weakNext, until, release,
  once, historically, since,
  withinSteps, withinMs,
  capture, when,
  toExpr, annotate,
} from "@atsumell/trace-weave/builder";
```

Every builder function returns a `FormulaExpr`. Arguments accept `boolean | FormulaExpr` -- bare `true`/`false` values are automatically promoted to `LiteralExpr` nodes via `toExpr`.

---

## Utility Functions

### toExpr(v: boolean | FormulaExpr): FormulaExpr

Converts a bare boolean to a `LiteralExpr`. Passes through `FormulaExpr` values unchanged.

```typescript
toExpr(true);  // { kind: "literal", value: true }
toExpr(false); // { kind: "literal", value: false }

const expr = literal(true);
toExpr(expr) === expr; // true (identity)
```

### annotate(expr, meta): FormulaExpr

Attaches metadata to a formula node. The `FormulaMeta` object can include a human-readable label, source location, and confidence score.

```typescript
const labeled = annotate(
  always(predicate(isHealthy)),
  { humanLabel: "System health invariant" }
);
```

---

## Leaf Nodes

### literal(value: boolean): LiteralExpr

Creates a constant truth value.

```typescript
literal(true);  // always satisfied
literal(false); // always violated
```

### predicate(predicateId, ...args): PredicateExpr

References a predicate function registered in the `MonitorRuntime`. The predicate is evaluated against each event at runtime.

```typescript
import { predicateId } from "@atsumell/trace-weave/core";

const isError = predicateId("isError");
predicate(isError);
```

With arguments (using `ValueExprArg`):

```typescript
import { predicateId, selectorId, current, value } from "@atsumell/trace-weave/core";

const gt = predicateId("gt");
const amount = selectorId("amount");

// gt(event.amount, 100)
predicate(gt, current(amount), value(100));
```

#### Current-Position Semantics

A bare predicate is a **point assertion**. trace-weave starts evaluation at the root node, position `0`, so a top-level `predicate(isError)` checks only the first event in the trace.

```typescript
predicate(isError);              // "the first event is an error"
eventually(predicate(isError));  // "some event is an error"
always(predicate(isError));      // "every event is an error"
```

This also applies to any non-temporal sub-formula: if you want "somewhere in the trace", wrap it in `eventually(...)`.

---

## Boolean Operators

### not(child): NotExpr

Logical negation.

| child      | result     |
|------------|------------|
| satisfied  | violated   |
| violated   | satisfied  |
| pending    | pending    |

```typescript
not(predicate(isError)); // event is NOT an error
not(true);               // equivalent to literal(false)
```

### and(...children): AndExpr

Logical conjunction. Accepts variadic arguments.

```typescript
and(predicate(isActive), predicate(isHealthy));
and(true, predicate(isReady), not(predicate(isError)));
```

Three-valued semantics: returns `"violated"` if any child is violated, `"pending"` if any child is pending (and none violated), `"satisfied"` only if all children are satisfied.

### or(...children): OrExpr

Logical disjunction. Accepts variadic arguments.

```typescript
or(predicate(isRetry), predicate(isSuccess));
```

Three-valued semantics: returns `"satisfied"` if any child is satisfied, `"pending"` if any child is pending (and none satisfied), `"violated"` only if all children are violated.

### implies(left, right): ImpliesExpr

Material implication: `left -> right`, equivalent to `or(not(left), right)`.

```typescript
// If error, then retry follows
implies(predicate(isError), predicate(isRetry));
```

---

## Future Temporal Operators

These operators reason about the current and future steps of the trace.

### always(child): AlwaysExpr

**G(p)** -- Globally. The child must hold at the current step and all subsequent steps.

**Finite-trace semantics:** At position `i`, `G(p)` = `p[i] & p[i+1] & ... & p[n-1]`. On an empty suffix (past the end), `G(p)` is vacuously satisfied.

```typescript
always(predicate(isHealthy));
// Every event in the trace must satisfy isHealthy
```

### eventually(child): EventuallyExpr

**F(p)** -- Finally. The child must hold at the current step or some future step.

**Finite-trace semantics:** At position `i`, `F(p)` = `p[i] | p[i+1] | ... | p[n-1]`. On an empty suffix, `F(p)` is violated (no step exists to make it true).

```typescript
eventually(predicate(isComplete));
// At some point, the trace reaches a "complete" event
```

### next(child): NextExpr

**X(p)** -- Strong next. The child must hold at the next step. If there is no next step (end of trace), the result is `"violated"`.

```typescript
next(predicate(isAck));
// The very next event must be an acknowledgment
```

### weakNext(child): WeakNextExpr

**Xw(p)** -- Weak next. Like `next`, but if there is no next step (end of trace), the result is `"satisfied"`.

```typescript
weakNext(predicate(isIdle));
// The next event (if any) must be idle
```

### until(left, right): UntilExpr

**p U q** -- `left` must hold at every step until `right` holds at some step. `right` must eventually hold (strong until).

**Finite-trace semantics:** At position `i`, there exists `j >= i` such that `q[j]` holds and `p[k]` holds for all `k` in `[i, j)`.

```typescript
until(predicate(isProcessing), predicate(isDone));
// Processing continues until done
```

### release(left, right): ReleaseExpr

**p R q** -- Dual of until. `right` must hold at every step up to and including the step where `left` first holds. If `left` never holds, `right` must hold at all remaining steps.

**Finite-trace semantics:** `p R q = !((!p) U (!q))`

```typescript
release(predicate(isShutdown), predicate(isAlive));
// System stays alive until (and including when) shutdown occurs
```

---

## Past Temporal Operators

These operators reason about the current and previous steps of the trace.

### once(child): OnceExpr

**P(p)** -- Past eventually. The child held at the current step or some previous step.

```typescript
once(predicate(isInitialized));
// Initialization has happened at some point in the past
```

### historically(child): HistoricallyExpr

**H(p)** -- Past globally. The child held at every step from the beginning up to (and including) the current step.

```typescript
historically(predicate(isValid));
// Every event so far has been valid
```

### since(left, right): SinceExpr

**p S q** -- Past until. There exists a past step where `right` held, and `left` has held at every step since then up to the current step.

```typescript
since(predicate(isActive), predicate(wasStarted));
// System has been active since it was started
```

---

## Bounded Operators

### withinSteps(steps, child): WithinStepsExpr

**F_{<=n}(p)** -- Bounded eventually. The child must hold within `steps` steps from the current position.

```typescript
withinSteps(3, predicate(isAck));
// Acknowledgment must arrive within 3 steps
```

### withinMs(ms, child): WithinMsExpr

**F_{<=t}(p)** -- Time-bounded eventually. The child must become true within `ms` milliseconds.

This operator is executable when `MonitorRuntime.timestamp` is defined. The runtime must return finite, non-decreasing millisecond timestamps for the trace.

```typescript
withinMs(5000, predicate(isResponse));
// Response must arrive within 5 seconds
```

---

## Capture and When Operators

See [Capture](./capture.md) for the full guide on value correlation.

### capture(captureName, selectorId, child): CaptureExpr

Snapshots the value of a selector at the current event and binds it to a named capture variable for use in descendant `when` nodes.

### when(captureName, selectorId, child): WhenExpr

Checks that the current event's selector value matches the captured value, then evaluates the child.

---

## Semantics Reference Table

| Operator             | Notation  | At position i                                          | At trace end         |
|----------------------|-----------|--------------------------------------------------------|----------------------|
| `literal(true)`      | true      | satisfied                                              | satisfied            |
| `literal(false)`     | false     | violated                                               | violated             |
| `predicate(p)`       | p         | p(event[i])                                            | violated             |
| `not(a)`             | !a        | flip(a[i])                                             | flip(a[end])         |
| `and(a, b)`          | a & b     | min(a[i], b[i])                                        | min(a[end], b[end])  |
| `or(a, b)`           | a \| b    | max(a[i], b[i])                                        | max(a[end], b[end])  |
| `implies(a, b)`      | a -> b    | !a[i] \| b[i]                                         | !a[end] \| b[end]   |
| `always(p)`          | G p       | p[i] & p[i+1] & ... & p[n-1]                          | vacuously satisfied  |
| `eventually(p)`      | F p       | p[i] \| p[i+1] \| ... \| p[n-1]                       | violated             |
| `next(p)`            | X p       | p[i+1]                                                | violated             |
| `weakNext(p)`        | Xw p      | p[i+1]                                                | satisfied            |
| `until(p, q)`        | p U q     | exists j>=i: q[j] & forall k in [i,j): p[k]           | check q at last step |
| `release(p, q)`      | p R q     | dual of until                                          | check q at last step |
| `once(p)`            | P p       | p[0] \| p[1] \| ... \| p[i]                           | --                   |
| `historically(p)`    | H p       | p[0] & p[1] & ... & p[i]                              | --                   |
| `since(p, q)`        | p S q     | exists j<=i: q[j] & forall k in (j,i]: p[k]           | --                   |
| `withinSteps(n, p)`  | F_{<=n} p | p[i] \| p[i+1] \| ... \| p[min(i+n, len)-1]           | violated             |
| `withinMs(t, p)`     | F_{<=t} p | exists j>=i within t milliseconds where p[j] holds     | violated             |
