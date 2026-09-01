type RgbColor = readonly [number, number, number];

const MAX_DISTANCE_SQUARED = 3 * 255 ** 2;

export function replaceSimilarColors(
  pixels: Uint8ClampedArray,
  targetColor: RgbColor,
  replacementColor: RgbColor,
  tolerance: number,
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(pixels);
  const normalizedTolerance = Math.max(0, Math.min(100, tolerance)) / 100;
  const maxDistanceSquared = normalizedTolerance ** 2 * MAX_DISTANCE_SQUARED;

  for (let index = 0; index < pixels.length; index += 4) {
    const redDistance = pixels[index] - targetColor[0];
    const greenDistance = pixels[index + 1] - targetColor[1];
    const blueDistance = pixels[index + 2] - targetColor[2];
    const distanceSquared = redDistance ** 2 + greenDistance ** 2 + blueDistance ** 2;

    if (distanceSquared <= maxDistanceSquared) {
      result[index] = replacementColor[0];
      result[index + 1] = replacementColor[1];
      result[index + 2] = replacementColor[2];
    }
  }

  return result;
}
