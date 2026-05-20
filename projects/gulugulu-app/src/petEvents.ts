import type {
  AnimationDefinition,
  AnimationKey,
  CodexActivityEvent,
  PetEvent,
  PetEventType,
  PetState,
} from "./types";

export const SLEEP_TIMEOUT_MS = 60_000;

export const transientStateDurationMs: Partial<Record<PetState, number>> = {
  clicked: 1500,
  drag_start: 1300,
  drop: 1000,
  success: 1500,
  fed: 1700,
  moving: 2200,
};

export const stateAnimationMap: Record<PetState, AnimationKey> = {
  idle: "idle_normal",
  sleeping: "blink",
  clicked: "pet_head",
  drag_start: "scared_backstep",
  dragging: "scared_backstep",
  drop: "turn_around",
  moving: "walk",
  thinking: "agent_thinking",
  working: "angry_backturn",
  success: "happy_dance",
  fed: "eat",
  error: "confused",
};

export const animationDefinitions: Record<AnimationKey, AnimationDefinition> = {
  idle_normal: { frames: 12, fps: 8, loop: true },
  blink: { frames: 6, fps: 12, loop: false },
  walk: { frames: 8, fps: 10, loop: true },
  turn_around: { frames: 10, fps: 12, loop: false },
  happy_dance: { frames: 16, fps: 12, loop: false },
  confused: { frames: 12, fps: 10, loop: false },
  scared_backstep: { frames: 14, fps: 12, loop: false },
  angry_backturn: { frames: 12, fps: 10, loop: false },
  agent_thinking: { frames: 12, fps: 8, loop: true },
  agent_success: { frames: 14, fps: 12, loop: false },
  eat: { frames: 16, fps: 10, loop: false },
  pet_head: { frames: 14, fps: 10, loop: false },
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
