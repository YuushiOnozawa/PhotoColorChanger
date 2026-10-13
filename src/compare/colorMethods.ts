import { replaceSimilarColors } from "../app/colorReplacement";
import { hsvDistance, rgbToHsv, rgbToLab, weightedLabDistance } from "./colorSpaces";
import type { ImageLike, ImagePoint, RgbColor } from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getSeedMedianRgb(image: ImageLike, point: ImagePoint): RgbColor {
  const centerX = clamp(Math.floor(point[0]), 0, Math.max(0, image.width - 1));
  const centerY = clamp(Math.floor(point[1]), 0, Math.max(0, image.height - 1));
  const channels: [number[], number[], number[]] = [[], [], []];

  for (let y = Math.max(0, centerY - 4); y <= Math.min(image.height - 1, centerY + 4); y += 1) {
    for (let x = Math.max(0, centerX - 4); x <= Math.min(image.width - 1, centerX + 4); x += 1) {
      const index = (y * image.width + x) * 4;
      if (image.data[index + 3] === 0) continue;
      channels[0].push(image.data[index]);
      channels[1].push(image.data[index + 1]);
      channels[2].push(image.data[index + 2]);
    }
  }

  return channels.map((channel) => {
    if (channel.length === 0) return 0;
    channel.sort((left, right) => left - right);
    const middle = Math.floor(channel.length / 2);
    return channel.length % 2 === 0 ? (channel[middle - 1] + channel[middle]) / 2 : channel[middle];
  }) as [number, number, number];
}

export function recolorRgb(
  image: ImageLike,
  point: ImagePoint,
  replacement: RgbColor,
  tolerancePercent: number,
): ImageLike {
  const seedColor = getSeedMedianRgb(image, point);
  const data = replaceSimilarColors(image.data, seedColor, replacement, tolerancePercent);

  for (let index = 0; index < image.data.length; index += 4) {
    if (image.data[index + 3] !== 0) continue;
    data[index] = image.data[index];
    data[index + 1] = image.data[index + 1];
    data[index + 2] = image.data[index + 2];
  }

  return { width: image.width, height: image.height, data };
}

export function createHsvMask(
  image: ImageLike,
  point: ImagePoint,
  tolerancePercent: number,
): Uint8Array {
  const seedHsv = rgbToHsv(getSeedMedianRgb(image, point));
  const maximumDistance = (clamp(tolerancePercent, 0, 100) / 100) * Math.sqrt(3);
  const mask = new Uint8Array(image.width * image.height);

  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    const index = pixel * 4;
    if (image.data[index + 3] === 0) continue;
    const color: RgbColor = [image.data[index], image.data[index + 1], image.data[index + 2]];
    if (hsvDistance(rgbToHsv(color), seedHsv) <= maximumDistance) mask[pixel] = 1;
  }

  return mask;
}

export function createLabMask(
  image: ImageLike,
  point: ImagePoint,
  toleranceDeltaE: number,
): Uint8Array {
  const seedLab = rgbToLab(getSeedMedianRgb(image, point));
  const tolerance = Math.max(0, toleranceDeltaE);
  const mask = new Uint8Array(image.width * image.height);

  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    const index = pixel * 4;
    if (image.data[index + 3] === 0) continue;
    const color: RgbColor = [image.data[index], image.data[index + 1], image.data[index + 2]];
    if (weightedLabDistance(rgbToLab(color), seedLab) <= tolerance) mask[pixel] = 1;
  }

  return mask;
}
