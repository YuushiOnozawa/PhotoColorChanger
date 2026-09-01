import { describe, expect, it } from "vitest";
import { hexToRgb } from "./color";
import { replaceSimilarColors } from "./colorReplacement";

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
});

describe("HEX色の変換", () => {
  it("6桁のHEX値をRGBへ変換する", () => {
    expect(hexToRgb("#9a5634")).toEqual([154, 86, 52]);
    expect(hexToRgb("#336699")).toEqual([51, 102, 153]);
  });
});
