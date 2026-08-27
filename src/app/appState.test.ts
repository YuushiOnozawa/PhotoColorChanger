import { describe, expect, it } from "vitest";
import { initialAppState } from "./appState";

describe("初期アプリ状態", () => {
  it("画像未読み込みで開始する", () => {
    expect(initialAppState).toEqual({ imageSessionStatus: "empty" });
  });
});
