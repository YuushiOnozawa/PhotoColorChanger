import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const METHOD_IDS = [
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
] as const;

async function changedPixelRatio(page: Page, inputTestId: string, outputTestId: string) {
  const input = await readCanvasPixels(page, inputTestId);
  const output = await readCanvasPixels(page, outputTestId);
  expect(
    { width: output.width, height: output.height },
    `${inputTestId} と ${outputTestId} のサイズが一致すること`,
  ).toEqual({ width: input.width, height: input.height });

  let changedPixels = 0;
  for (let index = 0; index < input.pixels.length; index += 4) {
    if (
      Math.abs(input.pixels[index] - output.pixels[index]) > 8 ||
      Math.abs(input.pixels[index + 1] - output.pixels[index + 1]) > 8 ||
      Math.abs(input.pixels[index + 2] - output.pixels[index + 2]) > 8
    ) {
      changedPixels += 1;
    }
  }
  return changedPixels / (input.width * input.height);
}

async function readCanvasPixels(page: Page, testId: string) {
  return page.getByTestId(testId).evaluate((element) => {
    if (!(element instanceof HTMLCanvasElement)) {
      throw new Error("対象要素がキャンバスではありません");
    }

    const copy = document.createElement("canvas");
    copy.width = element.width;
    copy.height = element.height;
    const context = copy.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("2Dキャンバスを作成できません");

    context.drawImage(element, 0, 0);
    return {
      width: copy.width,
      height: copy.height,
      pixels: Array.from(context.getImageData(0, 0, copy.width, copy.height).data),
    };
  });
}

test("比較一覧から各手法へ移動して一覧に戻る", async ({ page }) => {
  await page.goto("./#/compare");
  const index = page.getByTestId("compare-index");
  await expect(index).toBeVisible();

  for (const methodId of METHOD_IDS) {
    const link = page.getByTestId(`compare-link-${methodId}`);
    await expect(link).toBeVisible();
    await link.click();
    await expect(page.getByTestId(`compare-method-${methodId}`)).toBeVisible();
    await page.getByTestId("compare-back").click();
    await expect(index).toBeVisible();
  }
});

test("前後リンクで全手法を順に移動できる", async ({ page }) => {
  await page.goto(`./#/compare/${METHOD_IDS[0]}`);
  await expect(page.getByTestId(`compare-method-${METHOD_IDS[0]}`)).toBeVisible();

  for (const methodId of METHOD_IDS.slice(1)) {
    await page.getByTestId("compare-next").click();
    await expect(page.getByTestId(`compare-method-${methodId}`)).toBeVisible();
  }

  for (let index = METHOD_IDS.length - 2; index >= 0; index -= 1) {
    await page.getByTestId("compare-prev").click();
    await expect(page.getByTestId(`compare-method-${METHOD_IDS[index]}`)).toBeVisible();
  }
});

test.describe("合成画像を使った各手法の処理", () => {
  for (const methodId of METHOD_IDS) {
    test(`${methodId} の出力と通信を確認する`, async ({ page }) => {
      await page.goto(`./#/compare/${methodId}`);
      await expect(page.getByTestId(`compare-method-${methodId}`)).toBeVisible();

      const requests: { method: string; url: string }[] = [];
      page.on("request", (request) => {
        requests.push({ method: request.method(), url: request.url() });
      });

      await page.getByTestId("compare-load-synthetic").click();
      const outputCanvas = page.getByTestId("compare-output");
      await expect
        .poll(
          () =>
            outputCanvas.evaluate((element) => {
              if (!(element instanceof HTMLCanvasElement) || !element.width || !element.height) {
                return false;
              }

              const copy = document.createElement("canvas");
              copy.width = element.width;
              copy.height = element.height;
              const context = copy.getContext("2d", { willReadFrequently: true });
              if (!context) return false;

              context.drawImage(element, 0, 0);
              const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
              return pixels.some((value, index) => index % 4 === 3 && value !== 0);
            }),
          { message: "出力キャンバスに画像が描画されること", timeout: 60_000 },
        )
        .toBe(true);

      const params = page.getByTestId("compare-params");
      await expect(params).toBeVisible();
      await expect(params).toHaveText(/\S/);

      const input = await readCanvasPixels(page, "compare-input");
      const output = await readCanvasPixels(page, "compare-output");
      expect(
        { width: output.width, height: output.height },
        "入力と出力のキャンバスサイズが一致すること",
      ).toEqual({ width: input.width, height: input.height });

      let changedPixels = 0;
      for (let index = 0; index < input.pixels.length; index += 4) {
        if (
          Math.abs(input.pixels[index] - output.pixels[index]) > 8 ||
          Math.abs(input.pixels[index + 1] - output.pixels[index + 1]) > 8 ||
          Math.abs(input.pixels[index + 2] - output.pixels[index + 2]) > 8
        ) {
          changedPixels += 1;
        }
      }
      expect(
        changedPixels / (input.width * input.height),
        "RGBのいずれかが8を超えて異なる画素が1%以上あること",
      ).toBeGreaterThanOrEqual(0.01);

      const origin = new URL(page.url()).origin;
      const offendingRequests = requests.filter((request) => {
        const url = new URL(request.url);
        if (url.protocol === "data:" || url.protocol === "blob:") return false;
        return request.method !== "GET" || url.origin !== origin;
      });
      expect(
        offendingRequests,
        `同一オリジンへのGET以外の通信がないこと: ${JSON.stringify(offendingRequests)}`,
      ).toEqual([]);

      const screenshotDirectory = resolve(process.cwd(), ".loop/screenshots");
      await mkdir(screenshotDirectory, { recursive: true });
      await page.screenshot({
        path: resolve(screenshotDirectory, `${methodId}.png`),
        fullPage: true,
      });
    });
  }
});

test.describe("実物サンプル2枚を使った各手法の処理", () => {
  for (const methodId of METHOD_IDS) {
    test(`${methodId} でsample1とsample2の両方が処理される`, async ({ page }) => {
      await page.goto(`./#/compare/${methodId}`);
      await expect(page.getByTestId(`compare-method-${methodId}`)).toBeVisible();
      await page.getByTestId("compare-load-examples").click();

      for (const name of ["sample1", "sample2"]) {
        await expect(page.getByTestId(`compare-example-${name}`)).toBeVisible();
        await expect
          .poll(
            () => changedPixelRatio(page, `compare-example-${name}-input`, `compare-example-${name}-output`),
            { message: `${name} の出力が入力から変化すること`, timeout: 60_000 },
          )
          .toBeGreaterThan(0.001);
      }

      const screenshotDirectory = resolve(process.cwd(), ".loop/screenshots");
      await mkdir(screenshotDirectory, { recursive: true });
      await page.screenshot({
        path: resolve(screenshotDirectory, `${methodId}-examples.png`),
        fullPage: true,
      });
    });
  }
});
