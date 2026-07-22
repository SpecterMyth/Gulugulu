// 新手强引导（动画教练层）类型 —— docs/gdd/OnboardingCoach.md
import type { UiMode } from "../../game/GamePanels";
import type { Language } from "../../i18n/core";
import type { GameConfig, GameSave } from "../../types";

export type CoachStepId = "C1" | "C2" | "C3" | "C4" | "C5" | "C6" | "C7" | "C8";

/** 手势原语：tap=G1 手指点击 · rapidTap=G2 连点 · keys=G3(⌨) · moveKeys=G3(◀▶) ·
 *  arrow=G4 边缘方向箭头 · ring=G5 仅高亮环（等待/无手指）。 */
export type CoachGesture = "tap" | "rapidTap" | "keys" | "moveKeys" | "arrow" | "ring";

/** 指向目标的语义种类；CoachFx 用 `data-coach` 属性在 DOM 里查它的屏幕位置来锚定。 */
export type CoachTargetKind =
  | "pet" // 舞台主宠身体
  | "egg" // 待收蛋（舞台蛋 / 后院孵化槽）
  | "menuBackyard" // 🏡 后院菜单项
  | "char" // 后院跟随主角
  | "placedPet" // 后院某驻留精灵（带 petId）
  | "shopPoi" // 走向商店（POI）
  | "shopCard" // 商店蛋卡
  | "followBtn" // 近宠"陪伴"按钮（带 petId）
  | "fuseBtn" // 近宠"✨融合"按钮（带 petId）
  | "fuseConfirm" // 融合弹窗"开始融合"按钮（#8）
  | "yardBack"; // 后院"返回"按钮（#7 回主界面点满级）

export type CoachTarget = { kind: CoachTargetKind; petId?: string };

export type CoachDirective = {
  /** 当前步（CE = 精力恢复插播）。 */
  step: CoachStepId | "CE";
  gesture: CoachGesture;
  /** 是否给目标套高亮环。 */
  ring: boolean;
  /** 引导文字（≤12 字）——复用现有对话气泡渲染，不在 CoachFx 里画。 */
  label: string;
  target: CoachTarget;
};

/** 教练持久标记（localStorage）：非存档可判定的完成态。 */
export type CoachFlags = {
  /** 首次融合完成 / 主动跳过 → 整层退场。 */
  done: boolean;
  /** C3：在后院移动过（任一方向即可，避免"只往一边走去商店"卡死）。 */
  moved: boolean;
  /** C5：切换过陪伴（或已直接操作另一只，见 useOnboardingCoach）。 */
  switched: boolean;
  /** CE：已教过键盘回精力。 */
  ceDone: boolean;
};

export type CoachContext = {
  save: GameSave;
  config: GameConfig;
  uiMode: UiMode;
  /** 引导标签语言（词条在 i18n/shell.ts 的 coach 域）。 */
  lang: Language;
  flags: CoachFlags;
  /** 后院运行时：有已孵化可收取的蛋。 */
  hatcheryReady: boolean;
  /** 后院运行时：主角是否靠近商店 POI（弹板已开）。 */
  nearShop: boolean;
  /** 后院运行时：主角当前靠近的驻留精灵 id（近到可出动作牌）。 */
  nearPetId: string | null;
  /** 主宠是否力竭（CE 插播触发）。 */
  exhausted: boolean;
  /** 融合确认弹窗是否已打开（#8：打开时指引指向「开始融合」）。 */
  fusionModalOpen: boolean;
};
