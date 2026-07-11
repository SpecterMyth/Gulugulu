import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";

export async function runCodexPreflight(jobDir: string, sourcePath: string): Promise<void> {
  if ((process.env.AVATAR_GEN_ORCHESTRATOR ?? "direct") !== "codex") return;

  const prompt = [
    "You are orchestrating a Gulugulu custom avatar generation job.",
    "Inspect the attached image and write a concise generation brief to codex-generation-brief.md in the current directory.",
    "Include: character identity, stable visual traits, animation consistency risks, and prompt guidance for pose sheets.",
    "Do not modify files outside the current job directory.",
  ].join("\n");
  const jsonlPath = path.join(jobDir, "codex-events.jsonl");
  const outputPath = path.join(jobDir, "codex-last-message.txt");
  const log = createWriteStream(jsonlPath, { flags: "a" });

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "codex",
      [
        "exec",
        "--json",
        "--image",
        sourcePath,
        "--cd",
        jobDir,
        "--sandbox",
        "danger-full-access",
        "--output-last-message",
        outputPath,
        prompt,
      ],
      { cwd: jobDir, shell: process.platform === "win32" },
    );

    child.stdout.pipe(log);
    child.stderr.pipe(log);
    child.on("error", reject);
    child.on("exit", (code) => {
      log.end();
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`codex exec exited with code ${code ?? "unknown"}`));
    });
  });

  await writeFile(path.join(jobDir, "orchestrator.txt"), "codex\n", "utf-8");
}
