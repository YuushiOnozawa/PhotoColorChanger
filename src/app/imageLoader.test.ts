import { describe, expect, it } from "vitest";
import { fitImageDimensions } from "./imageLoader";

describe("画像サイズ", () => {
  it("長辺を4096px以下へ縮小する", () => {
    expect(fitImageDimensions(8000, 4000)).toEqual({
      width: 4096,
      height: 2048,
      wasResized: true,
    });
    expect(fitImageDimensions(2000, 1000)).toEqual({
      width: 2000,
      height: 1000,
      wasResized: false,
    });
  });
});
