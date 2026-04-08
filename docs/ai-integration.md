# AI Integration

The `@atsumell/trace-weave/ai` module provides utilities for making formula documents and verification results consumable by LLMs (Large Language Models) and other AI systems.

Runnable example: [`../examples/ai-report.mjs`](../examples/ai-report.mjs)

```typescript
import {
  formulaDocumentSchema,
  getNodeLabel, getNodeProvenance, getAllLabels,
  formatReport,
} from "@atsumell/trace-weave/ai";
```

---

## JSON Schema

`formulaDocumentSchema` is a JSON Schema (draft-07) object describing the structure of a `FormulaDocument`. It can be provided to an LLM as part of its context so the model can generate or interpret formula documents.

```typescript
import { formulaDocumentSchema } from "@atsumell/trace-weave/ai";

// Pass the schema to an LLM as a tool definition or system prompt
const systemPrompt = `
You can create temporal specifications using the following schema:
${JSON.stringify(formulaDocumentSchema, null, 2)}
`;
```

The schema describes:

| Field            | Type     | Description                                |
|------------------|----------|--------------------------------------------|
| `schemaVersion`  | `1`      | Always 1                                   |
| `root`           | string   | NodeId of the root formula node            |
| `nodes`          | object   | Map from NodeId to FormulaNode             |
| `provenance`     | object   | Optional provenance metadata for nodes     |

Each node in `nodes` has a `kind` field with one of: `literal`, `predicate`, `when`, `capture`, `not`, `and`, `or`, `implies`, `always`, `eventually`, `next`, `weakNext`, `until`, `release`, `once`, `historically`, `since`, `withinSteps`, `withinMs`.

---

## Metadata Utilities

### getNodeLabel(doc, nodeId): string

Returns a human-readable label for a node. If the node has provenance metadata with a `humanLabel`, that is returned. Otherwise, the node's `kind` is returned.

```typescript
import { getNodeLabel } from "@atsumell/trace-weave/ai";
import { compile } from "@atsumell/trace-weave/compiler";
import { annotate, always, predicate } from "@atsumell/trace-weave/builder";
import { predicateId } from "@atsumell/trace-weave/core";

const formula = annotate(
  always(predicate(predicateId("isHealthy"))),
  { humanLabel: "System health invariant" }
);

const doc = compile(formula);
const label = getNodeLabel(doc, doc.root);
// "System health invariant" (if provenance was preserved)
// or "always" (falls back to node kind)
```

### getNodeProvenance(doc, nodeId): NodeProvenance | undefined

Returns the full provenance record for a node, if available.

```typescript
import { getNodeProvenance } from "@atsumell/trace-weave/ai";

const provenance = getNodeProvenance(doc, doc.root);
if (provenance) {
  console.log(provenance.origin);        // "user" | "compiler" | "pattern"
  console.log(provenance.sourceExprKind); // e.g. "always"
  console.log(provenance.meta);           // { humanLabel, sourceSpan, confidence }
}
```

### getAllLabels(doc): Record<NodeId, string>

Returns a map from every NodeId in the document to its human-readable label.

```typescript
import { getAllLabels } from "@atsumell/trace-weave/ai";

const labels = getAllLabels(doc);
// { "a1b2c3d4": "always", "e5f6g7h8": "predicate", ... }
```

---

## formatReport

Converts a `CounterexampleReport` into a structured and text format suitable for LLM consumption.

```typescript
import { formatReport } from "@atsumell/trace-weave/ai";
import { runOracle } from "@atsumell/trace-weave/monitor";
import { compile } from "@atsumell/trace-weave/compiler";

const result = runOracle(formula, runtime, trace);

if (result.report) {
  const doc = compile(formula);
  const formatted = formatReport(result.report, doc);

  // Structured output for programmatic use
  console.log(formatted.structured);
  // {
  //   verdict: "violated",
  //   steps: [
  //     { nodeId: "abc123", label: "always", verdict: "violated", step: 0 },
  //     { nodeId: "def456", label: "predicate", verdict: "violated", step: 2 },
  //   ],
  //   traceSlice: [
  //     { step: 1, event: { type: "A" } },
  //     { step: 2, event: { type: "B" } },
  //   ],
  // }

  // Text output for LLM prompts
  console.log(formatted.text);
  // Verdict: violated
  //
  // Failure Path:
  //   [step 0] always (abc123): violated
  //   [step 2] predicate (def456): violated
  //
  // Trace:
  //   step 1: {"type":"A"}
  //   step 2: {"type":"B"}
  //
  // Formula violated.
}
```

### FormattedReport

```typescript
interface FormattedReport {
  readonly structured: {
    readonly verdict: string;
    readonly steps: readonly {
      readonly nodeId: string;
      readonly label: string;
      readonly verdict: string;
      readonly step: number;
    }[];
    readonly traceSlice: readonly { step: number; event: unknown }[];
  };
  readonly text: string;
}
```

---

## LLM Workflow Example

A typical workflow for using trace-weave with an LLM:

1. **Provide the schema** to the LLM as context so it understands the formula format.
2. **LLM generates a formula** (as a `FormulaDocument` JSON) based on a natural language requirement.
3. **Evaluate** the formula against a trace using `evaluateFormula`.
4. **Format the report** and feed it back to the LLM for explanation or debugging.

```typescript
import { formulaDocumentSchema, formatReport } from "@atsumell/trace-weave/ai";
import { evaluateFormula } from "@atsumell/trace-weave/monitor";

// Step 1: Give schema to LLM
const prompt = `
Given this schema: ${JSON.stringify(formulaDocumentSchema)}
Generate a formula document for: "Every login must be followed by a logout."
`;

// Step 2: Parse LLM response into FormulaDocument
const doc = JSON.parse(llmResponse); // FormulaDocument

// Step 3: Evaluate
const verdict = evaluateFormula(doc, runtime, trace);

// Step 4: If violated, format and send back
if (verdict === "violated") {
  // Build a report and format it for the LLM
  const formatted = formatReport(report, doc);
  const followUp = `
    The formula was violated. Here is the report:
    ${formatted.text}
    Please explain why the trace violates the specification.
  `;
}
```

---

## Provenance

The `NodeProvenance` system tracks where each node in a compiled formula came from:

| Origin      | Meaning                                              |
|-------------|------------------------------------------------------|
| `"user"`    | Created directly by the user via the builder API     |
| `"compiler"`| Generated by the compiler during compilation         |
| `"pattern"` | Generated by a high-level pattern function           |

Provenance is preserved when the user attaches `FormulaMeta` (via `annotate`) to builder expressions. The compiler records this in the `provenance` field of the `FormulaDocument`.
