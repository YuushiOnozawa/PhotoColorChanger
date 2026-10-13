import { describe, expect, it } from "vitest";
import { connectedRegionFromSeed } from "./boundaryMethods";

describe("境界制約アルゴリズム", () => {
  it("境界線を越えず、seedからつながった候補画素だけを選ぶ", () => {
    const width = 5;
    const height = 3;
    const candidates = new Uint8Array(width * height).fill(1);
    const boundary = new Uint8Array(width * height);
    for (let y = 0; y < height; y += 1) boundary[y * width + 2] = 1;

    const mask = connectedRegionFromSeed(candidates, boundary, width, height, [0, 1]);

    expect(Array.from(mask)).toEqual([1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0]);
  });

  it("seed自体が候補外なら空のマスクを返す", () => {
    const mask = connectedRegionFromSeed(new Uint8Array(4), new Uint8Array(4), 2, 2, [1, 1]);

    expect(Array.from(mask)).toEqual([0, 0, 0, 0]);
  });
});
