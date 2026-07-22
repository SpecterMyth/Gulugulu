// 宣传片专用生产构建:把 trailer.html 打成静态包(单 bundle,无 HMR、无按需编译),
// 供 render_video.mjs 用 `vite preview` 静态托管 —— 无头 CDP 秒开、不再卡编译/HMR。
// 只影响 dist/trailer(在 gitignore 的 dist/ 下),Tauri 产品构建(index.html)零改动。
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist/trailer",
    emptyOutDir: true,
    target: "es2022",
    rollupOptions: { input: { trailer: resolve(root, "trailer.html") } },
  },
});
