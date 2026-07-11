export type AnimationKey =
  | "idle_normal"
  | "blink"
  | "walk"
  | "turn_around"
  | "happy_dance"
  | "confused"
  | "scared_backstep"
  | "angry_backturn"
  | "agent_thinking"
  | "agent_success"
  | "eat"
  | "pet_head";

export type AnimationSpec = {
  key: AnimationKey;
  frames: number;
  fps: number;
  loop: boolean;
  cols: number;
  rows: number;
  label: string;
};

export const FRAME_SIZE = 768;
export const ANCHOR = { x: 384, y: 700 };

export const IDLE_ANIMATION_SPEC: AnimationSpec = {
  key: "idle_normal",
  frames: 16,
  fps: 16,
  loop: true,
  cols: 4,
  rows: 4,
  label: "large seamless idle loop",
};

export const ANIMATION_SPECS: AnimationSpec[] = [
  { key: "idle_normal", frames: 12, fps: 8, loop: true, cols: 4, rows: 3, label: "idle breathing" },
  { key: "blink", frames: 6, fps: 12, loop: false, cols: 6, rows: 1, label: "blink" },
  { key: "walk", frames: 8, fps: 10, loop: true, cols: 8, rows: 1, label: "walk cycle" },
  { key: "turn_around", frames: 10, fps: 12, loop: false, cols: 5, rows: 2, label: "turn around" },
  { key: "happy_dance", frames: 16, fps: 12, loop: false, cols: 4, rows: 4, label: "happy dance" },
  { key: "confused", frames: 12, fps: 10, loop: false, cols: 4, rows: 3, label: "confused" },
  { key: "scared_backstep", frames: 14, fps: 12, loop: false, cols: 7, rows: 2, label: "scared backstep" },
  { key: "angry_backturn", frames: 12, fps: 10, loop: false, cols: 4, rows: 3, label: "angry backturn" },
  { key: "agent_thinking", frames: 12, fps: 8, loop: true, cols: 4, rows: 3, label: "agent thinking" },
  { key: "agent_success", frames: 14, fps: 12, loop: false, cols: 7, rows: 2, label: "agent success" },
  { key: "eat", frames: 16, fps: 10, loop: false, cols: 4, rows: 4, label: "eat" },
  { key: "pet_head", frames: 14, fps: 10, loop: false, cols: 7, rows: 2, label: "pet head" },
];
