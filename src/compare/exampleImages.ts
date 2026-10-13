export const EXAMPLE_IMAGES = [
  {
    name: "sample1",
    url: new URL("../../example/sample1.png", import.meta.url).href,
    seed: [665, 338],
  },
  {
    name: "sample2",
    url: new URL("../../example/sample2.png", import.meta.url).href,
    seed: [443, 747],
  },
] as const;
