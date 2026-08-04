import type { RigComponent, SpeciesVisual } from "../rigTypes";
import type { ToolRenderer } from "../parts/tools";
import type { WorkFxSpec } from "../parts/workFx";

// -----------------------------------------------------------------------------
// Species Pack 契约（融合 2.0 · SpeciesArtSpec §2）。
// 一物种一文件：rig + 视觉行 + 专属工具 + 打工粒子 + QA 元数据，
// 由 species2/index.ts 汇总派生 RIGS2/TOOLS2/WORK_FX2/VISUALS2。
// 设定唯一事实源：docs/gdd/SpeciesMatrix.md（codename 冻结）。
// -----------------------------------------------------------------------------

export type SpeciesPackMeta = {
  nameZh: string;
  /** 元素集合（去重 + 字典序，与 SpeciesMatrix 配方键一致） */
  elements: string[];
  /** 剪影家族（contact sheet 分组/配额审计用） */
  family: string;
  /** Front 视图工具锚（rig 内实际放置 <Part name="tool"> 的外层坐标） */
  toolAnchor: { x: number; y: number };
  /** 渲染节点预算（QA 脚本按元素数档位校验） */
  nodeBudget: number;
  /** P3 趴卧构图一句话（来自矩阵"睡姿"列） */
  lieNote: string;
};

export type SpeciesPack = {
  /** 单比例定制 rig：view=side / pose=lie 在 Stage-Image 阶段以 Front 兜底 */
  rig: RigComponent;
  /** 视觉行（rig/toolId/stage 由 index 派生：rig=codename, toolId=codename, stage="kid"） */
  visual: Omit<SpeciesVisual, "rig" | "toolId" | "stage">;
  tool: ToolRenderer;
  workFx: WorkFxSpec;
  meta: SpeciesPackMeta;
};
