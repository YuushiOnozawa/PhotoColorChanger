import openCvUrl from "@techstark/opencv-js/dist/opencv.js?url";
import type { CV } from "@techstark/opencv-js";
import { connectedRegionFromSeed } from "./boundaryMethods";
import { createHsvMask } from "./colorMethods";
import { recolorSolid } from "./recolorMethods";
import type { ImageLike, ImagePoint, RgbColor } from "./types";

const GC_BGD = 0;
const GC_FGD = 1;
const GC_PR_BGD = 2;
const GC_PR_FGD = 3;
const SEED_RADIUS = 4;
const GRABCUT_ITERATIONS = 4;

type CvMat = InstanceType<CV["Mat"]>;
type OpenCvRuntime = CV & {
  onAbort?: (reason?: unknown) => void;
  onRuntimeInitialized?: () => void;
};
type OpenCvModule = OpenCvRuntime | Promise<OpenCvRuntime>;

let openCvPromise: Promise<{ cv: CV }> | undefined;

function loadOpenCv(): Promise<{ cv: CV }> {
  if (!openCvPromise) {
    openCvPromise = new Promise<{ cv: CV }>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = openCvUrl;
      script.async = true;
      script.onload = () => {
        const cvModule = (window as typeof window & { cv?: OpenCvModule }).cv;
        if (!cvModule) {
          reject(new Error("OpenCV failed to initialize"));
          return;
        }
        if (cvModule instanceof Promise) {
          void cvModule.then((cv) => resolve({ cv }), reject);
        } else if (typeof cvModule.Mat === "function") {
          resolve({ cv: cvModule });
        } else {
          cvModule.onRuntimeInitialized = () => resolve({ cv: cvModule });
          cvModule.onAbort = (reason) =>
            reject(new Error("OpenCV runtime aborted: " + String(reason ?? "unknown error")));
        }
      };
      script.onerror = () => reject(new Error("Failed to load OpenCV script"));
      document.head.append(script);
    }).catch((error: unknown) => {
      openCvPromise = undefined;
      throw error;
    });
  }
  return openCvPromise;
}

export function createGrabCutInitializationMask(
  image: ImageLike,
  hsvMask: Uint8Array,
  seed: ImagePoint,
  radius = SEED_RADIUS,
): Uint8Array {
  const { width, height } = image;
  const seedX = Math.max(0, Math.min(width - 1, Math.floor(seed[0])));
  const seedY = Math.max(0, Math.min(height - 1, Math.floor(seed[1])));
  const connectedHsvMask = connectedRegionFromSeed(
    hsvMask,
    new Uint8Array(width * height),
    width,
    height,
    [seedX, seedY],
  );
  const result = new Uint8Array(width * height);
  result.fill(GC_PR_BGD);
  const radiusSquared = radius * radius;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      const seedDx = x - seedX;
      const seedDy = y - seedY;
      const withinSeedRadius = seedDx * seedDx + seedDy * seedDy <= radiusSquared;

      if (withinSeedRadius) result[pixel] = GC_FGD;
      else if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        result[pixel] = GC_BGD;
      } else if (connectedHsvMask[pixel] === 1) result[pixel] = GC_PR_FGD;
    }
  }

  return result;
}

export async function processGrabCut(
  image: ImageLike,
  seed: ImagePoint,
  tolerance: number,
  replacement: RgbColor,
): Promise<ImageLike> {
  const { cv } = await loadOpenCv();
  const hsvMask = createHsvMask(image, seed, tolerance);
  const initializationMask = createGrabCutInitializationMask(image, hsvMask, seed);
  const rgbData = new Uint8Array(image.width * image.height * 3);
  for (let pixel = 0; pixel < image.width * image.height; pixel += 1) {
    const rgbaIndex = pixel * 4;
    const rgbIndex = pixel * 3;
    rgbData[rgbIndex] = image.data[rgbaIndex];
    rgbData[rgbIndex + 1] = image.data[rgbaIndex + 1];
    rgbData[rgbIndex + 2] = image.data[rgbaIndex + 2];
  }

  const mats: CvMat[] = [];
  try {
    const imageMat = new cv.Mat(image.height, image.width, cv.CV_8UC3);
    mats.push(imageMat);
    imageMat.data.set(rgbData);

    const maskMat = new cv.Mat(image.height, image.width, cv.CV_8UC1);
    mats.push(maskMat);
    maskMat.data.set(initializationMask);

    const backgroundModel = new cv.Mat();
    mats.push(backgroundModel);
    const foregroundModel = new cv.Mat();
    mats.push(foregroundModel);
    const rectangle = new cv.Rect(0, 0, 0, 0);

    cv.grabCut(
      imageMat,
      maskMat,
      rectangle,
      backgroundModel,
      foregroundModel,
      GRABCUT_ITERATIONS,
      cv.GC_INIT_WITH_MASK,
    );

    const resultMask = new Uint8Array(initializationMask.length);
    for (let pixel = 0; pixel < resultMask.length; pixel += 1) {
      resultMask[pixel] =
        maskMat.data[pixel] === cv.GC_FGD || maskMat.data[pixel] === cv.GC_PR_FGD ? 1 : 0;
    }
    return recolorSolid(image, resultMask, replacement);
  } finally {
    for (const mat of mats.reverse()) mat.delete();
  }
}
