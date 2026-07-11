import archiver from "archiver";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { ANCHOR, FRAME_SIZE, IDLE_ANIMATION_SPEC } from "./animations.js";
import { runCodexPreflight } from "./codexOrchestrator.js";
import { createImageProvider, type GenerationBrief, type GenerationMode } from "./imageProvider.js";
import type { ResolvedProvider } from "./providerConfig.js";
import type { AvatarManifest, JobEvent, JobRecord } from "./types.js";

export type EmitEvent = (event: JobEvent) => void;

/** One generation request: `single` uses one source image, `fusion` uses two. */
export type PipelineRequest = {
  mode: GenerationMode;
  sourceTempPaths: string[];
  name?: string;
};

type FrameBox = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
};

type FrameQuality = {
  frame: number;
  transparentCorners: boolean;
  visiblePixels: number;
  alphaCoverage: number;
  greenSpillPixels: number;
  bbox: FrameBox | null;
};

type QaReport = {
  animation: string;
  frames: number;
  fps: number;
  durationMs: number;
  loopAdjusted: boolean;
  loopDiffBefore: number;
  loopDiffAfter: number;
  motionScore: number;
  transparentCorners: boolean;
  greenSpillPixels: number;
  warnings: string[];
  frameQuality: FrameQuality[];
};

export async function runAvatarPipeline(
  job: JobRecord,
  request: PipelineRequest,
  selection: ResolvedProvider,
  emit: EmitEvent,
): Promise<void> {
  const provider = createImageProvider(selection);
  await mkdir(job.dir, { recursive: true });

  const isFusion = request.mode === "fusion";
  const sources: string[] = [];
  if (isFusion) {
    if (request.sourceTempPaths.length < 2) {
      throw new Error("Fusion generation requires two source images.");
    }
    const sourceA = path.join(job.dir, "source-a.png");
    const sourceB = path.join(job.dir, "source-b.png");
    await rename(request.sourceTempPaths[0], sourceA);
    await rename(request.sourceTempPaths[1], sourceB);
    sources.push(sourceA, sourceB);
  } else {
    const sourcePath = path.join(job.dir, "source.png");
    await rename(request.sourceTempPaths[0], sourcePath);
    sources.push(sourcePath);
  }

  // Optional Codex preflight brief only applies to the single-image path.
  if (provider.kind !== "codex-cli" && !isFusion) {
    await runCodexPreflight(job.dir, sources[0]);
  }

  const emitEvent = (type: JobEvent["type"], message: string, payload?: Record<string, unknown>) => {
    emit({ type, jobId: job.id, timestamp: new Date().toISOString(), message, payload });
  };

  if (provider.kind !== "mock") {
    emitEvent("provider_started", `${selection.label} ${isFusion ? "fusion " : ""}image generation started.`, {
      provider: provider.kind,
      model: selection.model,
      mode: request.mode,
    });
  }

  const brief: GenerationBrief = { mode: request.mode, sources, name: request.name };
  const assets = await provider.generateIdleAssets(brief, job.id, job.dir, IDLE_ANIMATION_SPEC, (message, payload) => {
    emitEvent("provider_log", message, payload);
  });
  const specPath = path.join(job.dir, "character-spec.json");
  await writeFile(specPath, JSON.stringify(assets.spec, null, 2), "utf-8");
  emitEvent("spec_ready", "Standard character design generated.", {
    spec: assets.spec,
    imageUrl: publicJobUrl(job.id, path.relative(job.dir, assets.standardDesignPath)),
  });

  const animation = IDLE_ANIMATION_SPEC;
  emitEvent("pose_sheet_ready", `${animation.key} pose sheet generated.`, {
    animation: animation.key,
    imageUrl: publicJobUrl(job.id, path.relative(job.dir, assets.idlePoseSheetPath)),
  });

  const frameDir = path.join(job.dir, "frames", animation.key);
  const slicedFrames = await slicePoseSheet(assets.idlePoseSheetPath, frameDir, animation.cols, animation.rows, animation.frames, animation.key);
  emitEvent("frames_ready", `${animation.key} transparent frames generated.`, {
    animation: animation.key,
    frameCount: slicedFrames.length,
    firstFrameUrl: publicJobUrl(job.id, `frames/${animation.key}/${animation.key}_0001.png`),
  });

  // Close the loop seamlessly; may append a few crossfade bridge frames, so the
  // final frame list (and count) can differ from the authored grid.
  const loop = await closeLoop(slicedFrames, frameDir, animation.key);
  const frames = loop.frames;
  const frameCount = frames.length;
  const qaReport = await writeQaReport(job.dir, animation.key, frameCount, animation.fps, frames, loop);
  emitEvent("qa_ready", `${animation.key} visual QA completed.`, {
    animation: animation.key,
    reportUrl: publicJobUrl(job.id, "qa-report.json"),
    loopAdjusted: qaReport.loopAdjusted,
    loopDiffBefore: qaReport.loopDiffBefore,
    loopDiffAfter: qaReport.loopDiffAfter,
    bridgeFrames: loop.bridged,
    motionScore: qaReport.motionScore,
    warnings: qaReport.warnings,
  });

  const webpPath = path.join(job.dir, "webp", `${animation.key}.webp`);
  await buildWebpStrip(frames, webpPath);
  emitEvent("webp_ready", `${animation.key} WebP sprite strip generated.`, {
    animation: animation.key,
    frames: frameCount,
    fps: animation.fps,
    webpUrl: publicJobUrl(job.id, `webp/${animation.key}.webp`),
  });

  const manifest: AvatarManifest = {
    id: job.id,
    name: assets.spec.name,
    version: 1,
    frameSize: { width: FRAME_SIZE, height: FRAME_SIZE },
    anchor: ANCHOR,
    animations: {
      idle_normal: {
        frames: frameCount,
        fps: animation.fps,
        loop: animation.loop,
        framePathTemplate: `frames/${animation.key}/${animation.key}_{frame}.png`,
        webpPath: `webp/${animation.key}.webp`,
      },
    },
  };

  await writeFile(path.join(job.dir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf-8");
  await sharp(await readFile(path.join(job.dir, "frames", "idle_normal", "idle_normal_0001.png")))
    .resize(320, 320, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(job.dir, "preview.png"));

  const packagePath = path.join(job.dir, "avatar.gulupet.zip");
  await zipAvatarPackage(job.dir, packagePath);
  job.packagePath = packagePath;
  emitEvent("package_ready", "Avatar package is ready.", {
    packageUrl: `/api/jobs/${job.id}/package`,
    installUrl: `gulugulu://avatar/install?url=${encodeURIComponent(`http://127.0.0.1:${process.env.PORT ?? "4178"}/api/jobs/${job.id}/package`)}`,
  });
}

type RawImage = { data: Buffer; info: sharp.OutputInfo };

/**
 * Slice the pose sheet into stabilized transparent frames. Each cell is
 * chroma-keyed and denoised, then every frame is re-planted on a fixed
 * bottom-center anchor at ONE shared scale. This removes the frame-to-frame
 * "swimming"/resizing that reads as flicker, while keeping the intended subtle
 * breathing motion (a frame that breathes taller simply extends upward).
 */
async function slicePoseSheet(
  poseSheetPath: string,
  frameDir: string,
  cols: number,
  rows: number,
  frames: number,
  animationKey: string,
): Promise<string[]> {
  await rm(frameDir, { recursive: true, force: true });
  await mkdir(frameDir, { recursive: true });
  const metadata = await sharp(poseSheetPath).metadata();
  const cellWidth = Math.floor((metadata.width ?? FRAME_SIZE * cols) / cols);
  const cellHeight = Math.floor((metadata.height ?? FRAME_SIZE * rows) / rows);

  const cells: Array<{ image: RawImage; bbox: FrameBox | null }> = [];
  for (let index = 0; index < frames; index += 1) {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const { data, info } = await sharp(poseSheetPath)
      .extract({ left: col * cellWidth, top: row * cellHeight, width: cellWidth, height: cellHeight })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    chromaKeyRaw(data, info);
    const cleaned = keepPrimaryComponents(data, info);
    cells.push({ image: { data: cleaned, info }, bbox: alphaBoundingBox(cleaned, info) });
  }

  const boxes = cells.map((cell) => cell.bbox).filter((box): box is FrameBox => box !== null);
  if (boxes.length === 0) {
    throw new Error("Visual QA failed: the pose sheet has no visible character pixels.");
  }
  const maxBoxHeight = Math.max(...boxes.map((box) => box.height));
  const maxBoxWidth = Math.max(...boxes.map((box) => box.width));
  const targetHeight = FRAME_SIZE * 0.82;
  const maxWidth = FRAME_SIZE * 0.9;
  let scale = targetHeight / maxBoxHeight;
  if (maxBoxWidth * scale > maxWidth) scale = maxWidth / maxBoxWidth;

  const outputPaths: string[] = [];
  for (let index = 0; index < cells.length; index += 1) {
    const outputPath = path.join(frameDir, `${animationKey}_${String(index + 1).padStart(4, "0")}.png`);
    await placeFrame(cells[index].image, cells[index].bbox, scale, outputPath);
    outputPaths.push(outputPath);
  }
  return outputPaths;
}

/** Remove the flat green chroma-key background (in place) and soften green fringe. */
function chromaKeyRaw(data: Buffer, info: sharp.OutputInfo): void {
  for (let index = 0; index < data.length; index += info.channels) {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const greenScreen = g > 100 && g > r * 1.12 + 12 && g > b * 1.12 + 12;
    if (greenScreen) {
      data[index] = 0;
      data[index + 1] = 0;
      data[index + 2] = 0;
      data[index + 3] = 0;
      continue;
    }
    if (g > r + 28 && g > b + 28) {
      data[index + 1] = Math.min(g, Math.max(r, b) + 8);
    }
  }
}

function alphaBoundingBox(data: Buffer, info: sharp.OutputInfo, threshold = 14): FrameBox | null {
  const { width, height, channels } = info;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * channels + 3] <= threshold) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return {
    left: minX,
    top: minY,
    right: maxX,
    bottom: maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

/** Composite a single frame's character onto a fixed bottom-center anchor at the shared scale. */
async function placeFrame(image: RawImage, bbox: FrameBox | null, scale: number, outputPath: string): Promise<void> {
  const canvas = sharp({
    create: { width: FRAME_SIZE, height: FRAME_SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  });
  if (!bbox) {
    await canvas.png().toFile(outputPath);
    return;
  }
  const region = await sharp(image.data, { raw: image.info })
    .extract({ left: bbox.left, top: bbox.top, width: bbox.width, height: bbox.height })
    .png()
    .toBuffer();
  const scaledWidth = Math.max(1, Math.round(bbox.width * scale));
  const scaledHeight = Math.max(1, Math.round(bbox.height * scale));
  const resized = await sharp(region).resize(scaledWidth, scaledHeight, { fit: "fill" }).png().toBuffer();
  const left = clamp(Math.round(ANCHOR.x - scaledWidth / 2), 0, FRAME_SIZE - scaledWidth);
  const top = clamp(Math.round(ANCHOR.y - scaledHeight), 0, FRAME_SIZE - scaledHeight);
  await canvas.composite([{ input: resized, left, top }]).png().toFile(outputPath);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function keepPrimaryComponents(data: Buffer, info: sharp.OutputInfo): Buffer {
  const { width, height, channels } = info;
  const visited = new Uint8Array(width * height);
  const components: Array<{
    pixels: number[];
    area: number;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    centerX: number;
    centerY: number;
  }> = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = y * width + x;
      if (visited[start] || data[start * channels + 3] <= 14) continue;

      const queue = [start];
      const pixels: number[] = [];
      let head = 0;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let sumX = 0;
      let sumY = 0;
      visited[start] = 1;

      while (head < queue.length) {
        const current = queue[head];
        head += 1;
        const cx = current % width;
        const cy = Math.floor(current / width);
        pixels.push(current);
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);
        sumX += cx;
        sumY += cy;

        for (const next of [current - 1, current + 1, current - width, current + width]) {
          if (next < 0 || next >= width * height || visited[next]) continue;
          const nx = next % width;
          const ny = Math.floor(next / width);
          if (Math.abs(nx - cx) + Math.abs(ny - cy) !== 1) continue;
          if (data[next * channels + 3] <= 14) continue;
          visited[next] = 1;
          queue.push(next);
        }
      }

      if (pixels.length > 20) {
        components.push({
          pixels,
          area: pixels.length,
          minX,
          minY,
          maxX,
          maxY,
          centerX: sumX / pixels.length,
          centerY: sumY / pixels.length,
        });
      }
    }
  }

  if (components.length <= 1) return data;

  const largest = components.reduce((best, component) => (component.area > best.area ? component : best), components[0]);
  const pad = Math.round(0.11 * Math.max(width, height));
  const keepLeft = largest.minX - pad;
  const keepTop = largest.minY - pad;
  const keepRight = largest.maxX + pad;
  const keepBottom = largest.maxY + pad;
  const keep = new Set<number>(largest.pixels);

  for (const component of components) {
    if (component === largest) continue;
    const close =
      component.centerX >= keepLeft &&
      component.centerX <= keepRight &&
      component.centerY >= keepTop &&
      component.centerY <= keepBottom;
    if (close && component.area >= largest.area * 0.01) {
      for (const pixel of component.pixels) keep.add(pixel);
    }
  }

  for (let pixel = 0; pixel < width * height; pixel += 1) {
    if (data[pixel * channels + 3] > 0 && !keep.has(pixel)) {
      data[pixel * channels + 3] = 0;
    }
  }
  return data;
}

/**
 * Make the idle loop seamless. If the wrap (last frame -> first frame) is
 * already close to a normal step, leave it alone. Otherwise append a few
 * crossfade bridge frames so the wrap step matches the other steps — instead of
 * the old behaviour of copying frame 1 over the last frame, which left a held
 * duplicate that read as a hitch.
 */
async function closeLoop(
  framePaths: string[],
  frameDir: string,
  animationKey: string,
): Promise<{ frames: string[]; adjusted: boolean; before: number; after: number; bridged: number }> {
  if (framePaths.length < 3) {
    return { frames: framePaths, adjusted: false, before: 0, after: 0, bridged: 0 };
  }
  const adjacent: number[] = [];
  for (let index = 0; index < framePaths.length - 1; index += 1) {
    adjacent.push(await compareFrames(framePaths[index], framePaths[index + 1]));
  }
  const wrap = await compareFrames(framePaths[framePaths.length - 1], framePaths[0]);
  const medianAdjacent = median(adjacent);
  const tolerance = Math.max(medianAdjacent * 1.6, medianAdjacent + 0.35, 1.2);
  if (wrap <= tolerance) {
    return { frames: framePaths, adjusted: false, before: wrap, after: wrap, bridged: 0 };
  }

  const bridges = clamp(Math.round(wrap / Math.max(medianAdjacent, 0.5)) - 1, 1, 3);
  const first = framePaths[0];
  const last = framePaths[framePaths.length - 1];
  const bridgePaths: string[] = [];
  for (let index = 1; index <= bridges; index += 1) {
    const t = index / (bridges + 1);
    const blended = await blendFrames(last, first, t);
    const bridgePath = path.join(frameDir, `${animationKey}_${String(framePaths.length + index).padStart(4, "0")}.png`);
    await sharp(blended.data, { raw: blended.info }).png().toFile(bridgePath);
    bridgePaths.push(bridgePath);
  }
  const frames = [...framePaths, ...bridgePaths];
  const after = await compareFrames(bridgePaths[bridgePaths.length - 1], first);
  return { frames, adjusted: true, before: wrap, after, bridged: bridges };
}

/** Per-pixel linear crossfade between two same-sized RGBA frames. */
async function blendFrames(pathA: string, pathB: string, t: number): Promise<RawImage> {
  const [a, b] = await Promise.all([
    sharp(pathA).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(pathB).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  const out = Buffer.allocUnsafe(a.data.length);
  for (let index = 0; index < a.data.length; index += 1) {
    out[index] = Math.round(a.data[index] * (1 - t) + b.data[index] * t);
  }
  return { data: out, info: a.info };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

async function compareFrames(aPath: string, bPath: string): Promise<number> {
  const [a, b] = await Promise.all([
    sharp(aPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(bPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  if (a.info.width !== b.info.width || a.info.height !== b.info.height || a.info.channels !== b.info.channels) {
    return Number.POSITIVE_INFINITY;
  }
  let total = 0;
  for (let index = 0; index < a.data.length; index += 1) {
    total += Math.abs(a.data[index] - b.data[index]);
  }
  return total / a.data.length;
}

async function writeQaReport(
  jobDir: string,
  animation: string,
  frames: number,
  fps: number,
  framePaths: string[],
  loop: { adjusted: boolean; before: number; after: number },
): Promise<QaReport> {
  const frameQuality = await Promise.all(framePaths.map((framePath, index) => inspectFrame(framePath, index + 1)));
  const visible = frameQuality.filter((frame) => frame.bbox);
  if (visible.length !== framePaths.length) {
    throw new Error("Visual QA failed: at least one frame has no visible pet pixels.");
  }
  if (!frameQuality.every((frame) => frame.transparentCorners)) {
    throw new Error("Visual QA failed: at least one frame has non-transparent corners.");
  }

  const boxes = visible.map((frame) => frame.bbox as FrameBox);
  const centerXRange = Math.max(...boxes.map((box) => box.centerX)) - Math.min(...boxes.map((box) => box.centerX));
  const centerYRange = Math.max(...boxes.map((box) => box.centerY)) - Math.min(...boxes.map((box) => box.centerY));
  const areas = boxes.map((box) => box.width * box.height);
  const areaRangeRatio = (Math.max(...areas) - Math.min(...areas)) / Math.max(...areas);
  const motionScore = centerXRange + centerYRange + areaRangeRatio * 100;
  const greenSpillPixels = frameQuality.reduce((sum, frame) => sum + frame.greenSpillPixels, 0);
  const warnings: string[] = [];

  if (motionScore < 12) warnings.push("Idle motion is present but may be too subtle.");
  if (greenSpillPixels > frames * 500) warnings.push("Some green-screen spill remains on visible pixels.");

  const report: QaReport = {
    animation,
    frames,
    fps,
    durationMs: Math.round((frames / fps) * 1000),
    loopAdjusted: loop.adjusted,
    loopDiffBefore: Number(loop.before.toFixed(4)),
    loopDiffAfter: Number(loop.after.toFixed(4)),
    motionScore: Number(motionScore.toFixed(2)),
    transparentCorners: true,
    greenSpillPixels,
    warnings,
    frameQuality,
  };

  await writeFile(path.join(jobDir, "qa-report.json"), JSON.stringify(report, null, 2), "utf-8");
  return report;
}

async function inspectFrame(framePath: string, frame: number): Promise<FrameQuality> {
  const { data, info } = await sharp(framePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const corners = [
    3,
    (info.width - 1) * info.channels + 3,
    (info.width * (info.height - 1)) * info.channels + 3,
    (info.width * info.height - 1) * info.channels + 3,
  ];
  let visiblePixels = 0;
  let greenSpillPixels = 0;
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const index = (y * info.width + x) * info.channels;
      const alpha = data[index + 3];
      if (alpha <= 8) continue;
      visiblePixels += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      if (g > 130 && g > r * 1.16 + 18 && g > b * 1.16 + 18) {
        greenSpillPixels += 1;
      }
    }
  }

  const bbox =
    visiblePixels > 0
      ? {
          left: minX,
          top: minY,
          right: maxX,
          bottom: maxY,
          width: maxX - minX + 1,
          height: maxY - minY + 1,
          centerX: (minX + maxX) / 2,
          centerY: (minY + maxY) / 2,
        }
      : null;

  return {
    frame,
    transparentCorners: corners.every((index) => data[index] === 0),
    visiblePixels,
    alphaCoverage: Number((visiblePixels / (info.width * info.height)).toFixed(4)),
    greenSpillPixels,
    bbox,
  };
}

async function buildWebpStrip(framePaths: string[], outputPath: string): Promise<void> {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const strip = sharp({
    create: {
      width: FRAME_SIZE * framePaths.length,
      height: FRAME_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });
  const composites = framePaths.map((framePath, index) => ({
    input: framePath,
    left: index * FRAME_SIZE,
    top: 0,
  }));
  await strip.composite(composites).webp({ lossless: true, effort: 6 }).toFile(outputPath);
}

async function zipAvatarPackage(jobDir: string, packagePath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(packagePath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);
    archive.file(path.join(jobDir, "manifest.json"), { name: "manifest.json" });
    archive.file(path.join(jobDir, "preview.png"), { name: "preview.png" });
    archive.file(path.join(jobDir, "standard-design.png"), { name: "standard-design.png" });
    archive.file(path.join(jobDir, "character-spec.json"), { name: "character-spec.json" });
    archive.file(path.join(jobDir, "generation-result.json"), { name: "generation-result.json" });
    archive.file(path.join(jobDir, "qa-report.json"), { name: "qa-report.json" });
    archive.directory(path.join(jobDir, "frames"), "frames");
    archive.directory(path.join(jobDir, "webp"), "webp");
    void archive.finalize();
  });
}

function publicJobUrl(jobId: string, relativePath: string): string {
  return `/jobs/${jobId}/${relativePath.replaceAll("\\", "/")}`;
}
