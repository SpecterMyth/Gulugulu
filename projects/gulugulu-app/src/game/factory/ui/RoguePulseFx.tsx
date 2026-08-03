// 《危楼打工记》演出引擎(GDD 04 §3/§4/§5 的场内覆盖层实现,P3):
// 吸取波 · 通路流光 · 金币喷泉 · jackpot 定格 · 罢工结算阵 · 抗议爆破 ·
// 遣散退款飞钱 · 解雇印章 · 连锁罢工红闪 · 下班彩带 · 全屏速度线。
// 工程铁律(与 200 只画布渲染同一思路,见 PLAN.md §4):
// - 全部命令式 DOM + CSS/WAAPI 动画,不进 React 状态;唯一一条受控 rAF 只服务
//   「飞行物」(金币/退款文字),队列空转即自停;
// - 对象池与预算:金币池与单波金币数会随当前负载退化、其余定时回收节点
//   ≤NODE_BUDGET、彩带一次 ≤CONFETTI_N(GDD §5:≤80);超预算直接丢演出——
//   账目在逻辑层,演出可丢不可错;
// - 透明置顶窗规范:所有全屏件都是加色光效(screen 混合/亮色描边),无暗色 scrim;
// - hit-stop 慢镜由逻辑层 timeScale 控制场景 rAF,本层只做视觉,不碰时钟。

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import type { GameConfig } from "../../../types";
import { formatCount } from "../../format";
import { PULSE_TIERS } from "../rogueConfig";
import { PULSE_TRIGGER_MAX, PULSE_TRIGGER_TARGET_MAX } from "../roguePulse";
import type { PulseBreakdown, RogueTriggerKind } from "../rogueTypes";

type Pt = { x: number; y: number };

/** 一条落地脉冲的完整结算链演出参数(泵在 takePulses 后组装)。 */
export type PulseFxArgs = {
  bd: PulseBreakdown;
  /** 本条入账额(total+Σextras;金币数/速度线档位用)。 */
  gained: number;
  /** 演出分档下标(PULSE_TIERS;泵计算,0~4)。 */
  tier: number;
  /** 落地宠中心(快照查不到时 null → 跳过全部定位类演出)。 */
  at: Pt | null;
  posOf: (uid: number) => Pt | null;
  deskOf: (element: string) => { x: number; w: number; top: number } | null;
  /** 兼容演出开关；额外计分只在主脉冲逐条播放。 */
  includeExtras?: boolean;
};

export type RoguePulseFxApi = {
  pulse(args: PulseFxArgs): void;
  /** 业绩结算完整收尾后播放的永久状态演出；生长/冻结不再挤在入账链中。 */
  aftermath(args: {
    bd: PulseBreakdown;
    delayMs: number;
    at: Pt | null;
    posOf: (uid: number) => Pt | null;
  }): void;
  /** 抗议脉冲(extras kind="protest"):✊/🪧 爆破 + 橙红阵 + 金币照常飞。 */
  protest(args: { at: Pt | null; amount: number; tier: number }): void;
  /** 罢工举牌期:三只脚下的橙红「结算阵」环(时长对齐场景 STRIKE_MS)。 */
  strikeRings(points: { x: number; y: number; r: number }[]): void;
  /** 离场退款:绿色精确金额从离场位飘向钱包(delayMs 等离场演出走完)。 */
  severanceRefund(points: (Pt & { amount: number })[], delayMs: number): void;
  /** 解雇点选命中:红圈 + 「裁」章 0.5s。 */
  dismissStamp(p: { x: number; y: number; r: number } | null): void;
  /** 连锁罢工:屏幕边缘红闪,level 1~3 强度/次数递增。 */
  edgeFlash(level: number): void;
  /** KPI 达标纸屑礼花（与 2 秒便签拼字同窗）。 */
  confetti(): void;
  /** KPI 绩效奖金金币潮：从达标动画中央归集到钱包。 */
  kpiBonus(amount: number): void;
  /** 演出层自检口(?frdebug=1 → window.__frFx):当前存活粒子数。 */
  activeParticles(): number;
};

const SVG_NS = "http://www.w3.org/2000/svg";
const COIN_POOL = 96; // 金币是独立 DOM + 每帧 transform；硬顶避免多脉冲淹没渲染线程
const NODE_BUDGET = 160; // 浮字由 React 层单独保留；这里优先限制装饰性 DOM
const CONFETTI_N = 48; // L3 paper celebration budget
const ABSORB_MAX = 14; // 单次吸取波最多演多少只(超出静默,账不受影响)
const JACKPOT_FREEZE_MS = 400; // jackpot 定格窗口(视觉;慢镜由逻辑层 timeScale)
const STREAMER_MS = 500; // 通路流光时长(04 §3)
const STRIKE_RING_MS = 1150; // 对齐场景 STRIKE_MS(举牌时长)
/** 金币枚数按演出档；主要金额感由不退化的得分数字承担。 */
const COIN_BY_TIER = [10, 16, 24, 32, 40] as const;
function scoreTier(amount: number): number {
  let index = 0;
  PULSE_TIERS.forEach((tier, tierIndex) => {
    if (amount >= tier.min) index = tierIndex;
  });
  return index;
}
const TRIGGER_STYLE: Record<RogueTriggerKind, { group: string; glyph: string }> = {
  ignite: { group: "fire", glyph: "🔥" },
  ember: { group: "fire", glyph: "✦" },
  wildfire: { group: "fire", glyph: "♨" },
  wire: { group: "electric", glyph: "ϟ" },
  overload: { group: "electric", glyph: "⚡" },
  parallel: { group: "electric", glyph: "⑂" },
  induction: { group: "electric", glyph: "⌁" },
  freezePrice: { group: "ice", glyph: "❄" },
  freeze: { group: "ice", glyph: "❄" },
  overstaff: { group: "ice", glyph: "▱" },
  workRest: { group: "water", glyph: "◉" },
  convertEcho: { group: "water", glyph: "◎" },
  sameName: { group: "water", glyph: "○" },
  convert: { group: "water", glyph: "●" },
  grow: { group: "grass", glyph: "♧" },
  lush: { group: "grass", glyph: "❧" },
  height: { group: "grass", glyph: "↟" },
  absorb: { group: "normal", glyph: "◉" },
  gluttony: { group: "normal", glyph: "◖" },
  emperor: { group: "normal", glyph: "♛" },
  arcIgnite: { group: "fire-electric", glyph: "⚡" },
  thermalShock: { group: "fire-ice", glyph: "※" },
  steamBurst: { group: "fire-water", glyph: "☁" },
  greenhouse: { group: "fire-grass", glyph: "☀" },
  fireDispatch: { group: "fire-normal", glyph: "▣" },
  superconduct: { group: "electric-ice", glyph: "ϟ" },
  shortCircuit: { group: "electric-water", glyph: "⊛" },
  bionet: { group: "electric-grass", glyph: "⌘" },
  lightningrod: { group: "electric-normal", glyph: "↯" },
  iceMirror: { group: "ice-water", glyph: "◈" },
  permafrost: { group: "ice-grass", glyph: "❉" },
  coldRotation: { group: "ice-normal", glyph: "▧" },
  irrigation: { group: "water-grass", glyph: "♒" },
  badge: { group: "water-normal", glyph: "◍" },
  multiSeed: { group: "grass-normal", glyph: "✾" },
};

export const RoguePulseFx = forwardRef<
  RoguePulseFxApi,
  {
    config: GameConfig;
    /** 「裁」章文字(i18n)。 */
    dismissText: string;
    /** HUD 总营收计数器中心(舞台坐标;金币喷泉目标)。 */
    getRevenuePoint: () => Pt | null;
    /** HUD 现金钱包中心(遣散退款目标)。 */
    getCashPoint: () => Pt | null;
    /** 金币命中计数器(节流后的计数器弹跳由外层做)。 */
    onCoinHit?: () => void;
    /** 退款 +¥ 命中钱包。 */
    onCashHit?: () => void;
  }
>(function RoguePulseFx(
  { config, dismissText, getRevenuePoint, getCashPoint, onCoinHit, onCashHit },
  ref,
) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const speedRef = useRef<HTMLDivElement | null>(null);
  const confettiEventRef = useRef(0);
  const reducedMotionRef = useRef(
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  const aliveRef = useRef(true);
  const timersRef = useRef(new Set<number>());
  const nodesRef = useRef(0); // 定时回收类节点存活数(含 SVG 件/飞行文字)

  // ---- 飞行物管线(金币/退款文字共用一条 rAF;空了即停) ----
  type Flight = {
    el: HTMLElement;
    pooled: boolean; // true=金币(回池),false=一次性文字(回收)
    sx: number;
    sy: number;
    cx: number;
    cy: number;
    tx: number;
    ty: number;
    start: number;
    dur: number;
    done: "coin" | "cash" | "none";
  };
  const flightsRef = useRef<Flight[]>([]);
  const coinFreeRef = useRef<HTMLDivElement[]>([]);
  const coinCreatedRef = useRef(0);
  const coinLiveRef = useRef(0);
  const coinPendingRef = useRef(0);
  const rafRef = useRef(0);

  /** 受管定时器:卸载统一清,回调前查存活。 */
  const later = useCallback((ms: number, fn: () => void) => {
    const id = window.setTimeout(() => {
      timersRef.current.delete(id);
      if (aliveRef.current) fn();
    }, ms);
    timersRef.current.add(id);
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      for (const id of timersRef.current) window.clearTimeout(id);
      timersRef.current.clear();
      if (rafRef.current !== 0) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      flightsRef.current = [];
    };
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      reducedMotionRef.current = query.matches;
    };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const elColor = useCallback(
    (el: string) => config.elements[el]?.color ?? "#FFD93B",
    [config],
  );

  /** 定时回收节点(CSS 动画自演完,ttl 后移除)。超预算丢弃。 */
  const spawnNode = useCallback(
    (cls: string, ttl: number, setup: (el: HTMLDivElement) => void) => {
      const layer = layerRef.current;
      if (layer == null || nodesRef.current >= NODE_BUDGET) return;
      const el = document.createElement("div");
      el.className = cls;
      setup(el);
      layer.appendChild(el);
      nodesRef.current++;
      later(ttl, () => {
        el.remove();
        nodesRef.current--;
      });
    },
    [later],
  );

  // ---- 飞行 rAF ----
  const step = useCallback(() => {
    const flights = flightsRef.current;
    const now = performance.now();
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i];
      const t = Math.min(1, (now - f.start) / f.dur);
      const k = t * t * (3 - 2 * t); // smoothstep:起手快收尾稳,抛物线读感好
      const u = 1 - k;
      const x = u * u * f.sx + 2 * u * k * f.cx + k * k * f.tx;
      const y = u * u * f.sy + 2 * u * k * f.cy + k * k * f.ty;
      f.el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      if (t >= 1) {
        flights.splice(i, 1);
        if (f.pooled) {
          f.el.style.display = "none";
          coinFreeRef.current.push(f.el as HTMLDivElement);
          coinLiveRef.current--;
        } else {
          f.el.remove();
          nodesRef.current--;
        }
        if (f.done === "coin") onCoinHit?.();
        else if (f.done === "cash") onCashHit?.();
      }
    }
    if (flights.length > 0) rafRef.current = requestAnimationFrame(step);
    else rafRef.current = 0;
  }, [onCoinHit, onCashHit]);

  const ensureRaf = useCallback(() => {
    if (rafRef.current === 0) rafRef.current = requestAnimationFrame(step);
  }, [step]);

  /** 金币出池(懒创建到 COIN_POOL 上限;满了丢演出)。 */
  const takeCoin = useCallback((): HTMLDivElement | null => {
    let el = coinFreeRef.current.pop() ?? null;
    if (el == null) {
      if (coinCreatedRef.current >= COIN_POOL || layerRef.current == null) return null;
      coinCreatedRef.current++;
      el = document.createElement("div");
      el.className = "fr-coin";
      const inner = document.createElement("span");
      inner.className = "fr-coin-in";
      el.appendChild(inner);
      layerRef.current.appendChild(el);
    }
    el.style.display = "";
    coinLiveRef.current++;
    return el;
  }, []);

  /** 钱到账时在计数器处「停滞一下再收进」的收款脉冲(金光一顿 + $ 溅射)。 */
  const spawnCoinLand = useCallback(
    (p: Pt) => {
      spawnNode("fr-coin-land", 520, (el) => {
        el.style.left = `${p.x}px`;
        el.style.top = `${p.y}px`;
      });
    },
    [spawnNode],
  );

  /** 金币喷泉:从 at 成波抛物线飞向**现金**大牌,错峰更紧(密集成潮),
   *  到账处补一记收款脉冲(节奏感:钱聚拢→顿一下→收进)。
   *  落点从总营收改到现金(用户要求「投中的钱飞向 cash」);done:"cash" → 现金牌弹跳。 */
  const coinBurst = useCallback(
    (at: Pt, n: number) => {
      const target = getCashPoint();
      if (target == null) return;
      // 保留一次明确的钱包收款脉冲，但在系统要求减少动态效果时不再创建
      // 数十枚曲线飞行、持续旋转的金币。账目在上游已经结算，这里只降级演出。
      if (reducedMotionRef.current) {
        spawnCoinLand(target);
        onCashHit?.();
        return;
      }
      const load = coinLiveRef.current + coinPendingRef.current;
      // 低负载保留完整钱潮；连续结算时按 40→20→8 枚渐进退化。
      // 每一波仍能分到预算，避免第一条大结算独占整个对象池。
      const adaptiveCap = load < 32 ? 40 : load < 64 ? 20 : 8;
      const shown = Math.min(n, adaptiveCap, Math.max(0, COIN_POOL - load));
      if (shown <= 0) return;
      coinPendingRef.current += shown;
      let last = 0;
      for (let i = 0; i < shown; i++) {
        // 前疏后密的节奏错峰:整体更快(18ms/枚)、越往后越挤,读作「一股钱潮」。
        const delay = i * 18 * (1 - 0.3 * (i / shown));
        last = Math.max(last, delay);
        later(delay, () => {
          coinPendingRef.current = Math.max(0, coinPendingRef.current - 1);
          const el = takeCoin();
          if (el == null) return;
          const sx = at.x + (Math.random() - 0.5) * 44;
          const sy = at.y + (Math.random() - 0.5) * 26;
          const cx = (sx + target.x) / 2 + (Math.random() - 0.5) * 150;
          const cy = Math.max(8, Math.min(sy, target.y) - 80 - Math.random() * 110);
          flightsRef.current.push({
            el,
            pooled: true,
            sx,
            sy,
            cx,
            cy,
            tx: target.x + (Math.random() - 0.5) * 10,
            ty: target.y + (Math.random() - 0.5) * 8,
            start: performance.now(),
            dur: 460 + Math.random() * 260,
            done: "cash",
          });
          ensureRaf();
        });
      }
      // 钱潮抵达计数器的那一拍补收款脉冲(dur 上限 ~720)。
      later(last + 520, () => spawnCoinLand(target));
    },
    [getCashPoint, later, takeCoin, ensureRaf, spawnCoinLand, onCashHit],
  );

  /** 一次性飞行文字(遣散 +¥ 等)。 */
  const flyText = useCallback(
    (text: string, cls: string, from: Pt, to: Pt, dur: number, done: Flight["done"]) => {
      const layer = layerRef.current;
      if (layer == null || nodesRef.current >= NODE_BUDGET) return;
      if (reducedMotionRef.current) {
        spawnNode(`${cls} is-reduced`, 560, (el) => {
          el.textContent = text;
          el.style.transform = `translate3d(${to.x}px, ${to.y}px, 0)`;
        });
        if (done === "coin") onCoinHit?.();
        else if (done === "cash") onCashHit?.();
        return;
      }
      const el = document.createElement("div");
      el.className = cls;
      el.textContent = text;
      layer.appendChild(el);
      nodesRef.current++;
      const cx = (from.x + to.x) / 2 + (Math.random() - 0.5) * 60;
      const cy = Math.max(8, Math.min(from.y, to.y) - 50 - Math.random() * 40);
      flightsRef.current.push({
        el,
        pooled: false,
        sx: from.x,
        sy: from.y,
        cx,
        cy,
        tx: to.x,
        ty: to.y,
        start: performance.now(),
        dur,
        done,
      });
      ensureRaf();
    },
    [ensureRaf, spawnNode, onCoinHit, onCashHit],
  );

  // ---- 结算链各件 ----

  /** 吸取高亮圈(金色;抗议用橙红另有类)。 */
  const spawnRing = useCallback(
    (p: Pt) => {
      spawnNode("fr-absorb-ring", 480, (el) => {
        el.style.left = `${p.x}px`;
        el.style.top = `${p.y}px`;
      });
    },
    [spawnNode],
  );

  /** 小额金屑 +n。 */
  const spawnFleck = useCallback(
    (p: Pt, text: string) => {
      spawnNode("fr-fleck", 660, (el) => {
        el.textContent = text;
        el.style.left = `${p.x}px`;
        el.style.top = `${p.y - 10}px`;
      });
    },
    [spawnNode],
  );

  /** 元素/连携触发短演出；永久状态由 FactoryRogueScene 的状态层负责。 */
  const spawnTrigger = useCallback(
    (kind: RogueTriggerKind, point: Pt, value?: number) => {
      const style = TRIGGER_STYLE[kind];
      spawnNode(`fr-element-trigger is-${style.group}`, 760, (el) => {
        el.style.left = `${point.x}px`;
        el.style.top = `${point.y}px`;
        el.dataset.kind = kind;
        el.innerHTML = `<i>${style.glyph}</i>${value != null ? `<b>${Math.round(value * 100) / 100}</b>` : ""}`;
      });
    },
    [spawnNode],
  );

  const spawnFreezeAftermath = useCallback(
    (point: Pt) => {
      spawnNode("fr-aftermath-freeze", 1500, (el) => {
        el.style.left = `${point.x}px`;
        el.style.top = `${point.y}px`;
        el.innerHTML = `
          <span class="fr-freeze-sweep"></span>
          <span class="fr-freeze-core">❄</span>
          <i style="--a:-76deg"></i><i style="--a:-28deg"></i>
          <i style="--a:20deg"></i><i style="--a:68deg"></i>
          <i style="--a:116deg"></i><i style="--a:164deg"></i>`;
      });
    },
    [spawnNode],
  );

  const spawnGrowAftermath = useCallback(
    (point: Pt) => {
      spawnNode("fr-aftermath-grow", 1650, (el) => {
        el.style.left = `${point.x}px`;
        el.style.top = `${point.y}px`;
        el.innerHTML = `
          <span class="fr-grow-soil"></span>
          <span class="fr-grow-stem"></span>
          <i style="--a:-112deg;--d:48px"></i><i style="--a:-68deg;--d:60px"></i>
          <i style="--a:-25deg;--d:52px"></i><i style="--a:22deg;--d:58px"></i>
          <i style="--a:67deg;--d:50px"></i><i style="--a:118deg;--d:56px"></i>`;
      });
    },
    [spawnNode],
  );

  const spawnFireBurn = useCallback(
    (point: Pt, smoke = false) => {
      spawnNode(`fr-fire-burn${smoke ? " has-smoke" : ""}`, 720, (el) => {
        el.style.left = `${point.x}px`;
        el.style.top = `${point.y}px`;
        el.innerHTML = "<i></i><i></i><i></i><b></b><b></b>";
      });
    },
    [spawnNode],
  );

  const spawnAbsorbMorph = useCallback(
    (from: Pt, to: Pt) => {
      spawnNode("fr-absorb-morph", 920, (el) => {
        el.style.left = `${from.x}px`;
        el.style.top = `${from.y}px`;
        el.style.setProperty("--absorb-x", `${to.x - from.x}px`);
        el.style.setProperty("--absorb-y", `${to.y - from.y}px`);
        el.style.setProperty("--absorb-x-half", `${(to.x - from.x) * 0.45}px`);
        el.style.setProperty("--absorb-y-half", `${(to.y - from.y) * 0.45}px`);
        el.innerHTML = "<i></i><b></b><b></b>";
      });
      spawnNode("fr-eat-pulse", 860, (el) => {
        el.style.left = `${to.x}px`;
        el.style.top = `${to.y}px`;
      });
    },
    [spawnNode],
  );

  /** 通路流光:SVG 折线沿 uid 链坐标,桌色,stroke-dash 从桌跑向落地宠。 */
  const spawnStreamer = useCallback(
    (points: Pt[], color: string) => {
      const svg = svgRef.current;
      if (svg == null || nodesRef.current >= NODE_BUDGET) return;
      const poly = document.createElementNS(SVG_NS, "polyline");
      poly.setAttribute("points", points.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(" "));
      poly.setAttribute("class", "fr-streamer");
      poly.setAttribute("stroke", color);
      poly.style.color = color; // drop-shadow(currentColor) 的辉光取色
      svg.appendChild(poly);
      nodesRef.current++;
      const len = Math.max(1, poly.getTotalLength());
      poly.style.strokeDasharray = `${len}`;
      const reduced = reducedMotionRef.current;
      poly.style.strokeDashoffset = reduced ? "0" : `${len}`;
      poly.animate(
        reduced
          ? [{ opacity: 0 }, { opacity: 0.72, offset: 0.25 }, { opacity: 0 }]
          : [
              { strokeDashoffset: len, opacity: 1 },
              { strokeDashoffset: 0, opacity: 1, offset: 0.72 },
              { strokeDashoffset: 0, opacity: 0 },
            ],
        { duration: reduced ? 180 : STREAMER_MS + 180, easing: "ease-out", fill: "forwards" },
      );
      later(reduced ? 220 : STREAMER_MS + 220, () => {
        poly.remove();
        nodesRef.current--;
      });
    },
    [later],
  );

  /** jackpot 桌色光柱:从桌面矩形升到落地宠(SVG 四边形,screen 混合)。 */
  const spawnPillar = useCallback(
    (d: { x: number; w: number; top: number }, at: Pt, color: string) => {
      const svg = svgRef.current;
      if (svg == null || nodesRef.current >= NODE_BUDGET) return;
      const poly = document.createElementNS(SVG_NS, "polygon");
      poly.setAttribute(
        "points",
        `${d.x},${d.top} ${d.x + d.w},${d.top} ${at.x + 16},${at.y} ${at.x - 16},${at.y}`,
      );
      poly.setAttribute("fill", color);
      poly.setAttribute("class", "fr-pillar");
      svg.appendChild(poly);
      nodesRef.current++;
      const reduced = reducedMotionRef.current;
      poly.animate([{ opacity: 0 }, { opacity: 0.62, offset: 0.25 }, { opacity: 0 }], {
        duration: reduced ? 180 : 480,
        easing: "ease-out",
      });
      later(reduced ? 220 : 500, () => {
        poly.remove();
        nodesRef.current--;
      });
    },
    [later],
  );

  /** 全屏速度线(jackpot / 彩虹档):常驻节点,重触发 class。 */
  const flashSpeedlines = useCallback(() => {
    if (reducedMotionRef.current) return;
    const el = speedRef.current;
    if (el == null) return;
    el.classList.remove("is-on");
    void el.offsetWidth; // 强制重排以重启动画;动画收尾即透明,无需摘类
    el.classList.add("is-on");
  }, []);

  /** ×N! 巨字(jackpot)。 */
  const spawnJackpotText = useCallback(
    (text: string, at: Pt) => {
      const layer = layerRef.current;
      const w = layer?.clientWidth ?? 800;
      spawnNode("fr-jackpot-x", 680, (el) => {
        el.textContent = text;
        el.style.left = `${Math.min(Math.max(at.x, 110), w - 110)}px`;
        el.style.top = `${Math.max(96, at.y - 64)}px`;
      });
    },
    [spawnNode],
  );

  const dist2 = (a: Pt, b: Pt) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);

  // ---- 对外 API ----

  const pulse = useCallback(
    (a: PulseFxArgs) => {
      const at = a.at;
      if (at == null) return; // 快照查不到落地宠:跳过(任务书口径)
      const jackpot = a.bd.deskCount >= 2;
      const d0 = jackpot ? JACKPOT_FREEZE_MS : 0;

      // ── jackpot 定格(0.4s):桌色光柱 + 速度线 + ×N 巨字,然后才走结算链 ──
      if (jackpot) {
        const jackpotDesks = reducedMotionRef.current ? a.bd.desks.slice(0, 1) : a.bd.desks;
        for (const el of jackpotDesks) {
          const d = a.deskOf(el);
          if (d == null) continue; // "prism" 虚拟桌无实体,跳过光柱
          spawnPillar(d, at, elColor(el));
        }
        flashSpeedlines();
        spawnJackpotText(`×${a.bd.deskScoreMult ?? a.bd.deskCount}!`, at);
      }
      // 彩虹档(当前 ≥10⁴)另配全屏速度线(04 §3 表)
      if (a.tier >= 4) later(d0, () => flashSpeedlines());

      // ── 吸取波:按距离错峰(~40ms/只),逐宠亮圈 + 弹小额金屑 ──
      const pts: Array<{ uid: number; point: Pt }> = [];
      for (const uid of a.bd.absorbUids) {
        const p = a.posOf(uid);
        if (p != null) pts.push({ uid, point: p }); // 查不到跳过
      }
      pts.sort((p, q) => dist2(p.point, at) - dist2(q.point, at));
      const shown = pts.slice(0, reducedMotionRef.current ? 4 : ABSORB_MAX);
      const exploitationByUid = new Map(
        a.bd.contributors
          .filter((part) => part.role === "absorbed")
          .map((part) => [part.uid, part.amount]),
      );
      const stagger = Math.min(40, 360 / Math.max(1, shown.length));
      shown.forEach(({ uid, point }, i) => {
        later(d0 + i * stagger, () => {
          spawnRing(point);
          spawnFleck(point, `+${formatCount(exploitationByUid.get(uid) ?? 0)}`);
        });
      });

      // ── 通路流光:每桌一条,桌 → 沿 uid 链 → 落地宠(链序=落地→桌基,反着画) ──
      later(d0 + 60, () => {
        const paths = Object.entries(a.bd.deskPaths);
        const shownPaths = reducedMotionRef.current ? paths.slice(0, 1) : paths;
        for (const [el, chain] of shownPaths) {
          const d = a.deskOf(el);
          if (d == null) continue;
          const points: Pt[] = [{ x: d.x + d.w / 2, y: d.top }];
          for (let i = chain.length - 1; i >= 0; i--) {
            const p = a.posOf(chain[i]);
            if (p != null) points.push(p);
          }
          if (points.length >= 2) spawnStreamer(points, elColor(el));
        }
      });

      // ── 金币喷泉按档生成；高负载只退化装饰币，不影响任何得分数字 ──
      if (a.bd.total > 0) {
        later(d0 + 160, () => coinBurst(at, COIN_BY_TIER[Math.max(0, Math.min(4, a.tier))]));
      }

      // 技能额外计分仍逐条生成得分数字；金币潮按当前装饰预算自适应抽样。
      if (a.includeExtras !== false) {
        let extraStep = 0;
        for (const extra of a.bd.extras) {
          if (extra.amount <= 0 || extra.kind === "protest") continue;
          const point = a.posOf(extra.uid) ?? at;
          const delay = d0 + 260 + extraStep * (extra.kind === "wildfire" ? 170 : 105);
          later(delay, () => {
            if (extra.kind === "fireBurst" || extra.kind === "wildfire") spawnFireBurn(point);
            coinBurst(point, COIN_BY_TIER[scoreTier(extra.amount)]);
          });
          extraStep++;
        }
      }

      // ── 元素技能层:T+220ms 后播，状态改变类优先落在目标身上 ──
      (a.bd.triggers ?? [])
        .filter((trigger) => trigger.kind !== "freeze" && trigger.kind !== "grow")
        .slice(0, reducedMotionRef.current ? 3 : PULSE_TRIGGER_MAX).forEach((trigger, index) => {
        later(d0 + 220 + index * 34, () => {
          const targets = (trigger.targetUids ?? []).slice(0, PULSE_TRIGGER_TARGET_MAX);
          if (targets.length === 0) {
            spawnTrigger(trigger.kind, at, trigger.value);
            return;
          }
          targets.forEach((uid) => {
            const point = a.posOf(uid) ?? at;
            if (trigger.kind === "ember") spawnFireBurn(point, true);
            else spawnTrigger(trigger.kind, point, trigger.value);
          });
        });
      });
    },
    [
      elColor,
      spawnPillar,
      flashSpeedlines,
      spawnJackpotText,
      later,
      spawnRing,
      spawnFleck,
      spawnStreamer,
      coinBurst,
      spawnTrigger,
      spawnFireBurn,
    ],
  );

  const aftermath = useCallback(
    (a: { bd: PulseBreakdown; delayMs: number; at: Pt | null; posOf: (uid: number) => Pt | null }) => {
      const triggers = a.bd.triggers ?? [];
      const freezeTargets = new Set<number>();
      let growPoint: Pt | null = null;
      const absorbs: Array<{ sourceUid: number; targetUid: number }> = [];
      for (const trigger of triggers) {
        if (trigger.kind === "freeze") {
          for (const uid of trigger.targetUids ?? []) freezeTargets.add(uid);
        } else if (trigger.kind === "grow" && growPoint == null) {
          growPoint = a.posOf(trigger.sourceUid) ?? a.at;
        } else if (trigger.kind === "absorb" || trigger.kind === "emperor") {
          const targetUid = trigger.targetUids?.[0];
          if (targetUid != null) absorbs.push({ sourceUid: trigger.sourceUid, targetUid });
        }
      }
      if (freezeTargets.size === 0 && growPoint == null && absorbs.length === 0) return;
      later(a.delayMs, () => {
        freezeTargets.forEach((uid) => {
          const point = a.posOf(uid) ?? a.at;
          if (point != null) spawnFreezeAftermath(point);
        });
        if (growPoint != null) spawnGrowAftermath(growPoint);
        absorbs.forEach(({ sourceUid, targetUid }) => {
          const from = a.posOf(targetUid);
          const to = a.posOf(sourceUid) ?? a.at;
          if (from != null && to != null) spawnAbsorbMorph(from, to);
        });
      });
    },
    [later, spawnFreezeAftermath, spawnGrowAftermath, spawnAbsorbMorph],
  );

  const protest = useCallback(
    (a: { at: Pt | null; amount: number; tier: number }) => {
      const at = a.at;
      if (at == null) return;
      spawnNode("fr-protest-ring", 620, (el) => {
        el.style.left = `${at.x}px`;
        el.style.top = `${at.y}px`;
      });
      const bits = ["✊", "✊", "✊", "🪧", "🪧", "💢"];
      if (!reducedMotionRef.current) {
        bits.forEach((ch, i) => {
          spawnNode("fr-protest-bit", 780, (el) => {
            el.textContent = ch;
            el.style.left = `${at.x}px`;
            el.style.top = `${at.y}px`;
            const ang = (i / bits.length) * Math.PI * 2 + Math.random() * 0.6;
            el.style.setProperty("--dx", `${Math.round(Math.cos(ang) * (40 + Math.random() * 30))}px`);
            el.style.setProperty("--dy", `${Math.round(Math.sin(ang) * (30 + Math.random() * 24) - 26)}px`);
          });
        });
      }
      // 蓄意引爆的爽感与 jackpot 同级:金币照常喷向总营收(GDD 04 §4)
      coinBurst(at, COIN_BY_TIER[Math.max(0, Math.min(4, a.tier))]);
    },
    [spawnNode, coinBurst],
  );

  const strikeRings = useCallback(
    (points: { x: number; y: number; r: number }[]) => {
      points.slice(0, reducedMotionRef.current ? 2 : 6).forEach((p) => {
        spawnNode("fr-strike-ring", STRIKE_RING_MS, (el) => {
          const w = Math.max(46, p.r * 2.6);
          el.style.left = `${p.x}px`;
          el.style.top = `${p.y + p.r}px`;
          el.style.width = `${Math.round(w)}px`;
          el.style.height = `${Math.round(w * 0.38)}px`;
        });
      });
    },
    [spawnNode],
  );

  const severanceRefund = useCallback(
    (points: (Pt & { amount: number })[], delayMs: number) => {
      later(delayMs, () => {
        const to = getCashPoint();
        if (to == null) return;
        points.slice(0, 6).forEach((p, i) => {
          later(i * 80, () => flyText(`+¥${formatCount(p.amount)}`, "fr-refund-fly", p, to, 700, "cash"));
        });
      });
    },
    [later, getCashPoint, flyText],
  );

  const dismissStamp = useCallback(
    (p: { x: number; y: number; r: number } | null) => {
      if (p == null) return;
      spawnNode("fr-dismiss-ring", 540, (el) => {
        const w = Math.max(48, p.r * 2.4);
        el.style.left = `${p.x}px`;
        el.style.top = `${p.y}px`;
        el.style.width = `${Math.round(w)}px`;
        el.style.height = `${Math.round(w)}px`;
      });
      spawnNode("fr-dismiss-stamp", 540, (el) => {
        el.textContent = dismissText;
        el.style.left = `${p.x}px`;
        el.style.top = `${p.y - p.r - 14}px`;
      });
    },
    [spawnNode, dismissText],
  );

  const edgeFlash = useCallback(
    (level: number) => {
      const lv = Math.max(1, Math.min(3, Math.round(level)));
      spawnNode("fr-edge-flash", 520 * lv + 140, (el) => {
        el.style.setProperty("--fr-edge-a", `${0.28 + 0.16 * lv}`);
        el.style.animationIterationCount = `${reducedMotionRef.current ? 1 : lv}`;
      });
    },
    [spawnNode],
  );

  const confetti = useCallback(() => {
    // CSS 也会隐藏彩纸；这里提前返回，避免为不可见演出创建 48 个节点和定时器。
    if (reducedMotionRef.current) return;
    const layer = layerRef.current;
    if (layer == null) return;
    const w = layer.clientWidth || 800;
    const h = layer.clientHeight || 600;
    const colors = ["#FF6B4A", "#FFD93B", "#6FE06A", "#5AB8FF", "#B06FFF", "#7EEAF2"];
    const eventSeed = ++confettiEventRef.current;
    for (let i = 0; i < CONFETTI_N; i++) {
      const shape = i % 5 === 0 ? "is-note" : i % 3 === 0 ? "is-scrap" : "is-strip";
      const unit = ((i * 73 + eventSeed * 41) % 997) / 997;
      const drift = ((i * 131 + eventSeed * 29) % 241) - 120;
      const spin = 300 + ((i * 97 + eventSeed * 53) % 620);
      spawnNode(`fr-confetti ${shape}`, 2100, (el) => {
        el.style.left = `${Math.round(unit * w)}px`;
        el.style.top = "-12px";
        el.style.background = colors[i % colors.length];
        el.style.setProperty("--fall", `${h + 60}px`);
        el.style.setProperty("--drift", `${drift}px`);
        el.style.setProperty("--spin", `${spin}deg`);
        el.style.animationDuration = `${(1.7 + ((i * 17) % 20) / 100).toFixed(2)}s`;
        el.style.animationDelay = `${(((i * 11 + eventSeed) % 10) / 100).toFixed(2)}s`;
      });
    }
  }, [spawnNode]);

  const kpiBonus = useCallback(
    (amount: number) => {
      if (amount <= 0) return;
      const layer = layerRef.current;
      if (layer == null) return;
      const at = {
        x: (layer.clientWidth || 800) / 2,
        y: (layer.clientHeight || 600) * 0.58,
      };
      later(420, () => coinBurst(at, 52));
    },
    [coinBurst, later],
  );

  const activeParticles = useCallback(
    () => nodesRef.current + coinLiveRef.current,
    [],
  );

  useImperativeHandle(
    ref,
    () => ({ pulse, aftermath, protest, strikeRings, severanceRefund, dismissStamp, edgeFlash, confetti, kpiBonus, activeParticles }),
    [pulse, aftermath, protest, strikeRings, severanceRefund, dismissStamp, edgeFlash, confetti, kpiBonus, activeParticles],
  );

  return (
    <>
      {/* Speed lines are scenery-wide feedback, so keep them below every HUD/tutorial surface. */}
      <div className="fr-fx-backdrop" aria-hidden="true">
        <div ref={speedRef} className="fr-speedlines" />
      </div>
      <div ref={layerRef} className="fr-fx-layer" aria-hidden="true">
        <svg ref={svgRef} className="fr-fx-svg" />
      </div>
    </>
  );
});
