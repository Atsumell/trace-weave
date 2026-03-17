# AI Skill

English version: [skills.md](./skills.md)

`trace-weave` には、自然言語の時間的要件を `trace-weave` テストへ変換するための AI skill を同梱します。

## 何をする skill か

正本の skill は次です。

- `skills/trace-weave-test-author/`

この skill は主に次をガイドします。

- raw builder より先に `patterns` を選ぶ
- 通常のユニットテストでは `runOracle` を優先する
- 値相関には `capture` と `when` を使う
- online monitor は増分・streaming 要件だけに使う
- 必要なら `report` と `formatReport` で failure を整形する

## 既存 installer で入れる

主経路は cross-agent installer です。

```bash
npx skills add https://github.com/Atsumell/trace-weave/tree/main/skills/trace-weave-test-author -a codex -a claude-code -y
```

リポジトリ上でこの installer を使うと、実際の配置先は `./.agents/skills/` になり、対象 agent はその共有コピーへ紐付けられます。

グローバル導入は `-g` を付けます。

```bash
npx skills add https://github.com/Atsumell/trace-weave/tree/main/skills/trace-weave-test-author -a codex -a claude-code -g -y
```

ローカル checkout から同じ流れを確認する場合:

```bash
npx skills add ./skills/trace-weave-test-author -a codex -a claude-code -y
```

## Codex の組み込み installer

Codex 内では次の導入も使えます。

```text
$skill-installer install https://github.com/Atsumell/trace-weave/tree/main/skills/trace-weave-test-author
```

導入後は Codex を再起動して読み込み直します。

## 手動導入

プロジェクト単位:

```bash
mkdir -p .codex/skills/trace-weave-test-author .claude/skills/trace-weave-test-author
cp -R skills/trace-weave-test-author/. .codex/skills/trace-weave-test-author/
cp -R skills/trace-weave-test-author/. .claude/skills/trace-weave-test-author/
```

グローバル:

```bash
mkdir -p ~/.codex/skills/trace-weave-test-author ~/.claude/skills/trace-weave-test-author
cp -R skills/trace-weave-test-author/. ~/.codex/skills/trace-weave-test-author/
cp -R skills/trace-weave-test-author/. ~/.claude/skills/trace-weave-test-author/
```

## バージョン管理と検証

metadata は `skills/trace-weave-test-author/skill.json` に置きます。

- `version`: skill 自体の版
- `traceWeaveCompatibility`: 対応する package range
- `targetAgents`: 現在は `codex` と `claude-code`
- `language`: 正本の言語
- `companionDocs`: 日本語などの companion docs

リリース前の検証:

```bash
npm run skills:validate
```

このコマンドは必須ファイル、metadata、frontmatter、参照ドキュメントをチェックします。
