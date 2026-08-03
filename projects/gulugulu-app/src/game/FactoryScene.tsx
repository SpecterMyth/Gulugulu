// 工厂玩法场景：
//  · 底部是一间办公室：背景分远/近两级纵深（远景厂房剪影 + 近景错落屋脊线的
//    办公墙 + 后地板带，全部纯代码 SVG，不参与碰撞）；前景是六张「属性打工桌」
//    （六元素各一张，低/高两层交错、桌间留空，按实际屏宽动态排布保证六张全在
//    屏内），桌面板是碰撞体——宠物落下/反弹都会被它挡住，也能落定在桌面上。
//  · 顶部一架运输机巡航（横穿屏幕的时间固定：屏越宽飞越快），机腹吊着一只
//    随机在养宠。点击空处 / 按空格 → 空投：宠物落体，与桌面/地面/已落定宠物
//    做碰撞弹跳，稳定后转 drop → laboring（打工循环）。
//  · 已落定宠物成为静态地形，按外形堆叠成打工小山；被压在下层的逐级压扁。
//  · 三只**同物种**落定宠彼此接触连成一片 → 集体罢工：原地跺脚抗议后向屏幕
//    两侧快跑消失；点击任何一只落定宠 → 当场解雇，向最近的屏边跑掉。
//    两者都会让失去支撑的上层宠物坍塌重新落体，可与新的罢工连锁。
// 场景只读存档（save.pets），不写任何游戏状态；无 invoke，预览模式全功能可用。

import {
  createElement,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { GameConfig, GameSave, PetState } from "../types";
import { SvgSprite } from "../sprites/SvgSprite";
import { getSpeciesVisual } from "../sprites/speciesTable";
import { elementName, fmt } from "../i18n";
import { useT } from "../useT";
import { BADGE_PATHS } from "./ElementIcon";
import { previewFacPile } from "../preview/shotParams";
import { registerHitRegion } from "../app/hooks/useClickThrough";
import type { BodyLike, RogueSceneBridge } from "./factory/rogueTypes";
import { buildAdjacency } from "./factory/rogueGraph";
import { projectFactoryDropGuide } from "./factory/dropGuide";
import { FACTORY_ROGUE } from "../i18n/factoryRogue";
import { FactoryHudPosts, demoHudData, type FactoryHudData } from "./factory/ui/FactoryHudPosts";
import { listen } from "@tauri-apps/api/event";
import "./factory.css";

// ---- 布景/物理常量 ----------------------------------------------------------

/** 宠物渲染盒（px，后院 CHAR_SIZE=120 的略小一档：山里挤得下更多打工仔）。 */
const PET_SIZE = 104;
// Physics uses a species-specific circle that can be much narrower than the
// rendered 104px sprite (arms, ears and tools may reach the SVG edges).  Wall
// constraints must therefore reserve the visual half-width, not just b.r, or
// wide working poses get clipped by .fac-stage at the sides.
// Working rigs are allowed to draw outside their 256×256 SVG viewport.  The
// frostpeng/yeti's long arm is the widest pose: its hammer swing reaches about
// 22px past the 104px layout box.  Keep that animated silhouette inside the
// clipped factory stage as well as the static sprite box.
const PET_WORK_POSE_OVERHANG = 24;
const PET_VISUAL_HALF_W = PET_SIZE / 2 + PET_WORK_POSE_OVERHANG;
/** 精灵脚底线在 256 viewBox 里压在 y=233（sprites/STYLE.md），换算渲染盒比例。 */
const FEET_RATIO = 233 / 256;

const PLANE_W = 190;
const PLANE_TOP = 22;
/** 吊绳下端（宠物盒顶）相对场景顶的 y：机身 64 + 吊绳 18。 */
const HANG_TOP = PLANE_TOP + 64 + 18;
/** 横穿一趟巡航区的固定时长（s）：速度 = 巡航区宽 ÷ 该值 → 屏越宽飞越快。 */
const PLANE_CROSS_S = 5.2;
/** 巡航折返点（占场景宽比例）：全屏停靠后贴屏横扫整个屏幕顶部。 */
const PLANE_PATROL_MIN = 0.02;
const PLANE_PATROL_MAX = 0.98;
const RELOAD_MS = 900; // 空投后机上补货延迟
const CAPTURE_MOTION_SCALE = (() => {
  if (typeof window === "undefined") return 1;
  const query = new URLSearchParams(window.location.search);
  if (query.get("frdebug") !== "1") return 1;
  const raw = Number(query.get("frcaptureSpeed"));
  return Number.isFinite(raw) ? Math.min(3, Math.max(1, raw)) : 1;
})();
const OVERTIME_INTERVAL_MS = 1000;
const OVERTIME_JUMP_MS = 820;
/** 加班落定后留给得分层抓取落点/主角精灵的时间，之后开始逃回雇佣池。 */
const OVERTIME_ESCAPE_DELAY_MS = 120;

const GRAVITY = 2500; // px/s²
const REST_GROUND = 0.42; // 地面弹性
/** 属性不合的弹开：弹性系数 + 最低反弹速度（保证从凹槽里也能弹出去，不卡在异属性堆里）。 */
const REST_MISMATCH = 0.55;
const MISMATCH_POP = 240;
const WALL_PAD = 14;
const FLOOR_H = 52; // 办公室地板带高（脚底线 = 场景高 - FLOOR_H）
/** 办公室布景总高（OfficeBackdrop viewBox 同值，贴场景底对齐）：
 *  窗外远景 352 + 背景墙 216 + 地板 52。设计稿 7a 的 760 画布里墙:地板 = 82:20，
 *  本实现按 216:52 等比放大 ≈2.63×，窗户浮在墙顶之上、透出玩家真实桌面。 */
const OFFICE_H = 620;
/** 背景墙顶 / 地板顶在 OfficeBackdrop viewBox 里的 y。 */
const WALL_H = 216;
const FLOOR_TOP_Y = OFFICE_H - FLOOR_H;
const WALL_TOP_Y = FLOOR_TOP_Y - WALL_H;
const SETTLE_SPEED = 75; // 低于此速度且有支撑 → 落定
const MIN_AIR_MS = 260; // 出手后的最短飞行时间（防止贴脸秒落定）
const MAX_AIR_MS = 7000; // 物理兜底：超时强制落定
/** 粘附的最低 y（防同属性链把柱子粘到运输机航线）：太高一律按弹开处理。 */
const SETTLE_MIN_Y = 230;

const MAX_PILE = 200; // 打工山上限
const SQUISH_PER_WEIGHT = 0.065; // 每压一只的纵向压扁量
const SQUISH_MAX = 0.34; // 最大压扁比例（scaleY 最低 0.66）
/** 被压 ≥ 此层数的宠物动画定格（被压扁动不了的梗；画布侧=帧号冻结）。 */
const BURIED_WEIGHT = 3;
/** 落定后保留活体 SVG 的宽限（演完 drop 落地压扁 / Q 弹粘附），之后卸载 DOM、
 *  转入打工山画布批量绘制：200 只满编时逐帧重绘的只剩空投中的两三只活体
 *  （见 FPS 探针 A/B：瓶颈=SVG 骨骼动画重绘）。 */
const SWAP_GRACE_MS = 700;

// ---- 罢工 / 解雇 ----
/** 同物种连通分量达到该数量 → 集体罢工。 */
const STRIKE_COUNT = 3;
/** 罢工原地抗议时长（跺脚 + 举牌），之后转身跑路。 */
const STRIKE_MS = 1150;
/** 跑路速度（px/s）。 */
const RUN_SPEED = 560;
/** 同物种"连在一起"的接触判定（圆心距 ≤ 半径和 × 此系数）。 */
const CONTACT_SLACK = 1.3;
/** N1 结算聚光时长（2s：把**场景绘制层**压暗、得分宠打工 + 三波打工粒子、桌子
 *  高亮/其余灰显后缓复。只压暗场景像素,不动透出来的桌面）。 */
const SPOTLIGHT_MS = 2000;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** uid 稳定伪随机：每只角色形状不同，但逐帧重画不会抖动。 */
const stateRand = (uid: number, salt: number): number => {
  let n = (uid * 0x9e3779b1 + salt * 0x85ebca6b) | 0;
  n ^= n >>> 16;
  n = Math.imul(n, 0x7feb352d);
  n ^= n >>> 15;
  return (n >>> 0) / 0xffffffff;
};

/** 常驻生长/冻结纹样直接画进角色坐标系，因此自动继承移动、压扁、浮动和场景压暗。 */
function drawBodyElementState(
  ctx: CanvasRenderingContext2D,
  uid: number,
  generated: boolean,
  frozen: boolean,
): void {
  if (generated) {
    const side = stateRand(uid, 1) < 0.5 ? -1 : 1;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#3f9d45";
    ctx.lineWidth = 3.4;
    ctx.shadowColor = "rgba(100,220,84,.65)";
    ctx.shadowBlur = 5;
    const stems = 2 + Math.floor(stateRand(uid, 2) * 2);
    for (let i = 0; i < stems; i++) {
      const s = i === 0 ? side : (i % 2 === 0 ? side : -side);
      const x0 = s * (13 + stateRand(uid, 10 + i) * 9);
      const y0 = -14 - stateRand(uid, 20 + i) * 8;
      const x1 = s * (18 + stateRand(uid, 30 + i) * 10);
      const y1 = -42 - stateRand(uid, 40 + i) * 24;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.bezierCurveTo(
        x0 - s * (11 + stateRand(uid, 50 + i) * 8),
        y0 - 17,
        x1 + s * (9 + stateRand(uid, 60 + i) * 8),
        y1 + 18,
        x1,
        y1,
      );
      ctx.stroke();
      const leaves = 2 + Math.floor(stateRand(uid, 70 + i) * 3);
      for (let j = 0; j < leaves; j++) {
        const t = (j + 1) / (leaves + 1);
        const lx = x0 + (x1 - x0) * t + (stateRand(uid, 80 + i * 7 + j) - 0.5) * 7;
        const ly = y0 + (y1 - y0) * t;
        const dir = (j % 2 === 0 ? 1 : -1) * s;
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(dir * (0.35 + stateRand(uid, 100 + i * 7 + j) * 0.65));
        ctx.fillStyle = j % 2 === 0 ? "#76cf55" : "#b7ea6b";
        ctx.beginPath();
        ctx.ellipse(dir * 4.5, 0, 6 + stateRand(uid, 120 + j) * 3, 3.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
  }

  if (frozen) {
    ctx.save();
    const points = 10 + Math.floor(stateRand(uid, 200) * 4);
    ctx.beginPath();
    for (let i = 0; i < points; i++) {
      const a = (i / points) * Math.PI * 2 - Math.PI / 2;
      const rx = 34 + (stateRand(uid, 210 + i) - 0.5) * 9;
      const ry = 43 + (stateRand(uid, 230 + i) - 0.5) * 11;
      const x = Math.cos(a) * rx;
      const y = -38 + Math.sin(a) * ry;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    const ice = ctx.createLinearGradient(-35, -90, 38, 10);
    ice.addColorStop(0, "rgba(242,253,255,.48)");
    ice.addColorStop(.48, "rgba(126,218,250,.26)");
    ice.addColorStop(1, "rgba(44,139,220,.34)");
    ctx.fillStyle = ice;
    ctx.fill();
    ctx.strokeStyle = "rgba(220,250,255,.82)";
    ctx.lineWidth = 2.2;
    ctx.shadowColor = "rgba(88,205,255,.7)";
    ctx.shadowBlur = 6;
    ctx.stroke();
    const cracks = 2 + Math.floor(stateRand(uid, 260) * 3);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,.66)";
    ctx.lineWidth = 1.4;
    for (let i = 0; i < cracks; i++) {
      const sx = (stateRand(uid, 270 + i) - 0.5) * 42;
      const sy = -70 + stateRand(uid, 280 + i) * 38;
      const dir = stateRand(uid, 290 + i) < .5 ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + dir * (7 + stateRand(uid, 300 + i) * 8), sy + 13);
      ctx.lineTo(sx + dir * (2 + stateRand(uid, 310 + i) * 9), sy + 27);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ---- 前景打工桌（碰撞体） ----------------------------------------------------

/** 桌面板厚度（碰撞 AABB 高 = 同值）。 */
const DESK_SLAB_H = 16;
/** 桌面上方的道具绘制区高（显示器/桌旗画在这段里，不参与碰撞）。 */
const DESK_ITEM_H = 84;
/** 六张桌的元素次序（左→右）。 */
const DESK_ELEMENTS = ["fire", "water", "grass", "electric", "ice", "normal"] as const;

/** 逐元素桌宽比例(设计稿 7a 的异形桌:草/冰 130、电 110、水 96、火/般 80;
 *  归一化到均值≈1,乘上名义桌宽 → 六张桌宽度各不相同,读起来更像真实工位群)。 */
const DESK_WIDTH_RATIO: Record<string, number> = {
  fire: 0.77,
  water: 0.92,
  grass: 1.25,
  electric: 1.05,
  ice: 1.25,
  normal: 0.77,
};
const deskWidthFor = (element: string, nominal: number): number =>
  Math.max(48, Math.round(nominal * (DESK_WIDTH_RATIO[element] ?? 1)));

type Desk = {
  element: string;
  x: number; // 桌面板左缘（场景坐标）
  w: number;
  top: number; // 桌面板上表面 y
  level: 0 | 1; // 0=下层 1=上层
};

/** 前景碰撞体（目前 = 六张桌的桌面板）。宠物落体/反弹对它做圆-AABB 碰撞。
 *  element = 桌面的属性：宠物属性对上 → 直接粘在桌上；不合 → 从桌面弹飞。 */
type Obstacle = { x: number; y: number; w: number; h: number; element?: string };

/** 按实际屏宽排布六张属性桌：低/高两层交错、桌间留空隙，保证六张全在屏内
 *  （屏太窄时压缩桌宽保排布）。上层桌面钳在 SETTLE_MIN_Y 之下，堆叠仍受航线保护。
 *  order 缺省 = 演示模式固定次序；rogue 模式注入每局洗牌的 deskOrder。 */
function layoutDesks(w: number, h: number, order: readonly string[] = DESK_ELEMENTS, widen = 1): Desk[] {
  const groundY = h - FLOOR_H;
  // 超宽屏只把有效桌面/碰撞集中在居中的 16:9 游戏区；两侧继续由背景与装饰层填充。
  const playW = Math.min(w, h * (16 / 9));
  const playX = (w - playW) / 2;
  const EDGE = 26;
  const MIN_GAP = 24;
  // 名义桌宽(逐元素比例的基准);若六张异形桌 + 最小间距放不下则整体等比压缩。
  let nom = clamp(Math.round(playW * 0.108), 116, 188);
  const widthsOf = (n: number) => order.map((el) => deskWidthFor(el, n));
  let widths = widthsOf(nom);
  let sumW = widths.reduce((a, b) => a + b, 0);
  if (EDGE * 2 + sumW + MIN_GAP * 5 > playW) {
    const avail = Math.max(6 * 48, playW - EDGE * 2 - MIN_GAP * 5);
    nom = Math.max(40, Math.floor(nom * (avail / sumW)));
    widths = widthsOf(nom);
    sumW = widths.reduce((a, b) => a + b, 0);
  }
  const gap = Math.max(6, (playW - EDGE * 2 - sumW) / 5);
  // 基准中心(未加宽):逐桌宽度左→右累加,间距均分。
  const centers: number[] = [];
  let cx = playX + EDGE;
  for (let i = 0; i < order.length; i++) {
    centers.push(cx + widths[i] / 2);
    cx += widths[i] + gap;
  }
  // 教学加宽(rogue 首班):保持每桌中心不动,桌面向两侧吃掉部分空隙——中心不变
  // 意味着回正时既有堆的桌面支撑面只收边,塌方面积最小。
  return order.map((element, i) => {
    const level = (i % 2) as 0 | 1;
    const top = Math.max(groundY - (level === 1 ? 204 : 96), SETTLE_MIN_Y + 24);
    const wWide =
      widen > 1
        ? Math.min(Math.round(widths[i] * widen), widths[i] + Math.max(0, Math.floor(gap) - 8))
        : widths[i];
    return { element, x: Math.max(playX + 8, Math.round(centers[i] - wWide / 2)), w: wWide, top, level };
  });
}

const deskObstacle = (d: Desk): Obstacle => ({ x: d.x + 2, y: d.top, w: d.w - 4, h: DESK_SLAB_H, element: d.element });

// ---- 前景障碍物（文件山/饮水机/盆栽/打印机：有实体、会挡宠物） ----------------
// 渲染(ForegroundDecor)与物理(obstaclesRef)共用同一份落位,保证「画到哪就挡到哪」。
// 每种道具的 svg 盒 120×160、底线在 localY=152;下面给出各自的实心 footprint
// (localX 偏移 / 宽 / 上沿 y),换算成场景坐标的碰撞 AABB。
const DECOR_BASE_Y = 152; // svg 盒(120×160)内的底线
const DECOR_FOOT: Array<{ dx: number; dw: number; topY: number }> = [
  { dx: 8, dw: 104, topY: 100 }, // 0 文件山（下两摞纸）
  { dx: 24, dw: 72, topY: 54 }, // 1 饮水机（整机身+水桶，较高）
  { dx: 26, dw: 66, topY: 90 }, // 2 盆栽（陶盆，绿叶不挡）
  { dx: 8, dw: 104, topY: 82 }, // 3 打印机（机身+托纸口）
];

/** 桌间空档里的装饰障碍落位（纯函数，散列决定横位与种类；渲染/物理同源）。
 *  spot 带上所在空档边界 [g0,g1]:碰撞盒据此钳进空档,绝不越界压到桌面碰撞。 */
type DecorSpot = { x: number; kind: number; g0: number; g1: number };
const DECOR_GAP_MIN = 74; // 空档窄于此不摆道具(免得道具骑到桌上)
function computeDecorSpots(desks: Desk[], width: number): DecorSpot[] {
  const spots: DecorSpot[] = [];
  const sorted = [...desks].sort((a, b) => a.x - b.x);
  const gaps: Array<[number, number]> = [];
  let prev = 10;
  for (const d of sorted) {
    gaps.push([prev, d.x]);
    prev = d.x + d.w;
  }
  gaps.push([prev, width - 10]);
  gaps.forEach(([g0, g1], i) => {
    if (g1 - g0 < DECOR_GAP_MIN) return;
    const hash = (i * 3266489917 + 77) >>> 0;
    if (hash % 4 === 0) return; // 留些空档，别摆满
    // svg 盒 120 宽:居中放进空档,横位再按散列在剩余余量里抖一下。
    const slack = Math.max(0, g1 - g0 - 120);
    const x = g0 + (g1 - g0 - 120) / 2 + (slack > 0 ? (hash % slack) - slack / 2 : 0);
    // 种类按落位次序轮转（散列只管横位），保证四种障碍物都能出现。
    spots.push({ x: Math.round(x), kind: spots.length % 4, g0, g1 });
  });
  return spots;
}

const decorObstacle = (spot: DecorSpot, groundY: number): Obstacle => {
  const f = DECOR_FOOT[spot.kind] ?? DECOR_FOOT[0];
  // svg 底线(localY=DECOR_BASE_Y)贴地 → 盒原点在 groundY-DECOR_BASE_Y;与渲染 top 同源。
  // 碰撞盒钳进所在空档 [g0,g1]:窄档里道具视觉可略溢到桌沿,但碰撞永不压桌。
  const x0 = Math.max(spot.g0 + 2, spot.x + f.dx);
  const x1 = Math.min(spot.g1 - 2, spot.x + f.dx + f.dw);
  return { x: x0, y: groundY - DECOR_BASE_Y + f.topY, w: Math.max(8, x1 - x0), h: DECOR_BASE_Y - f.topY };
};

/** 六张桌面板 + 前景装饰障碍 = 全部碰撞体（宠物落体对它们做圆-AABB 碰撞）。 */
function buildObstacles(desks: Desk[], width: number, groundY: number): Obstacle[] {
  const list = desks.map(deskObstacle);
  for (const s of computeDecorSpots(desks, width)) list.push(decorObstacle(s, groundY));
  return list;
}

// ---- 物理体 ----------------------------------------------------------------

type Body = {
  uid: number;
  species: string;
  /** 物种属性集（元素）：与落点宠物有交集 → Q 弹粘住；无交集 → 弹走。 */
  elements: string[];
  r: number;
  x: number; // 圆心（脚底 = y + r）
  y: number;
  vx: number;
  vy: number;
  bornAt: number;
  squashUntil: number; // 撞击压扁演出的截止时刻
  settled: boolean;
  /** 靠属性相合粘上去的（非落地面）；用于调试/校验。 */
  stuck: boolean;
  // ---- 画布批量绘制侧（落定后由主循环维护） ----
  settledAt: number;
  /** 仍以 DOM 活体渲染（落定后的宽限期）；false = 已交给打工山画布。 */
  inDom: boolean;
  /** 打工循环相位（ms，按 uid 错开，免得全山同步挥臂）。 */
  animPhase: number;
  targetSqX: number;
  targetSqY: number;
  curSqX: number;
  curSqY: number;
  buried: boolean;
  /** 异属性砸中时的嫌弃晃动起点（画布侧 0.32s 旋转 tween）。 */
  wobbleAt: number;
  /** 冻结开始时刻；角色姿态从此定格，只与冰块整体上下浮动。 */
  frozenAt?: number;
  frozenFrame?: number;
  // ---- rogue 桥附加标记（demo 模式全部闲置） ----
  /** 因罢工/解雇/搬桌塌方而重新落体中（泥石流重粘判定读它）；再次落定时清。 */
  fromCollapse?: boolean;
  /** 空中吃过至少一次属性不合弹开：解除墙壁钳制，允许滚出场外（rolloff）。 */
  bounced?: boolean;
  /** 已向 rogue 桥报过 onSettled/onBounced（每 uid 只报一次；塌方重粘不重报）。 */
  rogueReported?: boolean;
  /** 加班时间自动抛物线：存在时绕过普通碰撞，按时准确落到逻辑层选出的最高分点。 */
  overtimeJump?: {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    startedAt: number;
    landsAt: number;
  };
  /** 加班临时角色：得分后不留在塔上，而是转为跑路者返回雇佣池。 */
  overtimeWorker?: boolean;
  /** 得分演出已触发，达到该时刻后从物理堆转为跑路动画。 */
  overtimeEscapeAt?: number;
  /** 期待光淡入淡出包络（0..1，每帧向目标缓动）：载宠切换时不再硬切/忽然消失。 */
  glowAmt?: number;
  /** Canvas keeps the old atlas until the water-morph animation crosses its midpoint. */
  visualSwap?: {
    fromSpecies: string;
    switchAt: number;
  };
  /** 状态效果形成的连接快照；成员、物种或位置变化后不再豁免罢工。 */
  strikeProtection?: {
    species: string;
    members: number[];
    positions: Array<{ uid: number; x: number; y: number }>;
  };
  /** 生长体首次落定时，为它所在的连接结构建立豁免快照。 */
  protectStrikeOnSettle?: boolean;
};

function sameSpeciesComponent(seed: Body, bodies: Iterable<Body>): Body[] {
  const candidates = Array.from(bodies).filter((body) => body.settled && body.species === seed.species);
  const component: Body[] = [];
  const queued = [seed];
  const seen = new Set<number>();
  while (queued.length > 0) {
    const body = queued.pop()!;
    if (seen.has(body.uid)) continue;
    seen.add(body.uid);
    component.push(body);
    for (const candidate of candidates) {
      if (seen.has(candidate.uid)) continue;
      const rr = (body.r + candidate.r) * CONTACT_SLACK;
      const dx = body.x - candidate.x;
      const dy = body.y - candidate.y;
      if (dx * dx + dy * dy <= rr * rr) queued.push(candidate);
    }
  }
  return component;
}

function protectStrikeComponent(members: Body[]): void {
  if (members.length === 0) return;
  const protection = {
    species: members[0].species,
    members: members.map((member) => member.uid).sort((a, b) => a - b),
    positions: members.map((member) => ({ uid: member.uid, x: member.x, y: member.y })),
  };
  members.forEach((member) => {
    member.strikeProtection = protection;
    member.protectStrikeOnSettle = false;
  });
}

type SpawnedPet = { uid: number; species: string; landed: boolean };
type CarriedPet = { uid: number; species: string };

// ---- 罢工/解雇跑路者（已脱离物理堆，只做水平冲刺 + 掉落到下一层表面） ----

type RunnerPhase = "strike" | "run";

type Runner = {
  uid: number;
  species: string;
  x: number;
  y: number; // 与 Body 同语义：圆心，脚底 = y + r
  r: number;
  vy: number;
  dir: 1 | -1;
  phase: RunnerPhase;
  /** strike 相位的截止时刻（到点转 run）。 */
  until: number;
  /** 离场原因（rogue 桥 onGone 用；demo 不消费）。desert = 落地即溜走（等同罢工，
   *  出屏时按 rolloff 记账:回收名额 + 本班缺席）。 */
  reason: "strike" | "dismiss" | "desert" | "overtime";
};

/** React 侧的跑路者渲染项（位置走 rAF 直写，state 只管挂载与相位类切换）。
 *  sign：rogue 模式下每只随机抽的罢工牌梗文案；demo 走 T.fa.strikeSign。 */
type RunnerUi = { uid: number; species: string; phase: RunnerPhase; dir: 1 | -1; sign?: string };
type AssimilationFx = {
  id: number;
  uid: number;
  x: number;
  y: number;
  r: number;
  fromSpecies: string;
  toSpecies: string;
};

// ---- 打工立绘烘焙 + 画布图集（批量渲染的核心） ------------------------------
// 每物种把 laboring 打工循环采样成 FRAME_COUNT 帧静态立绘（姿态取 sprites.css
// rig-work-* keyframes 的分段线性插值），栅格化进离屏画布图集，同物种全部实例
// 共享一套；打工山整体画在一个 <canvas> 上，每帧只是 N 次 drawImage（GPU 贴图
// 四边形）——帧数多少几乎不影响成本，纹理内存只按物种数走。
// <img>/Image 加载 data:svg 时不应用页面 CSS，故把需要的样式注入进 svg 内联：
// 工具在打工态可见、元素粒子层隐藏（静止粒子像悬空碎屑）、部件摆到该帧姿态。
// 部件的 transform-box/transform-origin 是 Part 组件的内联样式（随 markup 带出），
// 注入样式只覆写 transform 即可绕正确轴心旋转。xmlns/显式像素尺寸补丁与
// speciesPreview.ts 同源（缺 xmlns 静默 onerror、缺尺寸按 300×150 默认栅格化）。

// 拥挤模式最多只以 20fps 绘制；6 张均匀采样帧足以保持打工循环流畅，同时把
// 每物种常驻的工作图集显存/内存比原来的 10 帧降低 40%。
const FRAME_COUNT = 6;
const WORK_CYCLE_MS = 550; // 与 sprites.css rig-work-* 同拍
const SLEEP_CYCLE_MS = 3400; // 与 sprites.css rig-sleep-breathe 同拍
const PATH_SLEEP_AUDIT_MS = 400;
/** 画布角色只有 6 张离散帧；30fps 已能覆盖翻页，也保留压扁/光晕缓动。 */
const PILE_BASE_FRAME_MS = 1000 / 30;
/** 角色山很密时只降画布动画采样率，物理与满屏数字仍保持逐帧更新。 */
const PILE_BUSY_COUNT = 48;
const PILE_CROWDED_COUNT = 96;
const PILE_BUSY_FRAME_MS = 1000 / 24;
const PILE_CROWDED_FRAME_MS = 1000 / 20;
/** 单次结算最多让多少只高亮角色播放完整骨骼/粒子动画。 */
const SPOTLIGHT_ANIMATED_HERO_MAX = 8;
const FROZEN_BOB_CYCLE_MS = 2800;
const FROZEN_BOB_PX = 4;

function frozenBobAt(now: number): number {
  return -Math.sin((now / FROZEN_BOB_CYCLE_MS) * Math.PI * 2) * FROZEN_BOB_PX;
}

const BAKE_STYLE = ".part-tool{opacity:1}.sprite-fx{display:none}";

/** 打工循环各部件的关键帧轨道（时间 0..1 → 值），与 sprites.css 逐字对齐：
 *  rig-work-arm / rig-brace / rig-work-rock / rig-tail-flick / rig-face-nod /
 *  rig-tool-bob / rig-headtop-bob。烘帧时分段线性采样。 */
const WORK_TRACKS = {
  armR: [
    [0, 0],
    [0.4, -28],
    [0.7, 10],
    [1, 0],
  ],
  armL: [
    [0, 4],
    [0.4, -8],
    [1, 4],
  ],
  bodyRot: [
    [0, 0],
    [0.4, -3],
    [0.7, 2],
    [1, 0],
  ],
  bodyTy: [
    [0, 0],
    [0.4, 2],
    [0.7, -2],
    [1, 0],
  ],
  tail: [
    [0, -3],
    [0.45, 12],
    [1, -3],
  ],
  faceRot: [
    [0, 0],
    [0.4, 2.5],
    [1, 0],
  ],
  faceTy: [
    [0, 0],
    [0.4, 1.5],
    [1, 0],
  ],
  toolRot: [
    [0, 0],
    [0.4, -6],
    [0.7, 4],
    [1, 0],
  ],
  toolTy: [
    [0, 0],
    [0.4, 2],
    [0.7, -2],
    [1, 0],
  ],
  headtop: [
    [0, 0],
    [0.5, -6],
    [1, 0],
  ],
} as const satisfies Record<string, ReadonlyArray<readonly [number, number]>>;

function trackAt(track: ReadonlyArray<readonly [number, number]>, t: number): number {
  for (let i = 1; i < track.length; i++) {
    const [t0, v0] = track[i - 1];
    const [t1, v1] = track[i];
    if (t <= t1) return v0 + ((v1 - v0) * (t - t0)) / Math.max(1e-6, t1 - t0);
  }
  return track[track.length - 1][1];
}

const fx = (v: number) => Math.round(v * 100) / 100;

/** t∈[0,1) 时刻的打工姿态样式（注入进烘焙 svg）。 */
function workPoseStyle(t: number): string {
  return [
    `.part-armR{transform:rotate(${fx(trackAt(WORK_TRACKS.armR, t))}deg)}`,
    `.part-armL{transform:rotate(${fx(trackAt(WORK_TRACKS.armL, t))}deg)}`,
    `.part-body{transform:rotate(${fx(trackAt(WORK_TRACKS.bodyRot, t))}deg) translateY(${fx(trackAt(WORK_TRACKS.bodyTy, t))}px)}`,
    `.part-tail{transform:rotate(${fx(trackAt(WORK_TRACKS.tail, t))}deg)}`,
    `.part-face{transform:rotate(${fx(trackAt(WORK_TRACKS.faceRot, t))}deg) translateY(${fx(trackAt(WORK_TRACKS.faceTy, t))}px)}`,
    `.part-tool{transform:rotate(${fx(trackAt(WORK_TRACKS.toolRot, t))}deg) translateY(${fx(trackAt(WORK_TRACKS.toolTy, t))}px)}`,
    `.part-headtop{transform:rotate(${fx(trackAt(WORK_TRACKS.headtop, t))}deg)}`,
  ].join("");
}

function bakeSpriteMarkup(
  species: string,
  config: GameConfig,
  petState: PetState,
  sizePx: number,
): string {
  const markup = renderToStaticMarkup(createElement(SvgSprite, { species, config, petState }));
  const nsAttr = markup.includes("xmlns=") ? "" : 'xmlns="http://www.w3.org/2000/svg" ';
  return markup.replace("<svg ", `<svg ${nsAttr}width="${sizePx}" height="${sizePx}" `);
}

function bakeSpriteUrl(markup: string, poseCss: string): string {
  const openEnd = markup.indexOf(">");
  const styleTag = `<style>${BAKE_STYLE}${poseCss}</style>`;
  const patched = markup.slice(0, openEnd + 1) + styleTag + markup.slice(openEnd + 1);
  // data: URL 会让每一帧完整 SVG 字符串进入 WebView 图片缓存；大量自定义物种时
  // 这部分会和栅格画布同时常驻。Blob URL 在 onload 后即可撤销，只留下最终帧。
  return URL.createObjectURL(new Blob([patched], { type: "image/svg+xml" }));
}

/** 「期待」立绘：success 骨架（星星眼 + 笑）+ 双臂高举招呼 + **放下工具**
 *  （盖掉 BAKE_STYLE 的 .part-tool{opacity:1}）——载宠悬停时，山上能粘合的
 *  伙伴用它整个替换打工帧：不是加特效框，而是本体换了个期待的样子。 */
const EXPECT_POSE =
  // The two arms are mirrored geometry, so their greeting rotations must also
  // be mirrored. Rotating both by -52deg sends the yeti's long right arm out
  // through the baked SVG viewport, which cuts the hand off in the attraction
  // preview. Folding both arms inward keeps the pose symmetric and intact.
  ".part-armR{transform:rotate(52deg)}.part-armL{transform:rotate(-52deg)}" +
  ".part-tool{opacity:0}.part-tail{transform:rotate(14deg)}.part-headtop{transform:rotate(-7deg)}";

/** 期待光晕的外扩边距（CSS px）：光晕烘进离屏帧（贴精灵剪影的金色辉光），
 *  运行时零模糊成本，只按 alpha 脉动。 */
const GLOW_PAD = 18;

/** 把预烘的期待光晕（灰金 alpha 形状）染成元素色:'source-in' 保形状换色。
 *  结果缓存(见 glowTintRef),每个 (物种×元素) 只染一次。 */
function tintGlow(src: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = src.width;
  out.height = src.height;
  const g = out.getContext("2d");
  if (g == null) return src;
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = color;
  g.fillRect(0, 0, out.width, out.height);
  return out;
}

/** 物种图集：FRAME_COUNT 张打工帧 + 期待帧（本体/预烘光晕），全为离屏画布
 *  （按 dpr 栅格化）；ready 前落定宠留在 DOM。info 记录烘焙时的 SpeciesInfo
 *  引用（过期检测）；baking 防并发重烘。 */
type PileAtlas = {
  frames: HTMLCanvasElement[];
  sleepFrame?: HTMLCanvasElement;
  expectBase?: HTMLCanvasElement;
  expectGlow?: HTMLCanvasElement;
  ready: boolean;
  info: unknown;
  baking: boolean;
};

// ---- 单只宠物节点（memo：只有 landed 翻转时重渲染） -------------------------

const FactoryPetNode = memo(function FactoryPetNode({
  uid,
  species,
  landed,
  frozen,
  pathSleeping,
  overtimeJumping,
  config,
  registerOuter,
  registerInner,
}: {
  uid: number;
  species: string;
  landed: boolean;
  frozen: boolean;
  pathSleeping: boolean;
  overtimeJumping: boolean;
  config: GameConfig;
  registerOuter: (uid: number, el: HTMLDivElement | null) => void;
  registerInner: (uid: number, el: HTMLDivElement | null) => void;
}) {
  // 落定一瞬：先播 drop（一次性落地压扁骨骼动画）；SWAP_GRACE_MS 后由主循环把
  // 本节点整个卸载，交给打工山画布批量绘制（drop→laboring 只在活体期可见）。
  const [afterLand, setAfterLand] = useState<PetState>("drop");
  useEffect(() => {
    if (!landed) {
      setAfterLand("drop"); // 坍塌重新落体后，下次落地重演 drop
      return;
    }
    const timer = window.setTimeout(() => setAfterLand("laboring"), 640);
    return () => window.clearTimeout(timer);
  }, [landed]);
  const petState: PetState = pathSleeping ? "sleeping" : frozen ? "laboring" : landed ? afterLand : "dragging";
  return (
    <div
      className={`fac-pet${overtimeJumping ? " is-overtime-jumping" : ""}`}
      ref={(el) => registerOuter(uid, el)}
      style={{ width: PET_SIZE, height: PET_SIZE }}
    >
      <div
        className={`fac-pet-inner${frozen ? " fac-frozen" : ""}${pathSleeping ? " fac-path-sleeping" : ""}`}
        ref={(el) => registerInner(uid, el)}
      >
        <SvgSprite species={species} config={config} petState={petState} className="fac-pet-sprite" />
      </div>
    </div>
  );
});

// ---- 场景 ------------------------------------------------------------------

export function FactoryScene({
  save,
  config,
  onBack,
  rogue,
  paused = false,
  hud,
  spotlight,
  connectionFailure,
  coachTarget,
}: {
  save: GameSave;
  config: GameConfig;
  onBack: () => void;
  /** 《危楼打工记》场景桥：存在即 rogue 模式（载宠/闸门/事件/桌序全由逻辑层驱动）；
   *  缺省 = 现行演示,行为零变化。 */
  rogue?: RogueSceneBridge;
  /** 弹层阶段冻结背后的场景。物理状态保留，恢复后从新的 rAF 时基继续。 */
  paused?: boolean;
  /** N1 结算聚光信号（token 变即触发一次 ~2s 高亮）：高亮 uids + 结算桌 deskEls 保持
   *  彩色，其余宠灰显定格、其余桌灰显后缓慢恢复。缺省/demo 不传 → 无聚光。 */
  spotlight?: { uids: number[]; deskEls: string[]; token: number; durationMs?: number } | null;
  /** 投掷落定后未连通任何桌子的失败演出。 */
  connectionFailure?: {
    uid: number;
    species?: string;
    x?: number;
    y?: number;
    r?: number;
    token: number;
    text: string;
  } | null;
  /** 首次真实局强引导使用；锚到会随运输机移动的真实投放目标。 */
  coachTarget?: string;
  /** 双立柱 HUD 的显示数据（设计定稿 6a）。**纯展示，场景不生产也不消费它**。
   *  接线前留空：缺省 = 不渲染立柱，行为与现在完全一致；rogue 模式下由
   *  RogueHud 全权接管，这里也一律不渲染（两套 HUD 不叠）。
   *  想看版式：`?fachud=1` 灌一份占位数据。 */
  hud?: FactoryHudData;
}) {
  const { lang, T } = useT();
  const rootRef = useRef<HTMLDivElement | null>(null);

  // 双立柱 HUD 的数据源：接线后走 hud prop；`?fachud=1` 灌占位数据只为看版式。
  const hudData = useMemo<FactoryHudData | null>(
    () =>
      hud ??
      (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("fachud")
        ? demoHudData(config)
        : null),
    [hud, config],
  );

  // rogue 桥经 ref 供 rAF/回调读取（桥对象在搬桌后会换新引用,ref 恒指最新）。
  const rogueRef = useRef<RogueSceneBridge | undefined>(rogue);
  rogueRef.current = rogue;
  const langRef = useRef(lang);
  langRef.current = lang;

  const [pets, setPets] = useState<SpawnedPet[]>([]);
  const [carried, setCarried] = useState<CarriedPet | null>(null);
  const [hintGone, setHintGone] = useState(false);
  const [fullMsg, setFullMsg] = useState(0);
  // 打工山总数（含已转画布的）：计数牌用；容量判定走 bodiesRef.size。
  const [pileCount, setPileCount] = useState(0);
  // 场景尺寸（state）：办公室布景/打工桌按实际尺寸排布；ref 版供 rAF 物理读取。
  const [sceneSize, setSceneSize] = useState({ w: 760, h: 560 });
  // 六张属性打工桌（随场景尺寸重排；碰撞 AABB 同步进 obstaclesRef）。
  // rogue 模式的初始桌序来自桥（后续变更由下方 deskOrder effect 接管）。
  const [desks, setDesks] = useState<Desk[]>(() =>
    layoutDesks(760, 560, rogue?.deskOrder ?? DESK_ELEMENTS, rogue?.deskWiden?.() ?? 1),
  );
  // 罢工/解雇跑路者（挂载与相位类切换；位置 rAF 直写）。
  const [runners, setRunners] = useState<RunnerUi[]>([]);

  const bodiesRef = useRef<Map<number, Body>>(new Map());
  const pendingStrikeProtectionRef = useRef<Set<number>>(new Set());
  const [sleepingPathUids, setSleepingPathUids] = useState<Set<number>>(new Set());
  const sleepingPathUidsRef = useRef<Set<number>>(sleepingPathUids);
  const outerRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const innerRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const planeElRef = useRef<HTMLDivElement | null>(null);
  const hangElRef = useRef<HTMLDivElement | null>(null);
  const dropGuideElRef = useRef<HTMLDivElement | null>(null);
  const pileCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // x 首帧被巡航区间夹取；speed 每帧按「固定横穿时长」由巡航区宽反算。
  const planeRef = useRef({ x: 200, dir: 1 as 1 | -1, reloadAt: 0, speed: 200 });
  const uidRef = useRef(1);
  const carriedRef = useRef<CarriedPet | null>(null);
  const overtimeNextAtRef = useRef(0);
  // rogue 载宠陈旧校对的下次检查时刻(rAF 内低频轮询,防跨班旧袋头软锁)。
  const carryAuditAtRef = useRef(0);
  // N1 结算聚光:高亮 uid 集 + 结算桌集 + 截止时刻(画布灰显读它);桌子高亮走 state。
  const spotlightRef = useRef<{ uids: Set<number>; deskEls: Set<string>; until: number } | null>(null);
  const [deskSpot, setDeskSpot] = useState<Set<string> | null>(null);
  // 聚光黑幕开关 + 黑幕上的彩色主角宠 + 波次（仅前八只随波次重挂并播放打工粒子）。
  const [spotActive, setSpotActive] = useState(false);
  const [sceneDimActive, setSceneDimActive] = useState(false);
  // 压暗结束的那一帧禁用各绘制层原有的 0.5~0.6s filter 过渡，确保视觉时长严格等于配置值。
  const [sceneDimRestoring, setSceneDimRestoring] = useState(false);
  const [heroPets, setHeroPets] = useState<{
    uid: number;
    species: string;
    x: number;
    y: number;
    r: number;
    scale: number;
    animated: boolean;
  }[]>([]);
  const [heroWave, setHeroWave] = useState(0);
  const [failedPet, setFailedPet] = useState<{ uid: number; species: string; x: number; y: number; r: number; text: string } | null>(null);
  const [assimilationFx, setAssimilationFx] = useState<AssimilationFx[]>([]);
  const assimilationFxIdRef = useRef(1);
  const sceneRef = useRef({ w: 760, h: 560 });
  // 当前生效的桌序（措辞与 layoutDesks 的 order 参数一致；demo 恒 DESK_ELEMENTS）。
  const deskOrderRef = useRef<readonly string[]>(rogue?.deskOrder ?? DESK_ELEMENTS);
  // 桌宽倍率（rogue 首班教学加宽；demo 恒 1）。渲染期同步，重排管线读取。
  const deskWidenRef = useRef(rogue?.deskWiden?.() ?? 1);
  deskWidenRef.current = rogue?.deskWiden?.() ?? 1;
  // N1 结算聚光触发:token 变 → 开一次 3s 窗口:全场压黑、非高亮宠灰显定格、结算桌高亮/
  // 其余灰显后缓复;得分宠、被吸取宠与本次效果涉及的宠在黑幕上以活体精灵重演打工,
  // 并分三波刷打工粒子。
  const spotlightToken = spotlight?.token;
  useEffect(() => {
    if (rogue == null || spotlight == null) return;
    const duration = spotlight.durationMs ?? SPOTLIGHT_MS;
    spotlightRef.current = {
      uids: new Set(spotlight.uids),
      deskEls: new Set(spotlight.deskEls),
      until: performance.now() + duration,
    };
    setDeskSpot(new Set(spotlight.deskEls));
    // 主角宠:从物理堆取当前位置(落定不动,3s 内静态即可),黑幕上重演活体打工。
    const heroes: {
      uid: number;
      species: string;
      x: number;
      y: number;
      r: number;
      scale: number;
      animated: boolean;
    }[] = [];
    // 本次结算里有触发效果的咕噜都必须保持正常亮度，不能因数量截断而落回压暗画布。
    for (const uid of spotlight.uids) {
      const b = bodiesRef.current.get(uid);
      if (b != null) {
        heroes.push({
          uid,
          species: b.species,
          x: b.x,
          y: b.y,
          r: b.r,
          scale: rogue.bodyScale?.(uid) ?? 1,
          animated: heroes.length < SPOTLIGHT_ANIMATED_HERO_MAX,
        });
      }
    }
    setSpotActive(true);
    setSceneDimActive(true);
    setSceneDimRestoring(false);
    setHeroPets(heroes);
    setHeroWave(0);
    // 三波打工粒子：每次换 key 只重挂前八只动态主角；其余主角维持彩色静态帧。
    const w1 = window.setTimeout(() => setHeroWave(1), duration / 3);
    const w2 = window.setTimeout(() => setHeroWave(2), (duration * 2) / 3);
    const dimDone = window.setTimeout(() => {
      spotlightRef.current = null;
      setDeskSpot(null);
      setSceneDimRestoring(true);
      setSceneDimActive(false);
      // 保留两个绘制帧，让“无过渡的全彩样式”确实提交后再恢复常规 hover/配桌过渡。
      requestAnimationFrame(() => requestAnimationFrame(() => setSceneDimRestoring(false)));
    }, duration);
    const done = window.setTimeout(() => {
      setSpotActive(false);
      setHeroPets([]);
    }, duration);
    return () => {
      window.clearTimeout(w1);
      window.clearTimeout(w2);
      window.clearTimeout(dimDone);
      window.clearTimeout(done);
    };
    // token 变即重触发；spotlight/rogue 引用变化不单独触发。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotlightToken]);
  const connectionFailureToken = connectionFailure?.token;
  useEffect(() => {
    if (rogue == null || connectionFailure == null) return;
    const b = bodiesRef.current.get(connectionFailure.uid);
    if (
      b == null
      && (
        connectionFailure.species == null
        || connectionFailure.x == null
        || connectionFailure.y == null
        || connectionFailure.r == null
      )
    ) return;
    setFailedPet({
      uid: b?.uid ?? connectionFailure.uid,
      species: b?.species ?? connectionFailure.species!,
      x: b?.x ?? connectionFailure.x!,
      y: b?.y ?? connectionFailure.y!,
      r: b?.r ?? connectionFailure.r!,
      text: connectionFailure.text,
    });
    const done = window.setTimeout(() => setFailedPet(null), 1800);
    return () => window.clearTimeout(done);
    // token 变化代表一次新的失败演出。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionFailureToken]);
  const obstaclesRef = useRef<Obstacle[]>(
    buildObstacles(
      layoutDesks(760, 560, deskOrderRef.current, deskWidenRef.current),
      760,
      560 - FLOOR_H,
    ),
  );
  // 桌面几何快照（rogue 桥 registerSnapshots 的 desks 数据源；与 setDesks 同步维护）。
  const desksSnapRef = useRef<Desk[]>(layoutDesks(760, 560, deskOrderRef.current, deskWidenRef.current));
  const runnersRef = useRef<Map<number, Runner>>(new Map());
  const runnerElRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  // 尺寸变化重排桌子后要重算支撑（桌挪走了上面的宠得塌下来）；函数在下方定义，
  // 经 ref 转发给 measure 免得回调依赖打环。
  const collapseFnRef = useRef<() => void>(() => {});

  // 在养宠快照（随机抽取用；场景打开期间孵化/放生会实时反映）。
  const ownedRef = useRef(save.pets);
  ownedRef.current = save.pets;

  /** 桌重排管线（尺寸变化 / rogue 搬桌共用）：按当前桌序重排桌子 + 重建碰撞体
   *  + 重算支撑（桌挪位后失去托底的宠塌下来）。 */
  const applyDeskLayout = useCallback((w: number, h: number) => {
    const next = layoutDesks(w, h, deskOrderRef.current, deskWidenRef.current);
    setDesks(next);
    desksSnapRef.current = next;
    obstaclesRef.current = buildObstacles(next, w, h - FLOOR_H);
    collapseFnRef.current();
  }, []);

  // 场景实测尺寸（真机 = 全工作区停靠；浏览器预览可能不同）。尺寸变化时同步
  // 重排六张属性桌 + 碰撞体，并重算支撑（桌子挪位后失去托底的宠塌下来）。
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth || 760;
      const h = el.clientHeight || 560;
      if (w === sceneRef.current.w && h === sceneRef.current.h && obstaclesRef.current.length > 0) return;
      sceneRef.current = { w, h };
      setSceneSize({ w, h });
      applyDeskLayout(w, h);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [applyDeskLayout]);

  // rogue 桌序注入：搬桌先按逻辑层给出的切割结果平移各自塔体，再重排桌子和
  // 重建 obstacles。跨桌连通结构已经在逻辑层按最近桌根切开，不会整片拖走。
  const deskOrder = rogue?.deskOrder;
  const appliedOrderRef = useRef(deskOrderRef.current.join(","));
  useEffect(() => {
    if (deskOrder == null) return;
    const key = deskOrder.join(",");
    if (key === appliedOrderRef.current) return;
    const moves = rogueRef.current?.takeDeskMoves?.() ?? [];
    for (const move of moves) {
      const body = bodiesRef.current.get(move.uid);
      if (body == null) continue;
      body.x += move.dx;
      body.vx = 0;
      body.vy = 0;
      body.settled = true;
      body.stuck = true;
    }
    appliedOrderRef.current = key;
    deskOrderRef.current = deskOrder;
    applyDeskLayout(sceneRef.current.w, sceneRef.current.h);
  }, [deskOrder, applyDeskLayout]);

  // rogue 桌宽倍率变更（首班教学加宽 → 第 2 班回正）：同一条重排管线。
  const deskWiden = rogue?.deskWiden?.() ?? 1;
  const appliedWidenRef = useRef(deskWiden);
  useEffect(() => {
    if (appliedWidenRef.current === deskWiden) return;
    appliedWidenRef.current = deskWiden;
    applyDeskLayout(sceneRef.current.w, sceneRef.current.h);
  }, [deskWiden, applyDeskLayout]);

  // rogue 快照注册：把 bodies/desks 只读快照读取器挂回逻辑层（结算/演出定位用）。
  useEffect(() => {
    if (rogue == null) return;
    rogue.registerSnapshots({
      bodies: () =>
        Array.from(bodiesRef.current.values()).map(
          (b): BodyLike => ({
            uid: b.uid,
            species: b.species,
            elements: b.elements,
            x: b.x,
            y: b.y,
            r: b.r,
            settled: b.settled,
            fromCollapse: b.fromCollapse === true,
          }),
        ),
      desks: () =>
        desksSnapRef.current.map((d) => ({ element: d.element, x: d.x, w: d.w, top: d.top })),
    });
  }, [rogue]);

  /** 按外形求碰撞半径：物种影子半径（≈身宽）× 体型缩放 → 山的堆叠随外形变化。 */
  const collisionRadius = useCallback(
    (species: string) => {
      const visual = getSpeciesVisual(species, config.species[species]);
      const scale = visual.scale ?? 1;
      const shape = 0.55 + 0.45 * ((visual.shadowRx ?? 58) / 58);
      return clamp(PET_SIZE * 0.225 * scale * shape, 16, 46);
    },
    [config],
  );

  /** 物种属性集（与 SvgSprite 同一兜底：缺失按 normal）。 */
  const speciesElements = useCallback(
    (species: string): string[] => {
      const elements = config.species[species]?.elements;
      return elements && elements.length > 0 ? elements : ["normal"];
    },
    [config],
  );

  // 机上挂载宠的属性集：呼吸提示用（匹配的属性桌 + 山体表层可粘宠发光）。
  // ref 版供 rAF 画布绘制逐帧读取。
  const carriedElems = carried ? speciesElements(carried.species) : null;
  const carriedElemsRef = useRef<string[] | null>(null);
  useEffect(() => {
    carriedElemsRef.current = carriedElems;
  });

  // 物种图集缓存（config 变了作废重烘）。首次请求即后台烘 FRAME_COUNT 帧并
  // 栅格化成离屏画布；ready 前该物种的落定宠继续留在 DOM 活体。
  const atlasRef = useRef(new Map<string, PileAtlas>());
  // 期待光的元素色 tint 缓存（键 = `${species}:${element}`；config 变作废重烘时一并清）。
  const glowTintRef = useRef(new Map<string, HTMLCanvasElement>());
  const ensureAtlas = useCallback(
    (species: string) => {
      const cache = atlasRef.current;
      // 过期检测按「该物种的 SpeciesInfo 引用」而非 config 整体：有效配置每次
      // 存档推送都是新合并对象（≈每 5s），但未变物种的 info 引用恒等。
      const info = config.species[species];
      const existing = cache.get(species);
      if (existing != null && (existing.info === info || existing.baking)) return;
      const entry: PileAtlas = existing ?? { frames: [], ready: false, info, baking: false };
      entry.info = info;
      entry.baking = true;
      cache.set(species, entry);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const sizePx = Math.round(PET_SIZE * dpr);
      // 六张工作帧共享同一份静态 SVG 骨架，只注入不同姿态 CSS。旧实现每帧都
      // renderToStaticMarkup 一次，在物种很多时会制造大量短命字符串与 React 树。
      const workMarkup = bakeSpriteMarkup(species, config, "laboring", sizePx);
      const loads = Array.from(
        { length: FRAME_COUNT },
        (_, i) =>
          new Promise<HTMLCanvasElement>((resolve, reject) => {
            const img = new Image();
            const url = bakeSpriteUrl(workMarkup, workPoseStyle(i / FRAME_COUNT));
            img.onload = () => {
              const frame = document.createElement("canvas");
              frame.width = sizePx;
              frame.height = sizePx;
              frame.getContext("2d")?.drawImage(img, 0, 0, sizePx, sizePx);
              URL.revokeObjectURL(url);
              resolve(frame);
            };
            img.onerror = () => {
              URL.revokeObjectURL(url);
              reject(new Error(`bake ${species} frame ${i} failed`));
            };
            img.src = url;
          }),
      );
      const sleepLoad = new Promise<HTMLCanvasElement>((resolve, reject) => {
        const img = new Image();
        const url = bakeSpriteUrl(bakeSpriteMarkup(species, config, "sleeping", sizePx), "");
        img.onload = () => {
          const frame = document.createElement("canvas");
          frame.width = sizePx;
          frame.height = sizePx;
          const ctx = frame.getContext("2d");
          if (ctx != null) {
            // 灰度睡眠态按物种只烘一次，避免每只睡眠角色每帧触发昂贵的 Canvas filter。
            ctx.filter = "grayscale(1) saturate(0) brightness(.78)";
            ctx.drawImage(img, 0, 0, sizePx, sizePx);
            ctx.filter = "none";
          }
          URL.revokeObjectURL(url);
          resolve(frame);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error(`bake ${species} sleep frame failed`));
        };
        img.src = url;
      });
      // 期待帧：本体 + 预烘光晕（金色辉光贴精灵剪影烘死在帧里，运行时只调 alpha）。
      const expectLoad = new Promise<[HTMLCanvasElement, HTMLCanvasElement]>((resolve, reject) => {
        const img = new Image();
        const url = bakeSpriteUrl(bakeSpriteMarkup(species, config, "success", sizePx), EXPECT_POSE);
        img.onload = () => {
          const base = document.createElement("canvas");
          base.width = sizePx;
          base.height = sizePx;
          base.getContext("2d")?.drawImage(img, 0, 0, sizePx, sizePx);
          const pad = Math.round(GLOW_PAD * dpr);
          const glow = document.createElement("canvas");
          glow.width = sizePx + pad * 2;
          glow.height = sizePx + pad * 2;
          const g = glow.getContext("2d");
          if (g) {
            g.shadowColor = "rgba(255, 214, 74, 0.95)";
            g.shadowBlur = pad * 0.8;
            g.drawImage(img, pad, pad, sizePx, sizePx);
            g.drawImage(img, pad, pad, sizePx, sizePx); // 叠两次加浓辉光
          }
          URL.revokeObjectURL(url);
          resolve([base, glow]);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error(`bake ${species} expect failed`));
        };
        img.src = url;
      });
      void Promise.all([Promise.all(loads), sleepLoad, expectLoad])
        .then(([frames, sleepFrame, [expectBase, expectGlow]]) => {
          entry.frames = frames; // 原地替换：旧帧一直画到新帧就绪，不闪
          entry.sleepFrame = sleepFrame;
          entry.expectBase = expectBase;
          entry.expectGlow = expectGlow;
          entry.ready = true;
          entry.baking = false;
          // 该物种的期待光重烘 → 清掉它的元素色 tint 缓存（下次用时按新光重染）。
          for (const k of [...glowTintRef.current.keys()]) {
            if (k.startsWith(`${species}:`)) glowTintRef.current.delete(k);
          }
        })
        .catch((error) => {
          console.warn("[factory] 图集烘焙失败", species, error);
          entry.baking = false;
          if (!entry.ready) cache.delete(species); // 无旧帧可退：作废，落定宠常驻 DOM 兜底
        });
    },
    [config],
  );

  // ⚠️ 有效配置每次存档推送都会换对象身份（基础+自定义物种重新合并，≈每 5s）——
  // 绝不能按 config 身份整体清图集：清空→重烘的窗口里整座山消失一帧，就是
  // 「每隔几秒闪一下」的根因（踩过）。这里只逐物种走 ensureAtlas 的 info 引用
  // 比对，真变了（AI 物种改绘）才原地重烘。
  useEffect(() => {
    bodiesRef.current.forEach((b) => ensureAtlas(b.species));
  }, [ensureAtlas]);

  // 粘住/弹开/罢工/解雇/桌配对计数 + 物理体快照（预览校验/调试：__facStats / __facBodies）。
  const statsRef = useRef({ sticks: 0, rejects: 0, strikes: 0, fired: 0, collapses: 0, deskSticks: 0, deskRejects: 0 });
  useEffect(() => {
    const w = window as unknown as {
      __facStats?: typeof statsRef.current;
      __facBodies?: () => unknown[];
      __facAtlas?: () => unknown[];
    };
    w.__facStats = statsRef.current;
    const readAtlas = () =>
      Array.from(atlasRef.current.entries()).map(([species, atlas]) => ({
        species,
        ready: atlas.ready,
        frames: atlas.frames.length,
        expect: atlas.expectBase != null && atlas.expectGlow != null,
        estimatedBytes: [
          ...atlas.frames,
          atlas.sleepFrame,
          atlas.expectBase,
          atlas.expectGlow,
        ].reduce((sum, frame) => sum + (frame == null ? 0 : frame.width * frame.height * 4), 0),
      }));
    const readBodies = () =>
      Array.from(bodiesRef.current.values()).map((b) => ({
        uid: b.uid,
        species: b.species,
        x: Math.round(b.x),
        y: Math.round(b.y),
        r: Math.round(b.r),
        settled: b.settled,
        stuck: b.stuck,
        inDom: b.inDom,
        buried: b.buried,
        squishX: Math.round(b.curSqX * 1000) / 1000,
        squishY: Math.round(b.curSqY * 1000) / 1000,
      }));
    w.__facAtlas = readAtlas;
    w.__facBodies = readBodies;
    return () => {
      // StrictMode/HMR 可能让旧实例的 cleanup 晚于新实例 setup；只撤销自己注册的句柄，
      // 避免旧 cleanup 把当前压测监控口一并删除。
      if (w.__facBodies === readBodies) delete w.__facBodies;
      if (w.__facAtlas === readAtlas) delete w.__facAtlas;
    };
  }, []);

  // 点击穿透联动：打工山画在 canvas 上（pointer-events:none，elementFromPoint
  // 拿不到形状），把「落定宠的物理圆」注册成附加命中区——比 DOM 盒还贴外形。
  useEffect(
    () =>
      registerHitRegion((x, y) => {
        for (const b of bodiesRef.current.values()) {
          if (!b.settled || b.inDom) continue;
          const dx = x - b.x;
          const dy = y - b.y;
          if (dx * dx + dy * dy <= b.r * b.r * 1.44) return true; // r×1.2：盖住比圆略宽的立绘
        }
        return false;
      }),
    [],
  );

  /** 机上补货：demo = 从在养宠里随机抽一只（允许重复）；rogue = 问签袋头
   *  （rogue.nextCarried()；null = 空钩巡航,推迟 RELOAD_MS 后再询问,不每帧打逻辑层）。
   *  顺手预烘图集：吊运 + 落体合计 ≥1.5s，宽限期结束时图集必然就绪。 */
  const spawnCarried = useCallback(() => {
    const rg = rogueRef.current;
    let species: string;
    if (rg != null) {
      const head = rg.nextCarried();
      if (head == null) {
        planeRef.current.reloadAt = performance.now() + RELOAD_MS; // 空钩：稍后再问
        return;
      }
      species = head.species;
    } else {
      const list = ownedRef.current;
      if (list.length === 0) return;
      species = list[Math.floor(Math.random() * list.length)].species;
    }
    const next: CarriedPet = { uid: uidRef.current++, species };
    carriedRef.current = next; // 同步占位：rAF 多帧不会重复补货
    setCarried(next);
    ensureAtlas(species);
  }, [ensureAtlas]);

  /** 空投：吊着的宠物变成物理体，从吊点带着飞机的水平速度出手。
   *  rogue 模式先过投掷闸门（onThrow 付雇佣费）：被拒 → 载宠抖一下,不出手。 */
  const dropCarried = useCallback(() => {
    const current = carriedRef.current;
    if (!current) return;
    const now = performance.now();
    if (bodiesRef.current.size >= MAX_PILE) {
      setFullMsg(now);
      return;
    }
    const rg = rogueRef.current;
    if (rg != null && !rg.onThrow(current.uid, current.species)) {
      // 雇不起/没名额/非投掷阶段：载宠原地抖一下（一次性 css 动画）作电报。
      const hang = hangElRef.current;
      if (hang) {
        hang.classList.remove("fr-carry-deny");
        void hang.offsetWidth; // 强制重排以重播一次性动画
        hang.classList.add("fr-carry-deny");
      }
      return;
    }
    const sc = sceneRef.current;
    const plane = planeRef.current;
    const r = collisionRadius(current.species);
    const body: Body = {
      uid: current.uid,
      species: current.species,
      elements: speciesElements(current.species),
      r,
      x: clamp(plane.x, WALL_PAD + Math.max(r, PET_VISUAL_HALF_W), sc.w - WALL_PAD - Math.max(r, PET_VISUAL_HALF_W)),
      y: HANG_TOP + PET_SIZE * FEET_RATIO - r, // 与吊挂位无缝衔接
      vx: plane.dir * plane.speed * 0.4 + (Math.random() - 0.5) * 40,
      vy: 40,
      bornAt: now,
      squashUntil: 0,
      settled: false,
      stuck: false,
      settledAt: 0,
      inDom: true,
      animPhase: (current.uid * 137) % WORK_CYCLE_MS,
      targetSqX: 1,
      targetSqY: 1,
      curSqX: 1,
      curSqY: 1,
      buried: false,
      wobbleAt: 0,
      fromCollapse: false,
      bounced: false,
      rogueReported: false,
    };
    bodiesRef.current.set(body.uid, body);
    setPets((prev) => [...prev, { uid: body.uid, species: body.species, landed: false }]);
    setPileCount(bodiesRef.current.size);
    carriedRef.current = null;
    setCarried(null);
    plane.reloadAt = now + RELOAD_MS;
    setHintGone(true);
  }, [collisionRadius, speciesElements]);

  /** 加班时间自动投放：每秒消费一个池头角色，沿抛物线飞向逻辑层算出的最高分点。 */
  const spawnOvertimeWorker = useCallback(
    (now: number): boolean => {
      const rg = rogueRef.current;
      const head = rg?.nextOvertime();
      if (rg == null || head == null) {
        overtimeNextAtRef.current = now;
        return false;
      }
      // 达标瞬间运输机上可能还预挂着同一个池头；加班改由右侧雇佣池起跳，
      // 先卸钩，避免屏上短暂出现两个相同实例。
      if (carriedRef.current != null) {
        carriedRef.current = null;
        setCarried(null);
      }
      if (now < overtimeNextAtRef.current) return true;
      const uid = uidRef.current++;
      const r = collisionRadius(head.species);
      const target = rg.onOvertimeThrow(uid, head.species, r);
      if (target == null) {
        overtimeNextAtRef.current = now + 120;
        return true;
      }
      const sc = sceneRef.current;
      const sideInset = WALL_PAD + Math.max(r, PET_VISUAL_HALF_W);
      const fromX = clamp(sc.w - Math.max(70, sc.w * 0.08), sideInset, sc.w - sideInset);
      const fromY = Math.max(HANG_TOP + r, Math.min(target.y - 80, sc.h * 0.26));
      const body: Body = {
        uid,
        species: head.species,
        elements: speciesElements(head.species),
        r,
        x: fromX,
        y: fromY,
        vx: 0,
        vy: 0,
        bornAt: now,
        squashUntil: 0,
        settled: false,
        stuck: true,
        settledAt: 0,
        inDom: true,
        animPhase: (uid * 137) % WORK_CYCLE_MS,
        targetSqX: 1,
        targetSqY: 1,
        curSqX: 1,
        curSqY: 1,
        buried: false,
        wobbleAt: 0,
        fromCollapse: false,
        bounced: false,
        rogueReported: false,
        overtimeJump: {
          fromX,
          fromY,
          toX: target.x,
          toY: target.y,
          startedAt: now,
          landsAt: now + OVERTIME_JUMP_MS,
        },
        overtimeWorker: true,
      };
      bodiesRef.current.set(uid, body);
      setPets((prev) => [...prev, { uid, species: head.species, landed: false }]);
      setPileCount(bodiesRef.current.size);
      ensureAtlas(head.species);
      overtimeNextAtRef.current = now + OVERTIME_INTERVAL_MS;
      return true;
    },
    [collisionRadius, ensureAtlas, speciesElements],
  );

  /** 草系【生长】从逻辑队列生成真实物理咕噜；生成当次不触发落地计分。 */
  const spawnGeneratedWorker = useCallback(
    (now: number): boolean => {
      const rg = rogueRef.current;
      if (rg?.takeGeneratedSpawn == null) return false;
      const uid = uidRef.current;
      const request = rg.takeGeneratedSpawn(uid);
      if (request == null) return false;
      uidRef.current++;
      const sc = sceneRef.current;
      const r = collisionRadius(request.species);
      const body: Body = {
        uid,
        species: request.species,
        elements: speciesElements(request.species),
        r,
        x: clamp(
          request.x,
          WALL_PAD + Math.max(r, PET_VISUAL_HALF_W),
          sc.w - WALL_PAD - Math.max(r, PET_VISUAL_HALF_W),
        ),
        y: Math.max(SETTLE_MIN_Y, request.y),
        vx: 0,
        vy: 18,
        bornAt: now,
        squashUntil: 0,
        settled: false,
        stuck: true,
        settledAt: 0,
        inDom: true,
        animPhase: (uid * 137) % WORK_CYCLE_MS,
        targetSqX: 1,
        targetSqY: 1,
        curSqX: 1,
        curSqY: 1,
        buried: false,
        wobbleAt: 0,
        fromCollapse: false,
        bounced: false,
        rogueReported: true,
        protectStrikeOnSettle: true,
      };
      bodiesRef.current.set(uid, body);
      setPets((prev) => [...prev, { uid, species: request.species, landed: false }]);
      setPileCount(bodiesRef.current.size);
      ensureAtlas(request.species);
      return true;
    },
    [collisionRadius, ensureAtlas, speciesElements],
  );

  // 「办公室满了」提示自动消失。
  useEffect(() => {
    if (fullMsg === 0) return;
    const timer = window.setTimeout(() => setFullMsg(0), 1600);
    return () => window.clearTimeout(timer);
  }, [fullMsg]);

  /** 落定后重算全山压扁：头顶横向重叠的每只 +1 层重量，越下层越扁。
   *  结果写进物理体（targetSq/buried），由画布绘制侧逐帧缓动应用。 */
  const applyWeights = useCallback(() => {
    const settled: Body[] = [];
    bodiesRef.current.forEach((b) => {
      if (b.settled) settled.push(b);
    });
    for (const b of settled) {
      let weight = 0;
      for (const o of settled) {
        if (o === b) continue;
        const rr = b.r + o.r;
        if (o.y < b.y - rr * 0.45 && Math.abs(o.x - b.x) < rr * 0.8) weight += 1;
      }
      const squishY = Math.max(1 - SQUISH_MAX, 1 - weight * SQUISH_PER_WEIGHT);
      b.targetSqY = squishY;
      b.targetSqX = 1 + (1 - squishY) * 0.85;
      b.buried = weight >= BURIED_WEIGHT; // 被压得动不了：画布侧帧号冻结
    }
  }, []);

  /** 落定宠是否直接踩在表面上（地面或某张桌面板顶）。 */
  // 续局恢复：原位接管存档中的宠物，且不重新触发落地收入/罢工事件。
  useEffect(() => {
    const initial = rogue?.initialBodies;
    if (initial == null || initial.length === 0 || bodiesRef.current.size > 0) return;
    const now = performance.now();
    for (const saved of initial) {
      bodiesRef.current.set(saved.uid, {
        uid: saved.uid,
        species: saved.species,
        elements: saved.elements.slice(),
        r: saved.r,
        x: saved.x,
        y: saved.y,
        vx: 0,
        vy: 0,
        bornAt: now,
        squashUntil: 0,
        settled: true,
        stuck: true,
        settledAt: now - SWAP_GRACE_MS,
        // 恢复时仍先由 DOM 接管；图集异步就绪后，主循环会走与新落地宠
        // 相同的 DOM→Canvas 换装路径并从 pets 中卸载节点。若这里直接设为
        // false，Canvas 会绘制它，而 DOM 节点因换装逻辑跳过 !inDom 的宠物
        // 永远不会被移除，续局后便会看到每只角色各渲染两次。
        inDom: true,
        animPhase: (saved.uid * 137) % WORK_CYCLE_MS,
        targetSqX: 1,
        targetSqY: 1,
        curSqX: 1,
        curSqY: 1,
        buried: false,
        wobbleAt: 0,
        fromCollapse: false,
        bounced: false,
        rogueReported: true,
        strikeProtection: saved.strikeProtection == null ? undefined : {
          species: saved.strikeProtection.species,
          members: saved.strikeProtection.members.slice(),
          positions: saved.strikeProtection.positions.map((position) => ({ ...position })),
        },
      });
      ensureAtlas(saved.species);
    }
    uidRef.current = Math.max(uidRef.current, ...initial.map((body) => body.uid + 1));
    setPets(initial.map((body) => ({ uid: body.uid, species: body.species, landed: true })));
    setPileCount(initial.length);
    applyWeights();
  }, [applyWeights, ensureAtlas, rogue?.initialBodies]);

  const onSurface = useCallback((b: Body) => {
    const feet = b.y + b.r;
    if (feet >= sceneRef.current.h - FLOOR_H - 6) return true;
    for (const o of obstaclesRef.current) {
      if (Math.abs(feet - o.y) <= 7 && b.x >= o.x - b.r * 0.35 && b.x <= o.x + o.w + b.r * 0.35) return true;
    }
    return false;
  }, []);

  /** 支撑重算：从「踩在表面上」的落定宠出发，沿接触关系向外传播（支撑者须在
   *  同高或更低——侧向粘着的链条只要锚点还在就撑得住）；传播不到的统统坍塌，
   *  重新变回落体（回 DOM 活体重演坠落）。罢工/解雇/桌子重排后都要跑一遍。 */
  const collapseUnsupported = useCallback(() => {
    const settled: Body[] = [];
    bodiesRef.current.forEach((b) => {
      if (b.settled) settled.push(b);
    });
    if (settled.length > 0) {
      const supported = new Set<number>();
      const supportEdges = new Map<number, number[]>();
      for (const b of settled) supportEdges.set(b.uid, []);
      // 接触关系在一次支撑重算中不会改变，先用 O(n²) 构图，再从表面根节点做 BFS。
      // 旧实现每扩散一层都会重新扫描全部已支撑/未支撑组合，深塔最坏会到 O(n³)。
      for (let i = 0; i < settled.length; i++) {
        const a = settled[i];
        for (let j = i + 1; j < settled.length; j++) {
          const b = settled[j];
          const radii = a.r + b.r;
          const rr = radii * 1.12;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          if (dx * dx + dy * dy > rr * rr) continue;
          // 方向与旧判定完全一致：支撑者不能整体位于被支撑者上方。
          if (a.y >= b.y - radii * 0.3) supportEdges.get(a.uid)!.push(b.uid);
          if (b.y >= a.y - radii * 0.3) supportEdges.get(b.uid)!.push(a.uid);
        }
      }
      const supportQueue: number[] = [];
      for (const b of settled) {
        if (!onSurface(b)) continue;
        supported.add(b.uid);
        supportQueue.push(b.uid);
      }
      for (let i = 0; i < supportQueue.length; i++) {
        for (const uid of supportEdges.get(supportQueue[i]) ?? []) {
          if (supported.has(uid)) continue;
          supported.add(uid);
          supportQueue.push(uid);
        }
      }
      const falling = settled.filter((b) => !supported.has(b.uid));
      if (falling.length > 0) {
        const now = performance.now();
        const fallingIds = new Set(falling.map((b) => b.uid));
        // A collapse must not tear an already glued chain apart.  All members
        // of one sticky connected component receive the same horizontal
        // impulse, so gravity translates the chain as a unit until its first
        // member lands and the normal collision pass can glue the rest back.
        // Previously every body got an independent random vx; ejecting a
        // squashed support therefore scattered its still-connected children.
        const adjacency = buildAdjacency(falling, {
          // Collapse follows the physical glue range, not the wider scoring
          // connection range used by rogueGraph's default.
          slack: CONTACT_SLACK,
          stickOverride: rogueRef.current?.stickOverride,
        });
        const componentVx = new Map<number, number>();
        const visited = new Set<number>();
        for (const root of falling) {
          if (visited.has(root.uid)) continue;
          const vx = (Math.random() - 0.5) * 60;
          const queue = [root.uid];
          visited.add(root.uid);
          for (let i = 0; i < queue.length; i++) {
            const uid = queue[i];
            componentVx.set(uid, vx);
            for (const next of adjacency.get(uid) ?? []) {
              if (visited.has(next)) continue;
              visited.add(next);
              queue.push(next);
            }
          }
        }
        for (const b of falling) {
          b.settled = false;
          b.stuck = false;
          b.buried = false;
          b.settledAt = 0;
          b.bornAt = now;
          b.vx = componentVx.get(b.uid) ?? 0;
          b.vy = 0;
          b.targetSqX = 1;
          b.targetSqY = 1;
          b.curSqX = 1;
          b.curSqY = 1;
          b.inDom = true;
          b.fromCollapse = true; // 塌方重落体标记（rogue 泥石流重粘判定；再次落定时清）
          b.bounced = false;
          const outer = outerRefs.current.get(b.uid);
          if (outer) delete outer.dataset.stuck;
        }
        statsRef.current.collapses += falling.length;
        setPets((prev) => {
          const have = new Set(prev.map((p) => p.uid));
          const next = prev.map((p) => (fallingIds.has(p.uid) ? { ...p, landed: false } : p));
          for (const b of falling) {
            if (!have.has(b.uid)) next.push({ uid: b.uid, species: b.species, landed: false });
          }
          return next;
        });
      }
    }
    applyWeights();
  }, [applyWeights, onSurface]);
  collapseFnRef.current = collapseUnsupported;

  /** 一组同物种落定宠集体罢工：移出物理堆 → 转跑路者（先原地抗议，到点向
   *  屏幕两侧分头跑掉）。坍塌由调用方统一触发（多组罢工只重算一次）。
   *  rogue：**移除宠物前**先报 onStrike（逻辑层要按离场瞬间快照结算退款与工休业绩）；
   *  罢工牌文案从梗池随机抽（每只各抽一条）。 */
  const startStrike = useCallback((members: Body[]) => {
    const now = performance.now();
    const rg = rogueRef.current;
    if (rg != null && members.length > 0) {
      rg.onStrike(
        members.map((m) => m.uid),
        members[0].species,
      );
    }
    const signPool = rg != null ? FACTORY_ROGUE[langRef.current].strikeSigns : null;
    const sorted = [...members].sort((a, b) => a.x - b.x);
    const half = Math.ceil(sorted.length / 2);
    const ids = new Set<number>();
    const added: RunnerUi[] = [];
    sorted.forEach((b, i) => {
      const dir: 1 | -1 = i < half ? -1 : 1;
      bodiesRef.current.delete(b.uid);
      ids.add(b.uid);
      runnersRef.current.set(b.uid, {
        uid: b.uid,
        species: b.species,
        x: b.x,
        y: b.y,
        r: b.r,
        vy: 0,
        dir,
        phase: "strike",
        until: now + STRIKE_MS,
        reason: "strike",
      });
      added.push({
        uid: b.uid,
        species: b.species,
        phase: "strike",
        dir,
        sign: signPool != null ? signPool[Math.floor(Math.random() * signPool.length)] : undefined,
      });
    });
    statsRef.current.strikes += members.length;
    setPets((prev) => prev.filter((p) => !ids.has(p.uid)));
    setRunners((prev) => [...prev, ...added]);
    setPileCount(bodiesRef.current.size);
  }, []);

  /** 三只同物种连在一起 → 罢工。对全部落定宠按「同物种 + 圆接触」做并查集，
   *  连通分量 ≥ 罢工线的整组带走；随后统一重算支撑（可与坍塌连锁）。
   *  罢工线：demo 恒 STRIKE_COUNT；rogue 按每组元素读取（水系「工休」只影响含水组）。 */
  const detectStrikes = useCallback(() => {
    const settled: Body[] = [];
    bodiesRef.current.forEach((b) => {
      // 加班员工只是一次性计分的临时访客，得分后马上返池；不能被三连罢工
      // 抢先带走，否则逻辑层会永远等不到它的 overtime 返池回执。
      if (
        b.settled
        && b.overtimeWorker !== true
        && (rogueRef.current?.countsForStrike?.(b.uid) ?? true)
      ) settled.push(b);
    });
    if (settled.length === 0) return;
    const parent = new Map<number, number>();
    const bySpecies = new Map<string, Body[]>();
    settled.forEach((b) => parent.set(b.uid, b.uid));
    for (const b of settled) {
      const sameSpecies = bySpecies.get(b.species);
      if (sameSpecies) sameSpecies.push(b);
      else bySpecies.set(b.species, [b]);
    }
    const find = (u: number): number => {
      let root = u;
      while (parent.get(root) !== root) root = parent.get(root)!;
      let cur = u;
      while (cur !== root) {
        const next = parent.get(cur)!;
        parent.set(cur, root);
        cur = next;
      }
      return root;
    };
    for (const sameSpecies of bySpecies.values()) {
      for (let i = 0; i < sameSpecies.length; i++) {
        for (let j = i + 1; j < sameSpecies.length; j++) {
          const a = sameSpecies[i];
          const c = sameSpecies[j];
          const rr = (a.r + c.r) * CONTACT_SLACK;
          const dx = a.x - c.x;
          const dy = a.y - c.y;
          if (dx * dx + dy * dy > rr * rr) continue;
          parent.set(find(a.uid), find(c.uid));
        }
      }
    }
    const groups = new Map<number, Body[]>();
    for (const b of settled) {
      const root = find(b.uid);
      const list = groups.get(root);
      if (list) list.push(b);
      else groups.set(root, [b]);
    }
    const pendingProtection = pendingStrikeProtectionRef.current;
    const sameSnapshot = (members: Body[], protection: NonNullable<Body["strikeProtection"]>): boolean => {
      if (protection.species !== members[0]?.species || protection.members.length !== members.length) return false;
      const memberIds = members.map((member) => member.uid).sort((a, b) => a - b);
      if (memberIds.some((uid, index) => uid !== protection.members[index])) return false;
      return members.every((member) => {
        const position = protection.positions.find((candidate) => candidate.uid === member.uid);
        return position != null && Math.hypot(member.x - position.x, member.y - position.y) <= 0.5;
      });
    };
    let struck = false;
    groups.forEach((members) => {
      if (members.some((member) => pendingProtection.has(member.uid) || member.protectStrikeOnSettle === true)) {
        protectStrikeComponent(members);
        return;
      }
      const protection = members.find((member) => member.strikeProtection != null)?.strikeProtection;
      if (protection != null && sameSnapshot(members, protection)) return;
      members.forEach((member) => { member.strikeProtection = undefined; });
      const strikeLine = rogueRef.current?.strikeCount(members[0]?.elements) ?? STRIKE_COUNT;
      if (members.length >= strikeLine) {
        startStrike(members);
        struck = true;
      }
    });
    pendingProtection.clear();
    if (struck) collapseUnsupported();
  }, [collapseUnsupported, startStrike]);

  /** 点击解雇：单只落定宠立即转跑路者（不抗议，直接向最近的屏边跑），
   *  然后重算支撑触发坍塌。reason 供 rogue 的 onGone 区分（demo 不消费）。 */
  const fireBody = useCallback(
    (uid: number, reason: "strike" | "dismiss" = "dismiss") => {
      const b = bodiesRef.current.get(uid);
      if (!b || !b.settled) return;
      bodiesRef.current.delete(uid);
      const dir: 1 | -1 = b.x < sceneRef.current.w / 2 ? -1 : 1;
      runnersRef.current.set(uid, {
        uid,
        species: b.species,
        x: b.x,
        y: b.y,
        r: b.r,
        vy: 0,
        dir,
        phase: "run",
        until: 0,
        reason,
      });
      statsRef.current.fired += 1;
      setPets((prev) => prev.filter((p) => p.uid !== uid));
      setRunners((prev) => [...prev, { uid, species: b.species, phase: "run", dir }]);
      setPileCount(bodiesRef.current.size);
      collapseUnsupported();
    },
    [collapseUnsupported],
  );

  /** rogue 事件出口：向逻辑层上报本帧新落定的物理体。粘住（stuck）→ onSettled；
   *  落在地板没粘任何东西 → onBounced（弹开确定）。每 uid 只报一次
   *  （rogueReported），塌方重粘/搬桌重落不重报——「塌落重粘不重新结算」。
   *  必须在 detectStrikes **之前**调：第三只粘上先结脉冲再触发罢工。 */
  const reportRogueSettles = useCallback(() => {
    const rg = rogueRef.current;
    bodiesRef.current.forEach((b) => {
      if (!b.settled) return;
      b.fromCollapse = false; // 再次落定时清（无论是否已报过）
      if (rg == null || b.rogueReported) return;
      b.rogueReported = true;
      if (b.stuck) rg.onSettled(b.uid);
      else rg.onBounced(b.uid, b.species);
      if (b.overtimeWorker === true && b.stuck) {
        b.overtimeEscapeAt = performance.now() + OVERTIME_ESCAPE_DELAY_MS;
      }
    });
  }, []);

  /** 加班角色得分后从塔体中抽离，转为普通跑路动画；逻辑层在其出屏时确认返池。 */
  const releaseOvertimeWorkers = useCallback((now: number) => {
    const bodies = bodiesRef.current;
    const ids = new Set<number>();
    const added: RunnerUi[] = [];
    bodies.forEach((b) => {
      if (
        b.overtimeWorker !== true
        || b.overtimeEscapeAt == null
        || now < b.overtimeEscapeAt
      ) return;
      bodies.delete(b.uid);
      ids.add(b.uid);
      const dir: 1 | -1 = b.x < sceneRef.current.w / 2 ? -1 : 1;
      runnersRef.current.set(b.uid, {
        uid: b.uid,
        species: b.species,
        x: b.x,
        y: b.y,
        r: b.r,
        vy: 0,
        dir,
        phase: "run",
        until: now,
        reason: "overtime",
      });
      added.push({ uid: b.uid, species: b.species, phase: "run", dir });
    });
    if (ids.size === 0) return;
    setPets((prev) => prev.filter((pet) => !ids.has(pet.uid)));
    setRunners((prev) => [...prev, ...added]);
    setPileCount(bodies.size);
    applyWeights();
  }, [applyWeights]);

  /** 把本帧新落定的物理体同步给 React（drop→laboring 骨骼动画切换），
   *  重算压扁，并做三连罢工检测（坍塌重落的宠再次落定也走这里 → 连锁）。 */
  const commitSettled = useCallback(() => {
    const settledIds = new Set<number>();
    bodiesRef.current.forEach((b) => {
      if (b.settled) settledIds.add(b.uid);
    });
    setPets((prev) => prev.map((p) => (p.landed || !settledIds.has(p.uid) ? p : { ...p, landed: true })));
    applyWeights();
    detectStrikes();
  }, [applyWeights, detectStrikes]);

  // 预览压测（?facpile=N）：进场即铺 N 只已落定宠。确定性 LCG 布点（可复现 A/B），
  // 逐只找「落在已有圆上的静置位」，与真实堆叠同一几何；离地的按 stuck 记账。
  useEffect(() => {
    const n = previewFacPile();
    if (rogueRef.current != null) return; // 压测播种只属于演示模式（rogue 名单/账务对不上）
    if (n <= 0 || ownedRef.current.length === 0 || bodiesRef.current.size > 0) return;
    let rngState = 1234567;
    const rand = () => ((rngState = (rngState * 1664525 + 1013904223) >>> 0) / 4294967296);
    const sc = sceneRef.current;
    const groundY = sc.h - FLOOR_H;
    const bodies = bodiesRef.current;
    for (let i = 0; i < n; i++) {
      const pick = ownedRef.current[Math.floor(rand() * ownedRef.current.length)];
      const r = collisionRadius(pick.species);
      const elems = speciesElements(pick.species);
      let spot: { x: number; y: number } | null = null;
      for (let attempt = 0; attempt < 14 && spot == null; attempt++) {
        const sideInset = WALL_PAD + Math.max(r, PET_VISUAL_HALF_W);
        const x = sideInset + rand() * Math.max(1, sc.w - 2 * sideInset);
        // 从天而降的静置扫描：起点取该 x 上最高的表面（属性相合的桌面板顶或地面
        // ——桌面是属性工位，播种也只把配对的放上去）。
        let y = groundY - r;
        for (const o of obstaclesRef.current) {
          if (x < o.x || x > o.x + o.w) continue;
          if (o.element != null && !elems.includes(o.element)) continue;
          y = Math.min(y, o.y - r);
        }
        bodies.forEach((s) => {
          const dx = x - s.x;
          const rr = r + s.r;
          if (Math.abs(dx) >= rr * 0.92) return;
          y = Math.min(y, s.y - Math.sqrt(Math.max(1, rr * rr - dx * dx)));
        });
        if (y >= SETTLE_MIN_Y) spot = { x, y };
      }
      if (spot == null) continue;
      const uid = uidRef.current++;
      bodies.set(uid, {
        uid,
        species: pick.species,
        elements: speciesElements(pick.species),
        r,
        x: spot.x,
        y: spot.y,
        vx: 0,
        vy: 0,
        bornAt: performance.now(),
        squashUntil: 0,
        settled: true,
        stuck:
          spot.y < groundY - r - 4 &&
          !obstaclesRef.current.some(
            (o) => Math.abs(spot!.y + r - o.y) <= 4 && spot!.x >= o.x && spot!.x <= o.x + o.w,
          ),
        settledAt: performance.now() - 60_000, // 直接走画布，不经 DOM 宽限
        inDom: false,
        animPhase: (uid * 137) % WORK_CYCLE_MS,
        targetSqX: 1,
        targetSqY: 1,
        curSqX: 1,
        curSqY: 1,
        buried: false,
        wobbleAt: 0,
      });
      ensureAtlas(pick.species);
    }
    setPileCount(bodies.size);
    applyWeights();
  }, [applyWeights, collisionRadius, ensureAtlas, speciesElements]);

  // ---- 物理 + 巡航 + 打工山画布绘制主循环 ----
  useEffect(() => {
    // 结算/商店/总结都把场景完全盖住。继续跑 60Hz 会白白重画整座 Canvas，
    // 透明 WebView 下还会迫使桌面合成器持续重组背后的窗口。
    if (paused) return;
    let raf = 0;
    let last = performance.now();
    let nextPathSleepAudit = 0;
    let lastPileDraw = last;
    let nextPileDraw = 0;

    // 嫌弃晃动的旋转轨道（与原 CSS fac-reject-wob 同型）。
    const wobbleTrack: ReadonlyArray<readonly [number, number]> = [
      [0, 0],
      [0.35, -5],
      [0.7, 4],
      [1, 0],
    ];

    /** 打工山批量绘制：一次 clear + 每只一次 drawImage（GPU 贴图），
     *  压扁缓动/帧翻页/嫌弃晃动全在绘制侧按物理体状态计算。 */
    const drawPile = (now: number, dt: number) => {
      const canvas = pileCanvasRef.current;
      if (canvas == null) return;
      const sc = sceneRef.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pw = Math.round(sc.w * dpr);
      const ph = Math.round(sc.h * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
        canvas.style.width = `${sc.w}px`;
        canvas.style.height = `${sc.h}px`;
      }
      const ctx = canvas.getContext("2d");
      if (ctx == null) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, sc.w, sc.h);
      const list: Body[] = [];
      bodiesRef.current.forEach((b) => {
        if (b.settled && !b.inDom) list.push(b);
      });
      if (list.length === 0) return;
      list.sort((p, q) => p.y - q.y); // painter：靠下（屏幕前排）后画
      const ease = Math.min(1, dt * 8);
      const hot = carriedElemsRef.current; // 机上宠属性：表层可粘宠画呼吸光环
      // N1 结算聚光：某只落地计分时,整座打工山**定格静止**、由 .fac-stage.is-spotlighting
      // 的 CSS 把画布整体压暗(只暗场景像素,透明天空/桌面不动);得分宠、被吸取宠与
      // 本次效果涉及的宠改由 .fac-hero-layer 的活体精灵在压暗层之上重演打工 + 三波粒子。
      const sp = spotlightRef.current;
      const spActive = sp != null && now < sp.until;
      for (const b of list) {
        let renderSpecies = b.species;
        if (b.visualSwap != null) {
          const targetReady = atlasRef.current.get(b.species)?.ready === true;
          if (now < b.visualSwap.switchAt || !targetReady) {
            renderSpecies = b.visualSwap.fromSpecies;
          } else {
            b.visualSwap = undefined;
          }
        }
        const atlas = atlasRef.current.get(renderSpecies);
        if (!atlas?.ready) continue;
        const frozen = rogueRef.current?.isBodyFrozen?.(b.uid) === true;
        const generated = rogueRef.current?.isBodyGenerated?.(b.uid) === true;
        const pathSleeping = sleepingPathUidsRef.current.has(b.uid);
        if (frozen && b.frozenAt == null) {
          b.frozenAt = now;
          b.frozenFrame =
            Math.floor((((now + b.animPhase) % WORK_CYCLE_MS) / WORK_CYCLE_MS) * FRAME_COUNT) % FRAME_COUNT;
        }
        if (!frozen) {
          b.frozenAt = undefined;
          b.frozenFrame = undefined;
        }
        const frozenBob = frozen && !pathSleeping ? frozenBobAt(now) : 0;
        const bodyScale = rogueRef.current?.bodyScale?.(b.uid) ?? 1;
        // 压扁向目标缓动（替代原 CSS transition 的蠕动）
        b.curSqX += (b.targetSqX - b.curSqX) * ease;
        b.curSqY += (b.targetSqY - b.curSqY) * ease;
        const frame =
          frozen
            ? b.frozenFrame ?? 0
            : b.buried || spActive
            ? b.uid % FRAME_COUNT // 被压住 / 聚光定格：帧号冻结（静止不动）
            : Math.floor((((now + b.animPhase) % WORK_CYCLE_MS) / WORK_CYCLE_MS) * FRAME_COUNT) % FRAME_COUNT;
        let rot = 0;
        if (!frozen && !pathSleeping && b.wobbleAt > 0) {
          const t = (now - b.wobbleAt) / 320;
          if (t < 1) rot = trackAt(wobbleTrack, t);
          else b.wobbleAt = 0;
        }
        // 载宠期待提示：山体表层（未埋没）里与机上宠属性相合的放下工具换「期待」
        // 立绘——星星眼双臂高举、原地小蹦跳，本体带贴轮廓的**元素色**辉光呼吸。
        // 光晕预烘为形状 alpha、运行时按元素色 tint（tintGlow 缓存）；载宠切换时靠
        // glowAmt 包络淡入淡出 + 与打工帧交叉溶解，不再「忽然消失」/一律黄色。
        const matchEl =
          hot != null && !frozen && !pathSleeping && !b.buried && !spActive
            ? b.elements.find((e) => hot.includes(e))
            : undefined;
        const glowTarget = matchEl != null && atlas.expectBase != null ? 1 : 0;
        b.glowAmt = frozen || pathSleeping
          ? 0
          : (b.glowAmt ?? 0) + (glowTarget - (b.glowAmt ?? 0)) * ease;
        if (b.glowAmt > 0.02 && atlas.expectBase != null) {
          const amt = b.glowAmt;
          const pulse = 0.5 + 0.5 * Math.sin(now / 320 + b.uid * 1.7);
          const hop = Math.abs(Math.sin(now / 190 + b.uid)) * 5 * amt;
          ctx.save();
          ctx.translate(b.x, b.y + b.r + frozenBob);
          ctx.scale(b.curSqX * bodyScale, b.curSqY * bodyScale);
          ctx.translate(0, -hop); // 期待的小蹦跳（在压扁之上）
          // 打工帧在下、期待帧在上按 amt 交叉溶解 → 姿态平滑切换不弹跳。
          if (amt < 0.985) {
            ctx.globalAlpha = 1 - amt;
            ctx.drawImage(atlas.frames[frame], -PET_SIZE / 2, -PET_SIZE * FEET_RATIO, PET_SIZE, PET_SIZE);
          }
          if (atlas.expectGlow != null) {
            const key = `${renderSpecies}:${matchEl ?? "_"}`;
            let tinted = glowTintRef.current.get(key);
            if (tinted == null && matchEl != null) {
              const color = config.elements[matchEl]?.color ?? "#ffd93b";
              tinted = tintGlow(atlas.expectGlow, color);
              glowTintRef.current.set(key, tinted);
            }
            ctx.globalAlpha = (0.4 + 0.45 * pulse) * amt;
            ctx.drawImage(
              tinted ?? atlas.expectGlow,
              -PET_SIZE / 2 - GLOW_PAD,
              -PET_SIZE * FEET_RATIO - GLOW_PAD,
              PET_SIZE + GLOW_PAD * 2,
              PET_SIZE + GLOW_PAD * 2,
            );
          }
          ctx.globalAlpha = amt;
          ctx.drawImage(atlas.expectBase, -PET_SIZE / 2, -PET_SIZE * FEET_RATIO, PET_SIZE, PET_SIZE);
          ctx.globalAlpha = 1;
          drawBodyElementState(ctx, b.uid, generated, frozen);
          ctx.restore();
          continue;
        }
        ctx.save();
        ctx.translate(b.x, b.y + b.r + frozenBob); // 原点 = 脚底中心（压扁不离地）
        if (rot !== 0) ctx.rotate((rot * Math.PI) / 180);
        const sleepWave = pathSleeping
          ? (1 - Math.cos(((now + b.animPhase) / SLEEP_CYCLE_MS) * Math.PI * 2)) / 2
          : 0;
        ctx.scale(
          b.curSqX * bodyScale * (1 + sleepWave * 0.025),
          b.curSqY * bodyScale * (1 - sleepWave * 0.028),
        );
        // 聚光期整块画布的压暗由 .fac-stage.is-spotlighting 的 CSS filter 统一负责
        // (只暗场景像素、不动透明天空/桌面);此处不再逐宠改 ctx.filter。
        ctx.drawImage(
          pathSleeping ? atlas.sleepFrame ?? atlas.frames[0] : atlas.frames[frame],
          -PET_SIZE / 2,
          -PET_SIZE * FEET_RATIO,
          PET_SIZE,
          PET_SIZE,
        );
        drawBodyElementState(ctx, b.uid, generated, frozen);
        ctx.restore();
      }
    };

    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      // rogue hit-stop:大脉冲瞬间全场慢镜(物理/巡航/跑路者共用同一 dt)。
      const timeScale = rogueRef.current?.timeScale?.() ?? 1;
      const dt = Math.min(0.032, (now - last) / 1000) * timeScale;
      last = now;
      const sc = sceneRef.current;
      const groundY = sc.h - FLOOR_H;

      // 一般系【吸收】由逻辑层先完成账务和连接转移；场景将保留体移到双方中点，再移除被吃物理体。
      const mutations = rogueRef.current?.takeBodyMutations?.() ?? [];
      if (mutations.length > 0) {
        const removed = new Set<number>();
        const converted = new Map<number, string>();
        const nextAssimilations: AssimilationFx[] = [];
        for (const mutation of mutations) {
          if (mutation.kind === "absorb") {
            const absorber = bodiesRef.current.get(mutation.sourceUid);
            const absorbed = bodiesRef.current.get(mutation.targetUid);
            if (absorber != null && absorbed != null) {
              absorber.x = (absorber.x + absorbed.x) / 2;
              absorber.y = (absorber.y + absorbed.y) / 2;
            }
            bodiesRef.current.delete(mutation.targetUid);
            removed.add(mutation.targetUid);
            pendingStrikeProtectionRef.current.add(mutation.sourceUid);
            continue;
          }
          const body = bodiesRef.current.get(mutation.targetUid);
          if (body == null) continue;
          const fromSpecies = body.species;
          body.species = mutation.species;
          body.elements = mutation.elements.slice();
          ensureAtlas(mutation.species);
          converted.set(body.uid, mutation.species);
          pendingStrikeProtectionRef.current.add(body.uid);
          if (fromSpecies !== mutation.species) {
            body.visualSwap = {
              fromSpecies,
              switchAt: now + (
                window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 190 : 560
              ),
            };
            nextAssimilations.push({
              id: assimilationFxIdRef.current++,
              uid: body.uid,
              x: body.x,
              y: body.y,
              r: body.r,
              fromSpecies,
              toSpecies: mutation.species,
            });
          }
        }
        if (removed.size > 0) {
          setPets((previous) => previous.filter((pet) => !removed.has(pet.uid)));
          setPileCount(bodiesRef.current.size);
        }
        if (converted.size > 0) {
          setPets((previous) => previous.map((pet) => {
            const species = converted.get(pet.uid);
            return species == null ? pet : { ...pet, species };
          }));
          setHeroPets((previous) => previous.map((pet) => {
            const species = converted.get(pet.uid);
            return species == null ? pet : { ...pet, species };
          }));
        }
        if (nextAssimilations.length > 0) {
          const convertedUids = new Set(nextAssimilations.map((item) => item.uid));
          setAssimilationFx((previous) => [
            ...previous.filter((item) => !convertedUids.has(item.uid)),
            ...nextAssimilations,
          ].slice(-8));
        }
        // 在效果改变结构的同一帧固定豁免基线。这样之后手动投放的新同名成员
        // 不会被误收进豁免，而会作为成员变化正常触发罢工重判。
        for (const uid of pendingStrikeProtectionRef.current) {
          const seed = bodiesRef.current.get(uid);
          if (seed?.settled === true) {
            protectStrikeComponent(sameSpeciesComponent(seed, bodiesRef.current.values()));
          }
        }
        pendingStrikeProtectionRef.current.clear();
      }

      // 运输机巡航（左右往返，折返转向）。横穿一趟的时间固定：速度按巡航区宽反算，
      // 屏幕越宽飞得越快。
      const plane = planeRef.current;
      const minX = Math.max(PLANE_W / 2 + 8, sc.w * PLANE_PATROL_MIN);
      const maxX = Math.min(sc.w - PLANE_W / 2 - 8, sc.w * PLANE_PATROL_MAX);
      plane.speed = Math.max(120, (maxX - minX) / PLANE_CROSS_S);
      plane.x += plane.dir * plane.speed * dt * CAPTURE_MOTION_SCALE;
      if (plane.x >= maxX) {
        plane.x = maxX;
        plane.dir = -1;
      } else if (plane.x <= minX) {
        plane.x = minX;
        plane.dir = 1;
      }
      const planeEl = planeElRef.current;
      if (planeEl) {
        planeEl.style.transform = `translate3d(${plane.x - PLANE_W / 2}px, ${PLANE_TOP}px, 0)`;
        planeEl.classList.toggle("fac-plane-flip", plane.dir < 0);
      }
      const dropGuideEl = dropGuideElRef.current;
      const guideElements = carriedElemsRef.current;
      if (dropGuideEl != null && guideElements != null) {
        const projection = projectFactoryDropGuide({
          planeX: plane.x,
          planeDir: plane.dir,
          planeSpeed: plane.speed,
          startFeetY: HANG_TOP + PET_SIZE * FEET_RATIO,
          groundY: sc.h - FLOOR_H,
          gravity: GRAVITY,
          sceneWidth: sc.w,
          elements: guideElements,
          desks: desksSnapRef.current,
        });
        dropGuideEl.style.transform = `translate3d(${projection.x - 24}px, ${projection.y - 14}px, 0)`;
        const state = projection.ready ? "ready" : "wait";
        if (dropGuideEl.dataset.state !== state) dropGuideEl.dataset.state = state;
        dropGuideEl.classList.toggle("is-ready", projection.ready);
      }
      // rogue：机上载宠陈旧校对（低频 500ms）。跨班洗袋/罢工扣签后袋头可能已换人，
      // 旧载宠会被 onThrow 的「只认袋头」恒拒且占着钩子永不重询 → 软锁（D 线缺陷 #1）。
      // 失配（含袋头暂不可雇 = null）即卸下重询；同种则保留不打扰。
      {
        const rgNow = rogueRef.current;
        if (rgNow != null && carriedRef.current != null && now >= carryAuditAtRef.current) {
          carryAuditAtRef.current = now + 500;
          const head = rgNow.nextCarried();
          if (head == null || head.species !== carriedRef.current.species) {
            carriedRef.current = null;
            setCarried(null);
            plane.reloadAt = now + 260; // 短延迟重询，接上新袋头
          }
        }
      }
      // 得分完毕的加班角色先从塔体抽离；这样下一只的最高分搜索不会把临时角色
      // 当成永久塔基，同时屏幕上仍保留其逃回雇佣池的跑路动画。
      releaseOvertimeWorkers(now);
      // 生长队列每帧至多落一只，避免同帧大量生成造成物理解算尖峰。
      spawnGeneratedWorker(now);
      // 加班时间优先于运输机：剩余雇佣池每秒自动跳下一只。
      const overtimeActive = spawnOvertimeWorker(now);
      // 机上补货（空投 RELOAD_MS 后）。
      if (
        !overtimeActive &&
        carriedRef.current == null &&
        now >= plane.reloadAt &&
        bodiesRef.current.size < MAX_PILE &&
        ownedRef.current.length > 0
      ) {
        spawnCarried();
      }

      // 落体物理：重力(+rogue 大风) → 墙 → 前景桌面板（圆-AABB） → 已落定宠物
      // （圆形碰撞） → 地面 → 落定判定。
      const rg = rogueRef.current;
      const windAx = rg != null ? rg.windAx() : 0; // 大风日横向加速度（px/s²）
      const bodies = bodiesRef.current;
      let settledThisFrame = false;
      const rolledOff: Body[] = []; // rogue：弹开后滚出场外的（循环后统一移除上报）
      const deserted: Body[] = []; // rogue：落到地面 → 直接溜走（等同罢工，循环后转跑路者）
      bodies.forEach((b) => {
        if (b.settled) return;
        if (b.overtimeJump != null) {
          const jump = b.overtimeJump;
          const t = clamp((now - jump.startedAt) / Math.max(1, jump.landsAt - jump.startedAt), 0, 1);
          const eased = 1 - Math.pow(1 - t, 2);
          b.x = jump.fromX + (jump.toX - jump.fromX) * eased;
          b.y = jump.fromY + (jump.toY - jump.fromY) * eased - Math.sin(Math.PI * t) * 150;
          if (t >= 1) {
            b.x = jump.toX;
            b.y = jump.toY;
            b.settled = true;
            b.stuck = true;
            b.settledAt = now;
            b.vx = 0;
            b.vy = 0;
            b.overtimeJump = undefined;
            settledThisFrame = true;
            const outer = outerRefs.current.get(b.uid);
            if (outer) outer.classList.remove("is-overtime-jumping");
            const inner = innerRefs.current.get(b.uid);
            if (inner) inner.classList.add("fac-stick-pop");
          }
          const outer = outerRefs.current.get(b.uid);
          if (outer) {
            outer.style.transform = `translate3d(${b.x - PET_SIZE / 2}px, ${b.y + b.r - PET_SIZE * FEET_RATIO}px, 0)`;
            outer.style.zIndex = String(1000 + Math.round(b.y));
          }
          return;
        }
        b.vy += GRAVITY * dt;
        if (windAx !== 0) b.vx += windAx * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        // 支撑来源：只有地面提供普通落定支撑；桌面是属性工位——属性对上在
        // 碰撞环节即时粘附，不合直接弹飞（桌面不再是通用支撑面）。
        let support: "ground" | null = null;

        // rogue：吃过弹开的宠解除墙壁钳制,允许一路滚出场外（返还名额,本班缺席）；
        // 完全出屏即从物理堆移除并上报 rolloff。demo/未弹开的照旧被墙拦住。
        const freeRoll = rg != null && b.bounced === true;
        if (freeRoll && (b.x + b.r < -12 || b.x - b.r > sc.w + 12)) {
          rolledOff.push(b);
          return;
        }
        const sideInset = WALL_PAD + Math.max(b.r, PET_VISUAL_HALF_W);
        const wallL = sideInset;
        const wallR = sc.w - sideInset;
        if (!freeRoll) {
          if (b.x < wallL) {
            b.x = wallL;
            if (b.vx < 0) b.vx = -b.vx * 0.55;
          } else if (b.x > wallR) {
            b.x = wallR;
            if (b.vx > 0) b.vx = -b.vx * 0.55;
          }
        }

        // 前景桌面板：落下/反弹都被挡。顶面≈地面（弹跳/滚动摩擦，可落定），
        // 侧面/底面反弹弹开。
        for (const o of obstaclesRef.current) {
          const cx = clamp(b.x, o.x, o.x + o.w);
          const cy = clamp(b.y, o.y, o.y + o.h);
          const dx = b.x - cx;
          const dy = b.y - cy;
          const d2 = dx * dx + dy * dy;
          if (d2 >= b.r * b.r) continue;
          let nx = 0;
          let ny = -1;
          if (d2 > 1e-6) {
            const d = Math.sqrt(d2);
            nx = dx / d;
            ny = dy / d;
            b.x = cx + nx * b.r;
            b.y = cy + ny * b.r;
          } else {
            // 圆心穿进板内（板薄，基本只可能是高速下落）：往上顶出。
            b.y = o.y - b.r;
          }
          const vn = b.vx * nx + b.vy * ny;
          if (ny < -0.7) {
            // 桌面顶 = 属性工位：属性对上 → 不弹跳，Q 弹压缩直接粘在桌面上；
            // 属性不合 → 桌面也坐不住，结结实实弹飞（不给支撑）。
            const match = o.element != null && b.elements.includes(o.element);
            if (match) {
              b.y = o.y - b.r;
              b.settled = true;
              b.stuck = true;
              b.settledAt = now;
              b.vx = 0;
              b.vy = 0;
              settledThisFrame = true;
              statsRef.current.deskSticks += 1;
              const inner = innerRefs.current.get(b.uid);
              if (inner) inner.classList.add("fac-stick-pop"); // Q 弹压缩动画（一次性）
              const outer = outerRefs.current.get(b.uid);
              if (outer) outer.dataset.stuck = "1";
              break;
            }
            if (vn < 0) {
              const tx = -ny;
              const ty = nx;
              let vt = b.vx * tx + b.vy * ty;
              vt *= Math.exp(-2 * dt);
              const bounced = Math.max(-vn * REST_MISMATCH, MISMATCH_POP);
              b.vx = nx * bounced + tx * vt;
              b.vy = ny * bounced + ty * vt;
              if (-vn > 150) b.squashUntil = now + 110;
              b.bounced = true; // 属性不合弹开：解除墙钳,允许滚出场外（rogue）
              statsRef.current.deskRejects += 1;
            }
          } else if (vn < 0) {
            // 侧面/底面：反弹。
            b.vx -= (1 + 0.55) * vn * nx;
            b.vy -= (1 + 0.55) * vn * ny;
            if (-vn > 150) b.squashUntil = now + 110;
          }
        }

        bodies.forEach((s) => {
          if (!s.settled || b.settled) return;
          const dx = b.x - s.x;
          const dy = b.y - s.y;
          const rr = b.r + s.r;
          const d2 = dx * dx + dy * dy;
          if (d2 >= rr * rr) return;
          const d = Math.sqrt(d2) || 0.001;
          const nx = dx / d;
          const ny = dy / d;
          // 推出重叠，落在对方外形的接触点上。
          b.x = s.x + nx * rr;
          b.y = s.y + ny * rr;
          const vn = b.vx * nx + b.vy * ny;
          // 属性配对：有交集 → Q 弹压缩后当场粘住（成为地形）；无交集 → 弹走。
          // rogue 粘连覆写（万金油/泥石流）：桥先裁决,null 才走默认交集。
          let match = b.elements.some((element) => s.elements.includes(element));
          if (rg?.stickOverride != null) {
            const override = rg.stickOverride(
              {
                uid: b.uid,
                species: b.species,
                elements: b.elements,
                x: b.x,
                y: b.y,
                r: b.r,
                settled: b.settled,
                fromCollapse: b.fromCollapse === true,
              },
              {
                uid: s.uid,
                species: s.species,
                elements: s.elements,
                x: s.x,
                y: s.y,
                r: s.r,
                settled: s.settled,
                fromCollapse: s.fromCollapse === true,
              },
            );
            if (override != null) match = override;
          }
          if (match && b.y >= SETTLE_MIN_Y) {
            // 地面级的侧面挤撞可能把接触点解析到地板线以下——粘住前把脚钳回地面。
            b.y = Math.min(b.y, groundY - b.r);
            b.settled = true;
            b.stuck = true;
            b.settledAt = now;
            b.vx = 0;
            b.vy = 0;
            settledThisFrame = true;
            statsRef.current.sticks += 1;
            const inner = innerRefs.current.get(b.uid);
            if (inner) inner.classList.add("fac-stick-pop"); // Q 弹压缩动画（一次性）
            const outer = outerRefs.current.get(b.uid);
            if (outer) outer.dataset.stuck = "1";
            return;
          }
          if (vn < 0) {
            // 弹走：保底反弹速度，凹槽里也能弹出去；不给支撑（异属性身上坐不住）。
            const tx = -ny;
            const ty = nx;
            let vt = b.vx * tx + b.vy * ty;
            vt *= Math.exp(-2 * dt);
            const bounced = Math.max(-vn * REST_MISMATCH, MISMATCH_POP);
            b.vx = nx * bounced + tx * vt;
            b.vy = ny * bounced + ty * vt;
            if (-vn > 150) b.squashUntil = now + 110;
            b.bounced = true; // 属性不合弹开：解除墙钳,允许滚出场外（rogue）
            statsRef.current.rejects += 1;
            // 被砸的那只嫌弃地晃一下（重击才晃）：DOM 宽限期走 CSS 一次性动画，
            // 已转画布的走绘制侧 wobbleAt 旋转 tween。
            if (-vn > 200) {
              s.wobbleAt = now;
              const hitInner = innerRefs.current.get(s.uid);
              if (hitInner) {
                hitInner.classList.remove("fac-reject-wob");
                void hitInner.offsetWidth; // 强制重排以重播一次性动画
                hitInner.classList.add("fac-reject-wob");
              }
            }
          }
        });

        if (!b.settled) {
          if (b.y + b.r > groundY) {
            b.y = groundY - b.r;
            support = "ground";
            if (b.vy > 0) {
              if (b.vy > 230) {
                b.vy = -b.vy * REST_GROUND;
                b.vx *= 0.8;
                b.squashUntil = now + 110;
              } else {
                b.vy = 0;
              }
            }
            b.vx *= Math.exp(-6 * dt); // 地面滚动摩擦
          }

          // 落定 = 地面托住 + 低速（桌面/同属性宠的粘附都在碰撞环节即时发生）。
          const speed = Math.hypot(b.vx, b.vy);
          const age = now - b.bornAt;
          const timedOut = age > MAX_AIR_MS;
          if ((support === "ground" && speed < SETTLE_SPEED && age > MIN_AIR_MS) || timedOut) {
            if (timedOut) b.y = groundY - b.r;
            if (rg != null) {
              // rogue 新规则：落到地面(没粘上任何桌/宠)的宠**直接溜走消失**——等同罢工。
              // 不再当死重堆在地上;循环后转成跑路者立即走人,出屏按 rolloff 记账(名额回收
              // + 本班缺席)。桌上/宠身上的粘附都在上面的碰撞环节即时发生,到不了这里。
              b.y = groundY - b.r;
              deserted.push(b);
              return;
            }
            // demo：物理兜底（弹了太久还没停）→ 直接收到地面再落定，保持演示行为不变。
            b.settled = true;
            b.settledAt = now;
            b.vx = 0;
            b.vy = 0;
            settledThisFrame = true;
          }
        }

        const outer = outerRefs.current.get(b.uid);
        if (outer) {
          outer.style.transform = `translate3d(${b.x - PET_SIZE / 2}px, ${b.y + b.r - PET_SIZE * FEET_RATIO}px, 0)`;
          outer.style.zIndex = String(1000 + Math.round(b.y));
        }
        const inner = innerRefs.current.get(b.uid);
        if (inner) {
          if (!b.settled) {
            if (now < b.squashUntil) {
              inner.style.transform = "scale(1.22, 0.76)"; // 撞击压扁
            } else {
              const stretch = Math.min(1.16, 1 + Math.abs(b.vy) / 3200); // 速度拉伸
              inner.style.transform = `scale(${(1 / stretch).toFixed(3)}, ${stretch.toFixed(3)})`;
            }
          } else if (inner.style.transform !== "") {
            // 落定当帧：把空中冻结的拉伸/撞击形变平滑放回原始大小（is-set 0.3s 过渡），
            // 演完 drop/Q 弹再交给画布做打工与重量压扁——不再「扁着定格→突然弹直」。
            inner.classList.add("is-set");
            inner.style.transform = "";
          }
        }
      });

      // 永久冻结同时覆盖两条渲染路径：
      // 1) 生长宠物落体/落定宽限期仍在 DOM；2) 宽限期后交给 Canvas。
      // 角色、冰块都读取同一个 rAF 时钟和同一个 bob 值，避免相位与位置追踪错开。
      bodies.forEach((b) => {
        if (rg?.isBodyFrozen?.(b.uid) !== true) return;
        const frozenBob = frozenBobAt(now);
        if (b.frozenAt == null) {
          b.frozenAt = now;
          b.frozenFrame = b.inDom
            ? 0
            : Math.floor((((now + b.animPhase) % WORK_CYCLE_MS) / WORK_CYCLE_MS) * FRAME_COUNT) % FRAME_COUNT;
        }
        rg.positionBodyState?.(b.uid, b.x, b.y, frozenBob);
        if (!b.inDom) return;
        const outer = outerRefs.current.get(b.uid);
        if (outer != null) {
          outer.style.transform =
            `translate3d(${b.x - PET_SIZE / 2}px, ${b.y + b.r - PET_SIZE * FEET_RATIO + frozenBob}px, 0)`;
        }
        const inner = innerRefs.current.get(b.uid);
        if (inner != null) {
          inner.classList.add("fac-frozen");
          inner.classList.remove("fac-stick-pop", "fac-reject-wob");
          inner.style.transform = "";
        }
      });

      // rogue：滚出场外的弹开宠——移除物理体 + 上报（弹开确定 → 名额回收）。
      if (rolledOff.length > 0 && rg != null) {
        const goneIds = new Set<number>();
        for (const b of rolledOff) {
          if (b.rogueReported !== true) {
            b.rogueReported = true;
            // Report while the physical snapshot still owns the body so the
            // failure layer can capture an exact exit position before removal.
            rg.onBounced(b.uid, b.species); // 出场也是「弹开确定」：清连击/回流退款
          }
          bodies.delete(b.uid);
          goneIds.add(b.uid);
          rg.onGone(b.uid, "rolloff");
        }
        setPets((prev) => prev.filter((p) => !goneIds.has(p.uid)));
        setPileCount(bodies.size);
      }

      // rogue：落地宠 → 立即转跑路者溜走（无抗议相位；出屏时按 rolloff 记账）。
      if (deserted.length > 0 && rg != null) {
        const goneIds = new Set<number>();
        const added: RunnerUi[] = [];
        for (const b of deserted) {
          if (b.rogueReported !== true) {
            b.rogueReported = true;
            // Capture the miss before moving this body out of the physics map;
            // otherwise the most common first-drop failure has no visible cue.
            rg.onBounced(b.uid, b.species);
          }
          bodies.delete(b.uid);
          goneIds.add(b.uid);
          const dir: 1 | -1 = b.x < sc.w / 2 ? -1 : 1;
          runnersRef.current.set(b.uid, {
            uid: b.uid,
            species: b.species,
            x: b.x,
            y: b.y,
            r: b.r,
            vy: 0,
            dir,
            phase: "run", // 直接走人,不举牌
            until: now,
            reason: "desert",
          });
          added.push({ uid: b.uid, species: b.species, phase: "run", dir });
        }
        setPets((prev) => prev.filter((p) => !goneIds.has(p.uid)));
        setRunners((prev) => [...prev, ...added]);
        setPileCount(bodies.size);
      }

      if (settledThisFrame) {
        reportRogueSettles(); // 先结脉冲（onSettled/onBounced）,再进罢工检测
        commitSettled();
      }

      // DOM→画布换装：宽限期满（drop/Q 弹演完）且图集就绪的落定宠卸载活体节点。
      const toRemove = new Set<number>();
      bodies.forEach((b) => {
        if (!b.settled || !b.inDom) return;
        if (now - b.settledAt < SWAP_GRACE_MS) return;
        if (!atlasRef.current.get(b.species)?.ready) return;
        b.inDom = false;
        toRemove.add(b.uid);
      });
      if (toRemove.size > 0) {
        setPets((prev) => prev.filter((p) => !toRemove.has(p.uid)));
      }

      // 罢工/解雇跑路者推进：strike 到点转 run；run 水平冲刺，跑离桌沿后坠到
      // 下一层承接面（下层桌/地面），跑出屏幕即移除。
      if (runnersRef.current.size > 0) {
        const done = new Set<number>();
        const flips = new Set<number>();
        runnersRef.current.forEach((r) => {
          if (r.phase === "strike") {
            if (now >= r.until) {
              r.phase = "run";
              flips.add(r.uid);
            }
          } else {
            r.x += r.dir * RUN_SPEED * dt;
            // 当前脚下的承接面：只认脚底同高或更低的表面（高处的板不算）。
            const feet = r.y + r.r;
            let floor = groundY;
            for (const o of obstaclesRef.current) {
              if (r.x >= o.x && r.x <= o.x + o.w && o.y >= feet - 4 && o.y < floor) floor = o.y;
            }
            if (feet < floor - 1) {
              r.vy += GRAVITY * dt;
              r.y += r.vy * dt;
              if (r.y + r.r >= floor) {
                r.y = floor - r.r;
                r.vy = 0;
              }
            } else {
              r.y = floor - r.r;
            }
            if (r.x < -PET_SIZE || r.x > sc.w + PET_SIZE) done.add(r.uid);
          }
          const el = runnerElRefs.current.get(r.uid);
          if (el) {
            el.style.transform = `translate3d(${r.x - PET_SIZE / 2}px, ${r.y + r.r - PET_SIZE * FEET_RATIO}px, 0)`;
          }
        });
        if (done.size > 0) {
          done.forEach((id) => {
            // rogue：跑路者出屏 = 正式离场（罢工/解雇按 reason 区分,名额回收）。
            const runner = runnersRef.current.get(id);
            // desert(落地溜走)按 rolloff 记账 = 单只罢工:名额回收 + 本班缺席。
            if (rg != null && runner != null) {
              rg.onGone(id, runner.reason === "desert" ? "rolloff" : runner.reason);
            }
            runnersRef.current.delete(id);
          });
        }
        if (done.size > 0 || flips.size > 0) {
          setRunners((prev) =>
            prev
              .filter((p) => !done.has(p.uid))
              .map((p) => (flips.has(p.uid) ? { ...p, phase: "run" as RunnerPhase } : p)),
          );
        }
      }

      if (now >= nextPathSleepAudit) {
        nextPathSleepAudit = now + PATH_SLEEP_AUDIT_MS;
        const next = new Set(rg?.sleepingPathUids?.() ?? []);
        const current = sleepingPathUidsRef.current;
        const changed =
          next.size !== current.size || [...next].some((uid) => !current.has(uid));
        if (changed) {
          sleepingPathUidsRef.current = next;
          setSleepingPathUids(next);
        }
      }

      const pileFrameMs = bodies.size >= PILE_CROWDED_COUNT
        ? PILE_CROWDED_FRAME_MS
        : bodies.size >= PILE_BUSY_COUNT
          ? PILE_BUSY_FRAME_MS
          : PILE_BASE_FRAME_MS;
      if (now >= nextPileDraw) {
        const pileDt = Math.min(0.1, Math.max(dt, (now - lastPileDraw) / 1000));
        drawPile(now, pileDt);
        lastPileDraw = now;
        nextPileDraw = now + pileFrameMs;
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [
    commitSettled,
    ensureAtlas,
    paused,
    releaseOvertimeWorkers,
    reportRogueSettles,
    spawnCarried,
    spawnGeneratedWorker,
    spawnOvertimeWorker,
  ]);

  // 空格 = 空投（与点击等价）。
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      event.preventDefault();
      dropCarried();
    };
    window.addEventListener("keydown", onKey);
    let unlisten: (() => void) | undefined;
    void listen("factory://drop", () => {
      // 前台 keydown 已经处理时不重复；后台/其他应用获焦时由系统钩子补发。
      if (!document.hasFocus()) dropCarried();
    }).then((fn) => { unlisten = fn; }).catch(() => {});
    return () => {
      window.removeEventListener("keydown", onKey);
      unlisten?.();
    };
  }, [dropCarried]);

  const registerOuter = useCallback((uid: number, el: HTMLDivElement | null) => {
    if (el == null) {
      outerRefs.current.delete(uid);
      return;
    }
    outerRefs.current.set(uid, el);
    // 挂载当帧就摆到位，避免 (0,0) 闪一帧。
    const b = bodiesRef.current.get(uid);
    if (b) {
      el.style.transform = `translate3d(${b.x - PET_SIZE / 2}px, ${b.y + b.r - PET_SIZE * FEET_RATIO}px, 0)`;
      el.style.zIndex = String(1000 + Math.round(b.y));
      el.dataset.elements = b.elements.join(","); // 预览校验/调试用
      el.classList.toggle("is-overtime-jumping", b.overtimeJump != null);
    }
  }, []);

  const registerInner = useCallback((uid: number, el: HTMLDivElement | null) => {
    if (el == null) {
      innerRefs.current.delete(uid);
      return;
    }
    innerRefs.current.set(uid, el);
  }, []);

  const registerRunner = useCallback((uid: number, el: HTMLDivElement | null) => {
    if (el == null) {
      runnerElRefs.current.delete(uid);
      return;
    }
    runnerElRefs.current.set(uid, el);
    // 挂载当帧就摆到位（从物理堆原位无缝接管），避免 (0,0) 闪一帧。
    const r = runnersRef.current.get(uid);
    if (r) {
      el.style.transform = `translate3d(${r.x - PET_SIZE / 2}px, ${r.y + r.r - PET_SIZE * FEET_RATIO}px, 0)`;
    }
  }, []);

  const hasPets = save.pets.length > 0;
  const groundY = sceneSize.h - FLOOR_H;

  return (
    <div
      ref={rootRef}
      className={`fac-stage${paused ? " is-paused" : ""}${sceneDimActive ? " is-spotlighting" : ""}${sceneDimRestoring ? " is-spotlight-restoring" : ""}${failedPet != null ? " is-connect-failed" : ""}`}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        // 点中已落定宠 → 解雇；点空处 → 空投。命中按物理圆判（比 DOM 盒贴外形），
        // 多只重叠时优先前排（y 更大、画得更靠上层的那只）。
        const rect = rootRef.current?.getBoundingClientRect();
        const px = event.clientX - (rect?.left ?? 0);
        const py = event.clientY - (rect?.top ?? 0);
        let hit: Body | null = null;
        for (const b of bodiesRef.current.values()) {
          if (!b.settled) continue;
          const dx = px - b.x;
          const dy = py - b.y;
          if (dx * dx + dy * dy > b.r * b.r * 1.69) continue; // r×1.3：立绘比物理圆略宽
          if (hit == null || b.y > hit.y) hit = b;
        }
        if (hit != null) {
          const rg = rogueRef.current;
          if (rg != null) {
            // rogue：点落定宠默认无操作（解雇是商店卡的点选模式）；点空处才空投。
            if (rg.clickMode() === "dismiss") {
              rg.onDismissPick(hit.uid);
              fireBody(hit.uid, "dismiss");
            }
            return;
          }
          fireBody(hit.uid);
          return;
        }
        dropCarried();
      }}
    >
      {/* 天上的慢云（纯装饰） */}
      <div className="fac-cloud fac-cloud-a" aria-hidden="true" />
      <div className="fac-cloud fac-cloud-b" aria-hidden="true" />

      {/* 底部办公室布景（背景层：远景厂房剪影 + 近景错落屋脊墙 + 道具簇，不碰撞） */}
      <OfficeBackdrop width={sceneSize.w} />

      {/* 前景：六张属性打工桌（桌面板 = 碰撞体；桌上道具纯装饰）。机上挂着
          同属性宠时整桌亮呼吸提示：往这儿丢直接粘住。 */}
      {desks.map((d) => (
        <DeskArt
          key={d.element}
          desk={d}
          groundY={groundY}
          color={config.elements[d.element]?.color ?? "#B07B44"}
          badge={config.elements[d.element]?.badge ?? "star"}
          label={fmt(T.fa.deskAria, { name: elementName(d.element, lang) })}
          name={elementName(d.element, lang)}
          // 载宠属性配对呼吸光（提示下一只宠往哪丢）。结算聚光期(deskSpot!=null)一律
          // 关掉它——否则机上「下一只宠」的属性桌会和真正的「得分桌」抢镜(is-ready 的
          // 动画 filter 会盖过 is-score-dim 的压暗),让人误以为亮的是下一只宠的桌。
          highlight={
            deskSpot == null
            && carriedElems != null
            && carriedElems.includes(d.element)
            && rogue?.disabledDesks?.includes(d.element as never) !== true
          }
          carriedDim={
            deskSpot == null
            && carriedElems != null
            && !carriedElems.includes(d.element)
            && rogue?.disabledDesks?.includes(d.element as never) !== true
          }
          scoreState={deskSpot == null ? null : deskSpot.has(d.element) ? "hot" : "dim"}
          disabled={rogue?.disabledDesks?.includes(d.element as never) === true}
          disabledLabel={FACTORY_ROGUE[lang].disabledDeskStamp}
        />
      ))}

      {rogue?.showDropGuide?.() === true && carried != null && (
        <div
          ref={dropGuideElRef}
          className="fac-drop-guide"
          data-state="wait"
          aria-hidden="true"
        />
      )}

      {/* 前景小装饰物（纸箱/雪糕筒/盆栽/扫帚水桶/木托盘——纯装饰零碰撞，
          压在打工山之上读作最前景） */}
      <ForegroundDecor desks={desks} width={sceneSize.w} groundY={groundY} />

      {/* 打工山画布（批量渲染层）：全部已落定宠在此逐帧 drawImage。
          pointer-events:none —— 点击/穿透判定分别由舞台冒泡与 registerHitRegion
          的物理圆负责，画布自身不参与命中。 */}
      <canvas ref={pileCanvasRef} className="fac-pile-canvas" aria-hidden="true" />

      {/* 活体宠物：空投中 + 落定宽限期内（之后卸载、转入上面的画布） */}
      {pets.map((p) => (
        <FactoryPetNode
          key={p.uid}
          uid={p.uid}
          species={p.species}
          landed={p.landed}
          frozen={rogue?.isBodyFrozen?.(p.uid) === true}
          pathSleeping={sleepingPathUids.has(p.uid)}
          overtimeJumping={bodiesRef.current.get(p.uid)?.overtimeJump != null}
          config={config}
          registerOuter={registerOuter}
          registerInner={registerInner}
        />
      ))}

      {/* N1 结算聚光：2s 把**场景绘制层压暗**（由 .fac-stage.is-spotlighting 的 CSS
          压暗办公室/桌/宠/装饰，透明天空无像素 → 桌面原样透出，不动）。得分宠、
          被吸取宠与本次效果涉及的宠都在压暗层之上保持彩色；仅前八只重演打工，
          其余使用静态打工帧。 */}
      {assimilationFx.length > 0 && (
        <div className="fac-assimilation-layer" aria-hidden="true">
          {assimilationFx.map((item) => (
            <div
              key={item.id}
              className="fac-assimilation"
              style={{
                left: item.x - PET_SIZE / 2,
                top: item.y + item.r - PET_SIZE * FEET_RATIO,
                width: PET_SIZE,
                height: PET_SIZE,
              }}
              onAnimationEnd={(event) => {
                if (event.target !== event.currentTarget) return;
                setAssimilationFx((previous) => previous.filter((fx) => fx.id !== item.id));
              }}
            >
              <div className="fac-assimilation-form fac-assimilation-from">
                <SvgSprite
                  species={item.fromSpecies}
                  config={config}
                  petState="laboring"
                  className="fac-pet-sprite"
                />
              </div>
              <div className="fac-assimilation-form fac-assimilation-to">
                <SvgSprite
                  species={item.toSpecies}
                  config={config}
                  petState="laboring"
                  className="fac-pet-sprite"
                />
              </div>
              <div className="fac-assimilation-bubble">
                <i />
                <i />
                <i />
              </div>
            </div>
          ))}
        </div>
      )}

      {spotActive && (
        <>
          <div className="fac-hero-layer" aria-hidden="true">
            {heroPets.map((hpet) => (
              <div
                key={hpet.animated ? `${hpet.uid}-${heroWave}` : hpet.uid}
                className={`fac-hero-pet${hpet.animated ? "" : " is-static"}`}
                style={{
                  left: hpet.x - PET_SIZE / 2,
                  top: hpet.y + hpet.r - PET_SIZE * FEET_RATIO,
                  width: PET_SIZE,
                  height: PET_SIZE,
                }}
              >
                <div
                  className="fac-hero-pet-scale"
                  style={{ transform: `scale(${hpet.scale})` }}
                >
                  <SvgSprite species={hpet.species} config={config} petState="laboring" className="fac-pet-sprite" />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {failedPet != null && (
        <div className="fac-failure-layer" aria-live="assertive">
          <div
            className="fac-failure-pet"
            style={{
              left: failedPet.x - PET_SIZE / 2,
              top: failedPet.y + failedPet.r - PET_SIZE * FEET_RATIO,
              width: PET_SIZE,
              height: PET_SIZE,
              "--fac-failure-anchor-x": `${failedPet.x}px`,
            } as CSSProperties}
          >
            <SvgSprite species={failedPet.species} config={config} petState="error" className="fac-pet-sprite" />
            <div className="fac-failure-text" lang={lang}>{failedPet.text}</div>
          </div>
        </div>
      )}

      {/* 罢工/解雇跑路者：先原地跺脚举牌抗议（error 骨骼），再转身冲出屏幕 */}
      {runners.map((r) => (
        <div
          key={r.uid}
          className={`fac-runner ${r.phase === "strike" ? "fac-runner-strike" : "fac-runner-run"}`}
          ref={(el) => registerRunner(r.uid, el)}
          style={{ width: PET_SIZE, height: PET_SIZE }}
        >
          <div className="fac-runner-flip" style={r.phase === "run" && r.dir === -1 ? { transform: "scaleX(-1)" } : undefined}>
            <div className="fac-runner-anim">
              <SvgSprite
                species={r.species}
                config={config}
                petState={r.phase === "strike" ? "error" : "moving"}
                className="fac-pet-sprite"
              />
            </div>
          </div>
          {r.phase === "strike" && <div className="fac-strike-sign">{r.sign ?? T.fa.strikeSign}</div>}
        </div>
      ))}

      {/* 运输机 + 吊挂宠物（transform 由 rAF 驱动） */}
      <div
        className="fac-plane"
        ref={planeElRef}
        style={{ width: PLANE_W }}
        role="img"
        aria-label={T.fa.planeAria}
        data-coach={coachTarget}
      >
        <PlaneArt />
        <div className="fac-hang-rig" style={{ left: PLANE_W / 2 }}>
          <span className="fac-rope" aria-hidden="true" />
          {carried && (
            <div className="fac-hang" ref={hangElRef} style={{ width: PET_SIZE, height: PET_SIZE }}>
              <SvgSprite species={carried.species} config={config} petState="dragging" className="fac-pet-sprite" />
            </div>
          )}
        </div>
      </div>

      {/* HUD 双立柱（设计定稿 6a）：左柱经营 / 右柱资源，顶部中央留空给运输机。
          纯展示层，数据全靠 hud prop；rogue 模式让位给 RogueHud，绝不叠两套。 */}
      {rogue == null && hudData != null && (
        <FactoryHudPosts
          data={hudData}
          config={config}
          labels={{
            revenue: FACTORY_ROGUE[lang].hudRevenue,
            kpi: FACTORY_ROGUE[lang].hudKpi,
            bagEmpty: FACTORY_ROGUE[lang].hudBagEmpty,
            cash: FACTORY_ROGUE[lang].hudCash,
            quota: FACTORY_ROGUE[lang].hudQuota,
            back: FACTORY_ROGUE[lang].hudBack,
            workPerformance: FACTORY_ROGUE[lang].loBaseValue.replace(" {n}", ""),
            exploitationCount: FACTORY_ROGUE[lang].loReach.replace(" {n}", ""),
          }}
          onExit={onBack}
        />
      )}

      {/* HUD：左下角木牌簇（与后院左下底栏同位），返回 / 标题 / 计数。
          rogue 模式整簇隐藏（RogueHud 全权接管返回/计数/账务显示），提示同理。 */}
      {rogue == null && (
        <div className="fac-hud" onPointerDown={(event) => event.stopPropagation()}>
          <button
            type="button"
            className="fac-chip fac-back"
            title={T.fa.backTitle}
            onClick={(event) => {
              event.stopPropagation();
              onBack();
            }}
          >
            {T.fa.backBtn}
          </button>
          <div className="fac-chip fac-title" aria-hidden="true">
            🏭 {T.fa.title}
          </div>
          {pileCount > 0 && (
            <div className="fac-chip fac-count">{fmt(T.fa.working, { n: pileCount })}</div>
          )}
        </div>
      )}
      {rogue == null &&
        (!hasPets ? (
          <div className="fac-hint">{T.fa.empty}</div>
        ) : (
          !hintGone && (
            <div className="fac-hint">
              {T.fa.hint}
              <span className="fac-hint-sub">{T.fa.hintMatch}</span>
              <span className="fac-hint-sub">{T.fa.hintFire}</span>
            </div>
          )
        ))}
      {fullMsg > 0 && (
        <div className="fac-toast" key={fullMsg}>
          {T.fa.full}
        </div>
      )}
    </div>
  );
}

/* ============================================================================
 *  以下为工厂场景美术层（设计定稿：Claude Design「工厂打工 场景风格探索」7a
 *  「元素桌工厂」）。全部纯代码 SVG，无外部图片。
 *
 *  分层（自后向前）＝ 桌面壁纸（应用透明区）→ 窗外远景（半透明窗）→ 背景墙
 *  （不透明）→ 中景家具（实色淡彩·无描边）→ 地板 → 前景（六张元素桌 / 障碍物
 *  / 打工山）→ HUD。
 *
 *  前后景分离原则：**可交互 = 2.5–3.6px 深色描边 + 投影；不可交互 = 无描边、
 *  低饱和**。中景家具因此一律实色平涂不描边——在透明置顶窗上「半透明」会把桌面
 *  透成鬼影，所以「更远」全靠取色，不靠 opacity。
 * ========================================================================== */

const INK = "#3B2B1D";
/** 设计令牌（7a）：描边 / 木色 / 奶油金 / 墙面。 */
const INK_WOOD = "#4A3318";
const CREAM = "#FFF7DC";
const WALL_FILL = "#EAE0CB";
const WAINSCOT = "#E2D6BC";
const SKIRTING = "#DBCFB2";
/** 元素桌配色（每张桌的「剪影 = 元素」，看形状不用读字）。 */
const DESK_SKIN: Record<
  string,
  { slab: [string, string]; stroke: string; text: string; sign: string }
> = {
  grass: { slab: ["#C08A4E", "#A06A33"], stroke: "#3B5B23", text: "#3B5B23", sign: "#3B5B23" },
  fire: { slab: ["#E85D3A", "#B03A08"], stroke: "#7A2B12", text: "#B03A08", sign: "#7A2B12" },
  electric: { slab: ["#F7C531", "#E0AC17"], stroke: INK_WOOD, text: "#8A6410", sign: INK_WOOD },
  water: { slab: ["#7BBEE8", "#4B94CE"], stroke: "#1E5688", text: "#1E5688", sign: "#1E5688" },
  ice: { slab: ["#EAF8FC", "#C9EAF4"], stroke: "#5FA8BE", text: "#2A7A96", sign: "#5FA8BE" },
  normal: { slab: ["#C9CFD2", "#AEB4B8"], stroke: INK_WOOD, text: "#5A5A64", sign: INK_WOOD },
};
const DEFAULT_SKIN = DESK_SKIN.normal;

function PlaneArt() {
  return (
    <svg className="fac-plane-art" viewBox="0 0 190 64" aria-hidden="true">
      {/* 尾翼 */}
      <path d="M24 26 L34 5 Q36 2 40 4 L48 24 Z" fill="#D95B4A" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
      <rect x={10} y={24} width={30} height={9} rx={4.5} fill="#E9705F" stroke={INK} strokeWidth={4} />
      {/* 机身 */}
      <rect x={22} y={16} width={148} height={38} rx={19} fill="#D95B4A" stroke={INK} strokeWidth={4} />
      <path d="M40 40 Q96 52 164 42 L164 50 Q100 60 40 48 Z" fill="#FFF3D9" stroke="none" opacity={0.9} />
      {/* 舷窗 + 驾驶舱 */}
      <circle cx={70} cy={30} r={6} fill="#9BDCFF" stroke={INK} strokeWidth={3.4} />
      <circle cx={94} cy={30} r={6} fill="#9BDCFF" stroke={INK} strokeWidth={3.4} />
      <path d="M132 18 Q150 18 156 30 L132 30 Z" fill="#9BDCFF" stroke={INK} strokeWidth={3.6} strokeLinejoin="round" />
      {/* 机翼 */}
      <rect x={78} y={34} width={58} height={12} rx={6} fill="#B84A3E" stroke={INK} strokeWidth={4} transform="rotate(6 107 40)" />
      {/* 机鼻 + 螺旋桨 */}
      <circle cx={170} cy={35} r={11} fill="#FFF3D9" stroke={INK} strokeWidth={4} />
      <g className="fac-prop">
        <ellipse cx={181} cy={35} rx={3.2} ry={24} fill="#8A6B45" stroke={INK} strokeWidth={2.6} />
      </g>
      <circle cx={181} cy={35} r={4.6} fill="#FFD93B" stroke={INK} strokeWidth={3} />
      {/* 机腹吊钩座 */}
      <rect x={88} y={50} width={22} height={8} rx={3} fill="#8A6B45" stroke={INK} strokeWidth={3.4} />
    </svg>
  );
}

// ---- 背景（墙 + 中景家具 + 地板） -------------------------------------------

/** 中景家具（实色淡彩、**无描边**、低饱和）：沙发 / 公告板 / 货架 / 落地风扇 /
 *  纸杯塔 / 绿柜 / 绿植。全部站在地板顶线上，允许高过墙顶（那一截就是贴着桌面
 *  壁纸的平涂剪影——不透明，所以不会有鬼影）。 */
function MidSofa() {
  return (
    <g>
      <rect x={0} y={-153} width={448} height={153} rx={26} fill="#B9C7D3" />
      <rect x={0} y={-232} width={68} height={116} rx={20} fill="#ABBBC9" />
      <rect x={380} y={-232} width={68} height={116} rx={20} fill="#ABBBC9" />
      <rect x={80} y={-222} width={137} height={68} rx={15} fill="#C7D3DD" />
      <rect x={233} y={-222} width={137} height={68} rx={15} fill="#C7D3DD" />
      {/* 靠垫 */}
      <rect x={110} y={-206} width={52} height={48} rx={10} fill="#E5C4C4" />
    </g>
  );
}

function MidNoticeBoard() {
  return (
    <g>
      <rect x={58} y={-126} width={21} height={126} fill="#C4A18C" transform="rotate(7 68 -63)" />
      <rect x={179} y={-126} width={21} height={126} fill="#C4A18C" transform="rotate(-7 190 -63)" />
      <rect x={0} y={-331} width={263} height={205} rx={16} fill="#D9B6A3" />
      <rect x={21} y={-310} width={221} height={163} rx={10} fill="#EDE4D2" />
      <rect x={42} y={-292} width={58} height={68} rx={5} fill="#E8D98F" transform="rotate(-4 71 -258)" />
      <rect x={121} y={-282} width={63} height={79} rx={5} fill="#BFD3DE" transform="rotate(3 152 -242)" />
    </g>
  );
}

function MidShelf() {
  return (
    <g>
      <rect x={0} y={-453} width={395} height={453} rx={16} fill="#CFC7B8" />
      <rect x={37} y={-290} width={321} height={13} fill="#B8AE9B" />
      <rect x={37} y={-137} width={321} height={13} fill="#B8AE9B" />
      <rect x={68} y={-105} width={79} height={105} rx={8} fill="#BFD3DE" />
      <rect x={184} y={-105} width={68} height={84} rx={8} fill="#D9C48F" />
      <circle cx={124} cy={-243} r={45} fill="#C0CBB4" />
      <rect x={200} y={-278} width={63} height={74} rx={8} fill="#E5C4C4" />
      <rect x={78} y={-406} width={90} height={90} rx={10} fill="#BFD3DE" />
    </g>
  );
}

/** 落地风扇（罩 + 立杆 + 底座）。 */
function MidFan() {
  return (
    <g>
      <rect x={55} y={-253} width={18} height={253} fill="#B8A98C" />
      <rect x={0} y={-21} width={132} height={21} rx={10} fill="#B8A98C" />
      <circle cx={64} cy={-327} r={74} fill="#DDD5C4" />
      <circle cx={64} cy={-327} r={42} fill="#C2B693" />
    </g>
  );
}

/** 绿柜（矮文件柜 + 柜顶纸杯塔）。 */
function MidCabinet() {
  return (
    <g>
      <rect x={0} y={-374} width={342} height={374} rx={16} fill="#C0CBB4" />
      <rect x={32} y={-190} width={278} height={13} fill="#A9B69A" />
      <rect x={63} y={-268} width={74} height={90} rx={8} fill="#EDE4D2" />
      {/* 纸杯塔 */}
      <path d="M206 -374 h58 l-8 -47 h-42 Z" fill="#EDE4D2" />
      <path d="M212 -421 h46 l-7 -42 h-32 Z" fill="#E4DBC7" />
    </g>
  );
}

/** 大绿植（陶盆 + 双层绿球）。 */
function MidPlant() {
  return (
    <g>
      <rect x={42} y={-89} width={116} height={89} rx={12} fill="#C4A18C" />
      <ellipse cx={100} cy={-157} rx={100} ry={84} fill="#AFC2A0" />
      <ellipse cx={132} cy={-252} rx={50} ry={47} fill="#C1D2B2" />
    </g>
  );
}

/** 办公室背景（不参与碰撞）：背景墙 → 中景家具 → 地板。
 *  按屏宽等比铺开：家具以 FURN_PITCH 循环，护墙板/踢脚线/地板缝按固定节拍重复；
 *  散列抖动保证同一屏内每次进场一致。 */
function OfficeBackdrop({ width }: { width: number }) {
  const w = Math.max(width, 320);

  // 护墙板分格（120×40 @180 → 等比 264×88 @396）
  const panels: ReactNode[] = [];
  for (let x = 90; x < w - 40; x += 396) {
    panels.push(<rect key={x} x={x} y={FLOOR_TOP_Y - 146} width={264} height={88} rx={9} fill={WAINSCOT} />);
  }
  // 墙上插座 / 挂画（小填充物，交替）
  const wallBits: ReactNode[] = [];
  for (let x = 330, k = 0; x < w - 60; x += 792, k++) {
    wallBits.push(
      k % 2 === 0 ? (
        <rect key={x} x={x} y={FLOOR_TOP_Y - 184} width={44} height={22} rx={5} fill="#D0C2A0" />
      ) : (
        <g key={x}>
          <rect x={x} y={FLOOR_TOP_Y - 212} width={75} height={57} rx={7} fill="#D9B6A3" />
          <rect x={x + 9} y={FLOOR_TOP_Y - 203} width={57} height={39} rx={4} fill="#EDE4D2" />
        </g>
      ),
    );
  }
  // 墙面细竖纹（低对比，给平墙一点"护墙板贴面"质感）
  const grain: ReactNode[] = [];
  for (let x = 0; x < w; x += 350) {
    grain.push(<rect key={x} x={x} y={WALL_TOP_Y + 9} width={3} height={WALL_H - 9} fill="rgba(160,138,96,0.13)" />);
  }

  // 中景家具簇：六种循环 + 散列抖动横位。整体 0.7 缩放——家具按设计稿等比会长到
  // 墙高的 2 倍，在全工作区停靠的实机窗口里会糊成一片大色块；压到「最高刚过墙顶
  // 半个身位」才能既有纵深又不抢前景。
  const FURN_PITCH = 620;
  const FURN_S = 0.7;
  const furniture: ReactNode[] = [];
  for (let i = 0; i * FURN_PITCH < w + 200; i++) {
    const hash = (i * 2246822519) >>> 0;
    const fx = i * FURN_PITCH + 40 + ((hash % 81) - 40);
    const kind = i % 6;
    furniture.push(
      <g key={i} transform={`translate(${fx} ${FLOOR_TOP_Y}) scale(${FURN_S})`}>
        {kind === 0 && <MidSofa />}
        {kind === 1 && <MidNoticeBoard />}
        {kind === 2 && <MidShelf />}
        {kind === 3 && <MidFan />}
        {kind === 4 && <MidCabinet />}
        {kind === 5 && <MidPlant />}
      </g>,
    );
  }

  // 地板木条缝（设计稿 120 间距 → 等比 315）
  const seams: ReactNode[] = [];
  for (let x = 120; x < w; x += 315) {
    seams.push(<rect key={x} x={x} y={FLOOR_TOP_Y + 8} width={3} height={FLOOR_H - 8} fill="rgba(59,32,10,0.18)" />);
  }

  return (
    <svg
      className="fac-office"
      width={w}
      height={OFFICE_H}
      viewBox={`0 0 ${w} ${OFFICE_H}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="fac-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C7A876" />
          <stop offset="100%" stopColor="#A9814F" />
        </linearGradient>
      </defs>

      {/* ① 背景墙：不透明。顶边条 + 细竖纹 + 护墙板分格 + 插座/挂画 + 踢脚线 */}
      <rect x={0} y={WALL_TOP_Y} width={w} height={WALL_H} fill={WALL_FILL} />
      <rect x={0} y={WALL_TOP_Y} width={w} height={9} fill="#D9CBA8" />
      {grain}
      {panels}
      {wallBits}
      <rect x={0} y={FLOOR_TOP_Y - 31} width={w} height={31} fill={SKIRTING} />

      {/* ② 中景家具：实色淡彩、无描边、无 opacity（高过墙顶的部分 = 贴壁纸的平涂剪影） */}
      {furniture}

      {/* ③ 地板：木板条 + 深色顶边（前景桌/宠物都站在这条线上） */}
      <rect x={0} y={FLOOR_TOP_Y} width={w} height={FLOOR_H} fill="url(#fac-floor)" />
      <rect x={0} y={FLOOR_TOP_Y} width={w} height={8} fill={INK_WOOD} />
      {seams}
    </svg>
  );
}

// ---- 前景：六张元素桌 -------------------------------------------------------

/** 火苗（泪滴形），以 (0,0) 为焰底中心、向上 h 高。 */
const flamePath = (h: number) => {
  const r = h * 0.36;
  return `M0 0 C ${-r} ${-h * 0.28} ${-r * 1.06} ${-h * 0.72} 0 ${-h} C ${r * 1.06} ${-h * 0.72} ${r} ${-h * 0.28} 0 0 Z`;
};

/** 桌腿 / 桌下结构（元素造型的主载体：一眼看剪影就知道是哪张桌）。 */
function DeskUnder({ element, w, legTop, legH, k }: { element: string; w: number; legTop: number; legH: number; k: number }) {
  const bottom = legTop + legH;
  switch (element) {
    // 草桌：树桩腿（矮墩、绿描边）
    case "grass": {
      const lw = Math.max(22, w * 0.16);
      const stump = (x: number) => (
        <path
          d={`M${x} ${legTop} h${lw} v${legH - lw * 0.4} q0 ${lw * 0.4} ${-lw * 0.4} ${lw * 0.4} h${-lw * 0.2} q${-lw * 0.4} 0 ${-lw * 0.4} ${-lw * 0.4} Z`}
          fill="#8A6437"
          stroke="#3B5B23"
          strokeWidth={3}
          strokeLinejoin="round"
        />
      );
      return (
        <g>
          {stump(w * 0.12)}
          {stump(w * 0.88 - lw)}
          {/* 桩身年轮 */}
          <path d={`M${w * 0.12} ${legTop + legH * 0.45} h${lw} M${w * 0.88 - lw} ${legTop + legH * 0.45} h${lw}`} stroke="#6B4B2A" strokeWidth={2.4} opacity={0.7} />
        </g>
      );
    }
    // 火桌：独脚吧台（立柱 + 底盘 + 脚踏），柱上挂一簇呼吸的火
    case "fire": {
      const cw = Math.max(22, w * 0.14);
      const cx = w / 2;
      return (
        <g>
          <rect x={cx - cw / 2} y={legTop} width={cw} height={legH - 14} rx={cw * 0.4} fill="url(#fac-fire-col)" stroke="#7A2B12" strokeWidth={3} />
          <rect x={cx - w * 0.3} y={bottom - 16} width={w * 0.6} height={16} rx={8} fill="#B03A08" stroke="#7A2B12" strokeWidth={3} />
          <rect x={cx - w * 0.19} y={legTop + legH * 0.62} width={w * 0.38} height={9} rx={4.5} fill="#B03A08" stroke="#7A2B12" strokeWidth={2.6} />
          <g className="fac-fx-glow" transform={`translate(${cx} ${legTop + legH * 0.5})`}>
            <path d={flamePath(30 * k)} fill="#FFB03A" />
          </g>
        </g>
      );
    }
    // 电桌：两条闪电形桌腿（折线多边形 + 深黄"描边"投影）
    case "electric": {
      const lw = Math.max(26, w * 0.19);
      const bolt = (x: number) => {
        const p = [
          [0.4, 0],
          [1, 0],
          [0.55, 0.45],
          [0.9, 0.45],
          [0.2, 1],
          [0.45, 0.55],
          [0, 0.55],
        ] as const;
        return (
          <polygon
            points={p.map(([px, py]) => `${x + px * lw},${legTop + py * legH}`).join(" ")}
            fill="#F7C531"
            stroke="#8A6410"
            strokeWidth={2.6}
            strokeLinejoin="round"
          />
        );
      };
      return (
        <g>
          {bolt(w * 0.1)}
          {bolt(w * 0.9 - lw)}
          {/* 右侧垂落的电线 + 插头 */}
          <path d={`M${w - 4} ${legTop + 10} q18 ${legH * 0.3} 4 ${legH * 0.55}`} fill="none" stroke={INK_WOOD} strokeWidth={4} strokeLinecap="round" />
          <rect x={w + 2} y={legTop + legH * 0.62} width={22} height={17} rx={4} fill={CREAM} stroke={INK_WOOD} strokeWidth={3} />
        </g>
      );
    }
    // 水桌：桌下整体就是一缸水族箱（气泡上浮 + 一条小橘鱼）
    case "water": {
      const tankH = Math.min(legH, 150);
      const tankY = legTop;
      const tw = w * 0.9;
      const tx = w * 0.05;
      return (
        <g>
          {legH > tankH && (
            <g fill="#4B94CE" stroke="#1E5688" strokeWidth={3}>
              <rect x={w * 0.16} y={tankY + tankH} width={16} height={legH - tankH} />
              <rect x={w * 0.84 - 16} y={tankY + tankH} width={16} height={legH - tankH} />
            </g>
          )}
          <rect x={tx} y={tankY} width={tw} height={tankH} rx={12} fill="url(#fac-tank)" stroke="#1E5688" strokeWidth={3.4} />
          <circle className="fac-fx-bubble" cx={tx + tw * 0.18} cy={tankY + tankH - 18} r={7} fill="rgba(255,255,255,0.85)" />
          <circle className="fac-fx-bubble fac-fx-bubble-b" cx={tx + tw * 0.34} cy={tankY + tankH - 12} r={5} fill="rgba(255,255,255,0.75)" />
          {/* 小橘鱼 */}
          <g transform={`translate(${tx + tw * 0.6} ${tankY + tankH * 0.62})`}>
            <ellipse cx={0} cy={0} rx={15} ry={9} fill="#FFB03A" />
            <path d="M13 0 l12 -7 v14 Z" fill="#FFB03A" />
            <circle cx={-5} cy={-2} r={2.4} fill={INK} />
          </g>
        </g>
      );
    }
    // 冰桌：两摞错缝冰砖
    case "ice": {
      const rows = Math.max(2, Math.round(legH / 52));
      const rh = legH / rows;
      const stack = (cx: number) =>
        Array.from({ length: rows }, (_, r) => {
          const bw = r % 2 ? w * 0.26 : w * 0.3;
          return (
            <rect
              key={r}
              x={cx - bw / 2}
              y={legTop + legH - (r + 1) * rh}
              width={bw}
              height={rh}
              rx={6}
              fill={r % 2 ? "#EAF8FC" : "#DFF4FA"}
              stroke="#5FA8BE"
              strokeWidth={2.6}
            />
          );
        });
      return (
        <g>
          {stack(w * 0.2)}
          {stack(w * 0.8)}
        </g>
      );
    }
    // 般桌：瓦楞纸箱底座（中缝胶带）
    default: {
      const bw = w * 0.8;
      return (
        <g>
          <rect x={(w - bw) / 2} y={legTop} width={bw} height={legH} rx={6} fill="url(#fac-carton)" stroke={INK_WOOD} strokeWidth={3} />
          <rect x={w / 2 - 7} y={legTop + 3} width={14} height={legH - 6} fill="rgba(150,112,62,0.45)" />
        </g>
      );
    }
  }
}

/** 桌沿装饰（画在桌面板之上的一小条，纯装饰不参与碰撞）：草皮 / 火苗 / 警示垫 /
 *  波浪 / 积雪 —— 与桌下结构一起构成"元素长进桌子里"。 */
function DeskTrim({ element, w, slabY, legTop, k }: { element: string; w: number; slabY: number; legTop: number; k: number }) {
  switch (element) {
    case "grass": {
      const tufts = [0.1, 0.28, 0.46, 0.66, 0.86];
      return (
        <g>
          <rect x={w * 0.04} y={slabY - 13} width={w * 0.92} height={15} rx={7} fill="#57B84C" />
          {tufts.map((t, i) => (
            <circle key={t} cx={w * t} cy={slabY - 15} r={i % 2 ? 10 : 8.5} fill={i % 2 ? "#6FC75E" : "#57B84C"} />
          ))}
          {/* 一朵小花 + 一片斜叶 */}
          <circle cx={w * 0.78} cy={slabY - 28} r={8} fill="#FFFDF6" stroke="#F5C0A8" strokeWidth={3} />
          <circle cx={w * 0.78} cy={slabY - 28} r={3} fill="#F7C531" />
          <path d={`M${w * 0.2} ${slabY - 16} q-4 -14 6 -19 q3 12 -6 19 Z`} fill="#8CD97B" />
        </g>
      );
    }
    case "fire":
      return (
        <g>
          <g transform={`translate(${w * 0.16} ${slabY - 2})`}>
            <path d={flamePath(20 * k)} fill="#E85D3A" />
          </g>
          <g transform={`translate(${w * 0.84} ${slabY - 2})`}>
            <path d={flamePath(20 * k)} fill="#E85D3A" />
          </g>
          <g className="fac-fx-flame" transform={`translate(${w * 0.5} ${slabY - 2})`}>
            <path d={flamePath(30 * k)} fill="#FFB03A" />
          </g>
          <circle className="fac-fx-rise" cx={w * 0.5} cy={slabY - 34 * k} r={6} fill="#FFB03A" opacity={0.7} />
        </g>
      );
    case "electric":
      return (
        <g>
          {/* 淡黄桌垫 */}
          <rect x={w * 0.07} y={slabY - 11} width={w * 0.86} height={12} rx={6} fill="#FFE9AD" />
          {/* 十字火花 */}
          <g className="fac-fx-blink" transform={`translate(${w * 0.42} ${slabY - 26})`}>
            <rect x={-2} y={-12} width={4} height={24} fill="#F7C531" />
            <rect x={-12} y={-2} width={24} height={4} fill="#F7C531" />
          </g>
        </g>
      );
    case "water": {
      const waves = [0.14, 0.38, 0.62, 0.86];
      return (
        <g>
          {waves.map((t, i) => (
            <path
              key={t}
              d={`M${w * t - 13} ${slabY + 1} a13 11 0 0 1 26 0 Z`}
              fill={i % 2 ? "#7BBEE8" : "#9BD4F0"}
            />
          ))}
        </g>
      );
    }
    case "ice":
      return (
        <g>
          {/* 桌沿垂下的三根冰锥（挂在桌板下缘） */}
          <path d={`M${w * 0.26} ${legTop} h15 l-7.5 22 Z`} fill="#C9EAF4" stroke="#5FA8BE" strokeWidth={2} />
          <path d={`M${w * 0.52} ${legTop} h18 l-9 30 Z`} fill="#B5E2F0" stroke="#5FA8BE" strokeWidth={2} />
          <path d={`M${w * 0.76} ${legTop} h13 l-6.5 19 Z`} fill="#C9EAF4" stroke="#5FA8BE" strokeWidth={2} />
          {/* 左上角积雪条 + 斜高光 */}
          <path d={`M${w * 0.06} ${slabY + 2} h${w * 0.3} q-6 -14 -20 -14 h-${w * 0.3 - 26} q-12 0 -${w * 0.06} 14 Z`} fill="#FFFDF6" />
          <rect x={w * 0.12} y={slabY + 5} width={30} height={5} rx={2.5} fill="rgba(255,255,255,0.9)" transform={`rotate(-14 ${w * 0.12} ${slabY + 5})`} />
        </g>
      );
    default:
      return null;
  }
}

/** 前景元素桌：**桌面板 = 碰撞体**（位置/尺寸严格 = layoutDesks 给的矩形，
 *  一像素都不能改），其余全是装饰。设计定稿 7a「元素长进桌子里」——每张桌用
 *  桌腿/桌下结构 + 桌沿装饰做出专属剪影，颜色识别升级为整桌造型识别。
 *  强描边 + 投影 → 一眼读作前景，与无描边的中景家具拉开层次。 */
function DeskArt({
  desk,
  groundY,
  color,
  badge,
  label,
  name,
  highlight,
  carriedDim,
  scoreState,
  disabled = false,
  disabledLabel,
}: {
  desk: Desk;
  groundY: number;
  color: string;
  badge: string;
  label: string;
  name: string;
  /** 机上挂着同属性宠：桌面区亮元素色呼吸光圈（往这儿丢直接粘住）。 */
  highlight: boolean;
  /** 机上挂着宠物但属性不匹配：整桌灰显，收拢玩家对可落点的注意力。 */
  carriedDim: boolean;
  /** N1 结算聚光：hot=结算涉及的桌高亮彩色，dim=其余桌灰显（撤销后 CSS 缓慢恢复）。 */
  scoreState?: "hot" | "dim" | null;
  disabled?: boolean;
  disabledLabel: string;
}) {
  const w = desk.w;
  // The warning seal is deliberately narrow. Keep whitespace-delimited
  // translations on at most two balanced lines instead of letting a long
  // English sentence escape the SVG label (CJK copy naturally stays on one).
  const disabledWords = disabledLabel.trim().split(/\s+/).filter(Boolean);
  const disabledLines = disabledWords.length <= 1
    ? [disabledLabel]
    : disabledWords.slice(1).reduce<string[]>((lines, word) => {
        if (lines.length === 1 && `${lines[0]} ${word}`.length <= 10) {
          lines[0] = `${lines[0]} ${word}`;
        } else if (lines.length < 2) {
          lines.push(word);
        } else {
          lines[1] = `${lines[1]} ${word}`;
        }
        return lines;
      }, [disabledWords[0]]);
  const disabledLineFontSize = disabledLines.length > 1 ? 13 : 16;
  const disabledLineSpacing = disabledLines.length > 1 ? 0.55 : 1;
  const disabledLineMaxWidth = Math.max(18, w - 30);
  const disabledLineWidths = disabledLines.map((line) => (
    [...line].reduce((width, char) => (
      width + (/[^\u0000-\u00ff]/.test(char) ? disabledLineFontSize : char === " " ? disabledLineFontSize * 0.34 : disabledLineFontSize * 0.62)
    ), 0) + Math.max(0, line.length - 1) * disabledLineSpacing
  ));
  const slabY = DESK_ITEM_H;
  const legTop = slabY + DESK_SLAB_H;
  const h = DESK_ITEM_H + Math.max(DESK_SLAB_H, groundY - desk.top);
  const legH = h - legTop;
  const k = clamp(w / 130, 0.9, 1.7);
  const skin = DESK_SKIN[desk.element] ?? DEFAULT_SKIN;
  const badgePath = BADGE_PATHS[badge];
  // 名牌：木牌样式（奶油底 + 元素色描边 + 微倾），宽度按字数估
  const signW = clamp(name.length * 15 + 42, 66, w + 26);
  const signY = slabY - (desk.element === "fire" ? 62 : 46) * k;
  const uid = `fac-${desk.element}`;
  return (
    <svg
      className={`fac-desk${highlight ? " is-ready" : ""}${carriedDim ? " is-carried-dim" : ""}${scoreState === "hot" ? " is-score-hot" : scoreState === "dim" ? " is-score-dim" : ""}${disabled ? " is-disabled-score" : ""}`}
      // 元素色喂给 CSS：桌本体的发光/呼吸用它染色（不画任何外框）
      style={{ left: desk.x, top: desk.top - DESK_ITEM_H, width: w, height: h, "--fac-el": color } as CSSProperties}
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={label}
      overflow="visible"
    >
      <defs>
          <linearGradient id={`${uid}-slab`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={skin.slab[0]} />
            <stop offset="100%" stopColor={skin.slab[1]} />
          </linearGradient>
          <pattern
            id={`${uid}-disabled-stripes`}
            width={18}
            height={18}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(35)"
          >
            <rect width={9} height={18} fill="#FFD83D" />
            <rect x={9} width={9} height={18} fill="#25221C" />
          </pattern>
        {desk.element === "fire" && (
          <linearGradient id="fac-fire-col" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#B03A08" />
            <stop offset="100%" stopColor="#7A2B12" />
          </linearGradient>
        )}
        {desk.element === "water" && (
          <linearGradient id="fac-tank" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(123,190,232,0.88)" />
            <stop offset="100%" stopColor="rgba(46,123,214,0.88)" />
          </linearGradient>
        )}
        {desk.element === "normal" && (
          <pattern id="fac-carton" width={40} height={8} patternUnits="userSpaceOnUse">
            <rect width={20} height={8} fill="#D8C7A4" />
            <rect x={20} width={20} height={8} fill="#CBB88F" />
          </pattern>
        )}
        {desk.element === "electric" && (
          <pattern id="fac-hazard" width={28} height={28} patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <rect width={14} height={28} fill="#F7C531" />
            <rect x={14} width={14} height={28} fill="#3B2B1D" />
          </pattern>
        )}
      </defs>

      {/* 桌下结构（元素剪影主体） */}
      <DeskUnder element={desk.element} w={w} legTop={legTop} legH={legH} k={k} />

      {/* 桌沿装饰（草皮/火苗/警示垫/波浪/积雪/冰锥） */}
      <DeskTrim element={desk.element} w={w} slabY={slabY} legTop={legTop} k={k} />

      {/* 桌面板：碰撞体本体。位置/尺寸 = deskObstacle，勿动。 */}
      <rect
        className="fac-desk-slab"
        x={0}
        y={slabY}
        width={w}
        height={DESK_SLAB_H}
        rx={7}
        fill={desk.element === "electric" ? "url(#fac-hazard)" : `url(#${uid}-slab)`}
        stroke={skin.stroke}
        strokeWidth={3.6}
      />
      {/* 前缘灯条（配对时点亮） */}
      <rect
        className="fac-desk-edge"
        x={3}
        y={slabY + DESK_SLAB_H - 7}
        width={w - 6}
        height={5}
        rx={2.5}
        fill={color}
        opacity={0.92}
      />

      {/* 名牌木牌：奶油底 + 元素色描边 + 微倾 ±2°（ZCOOL 风格的粗圆字重） */}
      <g transform={`rotate(${desk.level === 1 ? 2 : -2} ${w / 2} ${signY + 12})`}>
        <rect
          className="fac-desk-plate"
          x={w / 2 - signW / 2}
          y={signY}
          width={signW}
          height={26}
          rx={9}
          fill={CREAM}
          stroke={skin.sign}
          strokeWidth={2.6}
        />
        {badgePath && (
          <g transform={`translate(${w / 2 - signW / 2 + 8} ${signY + 5}) scale(0.62)`}>
            <path d={badgePath} fill={color} />
          </g>
        )}
        <text
          x={w / 2 + 8}
          y={signY + 19}
          textAnchor="middle"
          fontSize={14}
          fontWeight={900}
          fill={skin.text}
        >
          {name}
        </text>
      </g>
      {disabled && (
        <g className="fac-desk-disabled-stamp" aria-hidden="true">
          <rect
            className="fac-desk-seal-body"
            x={-10}
            y={legTop + 14}
            width={w + 20}
            height={46}
            rx={5}
            fill={`url(#${uid}-disabled-stripes)`}
          />
          <rect
            className="fac-desk-seal-label"
            x={8}
            y={legTop + 21}
            width={w - 16}
            height={32}
            rx={4}
          />
          <text
            className={disabledLines.length > 1 ? "is-multiline" : undefined}
            x={w / 2}
            y={disabledLines.length > 1 ? legTop + 35 : legTop + 44}
            textAnchor="middle"
          >
            {disabledLines.map((line, index) => {
              const estimatedWidth = disabledLineWidths[index];
              const fittedWidth = Math.min(estimatedWidth, disabledLineMaxWidth);
              return (
                <tspan
                  key={`${line}-${index}`}
                  x={w / 2}
                  dy={index === 0 ? 0 : 14}
                  textLength={fittedWidth < estimatedWidth ? fittedWidth : undefined}
                  lengthAdjust={fittedWidth < estimatedWidth ? "spacingAndGlyphs" : undefined}
                >
                  {line}
                </tspan>
              );
            })}
          </text>
        </g>
      )}
    </svg>
  );
}

// ---- 前景障碍物（办公物件，与桌同款强描边 + 投影 = 前景语汇） ----------------

/** 前景小障碍物：文件山 / 饮水机 / 盆栽 / 打印机（设计稿 §障碍物）。
 *  **有实体、会挡宠物**（碰撞 AABB 见 buildObstacles/decorObstacle，与此处渲染同源
 *  computeDecorSpots）；塞在六张桌之间的空档里，压在打工山之上 → 读作最前景。 */
function ForegroundDecor({ desks, width, groundY }: { desks: Desk[]; width: number; groundY: number }) {
  const spots = computeDecorSpots(desks, width);
  return (
    <>
      {spots.map((s) => (
        <svg
          key={s.x}
          className="fac-decor"
          style={{ left: s.x, top: groundY - DECOR_BASE_Y }}
          width={120}
          height={160}
          viewBox="0 0 120 160"
          aria-hidden="true"
        >
          {s.kind === 0 && <DecorFileStack />}
          {s.kind === 1 && <DecorCooler />}
          {s.kind === 2 && <DecorPlant />}
          {s.kind === 3 && <DecorPrinter />}
        </svg>
      ))}
    </>
  );
}

/** 文件山：三摞歪斜纸堆 + 一张飘着的纸。底线 y=152。 */
function DecorFileStack() {
  return (
    <g strokeLinejoin="round">
      <rect x={8} y={126} width={104} height={26} rx={5} fill={CREAM} stroke={INK_WOOD} strokeWidth={3} />
      <rect x={14} y={104} width={94} height={24} rx={5} fill="#F2E5C4" stroke={INK_WOOD} strokeWidth={3} transform="rotate(-3 61 116)" />
      <rect x={10} y={82} width={98} height={24} rx={5} fill={CREAM} stroke={INK_WOOD} strokeWidth={3} transform="rotate(2 59 94)" />
      <rect x={30} y={54} width={38} height={28} rx={3} fill="#FFFDF6" stroke={INK_WOOD} strokeWidth={2.8} transform="rotate(-8 49 68)" />
      <path d="M36 62 h22 M36 70 h16" stroke="#B98A4E" strokeWidth={2.6} strokeLinecap="round" />
    </g>
  );
}

/** 饮水机：米白机身 + 蓝水桶 + 两个出水按钮。 */
function DecorCooler() {
  return (
    <g strokeLinejoin="round">
      <rect x={26} y={54} width={68} height={98} rx={12} fill="url(#fac-cooler)" stroke={INK_WOOD} strokeWidth={3.4} />
      <rect x={20} y={54} width={80} height={0} />
      <rect x={44} y={98} width={32} height={16} rx={4} fill={INK_WOOD} />
      <rect x={44} y={122} width={13} height={9} rx={2} fill="#2E7BD6" stroke={INK_WOOD} strokeWidth={2.4} />
      <rect x={64} y={122} width={13} height={9} rx={2} fill="#D9553F" stroke={INK_WOOD} strokeWidth={2.4} />
      <path d="M38 54 h44 l-6 -50 h-32 Z" fill="#BFE4F2" stroke={INK_WOOD} strokeWidth={3.4} />
      <rect x={52} y={0} width={16} height={8} rx={3} fill="#9FD3E8" stroke={INK_WOOD} strokeWidth={2.6} />
      <defs>
        <linearGradient id="fac-cooler" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F5F0E2" />
          <stop offset="100%" stopColor="#E4DAC2" />
        </linearGradient>
      </defs>
    </g>
  );
}

/** 盆栽：红陶盆 + 双层绿球。 */
function DecorPlant() {
  return (
    <g strokeLinejoin="round">
      <path d="M32 100 h56 l-7 52 h-42 Z" fill="#D9553F" stroke={INK_WOOD} strokeWidth={3.4} />
      <path d="M28 92 h64 v12 h-64 Z" fill="#C9462F" stroke={INK_WOOD} strokeWidth={3.2} />
      <ellipse cx={60} cy={72} rx={36} ry={30} fill="#57B84C" stroke="#3B5B23" strokeWidth={3.4} />
      <ellipse cx={62} cy={36} rx={22} ry={20} fill="#8CD97B" stroke="#3B5B23" strokeWidth={3.2} />
    </g>
  );
}

/** 打印机：灰机身 + 出纸口 + 半吐出来的一张纸。 */
function DecorPrinter() {
  return (
    <g strokeLinejoin="round">
      <rect x={8} y={100} width={104} height={52} rx={11} fill="#C9CFD2" stroke={INK_WOOD} strokeWidth={3.4} />
      <rect x={26} y={82} width={68} height={20} rx={5} fill="#9A9AA6" stroke={INK_WOOD} strokeWidth={3.2} />
      <rect x={34} y={58} width={50} height={26} rx={3} fill="#FFFDF6" stroke={INK_WOOD} strokeWidth={2.8} transform="rotate(-4 59 71)" />
      <path d="M20 124 h30" stroke={INK_WOOD} strokeWidth={3} strokeLinecap="round" />
      <circle cx={96} cy={124} r={5} fill="#57B84C" stroke={INK_WOOD} strokeWidth={2.6} />
    </g>
  );
}
