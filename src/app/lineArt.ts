const SOBEL_SCALE = 4;
const XDOG_SMALL_GAUSSIAN = [0.0544887, 0.2442013, 0.40262, 0.2442013, 0.0544887];
const XDOG_LARGE_GAUSSIAN = [0.128576, 0.231075, 0.280698, 0.231075, 0.128576];
const XDOG_GAMMA = 0.98;
const XDOG_PHI = 10;
const STRONG_EDGE_MULTIPLIER = 2.5;
// ponytail: Bound the illumination map at 64×64; use a multiscale blur in a worker if quality or speed needs tuning.
const SHADOW_NORMALIZATION_MAP_SIZE = 64;
const SHADOW_NORMALIZATION_GAIN = 2;
export const DEFAULT_COLOR_EDGE_WEIGHT = 50;
export const DEFAULT_SHADOW_LINE_THRESHOLD = 20;
export const DEFAULT_BINARY_THRESHOLD = 50;

export type LineArtMethod = "sobel" | "binary" | "shadow" | "xdog" | "xdogSobel";

export interface LineArtMethodOptions {
  binaryThreshold: number;
  colorEdgeWeight: number;
  lineThreshold: number;
  shadowLineThreshold: number;
  xdogThreshold: number;
}

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

// ponytail: Use one fixed 5×5 box blur for the comparison; use a separable blur or worker if it becomes a shipped default.
function averagedLuminance(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  let total = 0;
  for (let offsetY = -2; offsetY <= 2; offsetY += 1) {
    for (let offsetX = -2; offsetX <= 2; offsetX += 1) {
      const safeX = clamp(x + offsetX, 0, width - 1);
      const safeY = clamp(y + offsetY, 0, height - 1);
      const index = (safeY * width + safeX) * 4;
      total +=
        (pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114) / 255;
    }
  }
  return total / 25;
}

export function createBinaryPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  threshold: number,
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(width * height * 4);
  const normalizedThreshold = clamp(threshold, 0, 100) / 100;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const color = averagedLuminance(pixels, width, height, x, y) >= normalizedThreshold ? 255 : 0;
      result[index] = color;
      result[index + 1] = color;
      result[index + 2] = color;
      result[index + 3] = pixels[index + 3];
    }
  }

  return result;
}

export function createBinaryEdgeMask(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  threshold: number,
): Uint8Array {
  const binary = createBinaryPixels(pixels, width, height, threshold);
  const result = new Uint8Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const current = binary[index * 4] < 128;
      const differs =
        (x > 0 && binary[(index - 1) * 4] < 128 !== current) ||
        (x + 1 < width && binary[(index + 1) * 4] < 128 !== current) ||
        (y > 0 && binary[(index - width) * 4] < 128 !== current) ||
        (y + 1 < height && binary[(index + width) * 4] < 128 !== current);
      if (differs) result[index] = 1;
    }
  }

  return result;
}

function createShadowNormalizedPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8ClampedArray {
  const mapWidth = Math.max(2, Math.min(SHADOW_NORMALIZATION_MAP_SIZE, Math.ceil(width / 16)));
  const mapHeight = Math.max(2, Math.min(SHADOW_NORMALIZATION_MAP_SIZE, Math.ceil(height / 16)));
  const mapTotals = new Float64Array(mapWidth * mapHeight);
  const mapCounts = new Uint32Array(mapWidth * mapHeight);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelIndex = (y * width + x) * 4;
      const mapIndex =
        Math.min(mapHeight - 1, Math.floor((y * mapHeight) / height)) * mapWidth +
        Math.min(mapWidth - 1, Math.floor((x * mapWidth) / width));
      mapTotals[mapIndex] +=
        (pixels[pixelIndex] * 0.299 +
          pixels[pixelIndex + 1] * 0.587 +
          pixels[pixelIndex + 2] * 0.114) /
        255;
      mapCounts[mapIndex] += 1;
    }
  }

  const map = new Float32Array(mapWidth * mapHeight);
  for (let index = 0; index < map.length; index += 1) {
    map[index] = mapCounts[index] > 0 ? mapTotals[index] / mapCounts[index] : 0.5;
  }

  const result = new Uint8ClampedArray(pixels.length);
  for (let y = 0; y < height; y += 1) {
    const mapY = (y / Math.max(1, height - 1)) * (mapHeight - 1);
    const top = Math.floor(mapY);
    const bottom = Math.min(mapHeight - 1, top + 1);
    const yWeight = mapY - top;
    for (let x = 0; x < width; x += 1) {
      const mapX = (x / Math.max(1, width - 1)) * (mapWidth - 1);
      const left = Math.floor(mapX);
      const right = Math.min(mapWidth - 1, left + 1);
      const xWeight = mapX - left;
      const topMean =
        map[top * mapWidth + left] * (1 - xWeight) + map[top * mapWidth + right] * xWeight;
      const bottomMean =
        map[bottom * mapWidth + left] * (1 - xWeight) + map[bottom * mapWidth + right] * xWeight;
      const localMean = topMean * (1 - yWeight) + bottomMean * yWeight;
      const pixelIndex = (y * width + x) * 4;
      const sourceLuminance =
        (pixels[pixelIndex] * 0.299 +
          pixels[pixelIndex + 1] * 0.587 +
          pixels[pixelIndex + 2] * 0.114) /
        255;
      const normalizedLuminance = clamp(
        0.5 + (sourceLuminance - localMean) * SHADOW_NORMALIZATION_GAIN,
        0,
        1,
      );
      const color = Math.round(normalizedLuminance * 255);
      result[pixelIndex] = color;
      result[pixelIndex + 1] = color;
      result[pixelIndex + 2] = color;
      result[pixelIndex + 3] = pixels[pixelIndex + 3];
    }
  }

  return result;
}

export function createShadowNormalizedLineArtPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  threshold: number,
): Uint8ClampedArray {
  return createLineArtPixels(
    createShadowNormalizedPixels(pixels, width, height),
    width,
    height,
    threshold,
    0,
  );
}

function gaussianBlurredLuminance(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  weights: readonly number[],
): number {
  let value = 0;
  for (let offsetY = -2; offsetY <= 2; offsetY += 1) {
    for (let offsetX = -2; offsetX <= 2; offsetX += 1) {
      const safeX = clamp(x + offsetX, 0, width - 1);
      const safeY = clamp(y + offsetY, 0, height - 1);
      const index = (safeY * width + safeX) * 4;
      value +=
        ((pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114) / 255) *
        weights[offsetX + 2] *
        weights[offsetY + 2];
    }
  }
  return value;
}

// ponytail: Keep XDoG on the CPU for matching WebGL and 2D output; move it to a worker or multipass shader if shipped.
export function createXdogPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  threshold: number,
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(width * height * 4);
  const responses = new Float32Array(width * height);
  const epsilon = clamp(threshold, 0, 100) / 100;
  let maximumResponse = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const smallBlur = gaussianBlurredLuminance(pixels, width, height, x, y, XDOG_SMALL_GAUSSIAN);
      const largeBlur = gaussianBlurredLuminance(pixels, width, height, x, y, XDOG_LARGE_GAUSSIAN);
      const response = smallBlur - XDOG_GAMMA * largeBlur;
      const index = (y * width + x) * 4;
      result[index + 3] = pixels[index + 3];
      responses[y * width + x] = response;
      maximumResponse = Math.max(maximumResponse, response);
    }
  }

  const safeMaximumResponse = Math.max(maximumResponse, 0.0001);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const normalizedResponse = responses[y * width + x] / safeMaximumResponse;
      const tone = Math.min(1, 1 + Math.tanh(XDOG_PHI * (normalizedResponse - epsilon)));
      const color = Math.round((1 - tone) * 255);
      result[index] = color;
      result[index + 1] = color;
      result[index + 2] = color;
    }
  }

  return result;
}

export function createXdogSobelPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  xdogThreshold: number,
  sobelThreshold: number,
): Uint8ClampedArray {
  return createLineArtPixels(
    createXdogPixels(pixels, width, height, xdogThreshold),
    width,
    height,
    sobelThreshold,
  );
}

export function createLineArtMaskForMethod(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  method: LineArtMethod,
  options: LineArtMethodOptions,
): Uint8Array {
  switch (method) {
    case "binary":
      return createBinaryEdgeMask(pixels, width, height, options.binaryThreshold);
    case "shadow":
      return createLineArtMask(
        createShadowNormalizedPixels(pixels, width, height),
        width,
        height,
        options.shadowLineThreshold,
        0,
      );
    case "xdog":
      return createLineArtMask(
        createXdogPixels(pixels, width, height, options.xdogThreshold),
        width,
        height,
        1,
        0,
      );
    case "xdogSobel":
      return createLineArtMask(
        createXdogPixels(pixels, width, height, options.xdogThreshold),
        width,
        height,
        options.lineThreshold,
        0,
      );
    case "sobel":
      return createLineArtMask(
        pixels,
        width,
        height,
        options.lineThreshold,
        options.colorEdgeWeight,
      );
  }
}
