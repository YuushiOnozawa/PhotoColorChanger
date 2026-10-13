import { describe, expect, it } from "vitest";
import {
  createSubjectGrabCutInitializationMask,
  dilateBinaryMask,
  getGrabCutSubjectFailureReason,
  isSeedDiscInsideDilatedForeground,
  resizeBinaryMaskBilinear,
  resizeLabelsNearest,
} from "./grabcutHelpers";

describe("GrabCutの純粋ヘルパー", () => {
  it("被写体面積が5%未満または95%超なら段1を使わない", () => {
    const rect = { x: 1, y: 1, width: 8, height: 8 };
    expect(getGrabCutSubjectFailureReason(new Uint8Array(100), 10, 10, rect)).toContain("5%未満");

    const full = new Uint8Array(100);
    full.fill(1);
    expect(getGrabCutSubjectFailureReason(full, 10, 10, rect)).toContain("95%を超える");
  });

  it("内周の各辺に前景が孤立して触れても、辺ごとに20%以下なら段1を使う", () => {
    const mask = new Uint8Array(100);
    for (let i = 0; i < 5; i += 1) mask[4 * 10 + 3 + i] = 1;
    mask[1 * 10 + 4] = 1;
    mask[8 * 10 + 4] = 1;
    mask[4 * 10 + 1] = 1;
    mask[5 * 10 + 8] = 1;

    expect(getGrabCutSubjectFailureReason(mask, 10, 10, { x: 1, y: 1, width: 8, height: 8 })).toBeNull();
  });

  it("内周の一辺で前景率が20%を超えたら辺名と率を示して段1を使わない", () => {
    const mask = new Uint8Array(100);
    for (let i = 0; i < 5; i += 1) mask[4 * 10 + 3 + i] = 1;
    mask[1 * 10 + 4] = 1;
    mask[1 * 10 + 5] = 1;

    expect(getGrabCutSubjectFailureReason(mask, 10, 10, { x: 1, y: 1, width: 8, height: 8 })).toBe(
      "被写体が枠の上辺で切れている（前景率25%）ため",
    );
  });

  it("段2ラベルは前景を4px膨張し、外側と画像端を確定背景にする", () => {
    const foreground = new Uint8Array(12 * 12);
    foreground[6 * 12 + 6] = 1;
    foreground[6 * 12 + 9] = 1;
    const candidate = new Uint8Array(12 * 12);
    candidate[6 * 12 + 9] = 1;
    candidate[8 * 12 + 8] = 1;

    const labels = createSubjectGrabCutInitializationMask(foreground, candidate, 12, 12, [6, 6], 2);
    expect(labels[6 * 12 + 6]).toBe(1);
    expect(labels[6 * 12 + 9]).toBe(3);
    expect(labels[8 * 12 + 8]).toBe(2);
    expect(labels[6 * 12 + 10]).toBe(2);
    expect(labels[6 * 12 + 11]).toBe(0);
    expect(labels[0]).toBe(0);
  });

  it("二段階用の膨張は指定半径の正方形近傍を使う", () => {
    const source = new Uint8Array(11 * 11);
    source[5 * 11 + 5] = 1;
    const dilated = dilateBinaryMask(source, 11, 11, 4);

    expect(dilated[1 * 11 + 5]).toBe(1);
    expect(dilated[0 * 11 + 5]).toBe(0);
    expect(dilated[5 * 11 + 9]).toBe(1);
    expect(dilated[5 * 11 + 10]).toBe(0);
  });

  it("seedの確定前景円盤が段1前景の4px膨張内にあるか判定する", () => {
    const foreground = new Uint8Array(15 * 15);
    foreground[7 * 15 + 7] = 1;

    expect(isSeedDiscInsideDilatedForeground(foreground, 15, 15, [8, 7], 2)).toBe(true);
    expect(isSeedDiscInsideDilatedForeground(foreground, 15, 15, [12, 7], 2)).toBe(false);
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
