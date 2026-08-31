import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/").pop() ?? "PhotoColorChanger";
const isGitHubActionsBuild = process.env.GITHUB_ACTIONS === "true";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: isGitHubActionsBuild ? `/${repositoryName}/` : "/",
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
