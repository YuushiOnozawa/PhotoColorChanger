export const MAX_IMAGE_EDGE = 4096;

const supportedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export type ImageLoadErrorKind = "unsupported" | "invalid";

export class ImageLoadError extends Error {
  constructor(readonly kind: ImageLoadErrorKind) {
    super(kind);
    this.name = "ImageLoadError";
  }
}

export interface ImageDimensions {
  width: number;
  height: number;
  wasResized: boolean;
}

export interface LoadedImage extends ImageDimensions {
  name: string;
  source: CanvasImageSource;
}

export function fitImageDimensions(
  width: number,
  height: number,
  maxEdge = MAX_IMAGE_EDGE,
): ImageDimensions {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxEdge) return { width, height, wasResized: false };

  const scale = maxEdge / longEdge;
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
    wasResized: true,
  };
}

function decodeImage(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file);

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new ImageLoadError("invalid"));
    };
    image.src = objectUrl;
  });
}

export async function loadImageFile(file: File): Promise<LoadedImage> {
  if (!supportedImageTypes.has(file.type.toLowerCase())) {
    throw new ImageLoadError("unsupported");
  }

  const image = await decodeImage(file);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (width <= 0 || height <= 0) throw new ImageLoadError("invalid");

  const dimensions = fitImageDimensions(width, height);
  if (!dimensions.wasResized) {
    return { ...dimensions, name: file.name || "画像", source: image };
  }

  const resizedCanvas = document.createElement("canvas");
  resizedCanvas.width = dimensions.width;
  resizedCanvas.height = dimensions.height;
  const context = resizedCanvas.getContext("2d");
  if (!context) throw new ImageLoadError("invalid");
  context.drawImage(image, 0, 0, dimensions.width, dimensions.height);

  return { ...dimensions, name: file.name || "画像", source: resizedCanvas };
}
