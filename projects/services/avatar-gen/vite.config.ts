import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "web",
  plugins: [react()],
  clearScreen: false,
  server: {
    host: "127.0.0.1",
    port: 4177,
    strictPort: true,
    proxy: {
      "/api": "http://127.0.0.1:4178",
      "/jobs": "http://127.0.0.1:4178",
    },
  },
  build: {
    outDir: "../dist-web",
    emptyOutDir: true,
    target: "es2022",
  },
});
