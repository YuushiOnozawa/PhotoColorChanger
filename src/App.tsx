import { useRef, useState } from "react";
import type { ImagePoint } from "./app/colorReplacement";
import { ImageLoadError, loadImageFile, type LoadedImage } from "./app/imageLoader";
import { initialAppState } from "./app/appState";
import {
  DEFAULT_BINARY_THRESHOLD,
  DEFAULT_COLOR_EDGE_WEIGHT,
  DEFAULT_SHADOW_LINE_THRESHOLD,
  type LineArtMethod,
} from "./app/lineArt";
import type { PreviewMode } from "./app/previewRenderer";
import { imageUiText } from "./app/uiText";
import AppHeader from "./components/AppHeader";
import CanvasPanel from "./components/CanvasPanel";
import HistoryPanel from "./components/HistoryPanel";
import ToolsPanel from "./components/ToolsPanel";
import "./styles.css";

function App() {
  const [appState, setAppState] = useState(initialAppState);
  const [loadedImage, setLoadedImage] = useState<LoadedImage | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<ImagePoint | null>(null);
  const [replacementColor, setReplacementColor] = useState("#ffffff");
  const [tolerance, setTolerance] = useState(0);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("replacement");
  const [replacementMethod, setReplacementMethod] = useState<LineArtMethod>("sobel");
  const [lineThreshold, setLineThreshold] = useState(20);
  const [binaryThreshold, setBinaryThreshold] = useState(DEFAULT_BINARY_THRESHOLD);
  const [shadowLineThreshold, setShadowLineThreshold] = useState(DEFAULT_SHADOW_LINE_THRESHOLD);
  const [xdogThreshold, setXdogThreshold] = useState(20);
  const [colorEdgeWeight, setColorEdgeWeight] = useState(DEFAULT_COLOR_EDGE_WEIGHT);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;

    setErrorMessage(null);
    setNotice(null);
    setIsLoading(true);

    try {
      const nextImage = await loadImageFile(file);
      setLoadedImage(nextImage);
      setSelectedColor(null);
      setSelectedPoint(null);
      setTolerance(0);
      setPreviewMode("replacement");
      setReplacementMethod("sobel");
      setLineThreshold(20);
      setBinaryThreshold(DEFAULT_BINARY_THRESHOLD);
      setShadowLineThreshold(DEFAULT_SHADOW_LINE_THRESHOLD);
      setXdogThreshold(20);
      setColorEdgeWeight(DEFAULT_COLOR_EDGE_WEIGHT);
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

  const handleColorPick = (color: string, point: ImagePoint) => {
    setSelectedColor(color);
    setSelectedPoint(point);
  };

  const isImageLoaded = appState.imageSessionStatus === "loaded";

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1440px] p-[clamp(1.25rem,3vw,3rem)] max-[640px]:p-4">
      <AppHeader />

      <div
        className="grid grid-cols-[minmax(180px,0.8fr)_minmax(320px,2fr)_minmax(180px,0.8fr)] items-stretch gap-4 max-[900px]:grid-cols-[1fr_1.7fr] max-[640px]:grid-cols-1"
        aria-label="編集ワークスペース"
      >
        <ToolsPanel
          errorMessage={errorMessage}
          isImageLoaded={isImageLoaded}
          isLoading={isLoading}
          onFileSelect={(file) => void handleFile(file)}
          onReplacementColorChange={setReplacementColor}
          onToleranceChange={setTolerance}
          onPreviewModeChange={setPreviewMode}
          onReplacementMethodChange={setReplacementMethod}
          onLineThresholdChange={setLineThreshold}
          onBinaryThresholdChange={setBinaryThreshold}
          onShadowLineThresholdChange={setShadowLineThreshold}
          onXdogThresholdChange={setXdogThreshold}
          onColorEdgeWeightChange={setColorEdgeWeight}
          previewMode={previewMode}
          replacementMethod={replacementMethod}
          lineThreshold={lineThreshold}
          binaryThreshold={binaryThreshold}
          shadowLineThreshold={shadowLineThreshold}
          xdogThreshold={xdogThreshold}
          colorEdgeWeight={colorEdgeWeight}
          replacementColor={replacementColor}
          selectedColor={selectedColor}
          tolerance={tolerance}
        />
        <CanvasPanel
          canvasRef={canvasRef}
          isImageLoaded={isImageLoaded}
          isLoading={isLoading}
          loadedImage={loadedImage}
          notice={notice}
          onColorPick={handleColorPick}
          onFileSelect={(file) => void handleFile(file)}
          previewMode={previewMode}
          replacementMethod={replacementMethod}
          replacementColor={replacementColor}
          selectedColor={selectedColor}
          targetPoint={selectedPoint}
          tolerance={tolerance}
          lineThreshold={lineThreshold}
          binaryThreshold={binaryThreshold}
          shadowLineThreshold={shadowLineThreshold}
          xdogThreshold={xdogThreshold}
          colorEdgeWeight={colorEdgeWeight}
        />
        <HistoryPanel />
      </div>
    </main>
  );
}

export default App;
