import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

// Library build: ESM + CJS + rolled-up type declarations into dist/.
export default defineConfig({
  plugins: [
    react(),
    dts({
      tsconfigPath: "./tsconfig.build.json",
      entryRoot: "src/naiveparallel",
      bundleTypes: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "src/naiveparallel/index.ts"),
      name: "NaiveParallel",
      formats: ["es", "cjs"],
      fileName: (format) => (format === "es" ? "naiveparallel.js" : "naiveparallel.cjs"),
      cssFileName: "naiveparallel",
    },
    rollupOptions: {
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        /^d3-/,
      ],
    },
  },
});
