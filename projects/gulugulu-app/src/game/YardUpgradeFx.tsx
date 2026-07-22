import { type CSSProperties } from "react";
import { fmt } from "../i18n";
import { useT } from "../useT";

// ---------------------------------------------------------------------------
// 后院升级庆典：应用显示区的「光效」反馈（点击升级木牌、save.yardLevel 跃升后播一次）。
// 透明窗约束：只做加亮/粒子（screen 混合 + 径向遮罩，边缘透明），绝不压暗——
// 任何 inset:0 暗层都会在桌面上勾出窗口矩形边界（同 .cine-root 注释）。
// 定位：始终 inset:0 铺满承载容器并居中。内联（预览/覆盖层未就绪回退）= 后院窄条窗；
// 全屏覆盖层承载时由 FxOverlay 的 FeatheredAnchor 把承载容器就地摆到 App 显示区、并让
// 溢出上沿的神光羽化淡出——本组件只管画，不关心锚定/裁切。
// 纯展示：据 level/cap 渲染一次；生命周期由承载方（BackyardScene / FxOverlay）清除。
// ---------------------------------------------------------------------------

const SPARKLE_COUNT = 18;

// 从中心向四周均匀喷发的金色粒子（角度均匀 + 半径按序错开，确定性、免 random）。
const SPARKLES = Array.from({ length: SPARKLE_COUNT }, (_, index) => {
  const angle = (index / SPARKLE_COUNT) * 360 + (index % 3) * 11;
  const radius = 62 + (index % 5) * 24;
  return {
    id: index,
    dx: Math.round(Math.cos((angle * Math.PI) / 180) * radius),
    dy: Math.round(Math.sin((angle * Math.PI) / 180) * (radius * 0.82)),
    delayMs: (index % 6) * 38,
    durMs: 880 + (index % 5) * 150,
  };
});

export function YardUpgradeFx({ level, cap }: { level: number; cap: number }) {
  const { T } = useT();
  const S = T.bk.scene;
  return (
    <div className="yup-root" aria-hidden="true">
      {/* 金色神光扇 → 中心暖白闪 → 冲击光环：三记加亮叠出「升级涌能」 */}
      <div className="yup-rays" />
      <div className="yup-flash" />
      <div className="yup-ring" />

      {/* 升级徽章（小卡，非全屏，可实心底不勾窗口边界） */}
      <div className="yup-badge">
        <span className="yup-badge-title">{fmt(S.yardUpgradedFx, { level })}</span>
        <span className="yup-badge-sub">{fmt(S.yardUpgradedFxSub, { cap })}</span>
      </div>

      {/* 金色飞散粒子 */}
      <div className="yup-sparkles">
        {SPARKLES.map((s) => (
          <span
            key={s.id}
            className="yup-sparkle-p"
            style={
              {
                "--dx": `${s.dx}px`,
                "--dy": `${s.dy}px`,
                animationDelay: `${s.delayMs}ms`,
                animationDuration: `${s.durMs}ms`,
              } as CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}
