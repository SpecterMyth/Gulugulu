import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const copyPath = path.join(scriptDir, "localization/store-copy.json");
const defaultOutputPath = path.join(scriptDir, "out/storepage_1247252_localized.json");

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function fail(message) {
  console.error(`Store localization build failed: ${message}`);
  process.exit(1);
}

const baseArg = readArg("--base");
if (!baseArg) {
  fail("pass the Steamworks JSON export with --base <path>");
}

const basePath = path.resolve(process.cwd(), baseArg);
const outputPath = path.resolve(process.cwd(), readArg("--out") ?? defaultOutputPath);
const base = JSON.parse(fs.readFileSync(basePath, "utf8"));
const localizedCopy = JSON.parse(fs.readFileSync(copyPath, "utf8"));

if (String(base.itemid) !== "1247252" || typeof base.languages !== "object") {
  fail("the base export is not the Gulugulu store-page localization payload");
}

const targetLanguages = Object.keys(localizedCopy).filter((key) => !key.startsWith("_"));
if (targetLanguages.length !== 18) {
  fail(`expected 18 Steam store-copy languages, found ${targetLanguages.length}`);
}

const untouchedBefore = structuredClone(base);
const allowedFields = new Set([
  "app[content][legal]",
  "app[content][about]",
  "app[content][short_description]",
]);

for (const language of targetLanguages) {
  const copy = localizedCopy[language];
  const destination = base.languages[language];
  if (!destination) fail(`Steam export has no ${language} language block`);
  if (typeof copy.short !== "string" || copy.short.length === 0 || copy.short.length > 300) {
    fail(`${language} short description must contain 1-300 characters`);
  }
  if (!Array.isArray(copy.sections) || copy.sections.length !== 3) {
    fail(`${language} must have exactly three localized sections`);
  }

  const about = copy.sections
    .map(([heading, body]) => {
      if (!heading || !body) fail(`${language} contains an empty section`);
      return `[h2]${heading}[/h2]\n${body}`;
    })
    .join("\n\n");

  destination["app[content][legal]"] = "© 2026 Mobi Studio";
  destination["app[content][about]"] = about;
  destination["app[content][short_description]"] = copy.short;
}

for (const [language, beforeFields] of Object.entries(untouchedBefore.languages)) {
  const afterFields = base.languages[language];
  for (const [field, before] of Object.entries(beforeFields)) {
    const mayChange = targetLanguages.includes(language) && allowedFields.has(field);
    if (!mayChange && afterFields[field] !== before) {
      fail(`unexpected change to ${language}.${field}`);
    }
  }
}

for (const protectedLanguage of ["english", "schinese"]) {
  if (JSON.stringify(base.languages[protectedLanguage]) !== JSON.stringify(untouchedBefore.languages[protectedLanguage])) {
    fail(`${protectedLanguage} changed; refusing to build the upload`);
  }
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(base, null, 2)}\n`, "utf8");

console.log(`Built ${path.relative(repoRoot, outputPath)}`);
console.log(`Localized ${targetLanguages.length} languages; English and Simplified Chinese are byte-for-byte unchanged.`);
