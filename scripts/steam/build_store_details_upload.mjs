import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const detailsPath = path.join(scriptDir, "localization/store-details.json");
const defaultOutputPath = path.join(scriptDir, "out/storepage_1247252_full_localized.json");

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function fail(message) {
  console.error(`Store details build failed: ${message}`);
  process.exit(1);
}

const baseArg = readArg("--base");
if (!baseArg) fail("pass the current Steamworks JSON export with --base <path>");

const basePath = path.resolve(process.cwd(), baseArg);
const outputPath = path.resolve(process.cwd(), readArg("--out") ?? defaultOutputPath);
const payload = JSON.parse(fs.readFileSync(basePath, "utf8"));
const details = JSON.parse(fs.readFileSync(detailsPath, "utf8"));

if (String(payload.itemid) !== "1247252" || typeof payload.languages !== "object") {
  fail("the base export is not the Gulugulu store-page localization payload");
}

const targetLanguages = Object.keys(details).filter((key) => !key.startsWith("_"));
if (targetLanguages.length !== 18) {
  fail(`expected 18 localized detail languages, found ${targetLanguages.length}`);
}

const fields = {
  minOs: "app[content][sysreqs][windows][min][osversion]",
  minCpu: "app[content][sysreqs][windows][min][processor]",
  minGpu: "app[content][sysreqs][windows][min][graphics]",
  minNotes: "app[content][sysreqs][windows][min][notes]",
  recOs: "app[content][sysreqs][windows][rec][osversion]",
  recCpu: "app[content][sysreqs][windows][rec][processor]",
  recGpu: "app[content][sysreqs][windows][rec][graphics]",
  why: "app[content][earlyaccess][why]",
  howLong: "app[content][earlyaccess][how_long]",
  fullVersion: "app[content][earlyaccess][full_version]",
  currentState: "app[content][earlyaccess][current_state]",
  pricing: "app[content][earlyaccess][pricing]",
  community: "app[content][earlyaccess][community]",
};
const allowedFields = new Set(Object.values(fields));
const before = structuredClone(payload);

for (const language of targetLanguages) {
  const source = details[language];
  const destination = payload.languages[language];
  if (!destination) fail(`Steam export has no ${language} language block`);
  if (!Array.isArray(source.sysreq) || source.sysreq.length !== 5) {
    fail(`${language}.sysreq must contain five localized values`);
  }
  if (!source.earlyaccess || typeof source.earlyaccess !== "object") {
    fail(`${language}.earlyaccess is missing`);
  }

  const values = {
    [fields.minOs]: "Windows 10 64-bit",
    [fields.minCpu]: source.sysreq[0],
    [fields.minGpu]: source.sysreq[1],
    [fields.minNotes]: source.sysreq[2],
    [fields.recOs]: "Windows 11",
    [fields.recCpu]: source.sysreq[3],
    [fields.recGpu]: source.sysreq[4],
    [fields.why]: source.earlyaccess.why,
    [fields.howLong]: source.earlyaccess.how_long,
    [fields.fullVersion]: source.earlyaccess.full_version,
    [fields.currentState]: source.earlyaccess.current_state,
    [fields.pricing]: source.earlyaccess.pricing,
    [fields.community]: source.earlyaccess.community,
  };

  for (const [field, value] of Object.entries(values)) {
    if (typeof value !== "string" || value.trim().length === 0) {
      fail(`${language}.${field} is empty`);
    }
    destination[field] = value;
  }
}

for (const [language, beforeFields] of Object.entries(before.languages)) {
  const afterFields = payload.languages[language];
  for (const field of new Set([...Object.keys(beforeFields), ...Object.keys(afterFields)])) {
    const mayChange = targetLanguages.includes(language) && allowedFields.has(field);
    if (!mayChange && afterFields[field] !== beforeFields[field]) {
      fail(`unexpected change to ${language}.${field}`);
    }
  }
}

for (const protectedLanguage of ["english", "schinese"]) {
  if (JSON.stringify(payload.languages[protectedLanguage]) !== JSON.stringify(before.languages[protectedLanguage])) {
    fail(`${protectedLanguage} changed; refusing to build the upload`);
  }
}

const populatedCount = targetLanguages.reduce(
  (total, language) => total + [...allowedFields].filter((field) => payload.languages[language][field]?.trim()).length,
  0,
);
if (populatedCount !== targetLanguages.length * allowedFields.size) {
  fail(`expected ${targetLanguages.length * allowedFields.size} populated target values, found ${populatedCount}`);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

console.log(`Built ${path.relative(repoRoot, outputPath)}`);
console.log(`Populated ${populatedCount} values across ${targetLanguages.length} languages.`);
console.log("English and Simplified Chinese are byte-for-byte unchanged.");
