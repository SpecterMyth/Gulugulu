import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(scriptDir, "out");
const basePath = path.join(outDir, "itemdefs.json");
const localizedPath = path.join(outDir, "itemdefs.i18n.json");
const outputPath = path.join(outDir, "itemdefs.i18n.safe.json");

const base = JSON.parse(fs.readFileSync(basePath, "utf8"));
const localized = JSON.parse(fs.readFileSync(localizedPath, "utf8"));

if (!Array.isArray(base.items) || !Array.isArray(localized.items)) {
  throw new Error("Both inputs must contain an items array.");
}

const localizedById = new Map(
  localized.items.map((item) => [String(item.itemdefid), item]),
);

if (base.items.length !== localized.items.length) {
  throw new Error(
    `Item count mismatch: base=${base.items.length}, localized=${localized.items.length}`,
  );
}

const localizationKey = /^(display_type|name|description)_[a-z0-9_]+$/;
const speciesPetNames = new Set(
  base.items.filter((item) => String(item.tags ?? "").split(";").some((tag) => tag.startsWith("sp:"))).map((item) => item.name),
);
const mergedItems = base.items.map((baseItem) => {
  const translatedItem = localizedById.get(String(baseItem.itemdefid));
  if (!translatedItem) {
    throw new Error(`Missing localized itemdef ${baseItem.itemdefid}`);
  }

  const translatedFields = Object.fromEntries(
    Object.entries(translatedItem).filter(([key]) => localizationKey.test(key)),
  );
  const isSpeciesNameItem = speciesPetNames.has(baseItem.name)
    || [...speciesPetNames].some((name) => baseItem.name === `${name} Egg`);
  const generatedSpeciesNames = isSpeciesNameItem
    ? Object.fromEntries(Object.entries(baseItem).filter(([key]) => /^name_[a-z0-9_]+$/.test(key)))
    : {};

  return { ...baseItem, ...translatedFields, ...generatedSpeciesNames };
});

const mergedIds = new Set(mergedItems.map((item) => String(item.itemdefid)));
for (const item of localized.items) {
  if (!mergedIds.has(String(item.itemdefid))) {
    throw new Error(`Unexpected localized itemdef ${item.itemdefid}`);
  }
}

const output = { ...base, appid: localized.appid ?? base.appid, items: mergedItems };
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      outputPath,
      itemCount: mergedItems.length,
      localizedFields: mergedItems.reduce(
        (count, item) =>
          count + Object.keys(item).filter((key) => localizationKey.test(key)).length,
        0,
      ),
    },
    null,
    2,
  ),
);
