import { defineConfig } from "tsdown";
export default defineConfig({
  entry: { index: "src/index.ts" },
  format: "cjs",
  outDir: "dist",
  platform: "node",
  clean: true,
  copy: [{ from: "assets/*", to: "dist" }],
  dts: false,
  deps: { alwaysBundle: () => true, onlyBundle: false },
  outExtensions: () => ({ js: ".js" }),
  outputOptions: { exports: "named" },
});
