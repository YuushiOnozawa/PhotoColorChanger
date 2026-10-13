import { createBoundaryConstrainedMask } from "./boundaryMethods";
import {
  processGrabCutMask,
  type GrabCutLineArtInfo,
  type GrabCutProcessingStatus,
  type GrabCutSubjectInfo,
} from "./grabcutWorkerClient";
import { createHsvMask, createLabMask, getSeedMedianRgb, recolorRgb } from "./colorMethods";
import {
  recolorHsvHue,
  recolorLabLuma,
  recolorLumaColorize,
  recolorSolid,
} from "./recolorMethods";
import type { ImageLike, ImagePoint, MethodId, RgbColor } from "./types";

export type ProcessOptions = {
  image: ImageLike;
  methodId: MethodId;
  seed: ImagePoint;
  replacement: RgbColor;
  tolerance: number;
  imageKey: string;
  fixedMask?: Uint8Array | null;
  onWorkerStatus?: (status: GrabCutProcessingStatus) => void;
  onSubjectInfo?: (info: GrabCutSubjectInfo) => void;
  onLineArtInfo?: (info: GrabCutLineArtInfo) => void;
};

export function processComparisonMethod({
  image,
  methodId,
  seed,
  replacement,
  tolerance,
  imageKey,
  fixedMask,
  onWorkerStatus,
  onSubjectInfo,
  onLineArtInfo,
}: ProcessOptions): ImageLike | Promise<ImageLike> {
  if (methodId === "color-rgb") return recolorRgb(image, seed, replacement, tolerance);

  if (
    methodId === "mask-grabcut" ||
    methodId === "mask-grabcut-fast" ||
    methodId === "mask-grabcut-subject" ||
    methodId === "mask-grabcut-lineart"
  ) {
    return processGrabCutMask(image, methodId, seed, tolerance, imageKey, onWorkerStatus).then(
      ({ mask, subjectInfo, lineArtInfo }) => {
        if (subjectInfo) onSubjectInfo?.(subjectInfo);
        if (lineArtInfo) onLineArtInfo?.(lineArtInfo);
        return recolorSolid(image, mask, replacement);
      },
    );
  }

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
  if (methodId === "recolor-luma-colorize") return recolorLumaColorize(image, mask, replacement);
  if (methodId === "recolor-hsv-hue") {
    return recolorHsvHue(image, mask, getSeedMedianRgb(image, seed), replacement);
  }
  return recolorSolid(image, mask, replacement);
}
