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

test("C03の画像アップロード、Canvas表示、再選択を検証する", async ({ page }) => {
  await page.goto("/");
  const fileInput = page.getByLabel("画像ファイル");

  await fileInput.setInputFiles(await createPngFile(page, "first.png", 4, 2));

  const firstCanvas = page.getByRole("img", { name: "first.pngの画像" });
  await expect(firstCanvas).toBeVisible();
  await expect(firstCanvas).toHaveJSProperty("width", 4);
  await expect(firstCanvas).toHaveJSProperty("height", 2);
  await expect(page.getByRole("status")).toHaveText("first.png（4 × 2px）");

  await fileInput.setInputFiles(await createPngFile(page, "second.png", 2, 4));

  const secondCanvas = page.getByRole("img", { name: "second.pngの画像" });
  await expect(secondCanvas).toBeVisible();
  await expect(secondCanvas).toHaveJSProperty("width", 2);
  await expect(secondCanvas).toHaveJSProperty("height", 4);
  await expect(page.getByRole("status")).toHaveText("second.png（2 × 4px）");
});
