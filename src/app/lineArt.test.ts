import { describe, expect, it } from "vitest";
import {
  createLineArtPixels,
  createShadowNormalizedLineArtPixels,
  createXdogPixels,
} from "./lineArt";

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

  it("明るさが近い色の境界も線として抽出する", () => {
    const pixels = new Uint8ClampedArray(3 * 3 * 4);
    for (let index = 0; index < pixels.length; index += 4) {
      const color = index % (3 * 4) === 8 ? [0, 170, 0] : [100, 100, 100];
      pixels[index] = color[0];
      pixels[index + 1] = color[1];
      pixels[index + 2] = color[2];
      pixels[index + 3] = 255;
    }

    const result = createLineArtPixels(pixels, 3, 3, 4, 50);
    const withoutColorEdge = createLineArtPixels(pixels, 3, 3, 4, 0);

    expect(result[(1 * 3 + 1) * 4]).toBe(0);
    expect(withoutColorEdge[(1 * 3 + 1) * 4]).toBe(255);
  });

  it("影補正で平坦な暗部を線として埋めない", () => {
    const width = 32;
    const height = 32;
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let index = 0; index < pixels.length; index += 4) {
      pixels[index] = 64;
      pixels[index + 1] = 64;
      pixels[index + 2] = 64;
      pixels[index + 3] = 255;
    }

    const result = createShadowNormalizedLineArtPixels(pixels, width, height, 30);

    expect(Array.from(result).every((value, index) => index % 4 === 3 || value === 255)).toBe(true);
  });

  it("影補正後も明暗の境界を線として残す", () => {
    const width = 32;
    const height = 32;
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const value = x < width / 2 ? 64 : 192;
        const index = (y * width + x) * 4;
        pixels[index] = value;
        pixels[index + 1] = value;
        pixels[index + 2] = value;
        pixels[index + 3] = 255;
      }
    }

    const result = createShadowNormalizedLineArtPixels(pixels, width, height, 10);

    expect(result[(16 * width + 15) * 4]).toBe(0);
  });

  it("XDoGで明暗の境界を線として抽出する", () => {
    const pixels = new Uint8ClampedArray(3 * 3 * 4);
    for (let index = 0; index < pixels.length; index += 4) {
      const isRight = index % (3 * 4) === 8;
      pixels[index] = isRight ? 255 : 0;
      pixels[index + 1] = pixels[index];
      pixels[index + 2] = pixels[index];
      pixels[index + 3] = 255;
    }

    const result = createXdogPixels(pixels, 3, 3, 10);

    expect(Array.from(result).some((value, index) => index % 4 !== 3 && value < 128)).toBe(true);
  });
});
