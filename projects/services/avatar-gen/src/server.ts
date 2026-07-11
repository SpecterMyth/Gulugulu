import cors from "cors";
import express from "express";
import multer from "multer";
import { createReadStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runAvatarPipeline, type PipelineRequest } from "./pipeline.js";
import {
  loadProviderConfig,
  ProviderSelectionError,
  resolveSelection,
  toClientConfig,
  type ResolvedProvider,
} from "./providerConfig.js";
import type { JobEvent, JobRecord } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 4178);
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = process.env.AVATAR_GEN_DATA_DIR ?? path.join(ROOT, ".data");
const JOBS_DIR = path.join(DATA_DIR, "jobs");
const upload = multer({ dest: path.join(DATA_DIR, "uploads"), limits: { fileSize: 16 * 1024 * 1024 } });
const jobs = new Map<string, JobRecord>();
const clients = new Map<string, Set<express.Response>>();

const app = express();
app.use(cors());
app.use(express.json());
app.use("/jobs", express.static(JOBS_DIR, { fallthrough: false }));

app.post("/api/jobs", upload.single("image"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Missing image file." });
    return;
  }
  if (!["image/png", "image/jpeg", "image/webp"].includes(req.file.mimetype)) {
    await rm(req.file.path, { force: true });
    res.status(400).json({ error: "Unsupported image type. Use PNG, JPG, or WebP." });
    return;
  }

  let selection: ResolvedProvider;
  try {
    const config = await loadProviderConfig();
    const requestedProvider =
      (typeof req.body.provider === "string" && req.body.provider) || process.env.AVATAR_IMAGE_PROVIDER || undefined;
    const requestedModel = typeof req.body.model === "string" ? req.body.model : undefined;
    selection = resolveSelection(config, requestedProvider, requestedModel);
  } catch (error) {
    await rm(req.file.path, { force: true });
    const status = error instanceof ProviderSelectionError ? 400 : 500;
    res.status(status).json({ error: error instanceof Error ? error.message : String(error) });
    return;
  }

  const id = createJobId();
  const now = new Date().toISOString();
  const job: JobRecord = {
    id,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    name: req.body.name || `Avatar ${id.slice(-4)}`,
    dir: path.join(JOBS_DIR, id),
    provider: selection.id,
    model: selection.model,
    events: [],
  };
  jobs.set(id, job);
  await mkdir(job.dir, { recursive: true });

  emit(job, {
    type: "job_created",
    jobId: id,
    timestamp: now,
    message: "Avatar generation job created.",
    payload: { jobId: id, provider: selection.id, model: selection.model },
  });

  const providedName = typeof req.body.name === "string" && req.body.name.trim() ? req.body.name.trim() : undefined;
  void startJob(job, { mode: "single", sourceTempPaths: [req.file.path], name: providedName }, selection);
  res.status(201).json({
    jobId: id,
    status: job.status,
    provider: selection.id,
    model: selection.model,
    eventsUrl: `/api/jobs/${id}/events`,
  });
});

app.post(
  "/api/fusions",
  upload.fields([
    { name: "imageA", maxCount: 1 },
    { name: "imageB", maxCount: 1 },
  ]),
  async (req, res) => {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const imageA = files?.imageA?.[0];
    const imageB = files?.imageB?.[0];
    const cleanup = async () => {
      await Promise.all(
        [imageA?.path, imageB?.path]
          .filter((value): value is string => Boolean(value))
          .map((value) => rm(value, { force: true })),
      );
    };
    if (!imageA || !imageB) {
      await cleanup();
      res.status(400).json({ error: "Fusion needs two images: imageA and imageB." });
      return;
    }
    const allowed = ["image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(imageA.mimetype) || !allowed.includes(imageB.mimetype)) {
      await cleanup();
      res.status(400).json({ error: "Unsupported image type. Use PNG, JPG, or WebP." });
      return;
    }

    let selection: ResolvedProvider;
    try {
      const config = await loadProviderConfig();
      const requestedProvider =
        (typeof req.body.provider === "string" && req.body.provider) || process.env.AVATAR_IMAGE_PROVIDER || undefined;
      const requestedModel = typeof req.body.model === "string" ? req.body.model : undefined;
      selection = resolveSelection(config, requestedProvider, requestedModel);
    } catch (error) {
      await cleanup();
      const status = error instanceof ProviderSelectionError ? 400 : 500;
      res.status(status).json({ error: error instanceof Error ? error.message : String(error) });
      return;
    }

    const fusedName = fusionName(req.body);
    const id = createJobId();
    const now = new Date().toISOString();
    const job: JobRecord = {
      id,
      status: "queued",
      createdAt: now,
      updatedAt: now,
      name: fusedName ?? `Fusion ${id.slice(-4)}`,
      dir: path.join(JOBS_DIR, id),
      provider: selection.id,
      model: selection.model,
      events: [],
    };
    jobs.set(id, job);
    await mkdir(job.dir, { recursive: true });

    emit(job, {
      type: "job_created",
      jobId: id,
      timestamp: now,
      message: "Fusion generation job created.",
      payload: { jobId: id, provider: selection.id, model: selection.model, mode: "fusion" },
    });

    void startJob(job, { mode: "fusion", sourceTempPaths: [imageA.path, imageB.path], name: fusedName }, selection);
    res.status(201).json({
      jobId: id,
      status: job.status,
      provider: selection.id,
      model: selection.model,
      eventsUrl: `/api/jobs/${id}/events`,
    });
  },
);

app.get("/api/providers", async (_req, res) => {
  try {
    const config = await loadProviderConfig();
    res.json(toClientConfig(config));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/api/jobs/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) {
    res.status(404).json({ error: "Job not found." });
    return;
  }
  res.json(publicJob(job));
});

app.get("/api/jobs", (_req, res) => {
  res.json(
    Array.from(jobs.values())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(publicJob),
  );
});

app.get("/api/jobs/:id/events", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) {
    res.status(404).json({ error: "Job not found." });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
  for (const event of job.events) {
    writeSse(res, event);
  }

  const set = clients.get(job.id) ?? new Set<express.Response>();
  set.add(res);
  clients.set(job.id, set);
  req.on("close", () => {
    set.delete(res);
  });
});

app.get("/api/jobs/latest/package", (_req, res) => {
  const job = Array.from(jobs.values())
    .filter((item) => item.status === "complete" && item.packagePath)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (!job?.packagePath) {
    res.status(404).json({ error: "No completed avatar package is ready." });
    return;
  }
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${job.id}.gulupet.zip"`);
  createReadStream(job.packagePath).pipe(res);
});

app.get("/api/jobs/:id/package", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job?.packagePath || job.status !== "complete") {
    res.status(404).json({ error: "Package is not ready." });
    return;
  }
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${job.id}.gulupet.zip"`);
  createReadStream(job.packagePath).pipe(res);
});

const webDir = path.resolve(ROOT, "dist-web");
app.use(express.static(webDir));
app.use((_req, res) => {
  res.sendFile(path.join(webDir, "index.html"), (error) => {
    if (error) res.status(404).send("Avatar generator web UI has not been built. Run npm run dev:web or npm run build.");
  });
});

await mkdir(path.join(DATA_DIR, "uploads"), { recursive: true });
await mkdir(JOBS_DIR, { recursive: true });
app.listen(PORT, "127.0.0.1", () => {
  console.log(`Gulugulu avatar-gen API listening on http://127.0.0.1:${PORT}`);
});

function fusionName(body: Record<string, unknown>): string | undefined {
  const provided = typeof body.name === "string" && body.name.trim() ? body.name.trim() : undefined;
  if (provided) return provided;
  const a = typeof body.nameA === "string" ? body.nameA.trim() : "";
  const b = typeof body.nameB === "string" ? body.nameB.trim() : "";
  const combined = [a, b].filter(Boolean).join(" × ");
  return combined || undefined;
}

async function startJob(job: JobRecord, request: PipelineRequest, selection: ResolvedProvider): Promise<void> {
  job.status = "running";
  job.updatedAt = new Date().toISOString();
  try {
    await runAvatarPipeline(job, request, selection, (event) => emit(job, event));
    job.status = "complete";
    job.updatedAt = new Date().toISOString();
  } catch (error) {
    job.status = "failed";
    job.error = error instanceof Error ? error.message : String(error);
    job.updatedAt = new Date().toISOString();
    emit(job, {
      type: "failed",
      jobId: job.id,
      timestamp: job.updatedAt,
      message: job.error,
    });
  }
}

function emit(job: JobRecord, event: JobEvent): void {
  job.events.push(event);
  job.updatedAt = event.timestamp;
  console.log(`[${event.timestamp}] [${job.id}] ${event.type}: ${event.message}`);
  if (event.payload) {
    console.log(JSON.stringify(event.payload, null, 2));
  }
  for (const client of clients.get(job.id) ?? []) {
    writeSse(client, event);
  }
}

function writeSse(res: express.Response, event: JobEvent): void {
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function publicJob(job: JobRecord) {
  return {
    id: job.id,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    name: job.name,
    provider: job.provider,
    model: job.model,
    error: job.error,
    packageUrl: job.packagePath ? `/api/jobs/${job.id}/package` : undefined,
    events: job.events,
  };
}

function createJobId(): string {
  return `avatar_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
