import type { CSSProperties, ReactNode } from "react";

// =============================================================================
// Rig 系统契约（计划 §2.1/§2.2）
//
// 坐标约定：所有 rig 在全局 256×256 viewBox 空间作画，地面线 y=233，
// 水平中心 x=128。"体型"用占盒率表达（同一个盒子里画大画小）。
//
// 部件动画约定：凡是要被 CSS 动画驱动的组，必须包在 <Part name=.. origin=..>
// 里（见 parts/common.tsx）。Part 内部用 transform-box: fill-box +
// transform-origin(百分比) 定 pivot；带 transform 属性的"放置层"必须留在
// Part 外面（CSS transform 会覆盖同元素的 transform 属性）。
//
// 槽位（slot）约定：槽内容用"局部坐标"作画，pivot 在局部原点 (0,0)：
//   tail     — pivot=尾根，向上/向后生长
//   headTop  — pivot=底部中点（坐在头顶上）
//   back     — pivot=贴合点（画在身体后面）
//   cheeks   — pivot=(0,0) 即两颊中心参考点（rig 负责左右放置或整组给出）
//   marking  — 直接用全局坐标（叠在 body 主形之上、脸之下）
//   platform — pivot=顶部中点（脚下座台，浮冰等）
//   tool     — pivot=握持点，工具竖直向上作画；只在 working/laboring/success
//              状态由 CSS 淡入（.part-tool）
// =============================================================================

export type RigView = "front" | "side";

/** baby=一阶新生儿比例（头≥60%）；kid=二阶幼童比例（头40-50%，躯干/腿拉长）。 */
export type RigStage = "baby" | "kid";

/** 六个动物底座 rig + chimera 参数化底座。config.json 的 body 字符串是
 *  不透明 ID：frog→whale（鲸）、penguin→yeti（雪怪），其余同名。
 *  chimera 是 AI 融合专用的"拼装身体"底座——身体由 ChimeraForm 参数化
 *  搭建，剪影可与 6 个动物完全不同，但仍走标准 Part 包装继承全部动画。 */
export type RigKind = "duck" | "fox" | "mouse" | "whale" | "mushroom" | "yeti" | "chimera";

/** 体型原型：AI 融合先选一种"像某类动物"的骨架，再用其余参数微调。
 *  stack=旧版竖直堆叠体块（仅为兼容早期存档；新生成一律选下面 6 种动物体型之一）。
 *  round=圆团崽 · upright=直立崽 · quadruped=四足兽 · long=长条崽 ·
 *  floaty=漂浮崽 · bighead=大头崽。每种剪影差异极大，见 chimeraRig 的原型注释。 */
export type BodyPlan =
  | "stack"
  | "round"
  | "upright"
  | "quadruped"
  | "long"
  | "floaty"
  | "bighead";

/** chimera 参数化身体：AI 先选 bodyPlan 动物体型，再用这套参数搭出全新剪影
 *  （圆团/直立/四足横身/长条/悬浮/大头…）。所有数值在渲染层夹取到安全范围。 */
export type ChimeraForm = {
  /** 体型原型（决定整体剪影拓扑；先选它，其余参数只做微调） */
  bodyPlan: BodyPlan;
  /** 身体段数：stack=自下而上堆叠体块数(1~3)；long=分节小丘数(2~3)；其余体型忽略 */
  segments: 1 | 2 | 3;
  /** 整体宽度系数（相对基准，0.75~1.3） */
  bodyW: number;
  /** 整体高度系数（相对基准，0.75~1.35） */
  bodyH: number;
  /** 上段收窄程度（0=毛虫等宽，1=锥形大肚小顶） */
  taper: number;
  /** 头：merged=最上段即头（史莱姆感）；perched=另加一个头球 */
  headStyle: "merged" | "perched";
  /** perched 头相对顶段的大小（0.5~1.0） */
  headScale: number;
  /** 腿型：none 无（配合漂浮）/ stub 短墩 / tall 长腿 */
  legStyle: "none" | "stub" | "tall";
  /** 腿数：2 或 4（四足兽） */
  legCount: 2 | 4;
  /** 手型：none / nub 小圆手 / wing 小翅 / flipper 桨鳍 */
  armStyle: "none" | "nub" | "wing" | "flipper";
  /** 内建耳型（仍可被 headTop 槽叠加）：none / round 圆耳 / point 尖耳 / long 长垂耳 / fin 背鳍状 */
  earStyle: "none" | "round" | "point" | "long" | "fin";
  /** 漂浮（离地浮动，通常配 legStyle=none） */
  floating: boolean;
};

export type EyeVariant = "round" | "happy" | "sleepy";

/** 姿势：stand=站立；lie=睡眠趴地（rig 绘制专门的趴卧构图，
 *  不是把站姿旋转倒下）。仅正面视图使用。 */
export type RigPose = "stand" | "lie";

/** 按状态切换的呆萌表情（parts/faces.tsx 渲染；装配器由 petState 推导）。
 *  normal=物种默认脸；happy=开心眯眼；effort=努力><；star=星星眼庆祝；
 *  munch=咀嚼；sleep=闭眼熟睡；surprised=惊讶圆眼；dizzy=蚊香眼；think=思考瞟。 */
export type Expression =
  | "normal"
  | "happy"
  | "effort"
  | "star"
  | "munch"
  | "sleep"
  | "surprised"
  | "dizzy"
  | "think";

export type RigPalette = {
  /** 身体主色 */
  body: string;
  /** 深色（阴影/斑纹/深毛） */
  deep: string;
  /** 肚皮/脸部浅色补丁 */
  belly: string;
  /** 元素点缀色（A 亲） */
  accent: string;
  /** 第二元素点缀色（二阶 B 亲） */
  accent2?: string;
};

export type RigSlots = {
  tail?: ReactNode;
  headTop?: ReactNode;
  back?: ReactNode;
  cheeks?: ReactNode;
  marking?: ReactNode;
  platform?: ReactNode;
  tool?: ReactNode;
};

export type RigProps = {
  view: RigView;
  stage: RigStage;
  palette: RigPalette;
  slots?: RigSlots;
  eyes?: EyeVariant;
  /** 当前表情（默认 normal=物种默认脸）；rig 的脸部区域用
   *  parts/faces.tsx 的 ExpFace/ExpSideFace 按它渲染 */
  expression?: Expression;
  /** 姿势（默认 stand）；睡眠/力竭时装配器传 lie，rig 绘制趴地构图 */
  pose?: RigPose;
  /** chimera rig 专用：参数化身体描述（其余 rig 忽略） */
  form?: ChimeraForm;
};

export type RigComponent = (props: RigProps) => ReactNode;

export const OUTLINE = "#3B2B1D";

/** 每个物种一行的视觉声明（计划 §2.2 speciesTable）。 */
export type SpeciesVisual = {
  /** rig 注册表键：六个动物底座/chimera 用 RigKind 字面量；
   *  融合 2.0 新物种（species2 包）用 codename（一物种一 rig）。 */
  rig: string;
  stage: RigStage;
  /** 整体缩放（二阶 1.1~1.25） */
  scale: number;
  palette: RigPalette;
  eyes?: EyeVariant;
  /** 工具 id（parts/tools.tsx 注册表键） */
  toolId?: string;
  /** 槽位覆盖（默认件在各 rig 内部）；接收调色板与当前视图
   *  （正/侧面的配件形态可不同，如狐耳 front 双耳 / side 单耳） */
  buildSlots?: (palette: RigPalette, view: RigView) => RigSlots;
  /** 地面影子半径（漂浮物种小一些） */
  shadowRx?: number;
  /** 进食时食物出现的嘴边位置（viewBox 坐标；缺省 132,168） */
  foodAnchor?: { x: number; y: number };
  /** 漂浮物种（影子与身体留空隙，idle 上下浮动） */
  floating?: boolean;
  /** 按物种微调动画参数（--stride-deg 等 CSS 变量） */
  cssVars?: CSSProperties;
  /** chimera rig 专用：参数化身体描述 */
  form?: ChimeraForm;
};
