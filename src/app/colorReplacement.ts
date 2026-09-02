import { createLineArtMask } from "./lineArt";

type RgbColor = readonly [number, number, number];
export type ImagePoint = readonly [number, number];

const MAX_DISTANCE_SQUARED = 3 * 255 ** 2;

export function replaceSimilarColors(
  pixels: Uint8ClampedArray,
  targetColor: RgbColor,
  replacementColor: RgbColor,
  tolerance: number,
  regionMask?: Uint8Array,
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(pixels);
  const normalizedTolerance = Math.max(0, Math.min(100, tolerance)) / 100;
  const maxDistanceSquared = normalizedTolerance ** 2 * MAX_DISTANCE_SQUARED;

  for (let index = 0; index < pixels.length; index += 4) {
    const redDistance = pixels[index] - targetColor[0];
    const greenDistance = pixels[index + 1] - targetColor[1];
    const blueDistance = pixels[index + 2] - targetColor[2];
    const distanceSquared = redDistance ** 2 + greenDistance ** 2 + blueDistance ** 2;

    if (distanceSquared <= maxDistanceSquared && (!regionMask || regionMask[index / 4] === 1)) {
      result[index] = replacementColor[0];
      result[index + 1] = replacementColor[1];
      result[index + 2] = replacementColor[2];
    }
  }

  return result;
}

export function createConnectedRegionMask(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  targetColor: RgbColor,
  targetPoint: ImagePoint,
  tolerance: number,
  lineThreshold: number,
): Uint8Array {
  const regionMask = new Uint8Array(width * height);
  if (width === 0 || height === 0) return regionMask;

  const seedX = Math.max(0, Math.min(width - 1, Math.floor(targetPoint[0])));
  const seedY = Math.max(0, Math.min(height - 1, Math.floor(targetPoint[1])));
  const seedIndex = seedY * width + seedX;
  const seedPixelIndex = seedIndex * 4;
  if (pixels[seedPixelIndex + 3] === 0) return regionMask;

  const normalizedTolerance = Math.max(0, Math.min(100, tolerance)) / 100;
  const maxDistanceSquared = normalizedTolerance ** 2 * MAX_DISTANCE_SQUARED;
  const lineMask = createLineArtMask(pixels, width, height, lineThreshold);
  const queue = new Int32Array(width * height);
  let queueStart = 0;
  let queueEnd = 0;

  regionMask[seedIndex] = 1;
  queue[queueEnd] = seedIndex;
  queueEnd += 1;

  while (queueStart < queueEnd) {
    const index = queue[queueStart];
    queueStart += 1;
    const x = index % width;
    const y = Math.floor(index / width);

    for (const [offsetX, offsetY] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const neighborX = x + offsetX;
      const neighborY = y + offsetY;
      if (neighborX < 0 || neighborX >= width || neighborY < 0 || neighborY >= height) {
        continue;
      }

      const neighborIndex = neighborY * width + neighborX;
      if (regionMask[neighborIndex] === 1) continue;

      const pixelIndex = neighborIndex * 4;
      if (pixels[pixelIndex + 3] === 0) continue;
      const redDistance = pixels[pixelIndex] - targetColor[0];
      const greenDistance = pixels[pixelIndex + 1] - targetColor[1];
      const blueDistance = pixels[pixelIndex + 2] - targetColor[2];
      const distanceSquared = redDistance ** 2 + greenDistance ** 2 + blueDistance ** 2;
      if (distanceSquared > maxDistanceSquared) continue;

      regionMask[neighborIndex] = 1;
      if (lineMask[neighborIndex] === 1) continue;
      queue[queueEnd] = neighborIndex;
      queueEnd += 1;
    }
  }

  return regionMask;
}
