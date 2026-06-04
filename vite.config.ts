/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Demo site dev server + build. The library build lives in vite.lib.config.ts.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist-demo",
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    passWithNoTests: true,
  },
});
