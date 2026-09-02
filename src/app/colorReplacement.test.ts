import { describe, expect, it } from "vitest";
import { hexToRgb } from "./color";
import { createConnectedRegionMask, replaceSimilarColors } from "./colorReplacement";

describe("近似色の置換", () => {
  it("完全一致は許容範囲0でも置換し、元の配列を変更しない", () => {
    const pixels = new Uint8ClampedArray([154, 86, 52, 255, 155, 86, 52, 255]);

    const replaced = replaceSimilarColors(pixels, [154, 86, 52], [51, 102, 153], 0);

    expect(Array.from(replaced)).toEqual([51, 102, 153, 255, 155, 86, 52, 255]);
    expect(Array.from(pixels)).toEqual([154, 86, 52, 255, 155, 86, 52, 255]);
  });

  it("許容範囲内の色だけを置換し、アルファ値を保持する", () => {
    const pixels = new Uint8ClampedArray([154, 86, 52, 128, 160, 90, 55, 255, 0, 0, 0, 255]);

    const replaced = replaceSimilarColors(pixels, [154, 86, 52], [51, 102, 153], 5);

    expect(Array.from(replaced)).toEqual([51, 102, 153, 128, 51, 102, 153, 255, 0, 0, 0, 255]);
  });

  it("クリック地点から連結した領域だけを置換する", () => {
    const pixels = new Uint8ClampedArray(5 * 3 * 4);
    for (let index = 0; index < pixels.length; index += 4) {
      const isBoundary = index % (5 * 4) === 8;
      const color = isBoundary ? 0 : 100;
      pixels[index] = color;
      pixels[index + 1] = color;
      pixels[index + 2] = color;
      pixels[index + 3] = 255;
    }

    const regionMask = createConnectedRegionMask(pixels, 5, 3, [100, 100, 100], [0, 1], 10, 20);
    const replaced = replaceSimilarColors(pixels, [100, 100, 100], [51, 102, 153], 10, regionMask);

    expect(Array.from(regionMask.slice(5, 10))).toEqual([1, 1, 0, 0, 0]);
    expect(Array.from(replaced.slice(4, 20))).toEqual([
      51, 102, 153, 255, 0, 0, 0, 255, 100, 100, 100, 255, 100, 100, 100, 255,
    ]);
  });
});

describe("HEX色の変換", () => {
  it("6桁のHEX値をRGBへ変換する", () => {
    expect(hexToRgb("#9a5634")).toEqual([154, 86, 52]);
    expect(hexToRgb("#336699")).toEqual([51, 102, 153]);
  });
});
