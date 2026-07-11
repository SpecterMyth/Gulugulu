import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type { GameConfig, GameSave, PetInstance, PetState } from "../types";
import { EggSvg, SvgSprite } from "../sprites/SvgSprite";
import { ReactionBurst } from "../sprites/parts/vfx";
import { WorkBurst } from "../sprites/parts/workFx";
import {
  eggHatchInfo,
  equivalentEggPrice,
  hatcherySlotCount,
  isMaxLevel,
  maxLevelForTier,
  yardCapacityFor,
} from "./config";
import { nextFusionGoal } from "./tutorial";
import { formatCountdown, useNowSeconds } from "./useGame";
import "./backyard.css";

// ---------------------------------------------------------------------------
// 世界常量（与设计稿一致）：近景 4400，角色活动区 [70, 4330]，速度 230px/s。
// ---------------------------------------------------------------------------

const WORLD_W = 5600;
const CHAR_MIN = 70;
const CHAR_MAX = 5530;
const WALK_SPEED = 230;
const CHAR_SIZE = 120;
const CHAR_BOTTOM = 138;
const SHOP_CENTER_X = 1150;
const SHOP_NEAR_RANGE = 210;
const PET_NEAR_RANGE = 150;
const SPAWN_X = 440;
/** 图鉴馆 / 交易市场建筑中心与感应半径 */
const MUSEUM_X = 4610;
const MARKET_X = 4990;
const POI_RANGE = 200;

/** 舞台设计高（世界坐标系的画布高度）。窗口高度变化 = 整体等比缩放；
 *  窗口宽度变化 = 只扩展可见画卷（stageW = 视口宽 / 缩放）。 */
const STAGE_H = 560;
/** 三个视差层整体下沉量：把土层剖面压缩到只露 76px（正好两行按钮），
 *  角色/布景/面板全部随之贴近窗口底边。 */
const GROUND_SHIFT = 56;
/** 缩放映射视高：下沉后最高场景物约 ≤390，视高收紧让画面再放大一档 */
const VIEW_H = 420;
/** 记住用户上次拉到的后院窗口高度（与 App.tsx 停靠逻辑共用） */
const BACKYARD_HEIGHT_KEY = "gulugulu.backyardHeight";

/** 孵化区三个蛋坑的世界 x（设计稿坐标） */
const PIT_XS = [120, 220, 320];

/** 站在草地上的驻留点（脚底约在草皮线上，不悬空） */
const GROUND_SPOTS: Array<{ x: number; bottom: number; size: number; float?: boolean }> = [
  { x: 1760, bottom: 142, size: 84 },
  { x: 3236, bottom: 142, size: 92 },
  { x: 4009, bottom: 142, size: 98 },
  { x: 700, bottom: 142, size: 88 },
  { x: 2680, bottom: 142, size: 88 },
  { x: 4240, bottom: 142, size: 80 },
  { x: 4430, bottom: 142, size: 84 },
];

/** 池塘上空的漂浮位：只分配给水系伙伴，其他系一律落地 */
const POND_SPOT = { x: 2058, bottom: 196, size: 96, float: true };

const SHOP_ORDER = ["normal", "fire", "water", "grass", "electric", "ice"];

/** 首次进入后院的移动引导只出现一次 */
const GUIDE_SEEN_KEY = "gulugulu.backyardGuideSeen";
const GUIDE_AUTO_HIDE_MS = 12_000;

/** 主角在场景里会原样演出的宠物状态（其余一律回落 idle；行走优先） */
const SCENE_ACTION_STATES: ReadonlySet<PetState> = new Set([
  "fed",
  "success",
  "error",
  "thinking",
  "working",
  "laboring",
  "clicked",
]);

/** 打工连击窗口（与主舞台一致），驱动粒子密度 */
const WORK_COMBO_WINDOW_MS = 1100;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

type Sty = CSSProperties;
const abs = (s: Sty): Sty => ({ position: "absolute", ...s });

// ---------------------------------------------------------------------------
// 静态装饰层（memo：场景每秒因倒计时重渲，装饰不重排）
// ---------------------------------------------------------------------------

/** 蓬蓬云：底部长条 + 三团大小不一的圆叠出云朵轮廓 */
function Cloud({ left, top, size = 1, opacity = 0.75 }: { left: number; top: number; size?: number; opacity?: number }) {
  return (
    <div style={abs({ left, top, width: 150 * size, height: 56 * size, opacity })}>
      <div style={abs({ left: 0, bottom: 0, width: "100%", height: "44%", borderRadius: 999, background: "#FFFFFF" })} />
      <div style={abs({ left: "10%", bottom: "20%", width: "36%", height: "58%", borderRadius: "50%", background: "#FFFFFF" })} />
      <div style={abs({ left: "34%", bottom: "24%", width: "44%", height: "76%", borderRadius: "50%", background: "#FFFFFF" })} />
      <div style={abs({ left: "64%", bottom: "16%", width: "30%", height: "50%", borderRadius: "50%", background: "#FFFFFF" })} />
    </div>
  );
}

/** 远景（速率 0.25）：太阳、远山、云。
 *  透明窗口下山丘整体下沉贴住近景地面（草皮顶 160），避免纵向透明缝隙。 */
const FarDecor = memo(function FarDecor() {
  return (
    <>
      <div style={abs({ left: 1750, top: 64, width: 74, height: 74, borderRadius: "50%", background: "#FFF3D0", boxShadow: "0 0 40px 18px rgba(255,243,208,0.55)", opacity: 0.9 })} />
      <div style={abs({ inset: 0, transform: "translateY(45px)" })}>
        <div style={abs({ left: 120, bottom: 200, width: 700, height: 170, borderRadius: "50% 50% 0 0", background: "#B9C9B3", opacity: 0.7 })} />
        <div style={abs({ left: 1300, bottom: 200, width: 760, height: 190, borderRadius: "50% 50% 0 0", background: "#B9C9B3", opacity: 0.7 })} />
        <div style={abs({ left: 0, bottom: 180, width: 520, height: 110, borderRadius: "50% 50% 0 0", background: "#C6D4C0", opacity: 0.9 })} />
        <div style={abs({ left: 480, bottom: 180, width: 640, height: 140, borderRadius: "50% 50% 0 0", background: "#CFDCC9", opacity: 0.9 })} />
        <div style={abs({ left: 1100, bottom: 180, width: 560, height: 120, borderRadius: "50% 50% 0 0", background: "#C6D4C0", opacity: 0.9 })} />
        <div style={abs({ left: 1650, bottom: 180, width: 600, height: 150, borderRadius: "50% 50% 0 0", background: "#CFDCC9", opacity: 0.9 })} />
        <div style={abs({ left: 2220, bottom: 180, width: 400, height: 100, borderRadius: "50% 50% 0 0", background: "#C6D4C0", opacity: 0.9 })} />
        <div style={abs({ left: 2560, bottom: 195, width: 620, height: 160, borderRadius: "50% 50% 0 0", background: "#B9C9B3", opacity: 0.7 })} />
        <div style={abs({ left: 2620, bottom: 180, width: 480, height: 115, borderRadius: "50% 50% 0 0", background: "#CFDCC9", opacity: 0.9 })} />
        <div style={abs({ left: 3020, bottom: 185, width: 380, height: 105, borderRadius: "50% 50% 0 0", background: "#C6D4C0", opacity: 0.9 })} />
      </div>
      <Cloud left={250} top={78} size={0.9} opacity={0.75} />
      <Cloud left={640} top={132} size={0.66} opacity={0.62} />
      <Cloud left={900} top={48} size={1.1} opacity={0.75} />
      <Cloud left={1500} top={100} size={0.8} opacity={0.68} />
      <Cloud left={2100} top={160} size={1} opacity={0.72} />
      <Cloud left={2680} top={70} size={0.85} opacity={0.7} />
    </>
  );
});

/** 中景（速率 0.55）：灌木、风车、栅栏、小屋、树。
 *  整层下沉 18px：原基线 168 → 150，收进近景草皮（132–160）后面，不留缝。 */
const MidDecor = memo(function MidDecor() {
  return (
    <div style={abs({ inset: 0, transform: "translateY(18px)" })}>
      <div style={abs({ left: 40, bottom: 168, width: 96, height: 58, borderRadius: "50% 50% 0 0", background: "#A3C49B", opacity: 0.9 })} />
      <div style={abs({ left: 170, bottom: 168, width: 180, height: 34, borderRadius: "17px 17px 0 0", background: "#9CBE94", opacity: 0.85 })} />
      <div style={abs({ left: 280, bottom: 168, width: 14, height: 62, borderRadius: 7, background: "#A98D6B" })} />
      <div style={abs({ left: 236, bottom: 216, width: 102, height: 86, borderRadius: "50%", background: "#8FB98A", opacity: 0.95 })} />
      <div style={abs({ left: 262, bottom: 252, width: 64, height: 52, borderRadius: "50%", background: "#A9C77F", opacity: 0.9 })} />
      <div style={abs({ left: 520, bottom: 168, width: 130, height: 52, borderRadius: "50% 50% 0 0", background: "#9CBE94", opacity: 0.9 })} />
      <div style={abs({ left: 640, bottom: 168, width: 80, height: 40, borderRadius: "50% 50% 0 0", background: "#A3C49B", opacity: 0.85 })} />
      {/* 风车 */}
      <div style={abs({ left: 860, bottom: 168, width: 32, height: 132, borderRadius: "9px 9px 4px 4px", background: "linear-gradient(90deg,#C9B08C,#B9A07C)", opacity: 0.95 })} />
      <div style={abs({ left: 868, bottom: 294, width: 16, height: 16, borderRadius: "50%", background: "#8A7458", zIndex: 1 })} />
      <div style={abs({ left: 836, bottom: 254, width: 80, height: 80, animation: "gg-spin 10s linear infinite", opacity: 0.9 })}>
        <div style={abs({ left: 0, top: 35, width: 80, height: 10, borderRadius: 6, background: "#B9A58A" })} />
        <div style={abs({ left: 35, top: 0, width: 10, height: 80, borderRadius: 6, background: "#B9A58A" })} />
      </div>
      <div style={abs({ left: 1010, bottom: 168, width: 88, height: 48, borderRadius: "50% 50% 0 0", background: "#A3C49B", opacity: 0.9 })} />
      <div style={abs({ left: 1180, bottom: 168, width: 200, height: 30, borderTop: "5px solid #C0A276", background: "repeating-linear-gradient(90deg, #C0A276 0 8px, transparent 8px 48px)", opacity: 0.8 })} />
      <div style={abs({ left: 1450, bottom: 168, width: 14, height: 66, borderRadius: 7, background: "#A98D6B" })} />
      <div style={abs({ left: 1404, bottom: 220, width: 104, height: 90, borderRadius: "50%", background: "#8FB98A", opacity: 0.95 })} />
      <div style={abs({ left: 1432, bottom: 262, width: 60, height: 50, borderRadius: "50%", background: "#A9C77F", opacity: 0.9 })} />
      <div style={abs({ left: 1680, bottom: 168, width: 120, height: 54, borderRadius: "50% 50% 0 0", background: "#9CBE94", opacity: 0.9 })} />
      <div style={abs({ left: 1790, bottom: 168, width: 82, height: 44, borderRadius: "50% 50% 0 0", background: "#A3C49B", opacity: 0.85 })} />
      {/* 远处小屋 */}
      <div style={abs({ left: 2040, bottom: 168, width: 112, height: 72, borderRadius: 4, background: "#C9B8A0", opacity: 0.95 })} />
      <div style={abs({ left: 2036, bottom: 238, width: 0, height: 0, borderLeft: "60px solid transparent", borderRight: "60px solid transparent", borderBottom: "46px solid #A98D6B", opacity: 0.95 })} />
      <div style={abs({ left: 2118, bottom: 270, width: 13, height: 26, borderRadius: 3, background: "#A98D6B", opacity: 0.95 })} />
      <div style={abs({ left: 2084, bottom: 190, width: 22, height: 26, borderRadius: "3px 3px 0 0", background: "#8A7458", opacity: 0.9 })} />
      <div style={abs({ left: 2230, bottom: 168, width: 110, height: 50, borderRadius: "50% 50% 0 0", background: "#9CBE94", opacity: 0.9 })} />
      <div style={abs({ left: 2480, bottom: 168, width: 14, height: 70, borderRadius: 7, background: "#A98D6B" })} />
      <div style={abs({ left: 2436, bottom: 224, width: 100, height: 88, borderRadius: "50%", background: "#7FA97A", opacity: 0.95 })} />
      <div style={abs({ left: 2600, bottom: 168, width: 190, height: 32, borderRadius: "16px 16px 0 0", background: "#9CBE94", opacity: 0.85 })} />
      <div style={abs({ left: 2700, bottom: 168, width: 92, height: 46, borderRadius: "50% 50% 0 0", background: "#A3C49B", opacity: 0.9 })} />
      <div style={abs({ left: 2930, bottom: 168, width: 14, height: 74, borderRadius: 7, background: "#A98D6B" })} />
      <div style={abs({ left: 2886, bottom: 228, width: 100, height: 92, borderRadius: "50%", background: "#8FB98A", opacity: 0.95 })} />
      <div style={abs({ left: 2914, bottom: 272, width: 56, height: 46, borderRadius: "50%", background: "#A9C77F", opacity: 0.9 })} />
      <div style={abs({ left: 3160, bottom: 168, width: 120, height: 52, borderRadius: "50% 50% 0 0", background: "#9CBE94", opacity: 0.9 })} />
      {/* 图鉴馆/交易市场身后的延伸绿化（世界扩宽到 5200 的中景补充） */}
      <div style={abs({ left: 3380, bottom: 168, width: 150, height: 46, borderRadius: "50% 50% 0 0", background: "#A3C49B", opacity: 0.85 })} />
      <div style={abs({ left: 3600, bottom: 168, width: 14, height: 68, borderRadius: 7, background: "#A98D6B" })} />
      <div style={abs({ left: 3556, bottom: 222, width: 100, height: 88, borderRadius: "50%", background: "#8FB98A", opacity: 0.95 })} />
      <div style={abs({ left: 3760, bottom: 168, width: 180, height: 32, borderRadius: "16px 16px 0 0", background: "#9CBE94", opacity: 0.85 })} />
      <div style={abs({ left: 3900, bottom: 168, width: 96, height: 50, borderRadius: "50% 50% 0 0", background: "#A3C49B", opacity: 0.9 })} />
      <div style={abs({ left: 4060, bottom: 168, width: 140, height: 44, borderRadius: "50% 50% 0 0", background: "#9CBE94", opacity: 0.88 })} />
      <div style={abs({ left: 4240, bottom: 168, width: 14, height: 64, borderRadius: 7, background: "#A98D6B" })} />
      <div style={abs({ left: 4198, bottom: 218, width: 98, height: 84, borderRadius: "50%", background: "#8FB98A", opacity: 0.95 })} />
    </div>
  );
});

/** 近景静态装饰：地面 + 各区布景（不含蛋坑/商店板/公告板内容等动态件） */
const NearDecor = memo(function NearDecor() {
  return (
    <>
      {/* 草皮 + 剖面土层（土层一直铺到窗口底边，透明窗口下不留缝） */}
      <div style={abs({ left: 0, bottom: 132, width: WORLD_W, height: 28, borderRadius: "16px 16px 0 0", background: "linear-gradient(180deg,#9ED67F,#7CBE5F)", boxShadow: "0 -4px 10px rgba(59,43,29,0.12)" })} />
      <div
        style={abs({
          left: 0,
          bottom: 0,
          width: WORLD_W,
          height: 132,
          background:
            "radial-gradient(circle at 90px 34px, #C6A15B 0 6px, transparent 7px), radial-gradient(circle at 260px 60px, #96703E 0 5px, transparent 6px), radial-gradient(circle at 430px 28px, #C6A15B 0 4px, transparent 5px), linear-gradient(180deg,#A9814F,#8A6437)",
          backgroundSize: "560px 132px, 560px 132px, 560px 132px, 100% 100%",
        })}
      />

      {/* ── 孵化区布景 ── */}
      <div style={abs({ left: 20, bottom: 150, width: 9, height: 40, borderRadius: 5, background: "#C89B62", boxShadow: "inset 0 -3px 0 rgba(59,43,29,0.25)" })} />
      <div style={abs({ left: 56, bottom: 150, width: 9, height: 44, borderRadius: 5, background: "#C89B62", boxShadow: "inset 0 -3px 0 rgba(59,43,29,0.25)" })} />
      <div style={abs({ left: 14, bottom: 172, width: 58, height: 7, borderRadius: 4, background: "#B98A4E" })} />
      <div style={abs({ left: 96, bottom: 150, width: 8, height: 88, borderRadius: 4, background: "#8A6437" })} />
      <div style={abs({ left: 58, bottom: 226, padding: "4px 14px 5px", borderRadius: 8, border: "2.5px solid #6B4520", background: "linear-gradient(180deg,#C08A4E,#A06A33)", fontFamily: "var(--font-display)", fontSize: 14, color: "#FFF3D9", textShadow: "0 -1px 0 rgba(0,0,0,0.4)", transform: "rotate(-2deg)", whiteSpace: "nowrap" })}>
        🥚 孵化区
      </div>

      {/* ── 小院 ── */}
      <div style={abs({ left: 480, bottom: 152, width: 7, height: 60, borderRadius: 4, background: "#8A6437" })} />
      <div style={abs({ left: 460, bottom: 208, width: 48, height: 28, borderRadius: "13px 13px 5px 5px", background: "#D9553F", border: "2.5px solid #6B4520", boxSizing: "border-box" })}>
        <span style={abs({ right: -6, top: -10, width: 4, height: 14, borderRadius: 2, background: "#F7D373" })} />
      </div>
      <div style={abs({ left: 560, bottom: 152, width: 7, height: 78, borderRadius: 4, background: "#8A6437" })} />
      <div style={abs({ left: 780, bottom: 152, width: 7, height: 78, borderRadius: 4, background: "#8A6437" })} />
      <div style={abs({ left: 563, bottom: 224, width: 222, height: 3, borderRadius: 2, background: "#6B4520", transform: "rotate(-1deg)" })} />
      <div style={abs({ left: 610, bottom: 184, width: 30, height: 40, borderRadius: "3px 3px 5px 5px", background: "#F5C0A8", boxShadow: "inset 0 -8px 0 rgba(0,0,0,0.06)", transformOrigin: "50% 0", animation: "gg-sway 3.4s ease-in-out infinite" })} />
      <div style={abs({ left: 668, bottom: 188, width: 34, height: 36, borderRadius: "3px 3px 5px 5px", background: "#9BDCFF", boxShadow: "inset 0 -8px 0 rgba(0,0,0,0.06)", transformOrigin: "50% 0", animation: "gg-sway 4.1s ease-in-out 0.5s infinite" })} />
      <div style={abs({ left: 880, bottom: 152, width: 56, height: 38, borderRadius: 6, background: "linear-gradient(90deg,#96703E,#A9814F 50%,#8A6437)" })} />
      <div style={abs({ left: 880, bottom: 182, width: 56, height: 22, borderRadius: "50%", background: "#D9B37C", border: "2.5px solid #8A6437", boxSizing: "border-box" })} />
      <div style={abs({ left: 530, bottom: 154, width: 10, height: 10, borderRadius: "50%", background: "radial-gradient(circle,#F5D95A 0 3px,#FFFDF4 3px)" })} />
      <div style={abs({ left: 840, bottom: 156, width: 9, height: 9, borderRadius: "50%", background: "radial-gradient(circle,#F5D95A 0 3px,#F5917B 3px)" })} />

      {/* ── 商店建筑 ── */}
      <div style={abs({ left: 1016, bottom: 150, width: 7, height: 120, borderRadius: 4, background: "#6B4520" })} />
      <div style={abs({ left: 1288, bottom: 150, width: 7, height: 120, borderRadius: 4, background: "#6B4520" })} />
      <div style={abs({ left: 1030, bottom: 150, width: 240, height: 132, borderRadius: "10px 10px 4px 4px", border: "3px solid #6B4520", background: "repeating-linear-gradient(90deg, rgba(59,32,10,0.12) 0 3px, transparent 3px 30px), linear-gradient(180deg,#B07B44,#96622F)", boxSizing: "border-box" })} />
      <div style={abs({ left: 1064, bottom: 196, width: 52, height: 44, borderRadius: 8, background: "#5C3B1E", boxShadow: "inset 0 0 0 3px #6B4520, inset 0 4px 8px rgba(0,0,0,0.4)" })} />
      <div style={abs({ left: 1052, bottom: 150, width: 196, height: 42, borderRadius: 6, border: "3px solid #6B4520", background: "repeating-linear-gradient(92deg, rgba(59,32,10,0.12) 0 2px, transparent 2px 30px), linear-gradient(180deg,#C08A4E,#A06A33)", boxSizing: "border-box" })} />
      <div style={abs({ left: 1152, bottom: 192, width: 20, height: 26, borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%", border: "2px solid #3B2B1D", boxSizing: "border-box", background: "radial-gradient(circle at 60% 40%, #2E7BD6 0 3px, transparent 4px), #FFFDF6" })} />
      <div style={abs({ left: 1180, bottom: 192, width: 20, height: 26, borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%", border: "2px solid #3B2B1D", boxSizing: "border-box", background: "radial-gradient(circle at 60% 40%, #E85D3A 0 3px, transparent 4px), #FFFDF6" })} />
      <div style={abs({ left: 1010, bottom: 270, width: 280, height: 40, borderRadius: "10px 10px 0 0", border: "3px solid #6B4520", background: "repeating-linear-gradient(90deg,#D9553F 0 28px,#FFF3D9 28px 56px)", boxSizing: "border-box", boxShadow: "0 8px 12px rgba(43,26,8,0.22)" })} />
      <div style={abs({ left: 1104, bottom: 306, padding: "4px 18px 5px", borderRadius: 9, border: "2.5px solid #6B4520", background: "linear-gradient(180deg,#B07B44,#96622F)", fontFamily: "var(--font-display)", fontSize: 17, color: "#FFE9AD", textShadow: "0 2px 0 rgba(0,0,0,0.35)", whiteSpace: "nowrap" })}>
        🛒 商店
      </div>

      {/* ── 菜园 ── */}
      <div style={abs({ left: 1340, bottom: 150, width: 200, height: 46, borderRadius: 8, border: "3px solid #8A6437", background: "repeating-linear-gradient(90deg, rgba(59,32,10,0.18) 0 10px, transparent 10px 36px), linear-gradient(180deg,#9B6B3A,#845222)", boxSizing: "border-box" })} />
      <div style={abs({ left: 1368, bottom: 192, width: 14, height: 18, borderRadius: "50% 50% 0 0", background: "#8CD97B" })} />
      <div style={abs({ left: 1430, bottom: 192, width: 14, height: 15, borderRadius: "50% 50% 0 0", background: "#6FB35F" })} />
      <div style={abs({ left: 1488, bottom: 192, width: 14, height: 19, borderRadius: "50% 50% 0 0", background: "#8CD97B" })} />
      <div style={abs({ left: 1572, bottom: 150, width: 8, height: 132, borderRadius: 4, background: "#8A6437" })} />
      <div style={abs({ left: 1528, bottom: 244, width: 96, height: 8, borderRadius: 4, background: "#8A6437" })} />
      <div style={abs({ left: 1556, bottom: 276, width: 40, height: 40, borderRadius: "50%", background: "#F5C0A8", border: "2.5px solid #6B4520", boxSizing: "border-box" })} />
      <div style={abs({ left: 1550, bottom: 312, width: 52, height: 8, borderRadius: 4, background: "#8A6437" })} />
      <div style={abs({ left: 1560, bottom: 318, width: 32, height: 16, borderRadius: "7px 7px 0 0", background: "#8A6437" })} />
      <div style={abs({ left: 1640, bottom: 150, width: 36, height: 30, borderRadius: "50%", background: "#E07B39", boxShadow: "inset -7px 0 0 rgba(150,60,20,0.3)" })}>
        <span style={abs({ left: "50%", top: -6, transform: "translateX(-50%)", width: 6, height: 9, borderRadius: 3, background: "#6B8F33" })} />
      </div>
      <div style={abs({ left: 1686, bottom: 150, width: 25, height: 21, borderRadius: "50%", background: "#E07B39", boxShadow: "inset -5px 0 0 rgba(150,60,20,0.3)" })}>
        <span style={abs({ left: "50%", top: -5, transform: "translateX(-50%)", width: 5, height: 7, borderRadius: 3, background: "#6B8F33" })} />
      </div>

      {/* ── 池塘 ── */}
      <div style={abs({ left: 1810, bottom: 148, width: 34, height: 16, borderRadius: "50%", background: "#C9CFD2", boxShadow: "inset 0 -4px 0 rgba(0,0,0,0.12)" })} />
      <div style={abs({ left: 1860, bottom: 134, width: 320, height: 46, borderRadius: "50%", background: "radial-gradient(ellipse at 42% 38%, #D6F1FF, #9BDCFF 72%)", boxShadow: "inset 0 5px 10px rgba(27,95,176,0.3)" })} />
      <div style={abs({ left: 1874, bottom: 150, width: 4, height: 46, borderRadius: 2, background: "#57964B" })} />
      <div style={abs({ left: 1872, bottom: 192, width: 8, height: 18, borderRadius: 5, background: "#7A5230" })} />
      <div style={abs({ left: 1890, bottom: 150, width: 4, height: 58, borderRadius: 2, background: "#57964B" })} />
      <div style={abs({ left: 1888, bottom: 204, width: 8, height: 18, borderRadius: 5, background: "#7A5230" })} />
      <div style={abs({ left: 1906, bottom: 150, width: 4, height: 40, borderRadius: 2, background: "#57964B" })} />
      <div style={abs({ left: 2020, bottom: 158, width: 34, height: 12, borderRadius: "50%", background: "#6FB35F" })} />
      <div style={abs({ left: 2230, bottom: 148, width: 28, height: 13, borderRadius: "50%", background: "#D4D9DB", boxShadow: "inset 0 -3px 0 rgba(0,0,0,0.12)" })} />

      {/* ── 公告板骨架（内容动态） ── */}
      <div style={abs({ left: 2330, bottom: 150, width: 11, height: 158, borderRadius: 5, background: "linear-gradient(90deg,#8A6437,#A9814F)" })} />
      <div style={abs({ left: 2548, bottom: 150, width: 11, height: 158, borderRadius: 5, background: "linear-gradient(90deg,#8A6437,#A9814F)" })} />
      {/* 标题牌骑在板体上缘：底部与板框相接（板顶 394），完整露出文字 */}
      <div style={abs({ left: 2384, bottom: 392, padding: "5px 18px 6px", borderRadius: 9, border: "2.5px solid #6B4520", background: "linear-gradient(180deg,#B07B44,#96622F)", fontFamily: "var(--font-display)", fontSize: 16, lineHeight: 1.2, color: "#FFE9AD", textShadow: "0 2px 0 rgba(0,0,0,0.35)", whiteSpace: "nowrap", zIndex: 1 })}>
        📊 公告板
      </div>

      {/* ── 果园 ── */}
      <div style={abs({ left: 2920, bottom: 152, width: 22, height: 158, borderRadius: 10, background: "linear-gradient(90deg,#8A6437,#A9814F 55%,#7A5230)" })} />
      <div style={abs({ left: 2790, bottom: 270, width: 130, height: 118, borderRadius: "50%", background: "#69AE52" })} />
      <div style={abs({ left: 2868, bottom: 296, width: 150, height: 132, borderRadius: "50%", background: "#7CBE5F" })} />
      <div style={abs({ left: 2972, bottom: 268, width: 118, height: 108, borderRadius: "50%", background: "#5E9E52" })} />
      <span style={abs({ left: 2842, bottom: 320, width: 13, height: 13, borderRadius: "50%", background: "#E2432E" })} />
      <span style={abs({ left: 2930, bottom: 360, width: 13, height: 13, borderRadius: "50%", background: "#E2432E" })} />
      <span style={abs({ left: 3010, bottom: 314, width: 13, height: 13, borderRadius: "50%", background: "#E2432E" })} />
      <span style={abs({ left: 2896, bottom: 284, width: 12, height: 12, borderRadius: "50%", background: "#E2432E" })} />
      <div style={abs({ left: 2788, bottom: 158, width: 86, height: 130, transformOrigin: "50% 0", animation: "gg-swing 4.4s ease-in-out infinite" })}>
        <div style={abs({ left: 10, top: 0, width: 3, height: 104, background: "repeating-linear-gradient(0deg,#C6A15B 0 4px,#A9814F 4px 8px)" })} />
        <div style={abs({ left: 72, top: 0, width: 3, height: 104, background: "repeating-linear-gradient(0deg,#C6A15B 0 4px,#A9814F 4px 8px)" })} />
        <div style={abs({ left: 0, top: 102, width: 86, height: 11, borderRadius: 5, border: "2px solid #6B4520", background: "linear-gradient(180deg,#B07B44,#96622F)", boxSizing: "border-box" })} />
      </div>
      <div style={abs({ left: 3056, bottom: 288, width: 3, height: 26, background: "#8A6437" })} />
      <div style={abs({ left: 3038, bottom: 244, width: 40, height: 46, borderRadius: "45%", border: "2px solid #8A6437", background: "repeating-linear-gradient(0deg, rgba(138,100,55,0.5) 0 4px, transparent 4px 12px), linear-gradient(180deg,#F0C35B,#D9A032)", boxSizing: "border-box" })}>
        <span style={abs({ left: "50%", bottom: 8, transform: "translateX(-50%)", width: 9, height: 9, borderRadius: "50%", background: "#6B4520" })} />
      </div>
      <div style={abs({ left: 3330, bottom: 156, width: 10, height: 10, borderRadius: "50%", background: "radial-gradient(circle,#F5D95A 0 3px,#FFFDF4 3px)" })} />
      <div style={abs({ left: 3410, bottom: 148, width: 78, height: 46, borderRadius: "50% 50% 0 0", background: "#69AE52" })} />

      {/* ── 营地 ── */}
      <div style={abs({ left: 3560, bottom: 152, width: 0, height: 0, borderLeft: "82px solid transparent", borderRight: "82px solid transparent", borderBottom: "122px solid #D9553F" })} />
      <div style={abs({ left: 3616, bottom: 152, width: 0, height: 0, borderLeft: "26px solid transparent", borderRight: "26px solid transparent", borderBottom: "54px solid #A93B29" })} />
      <div style={abs({ left: 3770, bottom: 128, width: 200, height: 100, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(255,176,58,0.4) 0%, rgba(255,176,58,0) 70%)", animation: "gg-glow 2.4s ease-in-out infinite" })} />
      <div style={abs({ left: 3830, bottom: 150, width: 60, height: 11, borderRadius: 6, background: "#6B4520", transform: "rotate(14deg)" })} />
      <div style={abs({ left: 3836, bottom: 150, width: 60, height: 11, borderRadius: 6, background: "#5C3B1E", transform: "rotate(-13deg)" })} />
      <div style={abs({ left: 3846, bottom: 164, width: 32, height: 42, borderRadius: "50% 50% 50% 50% / 64% 64% 36% 36%", background: "#E85D3A", animation: "gg-flame 0.8s ease-in-out infinite" })} />
      <div style={abs({ left: 3852, bottom: 168, width: 20, height: 30, borderRadius: "50% 50% 50% 50% / 64% 64% 36% 36%", background: "#FFB03A", animation: "gg-flame 0.62s ease-in-out 0.1s infinite" })} />
      <div style={abs({ left: 3857, bottom: 172, width: 11, height: 18, borderRadius: "50% 50% 50% 50% / 64% 64% 36% 36%", background: "#FFF1C9", animation: "gg-flame 0.5s ease-in-out 0.2s infinite" })} />
      <div style={abs({ left: 4150, bottom: 152, width: 7, height: 150, borderRadius: 4, background: "#8A6437" })} />
      <div style={abs({ left: 4153, bottom: 294, width: 44, height: 6, borderRadius: 3, background: "#8A6437" })} />
      <div style={abs({ left: 4188, bottom: 280, width: 3, height: 16, background: "#8A6437" })} />
      <div style={abs({ left: 4178, bottom: 246, width: 24, height: 32, borderRadius: 7, border: "2px solid #6B4520", background: "linear-gradient(180deg,#FFD98A,#FFB03A)", boxShadow: "0 0 16px 6px rgba(255,176,58,0.5)", animation: "gg-glow 3s ease-in-out infinite", boxSizing: "border-box" })} />
      <div style={abs({ left: 4240, bottom: 154, width: 9, height: 9, borderRadius: "50%", background: "radial-gradient(circle,#F5D95A 0 3px,#F5917B 3px)" })} />
      <div style={abs({ left: 4300, bottom: 150, width: 9, height: 40, borderRadius: 5, background: "#C89B62", boxShadow: "inset 0 -3px 0 rgba(59,43,29,0.25)" })} />
      <div style={abs({ left: 4336, bottom: 150, width: 9, height: 44, borderRadius: 5, background: "#C89B62", boxShadow: "inset 0 -3px 0 rgba(59,43,29,0.25)" })} />
      <div style={abs({ left: 4372, bottom: 150, width: 9, height: 40, borderRadius: 5, background: "#C89B62", boxShadow: "inset 0 -3px 0 rgba(59,43,29,0.25)" })} />
      <div style={abs({ left: 4294, bottom: 172, width: 94, height: 7, borderRadius: 4, background: "#B98A4E" })} />

      {/* ── 图鉴馆（博物馆立面：台基 + 四柱 + 山花） ── */}
      <div style={abs({ left: 4470, bottom: 150, width: 280, height: 16, borderRadius: 4, background: "linear-gradient(180deg,#D4D9DB,#B9BFC2)", boxShadow: "inset 0 -4px 0 rgba(0,0,0,0.12)" })} />
      <div style={abs({ left: 4484, bottom: 166, width: 252, height: 12, borderRadius: 3, background: "linear-gradient(180deg,#E0E4E6,#C9CFD2)" })} />
      <div style={abs({ left: 4492, bottom: 178, width: 236, height: 92, background: "linear-gradient(180deg,#EFE8D2,#DED2B2)" })} />
      {[4498, 4560, 4666, 4702].map((x) => (
        <div key={x} style={abs({ left: x, bottom: 178, width: 20, height: 92, borderRadius: 4, background: "linear-gradient(90deg,#F5EFDD,#D9CCA8 60%,#C4B890)", boxShadow: "inset 0 4px 0 rgba(59,43,29,0.12), inset 0 -4px 0 rgba(59,43,29,0.18)" })} />
      ))}
      <div style={abs({ left: 4596, bottom: 178, width: 52, height: 66, borderRadius: "26px 26px 0 0", background: "#5C3B1E", boxShadow: "inset 0 0 0 4px #6B4520" })} />
      <div style={abs({ left: 4482, bottom: 270, width: 256, height: 16, borderRadius: 4, border: "2px solid #6B4520", background: "linear-gradient(180deg,#B07B44,#96622F)", boxSizing: "border-box" })} />
      <div style={abs({ left: 4482, bottom: 286, width: 0, height: 0, borderLeft: "128px solid transparent", borderRight: "128px solid transparent", borderBottom: "54px solid #D9B37C" })} />
      <div style={abs({ left: 4494, bottom: 286, width: 0, height: 0, borderLeft: "116px solid transparent", borderRight: "116px solid transparent", borderBottom: "48px solid #C9A15B" })} />
      <div style={abs({ left: 4596, bottom: 296, width: 28, height: 28, borderRadius: "50%", background: "radial-gradient(circle at 40% 35%, #FFFDF6, #D9CCA8)", border: "2.5px solid #6B4520", boxSizing: "border-box" })} />
      <div style={abs({ left: 4548, bottom: 352, padding: "4px 16px 5px", borderRadius: 9, border: "2.5px solid #6B4520", background: "linear-gradient(180deg,#B07B44,#96622F)", fontFamily: "var(--font-display)", fontSize: 15, lineHeight: 1.2, color: "#FFE9AD", textShadow: "0 2px 0 rgba(0,0,0,0.35)", whiteSpace: "nowrap" })}>
        📖 图鉴馆
      </div>

      {/* ── 交易市场（集市摊位：柜台 + 条纹遮阳棚 + 货箱） ── */}
      <div style={abs({ left: 4862, bottom: 150, width: 8, height: 128, borderRadius: 4, background: "#6B4520" })} />
      <div style={abs({ left: 5110, bottom: 150, width: 8, height: 128, borderRadius: 4, background: "#6B4520" })} />
      <div style={abs({ left: 4870, bottom: 150, width: 240, height: 48, borderRadius: 6, border: "3px solid #6B4520", background: "repeating-linear-gradient(92deg, rgba(59,32,10,0.12) 0 2px, transparent 2px 30px), linear-gradient(180deg,#C08A4E,#A06A33)", boxSizing: "border-box" })} />
      <div style={abs({ left: 4886, bottom: 198, width: 40, height: 30, borderRadius: 4, border: "2px solid #6B4520", background: "repeating-linear-gradient(0deg, rgba(59,32,10,0.25) 0 4px, transparent 4px 10px), #C9A15B", boxSizing: "border-box" })} />
      <div style={abs({ left: 4934, bottom: 198, width: 32, height: 24, borderRadius: 4, border: "2px solid #6B4520", background: "#D9B37C", boxSizing: "border-box" })} />
      <div style={abs({ left: 5052, bottom: 198, width: 34, height: 26, borderRadius: "50%", background: "radial-gradient(circle at 38% 32%, #D9B37C, #B98A4E 78%)", border: "2px solid #6B4520", boxSizing: "border-box" })}>
        <span style={abs({ left: "50%", top: "50%", transform: "translate(-50%,-50%)", fontSize: 13 })}>🪙</span>
      </div>
      <div style={abs({ left: 4846, bottom: 268, width: 288, height: 42, borderRadius: "12px 12px 0 0", border: "3px solid #6B4520", background: "repeating-linear-gradient(90deg,#57964B 0 30px,#FFF3D9 30px 60px)", boxSizing: "border-box", boxShadow: "0 8px 12px rgba(43,26,8,0.22)" })} />
      <div style={abs({ left: 4906, bottom: 318, padding: "4px 16px 5px", borderRadius: 9, border: "2.5px solid #6B4520", background: "linear-gradient(180deg,#B07B44,#96622F)", fontFamily: "var(--font-display)", fontSize: 15, lineHeight: 1.2, color: "#FFE9AD", textShadow: "0 2px 0 rgba(0,0,0,0.35)", whiteSpace: "nowrap" })}>
        💰 交易市场
      </div>

      {/* ── 世界尾部收边（给市场面板向右展开留出的余量地带） ── */}
      <div style={abs({ left: 5260, bottom: 154, width: 10, height: 10, borderRadius: "50%", background: "radial-gradient(circle,#F5D95A 0 3px,#FFFDF4 3px)" })} />
      <div style={abs({ left: 5330, bottom: 148, width: 84, height: 48, borderRadius: "50% 50% 0 0", background: "#69AE52" })} />
      <div style={abs({ left: 5440, bottom: 150, width: 9, height: 40, borderRadius: 5, background: "#C89B62", boxShadow: "inset 0 -3px 0 rgba(59,43,29,0.25)" })} />
      <div style={abs({ left: 5476, bottom: 150, width: 9, height: 44, borderRadius: 5, background: "#C89B62", boxShadow: "inset 0 -3px 0 rgba(59,43,29,0.25)" })} />
      <div style={abs({ left: 5512, bottom: 150, width: 9, height: 40, borderRadius: 5, background: "#C89B62", boxShadow: "inset 0 -3px 0 rgba(59,43,29,0.25)" })} />
      <div style={abs({ left: 5434, bottom: 172, width: 94, height: 7, borderRadius: 4, background: "#B98A4E" })} />
    </>
  );
});

// ---------------------------------------------------------------------------
// 场景组件
// ---------------------------------------------------------------------------

export type BackyardSceneProps = {
  save: GameSave;
  config: GameConfig;
  busy: boolean;
  statusText: string;
  projectTokens: number;
  /** 主舞台的宠物状态：fed/success/thinking… 会映射到场景主角身上播放 */
  petState: PetState;
  /** 正在播放的进食收益（App 的喂食队列出队一条），跟随主角头顶飘字 */
  fedPulse: { id: number; exp: number; coins: number } | null;
  /** 台词系统（与主舞台共用）：在后院改为主角头顶气泡 */
  speechLine: string;
  speechVisible: boolean;
  /** 全局提示：后院有主角时由头顶气泡代言 */
  toast: { id: number; text: string } | null;
  /** 交易市场入口（Steam） */
  onOpenMarket: () => void;
  onWalkingChange: (walking: boolean) => void;
  onBack: () => void;
  onWorkPet: (petId: string, at?: { x: number; y: number }) => void;
  onCollectEgg: (eggId: string) => void;
  onPlaceEgg: (eggId: string, slot: number) => void;
  onBuyEgg: (element: string) => void;
  onUpgradeHatchery: () => void;
  onUpgradeYard: () => void;
  onFuse: (idA: string, idB: string) => void;
  onFollow: (petId: string) => void;
  onRelease: (petId: string) => void;
  onToast: (message: string) => void;
};

export function BackyardScene({
  save,
  config,
  busy,
  statusText,
  projectTokens,
  petState,
  fedPulse,
  speechLine,
  speechVisible,
  toast,
  onOpenMarket,
  onWalkingChange,
  onBack,
  onWorkPet,
  onCollectEgg,
  onPlaceEgg,
  onBuyEgg,
  onUpgradeHatchery,
  onUpgradeYard,
  onFuse,
  onFollow,
  onRelease,
  onToast,
}: BackyardSceneProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const farRef = useRef<HTMLDivElement | null>(null);
  const midRef = useRef<HTMLDivElement | null>(null);
  const nearRef = useRef<HTMLDivElement | null>(null);
  const charRef = useRef<HTMLDivElement | null>(null);
  const charFaceRef = useRef<HTMLDivElement | null>(null);

  const now = useNowSeconds(true);

  const [walking, setWalking] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [museumOpen, setMuseumOpen] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);
  // 面板开在建筑相对主角的另一侧（靠近瞬间按主角方位定侧，贴地展开不再被窗顶裁切）
  const [poiSides, setPoiSides] = useState<{ shop: "left" | "right"; museum: "left" | "right"; market: "left" | "right" }>(
    { shop: "right", museum: "right", market: "right" },
  );
  const [dexOpen, setDexOpen] = useState(false);
  const [nearPetId, setNearPetId] = useState<string | null>(null);
  const [confirmRelease, setConfirmRelease] = useState(false);
  // 视口尺寸（跟随用户拉伸窗口）：高度决定整体缩放，宽度决定画卷可见范围
  const [view, setView] = useState({ w: 760, h: STAGE_H });
  // 打工中的伙伴（短暂播放 laboring 动画）
  const [laboringIds, setLaboringIds] = useState<ReadonlySet<string>>(new Set());
  // 闲时小动作：驻留伙伴大部分时间安静待机，偶尔欢呼一下或左右踱两步
  const [quirk, setQuirk] = useState<{ petId: string; kind: "hop" | "stroll"; dx: number; facing: number } | null>(
    null,
  );
  // 头顶气泡：提示 > 融合条件 > 台词
  const [toastSay, setToastSay] = useState<{ id: number; text: string } | null>(null);
  const [hintSay, setHintSay] = useState<string | null>(null);
  // 首次进入的移动引导（一次性）
  const [showGuide, setShowGuide] = useState(() => {
    try {
      return window.localStorage.getItem(GUIDE_SEEN_KEY) == null;
    } catch {
      return true;
    }
  });
  // 点击打工的场景内特效：工具粒子 + 元素色爆发 + 挤压脉冲
  const [petFx, setPetFx] = useState<
    Array<{ id: number; petId: string; species: string; tier: number; seed: number; boom: boolean; color: string }>
  >([]);
  const [workPulse, setWorkPulse] = useState<{ petId: string; flip: number }>({ petId: "", flip: -1 });
  const fxIdRef = useRef(0);
  const workComboRef = useRef({ count: 0, last: 0 });

  const activePet = save.pets.find((pet) => pet.id === save.activePetId) ?? null;
  // 驻留点分配：水系优先占池塘漂浮位，其余全部落在草地上（不悬空）。
  const placedPets = useMemo(() => {
    const others = save.pets.filter((pet) => pet.id !== save.activePetId);
    const result: Array<{ pet: PetInstance; spot: { x: number; bottom: number; size: number; float?: boolean } }> = [];
    let pondTaken = false;
    let groundIndex = 0;
    for (const pet of others) {
      const isWater = config.species[pet.species]?.elements?.[0] === "water";
      if (isWater && !pondTaken) {
        result.push({ pet, spot: POND_SPOT });
        pondTaken = true;
        continue;
      }
      if (groundIndex < GROUND_SPOTS.length) {
        result.push({ pet, spot: GROUND_SPOTS[groundIndex] });
        groundIndex += 1;
      }
    }
    return result;
  }, [config, save.pets, save.activePetId]);

  // rAF 循环读取的世界状态全部放 ref，避免逐帧 setState。
  const motionRef = useRef({ charX: SPAWN_X, target: null as number | null, facing: 1, camX: 0, walking: false });
  const keysRef = useRef({ left: false, right: false });
  const shopOpenRef = useRef(false);
  const museumOpenRef = useRef(false);
  const marketOpenRef = useRef(false);
  const nearPetRef = useRef<string | null>(null);
  const placedPetsRef = useRef(placedPets);
  const onWalkingChangeRef = useRef(onWalkingChange);
  const guideSeenRef = useRef(false);

  useEffect(() => {
    placedPetsRef.current = placedPets;
  }, [placedPets]);

  useEffect(() => {
    onWalkingChangeRef.current = onWalkingChange;
  }, [onWalkingChange]);

  useEffect(() => {
    setConfirmRelease(false);
  }, [nearPetId]);

  // 闲时小动作调度：每 6–14s 随机挑一只驻留伙伴，55% 概率踱步（moving 左右
  // 挪 36px），否则原地欢呼（success）。力竭中的伙伴跳过。
  useEffect(() => {
    let scheduleTimer = 0;
    let clearTimer = 0;
    const schedule = () => {
      scheduleTimer = window.setTimeout(() => {
        const candidates = placedPetsRef.current.filter((item) => !item.pet.exhausted);
        if (candidates.length > 0) {
          const pick = candidates[Math.floor(Math.random() * candidates.length)];
          const stroll = Math.random() < 0.55;
          const dir = Math.random() < 0.5 ? -1 : 1;
          setQuirk({
            petId: pick.pet.id,
            kind: stroll ? "stroll" : "hop",
            dx: stroll ? dir * 36 : 0,
            facing: dir,
          });
          clearTimer = window.setTimeout(() => setQuirk(null), stroll ? 2400 : 1500);
        }
        schedule();
      }, 6000 + Math.random() * 8000);
    };
    schedule();
    return () => {
      window.clearTimeout(scheduleTimer);
      window.clearTimeout(clearTimer);
    };
  }, []);

  const dismissGuide = () => {
    if (guideSeenRef.current) return;
    guideSeenRef.current = true;
    try {
      window.localStorage.setItem(GUIDE_SEEN_KEY, "1");
    } catch {
      // localStorage 不可用时引导只在本次会话隐藏
    }
    setShowGuide(false);
  };
  const dismissGuideRef = useRef(dismissGuide);
  dismissGuideRef.current = dismissGuide;

  // 引导超时自动收起
  useEffect(() => {
    if (!showGuide) return;
    const timer = window.setTimeout(() => dismissGuideRef.current(), GUIDE_AUTO_HIDE_MS);
    return () => window.clearTimeout(timer);
  }, [showGuide]);

  // 图鉴打开时 Esc 先关图鉴（捕获阶段拦截，避免 App 的 Esc 直接退出后院）
  useEffect(() => {
    if (!dexOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopImmediatePropagation();
      setDexOpen(false);
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [dexOpen]);

  // 场景卸载时把"行走中"复位，避免 App 的喂食队列被卡住。
  useEffect(() => {
    return () => onWalkingChangeRef.current(false);
  }, []);

  // 视口跟踪：用户拉伸窗口时更新缩放/画卷宽度，并记住高度供下次停靠。
  const viewScale = Math.max(0.35, view.h / VIEW_H);
  const stageW = Math.max(320, view.w / viewScale);
  const stageRefValues = useRef({ stageW, scale: viewScale });
  useEffect(() => {
    stageRefValues.current = { stageW, scale: viewScale };
  }, [stageW, viewScale]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) {
        setView((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
        try {
          window.localStorage.setItem(BACKYARD_HEIGHT_KEY, String(Math.round(h)));
        } catch {
          // ignore
        }
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 主循环：行走 / 相机 / 视差 / 靠近检测（与设计稿 step() 一致）
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const step = (ts: number) => {
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;
      const motion = motionRef.current;
      const keys = keysRef.current;

      let dir = 0;
      if (keys.left && !keys.right) dir = -1;
      else if (keys.right && !keys.left) dir = 1;

      let moving = false;
      if (dir !== 0) {
        motion.target = null;
        motion.charX += dir * WALK_SPEED * dt;
        motion.facing = dir;
        moving = true;
      } else if (motion.target != null) {
        const dx = motion.target - motion.charX;
        if (Math.abs(dx) < 4) {
          motion.target = null;
        } else {
          const sign = Math.sign(dx);
          motion.charX += sign * Math.min(WALK_SPEED * dt, Math.abs(dx));
          motion.facing = sign;
          moving = true;
        }
      }
      motion.charX = clamp(motion.charX, CHAR_MIN, CHAR_MAX);

      // 相机以"世界单位"的画卷宽度取景（= 视口宽 / 整体缩放）
      const vw = stageRefValues.current.stageW;
      const camX = Math.max(0, Math.min(motion.charX - vw / 2, WORLD_W - vw));
      motion.camX = camX;

      if (nearRef.current) nearRef.current.style.transform = `translate3d(${-camX}px,${GROUND_SHIFT}px,0)`;
      if (midRef.current) midRef.current.style.transform = `translate3d(${-camX * 0.55}px,${GROUND_SHIFT}px,0)`;
      if (farRef.current) farRef.current.style.transform = `translate3d(${-camX * 0.25}px,${GROUND_SHIFT}px,0)`;
      if (charRef.current) charRef.current.style.left = `${motion.charX - CHAR_SIZE / 2}px`;
      if (charFaceRef.current) charFaceRef.current.style.transform = motion.facing === -1 ? "scaleX(-1)" : "scaleX(1)";

      if (moving !== motion.walking) {
        motion.walking = moving;
        setWalking(moving);
        onWalkingChangeRef.current(moving);
      }

      const nearShop = Math.abs(motion.charX - SHOP_CENTER_X) < SHOP_NEAR_RANGE;
      if (nearShop !== shopOpenRef.current) {
        shopOpenRef.current = nearShop;
        setShopOpen(nearShop);
        if (nearShop) {
          const side = motion.charX < SHOP_CENTER_X ? "right" : "left";
          setPoiSides((prev) => (prev.shop === side ? prev : { ...prev, shop: side }));
        }
      }

      const nearMuseum = Math.abs(motion.charX - MUSEUM_X) < POI_RANGE;
      if (nearMuseum !== museumOpenRef.current) {
        museumOpenRef.current = nearMuseum;
        setMuseumOpen(nearMuseum);
        if (nearMuseum) {
          const side = motion.charX < MUSEUM_X ? "right" : "left";
          setPoiSides((prev) => (prev.museum === side ? prev : { ...prev, museum: side }));
        }
      }

      const nearMarket = Math.abs(motion.charX - MARKET_X) < POI_RANGE;
      if (nearMarket !== marketOpenRef.current) {
        marketOpenRef.current = nearMarket;
        setMarketOpen(nearMarket);
        if (nearMarket) {
          const side = motion.charX < MARKET_X ? "right" : "left";
          setPoiSides((prev) => (prev.market === side ? prev : { ...prev, market: side }));
        }
      }

      let bestId: string | null = null;
      let bestDistance = PET_NEAR_RANGE;
      for (const { pet, spot } of placedPetsRef.current) {
        const distance = Math.abs(motion.charX - spot.x);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestId = pet.id;
        }
      }
      if (bestId !== nearPetRef.current) {
        nearPetRef.current = bestId;
        setNearPetId(bestId);
      }

      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ← → / A D 连续移动
  useEffect(() => {
    const isLeftKey = (event: KeyboardEvent) => event.key === "ArrowLeft" || event.key === "a" || event.key === "A";
    const isRightKey = (event: KeyboardEvent) => event.key === "ArrowRight" || event.key === "d" || event.key === "D";
    const onKeyDown = (event: KeyboardEvent) => {
      if (isLeftKey(event)) {
        keysRef.current.left = true;
        dismissGuideRef.current();
        if (event.key.startsWith("Arrow")) event.preventDefault();
      } else if (isRightKey(event)) {
        keysRef.current.right = true;
        dismissGuideRef.current();
        if (event.key.startsWith("Arrow")) event.preventDefault();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (isLeftKey(event)) keysRef.current.left = false;
      else if (isRightKey(event)) keysRef.current.right = false;
    };
    // 失焦时 keyup 可能丢失（Alt+Tab 等），清空按键防止角色一直走
    const onBlur = () => {
      keysRef.current.left = false;
      keysRef.current.right = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  const walkToPointer = (event: ReactMouseEvent<HTMLDivElement>) => {
    const rect = rootRef.current?.getBoundingClientRect();
    const viewX = (event.clientX - (rect?.left ?? 0)) / stageRefValues.current.scale;
    motionRef.current.target = clamp(motionRef.current.camX + viewX, CHAR_MIN, CHAR_MAX);
    dismissGuide();
  };

  /** 点击角色直接打工：就地播打工动画 + 大量工具粒子（乐观），收益/驳回由 onWorkPet 结算。 */
  const workClick = (pet: PetInstance, event: ReactMouseEvent) => {
    event.stopPropagation();
    if (busy) return;
    if (!pet.exhausted) {
      const nowMs = Date.now();
      const combo = workComboRef.current;
      if (nowMs - combo.last > WORK_COMBO_WINDOW_MS) combo.count = 0;
      combo.count += 1;
      combo.last = nowMs;
      const id = fxIdRef.current + 1;
      fxIdRef.current = id;
      const color =
        config.elements[config.species[pet.species]?.elements?.[0] ?? "normal"]?.color ?? "#F5917B";
      setPetFx((list) => [
        ...list.slice(-7),
        {
          id,
          petId: pet.id,
          species: pet.species,
          // 基础密度拉满一档（≥9），连击继续加密；渲染层用 expanded 解锁大范围散射
          tier: Math.min(Math.max(combo.count + 8, 9), 18),
          seed: (Math.random() * 0xffffffff) >>> 0,
          boom: combo.count % 10 === 0,
          color,
        },
      ]);
      window.setTimeout(() => {
        setPetFx((list) => list.filter((item) => item.id !== id));
      }, 1250);
      setWorkPulse((prev) => ({ petId: pet.id, flip: prev.flip < 0 ? 0 : prev.flip + 1 }));
      // 非主角伙伴也要做打工动作：短暂切到 laboring 姿态
      if (pet.id !== save.activePetId) {
        setLaboringIds((prev) => new Set(prev).add(pet.id));
        window.setTimeout(() => {
          setLaboringIds((prev) => {
            const next = new Set(prev);
            next.delete(pet.id);
            return next;
          });
        }, 1100);
      }
    }
    onWorkPet(pet.id, { x: event.clientX, y: event.clientY });
  };

  const pulseClassFor = (petId: string) =>
    workPulse.petId === petId && workPulse.flip >= 0
      ? workPulse.flip % 2 === 0
        ? "pet-react-pulse-a"
        : "pet-react-pulse-b"
      : "";

  // ---- 派生游戏数据 ----

  const slotCount = hatcherySlotCount(config, save.hatcheryLevel);
  const maxSlots = config.hatcherySlots[config.hatcherySlots.length - 1] ?? slotCount;
  const hatcheryMaxed = save.hatcheryLevel >= config.hatcherySlots.length;
  const hatcheryUpgradeCost = hatcheryMaxed ? null : config.hatcheryUpgradeCosts[save.hatcheryLevel - 1];
  const inventoryEggs = save.eggs.filter((egg) => egg.slot == null);
  const freeSlot = (() => {
    const used = save.eggs.filter((egg) => egg.slot != null).map((egg) => egg.slot);
    for (let index = 0; index < slotCount; index += 1) if (!used.includes(index)) return index;
    return null;
  })();

  const yardCapacity = yardCapacityFor(config, save.yardLevel);
  const yardMaxed = save.yardLevel >= config.yardCapacity.length;
  const yardUpgradeCost = yardMaxed ? null : config.yardUpgradeCosts[save.yardLevel - 1];

  const nearPlaced = placedPets.find((item) => item.pet.id === nearPetId) ?? null;

  // ---- 头顶气泡（提示 > 融合条件 > 台词） ----

  // 全局提示（toast）改由主角气泡代言，2.6s 后收起
  useEffect(() => {
    if (!toast) {
      setToastSay(null);
      return;
    }
    setToastSay(toast);
    const timer = window.setTimeout(() => {
      setToastSay((current) => (current?.id === toast.id ? null : current));
    }, 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // 靠近伙伴时融合条件未达成 → 气泡说明原因，10s 后收起（每次靠近只说一次）
  useEffect(() => {
    if (!nearPetId) {
      setHintSay(null);
      return;
    }
    const near = placedPetsRef.current.find((item) => item.pet.id === nearPetId);
    const hint = near ? fusionHintFor(near.pet) : null;
    setHintSay(hint);
    if (!hint) return;
    const timer = window.setTimeout(() => setHintSay(null), 10_000);
    return () => window.clearTimeout(timer);
    // 仅在"靠近了谁"变化时取一次快照——条件文案不随金币等实时刷新
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearPetId]);

  const charSay = toastSay?.text ?? hintSay ?? (speechVisible ? speechLine : null);

  const fusionHintFor = (pet: PetInstance): string | null => {
    if (!activePet) return "先跟随一只精灵再来融合";
    if (activePet.tier !== pet.tier) return "需要两只同阶精灵";
    if (!isMaxLevel(config, pet))
      return `需对方满级 Lv${maxLevelForTier(config, pet.tier)}（${config.species[pet.species]?.nameZh ?? ""}未满级）`;
    if (!isMaxLevel(config, activePet))
      return `你的${config.species[activePet.species]?.nameZh ?? "精灵"}还没满级`;
    if (save.coins < config.fusionFee) return `金币不足（融合需 ${config.fusionFee} 🪙）`;
    return null;
  };

  const releaseRefund = (pet: PetInstance): number =>
    Math.floor(equivalentEggPrice(config, pet.species) * config.releaseRefundRate) +
    config.releaseRefundPerLevel * pet.level;

  const stopClick = (event: ReactMouseEvent) => event.stopPropagation();

  // ---- 渲染 ----

  // 主角姿态：行走优先（力竭时也能被拖着散步）；主舞台的动作状态（进食/庆祝/
  // 思考/工作…）原样演出；静止且精力耗尽 → 趴着睡觉；其余正常待机。
  const charState: PetState = walking
    ? "moving"
    : SCENE_ACTION_STATES.has(petState)
      ? petState
      : activePet?.exhausted
        ? "exhausted"
        : "idle";

  // 融合目标卡（观察者·OnboardingFlow §二·1）：后院凑齐两只同阶满级时，
  // 顶部横幅点名可融合的一对 + ？？？ 结果，勾玩家走过去融合。
  const fuseGoal = nextFusionGoal(config, save);
  const fuseAffordable = save.coins >= config.fusionFee;

  // ---- 图鉴馆 / 交易市场数据 ----

  // 图鉴 = 一阶基础物种 + 融合产物（2 阶），共 27；已收集 = 当前拥有的物种
  const dexSpecies = useMemo(() => {
    const tier1 = Object.entries(config.species)
      .filter(([, info]) => info.tier === 1)
      .map(([id]) => id);
    const tier2 = [...new Set(Object.values(config.fusionTable))];
    return [...tier1, ...tier2];
  }, [config]);
  const collectedSpecies = useMemo(() => new Set(save.pets.map((pet) => pet.species)), [save.pets]);

  /** 交易市场占位行情（后续接 Steam 市场真实价格） */
  const fakeMarketPrice = (pet: PetInstance): string =>
    (((equivalentEggPrice(config, pet.species) + pet.level * 7) * pet.tier * 3) / 100).toFixed(2);

  const marketTop = useMemo(() => {
    const priced = save.pets.map((pet) => ({
      pet,
      value: (equivalentEggPrice(config, pet.species) + pet.level * 7) * pet.tier * 3,
    }));
    priced.sort((a, b) => b.value - a.value);
    return priced.slice(0, 5).map((item) => item.pet);
  }, [config, save.pets]);

  return (
    <div ref={rootRef} className="backyard" onClick={walkToPointer}>
      {/* 缩放舞台：设计高 560，高度变化整体等比缩放（origin 左下），宽度变化只扩画卷 */}
      <div
        className="by-stage"
        style={{ width: stageW, height: STAGE_H, transform: `scale(${viewScale})` }}
      >
      {/* 远景 / 中景 */}
      <div ref={farRef} className="by-layer" style={{ width: 3400 }}>
        <FarDecor />
      </div>
      <div ref={midRef} className="by-layer" style={{ width: 4400 }}>
        <MidDecor />
      </div>

      {/* 近景 */}
      <div ref={nearRef} className="by-layer" style={{ width: WORLD_W }}>
        <NearDecor />

        {/* ── 孵化区：蛋坑（真实存档驱动） ── */}
        {Array.from({ length: maxSlots }, (_, slotIndex) => {
          const pitX = PIT_XS[slotIndex] ?? 120 + slotIndex * 100;
          if (slotIndex >= slotCount) {
            // 锁定坑：下一坑可点击解锁（= 升级孵化屋）
            const isNext = slotIndex === slotCount;
            const cost = config.hatcheryUpgradeCosts[slotIndex - 1];
            const affordable = cost != null && save.coins >= cost;
            return (
              <div
                key={`pit-${slotIndex}`}
                className={`by-pit is-locked ${isNext && affordable && !busy ? "is-actionable" : ""}`}
                style={{ left: pitX, bottom: 106 }}
                role="button"
                title={isNext ? "解锁这个蛋坑" : "先解锁前一个蛋坑"}
                onClick={(event) => {
                  event.stopPropagation();
                  if (!isNext || busy) return;
                  if (!affordable) {
                    onToast(`金币不足，解锁需要 ${cost} 🪙`);
                    return;
                  }
                  onUpgradeHatchery();
                }}
              >
                <div className="by-pit-mound" />
                <div className="by-pit-hole" />
                <span className="by-pit-lock">🔒</span>
                <span className={`by-pill ${isNext ? "is-dark" : "is-dim"}`}>
                  {isNext ? `解锁 ${cost} 🪙` : "待解锁"}
                </span>
              </div>
            );
          }

          const egg = save.eggs.find((item) => item.slot === slotIndex) ?? null;
          if (!egg) {
            const canPlace = inventoryEggs.length > 0 && !busy;
            return (
              <div
                key={`pit-${slotIndex}`}
                className={`by-pit ${canPlace ? "is-actionable" : ""}`}
                style={{ left: pitX, bottom: 106 }}
                role="button"
                title={canPlace ? "放入一颗待孵化的蛋" : "空蛋坑"}
                onClick={(event) => {
                  event.stopPropagation();
                  if (!canPlace) return;
                  onPlaceEgg(inventoryEggs[0].id, slotIndex);
                }}
              >
                <div className="by-pit-mound" />
                <div className="by-pit-hole" />
                <span className={`by-pill ${canPlace ? "is-light" : "is-dim"}`}>
                  {canPlace ? "🥚 放蛋孵化" : "空位"}
                </span>
              </div>
            );
          }

          const remain = (egg.hatchAt ?? 0) - now;
          const ready = remain <= 0;
          const { progress } = eggHatchInfo(config, egg, now);
          return (
            <div
              key={`pit-${slotIndex}`}
              className={`by-pit ${ready && !busy ? "is-actionable" : ""}`}
              style={{ left: pitX, bottom: 106 }}
              role="button"
              title={ready ? "点击收取" : `${config.species[egg.species]?.nameZh ?? "?"}的蛋`}
              onClick={(event) => {
                event.stopPropagation();
                if (ready && !busy) onCollectEgg(egg.id);
              }}
            >
              {ready && <div className="by-pit-glow" />}
              <div className="by-pit-mound" />
              <div className="by-pit-hole" />
              <div className="by-pit-egg">
                <EggSvg
                  species={egg.species}
                  tier={egg.tier}
                  config={config}
                  phase={ready ? "ready" : "incubating"}
                  progress={progress}
                  secondsLeft={Math.max(0, remain)}
                />
              </div>
              {ready ? (
                <span className="by-pill is-gold">✨ 点击收取</span>
              ) : (
                <span className="by-pill is-light">⏳ {formatCountdown(remain)}</span>
              )}
            </div>
          );
        })}

        {/* 栅栏边的待孵化蛋 */}
        {inventoryEggs.slice(0, 3).map((egg, index) => (
          <button
            key={egg.id}
            type="button"
            className="by-egg-inv"
            style={{ left: 16 + index * 30, bottom: 148 }}
            disabled={busy}
            title={freeSlot == null ? "没有空蛋坑" : "放入蛋坑孵化"}
            onClick={(event) => {
              event.stopPropagation();
              if (freeSlot == null) {
                onToast("蛋坑都满了，先收取或解锁新坑");
                return;
              }
              onPlaceEgg(egg.id, freeSlot);
            }}
          >
            <EggSvg species={egg.species} tier={egg.tier} config={config} phase="idle" />
          </button>
        ))}
        {inventoryEggs.length > 3 && (
          <span className="by-pill is-dark" style={abs({ left: 16, bottom: 190 })}>
            待孵化 ×{inventoryEggs.length}
          </span>
        )}

        {/* ── 商店弹出商品板（靠近显示；贴地、开在建筑的另一侧） ── */}
        <div
          className={`by-shop-pop ${shopOpen ? "is-open" : ""}`}
          style={{ left: poiSides.shop === "right" ? 1312 : 694, bottom: 164 }}
          onClick={stopClick}
        >
          <div className="by-shop-grid">
            {SHOP_ORDER.map((element) => {
              const price = config.eggPrices[element] ?? 0;
              const info = config.elements[element];
              const species = Object.entries(config.species).find(
                ([, item]) => item.tier === 1 && item.elements[0] === element,
              );
              const affordable = save.coins >= price;
              return (
                <button
                  key={element}
                  type="button"
                  className="by-shop-card"
                  disabled={busy || !affordable}
                  title={species?.[1].nameZh}
                  onClick={(event) => {
                    event.stopPropagation();
                    onBuyEgg(element);
                  }}
                >
                  <div className="by-shop-egg">
                    <EggSvg species={species?.[0] ?? "guluduck"} tier={1} config={config} phase="idle" />
                  </div>
                  <span className="by-shop-name">{info?.nameZh}蛋</span>
                  <span className={`by-shop-price ${affordable ? "" : "is-short"}`}>🪙 {price}</span>
                </button>
              );
            })}
          </div>
          <div className="by-shop-note">2 阶蛋不出售 · 满级融合获得</div>
        </div>

        {/* ── 图鉴馆弹板（靠近显示）：已收集角色的彩色缩略图 + 图鉴入口 ── */}
        <div
          className={`by-poi-pop ${museumOpen ? "is-open" : ""}`}
          style={{ left: poiSides.museum === "right" ? 4762 : 4138, bottom: 164 }}
          onClick={stopClick}
        >
          <div className="by-poi-title">
            📖 图鉴 {collectedSpecies.size}/{dexSpecies.length}
          </div>
          {collectedSpecies.size > 0 ? (
            <div className="by-dex-thumbs">
              {dexSpecies
                .filter((species) => collectedSpecies.has(species))
                .map((species) => (
                  <div key={species} className="by-dex-thumb" title={config.species[species]?.nameZh}>
                    <SvgSprite species={species} config={config} petState="idle" />
                  </div>
                ))}
            </div>
          ) : (
            <div className="by-poi-empty">还没有 2 阶伙伴——融合两只满级精灵试试！</div>
          )}
          <button
            type="button"
            className="by-poi-cta"
            onClick={(event) => {
              event.stopPropagation();
              setDexOpen(true);
            }}
          >
            📖 打开图鉴
          </button>
        </div>

        {/* ── 交易市场弹板（靠近显示）：持有伙伴 + 最贵五只的占位行情 ── */}
        <div
          className={`by-poi-pop ${marketOpen ? "is-open" : ""}`}
          style={{ left: poiSides.market === "right" ? 5146 : 4514, bottom: 164 }}
          onClick={stopClick}
        >
          <div className="by-poi-title">💰 我的伙伴行情</div>
          {marketTop.length > 0 ? (
            <div className="by-market-rows">
              {marketTop.map((pet) => (
                <div key={pet.id} className="by-market-row">
                  <div className="by-market-sprite">
                    <SvgSprite species={pet.species} config={config} petState="idle" />
                  </div>
                  <span className="by-market-name">
                    {config.species[pet.species]?.nameZh ?? pet.species} Lv{pet.level}
                  </span>
                  <span className="by-market-price">¥ {fakeMarketPrice(pet)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="by-poi-empty">还没有伙伴可以估价</div>
          )}
          <div className="by-poi-note">* 行情为占位数据，后续接入 Steam 市场</div>
          <button
            type="button"
            className="by-poi-cta"
            onClick={(event) => {
              event.stopPropagation();
              onOpenMarket();
            }}
          >
            🛒 进入 Steam 市场
          </button>
        </div>

        {/* ── 公告板：全局统计（Token / Agent 连接为主区，下方今日流水与图鉴） ── */}
        <div
          style={abs({ left: 2308, bottom: 236, width: 274, height: 158, borderRadius: 12, border: "4px solid #6B4520", background: "linear-gradient(180deg,#B07B44,#96622F)", boxShadow: "0 12px 22px rgba(43,26,8,0.35)", boxSizing: "border-box", cursor: "default" })}
          onClick={stopClick}
        >
          <div className="by-board-inner">
            <div className="by-board-main">
              <span className="by-board-token">🍙 {projectTokens.toLocaleString()}</span>
              <span className="by-board-token-label">累计 Token</span>
              <span className="by-board-status">📡 {statusText}</span>
            </div>
            <div className="by-board-grid">
              <span>
                ⚡ 今日 Token {save.daily.tokenExp}/{config.tokenExpDailyCap}
              </span>
              <span>📈 打工 +{save.daily.clickCoins}</span>
              <span>🍀 保底 +{save.daily.pickupCoins + save.daily.idleCoins}</span>
              <span>
                📖 图鉴 {collectedSpecies.size}/{dexSpecies.length}
              </span>
            </div>
          </div>
          <span style={abs({ left: 14, top: 12, width: 8, height: 8, borderRadius: "50%", background: "#D9553F", boxShadow: "0 1px 2px rgba(0,0,0,0.3)" })} />
          <span style={abs({ right: 14, top: 12, width: 8, height: 8, borderRadius: "50%", background: "#D9553F", boxShadow: "0 1px 2px rgba(0,0,0,0.3)" })} />
        </div>

        {/* ── 升级后院木牌 ── */}
        <div style={abs({ left: 2652, bottom: 150, width: 8, height: 104, borderRadius: 4, background: "#8A6437" })} />
        <button
          type="button"
          className="by-upgrade-btn"
          style={{ left: 2596, bottom: 246 }}
          disabled={busy || yardMaxed || (yardUpgradeCost != null && save.coins < yardUpgradeCost)}
          onClick={(event) => {
            event.stopPropagation();
            onUpgradeYard();
          }}
        >
          {yardMaxed ? (
            <span>后院已满级 · {yardCapacity} 只</span>
          ) : (
            <>
              <span>⬆ 升级后院 Lv{save.yardLevel + 1}</span>
              <span className="by-upgrade-sub">
                {yardUpgradeCost} 🪙 → {config.yardCapacity[save.yardLevel]} 只
              </span>
            </>
          )}
        </button>

        {/* ── 驻留伙伴（点击直接打工） ── */}
        {placedPets.map(({ pet, spot }) => {
          const info = config.species[pet.species];
          const max = isMaxLevel(config, pet);
          return (
            <div
              key={pet.id}
              className={`by-pet ${pet.exhausted ? "is-exhausted" : ""}`}
              style={{
                // 闲时踱步：在驻留点附近平滑挪动几步（left 过渡由 CSS 控制）
                left: spot.x - spot.size / 2 + (quirk?.petId === pet.id ? quirk.dx : 0),
                bottom: spot.bottom,
                width: spot.size,
                height: spot.size,
              }}
              title={pet.exhausted ? "睡着了…精力恢复中" : `${info?.nameZh ?? ""}（点击打工）`}
              onClick={(event) => workClick(pet, event)}
            >
              <span className="by-pet-tag">
                {pet.exhausted ? "💤 " : ""}
                {info?.nameZh ?? pet.species} Lv{pet.level}
                {max ? " ★" : ""}
              </span>
              <div
                className="by-pet-body"
                style={quirk?.petId === pet.id && quirk.facing === -1 ? { transform: "scaleX(-1)" } : undefined}
              >
                <div className={`pet-react-pulse ${pulseClassFor(pet.id)}`}>
                  <SvgSprite
                    species={pet.species}
                    config={config}
                    petState={
                      pet.exhausted
                        ? "exhausted"
                        : laboringIds.has(pet.id)
                          ? "laboring"
                          : quirk?.petId === pet.id
                            ? quirk.kind === "stroll"
                              ? "moving"
                              : "success"
                            : "idle"
                    }
                  />
                </div>
              </div>
              {petFx
                .filter((fx) => fx.petId === pet.id)
                .map((fx) => (
                  <span key={fx.id} className="by-work-fx">
                    <WorkBurst species={fx.species} tier={fx.tier} seed={fx.seed} boom={fx.boom} screen />
                    <ReactionBurst color={fx.color} />
                  </span>
                ))}
            </div>
          );
        })}

        {/* ── 靠近伙伴：动作牌插在脚下的土层剖面里（融合大牌 + 陪伴/放生错位小牌） ── */}
        {nearPlaced &&
          (() => {
            const { pet, spot } = nearPlaced;
            const hint = fusionHintFor(pet);
            const canFuse = hint == null && !busy;
            return (
              <div className="by-bubble" style={{ left: spot.x - 150, bottom: 68 }} onClick={stopClick}>
                {/* 左：大融合印章（与右列两个小按钮等高）；右：陪伴/放生上下排布。
                    条件未达成的原因由主角头顶气泡说明（10s 后消失）。 */}
                <div className="by-bubble-actions">
                  <button
                    type="button"
                    className={`by-bubble-fuse ${canFuse ? "" : "is-disabled"}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!canFuse || !activePet) return;
                      onFuse(activePet.id, pet.id);
                    }}
                  >
                    <b>✨ 融合</b>
                    <small>{canFuse ? `${config.fusionFee} 🪙` : "条件未满足"}</small>
                  </button>
                  <div className="by-bubble-col">
                    <button
                      type="button"
                      className="by-bubble-mini"
                      disabled={busy}
                      onClick={(event) => {
                        event.stopPropagation();
                        onFollow(pet.id);
                      }}
                    >
                      🤝 陪伴
                    </button>
                    {confirmRelease ? (
                      <button
                        type="button"
                        className="by-bubble-mini is-danger"
                        disabled={busy || save.pets.length <= 1}
                        onClick={(event) => {
                          event.stopPropagation();
                          setConfirmRelease(false);
                          onRelease(pet.id);
                        }}
                      >
                        确认放生（返 {releaseRefund(pet)} 🪙）
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="by-bubble-mini is-danger"
                        disabled={busy || save.pets.length <= 1}
                        title={save.pets.length <= 1 ? "最后一只伙伴不能放生" : undefined}
                        onClick={(event) => {
                          event.stopPropagation();
                          setConfirmRelease(true);
                        }}
                      >
                        放生
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

        {/* ── 主角：跟随中的精灵（点击直接打工；恢复中也保持正常姿态可移动） ── */}
        {activePet && (
          <div
            ref={charRef}
            className="by-char"
            style={{ left: SPAWN_X - CHAR_SIZE / 2, bottom: CHAR_BOTTOM, width: CHAR_SIZE, height: CHAR_SIZE }}
            title={
              activePet.exhausted
                ? "精力恢复中…还可以带它散步"
                : `${config.species[activePet.species]?.nameZh ?? ""}（点击打工）`
            }
            onClick={(event) => workClick(activePet, event)}
          >
            {/* 头顶对话气泡：提示 > 融合条件 > 台词（紧贴头顶，不要过高） */}
            {charSay && (
              <div className="by-char-say" key={charSay}>
                {charSay}
              </div>
            )}
            {activePet.exhausted && !charSay && (
              <span className="by-char-zzz">
                💤 精力恢复中 {activePet.stamina}/{config.staminaMax}
              </span>
            )}
            <div ref={charFaceRef} className="by-char-face">
              <div className={`by-char-walk ${walking ? "is-walking" : ""}`}>
                <div className={`pet-react-pulse ${pulseClassFor(activePet.id)}`}>
                  <SvgSprite species={activePet.species} config={config} petState={charState} />
                </div>
              </div>
            </div>
            {petFx
              .filter((fx) => fx.petId === activePet.id)
              .map((fx) => (
                <span key={fx.id} className="by-work-fx">
                  <WorkBurst species={fx.species} tier={fx.tier} seed={fx.seed} boom={fx.boom} screen />
                  <ReactionBurst color={fx.color} />
                </span>
              ))}
            {/* 进食收益飘字：跟着主角走（世界坐标锚定） */}
            {fedPulse && (
              <span className="by-char-pops" key={fedPulse.id} aria-hidden="true">
                {fedPulse.exp > 0 && (
                  <span className="exp-pop pop-exp exp-pop-lane-0">
                    <span className="pop-icon">✨</span>+{fedPulse.exp}
                  </span>
                )}
                {fedPulse.coins > 0 && (
                  <span className="exp-pop pop-coin exp-pop-lane-2">
                    <span className="pop-icon">🪙</span>+{fedPulse.coins}
                  </span>
                )}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ===== 泥土层常驻 UI：左下角同框牌簇（后院在上，返回/金币在下） ===== */}
      <div className="by-soil-ui" onClick={stopClick}>
        <div className="by-soil-chip by-soil-title">
          <span className="by-bar-name">后 院</span>
          <span className="by-bar-sub">
            Lv{save.yardLevel} · {save.pets.length}/{yardCapacity} 只
          </span>
        </div>
        <div className="by-soil-row">
          <button
            type="button"
            className="by-soil-chip by-soil-back"
            title="回到宠物（Esc）"
            onClick={(event) => {
              event.stopPropagation();
              onBack();
            }}
          >
            ← 返回
          </button>
          <div className="by-soil-chip by-soil-coins" title="金币">
            🪙 {save.coins.toLocaleString()}
          </div>
        </div>
      </div>

      {/* 可融合提示：右下角泥土层 */}
      {fuseGoal && (
        <div className="by-soil-goal" onClick={stopClick}>
          <span className="by-bar-goal-dot" />
          <span>
            可融合：{config.species[fuseGoal.a.species]?.nameZh ?? fuseGoal.a.species} +{" "}
            {config.species[fuseGoal.b.species]?.nameZh ?? fuseGoal.b.species} → <b>？？？</b>
            {fuseAffordable ? ` · ${config.fusionFee} 🪙` : `（还差 ${config.fusionFee - save.coins} 🪙）`}
          </span>
        </div>
      )}

      {/* 首次进入的移动引导（一次性；开始移动或超时后永久消失） */}
      {showGuide && (
        <div className="by-guide">
          <span className="by-guide-title">🖱 点击场景走过去 · ⌨ ← → / A D 移动</span>
          <span className="by-guide-sub">走到商店、公告板或伙伴身边看看吧 · 拖动窗口边缘可以缩放后院</span>
        </div>
      )}
      </div>

      {/* ===== 图鉴全屏浮层（不随舞台缩放，保证清晰） ===== */}
      {dexOpen && (
        <div
          className="by-dex-overlay"
          onClick={(event) => {
            event.stopPropagation();
            setDexOpen(false);
          }}
        >
          <div className="by-dex-panel" onClick={stopClick}>
            <header className="by-dex-head">
              <span className="by-dex-title">📖 图鉴</span>
              <span className="by-dex-progress">
                已收集 {collectedSpecies.size}/{dexSpecies.length}
              </span>
              <button
                type="button"
                className="by-dex-close"
                title="关闭（Esc）"
                onClick={(event) => {
                  event.stopPropagation();
                  setDexOpen(false);
                }}
              >
                ✕
              </button>
            </header>
            <div className="by-dex-grid">
              {dexSpecies.map((species) => {
                const info = config.species[species];
                const collected = collectedSpecies.has(species);
                return (
                  <div key={species} className={`by-dex-cell ${collected ? "is-collected" : "is-unknown"}`}>
                    <div className="by-dex-cell-sprite">
                      <SvgSprite species={species} config={config} petState="idle" />
                      {!collected && <span className="by-dex-q">?</span>}
                    </div>
                    <span className="by-dex-cell-name">{collected ? info?.nameZh ?? species : "？？？"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
