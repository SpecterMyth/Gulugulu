import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import ts from "typescript";

const onboardingDir = dirname(fileURLToPath(import.meta.url));
const appDir = join(onboardingDir, "..", "..", "..");

async function importBundled(contents) {
  const bundle = await build({
    stdin: {
      contents,
      resolveDir: appDir,
      sourcefile: "onboarding-copy-verification.ts",
      loader: "ts",
    },
    bundle: true,
    format: "esm",
    platform: "node",
    outfile: "onboarding-copy-verification.js",
    write: false,
    logLevel: "silent",
    loader: { ".css": "empty" },
  });
  const javascript = bundle.outputFiles.find((file) => file.path.endsWith(".js"));
  assert.ok(javascript, "esbuild did not emit a JavaScript verification bundle");
  const source = Buffer.from(javascript.contents).toString("base64");
  return import(`data:text/javascript;base64,${source}`);
}

const mainCopy = await importBundled(`
  export {
    ONBOARDING_EN_COPY,
    ONBOARDING_STEP_IDS,
    onboardingLanguageFromStorage,
  } from "./src/app/onboarding/onboardingCopy";
`);
const reviewedCopy = await importBundled(`
  export { REVIEWED_ONBOARDING_LOCALES } from "./src/app/onboarding/reviewedOnboardingLocales";
`);
const expansionCopy = await importBundled(`
  export { ONBOARDING_EXPANSION_COPY } from "./src/app/onboarding/onboardingExpansionCopy";
`);
const factoryCopy = await importBundled(`
  export {
    FACTORY_FIRST_RUN_COPY,
    factoryResumeGuide,
  } from "./src/game/factory/FactoryFirstRunGuide";
`);
const mainDirective = await importBundled(`
  export { onboardingDirective } from "./src/app/onboarding/onboardingSteps";
`);
const director = await importBundled(`
  export {
    createOnboardingTaskQueue,
    skipOnboardingRoute,
  } from "./src/app/onboarding/useOnboardingDirector";
`);

assert.equal(mainCopy.ONBOARDING_STEP_IDS.length, 63, "persisted onboarding route must cover all 63 steps");
assert.deepEqual(
  Object.keys(mainCopy.ONBOARDING_EN_COPY).sort(),
  [...mainCopy.ONBOARDING_STEP_IDS].sort(),
  "English copy must cover every persisted onboarding cursor",
);
assert.equal(
  mainCopy.onboardingLanguageFromStorage(),
  "en",
  "an environment without a saved language must fall back to English",
);

const han = /\p{Script=Han}/u;
const defaultDirective = mainDirective.onboardingDirective(
  { onboarding: { status: "active", step: "A01" } },
  { species: {} },
  {
    uiMode: "pet",
    nearPetId: null,
    nearShop: false,
    nearMarket: false,
    fusionModalOpen: false,
  },
);
assert.ok(defaultDirective, "A01 must produce an onboarding directive");
assert.doesNotMatch(defaultDirective.label, han, "default A01 directive must be English");
assert.doesNotMatch(
  factoryCopy.factoryResumeGuide().label,
  han,
  "default factory resume guide must be English",
);

let simulatedSave = {
  onboarding: {
    status: "active",
    step: "A01",
    agentPromptSkipped: false,
  },
};
const submittedReceipts = [];
let agentSkips = 0;
let fusionRewardGrants = 0;
let savedSnapshots = 0;
const skipBridge = {
  async grantSkippedOnboardingFusions() {
    fusionRewardGrants += 1;
    return simulatedSave;
  },
  async advanceOnboarding(receipt) {
    submittedReceipts.push(receipt);
    const current = simulatedSave.onboarding.step;
    if (current.startsWith("C")) {
      assert.equal(receipt, "C12", "factory compatibility cursors must collapse through C12");
      simulatedSave = {
        onboarding: { ...simulatedSave.onboarding, step: "D01" },
      };
      return simulatedSave;
    }
    assert.equal(receipt, current, `skip receipt is out of order at ${current}`);
    if (current === "G07") {
      simulatedSave = {
        onboarding: {
          ...simulatedSave.onboarding,
          status: "completed",
          step: "DONE",
        },
      };
      return simulatedSave;
    }
    const index = mainCopy.ONBOARDING_STEP_IDS.indexOf(current);
    assert.ok(index >= 0, `unknown simulated step ${current}`);
    simulatedSave = {
      onboarding: {
        ...simulatedSave.onboarding,
        step: mainCopy.ONBOARDING_STEP_IDS[index + 1],
      },
    };
    return simulatedSave;
  },
  async skipOnboardingAgent() {
    agentSkips += 1;
    simulatedSave = {
      onboarding: { ...simulatedSave.onboarding, agentPromptSkipped: true },
    };
    return simulatedSave;
  },
};
const skippedSave = await director.skipOnboardingRoute(
  skipBridge,
  simulatedSave,
  () => {
    savedSnapshots += 1;
  },
);
assert.equal(skippedSave.onboarding.status, "completed", "skipMain must persist completion");
assert.equal(skippedSave.onboarding.step, "DONE", "skipMain must finish at DONE");
assert.equal(agentSkips, 1, "skipMain must persist the optional-AI skip receipt once");
assert.equal(fusionRewardGrants, 1, "skipMain must grant all tutorial fusion results once");
assert.equal(
  submittedReceipts.filter((step) => step === "C12").length,
  1,
  "skipMain must submit exactly one first-shift compatibility receipt",
);
assert.equal(submittedReceipts.length, 52, "skipMain receipt count changed unexpectedly");
assert.equal(savedSnapshots, 54, "every skip mutation must update the live save");

const queueCalls = [];
const busyTransitions = [];
let releaseFirst;
const firstGate = new Promise((resolve) => {
  releaseFirst = resolve;
});
const taskQueue = director.createOnboardingTaskQueue((busy) => busyTransitions.push(busy));
const firstReceipt = taskQueue.run("complete:A04", async () => {
  queueCalls.push("A04:start");
  await firstGate;
  queueCalls.push("A04:end");
  return { onboarding: { status: "active", step: "A05" } };
});
const repeatedReceipt = taskQueue.run("complete:A04", async () => {
  queueCalls.push("A04:duplicate");
  return null;
});
assert.equal(repeatedReceipt, firstReceipt, "rapid repeated receipt must reuse the in-flight promise");
const nextReceipt = taskQueue.run("complete:A05", async () => {
  queueCalls.push("A05");
  return { onboarding: { status: "active", step: "A06" } };
});
await Promise.resolve();
assert.deepEqual(queueCalls, ["A04:start"], "a different next mutation must wait for persistence order");
releaseFirst();
await Promise.all([firstReceipt, repeatedReceipt, nextReceipt]);
assert.deepEqual(
  queueCalls,
  ["A04:start", "A04:end", "A05"],
  "the queue must coalesce duplicates but preserve ordered next-step work",
);
assert.deepEqual(busyTransitions, [true, false], "busy feedback must cover the full queued transaction");

await assert.rejects(
  taskQueue.run("complete:failure", async () => {
    throw new Error("simulated persistence failure");
  }),
  /simulated persistence failure/,
  "persistence errors must reach the caller",
);
const recoveredQueueResult = await taskQueue.run("complete:recovery", async () => ({ recovered: true }));
assert.equal(recoveredQueueResult.recovered, true, "a failed receipt must not poison later onboarding work");

for (const [step, copy] of Object.entries(mainCopy.ONBOARDING_EN_COPY)) {
  assert.ok(copy.chapter.trim(), `${step}: missing English chapter`);
  assert.ok(copy.label.trim(), `${step}: missing English label`);
  assert.doesNotMatch(copy.chapter, han, `${step}: English chapter contains Chinese text`);
  assert.doesNotMatch(copy.label, han, `${step}: English label contains Chinese text`);
  if (copy.cta != null) assert.doesNotMatch(copy.cta, han, `${step}: English CTA contains Chinese text`);
}

const reviewedLanguages = [
  "zh-Hant", "ja", "ko", "fr", "de", "es-ES", "es-419", "pt-BR", "pt-PT", "ru",
  "it", "pl", "tr", "uk", "ar", "th", "vi", "id", "nl",
];
const allLanguages = ["en", "zh-Hans", ...reviewedLanguages];
assert.deepEqual(
  Object.keys(expansionCopy.ONBOARDING_EXPANSION_COPY).sort(),
  [...allLanguages].sort(),
  "new onboarding segment must have reviewed copy for every supported language",
);
for (const language of allLanguages) {
  for (const [key, value] of Object.entries(expansionCopy.ONBOARDING_EXPANSION_COPY[language])) {
    assert.ok(value.trim(), `${language}.expansion.${key} is empty`);
  }
}
assert.deepEqual(
  Object.keys(reviewedCopy.REVIEWED_ONBOARDING_LOCALES).sort(),
  [...reviewedLanguages].sort(),
  "reviewed onboarding copy must cover every non-English, non-Simplified-Chinese language",
);
for (const language of reviewedLanguages) {
  const locale = reviewedCopy.REVIEWED_ONBOARDING_LOCALES[language];
  assert.deepEqual(
    Object.keys(locale.onboarding).sort(),
    [...mainCopy.ONBOARDING_STEP_IDS].sort(),
    `${language}: reviewed copy must cover every onboarding cursor`,
  );
  for (const [step, copy] of Object.entries(locale.onboarding)) {
    assert.ok(copy.chapter.trim(), `${language}.${step}: chapter is empty`);
    assert.ok(copy.label.trim(), `${language}.${step}: label is empty`);
  }
  for (const [key, value] of Object.entries(locale.onboardingUi)) {
    assert.ok(value.trim(), `${language}.onboardingUi.${key} is empty`);
  }
  for (const [key, value] of Object.entries(locale.factoryFirstRun)) {
    assert.ok(value.trim(), `${language}.factoryFirstRun.${key} is empty`);
  }
}

for (const language of ["en", "zh-Hans"]) {
  const copy = factoryCopy.FACTORY_FIRST_RUN_COPY[language];
  assert.ok(copy, `factory guide is missing ${language} copy`);
  for (const [key, value] of Object.entries(copy)) {
    assert.ok(value.trim(), `factory ${language}.${key} is empty`);
    if (language === "en") {
      assert.doesNotMatch(value, han, `factory en.${key} contains Chinese text`);
    }
  }
}

const [directorSource, factorySource, stepsSource] = await Promise.all([
  readFile(join(onboardingDir, "useOnboardingDirector.ts"), "utf8"),
  readFile(join(appDir, "src", "game", "factory", "FactoryFirstRunGuide.tsx"), "utf8"),
  readFile(join(onboardingDir, "onboardingSteps.ts"), "utf8"),
]);
assert.match(
  stepsSource,
  /language === ["']zh-Hans["']/,
  "the onboarding route must limit authored Simplified Chinese fallback to zh-Hans",
);
assert.doesNotMatch(
  stepsSource,
  /language\.startsWith\(["']zh["']\)/,
  "zh-Hant must use its generated Traditional Chinese onboarding copy",
);
for (const [name, source] of [
  ["main route", directorSource],
  ["factory route", factorySource],
]) {
  assert.doesNotMatch(
    source,
    /addEventListener\(\s*["'](?:pointerdown|click)["']\s*,\s*guard\s*,\s*true/,
    `${name} still installs a capture-phase global input mutex`,
  );
}
assert.match(directorSource, /skipMain:\s*\(\)\s*=>/, "director must expose the persistent skipMain API");
for (const match of stepsSource.matchAll(/^\s*([A-G]\w+):\s*\{[^\n]*\bcta:/gm)) {
  const step = match[1];
  assert.ok(
    mainCopy.ONBOARDING_EN_COPY[step]?.cta,
    `${step}: an actionable Chinese card is missing its English CTA`,
  );
}

const configPath = join(appDir, "tsconfig.json");
const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
assert.equal(configFile.error, undefined, "could not read tsconfig.json");
const compilerConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, appDir);
const typecheckRoots = [
  join(appDir, "src", "vite-env.d.ts"),
  join(onboardingDir, "OnboardingGoal.tsx"),
  join(onboardingDir, "onboardingCopy.ts"),
  join(onboardingDir, "onboardingSteps.ts"),
  join(onboardingDir, "useOnboardingDirector.ts"),
  join(appDir, "src", "game", "factory", "FactoryFirstRunGuide.tsx"),
];
const program = ts.createProgram({
  rootNames: typecheckRoots,
  options: { ...compilerConfig.options, noEmit: true },
});
const diagnostics = ts.getPreEmitDiagnostics(program);
assert.equal(
  diagnostics.length,
  0,
  diagnostics.length === 0
    ? ""
    : ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: (fileName) => fileName,
        getCurrentDirectory: () => appDir,
        getNewLine: () => "\n",
      }),
);

console.log("onboarding copy: 63 steps, 21-language expansion, factory guide, skip API, non-blocking input, and types passed");
