import type { ImagePoint } from "./types";

export type GrabCutSubjectRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const GC_BGD = 0;
const GC_FGD = 1;
const GC_PR_BGD = 2;
const GC_PR_FGD = 3;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getGrabCutSubjectFailureReason(
  foregroundMask: Uint8Array,
  width: number,
  height: number,
  rect: GrabCutSubjectRect,
): string | null {
  const total = width * height;
  if (total <= 0) return "画像サイズが小さいため";

  let foreground = 0;
  for (let pixel = 0; pixel < total; pixel += 1) {
    if (foregroundMask[pixel] === 1) foreground += 1;
  }
  const ratio = foreground / total;
  if (ratio < 0.05) return "被写体が画像の5%未満のため";
  if (ratio > 0.95) return "被写体が画像の95%を超えるため";

  const left = rect.x;
  const top = rect.y;
  const right = rect.x + rect.width - 1;
  const bottom = rect.y + rect.height - 1;
  const sides = [
    { name: "上辺", length: rect.width, start: top * width + left, step: 1 },
    { name: "下辺", length: rect.width, start: bottom * width + left, step: 1 },
    { name: "左辺", length: rect.height, start: top * width + left, step: width },
    { name: "右辺", length: rect.height, start: top * width + right, step: width },
  ];
  for (const side of sides) {
    let sideForeground = 0;
    for (let offset = 0; offset < side.length; offset += 1) {
      if (foregroundMask[side.start + offset * side.step] === 1) sideForeground += 1;
    }
    const sideRatio = sideForeground / side.length;
    if (sideRatio > 0.2) {
      const percent = Number((sideRatio * 100).toFixed(1));
      return `被写体が枠の${side.name}で切れている（前景率${percent}%）ため`;
    }
  }
  return null;
}

export function dilateBinaryMask(
  source: Uint8Array,
  width: number,
  height: number,
  radius = 4,
): Uint8Array {
  const horizontal = new Uint8Array(width * height);
  const result = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const sourceX = x + dx;
        if (sourceX >= 0 && sourceX < width && source[y * width + sourceX] === 1) {
          horizontal[y * width + x] = 1;
          break;
        }
      }
    }
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        const sourceY = y + dy;
        if (sourceY >= 0 && sourceY < height && horizontal[sourceY * width + x] === 1) {
          result[y * width + x] = 1;
          break;
        }
      }
    }
  }
  return result;
}

export function isSeedDiscInsideDilatedForeground(
  foregroundMask: Uint8Array,
  width: number,
  height: number,
  seed: ImagePoint,
  seedRadius: number,
): boolean {
  if (width <= 0 || height <= 0) return false;
  const dilatedForeground = dilateBinaryMask(foregroundMask, width, height, 4);
  const seedX = clamp(Math.floor(seed[0]), 0, width - 1);
  const seedY = clamp(Math.floor(seed[1]), 0, height - 1);
  const radiusSquared = seedRadius * seedRadius;

  for (
    let y = Math.max(0, Math.ceil(seedY - seedRadius));
    y <= Math.min(height - 1, Math.floor(seedY + seedRadius));
    y += 1
  ) {
    for (
      let x = Math.max(0, Math.ceil(seedX - seedRadius));
      x <= Math.min(width - 1, Math.floor(seedX + seedRadius));
      x += 1
    ) {
      if (
        (x - seedX) ** 2 + (y - seedY) ** 2 <= radiusSquared &&
        dilatedForeground[y * width + x] === 0
      ) {
        return false;
      }
    }
  }
  return true;
}

export function createSubjectGrabCutInitializationMask(
  foregroundMask: Uint8Array,
  candidateMask: Uint8Array,
  width: number,
  height: number,
  seed: ImagePoint,
  seedRadius: number,
): Uint8Array {
  const result = new Uint8Array(width * height);
  if (width === 0 || height === 0) return result;
  const dilatedForeground = dilateBinaryMask(foregroundMask, width, height, 4);
  const seedX = clamp(Math.floor(seed[0]), 0, width - 1);
  const seedY = clamp(Math.floor(seed[1]), 0, height - 1);
  const radiusSquared = seedRadius * seedRadius;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        result[pixel] = GC_BGD;
      } else if (dilatedForeground[pixel] === 0) {
        result[pixel] = GC_BGD;
      } else if ((x - seedX) ** 2 + (y - seedY) ** 2 <= radiusSquared) {
        result[pixel] = GC_FGD;
      } else if (foregroundMask[pixel] === 1 && candidateMask[pixel] === 1) {
        result[pixel] = GC_PR_FGD;
      } else {
        result[pixel] = GC_PR_BGD;
      }
    }
  }
  return result;
}

export function resizeLabelsNearest(
  source: Uint8Array,
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number,
): Uint8Array {
  const result = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(sourceHeight - 1, Math.floor((y * sourceHeight) / height));
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(sourceWidth - 1, Math.floor((x * sourceWidth) / width));
      result[y * width + x] = source[sourceY * sourceWidth + sourceX];
    }
  }
  return result;
}

export function resizeBinaryMaskBilinear(
  source: Uint8Array,
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number,
): Uint8Array {
  const result = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const sourceY = clamp(((y + 0.5) * sourceHeight) / height - 0.5, 0, sourceHeight - 1);
    const top = Math.floor(sourceY);
    const bottom = Math.min(sourceHeight - 1, top + 1);
    const yWeight = sourceY - top;
    for (let x = 0; x < width; x += 1) {
      const sourceX = clamp(((x + 0.5) * sourceWidth) / width - 0.5, 0, sourceWidth - 1);
      const left = Math.floor(sourceX);
      const right = Math.min(sourceWidth - 1, left + 1);
      const xWeight = sourceX - left;
      const topValue =
        source[top * sourceWidth + left] * (1 - xWeight) +
        source[top * sourceWidth + right] * xWeight;
      const bottomValue =
        source[bottom * sourceWidth + left] * (1 - xWeight) +
        source[bottom * sourceWidth + right] * xWeight;
      const value = topValue * (1 - yWeight) + bottomValue * yWeight;
      result[y * width + x] = value >= 0.5 ? 1 : 0;
    }
  }
  return result;
}
