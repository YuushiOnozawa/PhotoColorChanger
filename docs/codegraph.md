# CodeGraph-AI導入

## 目的

CodeGraph-AIをローカルMCPサーバーとして利用し、既存コードを変更する前に呼び出し元・依存関係・影響範囲を確認する。

CodeGraphは構造把握と影響分析に使い、正確な文字列検索・既知のファイル編集・テスト実行の代替にはしない。人間向けの仕様やAPI説明は、引き続きREADME・仕様書・TSDocで管理する。

## ローカル導入

Node.js 18以上の環境で、CodeGraph MCPパッケージをグローバルにインストールする。

```bash
npm install -g @astudioplus/codegraph-mcp
npx codegraph-mcp-fetch-engine
```

初回インデックスは数分かかる場合がある。グラフとインデックスはリポジトリ内ではなく、ユーザーの`~/.codegraph`へ保存されるため、生成物をコミットしない。

## Codex設定

`codex mcp add`で登録し、Codexを再起動する。

```bash
codex mcp add codegraph --env CODEGRAPH_TELEMETRY=off -- codegraph-mcp --profile graph
codex mcp list
```

直接編集する場合は、`~/.codex/config.toml`に次の設定を追加する。

```toml
[mcp_servers.codegraph]
command = "codegraph-mcp"
args = ["--profile", "graph"]

[mcp_servers.codegraph.env]
CODEGRAPH_TELEMETRY = "off"
```

`graph`プロファイルは、今回の主用途である呼び出し元・呼び出し先・依存関係・影響範囲の確認に絞る。意味検索や永続メモリが必要になった場合は、プロファイルを別途見直す。

## 使い方

1. CodeGraph MCPが利用可能な状態で、`codegraph_reindex_workspace`を初回実行する。
2. 変更対象のシンボルやファイルに対して`codegraph_analyze_impact`を実行する。
3. `codegraph_get_callers`・`codegraph_get_callees`で呼び出し関係を確認する。
4. 関連テストを確認してから編集し、既存のLint・型チェック・テストを実行する。

CodeGraphが未導入、対象言語の解析に失敗、またはインデックスが古い場合は、通常の検索・読み取り手段へ切り替える。CodeGraphの結果だけで変更範囲を確定せず、最終判断はソースコードとテストで行う。

## 対象外

- GitHub Actionsへの自動組み込み
- 編集前フックによる自動実行
- CodeGraphのグラフデータやネイティブエンジンのリポジトリ内管理
