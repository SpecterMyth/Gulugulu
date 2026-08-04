import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const locales = JSON.parse(readFileSync(
  join(APP_ROOT, "src", "i18n", "generated", "runtimeLocales.json"),
  "utf8",
));

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

// A locale may use natural prose (for example, "Gained {exp} EXP") instead of
// a leading plus. If it keeps the compact +N notation, however, the plus must
// stay attached to the placeholder and may not be translated or duplicated.
for (const [locale, bundle] of Object.entries(locales)) {
  for (const key of ["tokenMealExp", "tokenMealLevelUp"]) {
    const value = bundle.shell?.speech?.[key];
    check(typeof value === "string", `${locale}.shell.speech.${key}: missing`);
    if (typeof value !== "string") continue;
    const plusCount = (value.match(/\+/gu) ?? []).length;
    check(
      plusCount === 0 || (plusCount === 1 && value.includes("+{exp}")),
      `${locale}.shell.speech.${key}: plus notation must be exactly "+{exp}"; got ${JSON.stringify(value)}`,
    );
    check(
      (value.match(/\{exp\}/gu) ?? []).length === 1,
      `${locale}.shell.speech.${key}: expected exactly one {exp} placeholder; got ${JSON.stringify(value)}`,
    );
  }

  const adjacentGainPlaceholders = [
    ["shell.toast.barDone", bundle.shell?.toast?.barDone, ["coins", "exp"]],
    ["debug.coinAdded", bundle.debug?.coinAdded, ["amount"]],
  ];
  for (const [path, value, placeholders] of adjacentGainPlaceholders) {
    check(typeof value === "string", `${locale}.${path}: missing`);
    if (typeof value !== "string") continue;
    for (const placeholder of placeholders) {
      const placeholderIndex = value.indexOf(`{${placeholder}}`);
      const prefix = placeholderIndex < 0 ? "" : value.slice(0, placeholderIndex);
      const lastPlus = prefix.lastIndexOf("+");
      check(
        lastPlus < 0 || prefix.slice(lastPlus) === "+",
        `${locale}.${path}: + must be adjacent to {${placeholder}}; got ${JSON.stringify(value)}`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error(`Dynamic-localization audit failed (${failures.length} issue${failures.length === 1 ? "" : "s"}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Dynamic-localization audit passed for ${Object.keys(locales).length} generated locales.`);
}
