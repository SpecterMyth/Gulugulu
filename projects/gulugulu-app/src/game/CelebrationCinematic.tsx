import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { GameConfig, PetState } from "../types";
import { fmt, speciesDisplayName, type BackyardStrings } from "../i18n";
import { useT } from "../useT";
import { SvgSprite } from "../sprites/SvgSprite";
import { WorkBurst } from "../sprites/parts/workFx";

// ---------------------------------------------------------------------------
// 后院场景内 · 孵化/融合庆典的「屏幕空间电影化揭晓」层。
// 结构镜像 .by-dex-overlay（.by-stage 的兄弟节点、inset:0、不随舞台缩放），但
// 根层 pointer-events:none 保持后院可交互，仅居中揭晓卡可点（点击跳过）。
// 纯展示：据 pulse 渲染一次；生命周期/自动消失由 BackyardScene 的计时器管理。
// 复用 SvgSprite（petState="success" + tier 光环）做角色 showcase、WorkBurst 做
// 全屏粒子爆（无 workFx spec 时返回 null，故震波以 CSS .cine-boom 兜底）。
// ---------------------------------------------------------------------------

/** 孵化分支：普通/经典合并为 standard；AI 复用/全新/兜底各一档。 */
export type HatchBranch = "standard" | "aiReuse" | "aiNew" | "fallback";

/** 一次性庆典载荷（孵化揭晓 / 融合仪式达成）。纯 UI、从不序列化。 */
export type CelebrationPayload =
  | {
      phase: "hatch";
      branch: HatchBranch;
      tier: number;
      name: string;
      species: string;
      slot: number | null;
    }
  | {
      phase: "fusionCommit";
      mode: "recipe" | "ai";
      tier: number;
      name: string;
      species: string | null;
      slot: number | null;
      parentTier: number;
      parentA: string;
      parentB: string;
    };

/** App 下发的脉冲 = 载荷 + 单调 id（场景据 id 变化播放一次）+ 触发时刻。
 *  `at`（Date.now()）供场景在**重挂载**时判定脉冲新鲜度：仍在播放窗口内 → 重播
 *  （HMR / 渲染树崩溃恢复 / 进出后院都不该吞掉正在进行的演出）；已过期 → 不重播。 */
export type CelebrationPulse = CelebrationPayload & { id: number; at: number };

/** 脉冲是否仍在自己的播放窗口内（重挂载时的重播判据）。 */
export function celebrationFresh(pulse: CelebrationPulse): boolean {
  return Date.now() - pulse.at <= celebrationDurationFor(pulse);
}

/** 六种视觉编排。 */
export type CineKind = "standard" | "aiReuse" | "aiNew" | "fallback" | "fusion-recipe" | "fusion-ai";

export function cineKindFor(pulse: CelebrationPulse): CineKind {
  if (pulse.phase === "fusionCommit") return pulse.mode === "ai" ? "fusion-ai" : "fusion-recipe";
  return pulse.branch;
}

/** 各编排总时长（ms）；到点由场景清除。 */
const DURATION_MS: Record<CineKind, number> = {
  standard: 2600,
  aiReuse: 3000,
  aiNew: 3700,
  fallback: 2300,
  "fusion-recipe": 3000,
  "fusion-ai": 3200,
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** 减弱动效时压短时长，让定格卡不久留。 */
export function celebrationDurationFor(pulse: CelebrationPulse): number {
  const base = DURATION_MS[cineKindFor(pulse)];
  return prefersReducedMotion() ? Math.min(base, 1400) : base;
}

function clampTier(tier: number): number {
  return Math.max(1, Math.min(6, Math.round(tier || 1)));
}

function bannerFor(
  pulse: CelebrationPulse,
  kind: CineKind,
  S: BackyardStrings["celebration"],
  name: string,
): ReactNode {
  switch (kind) {
    case "aiNew":
      return (
        <>
          <span className="cine-banner-line cine-banner-hero">{S.aiNewHero}</span>
          <span className="cine-banner-name">{fmt(S.nameQuoted, { name })}</span>
          <span className="cine-banner-sub">{fmt(S.aiNewSub, { tier: clampTier(pulse.tier) })}</span>
        </>
      );
    case "aiReuse":
      return (
        <>
          <span className="cine-banner-line">{S.aiReuse}</span>
          <span className="cine-banner-name">{fmt(S.nameQuoted, { name })}</span>
        </>
      );
    case "fallback":
      // AI 生成未完成 → 展示该配方经典（0 号固有）形象的名字（species 即孵出的经典物种）。
      return (
        <>
          <span className="cine-banner-line">{S.fallbackLine}</span>
          <span className="cine-banner-name">{fmt(S.nameQuoted, { name })}</span>
          <span className="cine-banner-sub">{S.fallbackSub}</span>
        </>
      );
    case "fusion-recipe":
      return (
        <>
          <span className="cine-banner-line">{S.recipeLine}</span>
          <span className="cine-banner-sub">{fmt(S.recipeSub, { name })}</span>
        </>
      );
    case "fusion-ai":
      return (
        <>
          <span className="cine-banner-line">{S.aiPendingLine}</span>
          <span className="cine-banner-sub">{S.aiPendingSub}</span>
        </>
      );
    case "standard":
    default:
      return (
        <>
          <span className="cine-banner-name">{fmt(S.nameQuoted, { name })}</span>
          <span className="cine-banner-sub">{S.standardSub}</span>
        </>
      );
  }
}

export type CelebrationCinematicProps = {
  pulse: CelebrationPulse;
  config: GameConfig;
  /** 点击揭晓卡跳过（场景据此提前清除并停表）。 */
  onSkip: () => void;
};

export function CelebrationCinematic({ pulse, config, onSkip }: CelebrationCinematicProps) {
  const { lang, T } = useT();
  const S = T.bk.celebration;
  // 物种显示名：en 走目录名规则（AI 变种沿用专名），zh 即 App 传入的 name。
  const displayName = pulse.species ? speciesDisplayName(pulse.species, lang, pulse.name) : pulse.name;
  // 组件按 pulse.id 重挂（BackyardScene 上 key），故只需在首挂时读一次减弱偏好。
  const [reduced] = useState(prefersReducedMotion);
  const kind = cineKindFor(pulse);
  const tier = clampTier(pulse.tier);
  // 光线密度：阶越高越密（每束夹角越小）。
  const rayStep = Math.max(9, 22 - tier * 1.8);
  const rootStyle = {
    "--cine-tier": String(tier),
    "--ray-step": `${rayStep.toFixed(1)}deg`,
    "--cine-dur": `${celebrationDurationFor(pulse)}ms`,
  } as CSSProperties;

  // 融合分支不再走屏幕神光/白闪：仪式改在世界里「就地」演出（见 BackyardScene 的
  // FusionRitual），这里只留顶部横幅当标题。故 rays/flash 只服务孵化揭晓。
  const hasRays = kind === "aiReuse" || kind === "aiNew";
  const hasPrism = kind === "aiReuse" || kind === "aiNew";
  const heroState: PetState = reduced || kind === "fallback" ? "idle" : "success";

  // 全新物种：全屏粒子爆推迟到「碎壳」节拍（~1.15s）而非蓄力阶段；其余分支立即。
  const [burstOn, setBurstOn] = useState(kind !== "aiNew");
  useEffect(() => {
    if (kind !== "aiNew" || reduced) return;
    const timer = window.setTimeout(() => setBurstOn(true), 1150);
    return () => window.clearTimeout(timer);
  }, [kind, reduced]);

  const sparkleCount = kind === "aiNew" && !reduced ? (tier >= 6 ? 24 : tier >= 5 ? 16 : 12) : 0;
  const sparkles = Array.from({ length: sparkleCount }, (_, index) => ({
    id: index,
    left: Math.round(Math.random() * 100),
    delayMs: Math.round(Math.random() * 1200),
    durMs: 1600 + Math.round(Math.random() * 1000),
  }));

  return (
    <div className={`cine-root cine-${kind} cine-tier-${tier}`} style={rootStyle} aria-hidden="true">
      {/* 无背景蒙板：窗口透明，压暗会露出窗口边界，故只保留加亮/粒子类特效 */}
      {hasRays && <div className="cine-rays" />}
      {pulse.phase === "hatch" && <div className="cine-flash" />}

      {/* 唯一可点区域：点击跳过；根层 pointer-events:none 让后院 HUD 保持可点。
          孵化 = 屏幕正中「破壳揭晓」；融合 = 只留顶部横幅（演出在世界里就地进行）。 */}
      <div className="cine-card" role="button" tabIndex={-1} title={S.skipTitle} onClick={onSkip}>
        {pulse.phase === "hatch" && (
          <div className="cine-stage">
            {hasPrism && <div className="cine-prism" />}
            <div className="cine-boom" />
            <div className="cine-hero">
              <SvgSprite species={pulse.species} config={config} petState={heroState} tier={tier} />
            </div>
            {!reduced && burstOn && (
              <span className="cine-burst">
                <WorkBurst species={pulse.species} tier={tier} seed={pulse.id} boom screen />
              </span>
            )}
          </div>
        )}

        <div className="cine-banner">{bannerFor(pulse, kind, S, displayName)}</div>
      </div>

      {sparkles.length > 0 && (
        <div className="cine-sparkle">
          {sparkles.map((sparkle) => (
            <span
              key={sparkle.id}
              className="cine-sparkle-p"
              style={
                {
                  left: `${sparkle.left}%`,
                  animationDelay: `${sparkle.delayMs}ms`,
                  animationDuration: `${sparkle.durMs}ms`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
