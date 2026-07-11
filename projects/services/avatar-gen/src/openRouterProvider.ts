import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { AnimationSpec } from "./animations.js";
import type { GeneratedAvatarAssets, GenerationBrief, ImageProvider, ProviderLog } from "./imageProvider.js";
import type { ResolvedProvider } from "./providerConfig.js";
import type { CharacterSpec } from "./types.js";

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const REQUEST_TIMEOUT_MS = Number(process.env.AVATAR_OPENROUTER_TIMEOUT_MS ?? 300_000);
const MAX_REFERENCE_DIMENSION = 1024;
const MAX_REMOTE_IMAGE_BYTES = 32 * 1024 * 1024;

/* eslint-disable @typescript-eslint/no-explicit-any */
type JsonValue = any;

/**
 * OpenRouter image provider. Routes each model to the correct OpenRouter path:
 * - modelApi "images": POST /api/v1/images  (e.g. openai/gpt-image-2), image at data[0].b64_json.
 * - modelApi "chat":   POST /api/v1/chat/completions with modalities:["image","text"]
 *                      (e.g. google/gemini-2.5-flash-image), image at choices[0].message.images[0].image_url.url.
 *
 * The reference image is sent as a base64 data URL for image-to-image generation.
 */
export class OpenRouterImageProvider implements ImageProvider {
  readonly kind = "openrouter";
  private readonly selection: ResolvedProvider;

  constructor(selection: ResolvedProvider) {
    this.selection = selection;
  }

  async generateIdleAssets(
    brief: GenerationBrief,
    jobId: string,
    jobDir: string,
    animation: AnimationSpec,
    onLog?: ProviderLog,
  ): Promise<GeneratedAvatarAssets> {
    if (!this.selection.apiKey) {
      throw new Error("OpenRouter API key is not configured. Set it in projects/config/avatar-providers.json.");
    }
    const { model, modelApi } = this.selection;
    const isFusion = brief.mode === "fusion" && brief.sources.length >= 2;
    await mkdir(path.join(jobDir, "pose_sheets"), { recursive: true });
    onLog?.("OpenRouter image generation started.", { provider: this.kind, model, api: modelApi, mode: brief.mode });

    const references = await Promise.all(brief.sources.map((source) => this.toReferenceDataUrl(source)));

    const designPrompt = isFusion ? buildFusionDesignPrompt() : buildDesignPrompt();
    onLog?.(isFusion ? "Requesting fused mascot design." : "Requesting standard mascot design.", {
      model,
      step: isFusion ? "fusion-design" : "standard-design",
    });
    // Fusion feeds both parent references; single feeds only its one reference.
    const designReferences = isFusion ? references : references.slice(0, 1);
    const designImage = await this.generateImage(designPrompt, designReferences, onLog);
    const standardDesignPath = path.join(jobDir, "standard-design.png");
    await sharp(designImage).png().toFile(standardDesignPath);
    const designDataUrl = `data:image/png;base64,${(await sharp(designImage).png().toBuffer()).toString("base64")}`;

    const poseSheetPrompt = buildPoseSheetPrompt(animation);
    onLog?.("Requesting idle pose sheet.", { model, step: "idle-pose-sheet" });
    // Pose sheet is anchored ONLY to the clean design image, so the animation
    // keeps a single locked identity instead of drifting toward a raw reference.
    const poseSheetImage = await this.generateImage(poseSheetPrompt, [designDataUrl], onLog);
    const idlePoseSheetPath = path.join(jobDir, "pose_sheets", `${animation.key}.png`);
    await sharp(poseSheetImage).png().toFile(idlePoseSheetPath);

    const spec = buildSpec(jobId, designPrompt, brief);
    await writeGenerationResult(jobDir, spec);
    onLog?.("OpenRouter assets ready.", { model });

    return { spec, standardDesignPath, idlePoseSheetPath };
  }

  private async toReferenceDataUrl(sourcePath: string): Promise<string> {
    const buffer = await sharp(sourcePath)
      .resize(MAX_REFERENCE_DIMENSION, MAX_REFERENCE_DIMENSION, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    return `data:image/png;base64,${buffer.toString("base64")}`;
  }

  private generateImage(prompt: string, references: string[], onLog?: ProviderLog): Promise<Buffer> {
    return this.selection.modelApi === "images"
      ? this.generateViaImagesApi(prompt, references, onLog)
      : this.generateViaChatApi(prompt, references, onLog);
  }

  private baseUrl(): string {
    return (this.selection.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.selection.apiKey}`,
      "Content-Type": "application/json",
    };
    if (this.selection.referer) headers["HTTP-Referer"] = this.selection.referer;
    if (this.selection.title) {
      headers["X-Title"] = this.selection.title;
      headers["X-OpenRouter-Title"] = this.selection.title;
    }
    return headers;
  }

  private async postJson(url: string, body: JsonValue, onLog?: ProviderLog): Promise<JsonValue> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    onLog?.("Calling OpenRouter.", { kind: "request", url, model: this.selection.model });
    let response: Response;
    let text: string;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      // Read the body under the same abort timer: fetch() resolves on headers,
      // so a stalled body would otherwise hang past REQUEST_TIMEOUT_MS.
      text = await response.text();
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error(`OpenRouter request timed out after ${REQUEST_TIMEOUT_MS}ms.`);
      }
      throw new Error(`OpenRouter request failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      clearTimeout(timer);
    }

    let json: JsonValue;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = undefined;
    }
    if (!response.ok) {
      throw new Error(formatOpenRouterError(response.status, json, text));
    }
    if (json?.error) {
      throw new Error(formatOpenRouterError(json.error?.code ?? response.status, json, text));
    }
    onLog?.("OpenRouter responded.", { kind: "response", url, ok: true });
    return json;
  }

  private async generateViaImagesApi(prompt: string, references: string[], onLog?: ProviderLog): Promise<Buffer> {
    const body: Record<string, unknown> = {
      model: this.selection.model,
      prompt,
      n: 1,
      ...(this.selection.modelParams ?? {}),
    };
    if (references.length > 0) {
      body.input_references = references.map((url) => ({ type: "image_url", image_url: { url } }));
    }
    const json = await this.postJson(`${this.baseUrl()}/images`, body, onLog);
    const ref = extractImagesApiImageRef(json);
    if (!ref) {
      throw new Error("OpenRouter /images response contained no image data.");
    }
    return resolveImagePayload(ref);
  }

  private async generateViaChatApi(prompt: string, references: string[], onLog?: ProviderLog): Promise<Buffer> {
    const content: JsonValue[] = [{ type: "text", text: prompt }];
    for (const url of references) {
      content.push({ type: "image_url", image_url: { url } });
    }
    const body: Record<string, unknown> = {
      model: this.selection.model,
      modalities: ["image", "text"],
      messages: [{ role: "user", content }],
    };
    const json = await this.postJson(`${this.baseUrl()}/chat/completions`, body, onLog);
    const ref = extractChatApiImageRef(json);
    if (!ref) {
      const note = extractChatText(json);
      throw new Error(`OpenRouter chat response contained no image${note ? `: ${note}` : "."}`);
    }
    return resolveImagePayload(ref);
  }
}

/** Extract the image reference (data URL, http URL, or bare base64) from a /api/v1/images response. */
function extractImagesApiImageRef(json: JsonValue): string | null {
  const entry = json?.data?.[0];
  if (!entry) return null;
  if (typeof entry.b64_json === "string" && entry.b64_json) return entry.b64_json;
  if (typeof entry.image_url?.url === "string" && entry.image_url.url) return entry.image_url.url;
  if (typeof entry.url === "string" && entry.url) return entry.url;
  return null;
}

/**
 * Extract the image reference from a chat/completions response. Defensive across model variants:
 * message.images[].image_url.url (data URL) -> message.images[].b64_json (bare base64)
 * -> content parts of type image_url -> Gemini-style inlineData.
 */
function extractChatApiImageRef(json: JsonValue): string | null {
  const message = json?.choices?.[0]?.message;
  if (!message) return null;

  const images = Array.isArray(message.images) ? message.images : [];
  for (const image of images) {
    if (typeof image?.image_url?.url === "string" && image.image_url.url) return image.image_url.url;
    if (typeof image?.b64_json === "string" && image.b64_json) return image.b64_json;
    if (typeof image?.inlineData?.data === "string" && image.inlineData.data) {
      const mime = typeof image.inlineData.mimeType === "string" ? image.inlineData.mimeType : "image/png";
      return `data:${mime};base64,${image.inlineData.data}`;
    }
  }

  if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (typeof part?.image_url?.url === "string" && part.image_url.url) return part.image_url.url;
      if (typeof part?.inlineData?.data === "string" && part.inlineData.data) {
        const mime = typeof part.inlineData.mimeType === "string" ? part.inlineData.mimeType : "image/png";
        return `data:${mime};base64,${part.inlineData.data}`;
      }
    }
  }
  return null;
}

function extractChatText(json: JsonValue): string | null {
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) return truncate(content.trim(), 300);
  if (Array.isArray(content)) {
    const text = content
      .map((part: JsonValue) => (typeof part?.text === "string" ? part.text : ""))
      .join(" ")
      .trim();
    if (text) return truncate(text, 300);
  }
  return null;
}

/** Turn a data URL / http URL / bare base64 string into raw image bytes. */
async function resolveImagePayload(ref: string): Promise<Buffer> {
  const value = ref.trim();
  if (value.startsWith("data:")) {
    const base64 = value.slice(value.indexOf(",") + 1);
    return Buffer.from(base64, "base64");
  }
  if (/^https?:\/\//i.test(value)) {
    return downloadRemoteImage(value);
  }
  return Buffer.from(value, "base64");
}

/**
 * Download a generated image from a remote URL returned by the model. The URL is
 * attacker-influenceable (it comes from the upstream response), so this blocks
 * non-public hosts, disallows redirects, and caps the response size.
 */
async function downloadRemoteImage(rawUrl: string): Promise<Buffer> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("OpenRouter returned an invalid image URL.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`Unsupported generated-image URL scheme "${url.protocol}".`);
  }
  if (isBlockedHost(url.hostname)) {
    throw new Error(`Refusing to fetch generated image from non-public host "${url.hostname}".`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { redirect: "error", signal: controller.signal });
    if (!response.ok) throw new Error(`Failed to download generated image (${response.status}).`);
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_REMOTE_IMAGE_BYTES) {
      throw new Error("Generated image exceeds the maximum allowed size.");
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > MAX_REMOTE_IMAGE_BYTES) {
      throw new Error("Generated image exceeds the maximum allowed size.");
    }
    return buffer;
  } catch (error) {
    if (controller.signal.aborted) throw new Error("Downloading the generated image timed out.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** Block loopback / private / link-local literal hosts (basic SSRF guard; does not resolve DNS). */
function isBlockedHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "::1" || host.startsWith("fe80") || host.startsWith("fc") || host.startsWith("fd")) return true;
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 0 || a === 127 || a === 10) return true;
    if (a === 169 && b === 254) return true; // link-local + cloud metadata
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  }
  return false;
}

function formatOpenRouterError(code: number | string, json: JsonValue, rawText: string): string {
  const message =
    (typeof json?.error?.message === "string" && json.error.message) ||
    (typeof json?.error === "string" && json.error) ||
    (rawText ? truncate(rawText, 300) : "") ||
    "unknown error";
  const numericCode = typeof code === "number" ? code : Number(code);
  const hint =
    numericCode === 401
      ? " (check the OpenRouter API key)"
      : numericCode === 402
        ? " (insufficient OpenRouter credits)"
        : numericCode === 403
          ? " (request blocked by moderation/guardrails)"
          : numericCode === 429
            ? " (rate limited — retry later)"
            : numericCode === 502 || numericCode === 503
              ? " (model or upstream provider temporarily unavailable)"
              : "";
  return `OpenRouter error ${code}: ${message}${hint}`;
}

function buildDesignPrompt(): string {
  return [
    "Using the attached reference image only as loose inspiration (silhouette, dominant colors, notable accessories, personality cues), design ONE original cute Japanese (kawaii) monster-companion style desktop-pet mascot.",
    "Do not copy Pokemon, Digimon, or any named copyrighted character.",
    "Keep it as simple as a Pokemon: a clean rounded silhouette, flat solid colors, one strong clean outline, and at most one or two simple accent shapes. Let shape and color do the work.",
    "Do NOT add ornamentation: no jewelry, gems, crystals, coral, filigree, lace, patterns, engravings, glitter, sparkles, bubbles, floating particles, auras, or glow.",
    "Output a SINGLE clean full-body character, centered and facing forward, with simple readable shapes, a strong outline, and bright but controlled flat colors.",
    "Background: a perfectly flat, solid #00ff00 (pure green) chroma-key fill covering the ENTIRE image. Do NOT use #00ff00 anywhere on the character.",
    "Do NOT include any text, logos, watermarks, UI, labels, captions, shadows, reflections, gradients, floor plane, decorative frame/border, or background scenery.",
    "Leave generous padding around the character. Return exactly one image.",
  ].join("\n");
}

/**
 * Design prompt for a fused pet. Two parent references are attached (A first,
 * then B). Emphasizes Pokemon-level simplicity and forbids the ornate,
 * over-decorated "tarot card" look.
 */
function buildFusionDesignPrompt(): string {
  return [
    "You are given TWO reference images: the first is parent creature A, the second is parent creature B.",
    "Design ONE brand-new, original creature that is a believable FUSION of the two — a single cute monster-companion that a fan would instantly read as 'these two combined'. It must be ONE coherent creature, not two creatures side by side, and not one creature holding another.",
    "How to fuse: take the overall body shape / silhouette from one parent, and clearly graft 1-2 signature features from the other (for example its main body color, plus ONE standout part such as ears, horns, tail, wings, or a crest, and one accent color). Blend them into one creature.",
    "KEEP IT SIMPLE — Pokemon-level complexity, no more: a clean rounded silhouette, flat solid color fills, a single strong clean outline, and at most one or two simple accent shapes. Let shape and color do the work.",
    "Do NOT add ornamentation: no jewelry, gems, crystals, coral, filigree, lace, patterns, engravings, glitter, sparkles, bubbles, floating particles, auras, or glow. No background scenery, no decorative frame or border, no card layout, no text.",
    "Style: cute Japanese (kawaii) monster-companion — big head, small rounded body, simple expressive eyes, friendly. Original only; do not copy Pokemon, Digimon, or any named copyrighted character.",
    "Output a SINGLE clean full-body character, centered and facing forward, with a strong outline and bright but controlled flat colors.",
    "Background: a perfectly flat solid #00ff00 (pure green) chroma-key fill covering the ENTIRE image. Do NOT use #00ff00 anywhere on the character.",
    "No text, logos, watermarks, UI, labels, shadows, reflections, gradients, floor, or scenery. Leave generous padding. Return exactly one image.",
  ].join("\n");
}

function buildPoseSheetPrompt(animation: AnimationSpec): string {
  return [
    `Create ONE image: a ${animation.cols}-columns by ${animation.rows}-rows sprite sheet of exactly ${animation.frames} frames of a SINGLE looping idle animation of the character in the attached design image, read left-to-right then top-to-bottom.`,
    "This is a smooth, calm idle LOOP — think gentle breathing, not a dance. The whole sheet is one continuous slow motion cycle.",
    "CONSISTENCY (most important): it is the exact same character in every cell — identical shapes, colors, outline weight, proportions, and details. Keep the character locked in the SAME position, at the SAME size, facing the SAME way in every cell. Do not move, pan, zoom, rotate, flip, or resize the character or the camera between cells.",
    "SMALL STEPS: neighboring frames must look almost the same, differing only by a tiny amount. The change from each frame to the next is small and even (ease-in, ease-out), so playback looks smooth with no jumps, popping, or shaking.",
    "MOTION: animate ONLY subtle secondary motion — a slow breathing rise-and-fall of the body (small squash and stretch), a gentle head bob, one slow eye blink somewhere in the middle of the loop, and a slight sway of soft parts (ears, tail, hair, cloth). Keep the amplitude small and readable. The feet/base stay planted in the same spot.",
    `SEAMLESS LOOP: the motion returns to its start so the sheet loops perfectly. Frame ${animation.frames} is the in-between just before frame 1, so playing frame ${animation.frames} -> frame 1 is the same tiny step as frame 1 -> frame 2. Frame ${animation.frames} looks almost identical to frame 1 (nearly matching pose, position, and scale) but must NOT be an exact duplicate.`,
    "BACKGROUND: every cell's background is the SAME perfectly flat solid #00ff00 (pure green) chroma-key fill. Do NOT use #00ff00 anywhere on the character.",
    "No text, no numbers, no drawn grid lines or borders, no shadows, no gradients, no scenery, no extra props. Keep the whole character inside its cell with padding. Return exactly one image.",
  ].join("\n");
}

function buildSpec(jobId: string, designPrompt: string, brief: GenerationBrief): CharacterSpec {
  const isFusion = brief.mode === "fusion";
  return {
    name: brief.name?.trim() || (isFusion ? `Fusion ${jobId.slice(-4).toUpperCase()}` : `Custom Avatar ${jobId.slice(-4).toUpperCase()}`),
    summary: isFusion
      ? "An original fused desktop-pet mascot combining two of your pets, generated via OpenRouter."
      : "An original cute desktop-pet mascot generated from your reference image via OpenRouter.",
    visualTraits: ["single clear mascot silhouette", "rounded proportions", "calm breathing idle motion"],
    stylePrompt: designPrompt,
  };
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

function truncate(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}…`;
}
