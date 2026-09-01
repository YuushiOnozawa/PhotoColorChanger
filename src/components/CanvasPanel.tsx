import { useEffect, type MouseEvent, type RefObject } from "react";
import { hexToRgb } from "../app/color";
import { replaceSimilarColors } from "../app/colorReplacement";
import type { LoadedImage } from "../app/imageLoader";
import { imageUiText } from "../app/uiText";

interface CanvasPanelProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  isImageLoaded: boolean;
  isLoading: boolean;
  loadedImage: LoadedImage | null;
  notice: string | null;
  onCanvasClick: (event: MouseEvent<HTMLCanvasElement>) => void;
  onFileSelect: (file: File | undefined) => void;
  replacementColor: string;
  selectedColor: string | null;
  tolerance: number;
}

function CanvasPanel({
  canvasRef,
  isImageLoaded,
  isLoading,
  loadedImage,
  notice,
  onCanvasClick,
  onFileSelect,
  replacementColor,
  selectedColor,
  tolerance,
}: CanvasPanelProps) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !loadedImage) return;

    canvas.width = loadedImage.width;
    canvas.height = loadedImage.height;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.drawImage(loadedImage.source, 0, 0, loadedImage.width, loadedImage.height);

    const target = selectedColor ? hexToRgb(selectedColor) : null;
    const replacement = hexToRgb(replacementColor);
    if (!target || !replacement) return;

    const imageData = context.getImageData(0, 0, loadedImage.width, loadedImage.height);
    imageData.data.set(replaceSimilarColors(imageData.data, target, replacement, tolerance));
    context.putImageData(imageData, 0, 0);
  }, [canvasRef, loadedImage, replacementColor, selectedColor, tolerance]);

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
            onClick={onCanvasClick}
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
