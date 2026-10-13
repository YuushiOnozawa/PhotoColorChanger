import { connectedRegionFromSeed } from "./boundaryMethods";
import type { ImageLike, ImagePoint } from "./types";

const GC_BGD = 0;
const GC_FGD = 1;
const GC_PR_BGD = 2;
const GC_PR_FGD = 3;
const SEED_RADIUS = 4;

export type GrabCutImageBounds = {
  x: number;
  y: number;
  imageWidth: number;
  imageHeight: number;
};

function getGrabCutLabel(
  withinSeedRadius: boolean,
  onImageBorder: boolean,
  onRoiBorder: boolean,
  isConnectedHsvCandidate: boolean,
): number {
  if (withinSeedRadius) return GC_FGD;
  if (onImageBorder) return GC_BGD;
  if (!onRoiBorder && isConnectedHsvCandidate) return GC_PR_FGD;
  return GC_PR_BGD;
}

export function createGrabCutInitializationMask(
  image: ImageLike,
  hsvMask: Uint8Array,
  seed: ImagePoint,
  radius = SEED_RADIUS,
  imageBounds: GrabCutImageBounds = {
    x: 0,
    y: 0,
    imageWidth: image.width,
    imageHeight: image.height,
  },
): Uint8Array {
  const { width, height } = image;
  const result = new Uint8Array(width * height);
  if (width === 0 || height === 0) return result;

  const seedX = Math.max(0, Math.min(width - 1, Math.floor(seed[0])));
  const seedY = Math.max(0, Math.min(height - 1, Math.floor(seed[1])));
  const connectedHsvMask = connectedRegionFromSeed(
    hsvMask,
    new Uint8Array(width * height),
    width,
    height,
    [seedX, seedY],
  );
  result.fill(GC_PR_BGD);
  const radiusSquared = radius * radius;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      const seedDx = x - seedX;
      const seedDy = y - seedY;
      const withinSeedRadius = seedDx * seedDx + seedDy * seedDy <= radiusSquared;
      const onImageBorder =
        imageBounds.x + x === 0 ||
        imageBounds.y + y === 0 ||
        imageBounds.x + x === imageBounds.imageWidth - 1 ||
        imageBounds.y + y === imageBounds.imageHeight - 1;
      const onRoiBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;

      result[pixel] = getGrabCutLabel(
        withinSeedRadius,
        onImageBorder,
        onRoiBorder,
        connectedHsvMask[pixel] === 1,
      );
    }
  }

  return result;
}
