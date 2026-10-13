import { hsvToRgb, labToRgb, rgbToHsv, rgbToLab } from "./colorSpaces";
import type { ImageLike, RgbColor } from "./types";

export function recolorSolid(image: ImageLike, mask: Uint8Array, replacement: RgbColor): ImageLike {
  const data = new Uint8ClampedArray(image.data);

  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    const index = pixel * 4;
    if (mask[pixel] !== 1 || data[index + 3] === 0) continue;
    data[index] = replacement[0];
    data[index + 1] = replacement[1];
    data[index + 2] = replacement[2];
  }

  return { width: image.width, height: image.height, data };
}

export function recolorLabLuma(
  image: ImageLike,
  mask: Uint8Array,
  replacement: RgbColor,
): ImageLike {
  const data = new Uint8ClampedArray(image.data);
  const replacementLab = rgbToLab(replacement);

  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    const index = pixel * 4;
    if (mask[pixel] !== 1 || data[index + 3] === 0) continue;
    const pixelLab = rgbToLab([data[index], data[index + 1], data[index + 2]]);
    const recolored = labToRgb([pixelLab[0], replacementLab[1], replacementLab[2]]);
    data[index] = recolored[0];
    data[index + 1] = recolored[1];
    data[index + 2] = recolored[2];
  }

  return { width: image.width, height: image.height, data };
}

export function recolorHsvHue(
  image: ImageLike,
  mask: Uint8Array,
  seedColor: RgbColor,
  replacement: RgbColor,
): ImageLike {
  const data = new Uint8ClampedArray(image.data);
  const hueDelta = rgbToHsv(replacement)[0] - rgbToHsv(seedColor)[0];

  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    const index = pixel * 4;
    if (mask[pixel] !== 1 || data[index + 3] === 0) continue;
    const hsv = rgbToHsv([data[index], data[index + 1], data[index + 2]]);
    const recolored = hsvToRgb([hsv[0] + hueDelta, hsv[1], hsv[2]]);
    data[index] = recolored[0];
    data[index + 1] = recolored[1];
    data[index + 2] = recolored[2];
  }

  return { width: image.width, height: image.height, data };
}
