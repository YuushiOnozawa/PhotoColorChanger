import openCvUrl from "@techstark/opencv-js/dist/opencv.js?url";
import type { CV } from "@techstark/opencv-js";
import { connectedRegionFromSeed } from "./boundaryMethods";
import { createHsvMask } from "./colorMethods";
import { computeGrabCutRoi, resizeBinaryMaskBilinear, resizeLabelsNearest } from "./grabcutHelpers";
import { createGrabCutInitializationMask } from "./grabcutMethod";
import type { ImageLike, ImagePoint } from "./types";

const SEED_RADIUS = 4;
const GRABCUT_ITERATIONS = 4;
const FAST_MAX_EDGE = 512;

type GrabCutMethodId = "mask-grabcut" | "mask-grabcut-fast";
type GrabCutRequest = {
  id: number;
  methodId: GrabCutMethodId;
  width: number;
  height: number;
  pixels: ArrayBuffer;
  seed: ImagePoint;
  tolerance: number;
};
type GrabCutResponse =
  | { id: number; type: "status"; status: "initializing" | "processing" }
  | { id: number; type: "result"; mask: ArrayBuffer }
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
const workerScope = self as unknown as GrabCutWorkerScope;

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

function cropPixels(image: ImageLike, x: number, y: number, width: number, height: number) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    const sourceStart = ((y + row) * image.width + x) * 4;
    data.set(image.data.subarray(sourceStart, sourceStart + width * 4), row * width * 4);
  }
  return data;
}

function cropMask(mask: Uint8Array, imageWidth: number, x: number, y: number, width: number, height: number) {
  const result = new Uint8Array(width * height);
  for (let row = 0; row < height; row += 1) {
    const sourceStart = (y + row) * imageWidth + x;
    result.set(mask.subarray(sourceStart, sourceStart + width), row * width);
  }
  return result;
}

function processRequest(request: GrabCutRequest, cv: CV): Uint8Array {
  const image: ImageLike = {
    width: request.width,
    height: request.height,
    data: new Uint8ClampedArray(request.pixels),
  };
  const hsvMask = createHsvMask(image, request.seed, request.tolerance);
  const candidateMask = connectedRegionFromSeed(
    hsvMask,
    new Uint8Array(hsvMask.length),
    image.width,
    image.height,
    request.seed,
  );
  const roi =
    request.methodId === "mask-grabcut-fast"
      ? computeGrabCutRoi(candidateMask, image.width, image.height, request.seed)
      : { x: 0, y: 0, width: image.width, height: image.height };
  const scale =
    request.methodId === "mask-grabcut-fast"
      ? Math.min(1, FAST_MAX_EDGE / Math.max(roi.width, roi.height))
      : 1;
  const scaledWidth = Math.max(1, Math.round(roi.width * scale));
  const scaledHeight = Math.max(1, Math.round(roi.height * scale));
  const actualScale = Math.min(scaledWidth / roi.width, scaledHeight / roi.height);
  const roiImage: ImageLike = {
    width: roi.width,
    height: roi.height,
    data: cropPixels(image, roi.x, roi.y, roi.width, roi.height),
  };
  const roiCandidate = cropMask(candidateMask, image.width, roi.x, roi.y, roi.width, roi.height);
  const initializationMask = createGrabCutInitializationMask(
    roiImage,
    roiCandidate,
    [request.seed[0] - roi.x, request.seed[1] - roi.y],
    Math.max(SEED_RADIUS, 2 / actualScale),
    { x: roi.x, y: roi.y, imageWidth: image.width, imageHeight: image.height },
  );
  const scaledInitializationMask =
    scaledWidth === roi.width && scaledHeight === roi.height
      ? initializationMask
      : resizeLabelsNearest(initializationMask, roi.width, roi.height, scaledWidth, scaledHeight);
  const rgbData = new Uint8Array(roi.width * roi.height * 3);
  for (let pixel = 0; pixel < roi.width * roi.height; pixel += 1) {
    const rgbaIndex = pixel * 4;
    const rgbIndex = pixel * 3;
    rgbData[rgbIndex] = roiImage.data[rgbaIndex];
    rgbData[rgbIndex + 1] = roiImage.data[rgbaIndex + 1];
    rgbData[rgbIndex + 2] = roiImage.data[rgbaIndex + 2];
  }

  const mats: CvMat[] = [];
  try {
    const imageMat = new cv.Mat(roi.height, roi.width, cv.CV_8UC3);
    mats.push(imageMat);
    imageMat.data.set(rgbData);
    let processingImage = imageMat;
    if (scaledWidth !== roi.width || scaledHeight !== roi.height) {
      processingImage = new cv.Mat();
      mats.push(processingImage);
      cv.resize(
        imageMat,
        processingImage,
        new cv.Size(scaledWidth, scaledHeight),
        0,
        0,
        cv.INTER_AREA,
      );
    }

    const maskMat = new cv.Mat(scaledHeight, scaledWidth, cv.CV_8UC1);
    mats.push(maskMat);
    maskMat.data.set(scaledInitializationMask);
    const backgroundModel = new cv.Mat();
    mats.push(backgroundModel);
    const foregroundModel = new cv.Mat();
    mats.push(foregroundModel);

    cv.grabCut(
      processingImage,
      maskMat,
      new cv.Rect(0, 0, 0, 0),
      backgroundModel,
      foregroundModel,
      GRABCUT_ITERATIONS,
      cv.GC_INIT_WITH_MASK,
    );

    const scaledMask = new Uint8Array(scaledInitializationMask.length);
    for (let pixel = 0; pixel < scaledMask.length; pixel += 1) {
      scaledMask[pixel] =
        maskMat.data[pixel] === cv.GC_FGD || maskMat.data[pixel] === cv.GC_PR_FGD ? 1 : 0;
    }
    const roiMask =
      scaledWidth === roi.width && scaledHeight === roi.height
        ? scaledMask
        : resizeBinaryMaskBilinear(scaledMask, scaledWidth, scaledHeight, roi.width, roi.height);
    const fullMask = new Uint8Array(image.width * image.height);
    for (let row = 0; row < roi.height; row += 1) {
      const sourceStart = row * roi.width;
      const destinationStart = (roi.y + row) * image.width + roi.x;
      fullMask.set(roiMask.subarray(sourceStart, sourceStart + roi.width), destinationStart);
    }
    return fullMask;
  } finally {
    for (const mat of mats.reverse()) mat.delete();
  }
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
      const mask = processRequest(request, cv);
      const buffer = mask.buffer as ArrayBuffer;
      post({ id: request.id, type: "result", mask: buffer }, [buffer]);
    } catch (error) {
      post({
        id: request.id,
        type: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  })();
};
