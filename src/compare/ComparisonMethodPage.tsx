import { useEffect, useRef, useState, type MouseEvent } from "react";
import { hexToRgb } from "../app/color";
import { ImageLoadError, loadImageFile } from "../app/imageLoader";
import { processComparisonMethod } from "./algorithms";
import { METHODS } from "./registry";
import { createSyntheticImage } from "./syntheticImage";
import type { ComparisonMethod, ImageLike, ImagePoint, RgbColor } from "./types";

const DEFAULT_REPLACEMENT = "#2f6fdb";

function drawImage(canvas: HTMLCanvasElement, image: ImageLike) {
  if (canvas.width !== image.width) canvas.width = image.width;
  if (canvas.height !== image.height) canvas.height = image.height;
  const context = canvas.getContext("2d");
  if (!context) return;
  const pixels = context.createImageData(image.width, image.height);
  pixels.data.set(image.data);
  context.putImageData(pixels, 0, 0);
}

function readLoadedPixels(source: CanvasImageSource, width: number, height: number): ImageLike {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("画像を読み込めませんでした。");
  context.drawImage(source, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height);
  return { width, height, data: pixels.data };
}

function colorFromHex(hex: string): RgbColor {
  return hexToRgb(hex) ?? [47, 111, 219];
}

function ComparisonMethodPage({ method }: { method: ComparisonMethod }) {
  const inputCanvasRef = useRef<HTMLCanvasElement>(null);
  const outputCanvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<ImageLike | null>(null);
  const [groundTruthMask, setGroundTruthMask] = useState<Uint8Array | null>(null);
  const [seed, setSeed] = useState<ImagePoint>([0, 0]);
  const [replacementColor, setReplacementColor] = useState(DEFAULT_REPLACEMENT);
  const [tolerance, setTolerance] = useState(method.defaultTolerance);
  const [imageName, setImageName] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const methodIndex = METHODS.findIndex((item) => item.id === method.id);

  useEffect(() => {
    setTolerance(method.defaultTolerance);
  }, [method.defaultTolerance, method.id]);

  useEffect(() => {
    if (!image || !inputCanvasRef.current || !outputCanvasRef.current) return;
    drawImage(inputCanvasRef.current, image);
    const result = processComparisonMethod({
      image,
      methodId: method.id,
      seed,
      replacement: colorFromHex(replacementColor),
      tolerance,
      fixedMask: groundTruthMask,
    });
    drawImage(outputCanvasRef.current, result);
  }, [groundTruthMask, image, method.id, replacementColor, seed, tolerance]);

  const loadSynthetic = () => {
    const synthetic = createSyntheticImage();
    setImage(synthetic.image);
    setGroundTruthMask(synthetic.groundTruthMask);
    setSeed(synthetic.seed);
    setImageName("合成画像");
    setNotice(null);
    setError(null);
  };

  const loadUploadedFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);

    try {
      const loaded = await loadImageFile(file);
      const pixels = readLoadedPixels(loaded.source, loaded.width, loaded.height);
      setImage(pixels);
      setGroundTruthMask(null);
      setSeed([Math.floor(loaded.width / 2), Math.floor(loaded.height / 2)]);
      setImageName(loaded.name);
      const messages = [];
      if (loaded.wasResized) messages.push("大きな画像を縮小して読み込みました。");
      setNotice(messages.length ? messages.join(" ") : null);
    } catch (loadError) {
      setError(
        loadError instanceof ImageLoadError && loadError.kind === "unsupported"
          ? "JPEG、PNG、WebP画像を選択してください。"
          : "画像を読み込めませんでした。",
      );
    }
  };

  const selectSeed = (event: MouseEvent<HTMLCanvasElement>) => {
    if (!image) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) return;
    const x = Math.floor(((event.clientX - bounds.left) / bounds.width) * image.width);
    const y = Math.floor(((event.clientY - bounds.top) / bounds.height) * image.height);
    setSeed([
      Math.max(0, Math.min(image.width - 1, x)),
      Math.max(0, Math.min(image.height - 1, y)),
    ]);
  };

  const displayedTolerance = Number.isInteger(tolerance) ? tolerance : tolerance.toFixed(1);
  const showUploadedMaskNotice =
    method.axis === "recolor" && image !== null && groundTruthMask === null;

  return (
    <main
      className="mx-auto min-h-screen w-full max-w-6xl p-[clamp(1.25rem,3vw,3rem)] text-[#28241f]"
      data-testid={"compare-method-" + method.id}
    >
      <header className="mb-6">
        <a
          className="mb-4 inline-block text-sm font-semibold text-[#8a482a] underline underline-offset-4"
          data-testid="compare-back"
          href="#/compare"
        >
          ← 手法一覧へ
        </a>
        <p className="mb-2 text-sm font-bold tracking-[0.12em] text-[#9a5634] uppercase">
          {method.axisTitle}
        </p>
        <h1 className="mb-2 text-3xl font-bold">{method.title}</h1>
        <p className="text-[#6e675e]">{method.description}</p>
      </header>

      <nav className="mb-6 flex flex-wrap items-center gap-3" aria-label="手法ナビゲーション">
        {methodIndex > 0 && (
          <a
            className="rounded-lg border border-[#d8cfc2] bg-white px-4 py-2 text-sm font-semibold"
            data-testid="compare-prev"
            href={"#/compare/" + METHODS[methodIndex - 1].id}
          >
            ← 前の手法
          </a>
        )}
        {methodIndex + 1 < METHODS.length && (
          <a
            className="rounded-lg border border-[#d8cfc2] bg-white px-4 py-2 text-sm font-semibold"
            data-testid="compare-next"
            href={"#/compare/" + METHODS[methodIndex + 1].id}
          >
            次の手法 →
          </a>
        )}
        <a className="ml-auto text-sm text-[#6e675e] underline" href="#/compare">
          比較一覧
        </a>
      </nav>

      <section className="mb-6 rounded-2xl border border-[#ded6c9] bg-white p-5">
        <h2 className="mb-4 text-lg font-bold">画像と設定</h2>
        <div className="flex flex-wrap items-end gap-5">
          <label className="grid gap-2 text-sm font-semibold">
            画像をアップロード
            <input
              accept="image/jpeg,image/png,image/webp"
              className="max-w-full text-sm"
              data-testid="compare-upload"
              onChange={(event) => {
                void loadUploadedFile(event.currentTarget.files?.[0]);
                event.currentTarget.value = "";
              }}
              type="file"
            />
          </label>
          <button
            className="rounded-lg bg-[#8a482a] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#713b24]"
            data-testid="compare-load-synthetic"
            onClick={loadSynthetic}
            type="button"
          >
            合成画像を読み込む
          </button>
          <label className="grid gap-2 text-sm font-semibold">
            置換色
            <input
              aria-label="置換色"
              className="h-10 w-16 cursor-pointer rounded border border-[#d8cfc2]"
              onChange={(event) => setReplacementColor(event.target.value)}
              type="color"
              value={replacementColor}
            />
          </label>
          <label className="grid min-w-56 flex-1 gap-2 text-sm font-semibold">
            <span>
              許容差（{method.toleranceUnit}）: {displayedTolerance}
            </span>
            <input
              aria-label={"許容差（" + method.toleranceUnit + "）"}
              max={method.toleranceMax}
              min={0}
              onChange={(event) => setTolerance(Number(event.target.value))}
              step={method.toleranceUnit === "ΔE" ? 0.5 : 1}
              type="range"
              value={tolerance}
            />
          </label>
        </div>

        <div
          className="mt-5 grid gap-2 rounded-xl bg-[#f7f4ef] p-4 text-sm"
          data-testid="compare-params"
        >
          <p className="font-bold">比較条件</p>
          <ul className="grid gap-1 text-[#514a42]">
            {method.params.map((param) => (
              <li key={param}>{param}</li>
            ))}
            <li>
              許容差: {displayedTolerance} {method.toleranceUnit}
            </li>
            <li>基準色: クリック位置の9×9近傍RGB中央値</li>
            <li>置換色: {replacementColor.toUpperCase()}</li>
          </ul>
        </div>
        {notice && <p className="mt-4 text-sm text-[#6e675e]">{notice}</p>}
        {showUploadedMaskNotice && (
          <p className="mt-4 text-sm text-[#6e675e]">
            アップロード画像ではHSVマスクを固定マスクとして使用しています。
          </p>
        )}
        {error && (
          <p className="mt-4 text-sm font-semibold text-red-700" role="alert">
            {error}
          </p>
        )}
        {imageName && <p className="mt-3 text-sm text-[#6e675e]">読み込み中の画像: {imageName}</p>}
        <p className="mt-2 text-xs text-[#81796f]">画像処理はブラウザ内で行います。</p>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <div className="min-w-0 rounded-2xl border border-[#ded6c9] bg-white p-4">
          <h2 className="mb-3 font-bold">入力（画像上をクリックして基準点を選択）</h2>
          <canvas
            aria-label="入力画像。クリックして基準点を選択"
            className="block h-auto max-h-[520px] max-w-full cursor-crosshair border border-[#e8e1d7] object-contain"
            data-testid="compare-input"
            onClick={selectSeed}
            ref={inputCanvasRef}
          />
        </div>
        <div className="min-w-0 rounded-2xl border border-[#ded6c9] bg-white p-4">
          <h2 className="mb-3 font-bold">出力</h2>
          <canvas
            aria-label="処理結果"
            className="block h-auto max-h-[520px] max-w-full border border-[#e8e1d7] object-contain"
            data-testid="compare-output"
            ref={outputCanvasRef}
          />
        </div>
      </section>
    </main>
  );
}

export default ComparisonMethodPage;
