# PhotoColorChanger

プラモデル写真の塗装後イメージを、ブラウザ上で確認するための静的サイトです。

## 開発環境

- Node.js 24.19.0
- npm
- TypeScript
- React
- Vite
- Tailwind CSS

### セットアップ

```bash
npm ci
```

### 開発サーバー

```bash
npm run dev
```

### 検証

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
```

## GitHub Pages公開

`main` ブランチへの変更をGitHub Actionsが検知し、静的ビルドをGitHub Pagesへデプロイします。

リポジトリのSettings > Pagesで、公開元をGitHub Actionsに設定してください。

画像や編集結果はバックエンドへ送信せず、ブラウザ内だけで扱います。

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
