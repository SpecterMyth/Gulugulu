import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

export type PaperFxIntensity = 0 | 1 | 2 | 3;

export type PaperFxPreset =
  | "tap"
  | "purchase"
  | "place"
  | "reward"
  | "material"
  | "upgrade"
  | "unlock"
  | "achievement"
  | "milestone"
  | "level"
  | "max"
  | "training"
  | "factory"
  | "failure";

export type PaperFxPoint = { x: number; y: number };

export type PaperFxAnchor =
  | PaperFxPoint
  | DOMRect
  | HTMLElement
  | null
  | undefined;

export type PaperFxRequest = {
  preset: PaperFxPreset;
  intensity: PaperFxIntensity;
  anchor?: PaperFxAnchor;
  label?: string;
  palette?: string[];
  seed?: number;
  /** Allow this burst to leave a narrow app window through the Tauri FX overlay. */
  crossWindow?: boolean;
  /** Semantic key used to collapse accidental duplicate success callbacks. */
  dedupeKey?: string;
  /** Stable gameplay-event identity, also used to make particle paths deterministic. */
  eventId?: string;
};

export type PaperFxOverlayPayload = {
  preset: PaperFxPreset;
  intensity: PaperFxIntensity;
  x: number;
  y: number;
  label?: string;
  palette?: string[];
  seed: number;
  pieceDurationMs?: number;
  durationMs: number;
};

export type PaperFxPulse = PaperFxOverlayPayload & { id: number };

type PaperFxListener = (request: PaperFxRequest) => void;
const listeners = new Set<PaperFxListener>();

/**
 * App-wide semantic entry point. Keeping this outside React lets promise
 * callbacks, bridge event hooks and factory engines share one FX pipeline.
 */
export function emitPaperFx(request: PaperFxRequest): void {
  for (const listener of listeners) listener(request);
}

export function paperFxDuration(intensity: PaperFxIntensity): number {
  if (intensity <= 0) return 180;
  if (intensity === 1) return 520;
  if (intensity === 2) return 1120;
  return 2300;
}

function paperFxLifetime(
  intensity: PaperFxIntensity,
  hasLabel: boolean,
  preset?: PaperFxPreset,
): number {
  if (preset === "achievement" && hasLabel) return 5000;
  const pieces = paperFxDuration(intensity);
  if (!hasLabel || intensity < 2) return pieces;
  return Math.max(pieces, intensity === 3 ? 3200 : 2700);
}

function pointFor(anchor: PaperFxAnchor): PaperFxPoint {
  if (anchor instanceof HTMLElement) {
    const rect = anchor.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  if (anchor instanceof DOMRect) {
    return { x: anchor.left + anchor.width / 2, y: anchor.top + anchor.height / 2 };
  }
  if (anchor && "x" in anchor && "y" in anchor) return { x: anchor.x, y: anchor.y };
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

function hashText(text: string): number {
  let value = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

const NODE_BUDGET = 96;
const PIECES_BY_INTENSITY = [0, 8, 20, 44] as const;

export function paperFxNodeCount(intensity: PaperFxIntensity, hasLabel = false): number {
  return PIECES_BY_INTENSITY[intensity] + (hasLabel ? 1 : 0);
}

function pulseCost(pulse: PaperFxPulse): number {
  return paperFxNodeCount(pulse.intensity, Boolean(pulse.label));
}

type PaperFxContextValue = {
  emit: typeof emitPaperFx;
};

const PaperFxContext = createContext<PaperFxContextValue>({ emit: emitPaperFx });

export function usePaperFx(): PaperFxContextValue {
  return useContext(PaperFxContext);
}

export function PaperFxProvider({
  children,
  remote,
}: {
  children: ReactNode;
  remote?: (payload: PaperFxOverlayPayload) => Promise<boolean>;
}) {
  const [pulses, setPulses] = useState<PaperFxPulse[]>([]);
  const idRef = useRef(0);
  const dedupeRef = useRef(new Map<string, number>());
  const timersRef = useRef(new Set<number>());

  useEffect(() => {
    const onRequest: PaperFxListener = (request) => {
      if (request.intensity <= 0) return;
      const now = Date.now();
      const dedupeKey = request.dedupeKey ?? request.eventId;
      if (dedupeKey) {
        const last = dedupeRef.current.get(dedupeKey) ?? 0;
        if (now - last < 900) return;
        dedupeRef.current.set(dedupeKey, now);
      }

      idRef.current += 1;
      const id = idRef.current;
      const rawPoint = pointFor(request.anchor);
      const horizontalMargin = Math.min(132, window.innerWidth / 2);
      const verticalMargin = Math.min(76, window.innerHeight / 2);
      const point = request.preset === "achievement" && request.label
        ? {
            x: window.innerWidth / 2,
            y: window.innerHeight + 24,
          }
        : request.label
        ? {
            x: Math.max(horizontalMargin, Math.min(window.innerWidth - horizontalMargin, rawPoint.x)),
            y: Math.max(verticalMargin, Math.min(window.innerHeight - verticalMargin, rawPoint.y)),
          }
        : rawPoint;
      const pieceDurationMs = paperFxDuration(request.intensity);
      const durationMs = paperFxLifetime(
        request.intensity,
        Boolean(request.label),
        request.preset,
      );
      const seed =
        request.seed ??
        hashText(`${request.preset}:${request.label ?? ""}:${request.eventId ?? id}`);
      const pulse: PaperFxPulse = {
        id,
        preset: request.preset,
        intensity: request.intensity,
        x: point.x,
        y: point.y,
        label: request.label,
        palette: request.palette,
        seed,
        pieceDurationMs,
        durationMs,
      };

      const addLocal = () => {
        setPulses((current) => {
          const base =
            pulse.intensity === 3
              ? current.filter((item) => item.intensity !== 3)
              : current;
          const next = [...base, pulse];
          let cost = next.reduce((sum, item) => sum + pulseCost(item), 0);
          while (next.length > 1 && cost > NODE_BUDGET) {
            const removed = next.shift();
            if (removed) cost -= pulseCost(removed);
          }
          return next;
        });
        const timer = window.setTimeout(() => {
          timersRef.current.delete(timer);
          setPulses((current) => current.filter((item) => item.id !== id));
        }, durationMs + 120);
        timersRef.current.add(timer);
      };

      const wantsRemote =
        request.crossWindow ?? request.intensity >= 2;
      if (wantsRemote && remote) {
        void remote(pulse)
          .then((sent) => {
            if (!sent) addLocal();
          })
          .catch(addLocal);
      } else {
        addLocal();
      }
    };

    listeners.add(onRequest);
    return () => {
      listeners.delete(onRequest);
      for (const timer of timersRef.current) window.clearTimeout(timer);
      timersRef.current.clear();
    };
  }, [remote]);

  const value = useMemo<PaperFxContextValue>(() => ({ emit: emitPaperFx }), []);
  return (
    <PaperFxContext.Provider value={value}>
      {children}
      <div className="paper-fx-layer" aria-hidden="true">
        {pulses.map((pulse) => <PaperFxBurst key={pulse.id} pulse={pulse} />)}
      </div>
    </PaperFxContext.Provider>
  );
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

const DEFAULT_PALETTE = ["#FFE45C", "#8FE0D0", "#B8D8FA", "#FFB0C8", "#FFFDF4"];
const FAILURE_PALETTE = ["#D8D3C8", "#B7AEA0", "#8F887E"];
const GOLD_PALETTE = ["#FFE45C", "#FFD077", "#FFF4CC", "#FFB0C8"];

function paletteFor(pulse: PaperFxPulse): string[] {
  if (pulse.palette && pulse.palette.length > 0) return pulse.palette;
  if (pulse.preset === "failure") return FAILURE_PALETTE;
  if (pulse.preset === "achievement" || pulse.preset === "max" || pulse.preset === "milestone") {
    return GOLD_PALETTE;
  }
  return DEFAULT_PALETTE;
}

export function PaperFxBurst({ pulse }: { pulse: PaperFxPulse }) {
  const random = mulberry32(pulse.seed);
  const count = PIECES_BY_INTENSITY[pulse.intensity];
  const palette = paletteFor(pulse);
  const pieces = Array.from({ length: count }, (_, index) => {
    const angle = random() * Math.PI * 2;
    const minDistance = pulse.intensity === 1 ? 22 : pulse.intensity === 2 ? 52 : 90;
    const maxDistance = pulse.intensity === 1 ? 54 : pulse.intensity === 2 ? 130 : 270;
    const distance = minDistance + random() * (maxDistance - minDistance);
    const upward = pulse.intensity >= 2 ? 18 + random() * 58 : 5 + random() * 18;
    const shapeRoll = random();
    const shape =
      shapeRoll < 0.44 ? "strip" : shapeRoll < 0.7 ? "scrap" : shapeRoll < 0.88 ? "note" : "star";
    return {
      id: index,
      shape,
      color: palette[index % palette.length],
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance - upward,
      rotation: Math.round((random() - 0.5) * 760),
      delay: Math.round(random() * (pulse.intensity === 3 ? 230 : 90)),
      width: Math.round(5 + random() * (shape === "strip" ? 14 : 9)),
      height: Math.round(5 + random() * (shape === "strip" ? 5 : 10)),
    };
  });

  return (
    <div
      className={`paper-fx-burst is-${pulse.preset} is-l${pulse.intensity}`}
      style={
        {
          left: `${pulse.x}px`,
          top: `${pulse.y}px`,
          "--paper-fx-duration": `${pulse.durationMs}ms`,
          "--paper-piece-duration": `${pulse.pieceDurationMs ?? pulse.durationMs}ms`,
        } as CSSProperties
      }
    >
      <span className="paper-fx-ring" />
      {pieces.map((piece) => (
        <i
          key={piece.id}
          className={`paper-fx-piece is-${piece.shape}`}
          style={
            {
              "--paper-dx": `${piece.dx.toFixed(1)}px`,
              "--paper-dy": `${piece.dy.toFixed(1)}px`,
              "--paper-rotate": `${piece.rotation}deg`,
              "--paper-delay": `${piece.delay}ms`,
              "--paper-piece": piece.color,
              "--paper-w": `${piece.width}px`,
              "--paper-h": `${piece.height}px`,
            } as CSSProperties
          }
        />
      ))}
      {pulse.label && pulse.intensity >= 2 && (
        <span className="paper-fx-label">
          {pulse.preset === "achievement" && (
            <span className="paper-fx-steam-icon" aria-hidden="true">
              <svg viewBox="0 0 32 32" focusable="false">
                <circle cx="16" cy="16" r="15" />
                <circle cx="21.5" cy="10.5" r="4.25" />
                <circle cx="10" cy="21.5" r="3.5" />
                <path d="M13 19.8 18.1 13M6.8 19.8l5.9 2.5" />
              </svg>
            </span>
          )}
          <b>{pulse.label}</b>
          {pulse.preset !== "material" && (
            <em aria-hidden="true">{pulse.preset === "achievement" ? "★" : "✓"}</em>
          )}
        </span>
      )}
    </div>
  );
}
