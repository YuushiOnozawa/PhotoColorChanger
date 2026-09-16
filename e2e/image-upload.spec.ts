import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

async function createPngFile(page: Page, name: string, width: number, height: number) {
  const bytes = await page.evaluate(
    async ({ width, height }) => {
      const source = document.createElement("canvas");
      source.width = width;
      source.height = height;
      const context = source.getContext("2d");
      if (!context) throw new Error("Canvas context is unavailable");

      context.fillStyle = "#9a5634";
      context.fillRect(0, 0, width, height);

      const blob = await new Promise<Blob>((resolve, reject) => {
        source.toBlob((value) => {
          if (value) resolve(value);
          else reject(new Error("PNG conversion failed"));
        }, "image/png");
      });
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    },
    { width, height },
  );

  return {
    name,
    mimeType: "image/png",
    buffer: Buffer.from(bytes),
  };
}

async function createSeparatedPngFile(page: Page) {
  const bytes = await page.evaluate(async () => {
    const source = document.createElement("canvas");
    source.width = 120;
    source.height = 80;
    const context = source.getContext("2d");
    if (!context) throw new Error("Canvas context is unavailable");

    context.fillStyle = "#9a5634";
    context.fillRect(0, 0, 40, 80);
    context.fillRect(80, 0, 40, 80);
    context.fillStyle = "#000000";
    context.fillRect(40, 0, 40, 80);

    const blob = await new Promise<Blob>((resolve, reject) => {
      source.toBlob((value) => {
        if (value) resolve(value);
        else reject(new Error("PNG conversion failed"));
      }, "image/png");
    });
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });

  return {
    name: "connected-region.png",
    mimeType: "image/png",
    buffer: Buffer.from(bytes),
  };
}

async function setReplacementColor(page: Page, color: string) {
  await page.locator("#replacement-color").evaluate((element, nextColor) => {
    const input = element as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, nextColor);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, color);
}

async function readCanvasPixel(page: Page, x: number, y: number) {
  return page.locator("canvas").evaluate(
    async (element, point) => {
      const source = element as HTMLCanvasElement;
      const gl = source.getContext("webgl2") ?? source.getContext("webgl");
      if (gl) {
        const pixel = new Uint8Array(4);
        gl.readPixels(point.x, source.height - point.y - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
        return Array.from(pixel);
      }
      const image = new Image();
      const loaded = new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Canvas screenshot loading failed"));
      });
      image.src = source.toDataURL("image/png");
      await loaded;
      const canvas = document.createElement("canvas");
      canvas.width = source.width;
      canvas.height = source.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas context is unavailable");
      context.drawImage(image, 0, 0);
      return Array.from(context.getImageData(point.x, point.y, 1, 1).data);
    },
    { x, y },
  );
}

async function createEdgePngFile(page: Page) {
  const bytes = await page.evaluate(async () => {
    const source = document.createElement("canvas");
    source.width = 320;
    source.height = 200;
    const context = source.getContext("2d");
    if (!context) throw new Error("Canvas context is unavailable");

    context.fillStyle = "#f7f1e8";
    context.fillRect(0, 0, 320, 200);
    context.fillStyle = "#83b8e8";
    context.fillRect(52, 82, 216, 88);
    context.strokeStyle = "#392f2a";
    context.lineWidth = 6;
    context.strokeRect(52, 82, 216, 88);
    context.fillStyle = "#f0bd5b";
    context.beginPath();
    context.moveTo(38, 84);
    context.lineTo(160, 28);
    context.lineTo(282, 84);
    context.closePath();
    context.fill();
    context.stroke();
    context.fillStyle = "#ef806e";
    context.fillRect(84, 108, 42, 62);
    context.strokeRect(84, 108, 42, 62);
    context.fillStyle = "#9ed18d";
    context.fillRect(176, 110, 54, 38);
    context.strokeRect(176, 110, 54, 38);
    context.beginPath();
    context.moveTo(203, 110);
    context.lineTo(203, 148);
    context.moveTo(176, 129);
    context.lineTo(230, 129);
    context.stroke();

    const blob = await new Promise<Blob>((resolve, reject) => {
      source.toBlob((value) => {
        if (value) resolve(value);
        else reject(new Error("PNG conversion failed"));
      }, "image/png");
    });
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });

  return {
    name: "line-art.png",
    mimeType: "image/png",
    buffer: Buffer.from(bytes),
  };
}

test("C03の画像アップロード、Canvas表示、再選択を検証する", async ({ page }) => {
  await page.goto("/");
  const fileInput = page.getByLabel("画像ファイル");

  await fileInput.setInputFiles(await createPngFile(page, "first.png", 4, 2));

  const firstCanvas = page.getByRole("img", { name: "first.pngの画像" });
  await expect(firstCanvas).toBeVisible();
  await expect(firstCanvas).toHaveJSProperty("width", 4);
  await expect(firstCanvas).toHaveJSProperty("height", 2);
  await expect(page.getByText("first.png（4 × 2px）", { exact: true })).toBeVisible();

  await fileInput.setInputFiles(await createPngFile(page, "second.png", 2, 4));

  const secondCanvas = page.getByRole("img", { name: "second.pngの画像" });
  await expect(secondCanvas).toBeVisible();
  await expect(secondCanvas).toHaveJSProperty("width", 2);
  await expect(secondCanvas).toHaveJSProperty("height", 4);
  await expect(page.getByText("second.png（2 × 4px）", { exact: true })).toBeVisible();
});

test("C04の対象色取得と置換後の色選択を検証する", async ({ page }) => {
  await page.goto("/");
  const fileInput = page.getByLabel("画像ファイル");

  await fileInput.setInputFiles(await createPngFile(page, "color.png", 4, 2));

  const canvas = page.getByRole("img", { name: "color.pngの画像" });
  await expect(canvas).toBeVisible();
  await canvas.click({ position: { x: 1, y: 1 } });

  await expect(page.getByLabel("選択中の置換対象色")).toHaveText("#9a5634");
  const replacementColor = page.locator("#replacement-color");
  await expect(replacementColor).toHaveValue("#ffffff");
  await replacementColor.evaluate((element) => {
    const input = element as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, "#336699");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.getByLabel("置換後の色コード")).toHaveText("#336699");
});

test("C05の近似色置換プレビューと許容範囲を検証する", async ({ page }) => {
  await page.goto("/");
  const fileInput = page.getByLabel("画像ファイル");

  await fileInput.setInputFiles(await createPngFile(page, "replacement.png", 4, 2));

  const canvas = page.getByRole("img", { name: "replacement.pngの画像" });
  await canvas.click({ position: { x: 1, y: 1 } });
  await page.locator("#replacement-color").evaluate((element) => {
    const input = element as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, "#336699");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });

  await expect(canvas).toHaveAttribute("data-renderer", /webgl/);
  await expect(page.getByLabel("置換後の色コード")).toHaveText("#336699");

  const tolerance = page.locator("#color-tolerance");
  await tolerance.fill("25");
  await expect(page.getByLabel("許容範囲の値")).toHaveText("25%");
});

test("C16のクリック地点から連結領域だけを置換する", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("画像ファイル").setInputFiles(await createSeparatedPngFile(page));

  const canvas = page.getByRole("img", { name: "connected-region.pngの画像" });
  await canvas.click({ position: { x: 10, y: 40 } });
  await page.locator("#replacement-color").evaluate((element) => {
    const input = element as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, "#336699");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.getByLabel("選択中の置換対象色")).toHaveText("#9a5634");
  await expect(page.getByLabel("置換後の色コード")).toHaveText("#336699");
});

test("PR17の各方式で色置換を実行できる", async ({ page }) => {
  await page.addInitScript(() => {
    const canvasPrototype = HTMLCanvasElement.prototype as unknown as {
      getContext: (type: string, options?: unknown) => RenderingContext | null;
    };
    const getContext = canvasPrototype.getContext;
    canvasPrototype.getContext = function (this: HTMLCanvasElement, type, options) {
      if (type === "webgl2" || type === "webgl") return null;
      return getContext.call(this, type, options);
    };
  });
  await page.goto("/");
  await page.getByLabel("画像ファイル").setInputFiles(await createSeparatedPngFile(page));

  const canvas = page.getByRole("img", { name: "connected-region.pngの画像" });
  await canvas.click({ position: { x: 10, y: 40 } });
  await setReplacementColor(page, "#336699");

  const methods = [
    { value: "sobel", key: "sobel" },
    { value: "binary", key: "binary", slider: "replacement-binary-threshold", threshold: "20" },
    { value: "shadow", key: "shadow" },
    { value: "xdog", key: "xdog" },
    { value: "xdogSobel", key: "xdog-sobel" },
  ];

  for (const method of methods) {
    await page.getByLabel("色置換の方式").selectOption(method.value);
    if (method.slider) {
      await page.locator(`#${method.slider}`).fill(method.threshold ?? "20");
    }
    await expect(page.getByLabel("置換後の色コード")).toHaveText("#336699");
    await expect(canvas).toHaveScreenshot(`replacement-method-${method.key}.png`, {
      animations: "disabled",
    });
    await expect.poll(() => readCanvasPixel(page, 10, 40)).toEqual([51, 102, 153, 255]);
    await expect.poll(() => readCanvasPixel(page, 100, 40)).toEqual([154, 86, 52, 255]);
  }
});

test("C15の線画プレビュー切替としきい値調整を検証する", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("画像ファイル").setInputFiles(await createEdgePngFile(page));

  const canvas = page.getByRole("img", { name: "line-art.pngの画像" });
  await expect(canvas).toBeVisible();
  await page.getByRole("button", { name: "線画", exact: true }).click();

  const lineThreshold = page.getByRole("slider", { name: "Sobelのしきい値" });
  await expect(lineThreshold).toHaveValue("20");
  await expect(page.getByRole("button", { name: "線画", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(canvas).toHaveScreenshot("line-art-c15.png", { animations: "disabled" });
  await page.getByRole("button", { name: "2値化", exact: true }).click();
  const binaryThreshold = page.getByRole("slider", { name: "2値化のしきい値" });
  await expect(binaryThreshold).toHaveValue("50");
  await expect(page.getByRole("button", { name: "2値化", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(canvas).toHaveScreenshot("line-art-binary-c15.png", { animations: "disabled" });
  await page.getByRole("button", { name: "影補正線画", exact: true }).click();
  const shadowLineThreshold = page.getByRole("slider", { name: "影補正線画のしきい値" });
  await expect(shadowLineThreshold).toHaveValue("20");
  await expect(page.getByRole("button", { name: "影補正線画", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(canvas).toHaveScreenshot("line-art-shadow-c15.png", { animations: "disabled" });
  await page.getByRole("button", { name: "XDoG", exact: true }).click();
  await expect(page.getByRole("button", { name: "XDoG", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(canvas).toHaveScreenshot("line-art-xdog-c15.png", { animations: "disabled" });
  const xdogThreshold = page.getByRole("slider", { name: "XDoGのしきい値" });
  await expect(xdogThreshold).toHaveValue("20");
  await page.getByRole("button", { name: "XDoG→Sobel", exact: true }).click();
  await expect(page.getByRole("slider", { name: "XDoGのしきい値" })).toHaveValue("20");
  await expect(page.getByRole("slider", { name: "Sobelのしきい値" })).toHaveValue("20");
  await page.getByRole("slider", { name: "XDoGのしきい値" }).fill("15");
  await page.getByRole("slider", { name: "Sobelのしきい値" }).fill("10");
  await expect(canvas).toHaveScreenshot("line-art-xdog-sobel-c15.png", { animations: "disabled" });
  await page.getByRole("button", { name: "線画", exact: true }).click();

  await lineThreshold.fill("80");
  await expect(lineThreshold).toHaveValue("80");
  const colorEdgeWeight = page.getByRole("slider", { name: "色差の重み" });
  await expect(colorEdgeWeight).toHaveValue("50");
  await colorEdgeWeight.fill("0");
  await expect(colorEdgeWeight).toHaveValue("0");
  await page.getByRole("button", { name: "色置換", exact: true }).click();
  await expect(page.getByLabel("色置換の方式")).toHaveValue("sobel");
  await expect(page.locator("#replacement-line-threshold")).toHaveValue("80");
  await expect(lineThreshold).toHaveCount(1);
  await expect(colorEdgeWeight).toHaveCount(0);
});

for (const fixture of ["c15-original.png", "c15-line-art.png"]) {
  test(`DOCサンプル ${fixture} の線画プレビューを検証する`, async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("画像ファイル").setInputFiles(resolve("docs/screenshots", fixture));

    const canvas = page.getByRole("img", { name: `${fixture}の画像` });
    await expect(canvas).toBeVisible();
    await page.getByRole("button", { name: "線画", exact: true }).click();
    await expect(canvas).toHaveScreenshot(`docs-${fixture}`, { animations: "disabled" });
  });
}

const exampleDirectory = process.env.PCC_EXAMPLE_DIR ?? resolve("example");
const exampleFixtures = ["sample1.png", "sample2.png"] as const;
const hasExampleFixtures = exampleFixtures.every((fixture) =>
  existsSync(resolve(exampleDirectory, fixture)),
);

for (const fixture of exampleFixtures) {
  test(`EXAMPLE ${fixture} の線画プレビューを検証する`, async ({ page }) => {
    test.skip(!hasExampleFixtures, "example画像がないためローカル検証をスキップ");
    await page.goto("/");
    await page.getByLabel("画像ファイル").setInputFiles(resolve(exampleDirectory, fixture));

    const canvas = page.getByRole("img", { name: `${fixture}の画像` });
    await expect(canvas).toBeVisible();
    await page.getByRole("button", { name: "線画", exact: true }).click();
    await expect(canvas).toHaveScreenshot(`example-${fixture}.png`, { animations: "disabled" });
    await page.getByRole("button", { name: "2値化", exact: true }).click();
    await expect(canvas).toHaveScreenshot(`example-${fixture}-binary.png`, {
      animations: "disabled",
    });
    await page.getByRole("button", { name: "影補正線画", exact: true }).click();
    await expect(canvas).toHaveScreenshot(`example-${fixture}-shadow.png`, {
      animations: "disabled",
    });
    await page.getByRole("button", { name: "XDoG", exact: true }).click();
    await expect(canvas).toHaveScreenshot(`example-${fixture}-xdog.png`, {
      animations: "disabled",
    });
    await page.getByRole("button", { name: "XDoG→Sobel", exact: true }).click();
    await expect(canvas).toHaveScreenshot(`example-${fixture}-xdog-sobel.png`, {
      animations: "disabled",
    });
  });
}
