import { createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import sharp from "sharp";
import type { AnimationSpec } from "./animations.js";
import { OpenRouterImageProvider } from "./openRouterProvider.js";
import type { ResolvedProvider } from "./providerConfig.js";
import type { CharacterSpec } from "./types.js";

export type GeneratedAvatarAssets = {
  spec: CharacterSpec;
  standardDesignPath: string;
  idlePoseSheetPath: string;
};

export type ProviderLog = (message: string, payload?: Record<string, unknown>) => void;

export type GenerationMode = "single" | "fusion";

/**
 * Describes one avatar-generation request to a provider. `sources` holds the
 * absolute reference-image paths: exactly one for `single`, two (parent A, then
 * parent B) for `fusion`. `name` is the desired output pet name, if any.
 */
export type GenerationBrief = {
  mode: GenerationMode;
  sources: string[];
  name?: string;
};

export interface ImageProvider {
  readonly kind: string;
  generateIdleAssets(
    brief: GenerationBrief,
    jobId: string,
    jobDir: string,
    animation: AnimationSpec,
    onLog?: ProviderLog,
  ): Promise<GeneratedAvatarAssets>;
}

export function createImageProvider(selection: ResolvedProvider): ImageProvider {
  switch (selection.kind) {
    case "mock":
      return new MockImageProvider();
    case "codex-cli":
      return new CodexCliImageProvider();
    case "openrouter":
      return new OpenRouterImageProvider(selection);
    default:
      throw new Error(`Unsupported provider kind "${selection.kind}".`);
  }
}

class MockImageProvider implements ImageProvider {
  readonly kind = "mock";

  async generateIdleAssets(
    brief: GenerationBrief,
    jobId: string,
    jobDir: string,
    animation: AnimationSpec,
    onLog?: ProviderLog,
  ): Promise<GeneratedAvatarAssets> {
    const isFusion = brief.mode === "fusion";
    onLog?.("Mock image provider rendering animated mascot assets.", {
      provider: this.kind,
      mode: brief.mode,
      sources: brief.sources.length,
      frames: animation.frames,
    });
    const spec: CharacterSpec = {
      name: brief.name?.trim() || (isFusion ? `Fusion ${jobId.slice(-4).toUpperCase()}` : `Custom Avatar ${jobId.slice(-4).toUpperCase()}`),
      summary: isFusion
        ? "A mock fusion of two desktop pets, normalized into a clean cute mascot sprite."
        : "A user-provided desktop pet normalized into a clean cute mascot sprite.",
      visualTraits: ["single clear mascot silhouette", "rounded proportions", "gentle breathing idle motion"],
      stylePrompt:
        "original cute Japanese monster-companion desktop pet, clean outline, flat colors, chroma-key sprite animation, calm breathing idle loop",
    };
    const standardDesignPath = path.join(jobDir, "standard-design.png");
    const idlePoseSheetPath = path.join(jobDir, "pose_sheets", `${animation.key}.png`);

    await mkdir(path.dirname(standardDesignPath), { recursive: true });
    await mkdir(path.dirname(idlePoseSheetPath), { recursive: true });
    await sharp(Buffer.from(renderSpriteSvg(spec.name, 0, 768, 768, true))).png().toFile(standardDesignPath);
    await sharp(Buffer.from(renderPoseSheetSvg(spec.name, animation))).png().toFile(idlePoseSheetPath);
    await writeGenerationResult(jobDir, spec);

    return { spec, standardDesignPath, idlePoseSheetPath };
  }
}

class CodexCliImageProvider implements ImageProvider {
  readonly kind = "codex-cli";

  async generateIdleAssets(
    brief: GenerationBrief,
    _jobId: string,
    jobDir: string,
    _animation: AnimationSpec,
    onLog?: ProviderLog,
  ): Promise<GeneratedAvatarAssets> {
    await mkdir(path.join(jobDir, "pose_sheets"), { recursive: true });
    const isFusion = brief.mode === "fusion" && brief.sources.length >= 2;
    const sourceLine = isFusion
      ? "Two reference images are attached: the first is parent pet A, the second is parent pet B. Fuse them into ONE new original pet."
      : "Generate the required Gulugulu custom pet assets from the attached image.";
    const fusionRules = isFusion
      ? [
          "Fusion design rules for standard-design.png:",
          "- Design ONE brand-new original creature that reads as a believable fusion of the two attached pets — one coherent creature, not two side by side.",
          "- Take the overall body/silhouette from one parent and graft 1-2 signature features (main color, plus one standout part such as ears/horns/tail/wings/crest, and one accent color) from the other.",
          "- Keep it as simple as a Pokemon: clean rounded silhouette, flat solid colors, one strong outline, at most one or two simple accent shapes. No jewelry, gems, crystals, coral, filigree, patterns, glitter, sparkles, bubbles, particles, glow, background scenery, frame, border, or text.",
        ]
      : [];
    const prompt = [
      "Use $gulugulu-avatar-imagegen.",
      sourceLine,
      ...fusionRules,
      "Animation quality requirements for pose_sheets/idle_normal.png (a smooth, calm breathing idle LOOP):",
      "- It is the exact same character in every one of the 16 cells: identical shapes, colors, outline weight, and proportions. Keep it locked in the SAME position, SAME size, facing the SAME way. Do not pan, zoom, rotate, flip, or resize the character between cells.",
      "- Neighboring frames must look almost the same and differ only by a tiny amount, so playback is smooth with no jumps, popping, or shaking (ease-in, ease-out).",
      "- Animate only subtle secondary motion: a slow breathing rise-and-fall (small squash and stretch), a gentle head bob, one slow blink mid-loop, and slight sway of soft parts. Keep the base/feet planted in the same spot.",
      "- Frame 16 is the in-between just before frame 1, so frame 16 -> frame 1 is the same tiny step as frame 1 -> frame 2. Frame 16 looks almost identical to frame 1 but is NOT an exact duplicate.",
      "- Keep empty areas as the flat #00ff00 chroma-key background only.",
      "Write only the required output files in the current working directory.",
      "If you cannot use image generation tools, write generation-failure.json with the error.",
    ].join("\n");
    const imageArgs = brief.sources.flatMap((source) => ["--image", source]);
    const args = [
      "exec",
      "--ephemeral",
      "--skip-git-repo-check",
      "--json",
      "--sandbox",
      "workspace-write",
      ...imageArgs,
      "--cd",
      jobDir,
      "-",
    ];

    await runCodex(args, jobDir, prompt, onLog);

    const failurePath = path.join(jobDir, "generation-failure.json");
    const failure = await readJsonIfExists<{ error?: string }>(failurePath);
    if (failure?.error) {
      throw new Error(`Codex image generation failed: ${failure.error}`);
    }

    const result = await readJsonIfExists<Partial<CharacterSpec>>(path.join(jobDir, "generation-result.json"));
    if (!result?.name || !result.summary || !Array.isArray(result.visualTraits) || !result.stylePrompt) {
      throw new Error("Codex image generation did not write a valid generation-result.json.");
    }

    const standardDesignPath = path.join(jobDir, "standard-design.png");
    const idlePoseSheetPath = path.join(jobDir, "pose_sheets", "idle_normal.png");
    await assertImageReadable(standardDesignPath, "standard-design.png");
    await assertImageReadable(idlePoseSheetPath, "pose_sheets/idle_normal.png");

    return {
      spec: {
        name: result.name,
        summary: result.summary,
        visualTraits: result.visualTraits.map(String),
        stylePrompt: result.stylePrompt,
      },
      standardDesignPath,
      idlePoseSheetPath,
    };
  }
}

async function runCodex(args: string[], jobDir: string, prompt: string, onLog?: ProviderLog): Promise<void> {
  const jsonlPath = path.join(jobDir, "codex-events.jsonl");
  const stderrPath = path.join(jobDir, "codex-stderr.log");
  const stdout = createWriteStream(jsonlPath, { flags: "a" });
  const stderr = createWriteStream(stderrPath, { flags: "a" });
  const timeoutMs = Number(process.env.AVATAR_CODEX_TIMEOUT_MS ?? 900_000);

  await new Promise<void>((resolve, reject) => {
    const command = process.env.CODEX_CLI_PATH ?? "codex";
    const commandLine = formatCommand(command, args);
    onLog?.("Executing Codex CLI.", {
      kind: "command",
      command: commandLine,
      cwd: jobDir,
      stdin: prompt,
      stdoutLog: jsonlPath,
      stderrLog: stderrPath,
      timeoutMs,
    });
    const child = spawn(command, args, {
      cwd: jobDir,
      shell: process.platform === "win32",
      env: process.env,
    });
    let settled = false;
    let stdoutBuffer = "";
    let stderrBuffer = "";
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (stdoutBuffer.trim()) emitCodexStdoutLine(stdoutBuffer, onLog);
      if (stderrBuffer.trim()) onLog?.("Codex stderr.", { kind: "stderr", text: stderrBuffer });
      stdout.end();
      stderr.end();
      callback();
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(() => reject(new Error(`codex exec timed out after ${timeoutMs}ms.`)));
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout.write(chunk);
      stdoutBuffer = consumeLines(stdoutBuffer + chunk.toString("utf-8"), (line) => emitCodexStdoutLine(line, onLog));
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr.write(chunk);
      stderrBuffer = consumeLines(stderrBuffer + chunk.toString("utf-8"), (line) => {
        onLog?.("Codex stderr.", { kind: "stderr", text: line });
      });
    });
    child.on("error", (error) => {
      finish(() => reject(error));
    });
    child.on("exit", (code) => {
      onLog?.("Codex CLI exited.", { kind: "exit", code });
      if (code === 0) {
        finish(resolve);
        return;
      }
      finish(() => reject(new Error(`codex exec exited with code ${code ?? "unknown"}. See ${stderrPath}.`)));
    });
    child.stdin.end(prompt, "utf-8");
  });

  const codexError = await readCodexJsonlError(jsonlPath);
  if (codexError) {
    throw new Error(`codex exec failed: ${codexError}`);
  }
}

function consumeLines(buffer: string, onLine: (line: string) => void): string {
  const lines = buffer.split(/\r?\n/);
  const remainder = lines.pop() ?? "";
  for (const line of lines) {
    if (line.trim()) onLine(line);
  }
  return remainder;
}

function emitCodexStdoutLine(line: string, onLog?: ProviderLog): void {
  const summary = summarizeCodexJsonLine(line);
  onLog?.(summary, { kind: "stdout", text: line });
}

function summarizeCodexJsonLine(line: string): string {
  try {
    const event = JSON.parse(line) as {
      type?: string;
      thread_id?: string;
      item?: {
        type?: string;
        text?: string;
        command?: string;
        aggregated_output?: string;
        exit_code?: number;
        status?: string;
      };
      message?: string;
      error?: { message?: string };
    };
    const type = event.type ?? "codex_event";
    if (type === "thread.started") return `Codex thread started${event.thread_id ? `: ${event.thread_id}` : "."}`;
    if (type === "turn.started") return "Codex turn started.";
    if (type === "turn.completed") return "Codex turn completed.";
    if (type === "turn.failed") return `Codex turn failed: ${event.error?.message ?? event.message ?? "unknown error"}`;
    if (type === "error") return `Codex error: ${event.message ?? event.error?.message ?? "unknown error"}`;
    if (type === "item.started" && event.item?.type === "command_execution") {
      return `Codex command started: ${event.item.command ?? "unknown command"}`;
    }
    if (type === "item.completed" && event.item?.type === "command_execution") {
      return `Codex command completed: ${event.item.command ?? "unknown command"} (exit ${event.item.exit_code ?? "unknown"})`;
    }
    if (type === "item.completed" && event.item?.type === "agent_message") {
      return `Codex message: ${shorten(event.item.text ?? "", 180)}`;
    }
    return `Codex event: ${type}`;
  } catch {
    return "Codex stdout.";
  }
}

function formatCommand(command: string, args: string[]): string {
  return [command, ...args].map(quoteCommandPart).join(" ");
}

function quoteCommandPart(part: string): string {
  if (!/[\s"]/u.test(part)) return part;
  return `"${part.replaceAll('"', '\\"')}"`;
}

function shorten(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}...`;
}

async function assertImageReadable(filePath: string, label: string): Promise<void> {
  try {
    await sharp(filePath).metadata();
  } catch (error) {
    throw new Error(`Generated ${label} is missing or unreadable: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
}

async function readCodexJsonlError(filePath: string): Promise<string | null> {
  let text = "";
  try {
    text = await readFile(filePath, "utf-8");
  } catch {
    return null;
  }
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim().startsWith("{")) continue;
    try {
      const event = JSON.parse(line) as { type?: string; message?: string; error?: { message?: string } };
      if (event.type === "error" && event.message) return event.message;
      if (event.type === "turn.failed" && event.error?.message) return event.error.message;
    } catch {
      // Ignore non-JSON log fragments in the JSONL stream.
    }
  }
  return null;
}

async function writeGenerationResult(jobDir: string, spec: CharacterSpec): Promise<void> {
  await writeFile(
    path.join(jobDir, "generation-result.json"),
    JSON.stringify(
      {
        ...spec,
        outputs: {
          standardDesign: "standard-design.png",
          idlePoseSheet: "pose_sheets/idle_normal.png",
        },
      },
      null,
      2,
    ),
    "utf-8",
  );
}

function renderPoseSheetSvg(name: string, animation: AnimationSpec): string {
  const cell = 768;
  const width = animation.cols * cell;
  const height = animation.rows * cell;
  const cells: string[] = [];

  for (let index = 0; index < animation.frames; index += 1) {
    const col = index % animation.cols;
    const row = Math.floor(index / animation.cols);
    const x = col * cell;
    const y = row * cell;
    cells.push(`<g transform="translate(${x} ${y})">${renderSpriteInner(name, index)}</g>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#00ff00"/>
    ${cells.join("\n")}
  </svg>`;
}

function renderSpriteSvg(name: string, frame: number, width: number, height: number, keyedBackground: boolean): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 768 768">
    <rect width="100%" height="100%" fill="${keyedBackground ? "#00ff00" : "none"}"/>
    ${renderSpriteInner(name, frame)}
  </svg>`;
}

function renderSpriteInner(name: string, frame: number): string {
  const phase = ((frame === 15 ? 0 : frame) / 16) * Math.PI * 2;
  const loopEase = 1;
  const bounce = Math.sin(phase);
  const doubleBounce = Math.sin(phase * 2);
  const bob = Math.round(bounce * 38 * loopEase - Math.max(0, Math.sin(phase - Math.PI / 4)) * 26 * loopEase);
  const squash = 1 + Math.sin(phase + Math.PI / 2) * 0.08 * loopEase;
  const stretch = 1 - Math.sin(phase + Math.PI / 2) * 0.07 * loopEase;
  const sway = Math.round(doubleBounce * 28 * loopEase);
  const tilt = doubleBounce * 8 * loopEase;
  const ear = Math.sin(phase + Math.PI / 3) * 26 * loopEase;
  const leftArm = -34 + Math.sin(phase * 2 + Math.PI / 4) * 42 * loopEase;
  const rightArm = 34 + Math.sin(phase * 2 + Math.PI * 0.85) * 42 * loopEase;
  const leftFootLift = Math.max(0, Math.sin(phase + Math.PI / 5)) * 28 * loopEase;
  const rightFootLift = Math.max(0, Math.sin(phase + Math.PI * 1.15)) * 28 * loopEase;
  const blink = frame === 6 || frame === 7;
  const wink = frame === 10;
  const mouthOpen = frame >= 4 && frame <= 8;
  const hue = Math.abs(hash(name) % 360);
  const body = `hsl(${hue}, 74%, 62%)`;
  const accent = `hsl(${(hue + 42) % 360}, 82%, 48%)`;
  const dark = `hsl(${hue}, 38%, 24%)`;
  const cheek = `hsl(${(hue + 320) % 360}, 90%, 74%)`;
  const leftEye = blink
    ? `<path d="M -68 -42 Q -50 -28 -32 -42" fill="none" stroke="${dark}" stroke-width="12" stroke-linecap="round"/>`
    : `<circle cx="-50" cy="-42" r="17" fill="${dark}"/><circle cx="-56" cy="-49" r="5" fill="white" opacity=".72"/>`;
  const rightEye =
    blink || wink
      ? `<path d="M 32 -42 Q 50 -28 68 -42" fill="none" stroke="${dark}" stroke-width="12" stroke-linecap="round"/>`
      : `<circle cx="50" cy="-42" r="17" fill="${dark}"/><circle cx="44" cy="-49" r="5" fill="white" opacity=".72"/>`;
  const mouth = mouthOpen
    ? `<ellipse cx="0" cy="32" rx="34" ry="26" fill="${dark}"/><path d="M -18 40 Q 0 55 18 40" fill="none" stroke="${cheek}" stroke-width="9" stroke-linecap="round"/>`
    : `<path d="M -42 28 C -18 58 18 58 42 28" fill="none" stroke="${dark}" stroke-width="12" stroke-linecap="round"/>`;

  return `
    <g transform="translate(${384 + sway} ${386 + bob}) rotate(${tilt}) scale(${squash} ${stretch})">
      <path d="M -82 -142 C -112 -218 -54 -232 -28 -156" fill="${accent}" stroke="${dark}" stroke-width="12" stroke-linejoin="round" transform="rotate(${ear})"/>
      <path d="M 82 -142 C 112 -218 54 -232 28 -156" fill="${accent}" stroke="${dark}" stroke-width="12" stroke-linejoin="round" transform="rotate(${-ear})"/>
      <path d="M 104 82 C 212 42 212 -48 120 -76" fill="none" stroke="${accent}" stroke-width="34" stroke-linecap="round" transform="rotate(${rightArm / 3})"/>
      <ellipse cx="0" cy="4" rx="144" ry="164" fill="${body}" stroke="${dark}" stroke-width="13"/>
      ${leftEye}
      ${rightEye}
      <circle cx="-78" cy="-2" r="18" fill="${cheek}" opacity=".8"/>
      <circle cx="78" cy="-2" r="18" fill="${cheek}" opacity=".8"/>
      ${mouth}
      <ellipse cx="-80" cy="${148 - leftFootLift}" rx="43" ry="21" fill="${accent}" stroke="${dark}" stroke-width="9" transform="rotate(${-18 + leftFootLift / 2})"/>
      <ellipse cx="80" cy="${148 - rightFootLift}" rx="43" ry="21" fill="${accent}" stroke="${dark}" stroke-width="9" transform="rotate(${18 - rightFootLift / 2})"/>
      <path d="M -116 18 C -206 ${62 + leftArm} -180 ${142 + leftArm / 3} -92 122" fill="none" stroke="${dark}" stroke-width="20" stroke-linecap="round"/>
      <path d="M 116 18 C 206 ${62 - rightArm} 180 ${142 - rightArm / 3} 92 122" fill="none" stroke="${dark}" stroke-width="20" stroke-linecap="round"/>
      <path d="M -80 96 C -30 126 30 126 80 96" fill="none" stroke="white" stroke-width="14" stroke-linecap="round" opacity=".72"/>
    </g>`;
}

function hash(value: string): number {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) | 0;
  }
  return result;
}
