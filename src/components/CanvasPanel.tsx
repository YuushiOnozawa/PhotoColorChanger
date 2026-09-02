import { useEffect, useRef, type MouseEvent, type RefObject } from "react";
import { hexToRgb, rgbToHex } from "../app/color";
import type { ImagePoint } from "../app/colorReplacement";
import { fitImageDimensions, type LoadedImage } from "../app/imageLoader";
import {
  createPreviewRenderer,
  getPreviewMaxEdge,
  replacementColorFromHex,
  type PreviewMode,
  type PreviewRenderer,
} from "../app/previewRenderer";
import { imageUiText } from "../app/uiText";

interface CanvasPanelProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  isImageLoaded: boolean;
  isLoading: boolean;
  loadedImage: LoadedImage | null;
  notice: string | null;
  onColorPick: (color: string, point: ImagePoint) => void;
  onFileSelect: (file: File | undefined) => void;
  previewMode: PreviewMode;
  replacementColor: string;
  selectedColor: string | null;
  targetPoint: ImagePoint | null;
  tolerance: number;
  lineThreshold: number;
}

function CanvasPanel({
  canvasRef,
  isImageLoaded,
  isLoading,
  loadedImage,
  notice,
  onColorPick,
  onFileSelect,
  previewMode,
  replacementColor,
  selectedColor,
  targetPoint,
  tolerance,
  lineThreshold,
}: CanvasPanelProps) {
  const rendererRef = useRef<PreviewRenderer | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !loadedImage) return;

    const dimensions = fitImageDimensions(
      loadedImage.width,
      loadedImage.height,
      getPreviewMaxEdge(window.innerWidth),
    );
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const renderer = createPreviewRenderer(canvas, getPreviewMaxEdge(window.innerWidth));
    rendererRef.current = renderer;
    canvas.dataset.renderer = renderer.kind;

    return () => {
      renderer.dispose();
      rendererRef.current = null;
      delete canvas.dataset.renderer;
    };
  }, [canvasRef, loadedImage]);

  useEffect(() => {
    if (!loadedImage || !rendererRef.current) return;

    rendererRef.current.render({
      source: loadedImage.source,
      width: loadedImage.width,
      height: loadedImage.height,
      targetColor: selectedColor ? hexToRgb(selectedColor) : null,
      replacementColor: replacementColorFromHex(replacementColor),
      tolerance,
      mode: previewMode,
      lineThreshold,
      targetPoint,
    });
  }, [
    loadedImage,
    lineThreshold,
    previewMode,
    replacementColor,
    selectedColor,
    targetPoint,
    tolerance,
  ]);

  const handleCanvasClick = (event: MouseEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const x = Math.min(
      canvas.width - 1,
      Math.max(0, Math.floor(((event.clientX - rect.left) / rect.width) * canvas.width)),
    );
    const y = Math.min(
      canvas.height - 1,
      Math.max(0, Math.floor(((event.clientY - rect.top) / rect.height) * canvas.height)),
    );
    const color = rendererRef.current?.pick(x, y);
    if (color) onColorPick(rgbToHex(...color), [x, y]);
  };

  return (
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
          onFileSelect(event.dataTransfer.files[0]);
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
  );
}

export default CanvasPanel;
