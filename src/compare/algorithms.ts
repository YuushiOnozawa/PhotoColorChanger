import { createBoundaryConstrainedMask } from "./boundaryMethods";
import { createHsvMask, createLabMask, getSeedMedianRgb, recolorRgb } from "./colorMethods";
import { recolorHsvHue, recolorLabLuma, recolorSolid } from "./recolorMethods";
import type { ImageLike, ImagePoint, MethodId, RgbColor } from "./types";

export type ProcessOptions = {
  image: ImageLike;
  methodId: MethodId;
  seed: ImagePoint;
  replacement: RgbColor;
  tolerance: number;
  fixedMask?: Uint8Array | null;
};

export function processComparisonMethod({
  image,
  methodId,
  seed,
  replacement,
  tolerance,
  fixedMask,
}: ProcessOptions): ImageLike {
  if (methodId === "color-rgb") return recolorRgb(image, seed, replacement, tolerance);

  if (methodId === "color-hsv") {
    return recolorSolid(image, createHsvMask(image, seed, tolerance), replacement);
  }

  if (methodId === "color-lab") {
    return recolorSolid(image, createLabMask(image, seed, tolerance), replacement);
  }

  if (methodId === "boundary-none") {
    return recolorSolid(image, createHsvMask(image, seed, tolerance), replacement);
  }

  if (methodId === "boundary-xdog-sobel") {
    const hsvMask = createHsvMask(image, seed, tolerance);
    const boundaryMask = createBoundaryConstrainedMask(image, hsvMask, seed);
    return recolorSolid(image, boundaryMask, replacement);
  }

  const mask = fixedMask ?? createHsvMask(image, seed, tolerance);
  if (methodId === "recolor-lab-luma") return recolorLabLuma(image, mask, replacement);
  if (methodId === "recolor-hsv-hue") {
    return recolorHsvHue(image, mask, getSeedMedianRgb(image, seed), replacement);
  }
  return recolorSolid(image, mask, replacement);
}
