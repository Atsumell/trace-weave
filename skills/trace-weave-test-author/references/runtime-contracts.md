# Runtime Contracts

Every trace-weave test needs a runtime that bridges your event type to the formula.

## Predicates

Define predicates for event classification and boolean checks over the current event.

Typical uses:

- event type checks
- status checks
- field comparisons against literal arguments

## Selectors

Add selectors only when the formula needs to read event values.

Typical uses:

- `capture` and `when`
- predicate arguments via `current(selectorId(...))`

Selectors must return `JsonValue`.

## Timestamp

Add `runtime.timestamp` only when `withinMs` is present.

Timestamp rules:

- return finite numbers
- use milliseconds
- keep values non-decreasing across the trace

## Formula choice and runtime shape

- no value reads: predicates only
- value correlation: predicates + selectors
- millisecond deadlines: predicates + timestamp, selectors only if needed

## Test-writing defaults

- use `runOracle(formula, runtime, trace)` for unit tests
- build small inline runtimes inside the test file unless a shared helper already exists
- keep event fixtures compact and explicit
