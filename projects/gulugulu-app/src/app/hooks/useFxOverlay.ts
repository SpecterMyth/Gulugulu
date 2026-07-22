import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emitTo, listen } from "@tauri-apps/api/event";
import { currentMonitor, getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "../../tauri";
import { resolveWorkFx } from "../../sprites/parts/workFx";
import { getCustomWorkFx } from "../../sprites/customSpecies";
import { getSpeciesVisual } from "../../sprites/speciesTable";
import type { UiMode } from "../../game/GamePanels";
import { celebrationDurationFor, type CelebrationPulse } from "../../game/CelebrationCinematic";
import type { Flight } from "../../game/FlightLayer";
import type { Language } from "../../i18n";
import type { CustomSpeciesEntry, GameConfig } from "../../types";

/** 全屏特效覆盖层：停手该时长后隐藏（覆盖 screen 模式粒子 ~1.5s 滞空） */
const FX_HIDE_DELAY_MS = 2000;
/** 后院升级光效生命周期（与 .yup-root / YardUpgradeFx 一致）。 */
const YARD_FX_LIFETIME_MS = 1600;

type WorkBurst = { id: number; tier: number; seed: number; boom: boolean };

/** 主窗视口 CSS 坐标 → 覆盖层逻辑坐标：加上主窗相对本显示器原点的位移（物理 px
 *  ÷ 缩放 = 逻辑 px）。取不到窗口/显示器信息时返回 null（调用方回退）。 */
async function clientPointToOverlay(
  clientX: number,
  clientY: number,
): Promise<{ x: number; y: number } | null> {
  try {
    const appWindow = getCurrentWindow();
    const [position, monitor] = await Promise.all([appWindow.outerPosition(), currentMonitor()]);
    const scale = window.devicePixelRatio || 1;
    return {
      x: (position.x - (monitor?.position.x ?? 0)) / scale + clientX,
      y: (position.y - (monitor?.position.y ?? 0)) / scale + clientY,
    };
  } catch {
    return null;
  }
}

/** App 显示区（主/后院窗口）在覆盖层坐标里的矩形：庆典/升级光效锚定在这里
 *  「就地」重演——不被窗口边缘硬裁，也不跑到显示器正中。 */
export type OverlayRect = { x: number; y: number; w: number; h: number };

/** 取 App 窗口在本显示器里的逻辑矩形（覆盖层坐标系）。frameless 窗口 outer≈inner。 */
async function appWindowOverlayRect(): Promise<OverlayRect | null> {
  try {
    const appWindow = getCurrentWindow();
    const [position, size, monitor] = await Promise.all([
      appWindow.outerPosition(),
      appWindow.outerSize(),
      currentMonitor(),
    ]);
    const scale = window.devicePixelRatio || 1;
    return {
      x: (position.x - (monitor?.position.x ?? 0)) / scale,
      y: (position.y - (monitor?.position.y ?? 0)) / scale,
      w: size.width / scale,
      h: size.height / scale,
    };
  } catch {
    return null;
  }
}

/** 孵化庆典跨窗负载：本窗口的 pulse + config + 语言 + 该物种（AI 种）注册项。 */
export type CelebrationEmitPayload = {
  pulse: CelebrationPulse;
  config: GameConfig;
  lang: Language;
  customEntry: CustomSpeciesEntry | null;
};

type UseFxOverlayResult = {
  duckFacingRef: RefObject<HTMLDivElement | null>;
  /** 主窗宠物舞台（.pet-stage）：汇聚飞行的嘴部汇聚点据此换算屏幕坐标。 */
  stageRef: RefObject<HTMLDivElement | null>;
  ensureFxOverlay: () => Promise<boolean>;
  hideFxOverlay: () => void;
  spawnWorkBurst: (tier: number, boom: boolean) => void;
  /** 后院打工用：从被点宠物的精灵盒（256 viewBox）发一次全屏爆发；
   *  返回 false 表示未送达覆盖层（调用方回退窗口内渲染）。 */
  emitWorkBurstAtRect: (
    species: string,
    rect: DOMRect,
    tier: number,
    seed: number,
    boom: boolean,
  ) => Promise<boolean>;
  /** 主窗能量饭团：从 .pet-stage 的嘴部汇聚点发一批全屏飞行；返回 false 回退窗口内。 */
  emitFoodFlight: (flights: Array<Omit<Flight, "id">>) => Promise<boolean>;
  /** 孵化庆典：整幕交给全屏覆盖层居中重演；返回 false 回退后院窗口内渲染。 */
  emitCelebration: (payload: CelebrationEmitPayload) => Promise<boolean>;
  /** 后院升级光效：交给全屏覆盖层；返回 false 回退后院窗口内渲染。 */
  emitYardFx: (level: number, cap: number, lang: Language) => Promise<boolean>;
  workBursts: WorkBurst[];
};

/** —— 全屏特效覆盖层（"fx" 子窗口）：粒子飞出宠物小窗、满屏飘散 ——
 *  覆盖层是铺满显示器的透明点击穿透窗口（lib.rs ensure_fx_overlay），主窗口
 *  几何完全不动（不再有连点跳闪）。覆盖层未就绪/预览模式回退窗口内粒子。 */
export function useFxOverlay(uiMode: UiMode, activePetSpecies: string | null): UseFxOverlayResult {
  const [workBursts, setWorkBursts] = useState<WorkBurst[]>([]);
  const workBurstIdRef = useRef(0);

  const duckFacingRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const fxVisibleRef = useRef(false);
  const fxEnsurePendingRef = useRef<Promise<boolean> | null>(null);
  const fxWebviewReadyRef = useRef(false);
  const fxHideTimerRef = useRef<number | null>(null);
  // 隐藏时刻（epoch ms）：scheduleFxHide 只前推、不缩短，避免一次短促打工爆发把
  // 正在播放的庆典（可长达 3.7s）提前收窗、把整幕切断。
  const fxHideAtRef = useRef(0);

  // fx webview 挂载回执：在收到 fx://ready 之前 emit 会被丢弃，先回退窗口内粒子。
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    const unlistenPromise = listen("fx://ready", () => {
      if (!disposed) fxWebviewReadyRef.current = true;
    });
    return () => {
      disposed = true;
      void unlistenPromise.then((dispose) => dispose());
    };
  }, []);

  const ensureFxOverlay = useCallback((): Promise<boolean> => {
    if (!isTauri()) return Promise.resolve(false);
    if (fxVisibleRef.current) return Promise.resolve(true);
    if (!fxEnsurePendingRef.current) {
      fxEnsurePendingRef.current = invoke("ensure_fx_overlay")
        .then(() => {
          fxVisibleRef.current = true;
          return true;
        })
        .catch((error) => {
          // 覆盖层建不出来 → 每次爆发回退窗口内粒子（不再满屏飘散）。把真实
          // 拒绝原因打到控制台，便于定位（Rust 端同时有 [fx-overlay] eprintln）。
          console.error("[fx-overlay] ensure_fx_overlay rejected:", error);
          return false;
        })
        .finally(() => {
          fxEnsurePendingRef.current = null;
        });
    }
    return fxEnsurePendingRef.current;
  }, []);

  const hideFxOverlay = useCallback(() => {
    if (fxHideTimerRef.current) {
      window.clearTimeout(fxHideTimerRef.current);
      fxHideTimerRef.current = null;
    }
    fxHideAtRef.current = 0;
    if (!isTauri() || !fxVisibleRef.current) return;
    fxVisibleRef.current = false;
    void invoke("hide_fx_overlay").catch(() => undefined);
  }, []);

  /** 安排隐藏覆盖层：delayMs 后收窗，但只会把隐藏时刻**前推**（长特效不被短爆发切断）。 */
  const scheduleFxHide = useCallback(
    (delayMs = FX_HIDE_DELAY_MS) => {
      const target = Date.now() + delayMs;
      if (target <= fxHideAtRef.current && fxHideTimerRef.current) return;
      fxHideAtRef.current = target;
      if (fxHideTimerRef.current) window.clearTimeout(fxHideTimerRef.current);
      fxHideTimerRef.current = window.setTimeout(() => {
        fxHideTimerRef.current = null;
        hideFxOverlay();
      }, Math.max(0, target - Date.now()));
    },
    [hideFxOverlay],
  );

  /** 把一次爆发发到全屏覆盖层；返回 false 表示未送达（调用方回退窗口内渲染）。
   *  rect = 发射源精灵盒（256 viewBox，xMidYMid meet）的视口矩形——主窗宠物用
   *  duck-facing，后院用被点宠物的精灵盒。AI 融合物种的粒子设计随事件负载携带
   *  （fx 子窗口没有物种注册表）。 */
  const emitBurstFromRect = useCallback(
    (species: string, rect: DOMRect, tier: number, seed: number, boom: boolean): Promise<boolean> => {
      // 粒子=工具产物：先解出该物种手中工具 id，再统一走 resolveWorkFx。
      const toolId = getSpeciesVisual(species, undefined)?.toolId ?? null;
      const customFx = getCustomWorkFx(species); // 非自定义物种返回 null
      const emitter = resolveWorkFx(species, toolId, customFx)?.emitter;
      if (!isTauri() || !emitter) return Promise.resolve(false);
      return ensureFxOverlay().then(async (shown) => {
        if (!shown) return false;
        if (!fxWebviewReadyRef.current) {
          // 覆盖层窗已在，但还没收到它的 fx://ready（一次性握手可能因重启/HMR 丢失）。
          // 主动 ping，fx 会回一发 ready；本次先回退窗口内，ready 到位后下次即走全屏。
          void emitTo("fx", "fx://ping", null).catch(() => undefined);
          return false;
        }
        try {
          const appWindow = getCurrentWindow();
          const [position, monitor] = await Promise.all([appWindow.outerPosition(), currentMonitor()]);
          const scale = window.devicePixelRatio || 1;
          // 256 viewBox（xMidYMid meet）→ CSS 坐标 → 覆盖层逻辑坐标，
          // 让覆盖层粒子精确从主窗口里工具的位置发射。
          const fit = Math.min(rect.width, rect.height) / 256;
          const emitterX = rect.left + (rect.width - 256 * fit) / 2 + emitter.x * fit;
          const emitterY = rect.top + (rect.height - 256 * fit) / 2 + emitter.y * fit;
          await emitTo("fx", "fx://burst", {
            species,
            tier,
            seed,
            boom,
            customFx,
            toolId,
            x: (position.x - (monitor?.position.x ?? 0)) / scale + emitterX,
            y: (position.y - (monitor?.position.y ?? 0)) / scale + emitterY,
          });
          return true;
        } catch {
          return false;
        }
      });
    },
    [ensureFxOverlay],
  );

  /** 主窗宠物（duck-facing）爆发：读其精灵盒矩形后走统一核心。 */
  const emitFxBurst = useCallback(
    (species: string, tier: number, seed: number, boom: boolean): Promise<boolean> => {
      const el = duckFacingRef.current;
      if (!el) return Promise.resolve(false);
      return emitBurstFromRect(species, el.getBoundingClientRect(), tier, seed, boom);
    },
    [emitBurstFromRect],
  );

  /** 后院打工：从被点宠物精灵盒发一次全屏爆发（覆盖层未就绪时返回 false 回退）。 */
  const emitWorkBurstAtRect = useCallback(
    (species: string, rect: DOMRect, tier: number, seed: number, boom: boolean): Promise<boolean> => {
      if (!isTauri()) return Promise.resolve(false);
      const sent = emitBurstFromRect(species, rect, tier, seed, boom);
      scheduleFxHide();
      return sent;
    },
    [emitBurstFromRect, scheduleFxHide],
  );

  /** 通用「确保覆盖层已就绪再发」外壳：预览模式 / 建窗失败 / 握手未完成都回 false，
   *  由调用方回退窗口内渲染（首帧握手未到时顺手 ping，下次即走全屏）。 */
  const withReadyOverlay = useCallback(
    (send: () => Promise<boolean>): Promise<boolean> => {
      if (!isTauri()) return Promise.resolve(false);
      return ensureFxOverlay().then((shown) => {
        if (!shown) return false;
        if (!fxWebviewReadyRef.current) {
          void emitTo("fx", "fx://ping", null).catch(() => undefined);
          return false;
        }
        return send();
      });
    },
    [ensureFxOverlay],
  );

  /** 主窗能量饭团：把汇聚点（.pet-stage 的 50%/56%，≈宠物嘴部）换成屏幕逻辑坐标，
   *  连同飞行项发给全屏覆盖层——饭团从远处飘来穿过桌面、不被 280×320 小窗上沿截断。 */
  const emitFoodFlight = useCallback(
    (flights: Array<Omit<Flight, "id">>): Promise<boolean> =>
      withReadyOverlay(async () => {
        const stage = stageRef.current;
        if (!stage || flights.length === 0) return false;
        const rect = stage.getBoundingClientRect();
        const point = await clientPointToOverlay(rect.left + rect.width * 0.5, rect.top + rect.height * 0.56);
        if (!point) return false;
        try {
          await emitTo("fx", "fx://flight", { x: point.x, y: point.y, scale: 1, flights });
          scheduleFxHide(2200); // 覆盖饭团 ~1.9s 滞空
          return true;
        } catch {
          return false;
        }
      }),
    [withReadyOverlay, scheduleFxHide],
  );

  /** 孵化庆典：交给全屏覆盖层，但**就地锚定在 App 窗口的实际屏幕位置**（后院底部窄条），
   *  溢出上沿的神光/粒子在覆盖层里向上羽化淡出（不被窗口边缘硬裁、也不漂到显示器正中）。
   *  config/lang/AI 物种注册项随负载携带。取不到窗口矩形 → 回退窗口内渲染。 */
  const emitCelebration = useCallback(
    (payload: CelebrationEmitPayload): Promise<boolean> =>
      withReadyOverlay(async () => {
        const appRect = await appWindowOverlayRect();
        if (!appRect) return false;
        try {
          await emitTo("fx", "fx://celebration", { ...payload, appRect });
          scheduleFxHide(celebrationDurationFor(payload.pulse) + 600);
          return true;
        } catch {
          return false;
        }
      }),
    [withReadyOverlay, scheduleFxHide],
  );

  /** 后院升级光效：同样就地锚定在 App 窗口实际位置，溢出的神光扇向上羽化淡出。 */
  const emitYardFx = useCallback(
    (level: number, cap: number, lang: Language): Promise<boolean> =>
      withReadyOverlay(async () => {
        const appRect = await appWindowOverlayRect();
        if (!appRect) return false;
        try {
          await emitTo("fx", "fx://yardfx", { level, cap, lang, appRect });
          scheduleFxHide(YARD_FX_LIFETIME_MS + 400);
          return true;
        } catch {
          return false;
        }
      }),
    [withReadyOverlay, scheduleFxHide],
  );

  const pushLocalBurst = useCallback((tier: number, seed: number, boom: boolean) => {
    const id = workBurstIdRef.current + 1;
    workBurstIdRef.current = id;
    setWorkBursts((list) => [...list.slice(-7), { id, tier, seed, boom }]);
    window.setTimeout(() => {
      setWorkBursts((list) => list.filter((item) => item.id !== id));
    }, 1250);
  }, []);

  /** 一次工具粒子爆发：优先全屏覆盖层（满屏飘散），未就绪回退窗口内。 */
  const spawnWorkBurst = useCallback(
    (tier: number, boom: boolean) => {
      const seed = (Math.random() * 0xffffffff) >>> 0;
      if (isTauri() && activePetSpecies) {
        void emitFxBurst(activePetSpecies, tier, seed, boom).then((sent) => {
          if (!sent) pushLocalBurst(tier, seed, boom);
        });
        scheduleFxHide();
      } else {
        pushLocalBurst(tier, seed, boom);
      }
    },
    [activePetSpecies, emitFxBurst, pushLocalBurst, scheduleFxHide],
  );

  // 打工连击发生在菜单模式与后院（点击宠物打工）：两者都用全屏覆盖层。
  // 离开这两种模式才收起覆盖层（预热未用到的也一并回收）。
  useEffect(() => {
    if (uiMode !== "menu" && uiMode !== "backyard") hideFxOverlay();
  }, [uiMode, hideFxOverlay]);

  return {
    duckFacingRef,
    stageRef,
    ensureFxOverlay,
    hideFxOverlay,
    spawnWorkBurst,
    emitWorkBurstAtRect,
    emitFoodFlight,
    emitCelebration,
    emitYardFx,
    workBursts,
  };
}
