import { describe, expect, it } from "vitest";
import { createGrabCutInitializationMask } from "./grabcutMethod";
import type { ImageLike } from "./types";

describe("GrabCut初期化マスク", () => {
  it("seed接続HSV候補・画像端・seed近傍を別のクラスにする", () => {
    const image: ImageLike = {
      width: 7,
      height: 7,
      data: new Uint8ClampedArray(7 * 7 * 4),
    };
    const hsvMask = new Uint8Array(7 * 7);
    hsvMask[3 * 7 + 3] = 1;
    hsvMask[3 * 7 + 4] = 1;
    hsvMask[3 * 7 + 5] = 1;
    hsvMask[2 * 7 + 5] = 1;
    hsvMask[2 * 7 + 2] = 1;
    hsvMask[0] = 1;

    const mask = createGrabCutInitializationMask(image, hsvMask, [3, 3], 1);

    expect(mask[3 * 7 + 3]).toBe(1);
    expect(mask[3 * 7 + 4]).toBe(1);
    expect(mask[3 * 7 + 5]).toBe(3);
    expect(mask[2 * 7 + 5]).toBe(3);
    expect(mask[2 * 7 + 2]).toBe(2);
    expect(mask[0]).toBe(0);
    expect(mask[1]).toBe(0);
    expect(mask[1 * 7 + 1]).toBe(2);
  });
});
