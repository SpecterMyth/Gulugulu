import type { AnimationKey } from "./animations.js";

export type JobStatus = "queued" | "running" | "complete" | "failed";

export type AvatarAnimationManifest = {
  frames: number;
  fps: number;
  loop: boolean;
  framePathTemplate: string;
  webpPath: string;
};

export type AvatarManifest = {
  id: string;
  name: string;
  version: 1;
  frameSize: { width: number; height: number };
  anchor: { x: number; y: number };
  animations: Partial<Record<AnimationKey, AvatarAnimationManifest>> & {
    idle_normal: AvatarAnimationManifest;
  };
};

export type CharacterSpec = {
  name: string;
  summary: string;
  visualTraits: string[];
  stylePrompt: string;
};

export type JobEventType =
  | "job_created"
  | "provider_started"
  | "provider_log"
  | "codex_started"
  | "codex_log"
  | "spec_ready"
  | "pose_sheet_ready"
  | "frames_ready"
  | "qa_ready"
  | "webp_ready"
  | "package_ready"
  | "failed";

export type JobEvent = {
  type: JobEventType;
  jobId: string;
  timestamp: string;
  message: string;
  payload?: Record<string, unknown>;
};

export type JobRecord = {
  id: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  name: string;
  dir: string;
  provider?: string;
  model?: string;
  packagePath?: string;
  error?: string;
  events: JobEvent[];
};
