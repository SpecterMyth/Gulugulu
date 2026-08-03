// 强引导卡避让回归：覆盖小宠物窗、菜单窗、后院横条和工厂全屏的典型目标位置。
// 卡片必须留在视口内；存在可用空间的场景不得覆盖目标或手指/键帽/箭头。
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const bundle = await build({
  entryPoints: [join(appDir, "src/app/onboarding/onboardingPlacement.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  logLevel: "silent",
});
const source = Buffer.from(bundle.outputFiles[0].contents).toString("base64");
const { placeOnboardingCard } = await import(`data:text/javascript;base64,${source}`);

const area = (a, b) =>
  Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left)) *
  Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));

const scenarios = [
  {
    name: "A01 ready egg in 280x320 pet window",
    viewport: { width: 280, height: 320 },
    card: { width: 252, height: 137 },
    target: { left: 40, top: 153, width: 200, height: 168 },
    fx: [{ left: 225, top: 233, width: 46, height: 66 }],
  },
  {
    name: "A01 compact English guide clears the stage egg including paper shadow",
    viewport: { width: 280, height: 320 },
    card: { width: 260, height: 125 },
    target: { left: 40, top: 143, width: 200, height: 178 },
    fx: [],
    speech: [
      {
        left: 40,
        top: 143,
        width: 200,
        height: 178,
        preferred: true,
      },
    ],
    expectAboveSpeech: true,
    minPaintedGap: 8,
  },
  {
    name: "A01 compact Chinese guide clears the stage egg including paper shadow",
    viewport: { width: 280, height: 320 },
    card: { width: 260, height: 110 },
    target: { left: 40, top: 153, width: 200, height: 168 },
    fx: [],
    speech: [
      {
        left: 40,
        top: 153,
        width: 200,
        height: 168,
        preferred: true,
      },
    ],
    expectAboveSpeech: true,
    minPaintedGap: 12,
  },
  {
    name: "small-window English acknowledgement clears the companion including paper shadow",
    viewport: { width: 280, height: 320 },
    card: { width: 260, height: 125 },
    target: null,
    fx: [],
    speech: [{ left: 40, top: 143, width: 200, height: 178, preferred: true }],
    expectAboveSpeech: true,
    minSpeechPaintedGap: 10,
  },
  {
    name: "small-window late English target step clears the companion",
    viewport: { width: 280, height: 452 },
    card: { width: 260, height: 115 },
    target: { left: 40, top: 143, width: 200, height: 178 },
    fx: [],
    speech: [{ left: 40, top: 143, width: 200, height: 178, preferred: true }],
    expectAboveSpeech: true,
    minPaintedGap: 12,
  },
  {
    name: "long acknowledgement can abandon a blocked preferred anchor",
    viewport: { width: 760, height: 560 },
    card: { width: 520, height: 200 },
    target: null,
    fx: [],
    speech: [{ left: 250, top: 180, width: 260, height: 120, preferred: true }],
  },
  {
    name: "pet click target in 280x320 pet window",
    viewport: { width: 280, height: 320 },
    card: { width: 252, height: 137 },
    target: { left: 40, top: 153, width: 200, height: 167 },
    fx: [{ left: 225, top: 204, width: 46, height: 66 }],
  },
  {
    name: "bottom menu button",
    viewport: { width: 280, height: 452 },
    card: { width: 252, height: 160 },
    target: { left: 16, top: 370, width: 248, height: 48 },
    fx: [{ left: 118, top: 314, width: 44, height: 58 }],
  },
  {
    name: "backyard character and movement keys",
    viewport: { width: 1280, height: 428 },
    card: { width: 520, height: 145 },
    target: { left: 600, top: 220, width: 86, height: 150 },
    fx: [{ left: 545, top: 382, width: 190, height: 32 }],
  },
  {
    name: "backyard point of interest at left edge",
    viewport: { width: 1280, height: 428 },
    card: { width: 520, height: 145 },
    target: { left: 20, top: 160, width: 180, height: 190 },
    fx: [{ left: 205, top: 215, width: 40, height: 40 }],
  },
  {
    name: "fusion confirm modal",
    viewport: { width: 760, height: 560 },
    card: { width: 520, height: 166 },
    target: { left: 260, top: 450, width: 240, height: 54 },
    fx: [{ left: 358, top: 392, width: 44, height: 58 }],
  },
  {
    name: "factory start control near top",
    viewport: { width: 1280, height: 720 },
    card: { width: 520, height: 145 },
    target: { left: 520, top: 62, width: 240, height: 58 },
    fx: [{ left: 618, top: 116, width: 44, height: 58 }],
  },
  {
    name: "guide stacks above a visible character speech bubble",
    viewport: { width: 760, height: 560 },
    card: { width: 520, height: 137 },
    target: { left: 315, top: 410, width: 130, height: 120 },
    fx: [],
    speech: [{ left: 250, top: 280, width: 260, height: 72 }],
    expectAboveSpeech: true,
  },
  {
    name: "small pet window keeps guide first and pushes movable speech below",
    viewport: { width: 280, height: 320 },
    card: { width: 252, height: 137 },
    target: { left: 20, top: 245, width: 240, height: 64 },
    fx: [],
    speech: [{ left: 10, top: 24, width: 260, height: 52, movable: true }],
    expectAboveSpeech: true,
  },
  {
    name: "backyard guide stays above the hero instead of covering it",
    viewport: { width: 790, height: 429 },
    card: { width: 650, height: 165 },
    target: { left: 720, top: 350, width: 50, height: 50 },
    fx: [],
    speech: [
      {
        left: 355,
        top: 228,
        width: 120,
        height: 120,
        preferred: true,
        screenFixed: true,
      },
    ],
    expectAboveSpeech: true,
    expectPosition: { left: 70, top: 10 },
  },
  {
    name: "backyard guide stays fixed when the hero moves to the right edge",
    viewport: { width: 790, height: 429 },
    card: { width: 650, height: 165 },
    target: { left: 720, top: 350, width: 50, height: 50 },
    fx: [],
    speech: [
      {
        left: 650,
        top: 228,
        width: 120,
        height: 120,
        preferred: true,
        screenFixed: true,
      },
    ],
    expectAboveSpeech: true,
    expectPosition: { left: 70, top: 10 },
  },
  {
    name: "main guide uses the character as its preferred fallback anchor",
    viewport: { width: 280, height: 452 },
    card: { width: 252, height: 137 },
    target: { left: 16, top: 370, width: 248, height: 48 },
    fx: [],
    speech: [{ left: 40, top: 245, width: 200, height: 167, preferred: true }],
    expectAboveSpeech: true,
  },
  {
    name: "main guide moves above a speech bubble that appears later",
    viewport: { width: 280, height: 452 },
    card: { width: 252, height: 137 },
    target: { left: 16, top: 370, width: 248, height: 48 },
    fx: [],
    speech: [{ left: 10, top: 170, width: 260, height: 62, movable: true, preferred: true }],
    expectAboveSpeech: true,
  },
];

for (const scenario of scenarios) {
  const placed = placeOnboardingCard(
    scenario.viewport,
    scenario.card,
    scenario.target,
    scenario.fx,
    scenario.speech,
  );
  const cardRect = { left: placed.left, top: placed.top, ...scenario.card };
  if (scenario.expectPosition) {
    assert.deepEqual(
      { left: placed.left, top: placed.top },
      scenario.expectPosition,
      `${scenario.name}: fixed guide position changed with the character`,
    );
  }
  if (scenario.minPaintedGap) {
    const paintedBottom = cardRect.top + cardRect.height + 8;
    assert.ok(
      paintedBottom + scenario.minPaintedGap <= scenario.target.top,
      `${scenario.name}: rotated paper edge or shadow can cover the target`,
    );
  }
  if (scenario.minSpeechPaintedGap) {
    const paintedBottom = cardRect.top + cardRect.height + 8;
    assert.ok(
      paintedBottom + scenario.minSpeechPaintedGap <= scenario.speech[0].top,
      `${scenario.name}: decorated paper card is too close to the subject`,
    );
  }
  assert.ok(placed.left >= 0 && placed.top >= 0, `${scenario.name}: card starts outside viewport`);
  assert.ok(
    placed.left + scenario.card.width <= scenario.viewport.width &&
      placed.top + scenario.card.height <= scenario.viewport.height,
    `${scenario.name}: card ends outside viewport`,
  );
  if (scenario.target) {
    assert.equal(area(cardRect, scenario.target), 0, `${scenario.name}: card covers target`);
  }
  for (const fx of scenario.fx) {
    assert.equal(area(cardRect, fx), 0, `${scenario.name}: card covers guide gesture`);
  }
  for (const speech of scenario.speech ?? []) {
    if (!speech.movable) {
      assert.equal(area(cardRect, speech), 0, `${scenario.name}: card covers character speech`);
    }
    if (scenario.expectAboveSpeech) {
      assert.ok(
        speech.movable
          ? cardRect.top <= speech.top
          : cardRect.top + cardRect.height <= speech.top,
        `${scenario.name}: guide is not ordered above character speech`,
      );
    }
  }
}

console.log(`onboarding layout: ${scenarios.length} target/viewport scenarios passed`);
