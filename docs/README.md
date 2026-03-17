# Docs Index

Japanese version: [README.ja.md](./README.ja.md)

Start here if you are new to the repository or need a quick map of the guides.

English is the primary documentation language. Japanese companion pages are available for key entry docs:

- [Repository README (JA)](../README.ja.md)
- [Examples (JA)](../examples/README.ja.md)
- [Getting Started (JA)](./getting-started.ja.md)
- [Monitor (JA)](./monitor.ja.md)

## Start Here

- [Getting Started](./getting-started.md): install the package, define a runtime, and run your first oracle
- [Examples](../examples/README.md): runnable repository examples for each public module
- [API Reference](./api-reference.md): exported types and functions by module

## Core Guides

- [Formulas](./formulas.md): raw builder operators and LTLf semantics
- [Monitor](./monitor.md): `runOracle`, batch evaluation, and online monitoring
- [Patterns](./patterns.md): high-level helpers like `response`, `boundedResponse`, and `between`
- [Capture](./capture.md): value correlation across events with `capture` and `when`

## Integrations

- [Vitest Integration](./vitest.md): `toSatisfy` and `toViolate` matchers
- [fast-check Integration](./fast-check.md): property-based testing helpers
- [AI Integration](./ai-integration.md): schema, provenance, and report formatting

## Recommended Reading Order

1. Read [Getting Started](./getting-started.md).
2. Run one of the examples from [Examples](../examples/README.md).
3. Go to [Monitor](./monitor.md) if you need evaluation details or online monitoring.
4. Use the specialized guides for patterns, value correlation, and integrations as needed.
