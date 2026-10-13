import { describe, expect, it } from "vitest";
import { createHsvMask, createLabMask, getSeedMedianRgb, recolorRgb } from "./colorMethods";
import type { ImageLike } from "./types";

function filledImage(
  width: number,
  height: number,
  color: readonly [number, number, number],
): ImageLike {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < data.length; index += 4) {
    data[index] = color[0];
    data[index + 1] = color[1];
    data[index + 2] = color[2];
    data[index + 3] = 255;
  }
  return { width, height, data };
}

describe("色判定アルゴリズム", () => {
  it("9×9近傍のチャンネル別中央値を使う", () => {
    const image = filledImage(9, 9, [120, 80, 40]);
    image.data[(4 * 9 + 4) * 4] = 255;
    image.data[(4 * 9 + 4) * 4 + 1] = 255;
    image.data[(4 * 9 + 4) * 4 + 2] = 255;

    expect(getSeedMedianRgb(image, [4, 4])).toEqual([120, 80, 40]);
  });

  it("RGB距離で近い画素だけを単色置換する", () => {
    const image = filledImage(9, 9, [100, 90, 80]);
    const near = (4 * 9 + 5) * 4;
    const far = (4 * 9 + 6) * 4;
    image.data.set([110, 90, 80, 255], near);
    image.data.set([220, 220, 220, 255], far);

    const result = recolorRgb(image, [4, 4], [47, 111, 219], 10);

    expect(Array.from(result.data.slice(near, near + 3))).toEqual([47, 111, 219]);
    expect(Array.from(result.data.slice(far, far + 3))).toEqual([220, 220, 220]);
  });

  it("HSV距離で赤の色相境界をまたぐ近似色を含める", () => {
    const image = filledImage(9, 9, [255, 0, 0]);
    const near = (4 * 9 + 5) * 4;
    const far = (4 * 9 + 6) * 4;
    image.data.set([255, 0, 24, 255], near);
    image.data.set([0, 0, 255, 255], far);

    const mask = createHsvMask(image, [4, 4], 5);

    expect(mask[near / 4]).toBe(1);
    expect(mask[far / 4]).toBe(0);
  });

  it("Labの明度重み付きΔEで許容差を判定する", () => {
    const image = filledImage(9, 9, [120, 120, 120]);
    const near = (4 * 9 + 5) * 4;
    const far = (4 * 9 + 6) * 4;
    image.data.set([128, 120, 120, 255], near);
    image.data.set([220, 220, 220, 255], far);

    const mask = createLabMask(image, [4, 4], 10);

    expect(mask[near / 4]).toBe(1);
    expect(mask[far / 4]).toBe(0);
  });
});
