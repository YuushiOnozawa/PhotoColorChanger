import type { ChangeEvent } from "react";
import type { PreviewMode } from "../app/previewRenderer";
import { imageUiText } from "../app/uiText";

interface ToolsPanelProps {
  errorMessage: string | null;
  isImageLoaded: boolean;
  isLoading: boolean;
  onFileSelect: (file: File | undefined) => void;
  onLineThresholdChange: (threshold: number) => void;
  onPreviewModeChange: (mode: PreviewMode) => void;
  onReplacementColorChange: (color: string) => void;
  onToleranceChange: (tolerance: number) => void;
  lineThreshold: number;
  previewMode: PreviewMode;
  replacementColor: string;
  selectedColor: string | null;
  tolerance: number;
}

function ToolsPanel({
  errorMessage,
  isImageLoaded,
  isLoading,
  onFileSelect,
  onLineThresholdChange,
  onPreviewModeChange,
  onReplacementColorChange,
  onToleranceChange,
  lineThreshold,
  previewMode,
  replacementColor,
  selectedColor,
  tolerance,
}: ToolsPanelProps) {
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    onFileSelect(file);
  };

  return (
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
        onChange={handleFileChange}
      />
      <p className="mt-3 mb-0 text-[0.9rem] leading-[1.7] text-[#6e675e]">
        JPEG、PNG、WebPを選択するか、Canvasへドロップしてください。
      </p>
      {isImageLoaded && (
        <>
          <section className="mt-6" aria-labelledby="preview-mode-title">
            <h3 id="preview-mode-title" className="mb-3 text-sm">
              {imageUiText.preview.title}
            </h3>
            <div
              className="grid grid-cols-2 gap-2"
              role="group"
              aria-label={imageUiText.preview.title}
            >
              {(["replacement", "lineArt"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={previewMode === mode}
                  className="rounded-lg border border-[#cdbfad] px-3 py-2 text-sm font-bold transition hover:bg-[#f4e2d5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9a5634] aria-pressed:bg-[#9a5634] aria-pressed:text-white"
                  onClick={() => onPreviewModeChange(mode)}
                >
                  {mode === "lineArt"
                    ? imageUiText.preview.lineArt
                    : imageUiText.preview.replacement}
                </button>
              ))}
            </div>
            {previewMode === "lineArt" && (
              <div className="mt-3 flex items-center justify-between gap-3">
                <label htmlFor="line-threshold">{imageUiText.preview.thresholdLabel}</label>
                <div className="flex items-center gap-2">
                  <input
                    id="line-threshold"
                    type="range"
                    min="1"
                    max="100"
                    step="1"
                    value={lineThreshold}
                    onChange={(event) => onLineThresholdChange(Number(event.currentTarget.value))}
                    aria-label={imageUiText.preview.thresholdLabel}
                  />
                  <output
                    aria-label={`${imageUiText.preview.thresholdLabel}の値`}
                    className="font-mono font-bold"
                  >
                    {lineThreshold}
                    {imageUiText.preview.thresholdUnit}
                  </output>
                </div>
              </div>
            )}
          </section>
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
                  <output aria-label={imageUiText.colorPicker.selectedOutputLabel}>
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
                    onChange={(event) => onReplacementColorChange(event.currentTarget.value)}
                    aria-label={imageUiText.colorPicker.replacementLabel}
                  />
                  <output
                    aria-label={imageUiText.colorPicker.replacementOutputLabel}
                    className="font-mono font-bold"
                  >
                    {replacementColor}
                  </output>
                </dd>
              </div>
              {selectedColor && (
                <div className="flex items-center justify-between gap-3">
                  <dt>
                    <label htmlFor="color-tolerance">
                      {imageUiText.colorReplacement.toleranceLabel}
                    </label>
                  </dt>
                  <dd className="m-0 flex items-center gap-2">
                    <input
                      id="color-tolerance"
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={tolerance}
                      onChange={(event) => onToleranceChange(Number(event.currentTarget.value))}
                      aria-label={imageUiText.colorReplacement.toleranceLabel}
                    />
                    <output
                      aria-label={`${imageUiText.colorReplacement.toleranceLabel}の値`}
                      className="font-mono font-bold"
                    >
                      {tolerance}
                      {imageUiText.colorReplacement.toleranceUnit}
                    </output>
                  </dd>
                </div>
              )}
            </dl>
          </section>
        </>
      )}
      {errorMessage && (
        <p className="mt-4 mb-0 text-[0.9rem] leading-[1.7] text-[#b3261e]" role="alert">
          {errorMessage}
        </p>
      )}
    </aside>
  );
}

export default ToolsPanel;
