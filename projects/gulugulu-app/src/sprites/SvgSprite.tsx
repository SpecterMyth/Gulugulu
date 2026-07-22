import { type CSSProperties } from "react";
import type { GameConfig, PetState } from "../types";
import { OUTLINE, type Expression, type RigComponent, type RigSlots, type SpeciesVisual } from "./rigTypes";
import { getSpeciesVisual } from "./speciesTable";
import { DuckRig } from "./rigs/duckRig";
import { FoxRig } from "./rigs/foxRig";
import { MouseRig } from "./rigs/mouseRig";
import { MushroomRig } from "./rigs/mushroomRig";
import { WhaleRig } from "./rigs/whaleRig";
import { YetiRig } from "./rigs/yetiRig";
import { ChimeraRig } from "./rigs/chimeraRig";
import { CustomDataRig } from "./customSpecies";
import { TOOLS } from "./parts/tools";
import { FxLayer, type FxLevel } from "./parts/vfx";
import { GradeHalo, SleepZzz, SweatDrop, ThinkDots } from "./parts/common";
import { RIGS2 } from "./species2";

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
  chimera: ChimeraRig,
  // AI 完全手绘的专属 rig（数据驱动，见 customSpecies.CustomDataRig）
  custom: CustomDataRig,
  // 融合 2.0 新物种：一物种一 rig（键=codename，见 species2/）
  ...RIGS2,
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
      // 打工时压低元素氛围粒子（4→2 颗），把观感让给实物工具粒子 + 金币
      return "low";
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
  /** 阶数（融合 2.0）：≥2 时脚底渲染按阶变色的扩散光圈 */
  tier?: number;
  /** 显式外观覆盖（SkinWorkshop.md）：皮肤卡并排预览 / 工坊设定图离屏渲染用，
   *  绕过全局皮肤选择（getSpeciesVisual 链头）。常规渲染勿传。 */
  visual?: SpeciesVisual;
  className?: string;
  style?: CSSProperties;
};

export function SvgSprite({ species, config, petState = "idle", tier, visual: visualOverride, className, style }: SvgSpriteProps) {
  const info = config.species[species];
  const visual = visualOverride ?? getSpeciesVisual(species, info);
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
      {/* 阶数光圈（融合 2.0：2 阶起显示，颜色按阶） */}
      {tier != null && tier >= 2 && <GradeHalo tier={tier} rx={(visual.shadowRx ?? 58) + 10} />}
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
            iris={visual.iris}
            mouthStyle={visual.mouthStyle}
            expression={expressionForState(petState)}
            pose={petState === "sleeping" || petState === "exhausted" ? "lie" : "stand"}
            form={visual.form}
            rigData={visual.rigData}
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

// 分阶蛋美术已抽到 ./eggArt（元素表达 + 品阶华丽度阶梯）；此处仅再导出保持既有引用路径。
export { EggSvg, type EggSvgProps } from "./eggArt";
