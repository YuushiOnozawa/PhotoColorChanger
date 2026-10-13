import type { ImageLike, ImagePoint } from "./types";

export type GrabCutProcessingStatus = "initializing" | "processing";
export type GrabCutSubjectInfo =
  | { used: true; foregroundRatio: number }
  | { used: false; reason: string };
export type GrabCutMethodId = "mask-grabcut" | "mask-grabcut-fast" | "mask-grabcut-subject";
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
type GrabCutResponse =
  | { id: number; type: "status"; status: GrabCutProcessingStatus }
  | { id: number; type: "result"; mask: ArrayBuffer; subjectInfo?: GrabCutSubjectInfo }
  | { id: number; type: "error"; error: string };
type GrabCutResult = { mask: Uint8Array; subjectInfo?: GrabCutSubjectInfo };
type PendingRequest = {
  resolve: (result: GrabCutResult) => void;
  reject: (error: Error) => void;
  onStatus?: (status: GrabCutProcessingStatus) => void;
};

let worker: Worker | undefined;
let workerReady = false;
let workerFailure: Error | undefined;
let nextRequestId = 1;
const pendingRequests = new Map<number, PendingRequest>();

function rejectPending(error: Error) {
  workerFailure = error;
  for (const pending of pendingRequests.values()) pending.reject(error);
  pendingRequests.clear();
}

function getWorker(): Worker {
  if (workerFailure) throw workerFailure;
  if (!worker) {
    worker = new Worker(new URL("./grabcut.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<GrabCutResponse>) => {
      const response = event.data;
      const pending = pendingRequests.get(response.id);
      if (!pending) return;
      if (response.type === "status") {
        if (response.status === "processing") workerReady = true;
        pending.onStatus?.(response.status);
      } else {
        pendingRequests.delete(response.id);
        if (response.type === "result") {
          pending.resolve({ mask: new Uint8Array(response.mask), subjectInfo: response.subjectInfo });
        }
        else pending.reject(new Error(response.error));
      }
    };
    worker.onerror = (event) => {
      rejectPending(new Error(event.message || "GrabCut Workerでエラーが発生しました。"));
    };
    worker.onmessageerror = () => {
      rejectPending(new Error("GrabCut Workerの応答を読み取れませんでした。"));
    };
  }
  return worker;
}

export function processGrabCutMask(
  image: ImageLike,
  methodId: GrabCutMethodId,
  seed: ImagePoint,
  tolerance: number,
  imageKey: string,
  onStatus?: (status: GrabCutProcessingStatus) => void,
): Promise<GrabCutResult> {
  const currentWorker = getWorker();
  const id = nextRequestId++;
  const pixels = new Uint8ClampedArray(image.data);
  return new Promise<GrabCutResult>((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject, onStatus });
    if (!workerReady) onStatus?.("initializing");
    try {
      const request: GrabCutRequest = {
        id,
        methodId,
        width: image.width,
        height: image.height,
        pixels: pixels.buffer,
        seed,
        tolerance,
        imageKey,
      };
      currentWorker.postMessage(request, [pixels.buffer]);
    } catch (error) {
      pendingRequests.delete(id);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
