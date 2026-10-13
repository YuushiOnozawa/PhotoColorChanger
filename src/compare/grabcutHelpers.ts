import type { ImagePoint } from "./types";

export type GrabCutRoi = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function computeGrabCutRoi(
  candidateMask: Uint8Array,
  width: number,
  height: number,
  seed: ImagePoint,
): GrabCutRoi {
  if (width <= 0 || height <= 0) return { x: 0, y: 0, width: 0, height: 0 };

  const longEdge = Math.max(width, height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (candidateMask[y * width + x] !== 1) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  let roi: GrabCutRoi;
  if (maxX < 0) {
    const side = Math.max(1, Math.ceil(longEdge * 0.25));
    const seedX = clamp(Math.floor(seed[0]), 0, width - 1);
    const seedY = clamp(Math.floor(seed[1]), 0, height - 1);
    const x = clamp(Math.floor(seedX - side / 2), 0, Math.max(0, width - side));
    const y = clamp(Math.floor(seedY - side / 2), 0, Math.max(0, height - side));
    roi = { x, y, width: Math.min(width, side), height: Math.min(height, side) };
  } else {
    const margin = Math.max(32, Math.ceil(longEdge * 0.15));
    const x = Math.max(0, minX - margin);
    const y = Math.max(0, minY - margin);
    const right = Math.min(width, maxX + margin + 1);
    const bottom = Math.min(height, maxY + margin + 1);
    roi = { x, y, width: right - x, height: bottom - y };
  }

  return roi.width * roi.height > width * height * 0.8
    ? { x: 0, y: 0, width, height }
    : roi;
}

export function resizeLabelsNearest(
  source: Uint8Array,
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number,
): Uint8Array {
  const result = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(sourceHeight - 1, Math.floor((y * sourceHeight) / height));
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(sourceWidth - 1, Math.floor((x * sourceWidth) / width));
      result[y * width + x] = source[sourceY * sourceWidth + sourceX];
    }
  }
  return result;
}

export function resizeBinaryMaskBilinear(
  source: Uint8Array,
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number,
): Uint8Array {
  const result = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const sourceY = clamp(((y + 0.5) * sourceHeight) / height - 0.5, 0, sourceHeight - 1);
    const top = Math.floor(sourceY);
    const bottom = Math.min(sourceHeight - 1, top + 1);
    const yWeight = sourceY - top;
    for (let x = 0; x < width; x += 1) {
      const sourceX = clamp(((x + 0.5) * sourceWidth) / width - 0.5, 0, sourceWidth - 1);
      const left = Math.floor(sourceX);
      const right = Math.min(sourceWidth - 1, left + 1);
      const xWeight = sourceX - left;
      const topValue =
        source[top * sourceWidth + left] * (1 - xWeight) +
        source[top * sourceWidth + right] * xWeight;
      const bottomValue =
        source[bottom * sourceWidth + left] * (1 - xWeight) +
        source[bottom * sourceWidth + right] * xWeight;
      const value = topValue * (1 - yWeight) + bottomValue * yWeight;
      result[y * width + x] = value >= 0.5 ? 1 : 0;
    }
  }
  return result;
}
