const SOBEL_SCALE = 4;
const STRONG_EDGE_MULTIPLIER = 2.5;
export const DEFAULT_COLOR_EDGE_WEIGHT = 50;

type Rgb = readonly [number, number, number];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function sampleRgb(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
): Rgb {
  const safeX = clamp(x, 0, width - 1);
  const safeY = clamp(y, 0, height - 1);
  const index = (safeY * width + safeX) * 4;
  return [pixels[index] / 255, pixels[index + 1] / 255, pixels[index + 2] / 255];
}

function luminance(color: Rgb): number {
  return color[0] * 0.299 + color[1] * 0.587 + color[2] * 0.114;
}

function edgeStrength(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  colorEdgeWeight: number,
): number {
  const topLeft = sampleRgb(pixels, width, height, x - 1, y - 1);
  const top = sampleRgb(pixels, width, height, x, y - 1);
  const topRight = sampleRgb(pixels, width, height, x + 1, y - 1);
  const left = sampleRgb(pixels, width, height, x - 1, y);
  const right = sampleRgb(pixels, width, height, x + 1, y);
  const bottomLeft = sampleRgb(pixels, width, height, x - 1, y + 1);
  const bottom = sampleRgb(pixels, width, height, x, y + 1);
  const bottomRight = sampleRgb(pixels, width, height, x + 1, y + 1);
  const horizontalLuminance =
    -luminance(topLeft) +
    luminance(topRight) -
    2 * luminance(left) +
    2 * luminance(right) -
    luminance(bottomLeft) +
    luminance(bottomRight);
  const verticalLuminance =
    luminance(topLeft) +
    2 * luminance(top) +
    luminance(topRight) -
    luminance(bottomLeft) -
    2 * luminance(bottom) -
    luminance(bottomRight);
  const luminanceEdge = Math.hypot(horizontalLuminance, verticalLuminance) / SOBEL_SCALE;
  const horizontalColor: Rgb = [
    -topLeft[0] + topRight[0] - 2 * left[0] + 2 * right[0] - bottomLeft[0] + bottomRight[0],
    -topLeft[1] + topRight[1] - 2 * left[1] + 2 * right[1] - bottomLeft[1] + bottomRight[1],
    -topLeft[2] + topRight[2] - 2 * left[2] + 2 * right[2] - bottomLeft[2] + bottomRight[2],
  ];
  const verticalColor: Rgb = [
    topLeft[0] + 2 * top[0] + topRight[0] - bottomLeft[0] - 2 * bottom[0] - bottomRight[0],
    topLeft[1] + 2 * top[1] + topRight[1] - bottomLeft[1] - 2 * bottom[1] - bottomRight[1],
    topLeft[2] + 2 * top[2] + topRight[2] - bottomLeft[2] - 2 * bottom[2] - bottomRight[2],
  ];
  const colorEdge = Math.hypot(...horizontalColor, ...verticalColor) / (SOBEL_SCALE * Math.sqrt(3));
  return Math.min(1, Math.max(luminanceEdge, colorEdge * (clamp(colorEdgeWeight, 0, 100) / 100)));
}

export function createLineArtMask(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  threshold: number,
  colorEdgeWeight = DEFAULT_COLOR_EDGE_WEIGHT,
): Uint8Array {
  const result = new Uint8Array(width * height);
  const strengths = new Float32Array(width * height);
  const normalizedThreshold = Math.max(0.01, clamp(threshold, 0, 100) / 100);
  const strongThreshold = Math.min(1, normalizedThreshold * STRONG_EDGE_MULTIPLIER);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      strengths[y * width + x] = edgeStrength(pixels, width, height, x, y, colorEdgeWeight);
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
  colorEdgeWeight = DEFAULT_COLOR_EDGE_WEIGHT,
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(width * height * 4);
  const mask = createLineArtMask(pixels, width, height, threshold, colorEdgeWeight);

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
