import type { CSSProperties } from "react";
import type { GameConfig } from "../types";
import { SvgSprite } from "../sprites/SvgSprite";

// ---------------------------------------------------------------------------
// 后院场景内 · 融合「就地仪式」层（世界锚定）。追加进近景层 .by-layer，随相机 /
// 视差 / 缩放一起移动，锚定在两亲当时所站位置的中点世界坐标。
//
// 与旧的屏幕空间揭晓（把两亲抽到屏幕正中表演）不同：这里在两只宠物「原地」起舞——
//   1. 两亲各自出现在它们打融合前所站的位置；
//   2. 绕彼此公转、互换左右位、半径收拢、越转越快（加速关键帧）；
//   3. 高潮合体：金光上冲 + 震波 + 白闪遮挡，随后金蛋成形、划弧飞向孵化区方向。
// 全部动画只用 transform / opacity + CSS 关键帧（见 backyard.css 的 .fr-*），时长统一
// 由 --fr-dur 驱动，节拍以百分比表达，随总时长整体缩放。纯点缀、pointer-events:none。
// ---------------------------------------------------------------------------

/** 一亲在融合触发瞬间的站位快照（世界坐标）。 */
export type FusionRitualSprite = {
  species: string;
  /** 世界 x（主角 = 当前 charX；驻留伙伴 = 其站位 spot.x）。 */
  x: number;
  /** 世界 bottom（主角 = CHAR_BOTTOM；伙伴 = spot.bottom）。 */
  bottom: number;
  /** 精灵盒边长。 */
  size: number;
};

export type FusionRitualData = {
  /** 与庆典脉冲同 id：BackyardScene 用它做一次性 key。 */
  id: number;
  mode: "recipe" | "ai";
  tier: number;
  originA: FusionRitualSprite;
  originB: FusionRitualSprite;
  /** 蛋的目的地世界 x（孵化区蛋坑 PIT_XS[slot]，无槽位时取孵化区中心）。 */
  targetX: number;
  durationMs: number;
};

export type FusionRitualProps = {
  data: FusionRitualData;
  config: GameConfig;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function FusionRitual({ data, config }: FusionRitualProps) {
  const { originA, originB, targetX, mode, tier, durationMs } = data;

  // 公转中心 = 两亲站位中点；基准高度 = 两亲身体中心的平均（beam 上冲、egg 起点都以此为原点）。
  const midX = (originA.x + originB.x) / 2;
  const centerA = originA.bottom + originA.size / 2;
  const centerB = originB.bottom + originB.size / 2;
  const baseBottom = Math.max(170, (centerA + centerB) / 2);

  // 初始公转半径 = 两亲横向间距的一半，夹到「看得清的圈」范围（贴太近则微微撑开）。
  const r0 = clamp(Math.abs(originA.x - originB.x) / 2, 46, 140);

  // 谁在右（+r0 臂）：横坐标大者。左右臂各放一只，公转时始终对角错开、每半圈互换位。
  const aOnRight = originA.x >= originB.x;
  const rightSprite = aOnRight ? originA : originB;
  const leftSprite = aOnRight ? originB : originA;

  // 蛋飞向孵化区方向：朝 targetX，距离夹到一屏内（远坑则「朝那个方向飞走并淡出」，
  // 抵达反馈由坑口的 PitEnergyFx 承接；近坑则基本落到坑位）。
  const rawDX = targetX - midX;
  const flyX = Math.sign(rawDX) * Math.min(Math.abs(rawDX), 520);

  const T = Math.max(1, Math.min(6, Math.round(tier || 1)));

  // 汇聚微粒：build-up 阶段从四周飞入中心，越接近高潮越密（延时铺在 0..58% 时间轴）。
  const moteCount = Math.min(10 + T * 2, 22);
  const motes = Array.from({ length: moteCount }, (_, index) => {
    const angle = (index / moteCount) * Math.PI * 2 + (index % 2 ? 0.4 : 0);
    const spread = r0 + 60 + Math.random() * 40;
    return {
      id: index,
      fx: Math.round(Math.cos(angle) * spread),
      fy: Math.round(Math.sin(angle) * spread),
      delayMs: Math.round((0.04 + Math.random() * 0.52) * durationMs),
      durMs: 620 + Math.round(Math.random() * 360),
    };
  });

  // 高潮金花：合体瞬间向上迸溅的火星（略偏散、受一点重力）。
  const sparkCount = Math.min(8 + T * 2, 20);
  const sparks = Array.from({ length: sparkCount }, (_, index) => {
    const angle = -Math.PI / 2 + (index / sparkCount - 0.5) * Math.PI * 1.15;
    const dist = 90 + Math.random() * 120;
    return {
      id: index,
      sx: Math.round(Math.cos(angle) * dist * 0.7),
      sy: Math.round(Math.sin(angle) * dist),
      delayMs: Math.round(Math.random() * 90),
    };
  });

  const rootStyle = {
    left: midX,
    bottom: baseBottom,
    "--fr-dur": `${durationMs}ms`,
    "--r0": `${r0}px`,
    "--fly-x": `${flyX}px`,
  } as CSSProperties;

  const spriteBox = (size: number): CSSProperties => ({
    width: size,
    height: size,
    marginLeft: -size / 2,
    marginBottom: -size / 2,
  });

  return (
    <div className={`fr-root fr-${mode} fr-tier-${T}`} style={rootStyle} aria-hidden="true">
      {/* 涡流盘 + 蓄能核心（build-up 渐强，高潮溃散） */}
      <span className="fr-swirl" />
      <span className="fr-glow" />

      {/* 汇聚微粒（从四周飞入中心） */}
      {motes.map((mote) => (
        <span
          key={`mote-${mote.id}`}
          className="fr-mote"
          style={
            {
              "--fx": `${mote.fx}px`,
              "--fy": `${mote.fy}px`,
              animationDelay: `${mote.delayMs}ms`,
              animationDuration: `${mote.durMs}ms`,
            } as CSSProperties
          }
        />
      ))}

      {/* 两亲公转：orbit 加速旋转，arm 收拢半径，spinfix 反旋保持正立 */}
      <div className="fr-orbit">
        <div className="fr-arm fr-arm-a">
          <div className="fr-spinfix">
            <div className="fr-sprite" style={spriteBox(rightSprite.size)}>
              <SvgSprite species={rightSprite.species} config={config} petState="success" />
            </div>
          </div>
        </div>
        <div className="fr-arm fr-arm-b">
          <div className="fr-spinfix">
            <div className="fr-sprite" style={spriteBox(leftSprite.size)}>
              <SvgSprite species={leftSprite.species} config={config} petState="success" />
            </div>
          </div>
        </div>
      </div>

      {/* 高潮：白闪遮挡 → 金光上冲 → 震波环 → 火星迸溅 */}
      <span className="fr-flash" />
      <span className="fr-beam" />
      <span className="fr-boom" />
      {sparks.map((spark) => (
        <span
          key={`spark-${spark.id}`}
          className="fr-spark"
          style={
            {
              "--sx": `${spark.sx}px`,
              "--sy": `${spark.sy}px`,
              animationDelay: `${spark.delayMs}ms`,
            } as CSSProperties
          }
        />
      ))}

      {/* 蛋成形 → 划弧飞向孵化区方向 */}
      <div className={`fr-egg fr-egg-${mode}`}>
        <span className="fr-egg-glow" />
      </div>
    </div>
  );
}
