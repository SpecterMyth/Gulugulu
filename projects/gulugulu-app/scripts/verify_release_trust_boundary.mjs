import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const assetsDir = join(projectRoot, "dist", "assets");
const entries = await readdir(assetsDir, { withFileTypes: true });
const javascript = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".js"));

if (javascript.length === 0) {
  throw new Error("No production JavaScript found. Run `npm run build` first.");
}

const debugChunks = javascript.filter((entry) => /debug(panel)?/i.test(entry.name));
if (debugChunks.length > 0) {
  throw new Error(`Production build contains Debug UI chunks: ${debugChunks.map((entry) => entry.name).join(", ")}`);
}

const bundleText = (
  await Promise.all(javascript.map((entry) => readFile(join(assetsDir, entry.name), "utf8")))
).join("\n");

const forbiddenReleaseUi = [
  "GuluIsBestGame",
  "存档调试",
  "Steam 调试",
  "debug-unlock-note",
];

const leaked = forbiddenReleaseUi.filter((marker) => bundleText.includes(marker));
if (leaked.length > 0) {
  throw new Error(`Production bundle leaked Debug UI markers: ${leaked.join(", ")}`);
}

console.log(
  `Release trust boundary OK: ${javascript.length} JavaScript bundle(s), no Debug UI chunk or passphrase marker.`,
);
