import type { ImageLike, ImagePoint } from "./types";

export type SyntheticImage = {
  image: ImageLike;
  groundTruthMask: Uint8Array;
  seed: ImagePoint;
};

function inEllipse(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
) {
  return ((x - centerX) / radiusX) ** 2 + ((y - centerY) / radiusY) ** 2;
}

export function createSyntheticImage(): SyntheticImage {
  const width = 320;
  const height = 240;
  const image: ImageLike = {
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4),
  };
  const groundTruthMask = new Uint8Array(width * height);
  const seed: ImagePoint = [105, 119];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      const index = pixel * 4;
      const targetShape = inEllipse(x, y, 105, 120, 76, 84);
      const adjacentShape = inEllipse(x, y, 237, 120, 60, 55);
      const targetInside = targetShape <= 1;
      const adjacentInside = adjacentShape <= 1;
      const divider = x >= 178 && x <= 184 && y >= 65 && y <= 175;
      const targetOutline = targetInside && targetShape >= 0.88;
      const adjacentOutline = adjacentInside && adjacentShape >= 0.88;
      let color: [number, number, number] = [218, 211, 199];

      if (targetInside || adjacentInside) {
        if (targetInside && !adjacentInside) {
          const shade = 0.64 + 0.3 * (x / width) + 0.06 * (y / height);
          const highlightDistance = Math.hypot((x - 78) / 19, (y - 88) / 13);
          const highlight = Math.max(0, 1 - highlightDistance) * 0.62;
          color = [190, 88, 52].map((channel) =>
            Math.round(channel * shade * (1 - highlight) + 255 * highlight),
          ) as [number, number, number];
        } else {
          const shade = 0.82 + 0.14 * (x / width) + 0.04 * (y / height);
          color = [183, 92, 57].map((channel) => Math.round(channel * shade)) as [
            number,
            number,
            number,
          ];
        }
      }

      if (targetOutline || adjacentOutline || divider) color = [42, 36, 32];
      image.data[index] = color[0];
      image.data[index + 1] = color[1];
      image.data[index + 2] = color[2];
      image.data[index + 3] = 255;

      if (targetInside && !targetOutline && !divider && !adjacentInside) {
        groundTruthMask[pixel] = 1;
      }
    }
  }

  return { image, groundTruthMask, seed };
}
