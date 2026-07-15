import type { ReactNode } from "react";
import type {
  CustomPart,
  CustomSpeciesEntry,
  CustomVisualSpec,
  CustomWorkFx,
  ShapeNode,
  SlotSpec,
} from "../types";
import fusionCatalog from "../game/fusionParts.json";
import {
  OUTLINE,
  type ChimeraForm,
  type EyeVariant,
  type RigKind,
  type RigPalette,
  type RigSlots,
  type RigView,
  type SpeciesVisual,
} from "./rigTypes";
import { chimeraFitScale, chimeraFxEmitter } from "./rigs/chimeraRig";
import { FlameTail, PointedEars, SideEar as FoxSideEar, SmallFlame } from "./kits/fireKit";
import { BoltTail, SparkCheeks, RoundEars, SideEar as MouseSideEar } from "./kits/electricKit";
import { BellyWave, Fluke, Spout } from "./kits/waterKit";
import { CapSpots, MiniShroom, MushroomCap, Sprout } from "./kits/grassKit";
import { FurRidge, IceSpikes } from "./kits/iceKit";
import {
  BunnyEarTufts,
  IceFloe,
  IcicleCrown,
  LilyPadHat,
  RedCape,
  SilverCrown,
  StaticCrown,
  StormCloud,
  WaveCrest,
} from "./kits/specials";
import { Ahoge, DuckTailFan, FluffTuft } from "./kits/duckKit";

// -----------------------------------------------------------------------------
// AI 融合自定义物种（计划：AI 融合机制）
// - PART_REGISTRY：把现有 kit 件包成"字符串可寻址"的部件（id 与
//   src/game/fusionParts.json 一一对应），摆放 transform 取自 speciesTable
//   已验证过的二阶条目。
// - CustomPart/ShapeNode：AI 完全重绘的部件走结构化 JSON → React SVG 白名单
//   渲染（不接受原始 SVG 字符串）。画在槽位局部坐标系，rig 的 <Part> 包装
//   自动给定位与 CSS 动画。
// - registerCustomSpecies/getCustomVisual：模块级运行时注册表，
//   speciesTable.getSpeciesVisual 查不到内置条目时来这里找。
// 本文件不 import speciesTable（speciesTable 反向 import 本文件）。
// -----------------------------------------------------------------------------

export type SlotName = "tail" | "headTop" | "back" | "cheeks" | "marking" | "platform";

export const SLOT_NAMES: SlotName[] = ["tail", "headTop", "back", "cheeks", "marking", "platform"];

const RIG_KEYS = Object.keys(fusionCatalog.rigs) as RigKind[];
const EYE_KEYS = fusionCatalog.eyes as EyeVariant[];
const TOOL_KEYS = Object.keys(fusionCatalog.tools);

/** AI 融合物种统一走参数化 chimera 底座（弃用动物 rig）。 */
export const CHIMERA_RIG = "chimera";
const BODY_PLANS = ["stack", "round", "upright", "quadruped", "long", "floaty", "bighead"] as const;
const HEAD_STYLES = ["merged", "perched"] as const;
const LEG_STYLES = ["none", "stub", "tall"] as const;
const ARM_STYLES = ["none", "nub", "wing", "flipper"] as const;
const EAR_STYLES = ["none", "round", "point", "long", "fin"] as const;

const DEFAULT_FORM: ChimeraForm = {
  bodyPlan: "stack",
  segments: 1,
  bodyW: 1,
  bodyH: 1,
  taper: 0.3,
  headStyle: "merged",
  headScale: 0.8,
  legStyle: "stub",
  legCount: 2,
  armStyle: "nub",
  earStyle: "round",
  floating: false,
};

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function num(value: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(hi, Math.max(lo, n));
}

/** 归一化并夹取 chimera form（宽容：缺字段用默认，越界夹取，不抛错）。
 *  headScale 下限 0.7 = 可爱底线：脸随头走，头太小表情不可读。 */
export function normalizeChimeraForm(raw: unknown): ChimeraForm {
  const f = (raw && typeof raw === "object" ? raw : {}) as Partial<ChimeraForm>;
  const bodyPlan = oneOf(f.bodyPlan, BODY_PLANS, "stack");
  const segments = (Math.min(3, Math.max(1, Math.round(num(f.segments, 1, 3, 1)))) || 1) as 1 | 2 | 3;
  return {
    bodyPlan,
    segments,
    bodyW: num(f.bodyW, 0.75, 1.3, 1),
    bodyH: num(f.bodyH, 0.75, 1.35, 1),
    taper: num(f.taper, 0, 1, 0.3),
    headStyle: oneOf(f.headStyle, HEAD_STYLES, "merged"),
    headScale: num(f.headScale, 0.7, 1, 0.8),
    legStyle: oneOf(f.legStyle, LEG_STYLES, "stub"),
    legCount: (num(f.legCount, 2, 4, 2) >= 3 ? 4 : 2) as 2 | 4,
    armStyle: oneOf(f.armStyle, ARM_STYLES, "nub"),
    earStyle: oneOf(f.earStyle, EAR_STYLES, "round"),
    // floaty 体型天然离地：强制 floating，使影子/idle 上下浮动与画面一致。
    floating: bodyPlan === "floaty" ? true : Boolean(f.floating),
  };
}

export type PartRenderer = (palette: RigPalette, view: RigView) => ReactNode;

/** 现有 kit 件的声明式包装。id 与 fusionParts.json 的 slots 段一一对应。 */
export const PART_REGISTRY: Record<SlotName, Record<string, PartRenderer>> = {
  tail: {
    duckCurl: (p) => <DuckTailFan color={p.deep} />,
    flame: () => (
      <g transform="rotate(6) scale(0.55)">
        <FlameTail />
      </g>
    ),
    flameTriple: () => (
      <g>
        <g transform="rotate(-26) scale(0.72)">
          <FlameTail layers={2} />
        </g>
        <g transform="rotate(24) scale(0.72)">
          <FlameTail layers={2} />
        </g>
        <FlameTail scale={0.98} />
      </g>
    ),
    bolt: (p) => (
      <g transform="rotate(-14)">
        <BoltTail color={p.accent} scale={0.85} />
      </g>
    ),
    boltDouble: (p) => <BoltTail color={p.accent} double scale={1.1} />,
    fluke: (p) => (
      <g transform="scale(0.85)">
        <Fluke color={p.accent} deep={p.deep} />
      </g>
    ),
    iceSpikesTail: () => (
      <g transform="scale(0.72)">
        <IceSpikes count={3} />
      </g>
    ),
    pomIceTail: (p) => (
      <g>
        <circle cx={-4} cy={-10} r={13} fill={p.belly} stroke={OUTLINE} strokeWidth={4.5} />
        <g transform="translate(-9 -19) rotate(-18) scale(0.55)">
          <IceSpikes count={1} />
        </g>
      </g>
    ),
    flameBolt: (p) => (
      <g>
        <FlameTail scale={0.9} layers={2} />
        <g transform="translate(4 -34) rotate(10) scale(0.8)">
          <BoltTail color={p.accent} />
        </g>
      </g>
    ),
  },
  headTop: {
    ahoge: (p) => <Ahoge color={p.body} />,
    fluffTuft: (p) => <FluffTuft color={p.body} h={20} />,
    pointedEars: (p, view) =>
      view === "front" ? (
        <PointedEars color={p.body} inner={p.belly} />
      ) : (
        <FoxSideEar color={p.body} inner={p.belly} />
      ),
    roundEars: (p, view) =>
      view === "front" ? (
        <RoundEars body={p.body} inner={p.belly} r={18} spread={28} />
      ) : (
        <MouseSideEar body={p.body} inner={p.belly} r={17} />
      ),
    spout: (p) => <Spout scale={0.8} nozzle={p.deep} />,
    spoutDouble: (p) => <Spout double nozzle={p.deep} />,
    sprout: () => <Sprout scale={0.9} />,
    miniShroomTrio: () => (
      <g>
        <g transform="translate(-30 8) rotate(-10)">
          <MiniShroom color="#FFF4DC" deep="#8CD97B" />
        </g>
        <g transform="translate(26 6) rotate(8)">
          <MiniShroom color="#8CD97B" />
        </g>
        <g transform="translate(-3 0) scale(1.3)">
          <MiniShroom color="#57B84C" deep="#3B8F33" />
        </g>
      </g>
    ),
    mushroomCapHat: (p) => (
      <g transform="translate(0 5)">
        <MushroomCap scale={0.36} color={p.accent} deep={p.deep} outlineWidth={14}>
          <CapSpots />
        </MushroomCap>
      </g>
    ),
    silverCrown: () => <SilverCrown />,
    staticCrown: () => <StaticCrown />,
    icicleCrown: () => <IcicleCrown />,
    lilyPadSprout: () => (
      <g>
        <LilyPadHat scale={0.8} />
        <g transform="translate(8 -3)">
          <Sprout scale={0.7} />
        </g>
      </g>
    ),
    bunnyEarTufts: () => <BunnyEarTufts />,
    stormCloud: () => (
      <g transform="translate(0 -8)">
        <StormCloud />
      </g>
    ),
    steamPuffs: () => (
      <g>
        <circle cx={0} cy={-10} r={9} fill="#F7FCFD" stroke={OUTLINE} strokeWidth={3} opacity={0.95} />
        <circle cx={-9} cy={-22} r={6.5} fill="#F7FCFD" opacity={0.8} />
        <circle cx={9} cy={-27} r={5} fill="#F7FCFD" opacity={0.65} />
      </g>
    ),
    flameTrio: () => (
      <g>
        <g transform="translate(-14 3) rotate(-18)">
          <SmallFlame scale={0.75} />
        </g>
        <SmallFlame />
        <g transform="translate(14 3) rotate(16)">
          <SmallFlame scale={0.7} />
        </g>
      </g>
    ),
    flameCrest: () => <SmallFlame scale={0.85} />,
  },
  back: {
    furRidge: (p, view) =>
      view === "side" ? (
        <g transform="translate(-6 -2) rotate(150)">
          <FurRidge width={60} teeth={6} depth={11} color={p.belly} />
        </g>
      ) : (
        <FurRidge width={112} teeth={9} depth={12} color={p.belly} />
      ),
    iceSpikesBack: (p) => <IceSpikes count={5} scale={1.1} color={p.accent} highlight={p.belly} />,
    redCape: () => <RedCape width={72} length={56} />,
    waveCrest: () => <WaveCrest scale={1.1} />,
    foxEarsBack: (p, view) =>
      view === "front" ? (
        <g transform="translate(0 -8)">
          <PointedEars color={p.body} inner={p.belly} scale={1.05} />
        </g>
      ) : (
        <g transform="translate(-6 -8)">
          <FoxSideEar color={p.body} inner={p.belly} scale={1.0} />
        </g>
      ),
  },
  cheeks: {
    sparkCheeks: () => <SparkCheeks spread={26} r={6} />,
    leafCheeks: () => <SparkCheeks color="#8CD97B" spread={23.5} r={6} />,
  },
  marking: {
    bellyWave: (p) => (
      <g transform="translate(0 12) scale(0.5)">
        <BellyWave color={p.belly} wave={p.accent} />
      </g>
    ),
    chestZigzag: (p) => (
      <path
        d="M-20 -4 l8 -8 8 8 8 -8 8 8 8 -8"
        fill="none"
        stroke={p.accent}
        strokeWidth={4.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
    frostSpots: (p) => (
      <g opacity={0.85}>
        <circle cx={-24} cy={-8} r={4} fill={p.accent} />
        <circle cx={26} cy={-12} r={3.4} fill={p.accent} />
        <circle cx={4} cy={8} r={3} fill={p.accent2 ?? p.belly} />
      </g>
    ),
    mossPatches: (p) => (
      <g fill={p.accent} opacity={0.85}>
        <ellipse cx={-32} cy={2} rx={10} ry={6} transform="rotate(-18 -32 2)" />
        <ellipse cx={34} cy={-4} rx={8} ry={5} transform="rotate(14 34 -4)" />
        <circle cx={20} cy={16} r={4.5} fill={p.accent2 ?? p.accent} />
      </g>
    ),
    emberSpots: () => (
      <g>
        <g fill="#7A3B24" opacity={0.85}>
          <circle cx={-28} cy={-8} r={8} />
          <circle cx={22} cy={-20} r={6} />
          <circle cx={38} cy={6} r={6.5} />
        </g>
        <g transform="translate(-40 36) rotate(-14)">
          <SmallFlame scale={0.5} />
        </g>
        <g transform="translate(38 34) rotate(12)">
          <SmallFlame scale={0.5} />
        </g>
      </g>
    ),
    lotusRipples: (p) => (
      <g>
        <circle cx={-36} cy={-24} r={7} fill={p.accent2 ?? p.accent} opacity={0.7} />
        <circle cx={42} cy={-30} r={5.5} fill={p.accent2 ?? p.accent} opacity={0.7} />
        <path
          d="M-24 22 q10 -8 20 0 M12 26 q10 -8 20 0"
          stroke={p.accent}
          strokeWidth={3.5}
          strokeLinecap="round"
          fill="none"
          opacity={0.75}
        />
      </g>
    ),
  },
  platform: {
    iceFloe: () => <IceFloe width={132} />,
  },
};

/** marking 槽在各 rig 的"身体正面中心"锚点（蘑菇=帽面中心）。
 *  注册表/自定义 marking 件都画在局部坐标，这里统一平移到位。 */
const MARKING_ANCHOR: Partial<Record<RigKind, { x: number; y: number }>> = {
  duck: { x: 128, y: 188 },
  fox: { x: 128, y: 186 },
  mouse: { x: 128, y: 186 },
  whale: { x: 128, y: 172 },
  mushroom: { x: 128, y: 112 },
  yeti: { x: 128, y: 186 },
};

/** 进食动画的嘴边食物锚点（取自各 rig 一阶条目的实测值）。 */
const FOOD_ANCHOR: Partial<Record<RigKind, { x: number; y: number }>> = {
  duck: { x: 130, y: 176 },
  fox: { x: 130, y: 177 },
  mouse: { x: 130, y: 192 },
  whale: { x: 132, y: 170 },
  mushroom: { x: 130, y: 198 },
  yeti: { x: 130, y: 132 },
};

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const PALETTE_TOKENS = new Set(fusionCatalog.paletteTokens);
const PATH_DATA_RE = /^[MmLlHhVvCcSsQqTtAaZz0-9\s,.\-]*$/;
const POINTS_RE = /^[0-9\s,.\-]*$/;
const TRANSFORM_RE =
  /^(\s*(translate|rotate|scale)\(\s*-?\d+(?:\.\d+)?(?:\s*[, ]\s*-?\d+(?:\.\d+)?){0,2}\s*\)\s*)+$/;
const NODE_TYPE_SET = new Set(["path", "circle", "ellipse", "rect", "polygon", "line"]);
const MAX_CUSTOM_NODES = 12;
const MAX_PATH_LEN = 600;
const MAX_SLOTS = 4;
const COORD_BOUND = 300;
export const SCALE_MIN = 1.05;
export const SCALE_MAX = 1.25;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function numbersWithinBounds(text: string): boolean {
  const matches = text.match(/-?\d+(?:\.\d+)?/g);
  if (!matches) return true;
  return matches.every((token) => Math.abs(Number(token)) <= COORD_BOUND);
}

function isValidColor(value: unknown): value is string {
  return typeof value === "string" && (value === "none" || PALETTE_TOKENS.has(value) || HEX_RE.test(value));
}

function validateShapeNode(node: ShapeNode, where: string): string | null {
  if (!node || typeof node !== "object") return `${where}: 节点必须是对象`;
  if (!NODE_TYPE_SET.has(node.type)) return `${where}: 未知节点类型 ${String(node.type)}`;
  if (node.fill != null && !isValidColor(node.fill)) return `${where}: fill 只能是调色板 token 或 #rrggbb`;
  if (node.stroke != null && !isValidColor(node.stroke)) return `${where}: stroke 只能是调色板 token 或 #rrggbb`;
  if (node.strokeWidth != null && (typeof node.strokeWidth !== "number" || node.strokeWidth < 0 || node.strokeWidth > 8)) {
    return `${where}: strokeWidth 需在 0~8`;
  }
  if (node.opacity != null && (typeof node.opacity !== "number" || node.opacity < 0 || node.opacity > 1)) {
    return `${where}: opacity 需在 0~1`;
  }
  if (node.transform != null && (typeof node.transform !== "string" || !TRANSFORM_RE.test(node.transform) || !numbersWithinBounds(node.transform))) {
    return `${where}: transform 只允许 translate/rotate/scale`;
  }
  if (node.type === "path") {
    if (typeof node.d !== "string" || node.d.length === 0) return `${where}: path 缺少 d`;
    if (node.d.length > MAX_PATH_LEN) return `${where}: d 过长（≤${MAX_PATH_LEN} 字符）`;
    if (!PATH_DATA_RE.test(node.d)) return `${where}: d 含非法字符`;
    if (!numbersWithinBounds(node.d)) return `${where}: d 坐标超界（|n|≤${COORD_BOUND}）`;
  }
  if (node.type === "polygon") {
    if (typeof node.points !== "string" || !POINTS_RE.test(node.points) || !numbersWithinBounds(node.points)) {
      return `${where}: polygon points 非法`;
    }
  }
  const numericKeys = ["cx", "cy", "r", "rx", "ry", "x", "y", "width", "height", "x1", "y1", "x2", "y2"] as const;
  for (const key of numericKeys) {
    const value = node[key];
    if (value != null && (typeof value !== "number" || Math.abs(value) > COORD_BOUND)) {
      return `${where}: ${key} 需为 |n|≤${COORD_BOUND} 的数字`;
    }
  }
  return null;
}

function isCustomPart(value: unknown): value is CustomPart {
  return Boolean(value) && typeof value === "object" && (value as CustomPart).kind === "custom";
}

export type ValidateResult = { ok: true; spec: CustomVisualSpec } | { ok: false; error: string };

/** 严格校验一份视觉规格（mock 生成器与测试用；真实管线由 Rust 端权威校验，
 *  渲染层另有静默兜底）。返回的 spec 已裁剪未知槽位并夹取 scale。 */
export function validateVisualSpec(raw: unknown): ValidateResult {
  if (!raw || typeof raw !== "object") return { ok: false, error: "spec 必须是 JSON 对象" };
  const spec = raw as CustomVisualSpec;
  const isChimera = spec.rig === CHIMERA_RIG;
  if (!isChimera && !RIG_KEYS.includes(spec.rig as RigKind)) {
    return { ok: false, error: `rig 必须是 ${CHIMERA_RIG} 或 ${RIG_KEYS.join("/")}` };
  }
  if (typeof spec.scale !== "number" || !Number.isFinite(spec.scale) || spec.scale < 0.8 || spec.scale > 1.6) {
    return { ok: false, error: "scale 需为 0.8~1.6 的数字" };
  }
  const palette = spec.palette;
  if (!palette || typeof palette !== "object") return { ok: false, error: "缺少 palette" };
  for (const key of ["body", "deep", "belly", "accent"] as const) {
    if (!HEX_RE.test(palette[key] ?? "")) return { ok: false, error: `palette.${key} 需为 #rrggbb` };
  }
  if (palette.accent2 != null && !HEX_RE.test(palette.accent2)) {
    return { ok: false, error: "palette.accent2 需为 #rrggbb" };
  }
  if (spec.eyes != null && !EYE_KEYS.includes(spec.eyes as EyeVariant)) {
    return { ok: false, error: `eyes 必须是 ${EYE_KEYS.join("/")} 之一` };
  }
  if (spec.toolId != null && !TOOL_KEYS.includes(spec.toolId)) {
    return { ok: false, error: `toolId 不在工具目录里：${spec.toolId}` };
  }
  const slots = spec.slots ?? {};
  if (typeof slots !== "object") return { ok: false, error: "slots 必须是对象" };
  const cleanSlots: Record<string, SlotSpec> = {};
  let filled = 0;
  for (const [slotName, value] of Object.entries(slots)) {
    if (!SLOT_NAMES.includes(slotName as SlotName)) {
      return { ok: false, error: `未知槽位 ${slotName}（可用：${SLOT_NAMES.join("/")}）` };
    }
    if (value == null) continue;
    filled += 1;
    if (typeof value === "string") {
      if (!PART_REGISTRY[slotName as SlotName][value]) {
        return { ok: false, error: `槽位 ${slotName} 没有部件 ${value}` };
      }
      cleanSlots[slotName] = value;
      continue;
    }
    if (!isCustomPart(value)) {
      return { ok: false, error: `槽位 ${slotName} 的值需是部件 id 或 {kind:"custom",nodes:[...]}` };
    }
    if (!Array.isArray(value.nodes) || value.nodes.length === 0 || value.nodes.length > MAX_CUSTOM_NODES) {
      return { ok: false, error: `槽位 ${slotName} 自定义节点数需 1~${MAX_CUSTOM_NODES}` };
    }
    for (let i = 0; i < value.nodes.length; i += 1) {
      const err = validateShapeNode(value.nodes[i], `${slotName}.nodes[${i}]`);
      if (err) return { ok: false, error: err };
    }
    cleanSlots[slotName] = { kind: "custom", nodes: value.nodes };
  }
  if (filled > MAX_SLOTS) return { ok: false, error: `槽位总数需 ≤${MAX_SLOTS}` };
  // 打工粒子（可选；有则逐节点校验）
  let workFx: CustomWorkFx | undefined;
  if (spec.workFx != null) {
    const particles = spec.workFx.particles;
    if (!Array.isArray(particles) || particles.length === 0 || particles.length > 4) {
      return { ok: false, error: "workFx.particles 需为 1~4 个粒子造型" };
    }
    for (let p = 0; p < particles.length; p += 1) {
      const nodes = particles[p]?.nodes;
      if (!Array.isArray(nodes) || nodes.length === 0 || nodes.length > 6) {
        return { ok: false, error: `workFx.particles[${p}] 节点数需 1~6` };
      }
      for (let i = 0; i < nodes.length; i += 1) {
        const err = validateShapeNode(nodes[i], `workFx[${p}].nodes[${i}]`);
        if (err) return { ok: false, error: err };
      }
    }
    workFx = { particles };
  }
  const form = isChimera ? normalizeChimeraForm(spec.form) : undefined;
  return {
    ok: true,
    spec: {
      rig: spec.rig,
      scale: clamp(spec.scale, SCALE_MIN, SCALE_MAX),
      palette: {
        body: palette.body,
        deep: palette.deep,
        belly: palette.belly,
        accent: palette.accent,
        accent2: palette.accent2 ?? null,
      },
      eyes: spec.eyes ?? null,
      toolId: spec.toolId ?? null,
      floating: isChimera ? form!.floating : Boolean(spec.floating),
      slots: cleanSlots,
      ...(form ? { form } : {}),
      ...(workFx ? { workFx } : {}),
    },
  };
}

function resolveColor(value: string | null | undefined, palette: RigPalette): string | undefined {
  if (!value) return undefined;
  switch (value) {
    case "none":
      return "none";
    case "$body":
      return palette.body;
    case "$deep":
      return palette.deep;
    case "$belly":
      return palette.belly;
    case "$accent":
      return palette.accent;
    case "$accent2":
      return palette.accent2 ?? palette.accent;
    case "$outline":
      return OUTLINE;
    default:
      return HEX_RE.test(value) ? value : undefined;
  }
}

function renderShapeNode(node: ShapeNode, palette: RigPalette, key: number): ReactNode {
  if (validateShapeNode(node, "node")) return null;
  const common = {
    fill: resolveColor(node.fill, palette) ?? "none",
    stroke: resolveColor(node.stroke, palette),
    strokeWidth: node.strokeWidth ?? undefined,
    strokeLinecap: (node.strokeLinecap === "butt" || node.strokeLinecap === "square" ? node.strokeLinecap : "round") as
      | "round"
      | "butt"
      | "square",
    strokeLinejoin: (node.strokeLinejoin === "miter" || node.strokeLinejoin === "bevel" ? node.strokeLinejoin : "round") as
      | "round"
      | "miter"
      | "bevel",
    fillRule: (node.fillRule === "evenodd" ? "evenodd" : undefined) as "evenodd" | undefined,
    opacity: node.opacity ?? undefined,
    transform: node.transform ?? undefined,
  };
  switch (node.type) {
    case "path":
      return <path key={key} d={node.d ?? ""} {...common} />;
    case "circle":
      return <circle key={key} cx={node.cx ?? 0} cy={node.cy ?? 0} r={node.r ?? 0} {...common} />;
    case "ellipse":
      return <ellipse key={key} cx={node.cx ?? 0} cy={node.cy ?? 0} rx={node.rx ?? 0} ry={node.ry ?? 0} {...common} />;
    case "rect":
      return (
        <rect
          key={key}
          x={node.x ?? 0}
          y={node.y ?? 0}
          width={node.width ?? 0}
          height={node.height ?? 0}
          rx={node.rx ?? undefined}
          {...common}
        />
      );
    case "polygon":
      return <polygon key={key} points={node.points ?? ""} {...common} />;
    case "line":
      return <line key={key} x1={node.x1 ?? 0} y1={node.y1 ?? 0} x2={node.x2 ?? 0} y2={node.y2 ?? 0} {...common} />;
    default:
      return null;
  }
}

/** 渲染一个槽位取值（部件 id 或自定义节点组）。非法内容静默跳过，绝不抛错。 */
function renderSlotSpec(slotName: SlotName, value: SlotSpec, palette: RigPalette, view: RigView): ReactNode {
  if (typeof value === "string") {
    const renderer = PART_REGISTRY[slotName][value];
    return renderer ? renderer(palette, view) : null;
  }
  if (!isCustomPart(value) || !Array.isArray(value.nodes)) return null;
  const nodes = value.nodes.slice(0, MAX_CUSTOM_NODES).map((node, index) => renderShapeNode(node, palette, index));
  if (nodes.every((n) => n == null)) return null;
  return <g>{nodes}</g>;
}

/** 视觉规格 → SpeciesVisual（渲染入口）。固定策略：stage=kid、whale 恒漂浮、
 *  scale 夹取、foodAnchor/marking 锚点按 rig 常量表。 */
export function buildVisualFromSpec(spec: CustomVisualSpec): SpeciesVisual {
  const isChimera = spec.rig === CHIMERA_RIG;
  const rig = (isChimera ? "chimera" : RIG_KEYS.includes(spec.rig as RigKind) ? spec.rig : "duck") as RigKind;
  const palette: RigPalette = {
    body: spec.palette.body,
    deep: spec.palette.deep,
    belly: spec.palette.belly,
    accent: spec.palette.accent,
    accent2: spec.palette.accent2 ?? undefined,
  };
  const form = isChimera ? normalizeChimeraForm(spec.form) : undefined;
  const floating = isChimera ? form!.floating : rig === "whale";
  const eyes = spec.eyes != null && EYE_KEYS.includes(spec.eyes as EyeVariant) ? (spec.eyes as EyeVariant) : undefined;
  const toolId = spec.toolId != null && TOOL_KEYS.includes(spec.toolId) ? spec.toolId : undefined;
  const slotEntries = Object.entries(spec.slots ?? {}).filter(
    ([name, value]) => SLOT_NAMES.includes(name as SlotName) && value != null,
  ) as Array<[SlotName, SlotSpec]>;
  // chimera 自己按参数化身体放置 marking，不套动物 rig 的固定锚点。
  const anchor = isChimera ? null : MARKING_ANCHOR[rig];
  return {
    rig,
    stage: "kid",
    // chimera：身体尺寸由 form 决定，scale 只用于把高身型收回画布内（≤1）。
    scale: isChimera
      ? chimeraFitScale(form)
      : clamp(typeof spec.scale === "number" && Number.isFinite(spec.scale) ? spec.scale : 1.12, SCALE_MIN, SCALE_MAX),
    palette,
    eyes,
    toolId,
    floating,
    form,
    shadowRx: floating ? 48 : undefined,
    foodAnchor: isChimera ? { x: 128, y: 150 } : FOOD_ANCHOR[rig],
    buildSlots: (p, view) => {
      const slots: RigSlots = {};
      for (const [slotName, value] of slotEntries) {
        const rendered = renderSlotSpec(slotName, value, p, view);
        if (rendered == null) continue;
        if (slotName === "marking" && anchor) {
          slots.marking = <g transform={`translate(${anchor.x} ${anchor.y})`}>{rendered}</g>;
        } else {
          slots[slotName] = rendered;
        }
      }
      return slots;
    },
  };
}

// --- 运行时注册表（useGame 在存档载入/刷新时灌入） -------------------------

let registeredEntries: Record<string, CustomSpeciesEntry> = {};
let visualCache = new Map<string, SpeciesVisual>();

/** 注册（重建）自定义物种视觉表。物种一经诞生不可变，键集合没变化就跳过重建。 */
export function registerCustomSpecies(map: Record<string, CustomSpeciesEntry> | null | undefined): void {
  const next = map ?? {};
  if (next === registeredEntries) return;
  const keys = Object.keys(next);
  const unchanged = keys.length === visualCache.size && keys.every((key) => visualCache.has(key));
  registeredEntries = next;
  if (unchanged) return;
  const rebuilt = new Map<string, SpeciesVisual>();
  for (const [codename, entry] of Object.entries(next)) {
    try {
      rebuilt.set(codename, buildVisualFromSpec(entry.visual));
    } catch {
      // 坏数据静默跳过：该物种走 getSpeciesVisual 的 config 兜底
    }
  }
  visualCache = rebuilt;
}

export function getCustomVisual(species: string): SpeciesVisual | undefined {
  return visualCache.get(species);
}

export function getCustomSpeciesEntry(species: string): CustomSpeciesEntry | undefined {
  return registeredEntries[species];
}

// --- 打工特效（WorkBurst 自定义物种通道） ---------------------------------

/** 解析后的自定义打工特效：可直接随 fx://burst 事件跨窗口传输（纯数据）。 */
export type ResolvedWorkFx = {
  emitter: { x: number; y: number };
  palette: RigPalette;
  particles: ShapeNode[][];
};

/** 彻底无工具、又无 AI 自绘粒子时的最后兜底（星星 + 泡泡 + 小心心）。
 *  正常路径下不该走到这里：新物种 toolId 必填 → 走工具产物；旧档若既无
 *  toolId 又无 workFx 才落此。 */
function fallbackFxParticles(): ShapeNode[][] {
  return [
    [
      {
        type: "path",
        d: "M0 -8 L2.2 -2.2 L8 0 L2.2 2.2 L0 8 L-2.2 2.2 L-8 0 L-2.2 -2.2 Z",
        fill: "$accent",
        stroke: "$outline",
        strokeWidth: 1.8,
      },
    ],
    [
      { type: "circle", cx: 0, cy: 0, r: 6.5, fill: "$belly", opacity: 0.6, stroke: "$accent2", strokeWidth: 2 },
      { type: "circle", cx: -2, cy: -2.2, r: 1.6, fill: "#FFFFFF", opacity: 0.95 },
    ],
    [
      {
        type: "path",
        d: "M0 -1 C-2.6 -6 -8 -5 -8 -0.8 C-8 3 -3 5.5 0 8 C3 5.5 8 3 8 -0.8 C8 -5 2.6 -6 0 -1 Z",
        fill: "$accent2",
        stroke: "$outline",
        strokeWidth: 1.8,
      },
    ],
  ];
}

/** 取一个自定义物种的打工特效（注册表 + 兜底合成）。未注册返回 null。 */
export function getCustomWorkFx(species: string): ResolvedWorkFx | null {
  const entry = registeredEntries[species];
  if (!entry) return null;
  const palette: RigPalette = {
    body: entry.visual.palette.body,
    deep: entry.visual.palette.deep,
    belly: entry.visual.palette.belly,
    accent: entry.visual.palette.accent,
    accent2: entry.visual.palette.accent2 ?? undefined,
  };
  const declared = entry.visual.workFx?.particles
    ?.map((particle) => particle.nodes)
    .filter((nodes) => Array.isArray(nodes) && nodes.length > 0);
  // 粒子=工具产物：AI 自绘为主；缺失但有 toolId 时留空数组，交 resolveWorkFx
  // 用该工具的 TOOL_FX 产物兜底；彻底无工具才退调色板兜底粒子。
  const particles =
    declared && declared.length > 0 ? declared : entry.visual.toolId ? [] : fallbackFxParticles();
  const emitter =
    entry.visual.rig === CHIMERA_RIG
      ? chimeraFxEmitter(normalizeChimeraForm(entry.visual.form))
      : { x: 186, y: 206 };
  return { emitter, palette, particles };
}

/** 渲染一个打工粒子造型（ShapeNode 白名单 → SVG；非法节点静默跳过）。 */
export function renderWorkFxParticle(nodes: ShapeNode[], palette: RigPalette): ReactNode {
  return <g>{nodes.slice(0, 6).map((node, index) => renderShapeNode(node, palette, index))}</g>;
}
