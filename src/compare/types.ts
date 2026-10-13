export type ImageLike = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

export type RgbColor = readonly [number, number, number];
export type ImagePoint = readonly [number, number];
export type ComparisonAxis = "color" | "boundary" | "recolor";

export type MethodId =
  | "color-rgb"
  | "color-hsv"
  | "color-lab"
  | "boundary-none"
  | "boundary-xdog-sobel"
  | "mask-grabcut"
  | "mask-grabcut-fast"
  | "mask-grabcut-subject"
  | "recolor-solid"
  | "recolor-lab-luma"
  | "recolor-hsv-hue"
  | "recolor-luma-colorize";

export type ComparisonMethod = {
  id: MethodId;
  axis: ComparisonAxis;
  axisTitle: string;
  title: string;
  description: string;
  params: readonly string[];
  defaultTolerance: number;
  toleranceMax: number;
  toleranceUnit: "%" | "ΔE";
};
