const SOBEL_SCALE = 4;
const XDOG_SMALL_GAUSSIAN = [0.0544887, 0.2442013, 0.40262, 0.2442013, 0.0544887];
const XDOG_LARGE_GAUSSIAN = [0.128576, 0.231075, 0.280698, 0.231075, 0.128576];
const XDOG_GAMMA = 0.98;
const XDOG_PHI = 10;

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
      value +=
        luminance(pixels, width, height, x + offsetX, y + offsetY) *
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
