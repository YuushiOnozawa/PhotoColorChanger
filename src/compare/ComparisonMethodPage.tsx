import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { hexToRgb } from "../app/color";
import { fitImageDimensions, ImageLoadError, loadImageFile } from "../app/imageLoader";
import { processComparisonMethod } from "./algorithms";
import { EXAMPLE_IMAGES } from "./exampleImages";
import { METHODS } from "./registry";
import { createSyntheticImage } from "./syntheticImage";
import type { GrabCutProcessingStatus } from "./grabcutWorkerClient";
import type { ComparisonMethod, ImageLike, ImagePoint, RgbColor } from "./types";

const DEFAULT_REPLACEMENT = "#2f6fdb";
const EXAMPLE_MAX_EDGE = 1024;
const EXAMPLE_CANVAS_MAX_EDGE = 512;

type ExampleSample = {
  name: string;
  image: ImageLike;
  seed: ImagePoint;
};

function drawImage(canvas: HTMLCanvasElement, image: ImageLike, maxEdge?: number) {
  const dimensions =
    maxEdge === undefined ? image : fitImageDimensions(image.width, image.height, maxEdge);
  if (canvas.width !== dimensions.width) canvas.width = dimensions.width;
  if (canvas.height !== dimensions.height) canvas.height = dimensions.height;
  const context = canvas.getContext("2d");
  if (!context) return;

  if (dimensions.width === image.width && dimensions.height === image.height) {
    const pixels = context.createImageData(image.width, image.height);
    pixels.data.set(image.data);
    context.putImageData(pixels, 0, 0);
    return;
  }

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = image.width;
  sourceCanvas.height = image.height;
  const sourceContext = sourceCanvas.getContext("2d");
  if (!sourceContext) return;
  const pixels = sourceContext.createImageData(image.width, image.height);
  pixels.data.set(image.data);
  sourceContext.putImageData(pixels, 0, 0);
  context.drawImage(sourceCanvas, 0, 0, dimensions.width, dimensions.height);
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

function loadImageUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("画像を読み込めませんでした。"));
    image.src = url;
  });
}

function ProcessingOutput({
  busy,
  label,
  children,
}: {
  busy: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="relative w-fit max-w-full" data-processing={busy ? "true" : undefined}>
      {children}
      {busy && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-white/75 text-sm font-semibold text-[#6e675e]"
          role="status"
        >
          {label}
        </div>
      )}
    </div>
  );
}

function isGrabCutMethod(methodId: string): boolean {
  return methodId === "mask-grabcut" || methodId === "mask-grabcut-fast";
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<GrabCutProcessingStatus | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const processingStartedAt = useRef(0);
  const [exampleSamples, setExampleSamples] = useState<ExampleSample[]>([]);
  const exampleInputCanvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const exampleOutputCanvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const methodIndex = METHODS.findIndex((item) => item.id === method.id);

  useEffect(() => {
    setTolerance(method.defaultTolerance);
  }, [method.defaultTolerance, method.id]);

  useEffect(() => {
    if (!isProcessing) return;
    const timer = window.setInterval(
      () => setElapsedSeconds((performance.now() - processingStartedAt.current) / 1000),
      100,
    );
    return () => window.clearInterval(timer);
  }, [isProcessing]);

  useEffect(() => {
    let stale = false;
    const processImages = async () => {
      setIsProcessing(false);
      if (!image && exampleSamples.length === 0) return;

      setError(null);
      const usesGrabCut = isGrabCutMethod(method.id);
      setIsProcessing(usesGrabCut);
      setProcessingStatus(null);
      if (usesGrabCut) {
        processingStartedAt.current = performance.now();
        setElapsedSeconds(0);
      }
      const replacement = colorFromHex(replacementColor);
      if (image && inputCanvasRef.current && outputCanvasRef.current) {
        drawImage(inputCanvasRef.current, image);
        const output = outputCanvasRef.current;
        output.width = image.width;
        output.height = image.height;
        output.getContext("2d")?.clearRect(0, 0, output.width, output.height);
        const result = await processComparisonMethod({
          image,
          methodId: method.id,
          seed,
          replacement,
          tolerance,
          fixedMask: groundTruthMask,
          onWorkerStatus: (status) => {
            if (!stale) setProcessingStatus(status);
          },
        });
        if (stale) return;
        drawImage(output, result);
      }

      for (const sample of exampleSamples) {
        if (stale) return;
        const inputCanvas = exampleInputCanvasRefs.current[sample.name];
        const outputCanvas = exampleOutputCanvasRefs.current[sample.name];
        if (!inputCanvas || !outputCanvas) continue;

        drawImage(inputCanvas, sample.image, EXAMPLE_CANVAS_MAX_EDGE);
        drawImage(outputCanvas, sample.image, EXAMPLE_CANVAS_MAX_EDGE);
        const result = await processComparisonMethod({
          image: sample.image,
          methodId: method.id,
          seed: sample.seed,
          replacement,
          tolerance,
          fixedMask: null,
          onWorkerStatus: (status) => {
            if (!stale) setProcessingStatus(status);
          },
        });
        if (stale) return;
        drawImage(outputCanvas, result, EXAMPLE_CANVAS_MAX_EDGE);
      }
    };

    void processImages()
      .catch(() => {
        if (stale) return;
        setError(
          isGrabCutMethod(method.id)
            ? "OpenCVの読み込みまたはGrabCut処理に失敗しました。"
            : "画像を処理できませんでした。",
        );
      })
      .finally(() => {
        if (!stale) {
          setIsProcessing(false);
          setProcessingStatus(null);
        }
      });

    return () => {
      stale = true;
    };
  }, [exampleSamples, groundTruthMask, image, method.id, replacementColor, seed, tolerance]);

  const loadSynthetic = () => {
    const synthetic = createSyntheticImage();
    setImage(synthetic.image);
    setGroundTruthMask(synthetic.groundTruthMask);
    setSeed(synthetic.seed);
    setImageName("合成画像");
    setNotice(null);
    setError(null);
  };

  const loadExamples = async () => {
    setError(null);

    try {
      const loadedExamples = await Promise.all(
        EXAMPLE_IMAGES.map(async ({ name, url, seed: sourceSeed }) => {
          const source = await loadImageUrl(url);
          const sourceWidth = source.naturalWidth || source.width;
          const sourceHeight = source.naturalHeight || source.height;
          if (!sourceWidth || !sourceHeight) throw new Error("画像を読み込めませんでした。");

          const dimensions = fitImageDimensions(sourceWidth, sourceHeight, EXAMPLE_MAX_EDGE);
          return {
            name,
            image: readLoadedPixels(source, dimensions.width, dimensions.height),
            seed: [
              Math.floor((sourceSeed[0] * dimensions.width) / sourceWidth),
              Math.floor((sourceSeed[1] * dimensions.height) / sourceHeight),
            ] as ImagePoint,
          };
        }),
      );
      setExampleSamples(loadedExamples);
    } catch {
      setError("実物サンプルを読み込めませんでした。");
    }
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

  const selectExampleSeed = (sample: ExampleSample, event: MouseEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) return;
    const x = Math.floor(((event.clientX - bounds.left) / bounds.width) * sample.image.width);
    const y = Math.floor(((event.clientY - bounds.top) / bounds.height) * sample.image.height);
    const seed: ImagePoint = [
      Math.max(0, Math.min(sample.image.width - 1, x)),
      Math.max(0, Math.min(sample.image.height - 1, y)),
    ];
    setExampleSamples((current) =>
      current.map((item) => (item.name === sample.name ? { ...item, seed } : item)),
    );
  };

  const displayedTolerance = Number.isInteger(tolerance) ? tolerance : tolerance.toFixed(1);
  const processingLabel =
    processingStatus === "initializing" ? "OpenCV準備中…" : "処理中… " + elapsedSeconds.toFixed(1) + "秒";
  const showUploadedMaskNotice =
    method.axis === "recolor" && image !== null && groundTruthMask === null;
  const showExampleMaskNotice = method.axis === "recolor" && exampleSamples.length > 0;

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
          <button
            className="rounded-lg bg-[#8a482a] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#713b24]"
            data-testid="compare-load-examples"
            onClick={() => void loadExamples()}
            type="button"
          >
            実物サンプル（sample1・sample2）を読み込む
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
        {showExampleMaskNotice && (
          <p className="mt-4 text-sm text-[#6e675e]">
            実物サンプルではHSVマスクを固定マスクとして使用しています。
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
          <ProcessingOutput busy={isProcessing} label={processingLabel}>
            <canvas
              aria-label="処理結果"
              className="block h-auto max-h-[520px] max-w-full border border-[#e8e1d7] object-contain"
              data-testid="compare-output"
              ref={outputCanvasRef}
            />
          </ProcessingOutput>
        </div>
      </section>

      {exampleSamples.length > 0 && (
        <section className="mt-6 grid gap-5 md:grid-cols-2">
          {exampleSamples.map((sample) => (
            <div
              className="min-w-0 rounded-2xl border border-[#ded6c9] bg-white p-4"
              data-testid={`compare-example-${sample.name}`}
              key={sample.name}
            >
              <h2 className="mb-1 font-bold">実物サンプル（{sample.name}）</h2>
              <p
                className="mb-3 text-sm text-[#6e675e]"
                data-testid={`compare-example-${sample.name}-seed`}
              >
                基準点（処理画像）: ({sample.seed[0]}, {sample.seed[1]})
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <p className="mb-2 text-sm font-semibold">入力</p>
                  <canvas
                    aria-label={`${sample.name} 入力画像。クリックして基準点を選択`}
                    className="block h-auto max-h-[520px] max-w-full cursor-crosshair border border-[#e8e1d7] object-contain"
                    data-testid={`compare-example-${sample.name}-input`}
                    onClick={(event) => selectExampleSeed(sample, event)}
                    ref={(canvas) => {
                      exampleInputCanvasRefs.current[sample.name] = canvas;
                    }}
                  />
                </div>
                <div className="min-w-0">
                  <p className="mb-2 text-sm font-semibold">出力</p>
                  <ProcessingOutput busy={isProcessing} label={processingLabel}>
                    <canvas
                      aria-label={sample.name + " 処理結果"}
                      className="block h-auto max-h-[520px] max-w-full border border-[#e8e1d7] object-contain"
                      data-testid={"compare-example-" + sample.name + "-output"}
                      ref={(canvas) => {
                        exampleOutputCanvasRefs.current[sample.name] = canvas;
                      }}
                    />
                  </ProcessingOutput>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}

export default ComparisonMethodPage;
