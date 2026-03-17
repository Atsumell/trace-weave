# Getting Started

English version: [getting-started.md](./getting-started.md)

trace-weave は TypeScript 向けの有限長トレース時相ロジック検証フレームワークです。イベント列に対する時間的な仕様を記述し、プログラムから検証できます。

## インストール

```bash
npm install trace-weave
```

Node.js 20 以上が必要で、配布形式は ESM only です。

## 実行可能な examples

リポジトリ上で確認する場合は、一度 build してから [../examples/README.ja.md](../examples/README.ja.md) の例を実行してください。

```bash
npm run build
node examples/basic-oracle.mjs
```

### 任意の peer dependency

| Package    | 用途                     |
|------------|--------------------------|
| fast-check | Property-based testing   |
| vitest     | Custom matcher           |

```bash
npm install fast-check vitest
```

## コア概念

1. **Events**: アプリケーションが生成するイベント列です。
2. **Formulas**: イベント列に対して守りたい時間的条件です。
3. **Runtime**: predicate / selector をイベント型に結び付ける設定です。
4. **Oracle**: trace を評価して `"satisfied"`, `"violated"`, `"pending"` を返します。

## 最初の例

`type` フィールドを持つイベントに対して、「すべての request は eventually response される」を検証します。

```ts
import { predicate, always, implies, eventually } from "trace-weave/builder";
import { predicateId } from "trace-weave/core";
import { runOracle } from "trace-weave/monitor";
import type { MonitorRuntime, PredicateId, SelectorId, JsonValue } from "trace-weave/core";

interface AppEvent {
  type: string;
  payload?: unknown;
}

const isRequest = predicateId("isRequest");
const isResponse = predicateId("isResponse");

const runtime: MonitorRuntime<AppEvent> = {
  predicates: {
    [isRequest]: (e) => e.type === "request",
    [isResponse]: (e) => e.type === "response",
  } as Record<PredicateId, (e: AppEvent, args: readonly JsonValue[]) => boolean>,
  selectors: {} as Record<SelectorId, (e: AppEvent) => JsonValue>,
};

const formula = always(
  implies(predicate(isRequest), eventually(predicate(isResponse)))
);

const trace: AppEvent[] = [
  { type: "request" },
  { type: "processing" },
  { type: "response" },
];

const result = runOracle(formula, runtime, trace);

console.log(result.verdict); // "satisfied"
```

## 次に読むページ

- [Docs Index 日本語版](./README.ja.md)
- [Examples 日本語版](../examples/README.ja.md)
- [Monitor 日本語版](./monitor.ja.md)
- [Patterns](./patterns.md)
- [Capture](./capture.md)
- [API Reference](./api-reference.md)
