const SOBEL_SCALE = 4;

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

export function createLineArtPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  threshold: number,
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(width * height * 4);
  const normalizedThreshold = Math.max(0.01, clamp(threshold, 0, 100) / 100);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
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
      const edge = Math.min(1, Math.hypot(horizontal, vertical) / SOBEL_SCALE);
      const color = edge >= normalizedThreshold ? 0 : 255;
      const index = (y * width + x) * 4;
      result[index] = color;
      result[index + 1] = color;
      result[index + 2] = color;
      result[index + 3] = pixels[index + 3];
    }
  }

  return result;
}
