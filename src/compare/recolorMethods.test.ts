import { describe, expect, it } from "vitest";
import { rgbToHsv, rgbToLab } from "./colorSpaces";
import {
  recolorHsvHue,
  recolorLabLuma,
  recolorLumaColorize,
  recolorSolid,
} from "./recolorMethods";
import type { ImageLike } from "./types";

function onePixel(color: readonly [number, number, number]): ImageLike {
  return { width: 1, height: 1, data: new Uint8ClampedArray([...color, 255]) };
}

describe("再着色アルゴリズム", () => {
  it("単色置換はmask内だけを変えてαを保つ", () => {
    const image = {
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([20, 40, 60, 127, 90, 80, 70, 255]),
    };

    const result = recolorSolid(image, new Uint8Array([1, 0]), [47, 111, 219]);

    expect(Array.from(result.data)).toEqual([47, 111, 219, 127, 90, 80, 70, 255]);
  });

  it("Lab再着色は画素のL*を保つ", () => {
    const image = onePixel([160, 80, 50]);
    const result = recolorLabLuma(image, new Uint8Array([1]), [47, 111, 219]);
    const beforeL = rgbToLab([160, 80, 50])[0];
    const afterL = rgbToLab([result.data[0], result.data[1], result.data[2]])[0];

    expect(Math.abs(afterL - beforeL)).toBeLessThan(1);
  });

  it("陰影保持カラー化はマスク内平均L*を基準に色を付け、局所差と外側を保つ", () => {
    const image = {
      width: 3,
      height: 1,
      data: new Uint8ClampedArray([128, 128, 128, 255, 144, 144, 144, 255, 90, 90, 90, 255]),
    };
    const mask = new Uint8Array([1, 1, 0]);
    const result = recolorLumaColorize(image, mask, [110, 150, 125]);
    const beforeFirstL = rgbToLab([128, 128, 128])[0];
    const beforeSecondL = rgbToLab([144, 144, 144])[0];
    const afterFirstL = rgbToLab([result.data[0], result.data[1], result.data[2]])[0];
    const afterSecondL = rgbToLab([result.data[4], result.data[5], result.data[6]])[0];

    expect(result.data[0] === result.data[1] && result.data[1] === result.data[2]).toBe(false);
    expect(Math.abs((afterSecondL - afterFirstL) - (beforeSecondL - beforeFirstL))).toBeLessThan(1);
    expect(Array.from(result.data.slice(8))).toEqual([90, 90, 90, 255]);
  });

  it("HSV色相シフトは彩度と明度を保つ", () => {
    const source: readonly [number, number, number] = [190, 88, 52];
    const image = onePixel(source);
    const result = recolorHsvHue(image, new Uint8Array([1]), source, [47, 111, 219]);
    const before = rgbToHsv(source);
    const after = rgbToHsv([result.data[0], result.data[1], result.data[2]]);

    expect(Math.abs(after[1] - before[1])).toBeLessThan(0.01);
    expect(Math.abs(after[2] - before[2])).toBeLessThan(0.01);
  });
});
