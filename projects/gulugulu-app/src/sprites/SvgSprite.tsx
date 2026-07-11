import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { GameConfig, PetState } from "../types";
import { OUTLINE, type Expression, type RigComponent, type RigSlots } from "./rigTypes";
import { getSpeciesVisual } from "./speciesTable";
import { DuckRig } from "./rigs/duckRig";
import { FoxRig } from "./rigs/foxRig";
import { MouseRig } from "./rigs/mouseRig";
import { MushroomRig } from "./rigs/mushroomRig";
import { WhaleRig } from "./rigs/whaleRig";
import { YetiRig } from "./rigs/yetiRig";
import { TOOLS } from "./parts/tools";
import { FxLayer, type FxLevel } from "./parts/vfx";
import { SleepZzz, SweatDrop, ThinkDots } from "./parts/common";

// -----------------------------------------------------------------------------
// SvgSprite —— 装配器（计划 §2.2）
// 查 speciesTable → 选 rig（moving 用侧视）→ 注入槽位/调色板/工具/粒子层。
// 动作全部由 sprites.css 按 `.svg-sprite-state-<petState>` 驱动。
// -----------------------------------------------------------------------------

const RIGS: Partial<Record<string, RigComponent>> = {
  duck: DuckRig,
  fox: FoxRig,
  mouse: MouseRig,
  mushroom: MushroomRig,
  whale: WhaleRig,
  yeti: YetiRig,
};

function fxLevelForState(state: PetState): FxLevel {
  switch (state) {
    case "sleeping":
    case "exhausted":
      return "off";
    case "success":
      return "burst";
    case "working":
    case "laboring":
    case "moving":
    case "fed":
      return "med";
    default:
      return "low";
  }
}

/** petState → 呆萌表情（计划：每个动作不同的面部表情） */
function expressionForState(state: PetState): Expression {
  switch (state) {
    case "thinking":
      return "think";
    case "moving":
      return "happy";
    case "working":
    case "laboring":
      return "effort";
    case "success":
      return "star";
    case "fed":
      return "munch";
    case "sleeping":
    case "exhausted":
      return "sleep";
    case "drag_start":
    case "dragging":
    case "drop":
      return "surprised";
    case "error":
      return "dizzy";
    case "clicked":
      return "happy";
    default:
      return "normal";
  }
}

export type SvgSpriteProps = {
  species: string;
  config: GameConfig;
  petState?: PetState;
  className?: string;
  style?: CSSProperties;
};

export function SvgSprite({ species, config, petState = "idle", className, style }: SvgSpriteProps) {
  const info = config.species[species];
  const visual = getSpeciesVisual(species, info);
  const Rig = RIGS[visual.rig] ?? DuckRig;
  const view = petState === "moving" ? "side" : "front";
  const fxLevel = fxLevelForState(petState);
  const elements = (info?.elements ?? ["normal"]).slice(0, 2);

  const slots: RigSlots = { ...(visual.buildSlots?.(visual.palette, view) ?? {}) };
  const toolRenderer = visual.toolId ? TOOLS[visual.toolId] : undefined;
  if (toolRenderer && !slots.tool) {
    slots.tool = toolRenderer(visual.palette);
  }

  const rootClass = [
    "svg-sprite",
    `svg-sprite-state-${petState}`,
    `sprite-rig-${visual.rig}`,
    `sprite-stage-${visual.stage}`,
    `fx-${fxLevel}`,
    visual.floating ? "sprite-floating" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <svg
      viewBox="0 0 256 256"
      className={rootClass}
      style={{ ...visual.cssVars, ...style }}
      role="img"
      aria-label={info?.nameZh ?? species}
    >
      {/* 地面影子（漂浮物种小影子，与身体留空隙） */}
      <ellipse className="sprite-shadow" cx={128} cy={236} rx={visual.shadowRx ?? 58} ry={10} fill={OUTLINE} opacity={0.14} />
      <g className="svg-sprite-body">
        <g
          transform={
            visual.scale !== 1
              ? `translate(128 233) scale(${visual.scale}) translate(-128 -233)`
              : undefined
          }
        >
          <Rig
            view={view}
            stage={visual.stage}
            palette={visual.palette}
            slots={slots}
            eyes={visual.eyes}
            expression={expressionForState(petState)}
            pose={petState === "sleeping" || petState === "exhausted" ? "lie" : "stand"}
          />
          {/* 进食互动：Token 饼干飞入嘴边，分三口吃掉（动画见 sprites.css） */}
          {petState === "fed" && (
            <g transform={`translate(${visual.foodAnchor?.x ?? 132} ${visual.foodAnchor?.y ?? 168})`}>
              <g className="part-food">
                <g className="food-cookie">
                  <circle cx={0} cy={-6} r={11} fill="#F7D373" stroke={OUTLINE} strokeWidth={4} />
                  <circle cx={-3.5} cy={-9} r={1.7} fill="#B98A4E" />
                  <circle cx={3} cy={-4} r={1.5} fill="#B98A4E" />
                  <circle cx={1} cy={-10.5} r={1.3} fill="#B98A4E" />
                </g>
                <g className="food-crumbs" fill="#F7D373" stroke={OUTLINE} strokeWidth={1.6}>
                  <circle cx={-8} cy={2} r={2.2} />
                  <circle cx={7} cy={4} r={1.8} />
                </g>
              </g>
            </g>
          )}
        </g>
      </g>
      {/* 元素粒子层（不吃身体形变） */}
      <FxLayer elements={elements} />
      {(petState === "sleeping" || petState === "exhausted") && <SleepZzz />}
      {petState === "thinking" && <ThinkDots />}
      {petState === "error" && <SweatDrop />}
    </svg>
  );
}

export type EggSvgProps = {
  species: string;
  tier: number;
  config: GameConfig;
  /** "incubating" adds a wobble, "ready" adds glow + shake. */
  phase?: "idle" | "incubating" | "ready";
  /** 孵化进度 0..1，驱动裂纹在 25/50/75% 逐条显现（蛋语·OnboardingFlow §二·3）。 */
  progress?: number;
  /** 距孵化完成秒数；≤10 触发临门抖动加频。 */
  secondsLeft?: number;
  className?: string;
};

/** Shared egg template: white shell + element-colored blotches; tier-2 eggs
 *  get a golden rim. Onboarding "蛋语": progressive cracks by hatch progress,
 *  a wondering "?" bubble while incubating, faster shake in the last 10s, and
 *  for tier-2 eggs a color carousel teasing the 21 possible outcomes. */
export function EggSvg({
  species,
  tier,
  config,
  phase = "idle",
  progress,
  secondsLeft,
  className,
}: EggSvgProps) {
  const info = config.species[species];
  const colors = info?.colors ?? ["#F5C542"];
  const primary = colors[0];
  const secondary = colors[1] ?? colors[0];
  const isTier2 = tier >= 2;
  const incubating = phase === "incubating";
  const ready = phase === "ready";
  const soon = !ready && secondsLeft != null && secondsLeft <= 10;

  // 裂纹递进：按孵化进度在 25/50/75% 逐条显现（缺省进度按 phase 粗略推断）。
  const prog = progress ?? (ready ? 1 : incubating ? 0.5 : 0);
  const cracks = prog >= 0.75 ? 3 : prog >= 0.5 ? 2 : prog >= 0.25 ? 1 : 0;

  // 2 阶蛋：孵化中循环轮播"21 种可能"的属性色，把死倒计时变成期待素材。
  const tier2Palette = useMemo(() => {
    if (!isTier2) return [] as string[];
    return Array.from(new Set(Object.values(config.fusionTable)))
      .map((sp) => config.species[sp]?.colors?.[0])
      .filter((c): c is string => Boolean(c));
  }, [config, isTier2]);
  const [teaseIndex, setTeaseIndex] = useState(0);
  useEffect(() => {
    if (!isTier2 || phase === "idle" || tier2Palette.length === 0) return;
    const timer = window.setInterval(
      () => setTeaseIndex((index) => (index + 1) % tier2Palette.length),
      900,
    );
    return () => window.clearInterval(timer);
  }, [isTier2, phase, tier2Palette.length]);
  const teaseColor = ready ? primary : tier2Palette[teaseIndex] ?? primary;

  const phaseClass = ready
    ? "egg-phase-ready"
    : soon
      ? "egg-phase-soon"
      : incubating
        ? "egg-phase-incubating"
        : "egg-phase-idle";

  return (
    <svg
      viewBox="0 0 128 128"
      className={`egg-svg ${phaseClass} ${className ?? ""}`}
      role="img"
      aria-label={`${info?.nameZh ?? species}的蛋`}
    >
      {(ready || (isTier2 && phase !== "idle")) && (
        <circle
          cx={64}
          cy={70}
          r={52}
          fill={isTier2 ? teaseColor : primary}
          opacity={0.25}
          className="egg-glow"
        />
      )}
      <ellipse cx={64} cy={112} rx={34} ry={7} fill={OUTLINE} opacity={0.14} />
      <g className="egg-shell">
        <path
          d="M64 14 q34 0 34 56 q0 44 -34 44 q-34 0 -34 -44 q0 -56 34 -56 z"
          fill="#FFFDF6"
          stroke={isTier2 ? "#D9A514" : OUTLINE}
          strokeWidth={isTier2 ? 7 : 5}
        />
        <g opacity={0.85}>
          <circle cx={50} cy={58} r={9} fill={isTier2 ? teaseColor : primary} />
          <circle cx={78} cy={44} r={6} fill={secondary} />
          <circle cx={74} cy={82} r={8} fill={isTier2 ? teaseColor : primary} opacity={0.7} />
          <circle cx={48} cy={88} r={5} fill={secondary} opacity={0.7} />
        </g>
        {/* 2 阶神秘核：孵化中透出轮播色 + ?，暗示结果尚未揭晓 */}
        {isTier2 && !ready && phase !== "idle" && (
          <g className="egg-tease">
            <circle cx={64} cy={66} r={15} fill={teaseColor} opacity={0.92} stroke={OUTLINE} strokeWidth={3} />
            <text x={64} y={73} textAnchor="middle" fontSize={19} fontWeight={900} fill="#FFFDF6">
              ?
            </text>
          </g>
        )}
        {/* 裂纹递进（进度驱动） */}
        {cracks > 0 && (
          <g className="egg-cracks" stroke={OUTLINE} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M60 26 l6 8 l-5 7 l7 6" opacity={cracks >= 1 ? 1 : 0} />
            {cracks >= 2 && <path d="M90 58 l-7 5 l6 7 l-8 5" />}
            {cracks >= 3 && <path d="M42 74 l7 4 l-4 8 l8 5" />}
          </g>
        )}
        <ellipse cx={52} cy={38} rx={10} ry={16} fill="#fff" opacity={0.65} transform="rotate(-18 52 38)" />
      </g>
      {/* 蛋语：孵化中偶尔冒出的"?"心思气泡 */}
      {incubating && (
        <g className="egg-wonder" aria-hidden="true">
          <circle cx={96} cy={30} r={11} fill="#FFFDF6" stroke={OUTLINE} strokeWidth={3} />
          <circle cx={84} cy={44} r={3.4} fill="#FFFDF6" stroke={OUTLINE} strokeWidth={2.4} />
          <text x={96} y={35} textAnchor="middle" fontSize={13} fontWeight={900} fill={OUTLINE}>
            ?
          </text>
        </g>
      )}
    </svg>
  );
}
