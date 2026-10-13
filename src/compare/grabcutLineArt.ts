import { dilateBinaryMask } from "./grabcutHelpers";

export type LineArtRegionStats = {
  regionCount: number;
  foregrounded: number;
  backgrounded: number;
  kept: number;
  unsplit: number;
};

export type NonLineRegions = {
  labels: Int32Array;
  sizes: number[];
  votingRegionSize: number;
};

export function createLineArtVotingRegion(
  subjectForeground: Uint8Array | null,
  width: number,
  height: number,
): Uint8Array {
  if (subjectForeground) return dilateBinaryMask(subjectForeground, width, height, 8);
  const region = new Uint8Array(width * height);
  region.fill(1);
  return region;
}

export function findNonLineRegions(
  votingRegion: Uint8Array,
  lineMask: Uint8Array,
  width: number,
  height: number,
): NonLineRegions {
  const labels = new Int32Array(width * height);
  labels.fill(-1);
  const queue = new Int32Array(labels.length);
  const sizes: number[] = [];
  let votingRegionSize = 0;

  for (let start = 0; start < labels.length; start += 1) {
    if (votingRegion[start] === 1) votingRegionSize += 1;
    if (votingRegion[start] === 0 || lineMask[start] === 1 || labels[start] !== -1) continue;
    const regionId = sizes.length;
    let head = 0;
    let tail = 1;
    queue[0] = start;
    labels[start] = regionId;
    const add = (neighbor: number) => {
      if (
        votingRegion[neighbor] === 1 &&
        lineMask[neighbor] === 0 &&
        labels[neighbor] === -1
      ) {
        labels[neighbor] = regionId;
        queue[tail] = neighbor;
        tail += 1;
      }
    };

    while (head < tail) {
      const pixel = queue[head];
      head += 1;
      const x = pixel % width;
      if (x > 0) add(pixel - 1);
      if (x + 1 < width) add(pixel + 1);
      if (pixel >= width) add(pixel - width);
      if (pixel + width < labels.length) add(pixel + width);
    }
    sizes.push(tail);
  }

  return { labels, sizes, votingRegionSize };
}

export function voteNonLineRegions(
  grabCutMask: Uint8Array,
  regions: NonLineRegions,
): { mask: Uint8Array; stats: LineArtRegionStats } {
  const foregroundCounts = new Uint32Array(regions.sizes.length);
  for (let pixel = 0; pixel < regions.labels.length; pixel += 1) {
    const regionId = regions.labels[pixel];
    if (regionId >= 0 && grabCutMask[pixel] === 1) foregroundCounts[regionId] += 1;
  }

  const decisions = new Int8Array(regions.sizes.length);
  const stats: LineArtRegionStats = {
    regionCount: regions.sizes.length,
    foregrounded: 0,
    backgrounded: 0,
    kept: 0,
    unsplit: 0,
  };
  for (let regionId = 0; regionId < regions.sizes.length; regionId += 1) {
    if (regions.sizes[regionId] * 100 > regions.votingRegionSize * 2) {
      stats.unsplit += 1;
      continue;
    }
    const foregroundRatio = foregroundCounts[regionId] / regions.sizes[regionId];
    if (foregroundRatio >= 0.5) {
      decisions[regionId] = 1;
      stats.foregrounded += 1;
    } else if (foregroundRatio <= 0.15) {
      decisions[regionId] = -1;
      stats.backgrounded += 1;
    } else {
      stats.kept += 1;
    }
  }

  const mask = new Uint8Array(grabCutMask);
  for (let pixel = 0; pixel < regions.labels.length; pixel += 1) {
    const decision = regions.labels[pixel] >= 0 ? decisions[regions.labels[pixel]] : 0;
    if (decision !== 0) mask[pixel] = decision === 1 ? 1 : 0;
  }
  return { mask, stats };
}

export function resolveLinePixels(
  grabCutMask: Uint8Array,
  votedMask: Uint8Array,
  votingRegion: Uint8Array,
  lineMask: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const result = new Uint8Array(votedMask);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      if (votingRegion[pixel] === 0 || lineMask[pixel] === 0) continue;
      let foreground = 0;
      let background = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const neighborX = x + dx;
          const neighborY = y + dy;
          if (neighborX < 0 || neighborX >= width || neighborY < 0 || neighborY >= height) {
            continue;
          }
          const neighbor = neighborY * width + neighborX;
          if (votingRegion[neighbor] === 0 || lineMask[neighbor] === 1) continue;
          if (votedMask[neighbor] === 1) foreground += 1;
          else background += 1;
        }
      }
      if (foreground > background) result[pixel] = 1;
      else if (background > foreground) result[pixel] = 0;
      else result[pixel] = grabCutMask[pixel];
    }
  }
  return result;
}
