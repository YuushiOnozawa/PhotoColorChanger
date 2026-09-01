import { useEffect, useRef, useState, type MouseEvent } from "react";
import { ImageLoadError, loadImageFile, type LoadedImage } from "./app/imageLoader";
import { initialAppState } from "./app/appState";
import { imageUiText } from "./app/uiText";
import { rgbToHex } from "./app/color";
import "./styles.css";

function App() {
  const [appState, setAppState] = useState(initialAppState);
  const [loadedImage, setLoadedImage] = useState<LoadedImage | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [replacementColor, setReplacementColor] = useState("#ffffff");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !loadedImage) return;

    canvas.width = loadedImage.width;
    canvas.height = loadedImage.height;
    canvas
      .getContext("2d")
      ?.drawImage(loadedImage.source, 0, 0, loadedImage.width, loadedImage.height);
  }, [loadedImage]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;

    setErrorMessage(null);
    setNotice(null);
    setIsLoading(true);

    try {
      const nextImage = await loadImageFile(file);
      setLoadedImage(nextImage);
      setSelectedColor(null);
      setAppState({ imageSessionStatus: "loaded" });
      if (nextImage.wasResized) {
        setNotice(imageUiText.notices.resized);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof ImageLoadError && error.kind === "unsupported"
          ? imageUiText.errors.unsupported
          : imageUiText.errors.invalid,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCanvasClick = (event: MouseEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const context = canvas.getContext("2d");
    if (!context || rect.width === 0 || rect.height === 0) return;

    const x = Math.min(
      canvas.width - 1,
      Math.max(0, Math.floor(((event.clientX - rect.left) / rect.width) * canvas.width)),
    );
    const y = Math.min(
      canvas.height - 1,
      Math.max(0, Math.floor(((event.clientY - rect.top) / rect.height) * canvas.height)),
    );
    const [red, green, blue] = context.getImageData(x, y, 1, 1).data;
    setSelectedColor(rgbToHex(red, green, blue));
  };

  const isImageLoaded = appState.imageSessionStatus === "loaded";

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
          <label
            htmlFor="image-file"
            className="inline-flex cursor-pointer rounded-lg bg-[#9a5634] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#814426] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#9a5634]"
          >
            画像を選択
          </label>
          <input
            id="image-file"
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="画像ファイル"
            disabled={isLoading}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              void handleFile(file);
            }}
          />
          <p className="mt-3 mb-0 text-[0.9rem] leading-[1.7] text-[#6e675e]">
            JPEG、PNG、WebPを選択するか、Canvasへドロップしてください。
          </p>
          {isImageLoaded && (
            <section className="mt-6" aria-labelledby="color-picker-title">
              <h3 id="color-picker-title" className="mb-3 text-sm">
                {imageUiText.colorPicker.title}
              </h3>
              <p className="mb-3 text-[0.9rem] leading-[1.7] text-[#6e675e]">
                {imageUiText.colorPicker.hint}
              </p>
              <dl className="m-0 grid gap-3 text-[0.9rem]">
                <div className="flex items-center justify-between gap-3">
                  <dt>{imageUiText.colorPicker.targetLabel}</dt>
                  <dd className="m-0 font-mono font-bold">
                    <output aria-label="選択中の置換対象色">
                      {selectedColor ?? imageUiText.colorPicker.unselected}
                    </output>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>
                    <label htmlFor="replacement-color">
                      {imageUiText.colorPicker.replacementLabel}
                    </label>
                  </dt>
                  <dd className="m-0 flex items-center gap-2">
                    <input
                      id="replacement-color"
                      type="color"
                      value={replacementColor}
                      onChange={(event) => setReplacementColor(event.currentTarget.value)}
                      aria-label={imageUiText.colorPicker.replacementLabel}
                    />
                    <output aria-label="置換後の色コード" className="font-mono font-bold">
                      {replacementColor}
                    </output>
                  </dd>
                </div>
              </dl>
            </section>
          )}
          {errorMessage && (
            <p className="mt-4 mb-0 text-[0.9rem] leading-[1.7] text-[#b3261e]" role="alert">
              {errorMessage}
            </p>
          )}
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
              {isLoading
                ? imageUiText.status.loading
                : isImageLoaded
                  ? imageUiText.status.loaded
                  : imageUiText.status.empty}
            </span>
          </div>
          <div
            className="grid min-h-[320px] flex-1 place-items-center overflow-auto rounded-xl border border-dashed border-[#cdbfad] bg-[repeating-conic-gradient(#faf6ee_0%_25%,#f3ede3_0%_50%)] text-center text-[#84796d] [background-size:1.5rem_1.5rem] max-[640px]:min-h-[260px]"
            role="region"
            aria-label="画像をドロップするCanvas領域"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              void handleFile(event.dataTransfer.files[0]);
            }}
          >
            {loadedImage ? (
              <canvas
                ref={canvasRef}
                className="max-h-full max-w-full object-contain"
                role="img"
                aria-label={`${loadedImage.name}の画像`}
                onClick={handleCanvasClick}
              />
            ) : (
              <span>{isLoading ? imageUiText.status.loadingCanvas : imageUiText.canvas.empty}</span>
            )}
          </div>
          {loadedImage && (
            <p className="mt-3 mb-0 text-[0.9rem] text-[#6e675e]" role="status">
              {loadedImage.name}（{loadedImage.width} × {loadedImage.height}px）
            </p>
          )}
          {notice && (
            <p className="mt-3 mb-0 text-[0.9rem] text-[#6e675e]" role="status" aria-live="polite">
              {notice}
            </p>
          )}
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
