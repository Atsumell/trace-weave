# Pattern Selection

Choose the smallest trace-weave abstraction that matches the requirement.

## Prefer `trace-weave/patterns`

Use these first:

- `response(p, q)`: "every request is eventually followed by a response"
- `boundedResponse(p, q, n)`: "every request is followed within `n` steps"
- `precedence(p, q)`: "`q` must not happen before `p`"
- `absence(p)`: "`p` never happens"
- `persistence(p)`: "once `p` starts, it stays true"
- `stability(p, q)`: "once `p` happens, `q` stays true"
- `after`, `before`, `between`, `globally`: scoped constraints

## Use raw builder operators when no pattern fits

Reach for `trace-weave/builder` when the requirement needs:

- nested temporal structure
- boolean composition across multiple patterns
- past-time operators such as `once`, `historically`, or `since`
- mixed future and past reasoning in one formula

## Use value correlation explicitly

Use `capture` and `when` when the rule depends on a value extracted from one event and checked later, for example:

- matching request IDs
- matching user IDs or order IDs
- comparing selected values across time

## Deadlines

- Use `withinSteps` when the bound is in discrete trace steps
- Use `withinMs` when the bound is in wall-clock milliseconds and the runtime can provide `timestamp`

## Default choice

If multiple encodings are possible, choose:

1. pattern helper
2. builder with `runOracle`
3. builder with online monitor only when the task is explicitly incremental
