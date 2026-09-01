import { describe, expect, it } from "vitest";
import { createLineArtPixels } from "./lineArt";

describe("線画抽出", () => {
  it("平坦な画像には線を生成しない", () => {
    const pixels = new Uint8ClampedArray(3 * 3 * 4).fill(128);

    const result = createLineArtPixels(pixels, 3, 3, 1);

    expect(Array.from(result).every((value, index) => index % 4 === 3 || value === 255)).toBe(true);
  });

  it("明暗の境界を線として抽出する", () => {
    const pixels = new Uint8ClampedArray(3 * 3 * 4);
    for (let index = 0; index < pixels.length; index += 4) {
      const isRight = index % (3 * 4) === 8;
      pixels[index] = isRight ? 255 : 0;
      pixels[index + 1] = pixels[index];
      pixels[index + 2] = pixels[index];
      pixels[index + 3] = 255;
    }

    const result = createLineArtPixels(pixels, 3, 3, 1);

    expect(result[4 * 1 + 0]).toBe(0);
  });
});
