import { describe, expect, it } from "vitest";
import {
  computeGrabCutRoi,
  resizeBinaryMaskBilinear,
  resizeLabelsNearest,
} from "./grabcutHelpers";

describe("GrabCut高速版の純粋ヘルパー", () => {
  it("候補bboxにmarginを付け、空候補ではseed中心の正方形を使う", () => {
    const candidate = new Uint8Array(100 * 80);
    candidate[30 * 100 + 40] = 1;
    candidate[30 * 100 + 41] = 1;

    expect(computeGrabCutRoi(candidate, 100, 80, [40, 30])).toEqual({
      x: 8,
      y: 0,
      width: 66,
      height: 63,
    });
    expect(computeGrabCutRoi(new Uint8Array(100 * 80), 100, 80, [80, 60])).toEqual({
      x: 67,
      y: 47,
      width: 25,
      height: 25,
    });
  });

  it("ROIが画像の80%を超えたら全画像に戻す", () => {
    const candidate = new Uint8Array(10 * 10);
    candidate.fill(1);

    expect(computeGrabCutRoi(candidate, 10, 10, [5, 5])).toEqual({
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });
  });

  it("ラベルは最近傍で縮小し、カテゴリ値を混ぜない", () => {
    expect(resizeLabelsNearest(new Uint8Array([0, 1, 2, 3]), 4, 1, 2, 1)).toEqual(
      new Uint8Array([0, 2]),
    );
  });

  it("二値マスクは双線形拡大後に0.5で二値化する", () => {
    expect(resizeBinaryMaskBilinear(new Uint8Array([0, 1]), 2, 1, 4, 1)).toEqual(
      new Uint8Array([0, 0, 1, 1]),
    );
  });
});
