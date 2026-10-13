import openCvUrl from "@techstark/opencv-js/dist/opencv.js?url";
import type { CV } from "@techstark/opencv-js";
import {
  DEFAULT_SHADOW_LINE_THRESHOLD,
  createShadowNormalizedLineArtPixels,
} from "../app/lineArt";
import { connectedRegionFromSeed } from "./boundaryMethods";
import { createHsvMask } from "./colorMethods";
import {
  createSubjectGrabCutInitializationMask,
  getGrabCutSubjectFailureReason,
  isSeedDiscInsideDilatedForeground,
  resizeBinaryMaskBilinear,
  resizeLabelsNearest,
  type GrabCutSubjectRect,
} from "./grabcutHelpers";
import { createGrabCutInitializationMask } from "./grabcutMethod";
import {
  createLineArtVotingRegion,
  findNonLineRegions,
  resolveLinePixels,
  voteNonLineRegions,
  type LineArtRegionStats,
} from "./grabcutLineArt";
import type { ImageLike, ImagePoint } from "./types";

const SEED_RADIUS = 4;
const GRABCUT_ITERATIONS = 4;
const FAST_MAX_EDGE = 512;

type GrabCutMethodId =
  | "mask-grabcut"
  | "mask-grabcut-fast"
  | "mask-grabcut-subject"
  | "mask-grabcut-lineart";
type SubjectStage1Info =
  | { used: true; foregroundRatio: number }
  | { used: false; reason: string };
type GrabCutRequest = {
  id: number;
  methodId: GrabCutMethodId;
  width: number;
  height: number;
  pixels: ArrayBuffer;
  seed: ImagePoint;
  tolerance: number;
  imageKey: string;
};
type GrabCutResult = {
  mask: Uint8Array;
  subjectInfo?: SubjectStage1Info;
  lineArtInfo?: LineArtRegionStats;
};
type GrabCutResponse =
  | { id: number; type: "status"; status: "initializing" | "processing" }
  | {
      id: number;
      type: "result";
      mask: ArrayBuffer;
      subjectInfo?: SubjectStage1Info;
      lineArtInfo?: LineArtRegionStats;
    }
  | { id: number; type: "error"; error: string };

type CvMat = InstanceType<CV["Mat"]>;
type OpenCvRuntime = CV & {
  onAbort?: (reason?: unknown) => void;
  onRuntimeInitialized?: () => void;
};
type OpenCvModule = OpenCvRuntime | Promise<OpenCvRuntime>;
type GrabCutWorkerScope = {
  cv?: OpenCvModule;
  onmessage: ((event: MessageEvent<GrabCutRequest>) => void) | null;
  postMessage(message: GrabCutResponse, transfer?: Transferable[]): void;
};
type CachedSubject = {
  foregroundMask: Uint8Array;
  foregroundRatio: number;
  failureReason: string | null;
};

const workerScope = self as unknown as GrabCutWorkerScope;
const subjectMaskCache = new Map<string, CachedSubject>();
let openCvPromise: Promise<{ cv: CV }> | undefined;

function loadOpenCv(): Promise<{ cv: CV }> {
  if (!openCvPromise) {
    openCvPromise = (async () => {
      const response = await fetch(openCvUrl);
      if (!response.ok) throw new Error("OpenCV.jsの取得に失敗しました。");
      (0, eval)(await response.text());

      const cvModule = workerScope.cv;
      if (!cvModule) throw new Error("OpenCVの初期化に失敗しました。");
      if (cvModule instanceof Promise) {
        return await new Promise<{ cv: CV }>((resolve, reject) => {
          void cvModule.then((cv) => resolve({ cv }), reject);
        });
      }
      if (typeof cvModule.Mat === "function") return { cv: cvModule };

      return await new Promise<{ cv: CV }>((resolve, reject) => {
        cvModule.onRuntimeInitialized = () => resolve({ cv: cvModule });
        cvModule.onAbort = (reason) =>
          reject(new Error("OpenCV runtime aborted: " + String(reason ?? "unknown error")));
      });
    })().catch((error: unknown) => {
      openCvPromise = undefined;
      throw error;
    });
  }
  return openCvPromise;
}

function createRgbMat(image: ImageLike, cv: CV): CvMat {
  const mat = new cv.Mat(image.height, image.width, cv.CV_8UC3);
  for (let pixel = 0; pixel < image.width * image.height; pixel += 1) {
    const rgbaIndex = pixel * 4;
    const rgbIndex = pixel * 3;
    mat.data[rgbIndex] = image.data[rgbaIndex];
    mat.data[rgbIndex + 1] = image.data[rgbaIndex + 1];
    mat.data[rgbIndex + 2] = image.data[rgbaIndex + 2];
  }
  return mat;
}

function createImageLike(mat: CvMat): ImageLike {
  const data = new Uint8ClampedArray(mat.rows * mat.cols * 4);
  for (let pixel = 0; pixel < mat.rows * mat.cols; pixel += 1) {
    const rgbIndex = pixel * 3;
    const rgbaIndex = pixel * 4;
    data[rgbaIndex] = mat.data[rgbIndex];
    data[rgbaIndex + 1] = mat.data[rgbIndex + 1];
    data[rgbaIndex + 2] = mat.data[rgbIndex + 2];
    data[rgbaIndex + 3] = 255;
  }
  return { width: mat.cols, height: mat.rows, data };
}

function runGrabCut(
  image: CvMat,
  initialMask: Uint8Array,
  rect: GrabCutSubjectRect | null,
  mode: number,
  cv: CV,
): Uint8Array {
  const mats: CvMat[] = [];
  try {
    const mask = new cv.Mat(image.rows, image.cols, cv.CV_8UC1);
    mats.push(mask);
    mask.data.set(initialMask);
    const backgroundModel = new cv.Mat();
    mats.push(backgroundModel);
    const foregroundModel = new cv.Mat();
    mats.push(foregroundModel);

    cv.grabCut(
      image,
      mask,
      rect ? new cv.Rect(rect.x, rect.y, rect.width, rect.height) : new cv.Rect(0, 0, 0, 0),
      backgroundModel,
      foregroundModel,
      GRABCUT_ITERATIONS,
      mode,
    );
    return new Uint8Array(mask.data);
  } finally {
    for (const mat of mats.reverse()) mat.delete();
  }
}

function foregroundFromGrabCut(mask: Uint8Array, cv: CV): Uint8Array {
  const foreground = new Uint8Array(mask.length);
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    foreground[pixel] = mask[pixel] === cv.GC_FGD || mask[pixel] === cv.GC_PR_FGD ? 1 : 0;
  }
  return foreground;
}

function createScaledDimensions(width: number, height: number) {
  const scale = Math.min(1, FAST_MAX_EDGE / Math.max(width, height));
  const scaledWidth = Math.max(1, Math.round(width * scale));
  const scaledHeight = Math.max(1, Math.round(height * scale));
  return {
    width: scaledWidth,
    height: scaledHeight,
    scale: Math.min(scaledWidth / width, scaledHeight / height),
  };
}

function resizeImage(
  image: CvMat,
  width: number,
  height: number,
  cv: CV,
  mats: CvMat[],
): CvMat {
  if (width === image.cols && height === image.rows) return image;
  const resized = new cv.Mat();
  mats.push(resized);
  cv.resize(image, resized, new cv.Size(width, height), 0, 0, cv.INTER_AREA);
  return resized;
}

function restoreMask(mask: Uint8Array, request: GrabCutRequest, width: number, height: number) {
  return width === request.width && height === request.height
    ? mask
    : resizeBinaryMaskBilinear(mask, width, height, request.width, request.height);
}

function applyLineArtRegionVoting(
  image: ImageLike,
  grabCutMask: Uint8Array,
  subjectForeground: Uint8Array | null,
) {
  const votingRegion = createLineArtVotingRegion(subjectForeground, image.width, image.height);
  const lineArtPixels = createShadowNormalizedLineArtPixels(
    image.data,
    image.width,
    image.height,
    DEFAULT_SHADOW_LINE_THRESHOLD,
  );
  const lineMask = new Uint8Array(grabCutMask.length);
  for (let pixel = 0; pixel < lineMask.length; pixel += 1) {
    lineMask[pixel] = votingRegion[pixel] === 1 && lineArtPixels[pixel * 4] === 0 ? 1 : 0;
  }
  const regions = findNonLineRegions(votingRegion, lineMask, image.width, image.height);
  const { mask, stats } = voteNonLineRegions(grabCutMask, regions);
  return {
    mask: resolveLinePixels(
      grabCutMask,
      mask,
      votingRegion,
      lineMask,
      image.width,
      image.height,
    ),
    stats,
  };
}

function restoreSubjectMask(
  mask: Uint8Array,
  request: GrabCutRequest,
  processingImage: CvMat,
  subjectForeground: Uint8Array | null,
  width: number,
  height: number,
): Pick<GrabCutResult, "mask" | "lineArtInfo"> {
  if (request.methodId === "mask-grabcut-lineart") {
    const lineArt = applyLineArtRegionVoting(
      createImageLike(processingImage),
      mask,
      subjectForeground,
    );
    return {
      mask: restoreMask(lineArt.mask, request, width, height),
      lineArtInfo: lineArt.stats,
    };
  }
  return { mask: restoreMask(mask, request, width, height) };
}

function createFastInitializationMask(
  image: ImageLike,
  seed: ImagePoint,
  tolerance: number,
  scale: number,
  width: number,
  height: number,
) {
  const hsvMask = createHsvMask(image, seed, tolerance);
  const candidateMask = connectedRegionFromSeed(
    hsvMask,
    new Uint8Array(hsvMask.length),
    image.width,
    image.height,
    seed,
  );
  const initialMask = createGrabCutInitializationMask(
    image,
    candidateMask,
    seed,
    Math.max(SEED_RADIUS, 2 / scale),
  );
  return width === image.width && height === image.height
    ? initialMask
    : resizeLabelsNearest(initialMask, image.width, image.height, width, height);
}

function createSubjectRect(width: number, height: number): GrabCutSubjectRect {
  const insetX = Math.min(Math.max(1, Math.floor(width * 0.02)), Math.floor(width / 2));
  const insetY = Math.min(Math.max(1, Math.floor(height * 0.02)), Math.floor(height / 2));
  return {
    x: insetX,
    y: insetY,
    width: Math.max(1, width - insetX * 2),
    height: Math.max(1, height - insetY * 2),
  };
}

function getCachedSubject(
  request: GrabCutRequest,
  processingImage: CvMat,
  width: number,
  height: number,
  cv: CV,
): CachedSubject {
  const cacheKey = `${request.imageKey}\u0000${width}x${height}`;
  const cached = subjectMaskCache.get(cacheKey);
  if (cached) return cached;

  const rect = createSubjectRect(width, height);
  const rectangleLabels = new Uint8Array(width * height);
  const rawMask = runGrabCut(processingImage, rectangleLabels, rect, cv.GC_INIT_WITH_RECT, cv);
  const foregroundMask = foregroundFromGrabCut(rawMask, cv);
  let foregroundPixels = 0;
  for (const pixel of foregroundMask) foregroundPixels += pixel;
  const foregroundRatio = foregroundPixels / (width * height);
  const result: CachedSubject = {
    foregroundMask,
    foregroundRatio,
    failureReason: getGrabCutSubjectFailureReason(foregroundMask, width, height, rect),
  };
  subjectMaskCache.set(cacheKey, result);
  return result;
}

function processFullResolutionRequest(request: GrabCutRequest, cv: CV, image: ImageLike): GrabCutResult {
  const rgbImage = createRgbMat(image, cv);
  try {
    const initialMask = createFastInitializationMask(
      image,
      request.seed,
      request.tolerance,
      1,
      image.width,
      image.height,
    );
    return {
      mask: foregroundFromGrabCut(
        runGrabCut(rgbImage, initialMask, null, cv.GC_INIT_WITH_MASK, cv),
        cv,
      ),
    };
  } finally {
    rgbImage.delete();
  }
}

function processScaledRequest(request: GrabCutRequest, cv: CV, image: ImageLike): GrabCutResult {
  const dimensions = createScaledDimensions(image.width, image.height);
  const mats: CvMat[] = [];
  try {
    const rgbImage = createRgbMat(image, cv);
    mats.push(rgbImage);
    const processingImage = resizeImage(
      rgbImage,
      dimensions.width,
      dimensions.height,
      cv,
      mats,
    );

    if (request.methodId === "mask-grabcut-fast") {
      const initialMask = createFastInitializationMask(
        image,
        request.seed,
        request.tolerance,
        dimensions.scale,
        dimensions.width,
        dimensions.height,
      );
      const mask = foregroundFromGrabCut(
        runGrabCut(processingImage, initialMask, null, cv.GC_INIT_WITH_MASK, cv),
        cv,
      );
      return { mask: restoreMask(mask, request, dimensions.width, dimensions.height) };
    }

    const subject = getCachedSubject(
      request,
      processingImage,
      dimensions.width,
      dimensions.height,
      cv,
    );
    const scaledSeed: ImagePoint = [
      Math.floor((request.seed[0] * dimensions.width) / image.width),
      Math.floor((request.seed[1] * dimensions.height) / image.height),
    ];
    const seedRadius = Math.max(2, SEED_RADIUS * dimensions.scale);
    const failureReason =
      subject.failureReason ??
      (isSeedDiscInsideDilatedForeground(
        subject.foregroundMask,
        dimensions.width,
        dimensions.height,
        scaledSeed,
        seedRadius,
      )
        ? null
        : "クリック位置が被写体の外のため段1なし");
    if (failureReason) {
      const initialMask = createFastInitializationMask(
        image,
        request.seed,
        request.tolerance,
        dimensions.scale,
        dimensions.width,
        dimensions.height,
      );
      const mask = foregroundFromGrabCut(
        runGrabCut(processingImage, initialMask, null, cv.GC_INIT_WITH_MASK, cv),
        cv,
      );
      return {
        ...restoreSubjectMask(
          mask,
          request,
          processingImage,
          null,
          dimensions.width,
          dimensions.height,
        ),
        subjectInfo: { used: false, reason: failureReason },
      };
    }

    const scaledImage = createImageLike(processingImage);
    const hsvMask = createHsvMask(scaledImage, scaledSeed, request.tolerance);
    for (let pixel = 0; pixel < hsvMask.length; pixel += 1) {
      if (subject.foregroundMask[pixel] === 0) hsvMask[pixel] = 0;
    }
    const candidateMask = connectedRegionFromSeed(
      hsvMask,
      new Uint8Array(hsvMask.length),
      dimensions.width,
      dimensions.height,
      scaledSeed,
    );
    const initialMask = createSubjectGrabCutInitializationMask(
      subject.foregroundMask,
      candidateMask,
      dimensions.width,
      dimensions.height,
      scaledSeed,
      seedRadius,
    );
    const mask = foregroundFromGrabCut(
      runGrabCut(processingImage, initialMask, null, cv.GC_INIT_WITH_MASK, cv),
      cv,
    );
    return {
      ...restoreSubjectMask(
        mask,
        request,
        processingImage,
        subject.foregroundMask,
        dimensions.width,
        dimensions.height,
      ),
      subjectInfo: { used: true, foregroundRatio: subject.foregroundRatio },
    };
  } finally {
    for (const mat of mats.reverse()) mat.delete();
  }
}

function processRequest(request: GrabCutRequest, cv: CV): GrabCutResult {
  const image: ImageLike = {
    width: request.width,
    height: request.height,
    data: new Uint8ClampedArray(request.pixels),
  };
  return request.methodId === "mask-grabcut"
    ? processFullResolutionRequest(request, cv, image)
    : processScaledRequest(request, cv, image);
}

workerScope.onmessage = (event: MessageEvent<GrabCutRequest>) => {
  const request = event.data;
  const post = (message: GrabCutResponse, transfer: Transferable[] = []) =>
    workerScope.postMessage(message, transfer);

  void (async () => {
    try {
      if (!openCvPromise) post({ id: request.id, type: "status", status: "initializing" });
      const { cv } = await loadOpenCv();
      post({ id: request.id, type: "status", status: "processing" });
      const result = processRequest(request, cv);
      const buffer = result.mask.buffer as ArrayBuffer;
      post(
        {
          id: request.id,
          type: "result",
          mask: buffer,
          subjectInfo: result.subjectInfo,
          lineArtInfo: result.lineArtInfo,
        },
        [buffer],
      );
    } catch (error) {
      post({
        id: request.id,
        type: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  })();
};
