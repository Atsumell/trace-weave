# Patterns

trace-weave provides pre-built temporal specification patterns that encode common behavioral requirements. Each pattern is a function that returns a `FormulaExpr`, composing the underlying LTLf operators for you.

All patterns are available from `trace-weave/patterns`.

```typescript
import {
  absence, response, boundedResponse, precedence, persistence, stability,
  globally, after, before, between,
} from "trace-weave/patterns";
```

## Setup for Examples

All examples below use this shared setup:

```typescript
import { predicate } from "trace-weave/builder";
import { predicateId } from "trace-weave/core";
import { runOracle } from "trace-weave/monitor";
import type { MonitorRuntime, PredicateId, SelectorId, JsonValue } from "trace-weave/core";

interface Event { type: string }

const isA = predicateId("isA");
const isB = predicateId("isB");
const isC = predicateId("isC");

const runtime: MonitorRuntime<Event> = {
  predicates: {
    [isA]: (e) => e.type === "A",
    [isB]: (e) => e.type === "B",
    [isC]: (e) => e.type === "C",
  } as Record<PredicateId, (e: Event, args: readonly JsonValue[]) => boolean>,
  selectors: {} as Record<SelectorId, (e: Event) => JsonValue>,
};

const p = predicate(isA);
const q = predicate(isB);
const r = predicate(isC);
```

---

## Core Patterns

### absence(p)

**Meaning:** `p` never holds at any step in the trace.

**LTLf encoding:** `G(!p)`

```typescript
const formula = absence(p);

// Satisfied: p never appears
runOracle(formula, runtime, [{ type: "B" }, { type: "B" }]).verdict; // "satisfied"

// Violated: p appears at step 2
runOracle(formula, runtime, [{ type: "B" }, { type: "A" }]).verdict; // "violated"
```

---

### response(p, q)

**Meaning:** Every occurrence of `p` is eventually followed by `q`.

**LTLf encoding:** `G(p -> F q)`

```typescript
const formula = response(p, q);

// Satisfied: every A is followed by B
runOracle(formula, runtime, [
  { type: "A" }, { type: "B" },
  { type: "A" }, { type: "B" },
]).verdict; // "satisfied"

// Violated: second A has no following B
runOracle(formula, runtime, [
  { type: "A" }, { type: "B" },
  { type: "A" },
]).verdict; // "violated"
```

---

### boundedResponse(p, q, steps)

**Meaning:** Every occurrence of `p` is followed by `q` within `steps` steps.

**LTLf encoding:** `G(p -> (q | Xw(q | Xw(q | ...))))` unrolled to depth `steps`.

```typescript
const formula = boundedResponse(p, q, 2);

// Satisfied: B arrives within 2 steps of each A
runOracle(formula, runtime, [
  { type: "A" }, { type: "C" }, { type: "B" },
]).verdict; // "satisfied"

// Violated: B is 3 steps away
runOracle(formula, runtime, [
  { type: "A" }, { type: "C" }, { type: "C" }, { type: "B" },
]).verdict; // "violated"
```

---

### precedence(p, q)

**Meaning:** `q` can only occur after `p` has already occurred. Before `p` happens, `q` must not hold.

**LTLf encoding:** `p R (!q)` (release: `!q` must hold at least until `p` holds)

```typescript
const formula = precedence(p, q);

// Satisfied: A comes before B
runOracle(formula, runtime, [
  { type: "A" }, { type: "B" },
]).verdict; // "satisfied"

// Violated: B appears before A
runOracle(formula, runtime, [
  { type: "B" }, { type: "A" },
]).verdict; // "violated"
```

---

### persistence(p)

**Meaning:** Once `p` holds, it holds at every subsequent step.

**LTLf encoding:** `G(p -> G p)`

```typescript
const formula = persistence(p);

// Satisfied: once A starts, it stays A
runOracle(formula, runtime, [
  { type: "B" }, { type: "A" }, { type: "A" },
]).verdict; // "satisfied"

// Violated: A then B
runOracle(formula, runtime, [
  { type: "A" }, { type: "B" },
]).verdict; // "violated"
```

---

### stability(p, q)

**Meaning:** Once `p` holds, `q` holds at every subsequent step.

**LTLf encoding:** `G(p -> G q)`

```typescript
const formula = stability(p, q);

// Satisfied: after A, B holds forever
runOracle(formula, runtime, [
  { type: "C" }, { type: "A" }, { type: "B" }, { type: "B" },
]).verdict; // "satisfied"

// Violated: after A, B does not hold at step 3
runOracle(formula, runtime, [
  { type: "A" }, { type: "B" }, { type: "C" },
]).verdict; // "violated"
```

---

## Scoped Patterns

Scoped patterns restrict when a base pattern must hold. They wrap any `FormulaExpr` with temporal scope boundaries.

### globally(pattern)

**Meaning:** The pattern holds at every step. Equivalent to `always(pattern)`.

**LTLf encoding:** `G(pattern)`

```typescript
import { globally } from "trace-weave/patterns";
import { not } from "trace-weave/builder";

// Error events never occur
const formula = globally(not(p));
```

---

### after(q, pattern)

**Meaning:** The pattern holds at every step after `q` has occurred at least once.

**LTLf encoding:** `G(P(q) -> pattern)` where `P` is the past-time "once" operator.

```typescript
import { after } from "trace-weave/patterns";

// After initialization (A), property q must always hold
const formula = after(p, q);

// Satisfied: B holds at every step after A first appears
runOracle(formula, runtime, [
  { type: "C" },  // before A: no constraint
  { type: "A" },  // A occurs (but at this step, once(A)=true, need B? A!=B -> violated)
  { type: "B" },
]).verdict;
```

Note: The `after` scope includes the step where `q` itself occurs. If the pattern needs to hold only strictly *after* the triggering event, compose with `next`.

---

### before(r, pattern)

**Meaning:** The pattern holds at every step before `r` has occurred.

**LTLf encoding:** `G(!P(r) -> pattern)` -- while `r` has never been seen in the past, the pattern must hold.

```typescript
import { before } from "trace-weave/patterns";

// Before shutdown (C), all events must be A
const formula = before(r, p);

runOracle(formula, runtime, [
  { type: "A" }, { type: "A" }, { type: "C" }, { type: "B" },
]).verdict; // "satisfied" -- B after C is fine
```

---

### between(q, r, pattern)

**Meaning:** The pattern holds at every step between an occurrence of `q` and the next occurrence of `r`.

**LTLf encoding:** `G((P(q) & !P(r)) -> pattern)`

```typescript
import { between } from "trace-weave/patterns";

// Between A and C, all events must be B
const formula = between(p, r, q);
```

---

## Composing Patterns

Patterns return plain `FormulaExpr` values, so you can compose them freely with builder operators:

```typescript
import { and } from "trace-weave/builder";

// Both patterns must hold simultaneously
const formula = and(
  response(p, q),
  absence(r),
);
```

## Pattern Summary Table

| Pattern                     | LTLf Encoding               | Meaning                                      |
|-----------------------------|------------------------------|----------------------------------------------|
| `absence(p)`                | `G(!p)`                      | p never holds                                |
| `response(p, q)`            | `G(p -> F q)`                | every p is followed by q                     |
| `boundedResponse(p, q, n)`  | `G(p -> F_{<=n} q)`          | every p is followed by q within n steps      |
| `precedence(p, q)`          | `p R (!q)`                   | q only occurs after p                        |
| `persistence(p)`            | `G(p -> G p)`                | once p holds, it holds forever               |
| `stability(p, q)`           | `G(p -> G q)`                | once p holds, q holds forever                |
| `globally(pattern)`         | `G(pattern)`                 | pattern holds at every step                  |
| `after(q, pattern)`         | `G(P(q) -> pattern)`         | pattern holds after q first occurs           |
| `before(r, pattern)`        | `G(!P(r) -> pattern)`        | pattern holds before r first occurs          |
| `between(q, r, pattern)`    | `G((P(q) & !P(r)) -> pat)`   | pattern holds between q and next r           |
