import { describe, expect, it } from "vitest";
import { METHODS, METHOD_GROUPS } from "./registry";

describe("比較手法レジストリ", () => {
  it("ゴール文書で定めた順序と範囲判定の表示名を保つ", () => {
    expect(METHODS.map(({ id }) => id)).toEqual([
      "color-rgb",
      "color-hsv",
      "color-lab",
      "boundary-none",
      "boundary-xdog-sobel",
      "mask-grabcut",
      "mask-grabcut-fast",
      "recolor-solid",
      "recolor-lab-luma",
      "recolor-hsv-hue",
      "recolor-luma-colorize",
    ]);
    expect(METHOD_GROUPS.find(({ axis }) => axis === "boundary")?.title).toBe("範囲判定");
    expect(METHODS.find(({ id }) => id === "mask-grabcut")?.axisTitle).toBe("範囲判定");
    expect(METHODS.find(({ id }) => id === "boundary-none")?.title).toBe("範囲判定なし");
    expect(METHODS.find(({ id }) => id === "mask-grabcut")?.params.join(" ")).toContain(
      "GrabCut反復回数: 4",
    );
    expect(METHODS.find(({ id }) => id === "mask-grabcut")?.params.join(" ")).toContain(
      "画像端=確定背景",
    );
    const fastParams = METHODS.find(({ id }) => id === "mask-grabcut-fast")?.params.join(" ");
    expect(fastParams).toContain("margin max(32px,画像長辺の15%)");
    expect(fastParams).toContain("ROI長辺512px以下");
    expect(fastParams).toContain("反復回数4");
    expect(fastParams).toContain("初期マスク縮小=最近傍");
    expect(fastParams).toContain("mask-grabcutは全解像度版");
    expect(METHODS.find(({ id }) => id === "recolor-luma-colorize")?.params.join(" ")).toContain(
      "Lout=clamp(Lin−μ+Lt, 0, 100)",
    );
  });
});
