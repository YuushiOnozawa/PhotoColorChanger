import { describe, expect, it } from "vitest";
import {
  createLineArtVotingRegion,
  findNonLineRegions,
  resolveLinePixels,
  voteNonLineRegions,
} from "./grabcutLineArt";

describe("線画領域の投票ヘルパー", () => {
  it("被写体前景を8px膨張し、段1失敗時は画像全体を使う", () => {
    const foreground = new Uint8Array(21);
    foreground[10] = 1;
    const region = createLineArtVotingRegion(foreground, 21, 1);

    expect(region[2]).toBe(1);
    expect(region[18]).toBe(1);
    expect(region[1]).toBe(0);
    expect(region[19]).toBe(0);
    expect(createLineArtVotingRegion(null, 3, 2)).toEqual(new Uint8Array([1, 1, 1, 1, 1, 1]));
  });

  it("線画を除いた領域は4連結で分け、斜めだけの画素を結合しない", () => {
    const regions = findNonLineRegions(
      new Uint8Array([1, 1, 1, 1]),
      new Uint8Array([0, 1, 1, 0]),
      2,
      2,
    );

    expect(regions.labels).toEqual(new Int32Array([0, -1, -1, 1]));
    expect(regions.sizes).toEqual([1, 1]);
    expect(regions.votingRegionSize).toBe(4);
  });

  it("2%超の低前景率領域はGrabCutを維持し、小領域は投票する", () => {
    const labels = new Int32Array(1000).fill(-1);
    labels.fill(0, 0, 25);
    labels.fill(1, 25, 29);
    labels.fill(2, 29, 39);
    labels.fill(3, 39, 49);
    const grabCutMask = new Uint8Array(1000);
    grabCutMask[0] = 1;
    grabCutMask[1] = 1;
    grabCutMask[25] = 1;
    grabCutMask[26] = 1;
    grabCutMask[29] = 1;
    grabCutMask.fill(1, 39, 43);

    const result = voteNonLineRegions(grabCutMask, {
      labels,
      sizes: [25, 4, 10, 10],
      votingRegionSize: 1000,
    });

    expect(result.mask.slice(0, 25)).toEqual(grabCutMask.slice(0, 25));
    expect(result.mask.slice(25, 29)).toEqual(new Uint8Array([1, 1, 1, 1]));
    expect(result.mask.slice(29, 39)).toEqual(new Uint8Array(10));
    expect(result.mask.slice(39, 49)).toEqual(grabCutMask.slice(39, 49));
    expect(result.stats).toEqual({
      regionCount: 4,
      foregrounded: 1,
      backgrounded: 1,
      kept: 1,
      unsplit: 1,
    });
  });

  it("線画画素は8近傍の非線画多数決を使い、同数ならGrabCutを維持する", () => {
    const votingRegion = new Uint8Array(9).fill(1);
    const lineMask = new Uint8Array(9);
    lineMask[4] = 1;
    const grabCutMask = new Uint8Array(9);
    const votedMask = new Uint8Array([1, 1, 0, 1, 0, 0, 1, 1, 0]);

    expect(
      resolveLinePixels(grabCutMask, votedMask, votingRegion, lineMask, 3, 3)[4],
    ).toBe(1);

    lineMask.fill(1);
    lineMask[1] = 0;
    lineMask[3] = 0;
    lineMask[5] = 0;
    lineMask[7] = 0;
    grabCutMask[4] = 1;
    const tiedMask = new Uint8Array([0, 1, 0, 1, 0, 0, 0, 0, 0]);
    expect(
      resolveLinePixels(grabCutMask, tiedMask, votingRegion, lineMask, 3, 3)[4],
    ).toBe(1);
  });
});
