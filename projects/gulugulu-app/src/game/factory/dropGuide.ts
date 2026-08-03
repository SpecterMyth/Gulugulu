export type FactoryDropGuideDesk = {
  element: string;
  x: number;
  w: number;
  top: number;
};

export type FactoryDropGuideProjection = {
  x: number;
  y: number;
  ready: boolean;
  element: string | null;
};

const DROP_VX_SCALE = 0.4;
const DROP_INITIAL_VY = 40;
const GUIDE_DESK_INSET = 8;

/**
 * Predict the carried worker's horizontal position when it reaches a matching
 * desk surface. The real physics still owns the result; this intentionally
 * ignores the small random throw jitter and therefore uses a conservative
 * inset before declaring the marker ready.
 */
export function projectFactoryDropGuide({
  planeX,
  planeDir,
  planeSpeed,
  startFeetY,
  groundY,
  gravity,
  sceneWidth,
  elements,
  desks,
}: {
  planeX: number;
  planeDir: 1 | -1;
  planeSpeed: number;
  startFeetY: number;
  groundY: number;
  gravity: number;
  sceneWidth: number;
  elements: readonly string[];
  desks: readonly FactoryDropGuideDesk[];
}): FactoryDropGuideProjection {
  const timeTo = (surfaceY: number) => {
    const distance = Math.max(0, surfaceY - startFeetY);
    return (
      Math.sqrt(DROP_INITIAL_VY * DROP_INITIAL_VY + 2 * gravity * distance)
      - DROP_INITIAL_VY
    ) / Math.max(1, gravity);
  };
  const xAt = (surfaceY: number) =>
    planeX + planeDir * planeSpeed * DROP_VX_SCALE * timeTo(surfaceY);

  let best:
    | { desk: FactoryDropGuideDesk; x: number; distance: number; ready: boolean }
    | undefined;
  for (const desk of desks) {
    if (!elements.includes(desk.element)) continue;
    const x = xAt(desk.top);
    const inset = Math.min(GUIDE_DESK_INSET, Math.max(0, desk.w / 4));
    const left = desk.x + inset;
    const right = desk.x + desk.w - inset;
    const distance = x < left ? left - x : x > right ? x - right : 0;
    const candidate = { desk, x, distance, ready: distance === 0 };
    if (best == null || candidate.distance < best.distance) best = candidate;
  }

  if (best != null) {
    return {
      x: Math.min(sceneWidth - 18, Math.max(18, best.x)),
      y: best.desk.top - 12,
      ready: best.ready,
      element: best.desk.element,
    };
  }

  return {
    x: Math.min(sceneWidth - 18, Math.max(18, xAt(groundY))),
    y: groundY - 12,
    ready: false,
    element: null,
  };
}
