// 预览专用截图参数(仅浏览器预览模式生效,Tauri 真机零行为变化):
//   ?ui=pet|menu|backyard|settings|debug   初始 uiMode(App.tsx 初值)
//   ?panel=shop|museum|market|notice|pits|dex  后院出生点/图鉴开关(BackyardScene)
//   ?lang=zh|en                            初始语言(写 localStorage 后由正常链路生效)
//   ?seed=rich                             注入 mock 种子存档 + 压制全部新手引导
//   ?shot=1                                截图模式:body.shot-mode(去预览虚线框等)
//   ?scale=2.4                             截图模式下小窗 uiMode 的居中放大倍率
// 由 main.tsx 在 createRoot 之前调用 applyPreviewBootstrap()——早于 bridge/mock
// 引擎的惰性初始化,localStorage 写入对同一次加载即刻可见。

import { isTauri } from "../tauri";
import { localGameConfig } from "../game/config";
import { buildSeed } from "../game/mockSeeds";

function params(): URLSearchParams | null {
  if (isTauri()) return null;
  try {
    return new URLSearchParams(window.location.search);
  } catch {
    return null;
  }
}

const UI_MODES = new Set(["pet", "menu", "backyard", "settings", "debug"]);
const PANELS = new Set(["shop", "museum", "market", "notice", "pits", "dex"]);
// 舞台可直接演出的宠物状态(截图定格用);moving 依赖窗口位移不收。
const PET_STATES = new Set(["idle", "working", "laboring", "thinking", "sleeping", "fed", "success", "error"]);

/** ?ui= 请求的初始 uiMode(无/非法 → null)。 */
export function previewUiMode(): string | null {
  const v = params()?.get("ui");
  return v && UI_MODES.has(v) ? v : null;
}

/** ?panel= 请求的后院初始落点(无/非法 → null)。 */
export function previewPanel(): string | null {
  const v = params()?.get("panel");
  return v && PANELS.has(v) ? v : null;
}

/** ?state= 强制舞台宠物姿态(仅 ?shot=1 截图模式下使用;无/非法 → null)。 */
export function previewPetState(): string | null {
  const p = params();
  if (!p || p.get("shot") !== "1") return null;
  const v = p.get("state");
  return v && PET_STATES.has(v) ? v : null;
}

/** ?fx=pops:截图模式下周期性洒金币/经验飘字(打工满屏特效镜头)。 */
export function previewFx(): string | null {
  const p = params();
  if (!p || p.get("shot") !== "1") return null;
  const v = p.get("fx");
  return v === "pops" ? v : null;
}

/** ?tod=<小时|命名> 强制后院昼夜时刻(仅浏览器预览,真机忽略;无/非法 → null)。
 *  接受 0..24 小数,或 dawn/sunrise/day/noon/dusk/sunset/night/midnight 命名。 */
const TOD_NAMED: Record<string, number> = {
  midnight: 0,
  night: 22,
  dawn: 6.3,
  sunrise: 6.6,
  morning: 9,
  day: 13,
  noon: 13,
  afternoon: 16.5,
  dusk: 18.7,
  sunset: 18.8,
  evening: 20,
};
export function previewTimeOfDay(): number | null {
  const v = params()?.get("tod");
  if (!v) return null;
  if (v in TOD_NAMED) return TOD_NAMED[v];
  const num = Number(v);
  return Number.isFinite(num) && num >= 0 && num <= 24 ? num : null;
}

/** 预览引导:语言/种子存档/引导压制/截图模式。幂等,真机与无参数时是空操作。 */
export function applyPreviewBootstrap(): void {
  const p = params();
  if (!p) return;

  const lang = p.get("lang");
  if (lang === "zh" || lang === "en") {
    try {
      window.localStorage.setItem("gulugulu.language", lang);
    } catch {
      /* 忽略 */
    }
  }

  const seedName = p.get("seed");
  if (seedName) {
    try {
      const now = Math.floor(Date.now() / 1000);
      const today = new Date().toISOString().slice(0, 10);
      const save = buildSeed(seedName, localGameConfig, now, today);
      if (save) {
        // ?hero=<species>:指定跟随主角(截图镜头轮换主角,别每张都是同一只)。
        const hero = p.get("hero");
        if (hero) {
          const match = save.pets.find((pet) => pet.species === hero);
          if (match) save.activePetId = match.id;
        }
        window.localStorage.setItem("gulugulu.mock-save", JSON.stringify(save));
        // 种子档 = 老玩家:压掉全部一次性新手引导,保证画面干净可复现。
        window.localStorage.setItem("gulugulu.backyardGuideSeen", "1");
        window.localStorage.setItem(
          "gulugulu.coach",
          JSON.stringify({ done: true, moved: true, switched: true, ceDone: true }),
        );
        window.localStorage.setItem("gulugulu.tokenExpSeen", "1");
        window.localStorage.setItem("gulugulu.keyDiscoverySeen", "1");
        window.localStorage.setItem("gulugulu.lastHeartbeat", String(Date.now()));
      }
    } catch {
      /* 忽略 */
    }
  }

  if (p.get("shot") === "1") {
    document.body.classList.add("shot-mode");
    const scale = Number(p.get("scale"));
    if (Number.isFinite(scale) && scale > 0) {
      document.body.style.setProperty("--shot-scale", String(scale));
    }
    // 商店截图背景 = 仿"经典桌面"(壁纸+桌面图标+任务栏),表达桌面挂机场景;
    // 游戏区域由 styles.css 的 shot-mode 规则沉到画面底部。
    injectDesktopBackdrop(lang === "en" ? "en" : "zh");
  }
}

/** 仿经典桌面背景(纯内联 SVG,全通用图形,不用任何品牌标识/商标图形)。 */
function injectDesktopBackdrop(lang: "zh" | "en"): void {
  const L =
    lang === "zh"
      ? { pc: "此电脑", bin: "回收站", docs: "文档", pics: "图片", ide: "代码", clock: "10:24" }
      : { pc: "This PC", bin: "Recycle Bin", docs: "Documents", pics: "Pictures", ide: "Code", clock: "10:24" };
  const label = (x: number, y: number, text: string) =>
    `<text x="${x}" y="${y}" text-anchor="middle" font-size="13" font-family="Segoe UI, Microsoft YaHei, sans-serif" fill="#ffffff" style="paint-order:stroke" stroke="rgba(0,40,80,0.55)" stroke-width="3">${text}</text>`;
  const iconSlot = (x: number, y: number, glyph: string, text: string) =>
    `<g>${glyph}${label(x + 24, y + 66, text)}</g>`;
  // 通用图形:显示器/垃圾桶/文件夹/相框/代码窗
  const monitor = (x: number, y: number) =>
    `<g transform="translate(${x} ${y})"><rect x="4" y="6" width="40" height="28" rx="4" fill="#cfe8ff" stroke="#2d5f8a" stroke-width="2.5"/><rect x="8" y="10" width="32" height="20" rx="2" fill="#7fb8e8"/><rect x="18" y="36" width="12" height="4" rx="2" fill="#2d5f8a"/><rect x="12" y="41" width="24" height="3.5" rx="1.75" fill="#2d5f8a"/></g>`;
  const bin = (x: number, y: number) =>
    `<g transform="translate(${x} ${y})"><path d="M10 12 L38 12 L34 44 L14 44 Z" fill="#e8f4ff" stroke="#2d5f8a" stroke-width="2.5"/><rect x="7" y="7" width="34" height="6" rx="3" fill="#9fc9ec" stroke="#2d5f8a" stroke-width="2"/><line x1="19" y1="18" x2="20" y2="38" stroke="#7fb0d8" stroke-width="2.5"/><line x1="29" y1="18" x2="28" y2="38" stroke="#7fb0d8" stroke-width="2.5"/></g>`;
  const folder = (x: number, y: number) =>
    `<g transform="translate(${x} ${y})"><path d="M5 14 Q5 10 9 10 L19 10 L23 15 L39 15 Q43 15 43 19 L43 38 Q43 42 39 42 L9 42 Q5 42 5 38 Z" fill="#ffd977" stroke="#b07708" stroke-width="2.5"/><path d="M5 20 L43 20 L43 38 Q43 42 39 42 L9 42 Q5 42 5 38 Z" fill="#ffe9ad"/></g>`;
  const picture = (x: number, y: number) =>
    `<g transform="translate(${x} ${y})"><rect x="6" y="8" width="36" height="32" rx="3" fill="#fffef7" stroke="#8a6410" stroke-width="2.5"/><circle cx="17" cy="19" r="4" fill="#f7d373"/><path d="M9 34 L20 24 L27 30 L33 25 L39 31 L39 37 L9 37 Z" fill="#57b84c"/></g>`;
  const codeWin = (x: number, y: number) =>
    `<g transform="translate(${x} ${y})"><rect x="5" y="8" width="38" height="32" rx="4" fill="#2f3440" stroke="#171b24" stroke-width="2.5"/><rect x="5" y="8" width="38" height="8" rx="4" fill="#454c5e"/><path d="M14 22 L10 26 L14 30" stroke="#8fd8e8" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M22 22 L26 26 L22 30" stroke="#8fd8e8" stroke-width="2.5" fill="none" stroke-linecap="round"/><line x1="30" y1="21" x2="36" y2="31" stroke="#ffd93b" stroke-width="2.5" stroke-linecap="round"/></g>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="dtSky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2f7bd0"/><stop offset="55%" stop-color="#79b8ec"/><stop offset="100%" stop-color="#cfe8fa"/>
    </linearGradient>
    <linearGradient id="dtHill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#7ec85e"/><stop offset="100%" stop-color="#3f8f31"/>
    </linearGradient>
  </defs>
  <rect width="1920" height="1080" fill="url(#dtSky)"/>
  <g fill="#ffffff" opacity="0.85">
    <ellipse cx="420" cy="150" rx="130" ry="42"/><ellipse cx="330" cy="168" rx="80" ry="30"/>
    <ellipse cx="1480" cy="110" rx="150" ry="46"/><ellipse cx="1590" cy="130" rx="90" ry="32"/>
    <ellipse cx="1000" cy="230" rx="100" ry="30" opacity="0.6"/>
  </g>
  <ellipse cx="620" cy="1210" rx="1400" ry="560" fill="url(#dtHill)"/>
  <ellipse cx="1750" cy="1330" rx="1200" ry="620" fill="#5fae4c" opacity="0.9"/>
  ${iconSlot(36, 40, monitor(36, 40), L.pc)}
  ${iconSlot(36, 150, bin(36, 150), L.bin)}
  ${iconSlot(36, 260, folder(36, 260), L.docs)}
  ${iconSlot(36, 370, picture(36, 370), L.pics)}
  ${iconSlot(36, 480, codeWin(36, 480), L.ide)}
  <rect x="0" y="1032" width="1920" height="48" fill="rgba(16,24,38,0.86)"/>
  <circle cx="34" cy="1056" r="13" fill="#8fd8e8"/>
  <circle cx="34" cy="1056" r="6.5" fill="#2f7bd0"/>
  <rect x="64" y="1042" width="250" height="28" rx="14" fill="rgba(255,255,255,0.14)"/>
  <text x="1868" y="1061" text-anchor="end" font-size="15" font-family="Segoe UI, sans-serif" fill="#e8f2fc">${L.clock}</text>
</svg>`;
  const holder = document.createElement("div");
  holder.id = "shot-desktop";
  holder.innerHTML = svg;
  document.body.prepend(holder);
}
