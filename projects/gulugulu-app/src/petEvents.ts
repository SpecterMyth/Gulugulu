import type { CodexActivityEvent, PetEvent, PetEventType, PetState } from "./types";

export const SLEEP_TIMEOUT_MS = 60_000;

/** Agent 活跃锁存窗口：最后一条 codex://activity 事件后，宠物在此时长内视为
 *  「有 Agent 在跑」，持续播放 working/thinking 基线动画；瞬时事件（吃/庆祝/
 *  报错）演完后回到基线而非 idle。静默超过此窗口才回落 idle（进而 60s 睡眠 /
 *  18s 漫游）。比旧的 5s 通用回落略长，容忍事件之间的空隙（如推理长停顿）。 */
export const AGENT_ACTIVE_WINDOW_MS = 10_000;

/** 会刷新活跃锁存的 Agent 事件（codex://activity 归一化后的全部类型）。 */
export const agentActivityEventTypes: ReadonlySet<PetEventType> = new Set<PetEventType>([
  "agent_thinking_start",
  "agent_work_start",
  "agent_tool_start",
  "agent_tool_finish",
  "agent_token_gain",
  "agent_work_finish",
  "agent_error",
]);

/** 持续型 Agent 基线：进入这些事件时把活跃期的「底」动画记为思考 / 工作。
 *  瞬时事件（fed/success/error）演完后回到最近一次记录的基线。 */
export const sustainedAgentBaseline: Partial<Record<PetEventType, PetState>> = {
  agent_thinking_start: "thinking",
  agent_work_start: "working",
  agent_tool_start: "working",
};

/** 瞬时（one-shot）状态时长：到期后回落（活跃期→基线，否则→idle）。
 *  working/thinking 不在此表——它们是活跃期基线，由 App 的活跃锁存超时收束。 */
export const transientStateDurationMs: Partial<Record<PetState, number>> = {
  laboring: 800,
  drag_start: 1300,
  drop: 1000,
  success: 1500,
  fed: 1700,
  moving: 2200,
};

/** SVG 舞台的 one-shot 状态时长（与 sprites.css 对应动画时长对齐）。
 *  不在表内的状态视为循环动画，由事件 / 活跃锁存驱动切换。 */
export const svgStateDurationMs: Partial<Record<PetState, number>> = {
  laboring: 800, // rig-work-arm 0.55s × ~1.5
  drop: 1000, // rig-land-splat 1s
  success: 1500, // rig-celebrate-hop 0.75s × 2
  fed: 1700, // sprite-chomp 0.85s × 2
};

export function normalizeCodexEvent(event: CodexActivityEvent): PetEvent {
  return {
    type: normalizeCodexKind(event.kind),
    timestamp: event.timestamp || new Date().toISOString(),
  };
}

export function stateForPetEvent(event: PetEvent): PetState {
  switch (event.type) {
    case "user_click":
      return "clicked";
    case "user_work_click":
      return "laboring";
    case "pet_exhausted":
      return "exhausted";
    case "pet_wake":
      return "idle";
    case "user_drag_start":
      return "drag_start";
    case "user_drag_move":
      return "dragging";
    case "user_drag_end":
      return "drop";
    case "pet_idle":
    case "pet_move_stop":
    case "agent_tool_finish":
      return "idle";
    case "pet_move_start":
    case "pet_move":
      return "moving";
    case "pet_sleep_start":
      return "sleeping";
    case "agent_thinking_start":
      return "thinking";
    case "agent_work_start":
    case "agent_tool_start":
      return "working";
    case "agent_work_finish":
      return "success";
    case "agent_token_gain":
      return "fed";
    case "agent_error":
      return "error";
    default:
      return "idle";
  }
}

function normalizeCodexKind(kind: CodexActivityEvent["kind"]): PetEventType {
  switch (kind) {
    case "message_seen":
      return "agent_thinking_start";
    case "tool_started":
      return "agent_tool_start";
    case "tool_finished":
      return "agent_tool_finish";
    case "token_count":
      return "agent_token_gain";
    case "error":
      return "agent_error";
    case "session_started":
      return "pet_idle";
    case "agent_thinking_start":
    case "agent_work_start":
    case "agent_work_finish":
    case "agent_tool_start":
    case "agent_tool_finish":
    case "agent_token_gain":
    case "agent_error":
      return kind;
    default:
      return "pet_idle";
  }
}
