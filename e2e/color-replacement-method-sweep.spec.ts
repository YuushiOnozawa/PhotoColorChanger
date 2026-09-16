import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const exampleDirectory = process.env.PCC_EXAMPLE_DIR ?? resolve("example");
const fixtures = ["sample1.png", "sample2.png"] as const;
const targetPoints = {
  "sample1.png": { x: 0.28, y: 0.15 },
  "sample2.png": { x: 0.48, y: 0.25 },
} as const;
const methods = [
  { key: "sobel", value: "sobel", sliders: [["replacement-line-threshold", "20"]] },
  { key: "binary", value: "binary", sliders: [["replacement-binary-threshold", "30"]] },
  { key: "shadow", value: "shadow", sliders: [["replacement-shadow-threshold", "20"]] },
  { key: "xdog", value: "xdog", sliders: [["replacement-xdog-threshold", "20"]] },
  {
    key: "xdog-sobel",
    value: "xdogSobel",
    sliders: [
      ["replacement-xdog-threshold", "20"],
      ["replacement-xdog-sobel-threshold", "20"],
    ],
  },
] as const;

async function setReplacementColor(page: Page, color: string) {
  await page.locator("#replacement-color").evaluate((element, nextColor) => {
    const input = element as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, nextColor);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, color);
}

for (const fixture of fixtures) {
  test(`EXAMPLE ${fixture} の方式別色置換を比較する`, async ({ page }) => {
    test.skip(
      !existsSync(resolve(exampleDirectory, fixture)),
      "example画像がないためローカル検証をスキップ",
    );
    await page.goto("/");
    await page.getByLabel("画像ファイル").setInputFiles(resolve(exampleDirectory, fixture));

    const canvas = page.getByRole("img", { name: `${fixture}の画像` });
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas bounds are unavailable");
    const targetPoint = targetPoints[fixture];
    await canvas.click({
      position: { x: box.width * targetPoint.x, y: box.height * targetPoint.y },
    });
    await setReplacementColor(page, "#336699");
    await page.locator("#color-tolerance").fill("35");

    for (const method of methods) {
      await page.getByLabel("色置換の方式").selectOption(method.value);
      for (const [id, value] of method.sliders) {
        await page.locator(`#${id}`).fill(value);
      }
      const outputPath = `/tmp/PhotoColorChanger-${fixture.replace(".", "-")}-replacement-${method.key}.png`;
      await page.screenshot({ path: outputPath });
      await test.info().attach(`${fixture}-replacement-${method.key}`, {
        path: outputPath,
        contentType: "image/png",
      });
      console.log(`replacement method comparison: ${outputPath}`);
    }
  });
}
