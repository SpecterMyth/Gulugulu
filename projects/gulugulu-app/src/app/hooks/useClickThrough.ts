import { type RefObject, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { isTauri } from "../../tauri";
import type { UiMode } from "../../game/GamePanels";

/** Rust 侧 `click_through.rs` 推来的探针：主窗客户区**物理**像素。 */
type HitProbe = { x: number; y: number };

/** 光标周围这个半径（CSS px）内只要有画出来的像素就算「实心」。
 *  纯轮廓判定手感太苛刻（用户瞄着宠物点、差几像素就掉到桌面上），
 *  留一圈余量；反过来也让「移向宠物」提前于真正接触就切回实心，
 *  遮住 40ms 轮询间隔可能吞掉的那一次点击。 */
export const HIT_DILATION_PX = 10;

/**
 * Only full interaction surfaces disable pixel hit-testing. Onboarding is not
 * one of them: its card and current target are already painted DOM regions, so
 * keeping the watcher alive lets the rest of the transparent pet window pass
 * clicks through to the desktop.
 */
export function shouldEnableClickThrough(uiMode: UiMode, hasBlockingDialog: boolean): boolean {
  return !hasBlockingDialog && (uiMode === "pet" || uiMode === "backyard" || uiMode === "factory");
}

/** 中心 + 一圈 8 向采样（斜向按 √2/2 折算，保证都落在半径上）。 */
const HIT_SAMPLE_RING: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [0.7071, 0.7071],
  [0.7071, -0.7071],
  [-0.7071, 0.7071],
  [-0.7071, -0.7071],
];

/** 「只是骨架、本身不画任何东西」的元素：命中它们等于命中了透明区，
 *  继续往上找。其余一律算实心——判错方向要选安全的那侧（把该穿的判成
 *  实心只是没修好，把 UI 判成穿透会让用户点不动自己的界面）。
 *
 *  `<svg>` 根另行判断（见 [`isSolidElement`]）：SVG 子图形默认
 *  `pointer-events: visiblePainted`，只在真正描画处命中，所以拿到 svg 根本身
 *  就代表「这里是精灵的透明缝隙」。 */
const PASSTHROUGH_SELECTOR = [
  "html",
  "body",
  "#root",
  "main.pet-shell",
  ".pet-stage",
  ".duck-facing",
  ".pet-react-pulse",
  // 蛋的定位壳（display:grid，自身不画东西）；漏了它整颗蛋会退化成 150px 见方的实心块。
  ".stage-egg",
  // ── 后院：根 + 缩放舞台 + 三个视差层 + 调色包裹层，全是 background:transparent 的容器。
  //    天空（.by-sky）本就 pointer-events:none，命中会直接落到这些容器上 → 判穿透。
  //    地面/布景是它们里面有底色的裸 div → 判实心，「点地行走」照常。
  ".backyard",
  ".by-stage",
  ".by-layer",
  ".by-grade-scene",
  // ── 工厂：根舞台同样是透明天空（场景只画顶部运输机与底部办公室）。
  ".fac-stage",
  // ── 危楼打工记(rogue)：局面根 .fr-stage / 场景包壳 .fr-scene-wrap / 浮层 .fr-overlay
  //    都是 background:transparent 的容器。选人/商店/结算面板本身(.fr-panel)有底色 →
  //    判实心照常拦点;面板四周的透明区落到这些容器 → 判穿透,点击直达桌面/后面的窗口
  //    (弹窗不再挡住整个屏幕)。.fr-overlay 已 pointer-events:none,列入是双保险。
  ".fr-stage",
  ".fr-scene-wrap",
  ".fr-overlay",
  "[data-passthrough]",
].join(", ");

function isSolidElement(hit: Element | null): boolean {
  let node: Element | null = hit;
  while (node) {
    // svg 根 = 落在精灵轮廓外的空隙；骨架元素 = 透明容器。两者都看它背后是什么。
    if (node instanceof SVGSVGElement || node.matches(PASSTHROUGH_SELECTOR)) {
      node = node.parentElement;
      continue;
    }
    return true;
  }
  return false;
}

/** 附加命中区：DOM 之外的自绘内容（如工厂打工山 canvas，pointer-events:none +
 *  内容逐帧自绘，elementFromPoint 拿不到形状）。谓词入参 = 视口 CSS 坐标，
 *  任一谓词命中即判实心。注册方（场景组件）负责在卸载时注销。 */
const EXTRA_HIT_REGIONS = new Set<(x: number, y: number) => boolean>();

export function registerHitRegion(test: (x: number, y: number) => boolean): () => void {
  EXTRA_HIT_REGIONS.add(test);
  return () => {
    EXTRA_HIT_REGIONS.delete(test);
  };
}

/** 该点（视口 CSS 坐标）底下有没有真正画出来的东西（不含膨胀余量）。 */
export function isPaintedAt(x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) return false;
  if (isSolidElement(document.elementFromPoint(x, y))) return true;
  for (const test of EXTRA_HIT_REGIONS) {
    if (test(x, y)) return true;
  }
  return false;
}

/** 落在窗口四边这条实心带里吗（0 = 不留带子）。见 [`useClickThrough`] 的 edgeGripPx。 */
export function isEdgeGrip(x: number, y: number, gripPx: number): boolean {
  if (gripPx <= 0) return false;
  return (
    x <= gripPx ||
    y <= gripPx ||
    x >= window.innerWidth - gripPx ||
    y >= window.innerHeight - gripPx
  );
}

/** 命中判定：中心点 + [`HIT_DILATION_PX`] 半径上的一圈采样，任一实心即实心。 */
export function isSolidAt(x: number, y: number): boolean {
  if (isPaintedAt(x, y)) return true;
  return HIT_SAMPLE_RING.some(([dx, dy]) =>
    isPaintedAt(x + dx * HIT_DILATION_PX, y + dy * HIT_DILATION_PX),
  );
}

/**
 * 透明桌宠窗口的点击穿透（配合 `src-tauri/src/click_through.rs`）。
 *
 * 280×320 的窗里真正画出来的只有底部那只精灵，其余透明区照样吃掉鼠标点击。
 * Rust 线程轮询全局光标 → 本 hook 用 `document.elementFromPoint` 判断光标下有没有
 * 画出来的像素 → 回调 Rust 切 `set_ignore_cursor_events`。
 *
 * @param enabled 纯宠物 / 后院 / 工厂三种界面开。菜单/设置/调试**不能**开：那里点
 *                窗口空白处是「返回上一层」（App.tsx handleShellPointerDown），穿透会
 *                把那个交互吃掉；后院/工厂的场景铺满整个 shell，不存在那块空白。
 * @param dragActiveRef 原生拖窗期间强制实心，别让判定在拖动中途把窗口拆穿。
 * @param edgeGripPx 沿窗口四边保留的实心带宽度。后院是 resizable 的无边框窗，靠 OS
 *                   边框热区拖上沿改高（高度记在 gulugulu.backyardHeight.v2）——那圈热区
 *                   压在透明天空上，不留这条带子就再也拉不动了。
 */
export function useClickThrough(
  enabled: boolean,
  dragActiveRef: RefObject<{ active: boolean } | null>,
  edgeGripPx = 0,
): void {
  useEffect(() => {
    if (!isTauri()) return;
    if (!enabled) {
      // 不能只“不开监听”：热更新或模式切换前窗口可能已经处于 ignore=true，
      // Rust 的 WATCHING 也可能仍是开启状态。必须显式停表并恢复实心，否则整个
      // 无边框窗口会永久穿透，连当前引导目标也收不到 pointerdown。
      void invoke("set_click_through_watch", { enabled: false }).catch(() => undefined);
      return;
    }

    // applied 只记「已经下发给 OS 的值」，避免每帧都发一次 IPC。
    let applied = false;
    const apply = (ignore: boolean) => {
      if (applied === ignore) return;
      applied = ignore;
      void invoke("set_click_through", { ignore }).catch(() => {
        // 下发失败就当没发过，下一帧重试（别把状态记成已生效）。
        applied = !ignore;
      });
    };

    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen<HitProbe>("pet://hit-probe", (event) => {
      if (dragActiveRef.current?.active) {
        apply(false);
        return;
      }
      const scale = window.devicePixelRatio || 1;
      const x = event.payload.x / scale;
      const y = event.payload.y / scale;
      if (isEdgeGrip(x, y, edgeGripPx)) {
        apply(false);
        return;
      }
      apply(!isSolidAt(x, y));
    })
      .then((dispose) => {
        if (disposed) {
          dispose();
          return;
        }
        unlisten = dispose;
      })
      .catch(() => undefined);

    void invoke("set_click_through_watch", { enabled: true }).catch(() => undefined);

    return () => {
      disposed = true;
      unlisten?.();
      // 退出纯宠物界面：停轮询 + 恢复实心（Rust 侧同一命令里一并做掉，
      // 免得停在穿透态后再没有探针来纠正）。
      applied = false;
      void invoke("set_click_through_watch", { enabled: false }).catch(() => undefined);
    };
  }, [dragActiveRef, edgeGripPx, enabled]);
}
