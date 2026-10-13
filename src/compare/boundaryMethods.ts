import { createXdogSobelPixels } from "../app/lineArt";
import type { ImageLike, ImagePoint } from "./types";

export function connectedRegionFromSeed(
  candidateMask: Uint8Array,
  boundaryMask: Uint8Array,
  width: number,
  height: number,
  point: ImagePoint,
): Uint8Array {
  const result = new Uint8Array(width * height);
  const seedX = Math.max(0, Math.min(width - 1, Math.floor(point[0])));
  const seedY = Math.max(0, Math.min(height - 1, Math.floor(point[1])));
  const seed = seedY * width + seedX;
  if (width === 0 || height === 0 || candidateMask[seed] !== 1 || boundaryMask[seed] === 1) {
    return result;
  }

  const queue = new Int32Array(width * height);
  let start = 0;
  let end = 0;
  result[seed] = 1;
  queue[end] = seed;
  end += 1;

  while (start < end) {
    const current = queue[start];
    start += 1;
    const x = current % width;
    const y = Math.floor(current / width);
    const neighbors = [
      x > 0 ? current - 1 : -1,
      x + 1 < width ? current + 1 : -1,
      y > 0 ? current - width : -1,
      y + 1 < height ? current + width : -1,
    ];

    for (const neighbor of neighbors) {
      if (
        neighbor < 0 ||
        result[neighbor] === 1 ||
        candidateMask[neighbor] !== 1 ||
        boundaryMask[neighbor] === 1
      ) {
        continue;
      }
      result[neighbor] = 1;
      queue[end] = neighbor;
      end += 1;
    }
  }

  return result;
}

export function createXdogSobelBoundaryMask(
  image: ImageLike,
  xdogThreshold = 20,
  sobelThreshold = 20,
): Uint8Array {
  const lineArt = createXdogSobelPixels(
    image.data,
    image.width,
    image.height,
    xdogThreshold,
    sobelThreshold,
  );
  const result = new Uint8Array(image.width * image.height);

  for (let pixel = 0; pixel < result.length; pixel += 1) {
    const index = pixel * 4;
    result[pixel] =
      lineArt[index + 3] !== 0 &&
      (lineArt[index] + lineArt[index + 1] + lineArt[index + 2]) / 3 < 128
        ? 1
        : 0;
  }

  return result;
}

export function createBoundaryConstrainedMask(
  image: ImageLike,
  candidateMask: Uint8Array,
  point: ImagePoint,
  xdogThreshold = 20,
  sobelThreshold = 20,
): Uint8Array {
  return connectedRegionFromSeed(
    candidateMask,
    createXdogSobelBoundaryMask(image, xdogThreshold, sobelThreshold),
    image.width,
    image.height,
    point,
  );
}
