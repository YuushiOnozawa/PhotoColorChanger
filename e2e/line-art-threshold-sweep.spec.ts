import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const thresholds = [3, 5, 10, 15, 20, 30, 40, 60, 80];
const exampleDirectory = process.env.PCC_EXAMPLE_DIR ?? resolve("example");
const exampleFixtures = ["sample1.png", "sample2.png"] as const;
const hasExampleFixtures = exampleFixtures.every((fixture) =>
  existsSync(resolve(exampleDirectory, fixture)),
);
test.setTimeout(120_000);
const methods = [
  { key: "sobel", button: "線画", sliders: ["Sobelのしきい値"] },
  { key: "xdog", button: "XDoG", sliders: ["XDoGのしきい値"] },
  {
    key: "xdog-sobel",
    button: "XDoG→Sobel",
    sliders: ["XDoGのしきい値", "Sobelのしきい値"],
  },
] as const;

async function createContactSheet(page: Page, images: string[]) {
  return page.evaluate(
    ({ images, thresholds }) => {
      const cellSize = 280;
      const labelHeight = 28;
      const gap = 16;
      const columns = 3;
      const rows = Math.ceil(images.length / columns);
      const canvas = document.createElement("canvas");
      canvas.width = columns * cellSize + (columns + 1) * gap;
      canvas.height = rows * (cellSize + labelHeight) + (rows + 1) * gap;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas context is unavailable");
      context.fillStyle = "white";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.font = "bold 16px sans-serif";
      context.fillStyle = "#222";

      return Promise.all(
        images.map(
          (source, index) =>
            new Promise<void>((resolve, reject) => {
              const image = new Image();
              image.onload = () => {
                const column = index % columns;
                const row = Math.floor(index / columns);
                const x = gap + column * (cellSize + gap);
                const y = gap + row * (cellSize + labelHeight + gap);
                const scale = Math.min(cellSize / image.width, cellSize / image.height);
                const width = image.width * scale;
                const height = image.height * scale;
                context.drawImage(
                  image,
                  x + (cellSize - width) / 2,
                  y + labelHeight + (cellSize - height) / 2,
                  width,
                  height,
                );
                context.fillText(`${thresholds[index]}%`, x, y + 18);
                resolve();
              };
              image.onerror = () => reject(new Error("Screenshot loading failed"));
              image.src = `data:image/png;base64,${source}`;
            }),
        ),
      ).then(() => canvas.toDataURL("image/png").split(",")[1]);
    },
    { images, thresholds },
  );
}

for (const fixture of exampleFixtures) {
  test(`EXAMPLE ${fixture} のしきい値スイープ`, async ({ page }) => {
    test.skip(!hasExampleFixtures, "example画像がないためローカル検証をスキップ");
    await page.goto("/");
    await page.getByLabel("画像ファイル").setInputFiles(resolve(exampleDirectory, fixture));
    const canvas = page.getByRole("img", { name: `${fixture}の画像` });
    for (const method of methods) {
      await page.getByRole("button", { name: method.button, exact: true }).click();
      const sliders = method.sliders.map((name) => page.getByRole("slider", { name }));
      const screenshots: string[] = [];
      for (const threshold of thresholds) {
        for (const slider of sliders) {
          await slider.fill(String(threshold));
          await expect(slider).toHaveValue(String(threshold));
        }
        screenshots.push((await canvas.screenshot()).toString("base64"));
      }

      const outputPath = `/tmp/PhotoColorChanger-${fixture.replace(".", "-")}-${method.key}-threshold-sweep.png`;
      const png = await createContactSheet(page, screenshots);
      await writeFile(outputPath, Buffer.from(png, "base64"));
      await test.info().attach(`${fixture}-${method.key}-threshold-sweep`, {
        path: outputPath,
        contentType: "image/png",
      });
      console.log(`threshold sweep: ${outputPath}`);
    }
  });
}
