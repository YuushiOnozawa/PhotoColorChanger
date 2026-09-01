import { useRef, useState, type MouseEvent } from "react";
import { ImageLoadError, loadImageFile, type LoadedImage } from "./app/imageLoader";
import { initialAppState } from "./app/appState";
import { imageUiText } from "./app/uiText";
import { rgbToHex } from "./app/color";
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
  const [replacementColor, setReplacementColor] = useState("#ffffff");
  const [tolerance, setTolerance] = useState(0);
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
      setTolerance(0);
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
          onCanvasClick={handleCanvasClick}
          onFileSelect={(file) => void handleFile(file)}
          replacementColor={replacementColor}
          selectedColor={selectedColor}
          tolerance={tolerance}
        />
        <HistoryPanel />
      </div>
    </main>
  );
}

export default App;
