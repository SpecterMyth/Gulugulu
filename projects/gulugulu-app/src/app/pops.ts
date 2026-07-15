export type PopKind = "exp" | "coin" | "coin-dim" | "levelup" | "levelmax" | "stamina";

/** 收益弹出的图标（透明背景 + 图标 + 描边数字） */
export const POP_ICONS: Record<PopKind, string> = {
  exp: "✨",
  coin: "🪙",
  "coin-dim": "🪙",
  levelup: "🎉",
  levelmax: "⭐",
  stamina: "⚡",
};

export type GamePop = {
  id: number;
  text: string;
  kind: PopKind;
  lane: number;
  x?: number;
  y?: number;
  /** 点击手感分层：≥10 金的飘字放大一档（OnboardingFlow §二·5）。 */
  big?: boolean;
};
