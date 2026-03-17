# trace-weave

English version: [README.md](./README.md)

TypeScript 向けの有限長トレース時相ロジック検証フレームワークです。

`trace-weave` はイベント列に対する時系列仕様を記述し、有限実行に対して検証できます。単発のアサーションでは表現しにくい、リクエストとレスポンスの順序、期限付き eventuality、イベント間の値相関の検査を目的にしています。

実行可能なサンプルは [examples/README.ja.md](./examples/README.ja.md) に、ドキュメント全体の入口は [docs/README.ja.md](./docs/README.ja.md) にまとめています。

## 要件

- Node.js 20 以上
- ESM 専用パッケージ

## インストール

```bash
npm install trace-weave
```

任意の peer dependency:

```bash
npm install fast-check vitest
```

## クイックスタート

```ts
import { predicate, always, implies, eventually } from "trace-weave/builder";
import { predicateId } from "trace-weave/core";
import { runOracle } from "trace-weave/monitor";

type AppEvent = { type: string };

const isRequest = predicateId("isRequest");
const isResponse = predicateId("isResponse");

const formula = always(
  implies(predicate(isRequest), eventually(predicate(isResponse))),
);

const result = runOracle(
  formula,
  {
    predicates: {
      [isRequest]: (event) => event.type === "request",
      [isResponse]: (event) => event.type === "response",
    },
    selectors: {},
  },
  [{ type: "request" }, { type: "response" }],
);

console.log(result.verdict); // "satisfied"
```

## モジュール

- `trace-weave/core`: ID、型、verdict algebra、runtime interface
- `trace-weave/builder`: 時相式 builder
- `trace-weave/compiler`: compile、validate、print
- `trace-weave/monitor`: batch 評価と online monitor
- `trace-weave/patterns`: 高レベルの時相パターン
- `trace-weave/fast-check`: Property-based testing 連携
- `trace-weave/vitest`: custom matcher
- `trace-weave/ai`: レポート整形と AI 向け helper

## 開発コマンド

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run pack:smoke
```

## ドキュメント

- [Docs Index 日本語版](./docs/README.ja.md)
- [Getting Started 日本語版](./docs/getting-started.ja.md)
- [Examples 日本語版](./examples/README.ja.md)
- [Monitor 日本語版](./docs/monitor.ja.md)
- [English Docs Index](./docs/README.md)

## ライセンス

MIT
