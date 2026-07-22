import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import { FxOverlay } from "./FxOverlay";
import { isTauri } from "./tauri";
import { applyPreviewBootstrap } from "./preview/shotParams";
import "@fontsource/zcool-kuaile/index.css";
import "./styles.css";

// 预览截图引导(?lang/?seed/?shot):必须先于 bridge/mock 引擎的惰性初始化写入
// localStorage;Tauri 真机是空操作。
applyPreviewBootstrap();

// 同一份前端包服务两个窗口：主宠物窗口渲染 App，
// "fx" 特效覆盖层（lib.rs ensure_fx_overlay 创建）只渲染全屏粒子层。
const isFxWindow = (() => {
  if (!isTauri()) return false;
  try {
    return getCurrentWindow().label === "fx";
  } catch {
    return false;
  }
})();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{isFxWindow ? <FxOverlay /> : <App />}</React.StrictMode>,
);
