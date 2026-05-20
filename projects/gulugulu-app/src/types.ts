export type PetEventType =
  | "user_click"
  | "user_drag_start"
  | "user_drag_move"
  | "user_drag_end"
  | "pet_idle"
  | "pet_move_start"
  | "pet_move"
  | "pet_move_stop"
  | "pet_sleep_start"
  | "agent_thinking_start"
  | "agent_work_start"
  | "agent_work_finish"
  | "agent_tool_start"
  | "agent_tool_finish"
  | "agent_token_gain"
  | "agent_error";

export type PetState =
  | "idle"
  | "sleeping"
  | "clicked"
  | "drag_start"
  | "dragging"
  | "drop"
  | "moving"
  | "thinking"
  | "working"
  | "success"
  | "fed"
  | "error";

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

export type AnimationDefinition = {
  frames: number;
  fps: number;
  loop: boolean;
};

export type PetEvent = {
  type: PetEventType;
  timestamp: string;
};

export type TokenUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  totalTokens: number;
};

export type CodexActivityEvent = {
  source: "codex" | "claudeCode" | string;
  sessionId: string;
  timestamp: string;
  kind:
    | "session_started"
    | "message_seen"
    | "tool_started"
    | "tool_finished"
    | "token_count"
    | "error"
    | PetEventType;
  projectPath?: string;
  tokenDelta: number;
  experienceDelta: number;
  projectTotalTokens: number;
  projectExperience: number;
  totalUsage?: TokenUsage;
  lastUsage?: TokenUsage;
};

export type CodexStatus = {
  codexHome?: string;
  claudeHome?: string;
  watching: boolean;
  codexWatching: boolean;
  claudeCodeWatching: boolean;
  latestSession?: string;
  activeSource?: "codex" | "claudeCode" | string;
  projectPath?: string;
  error?: string;
  totalTokens: number;
  experience: number;
};
