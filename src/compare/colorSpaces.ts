import type { RgbColor } from "./types";

export type HsvColor = readonly [number, number, number];
export type LabColor = readonly [number, number, number];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function rgbToHsv([redByte, greenByte, blueByte]: RgbColor): HsvColor {
  const red = redByte / 255;
  const green = greenByte / 255;
  const blue = blueByte / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  let hue = 0;

  if (delta > 0) {
    if (maximum === red) hue = ((green - blue) / delta) % 6;
    else if (maximum === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue /= 6;
    if (hue < 0) hue += 1;
  }

  return [hue, maximum === 0 ? 0 : delta / maximum, maximum];
}

export function hsvToRgb([hueValue, saturationValue, valueValue]: HsvColor): RgbColor {
  const hue = ((hueValue % 1) + 1) % 1;
  const saturation = clamp(saturationValue, 0, 1);
  const value = clamp(valueValue, 0, 1);
  const sector = hue * 6;
  const chroma = value * saturation;
  const secondary = chroma * (1 - Math.abs((sector % 2) - 1));
  const offset = value - chroma;
  let rgb: [number, number, number];

  if (sector < 1) rgb = [chroma, secondary, 0];
  else if (sector < 2) rgb = [secondary, chroma, 0];
  else if (sector < 3) rgb = [0, chroma, secondary];
  else if (sector < 4) rgb = [0, secondary, chroma];
  else if (sector < 5) rgb = [secondary, 0, chroma];
  else rgb = [chroma, 0, secondary];

  return rgb.map((channel) => Math.round((channel + offset) * 255)) as [number, number, number];
}

function srgbToLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function labPivot(value: number): number {
  const delta = 6 / 29;
  return value > delta ** 3 ? Math.cbrt(value) : value / (3 * delta ** 2) + 4 / 29;
}

export function rgbToLab(color: RgbColor): LabColor {
  const red = srgbToLinear(color[0]);
  const green = srgbToLinear(color[1]);
  const blue = srgbToLinear(color[2]);
  const x = (red * 0.4124564 + green * 0.3575761 + blue * 0.1804375) / 0.95047;
  const y = red * 0.2126729 + green * 0.7151522 + blue * 0.072175;
  const z = (red * 0.0193339 + green * 0.119192 + blue * 0.9503041) / 1.08883;
  const lightness = labPivot(y);
  const pivotX = labPivot(x);
  const pivotZ = labPivot(z);

  return [116 * lightness - 16, 500 * (pivotX - lightness), 200 * (lightness - pivotZ)];
}

function labInversePivot(value: number): number {
  const delta = 6 / 29;
  return value > delta ? value ** 3 : 3 * delta ** 2 * (value - 4 / 29);
}

function linearToSrgb(channel: number): number {
  return 255 * (channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055);
}

export function labToRgb([lightness, a, b]: LabColor): RgbColor {
  const pivotY = (lightness + 16) / 116;
  const x = labInversePivot(pivotY + a / 500) * 0.95047;
  const y = labInversePivot(pivotY);
  const z = labInversePivot(pivotY - b / 200) * 1.08883;
  const red = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
  const green = x * -0.969266 + y * 1.8760108 + z * 0.041556;
  const blue = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;

  return [red, green, blue].map((channel) => Math.round(clamp(linearToSrgb(channel), 0, 255))) as [
    number,
    number,
    number,
  ];
}

export function hsvDistance(left: HsvColor, right: HsvColor): number {
  const directHue = Math.abs(left[0] - right[0]);
  const hueDistance = Math.min(directHue, 1 - directHue);
  return Math.hypot(hueDistance, left[1] - right[1], left[2] - right[2]);
}

export function weightedLabDistance(left: LabColor, right: LabColor): number {
  return Math.hypot(0.35 * (left[0] - right[0]), left[1] - right[1], left[2] - right[2]);
}
