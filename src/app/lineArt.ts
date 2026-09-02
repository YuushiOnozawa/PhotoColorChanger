const SOBEL_SCALE = 4;
const STRONG_EDGE_MULTIPLIER = 2.5;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function luminance(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  const safeX = clamp(x, 0, width - 1);
  const safeY = clamp(y, 0, height - 1);
  const index = (safeY * width + safeX) * 4;
  return (pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114) / 255;
}

function edgeStrength(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  const topLeft = luminance(pixels, width, height, x - 1, y - 1);
  const top = luminance(pixels, width, height, x, y - 1);
  const topRight = luminance(pixels, width, height, x + 1, y - 1);
  const left = luminance(pixels, width, height, x - 1, y);
  const right = luminance(pixels, width, height, x + 1, y);
  const bottomLeft = luminance(pixels, width, height, x - 1, y + 1);
  const bottom = luminance(pixels, width, height, x, y + 1);
  const bottomRight = luminance(pixels, width, height, x + 1, y + 1);
  const horizontal = -topLeft + topRight - 2 * left + 2 * right - bottomLeft + bottomRight;
  const vertical = topLeft + 2 * top + topRight - bottomLeft - 2 * bottom - bottomRight;
  return Math.min(1, Math.hypot(horizontal, vertical) / SOBEL_SCALE);
}

export function createLineArtMask(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  threshold: number,
): Uint8Array {
  const result = new Uint8Array(width * height);
  const strengths = new Float32Array(width * height);
  const normalizedThreshold = Math.max(0.01, clamp(threshold, 0, 100) / 100);
  const strongThreshold = Math.min(1, normalizedThreshold * STRONG_EDGE_MULTIPLIER);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      strengths[y * width + x] = edgeStrength(pixels, width, height, x, y);
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (strengths[index] >= strongThreshold) {
        result[index] = 1;
        continue;
      }
      if (strengths[index] < normalizedThreshold) continue;

      const hasStrongNeighbor =
        (x > 0 && strengths[index - 1] >= strongThreshold) ||
        (x + 1 < width && strengths[index + 1] >= strongThreshold) ||
        (y > 0 && strengths[index - width] >= strongThreshold) ||
        (y + 1 < height && strengths[index + width] >= strongThreshold);
      if (hasStrongNeighbor) result[index] = 1;
    }
  }

  return result;
}

export function createLineArtPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  threshold: number,
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(width * height * 4);
  const mask = createLineArtMask(pixels, width, height, threshold);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = mask[y * width + x] === 1 ? 0 : 255;
      const index = (y * width + x) * 4;
      result[index] = color;
      result[index + 1] = color;
      result[index + 2] = color;
      result[index + 3] = pixels[index + 3];
    }
  }

  return result;
}
