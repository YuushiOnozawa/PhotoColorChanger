# 色置き換え手法の比較ページ：ゴール

この文書はユーザーが所有します。エージェントは変更しません。

## ゴール

PRプレビューのGitHub Pages上で、ブラウザで動く色置き換え手法を一通り動かし、手法ごとのページをリンクで行き来して目視比較できること。

## 比較する手法

各ページに設定値を表示し、同じ画像・同じクリック条件で比較できるようにする。

| 軸 | 手法 | 固定条件 |
|---|---|---|
| 色判定 | RGB距離（現行） / HSV距離（tol12相当） / Lab ΔE（明度重み0.35） | 再着色=単色置換、境界制約なし |
| 範囲判定 | なし / XDoG→Sobel＋連結領域 / GrabCut（HSV初期化、OpenCV.js） / GrabCut高速版（長辺512px縮小） / 背景除外＋GrabCut（被写体抽出→部品抽出の2段階） / 線画補助（背景除外＋GrabCut後、影補正線画で区切った領域ごとに多数決） | 色判定=HSV、再着色=単色置換 |
| 再着色 | 単色置換 / Lab L*保持＋a\*b\*置換 / HSV色相シフト / 陰影保持カラー化（Lab：L*を置換色の平均へ平行移動、a\*b\*は置換色） | 共通の固定マスク |

- 初期値（tol12、明度重み0.35）はsample2で決めた値で、色空間間の公平性は保証しない。
- 範囲判定軸は旧「境界制約」軸。method-id は互換のため `boundary-*` を維持する。
- GrabCut の初期化：クリック近傍=確定前景、クリック点に連結したHSV候補=推定前景、その他=推定背景、画像端=確定背景。
- GrabCut（等倍・高速版とも）はWeb Workerで実行し、処理中は各出力に「処理中」表示を出す。等倍版は高速版の精度比較の基準として残す。
- 再着色軸の固定マスク：合成画像では既知の正解マスク、アップロード画像ではHSVマスクで代用し、その旨を画面に表示する。

## ページ構成

- 軸ごとの一覧ページ＋手法ごとのページ。相互にリンクで行き来できる。
- 画像はアップロード式。処理はブラウザ内のみで、外部送信しない。

### 実装規約（自動判定が依存する）

- URL（ハッシュルーティング）：一覧 `#/compare`、手法 `#/compare/<method-id>`
- method-id：`color-rgb` `color-hsv` `color-lab` `boundary-none` `boundary-xdog-sobel` `mask-grabcut` `mask-grabcut-fast` `mask-grabcut-subject` `mask-grabcut-lineart` `recolor-solid` `recolor-lab-luma` `recolor-hsv-hue` `recolor-luma-colorize`
- data-testid：
  - 一覧ページ `compare-index`、各手法へのリンク `compare-link-<method-id>`
  - 手法ページ `compare-method-<method-id>`、一覧へ戻るリンク `compare-back`、前後の手法へのリンク `compare-prev` / `compare-next`
  - 画像アップロード入力 `compare-upload`、合成画像を読み込むボタン `compare-load-synthetic`
  - 入力キャンバス `compare-input`、出力キャンバス `compare-output`、設定値表示 `compare-params`
- 合成画像を読み込むと、既定のクリック位置で自動的に処理し、出力キャンバスに結果を描く。
- 実物サンプル（`example/sample1.png` と `example/sample2.png`、ユーザーが公開を承認済み）：
  - ボタン `compare-load-examples` で2枚を同時に読み込み、横並び（狭い画面では縦並び）で表示する。
  - 各サンプルのパネル `compare-example-sample1` / `compare-example-sample2` に、入力キャンバス `compare-example-<name>-input` と出力キャンバス `compare-example-<name>-output` を置く。
  - 各サンプルに既定の基準点（塗装部品上）を持たせ、読み込み時に自動で処理する。入力のクリックでサンプルごとに基準点を変えられ、手法ページ間で維持する。
  - 処理負荷を抑えるため、長辺1024px程度に縮小して処理してよい。

## 対象外

- MobileSAMなどPython/サーバー処理が必要な手法
- Reinhard色転送（参照色サンプル機能の段階で再検討）
- 実用品質の達成判定（ユーザーが目視で判断する）

## 制約

- `example/sample1.png` と `example/sample2.png` はPagesで公開してよい（2026-10-13 ユーザー承認）。`.jpeg` 版や `sample2-cut.png` 等の未追跡画像は含めない。
- 自動確認には、プログラムで生成した合成画像を使う。
- 新しい依存パッケージを追加しない（必要ならユーザーに確認）。例外：`@techstark/opencv-js`（2026-10-13 ユーザー承認）。GrabCutページでのみ動的に読み込み、同一オリジンから配信する。
- PRは1本のみ。mainへのマージはユーザーが行う。

## 完了条件（`scripts/check-goal.sh` で判定）

1. `npm run typecheck` / `lint` / `test:run` / `build` が成功する。
2. PRプレビューのPagesデプロイが、最新コミットで成功している。
3. Playwrightでプレビューを開き、次を確認する。
   - 全手法ページと一覧ページが存在し、リンクで遷移できる。
   - 合成画像で、各手法の出力が入力から変化する。
   - 実物サンプル2枚を同時に読み込み、各手法で両方の出力が入力から変化する。
   - 画像処理中に外部へのネットワーク送信が発生しない。
   - 各手法のスクリーンショットを保存する。

## エスカレーション（ループを止めてユーザーに確認する）

- Codexとの合議が3ラウンドで決着しない
- 同じ失敗が3回続く
- 1手法あたりの実装→検証が5回を超える
- スコープ変更、依存パッケージの追加、既存機能の削除
- レビュー工程は省略する（手法の本採用時に行う）
