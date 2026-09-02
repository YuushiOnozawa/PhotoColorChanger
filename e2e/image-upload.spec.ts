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
    source.width = 6;
    source.height = 2;
    const context = source.getContext("2d");
    if (!context) throw new Error("Canvas context is unavailable");

    context.fillStyle = "#9a5634";
    context.fillRect(0, 0, 2, 2);
    context.fillRect(4, 0, 2, 2);
    context.fillStyle = "#000000";
    context.fillRect(2, 0, 2, 2);

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
  await canvas.click({ position: { x: 1, y: 1 } });
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

test("C15の線画プレビュー切替としきい値調整を検証する", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("画像ファイル").setInputFiles(await createEdgePngFile(page));

  const canvas = page.getByRole("img", { name: "line-art.pngの画像" });
  await expect(canvas).toBeVisible();
  await page.getByRole("button", { name: "線画", exact: true }).click();

  const lineThreshold = page.getByRole("slider", { name: "線画のしきい値" });
  await expect(lineThreshold).toHaveValue("20");
  await expect(page.getByRole("button", { name: "線画", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await lineThreshold.fill("80");
  await expect(lineThreshold).toHaveValue("80");
  const colorEdgeWeight = page.getByRole("slider", { name: "色差の重み" });
  await expect(colorEdgeWeight).toHaveValue("50");
  await colorEdgeWeight.fill("0");
  await expect(colorEdgeWeight).toHaveValue("0");
  await page.getByRole("button", { name: "色置換", exact: true }).click();
  await expect(lineThreshold).toHaveCount(0);
  await expect(colorEdgeWeight).toHaveCount(0);
});
