import { defineConfig } from "@playwright/test";

const previewUrl = process.env.PREVIEW_URL;

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: previewUrl ?? "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  ...(previewUrl
    ? {}
    : {
        webServer: {
          command: "npm run dev -- --host 127.0.0.1 --port 4173",
          url: "http://127.0.0.1:4173",
          reuseExistingServer: !process.env.CI,
        },
      }),
});
