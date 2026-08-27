import { initialAppState } from "./app/appState";
import "./styles.css";

function App() {
  const isImageLoaded = initialAppState.imageSessionStatus !== "empty";

  return (
    <main className="app-shell">
      <header className="app-header">
        <p className="app-eyebrow">PhotoColorChanger</p>
        <h1>塗装後の色を、写真で確認する</h1>
        <p className="app-description">
          プラモデルの写真を読み込み、色を置き換えたイメージをブラウザ内で確認できます。
        </p>
      </header>

      <div className="workspace" aria-label="編集ワークスペース">
        <aside className="panel panel-tools" aria-labelledby="tools-title">
          <h2 id="tools-title">ツール</h2>
          <p>画像を読み込むと、ここに編集ツールが表示されます。</p>
        </aside>

        <section className="canvas-panel" aria-labelledby="canvas-title">
          <div className="panel-heading">
            <h2 id="canvas-title">Canvas</h2>
            <span className="status-badge" aria-live="polite">
              {isImageLoaded ? "読み込み済み" : "画像未読み込み"}
            </span>
          </div>
          <div className="canvas-placeholder" role="img" aria-label="画像未読み込みのCanvas">
            <span>画像を読み込むと、ここに表示されます</span>
          </div>
        </section>

        <aside className="panel panel-history" aria-labelledby="history-title">
          <h2 id="history-title">履歴</h2>
          <p>色の変更履歴は、ここに表示されます。</p>
        </aside>
      </div>
    </main>
  );
}

export default App;
