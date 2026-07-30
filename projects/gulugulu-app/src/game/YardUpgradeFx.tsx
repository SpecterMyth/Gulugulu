import { fmt } from "../i18n";
import { useT } from "../useT";
import { PaperFxBurst, type PaperFxPulse } from "../ui/PaperFx";

/**
 * Backyard capacity upgrade celebration.
 *
 * Light remains as a quiet support layer because the transparent desktop
 * window cannot use a dark scrim. Paper fireworks and the capacity note now
 * carry the visual weight.
 */
export function YardUpgradeFx({ level, cap, maxed = false }: { level: number; cap: number; maxed?: boolean }) {
  const { T } = useT();
  const S = T.bk.scene;
  const pulse: PaperFxPulse = {
    id: level,
    preset: maxed ? "milestone" : "upgrade",
    intensity: maxed ? 3 : 2,
    x: 0,
    y: 0,
    seed: (level * 2654435761 + cap * 97) >>> 0,
    durationMs: 1600,
  };

  return (
    <div className="yup-root" aria-hidden="true">
      <div className="yup-rays" />
      <div className="yup-flash" />
      <div className="yup-ring" />
      <div className="yup-paper-burst">
        <PaperFxBurst pulse={pulse} />
      </div>

      <div className="yup-badge">
        <span className="yup-badge-title">{fmt(S.yardUpgradedFx, { level })}</span>
        <span className="yup-badge-sub">{fmt(S.yardUpgradedFxSub, { cap })}</span>
      </div>
    </div>
  );
}
