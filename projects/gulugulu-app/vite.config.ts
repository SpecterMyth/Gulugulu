import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    // PORT 供预览工具分配动态端口；未设置时保持 Tauri devUrl 约定的 4173。
    // 避开 Docker/Hyper-V/WSL 经 HNS 动态保留的高位端口段；被保留的端口即使
    // 没有进程监听，也会在 strictPort 下直接 listen EACCES。
    port: Number(process.env.PORT) || 4173,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: "es2022",
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
