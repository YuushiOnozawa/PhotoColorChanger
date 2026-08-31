import { initialAppState } from "./app/appState";
import "./styles.css";

function App() {
  const isImageLoaded = initialAppState.imageSessionStatus !== "empty";

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1440px] p-[clamp(1.25rem,3vw,3rem)] max-[640px]:p-4">
      <header className="mb-[clamp(1.5rem,4vw,3rem)] max-w-[760px]">
        <p className="mb-2 text-[0.8rem] font-bold tracking-[0.12em] text-[#9a5634] uppercase">
          PhotoColorChanger
        </p>
        <h1 className="mb-3 text-[clamp(1.8rem,4vw,3.3rem)] leading-[1.2]">
          塗装後の色を、写真で確認する
        </h1>
        <p className="text-[#6e675e] leading-[1.7]">
          プラモデルの写真を読み込み、色を置き換えたイメージをブラウザ内で確認できます。
        </p>
      </header>

      <div
        className="grid grid-cols-[minmax(180px,0.8fr)_minmax(320px,2fr)_minmax(180px,0.8fr)] items-stretch gap-4 max-[900px]:grid-cols-[1fr_1.7fr] max-[640px]:grid-cols-1"
        aria-label="編集ワークスペース"
      >
        <aside
          className="min-h-[420px] rounded-2xl border border-[#ded7ca] bg-[rgb(255_253_248_/_75%)] p-5 shadow-[0_1rem_2.5rem_rgb(75_59_42_/_7%)] max-[640px]:min-h-0"
          aria-labelledby="tools-title"
        >
          <h2 id="tools-title" className="mb-3 text-base">
            ツール
          </h2>
          <p className="mb-0 text-[0.9rem] leading-[1.7] text-[#6e675e]">
            画像を読み込むと、ここに編集ツールが表示されます。
          </p>
        </aside>

        <section
          className="flex min-h-[420px] flex-col rounded-2xl border border-[#ded7ca] bg-[#fffdf8] p-5 shadow-[0_1rem_2.5rem_rgb(75_59_42_/_7%)] max-[640px]:min-h-0"
          aria-labelledby="canvas-title"
        >
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 id="canvas-title" className="mb-0 text-base">
              Canvas
            </h2>
            <span
              className="rounded-full bg-[#f4e2d5] px-2.5 py-1.5 text-xs font-bold whitespace-nowrap text-[#8a4a2c]"
              aria-live="polite"
            >
              {isImageLoaded ? "読み込み済み" : "画像未読み込み"}
            </span>
          </div>
          <div
            className="grid min-h-[320px] flex-1 place-items-center rounded-xl border border-dashed border-[#cdbfad] bg-[repeating-conic-gradient(#faf6ee_0%_25%,#f3ede3_0%_50%)] text-center text-[#84796d] [background-size:1.5rem_1.5rem] max-[640px]:min-h-[260px]"
            role="img"
            aria-label="画像未読み込みのCanvas"
          >
            <span>画像を読み込むと、ここに表示されます</span>
          </div>
        </section>

        <aside
          className="min-h-[420px] rounded-2xl border border-[#ded7ca] bg-[rgb(255_253_248_/_75%)] p-5 shadow-[0_1rem_2.5rem_rgb(75_59_42_/_7%)] max-[900px]:col-span-full max-[900px]:min-h-0"
          aria-labelledby="history-title"
        >
          <h2 id="history-title" className="mb-3 text-base">
            履歴
          </h2>
          <p className="mb-0 text-[0.9rem] leading-[1.7] text-[#6e675e]">
            色の変更履歴は、ここに表示されます。
          </p>
        </aside>
      </div>
    </main>
  );
}

export default App;
