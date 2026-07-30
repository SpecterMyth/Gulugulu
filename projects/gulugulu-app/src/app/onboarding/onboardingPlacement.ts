export type OnboardingRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type OnboardingPlacement = {
  left: number;
  top: number;
  position: string;
  overlap: number;
};

export type OnboardingSpeechRect = OnboardingRect & {
  movable?: boolean;
  preferred?: boolean;
  screenFixed?: boolean;
};

const EDGE_GAP = 10;
const TARGET_CLEARANCE = 64;
const SPEECH_CLEARANCE = 12;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function rectAt(left: number, top: number, width: number, height: number): OnboardingRect {
  return { left, top, width, height };
}

function intersectionArea(a: OnboardingRect, b: OnboardingRect): number {
  const width = Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left));
  const height = Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));
  return width * height;
}

function expand(rect: OnboardingRect, amount: number): OnboardingRect {
  return {
    left: rect.left - amount,
    top: rect.top - amount,
    width: rect.width + amount * 2,
    height: rect.height + amount * 2,
  };
}

/**
 * Place the guide card in a stable viewport slot that does not cover the current
 * highlighted target. The target-relative side slots are fallbacks for large
 * panels that occupy most of the viewport.
 */
export function placeOnboardingCard(
  viewport: { width: number; height: number },
  card: { width: number; height: number },
  target?: OnboardingRect | null,
  guideFx: OnboardingRect[] = [],
  speechBubbles: OnboardingSpeechRect[] = [],
): OnboardingPlacement {
  const maxLeft = Math.max(EDGE_GAP, viewport.width - card.width - EDGE_GAP);
  const maxTop = Math.max(EDGE_GAP, viewport.height - card.height - EDGE_GAP);
  const centerLeft = clamp((viewport.width - card.width) / 2, EDGE_GAP, maxLeft);
  const centerTop = clamp((viewport.height - card.height) / 2, EDGE_GAP, maxTop);
  const rightLeft = maxLeft;
  const bottomTop = maxTop;

  const visibleSpeechBubbles = speechBubbles
    .map((speech) => ({
      left: clamp(speech.left, 0, viewport.width),
      top: clamp(speech.top, 0, viewport.height),
      width: Math.max(0, Math.min(speech.left + speech.width, viewport.width) - Math.max(speech.left, 0)),
      height: Math.max(0, Math.min(speech.top + speech.height, viewport.height) - Math.max(speech.top, 0)),
      movable: speech.movable,
      preferred: speech.preferred,
      screenFixed: speech.screenFixed,
    }))
    .filter((speech) => speech.width > 0 && speech.height > 0);

  const speechTopSlots = visibleSpeechBubbles.map((speech, index) => ({
    position: speech.screenFixed
      ? "screen-top"
      : index === 0
        ? "speech-top"
        : `speech-${index + 1}-top`,
    left: speech.screenFixed
      ? centerLeft
      : clamp(speech.left + speech.width / 2 - card.width / 2, EDGE_GAP, maxLeft),
    // When the character is close to the window top, spend the decorative edge
    // margin before covering the anchor. Zero is still fully inside the viewport.
    top: clamp(
      speech.screenFixed ? EDGE_GAP : speech.top - card.height - SPEECH_CLEARANCE,
      speech.preferred ? 0 : EDGE_GAP,
      maxTop,
    ),
    preferred: speech.preferred,
  }));

  const preferredSpeechSlots = speechTopSlots.filter((slot) => slot.preferred);
  const slots =
    preferredSpeechSlots.length > 0
      ? preferredSpeechSlots
      : [
          ...speechTopSlots,
          { position: "bottom", left: centerLeft, top: bottomTop },
          { position: "top", left: centerLeft, top: EDGE_GAP },
          { position: "bottom-left", left: EDGE_GAP, top: bottomTop },
          { position: "bottom-right", left: rightLeft, top: bottomTop },
          { position: "top-left", left: EDGE_GAP, top: EDGE_GAP },
          { position: "top-right", left: rightLeft, top: EDGE_GAP },
          { position: "center-left", left: EDGE_GAP, top: centerTop },
          { position: "center-right", left: rightLeft, top: centerTop },
        ];

  if (!target || target.width <= 0 || target.height <= 0) {
    return { ...slots[0], overlap: 0 };
  }

  const visibleTarget: OnboardingRect = {
    left: clamp(target.left, 0, viewport.width),
    top: clamp(target.top, 0, viewport.height),
    width: Math.max(0, Math.min(target.left + target.width, viewport.width) - Math.max(target.left, 0)),
    height: Math.max(0, Math.min(target.top + target.height, viewport.height) - Math.max(target.top, 0)),
  };
  if (visibleTarget.width <= 0 || visibleTarget.height <= 0) {
    return { ...slots[0], overlap: 0 };
  }

  const targetCenterX = visibleTarget.left + visibleTarget.width / 2;
  const targetCenterY = visibleTarget.top + visibleTarget.height / 2;
  slots.push(
    {
      position: "target-bottom",
      left: clamp(targetCenterX - card.width / 2, EDGE_GAP, maxLeft),
      top: clamp(visibleTarget.top + visibleTarget.height + TARGET_CLEARANCE, EDGE_GAP, maxTop),
    },
    {
      position: "target-top",
      left: clamp(targetCenterX - card.width / 2, EDGE_GAP, maxLeft),
      top: clamp(visibleTarget.top - card.height - TARGET_CLEARANCE, EDGE_GAP, maxTop),
    },
    {
      position: "target-right",
      left: clamp(visibleTarget.left + visibleTarget.width + TARGET_CLEARANCE, EDGE_GAP, maxLeft),
      top: clamp(targetCenterY - card.height / 2, EDGE_GAP, maxTop),
    },
    {
      position: "target-left",
      left: clamp(visibleTarget.left - card.width - TARGET_CLEARANCE, EDGE_GAP, maxLeft),
      top: clamp(targetCenterY - card.height / 2, EDGE_GAP, maxTop),
    },
  );

  const clearanceRect = expand(visibleTarget, TARGET_CLEARANCE);
  let best = slots[0];
  let bestOverlap = Number.POSITIVE_INFINITY;
  let bestScore = Number.POSITIVE_INFINITY;

  slots.forEach((slot, preference) => {
    const cardRect = rectAt(slot.left, slot.top, card.width, card.height);
    const overlap = intersectionArea(cardRect, visibleTarget);
    const guideFxOverlap = guideFx.reduce(
      (total, fxRect) => total + intersectionArea(cardRect, expand(fxRect, EDGE_GAP)),
      0,
    );
    const speechOverlap = visibleSpeechBubbles.reduce(
      (total, speechRect) =>
        total +
        (speechRect.movable && cardRect.top <= speechRect.top
          ? 0
          : intersectionArea(cardRect, expand(speechRect, SPEECH_CLEARANCE))),
      0,
    );
    const clearanceOverlap = intersectionArea(cardRect, clearanceRect);
    // Covering the real target is always worse than merely entering its gesture
    // clearance. Guide hand/keys/arrows are also protected from the card.
    // Preference keeps the card stable (bottom, then top) on ties.
    const score =
      overlap * 1_000_000_000 +
      guideFxOverlap * 1_000_000 +
      speechOverlap * 1_000_000 +
      clearanceOverlap * 1_000 +
      preference;
    if (score < bestScore) {
      best = slot;
      bestOverlap = overlap;
      bestScore = score;
    }
  });

  return { ...best, overlap: bestOverlap };
}
