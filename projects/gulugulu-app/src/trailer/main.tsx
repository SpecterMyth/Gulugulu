// 宣传片舞台入口(预览专用)。复用真实精灵/动画/目录,把 6 段分镜串成
// 一条 1920×1080 时间线,浏览器里真实播放 → 用户 OBS 录屏成片。
// 不走游戏 bridge/mock 引擎:生物直接由 SvgSprite + config 渲染,零存档依赖。
import ReactDOM from "react-dom/client";
import { TrailerPlayer } from "./TrailerPlayer";
import "@fontsource/zcool-kuaile/index.css";
import "../styles.css";
import "../sprites/sprites.css";
import "./trailer.css";

// 英文优先:锁定显示语言(物种/元素名走 en 目录名)。
try {
  window.localStorage.setItem("gulugulu.language", "en");
} catch {
  /* 忽略 */
}

// 不用 StrictMode:避免开发期 effect 双跑扰动 rAF 主时钟。
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<TrailerPlayer />);
