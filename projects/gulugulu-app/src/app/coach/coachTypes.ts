// Unified save-backed onboarding focus-layer types.

/** 手势原语：tap=G1 手指点击 · rapidTap=G2 连点 · keys=G3(⌨) · moveKeys=G3(◀▶) ·
 *  arrow=G4 边缘方向箭头 · ring=G5 仅高亮环（等待/无手指）。 */
export type CoachGesture = "tap" | "rapidTap" | "keys" | "moveKeys" | "arrow" | "ring";

/** 指向目标的语义种类；CoachFx 用 `data-coach` 属性在 DOM 里查它的屏幕位置来锚定。 */
export type CoachTarget = { kind: string; petId?: string };

export type CoachDirective = {
  step: string;
  gesture: CoachGesture;
  /** 是否给目标套高亮环。 */
  ring: boolean;
  /** Text is rendered by the single goal card; CoachFx only draws the focus gesture. */
  label: string;
  target: CoachTarget;
};
