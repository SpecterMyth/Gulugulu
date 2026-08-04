import type { CSSProperties } from "react";

// ---------------------------------------------------------------------------
// 后院场景内 · 蛋坑「就地特效」层（世界锚定）。追加进近景层 .by-layer，随相机/
// 视差/缩放一起移动，锚定在蛋坑世界坐标（.by-pit 同款 left/bottom，84px 宽）。
// 纯点缀：镜头在蛋坑附近时加分，离屏也安全——本质反馈始终由屏幕空间揭晓承载。
// 全部动画只用 transform/opacity + CSS 关键帧（见 backyard.css 的 .pitfx-*）。
// ---------------------------------------------------------------------------

export type PitFxKind = "crack" | "fizzle" | "commit-recipe" | "commit-ai";

/** 蛋坑三坑世界 x（与 BackyardHatcheryPits 的 PIT_XS 对齐）。 */
export const PIT_XS = [120, 220, 320];

export type PitEnergyFxProps = {
  /** 蛋坑世界 x（PIT_XS[slot]）。 */
  worldX: number;
  kind: PitFxKind;
  tier: number;
};

export function PitEnergyFx({ worldX, kind, tier }: PitEnergyFxProps) {
  const T = Math.max(1, Math.min(6, Math.round(tier || 1)));
  // 上升能量微粒数随阶数增长；融合汇聚略多于孵化。
  const isCommit = kind === "commit-recipe" || kind === "commit-ai";
  const moteCount = Math.min(4 + T * 2, 16) + (isCommit ? 2 : 0);
  const motes = Array.from({ length: moteCount }, (_, index) => {
    const angle = (index / moteCount) * Math.PI * 2;
    // 汇聚 = 从四周飞入蛋心；孵化/哑火 = 向上迸溅/垂落。
    const spread = isCommit ? 60 : 42;
    const fromX = Math.cos(angle) * spread;
    const fromY = isCommit ? Math.sin(angle) * spread : -(18 + Math.random() * 46);
    return {
      id: index,
      fromX: Math.round(fromX),
      fromY: Math.round(fromY),
      delayMs: Math.round(Math.random() * (isCommit ? 900 : 260)),
    };
  });

  // 破壳：一圈壳片向外迸飞 + 中心强光爆闪，给「裂开即收获」的即时反馈（阶越高壳片越多）。
  const shardCount = kind === "crack" ? Math.min(6 + T, 12) : 0;
  const shards = Array.from({ length: shardCount }, (_, index) => {
    const angle = (index / shardCount) * Math.PI * 2 + (index % 2 ? 0.3 : 0);
    const dist = 26 + Math.random() * 20;
    return {
      id: index,
      dx: Math.round(Math.cos(angle) * dist),
      dy: Math.round(-Math.abs(Math.sin(angle)) * dist - 14), // 先上迸再受重力落下
      rot: Math.round((Math.random() - 0.5) * 220),
      delayMs: Math.round(Math.random() * 90),
    };
  });

  return (
    <div
      className={`pitfx pitfx-${kind} pitfx-tier-${T}`}
      style={{ left: worldX, bottom: 106 } as CSSProperties}
      aria-hidden="true"
    >
      <span className="pitfx-glow" />
      {kind === "crack" && <span className="pitfx-flash" />}
      {shards.map((shard) => (
        <span
          key={`shard-${shard.id}`}
          className="pitfx-shard"
          style={
            {
              "--sx": `${shard.dx}px`,
              "--sy": `${shard.dy}px`,
              "--sr": `${shard.rot}deg`,
              animationDelay: `${shard.delayMs}ms`,
            } as CSSProperties
          }
        />
      ))}
      {kind === "commit-ai" && <span className="pitfx-darkegg" />}
      {motes.map((mote) => (
        <span
          key={mote.id}
          className="pitfx-mote"
          style={
            {
              "--fx": `${mote.fromX}px`,
              "--fy": `${mote.fromY}px`,
              animationDelay: `${mote.delayMs}ms`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
