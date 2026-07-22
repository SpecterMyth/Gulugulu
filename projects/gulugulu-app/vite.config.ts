import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    // PORT 供预览工具分配动态端口；未设置时保持 Tauri devUrl 约定的 5173。
    // 注意:1420 会落进 Windows 保留端口段(Hyper-V/WSL 的 excludedportrange,
    // 如 1364-1463),strictPort 下直接 listen EACCES 起不来,故改用 5173。
    port: Number(process.env.PORT) || 5173,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: "es2022",
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
