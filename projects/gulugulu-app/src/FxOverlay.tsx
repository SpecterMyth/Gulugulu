import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { emitTo, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { resolveWorkFx, WorkBurst } from "./sprites/parts/workFx";
import type { ResolvedWorkFx } from "./sprites/customSpecies";
import { registerCustomSpecies } from "./sprites/customSpecies";
import { FlightLayer, type Flight } from "./game/FlightLayer";
import {
  CelebrationCinematic,
  celebrationDurationFor,
  type CelebrationPulse,
} from "./game/CelebrationCinematic";
import { YardUpgradeFx } from "./game/YardUpgradeFx";
import { LanguageContext } from "./useT";
import type { Language } from "./i18n";
import type { GameConfig, CustomSpeciesEntry } from "./types";
// 庆典/升级光效的样式（.cine-* / .yup-*）在 backyard.css。fx 子窗口不渲染 BackyardScene，
// 显式引入以自足（Vite 去重；即便未来 BackyardScene 改懒加载，本覆盖层样式也不缺）。
import "./game/backyard.css";

// [诊断-临时] 把 fx 子窗口的挂载/收爆发状态写进原生窗口标题，供外部用 Win32 读取，
// 判断到底卡在哪一环：标题没变=webview 没加载；[live b:0]=挂载了但没收到爆发（主窗握手/发送没成）；
// [live b:N>0]=爆发到了但没渲染。定位后删除。
function fxDiag(label: string): void {
  void getCurrentWindow()
    .setTitle(`Gulugulu FX ${label}`)
    .catch(() => undefined);
}

// -----------------------------------------------------------------------------
// 全屏特效覆盖层（"fx" 子窗口的根组件，见 main.tsx 的窗口 label 分流）。
// 窗口本体由 Rust 的 ensure_fx_overlay 创建：铺满显示器、透明、点击穿透、
// 不抢焦点。它是所有「本会超出主/后院窗口、被窗口边缘硬裁」的特效的统一承载层——
// 主窗口只管把「要放什么、放在屏幕哪个逻辑坐标」通过事件发过来，这里满屏渲染、
// 绝不被那两个窄窗口截断。承载四类：
//   fx://burst        打工工具粒子（screen 模式）
//   fx://flight       能量饭团 / 键帽汇聚飞行（飞向宠物嘴部的屏幕点）
//   fx://celebration  孵化庆典电影化揭晓（就地锚定在 App 显示区、神光/白闪/粒子/主角）
//   fx://yardfx       后院升级光效（神光扇/闪/环/金粒）
// 关键取向（用户拍板）：庆典/升级**不铺满显示器居中**，而是「就地」锚定在 App 窗口
// 的实际显示区（后院底部窄条），溢出上沿的神光靠各自径向遮罩**慢慢淡到全透明**成一圈
// 光冠——既不被窗口边缘硬裁（看起来像窗口有界），也不整幕漂到屏幕正中。见 AnchoredFx。
// 庆典/升级需要 config + 语言 + AI 物种注册项：本窗口不载入存档，全部随事件负载携带。
// -----------------------------------------------------------------------------

/** App 窗口显示区在覆盖层里的逻辑矩形（CSS px，相对本显示器原点）。 */
type OverlayRect = { x: number; y: number; w: number; h: number };

/** 主窗口 → 覆盖层的爆发事件（fx://burst）。x/y 为发射点在本窗口的逻辑坐标。
 *  customFx：AI 融合物种的粒子设计（本窗口没有物种注册表，随事件携带）。 */
type FxBurstPayload = {
  species: string;
  tier: number;
  seed: number;
  boom: boolean;
  x: number;
  y: number;
  customFx?: ResolvedWorkFx | null;
  /** 手中工具 id：粒子=工具产物；legacy 与 AI 兜底路径靠它解析。 */
  toolId?: string | null;
};

type OverlayBurst = FxBurstPayload & { id: number };

/** 汇聚飞行事件（fx://flight）：x/y = 汇聚点（宠物嘴部）在本窗口的逻辑坐标；
 *  scale = 源场景像素缩放（主窗=1，后院随相机缩放）；flights = 一批飞行项。 */
type FxFlightPayload = {
  x: number;
  y: number;
  scale: number;
  flights: Array<Omit<Flight, "id">>;
};

type OverlayFlightGroup = { id: number; x: number; y: number; scale: number; flights: Flight[] };

/** 孵化庆典事件（fx://celebration）：就地锚定在 appRect（App 显示区）重演。
 *  config/lang/customEntry 随负载携带（本窗口无存档/物种注册表/语言上下文）。 */
type FxCelebrationPayload = {
  pulse: CelebrationPulse;
  config: GameConfig;
  lang: Language;
  /** 该物种若是 AI 自定义种，携带其注册项以便本窗口渲染主角精灵；内置种为 null。 */
  customEntry?: CustomSpeciesEntry | null;
  /** App 窗口显示区（就地锚定用）；缺省时回退整台显示器。 */
  appRect?: OverlayRect;
};

type OverlayCine = {
  id: number;
  pulse: CelebrationPulse;
  config: GameConfig;
  lang: Language;
  appRect: OverlayRect;
};

/** 后院升级光效事件（fx://yardfx）：同样就地锚定在 appRect。 */
type FxYardPayload = {
  level: number;
  cap: number;
  lang: Language;
  appRect?: OverlayRect;
};

type OverlayYard = { id: number; level: number; cap: number; lang: Language; appRect: OverlayRect };

/** 覆盖 screen 模式粒子的最长滞空（dur 0.9+0.55 + delay 0.08 ≈ 1.53s）。 */
const BURST_LIFETIME_MS = 1700;
/** 后院升级光效生命周期（与 .yup-root 一致，见 YardUpgradeFx / BackyardScene）。 */
const YARD_FX_LIFETIME_MS = 1600;

/** 一批飞行项的最长滞空（用于整组自动回收）。 */
function flightGroupLifetime(flights: Array<Omit<Flight, "id">>): number {
  const longest = flights.reduce((max, f) => Math.max(max, f.durationMs + f.delayMs), 0);
  return longest + 300;
}

/** 取不到 appRect（老负载/异常）时的兜底：整台显示器（覆盖层视口）。 */
function fallbackRect(): OverlayRect {
  return { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
}

/** 把特效「就地」锚定在 App 窗口显示区（后院底部窄条）：锚定盒 = appRect，效果根
 *  以 inset:0 填满它 → 庆典主角 / 升级徽章据此居中在 App 实际位置。神光溢出上沿后
 *  靠各自的**径向遮罩**慢慢淡到全透明（见 styles.css，尺寸随 --app-h 收敛），就地成
 *  一圈羽化光冠——不被窄窗硬裁成矩形边界，也不铺满显示器居中。 */
function AnchoredFx({ rect, children }: { rect: OverlayRect; children: ReactNode }) {
  return (
    <div
      className="fx-overlay-anchor"
      style={
        {
          left: `${rect.x}px`,
          top: `${rect.y}px`,
          width: `${rect.w}px`,
          height: `${rect.h}px`,
          // 神光尺度锚 = App 显示区高度（覆盖层里 100vh 会取到整台显示器高→铺满全屏）。
          "--app-h": `${rect.h}px`,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}

export function FxOverlay() {
  const [bursts, setBursts] = useState<OverlayBurst[]>([]);
  const [flightGroups, setFlightGroups] = useState<OverlayFlightGroup[]>([]);
  const [cines, setCines] = useState<OverlayCine[]>([]);
  const [yards, setYards] = useState<OverlayYard[]>([]);
  const idRef = useRef(0);
  const nextId = (): number => (idRef.current += 1);

  const burstCountRef = useRef(0);
  useEffect(() => {
    let disposed = false;
    const timers = new Set<number>();
    const track = (fn: () => void, ms: number): void => {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        if (!disposed) fn();
      }, ms);
      timers.add(timer);
    };

    fxDiag("[live b:0]"); // [诊断-临时] FxOverlay 已挂载

    const unlistenBurst = listen<FxBurstPayload>("fx://burst", (event) => {
      if (disposed) return;
      burstCountRef.current += 1;
      fxDiag(`[live b:${burstCountRef.current}]`); // [诊断-临时] 收到一次爆发
      const id = nextId();
      setBursts((list) => [...list.slice(-23), { ...event.payload, id }]);
      track(() => setBursts((list) => list.filter((item) => item.id !== id)), BURST_LIFETIME_MS);
    });

    const unlistenFlight = listen<FxFlightPayload>("fx://flight", (event) => {
      if (disposed) return;
      const { x, y, scale, flights } = event.payload;
      if (!Array.isArray(flights) || flights.length === 0) return;
      const id = nextId();
      const withIds: Flight[] = flights.map((f, index) => ({ ...f, id: index }));
      setFlightGroups((list) => [...list.slice(-11), { id, x, y, scale: scale || 1, flights: withIds }]);
      track(
        () => setFlightGroups((list) => list.filter((item) => item.id !== id)),
        flightGroupLifetime(flights),
      );
    });

    const unlistenCine = listen<FxCelebrationPayload>("fx://celebration", (event) => {
      if (disposed) return;
      const { pulse, config, lang, customEntry, appRect } = event.payload;
      if (!pulse || !config) return;
      // 本窗口无存档：AI 自定义种随事件带注册项，渲染主角精灵前先灌入注册表。
      // pulse.species 在融合脉冲上可为 null（仅孵化幕带具体物种）；truthy 收窄到 string。
      if (customEntry && pulse.species) {
        try {
          registerCustomSpecies({ [pulse.species]: customEntry });
        } catch {
          // 坏数据静默跳过：主角回落 config 兜底形象
        }
      }
      const id = nextId();
      setCines((list) => [...list.slice(-3), { id, pulse, config, lang, appRect: appRect ?? fallbackRect() }]);
      track(() => setCines((list) => list.filter((item) => item.id !== id)), celebrationDurationFor(pulse));
    });

    const unlistenYard = listen<FxYardPayload>("fx://yardfx", (event) => {
      if (disposed) return;
      const { level, cap, lang, appRect } = event.payload;
      const id = nextId();
      setYards((list) => [...list.slice(-3), { id, level, cap, lang, appRect: appRect ?? fallbackRect() }]);
      track(() => setYards((list) => list.filter((item) => item.id !== id)), YARD_FX_LIFETIME_MS);
    });

    // 就绪握手：挂载即广播一次 fx://ready。但这是一次性事件——主窗若此刻没在听
    // （重启 / HMR 重挂 / 时序），就永远错过、整会话回退窗口内粒子。故再加一条
    // 应答通道：主窗要发爆发却发现自己没就绪时会 ping 过来，这里回一发 ready，
    // 让握手可自愈（见 useFxOverlay.emitFxBurst）。
    void emitTo("main", "fx://ready", null).catch(() => undefined);
    const unlistenPing = listen("fx://ping", () => {
      if (disposed) return;
      void emitTo("main", "fx://ready", null).catch(() => undefined);
    });

    return () => {
      disposed = true;
      for (const timer of timers) window.clearTimeout(timer);
      void unlistenBurst.then((dispose) => dispose());
      void unlistenFlight.then((dispose) => dispose());
      void unlistenCine.then((dispose) => dispose());
      void unlistenYard.then((dispose) => dispose());
      void unlistenPing.then((dispose) => dispose());
    };
  }, []);

  return (
    <div className="fx-overlay" aria-hidden="true">
      {bursts.map((burst) => {
        const emitter =
          resolveWorkFx(burst.species, burst.toolId, burst.customFx)?.emitter ?? { x: 128, y: 128 };
        return (
          <div
            key={`burst-${burst.id}`}
            className="fx-overlay-burst"
            // 256 viewBox 以 1:1 渲染，把发射点精确对到主窗口里工具的屏幕位置
            style={{ left: burst.x - emitter.x, top: burst.y - emitter.y }}
          >
            <WorkBurst
              species={burst.species}
              tier={burst.tier}
              seed={burst.seed}
              boom={burst.boom}
              customFx={burst.customFx}
              toolId={burst.toolId}
              screen
            />
          </div>
        );
      })}

      {/* 汇聚飞行（能量饭团 / 键帽）：整组绕汇聚点 (x,y) 做缩放，源场景缩放≠1 时
          偏移与字形一起等比缩放（transform-origin 落在汇聚点，汇聚点本身不动）。 */}
      {flightGroups.map((group) => (
        <div
          key={`flight-${group.id}`}
          className="fx-overlay-flight-group"
          style={
            group.scale !== 1
              ? ({ transform: `scale(${group.scale})`, transformOrigin: `${group.x}px ${group.y}px` } as CSSProperties)
              : undefined
          }
        >
          <FlightLayer
            flights={group.flights}
            targetLeft={`${group.x}px`}
            targetTop={`${group.y}px`}
            onDone={(fid) =>
              setFlightGroups((list) =>
                list.map((item) =>
                  item.id === group.id
                    ? { ...item, flights: item.flights.filter((f) => f.id !== fid) }
                    : item,
                ),
              )
            }
          />
        </div>
      ))}

      {/* 孵化庆典电影化揭晓：就地锚定在 App 显示区（后院底部窄条），神光/粒子溢出
          上沿在覆盖层里羽化淡出（不被窄窗硬裁，也不漂到显示器正中）。 */}
      {cines.map((cine) => (
        <AnchoredFx key={`cine-${cine.id}`} rect={cine.appRect}>
          <LanguageContext.Provider value={cine.lang}>
            <CelebrationCinematic pulse={cine.pulse} config={cine.config} onSkip={() => undefined} />
          </LanguageContext.Provider>
        </AnchoredFx>
      ))}

      {/* 后院升级光效：同样就地锚定 + 溢出羽化淡出。 */}
      {yards.map((yard) => (
        <AnchoredFx key={`yard-${yard.id}`} rect={yard.appRect}>
          <LanguageContext.Provider value={yard.lang}>
            <YardUpgradeFx level={yard.level} cap={yard.cap} />
          </LanguageContext.Provider>
        </AnchoredFx>
      ))}
    </div>
  );
}
