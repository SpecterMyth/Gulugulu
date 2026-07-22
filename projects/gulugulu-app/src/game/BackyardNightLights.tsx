import { memo } from "react";
import { abs, LAMP_HEAD_BOTTOM, LAMP_POSTS } from "./backyardShared";

// ---------------------------------------------------------------------------
// 夜间灯光覆盖层：入夜后建筑窗户 / 路灯 / 篝火点亮。世界锚定（随相机平移，贴合
// 各建筑），不受实景调色 filter 影响 → 灯光在变暗的场景里真正「亮起来」。
// 整层透明度 = windowLight（黄昏渐亮、深夜全亮），白天由场景层不挂载本组件。
// ---------------------------------------------------------------------------

type LightSpec = {
  /** 世界 X（灯光中心）。 */
  x: number;
  /** 距地高度（灯光中心）。 */
  bottom: number;
  /** 光晕半径。 */
  r: number;
  color: string;
  /** 可选：发亮的窗格/灯芯。 */
  core?: { w: number; h: number; radius?: number | string; color?: string };
  /** 轻微闪烁（篝火/灯泡）。 */
  flicker?: boolean;
};

const WARM = "255,214,130";
const WARM_DEEP = "255,180,96";
const FIRE = "255,150,60";

/** 各建筑窗户 / 门 / 路灯 / 篝火的点位（世界坐标，与 NearDecor 立面对齐）。 */
const LIGHTS: LightSpec[] = [
  // —— 小院（cottage）两扇窗 ——
  { x: 625, bottom: 204, r: 46, color: WARM, core: { w: 26, h: 34, radius: "3px 3px 5px 5px" } },
  { x: 685, bottom: 206, r: 46, color: WARM, core: { w: 30, h: 32, radius: "3px 3px 5px 5px" } },
  // —— 商店：门内溢光 + 两扇圆窗 ——
  { x: 1090, bottom: 214, r: 60, color: WARM_DEEP, core: { w: 40, h: 34, radius: 8 } },
  { x: 1162, bottom: 205, r: 34, color: WARM, core: { w: 15, h: 20, radius: "50% 50% 45% 45%" } },
  { x: 1190, bottom: 205, r: 34, color: WARM, core: { w: 15, h: 20, radius: "50% 50% 45% 45%" } },
  // —— 图鉴馆门厅暖光 ——
  { x: 3322, bottom: 206, r: 54, color: WARM, core: { w: 40, h: 52, radius: "20px 20px 0 0" } },
  // —— 交易市场：棚下挂灯 ——
  { x: 4030, bottom: 250, r: 44, color: WARM, core: { w: 14, h: 18, radius: "6px 6px 8px 8px" }, flicker: true },
  // —— 篝火加亮（营地）——
  { x: 5288, bottom: 188, r: 88, color: FIRE, flicker: true },
];

function LightDot({ light }: { light: LightSpec }) {
  return (
    <>
      <span
        className={`by-nlight-glow${light.flicker ? " is-flicker" : ""}`}
        style={abs({
          left: light.x - light.r,
          bottom: light.bottom - light.r,
          width: light.r * 2,
          height: light.r * 2,
          background: `radial-gradient(circle, rgba(${light.color},0.85) 0%, rgba(${light.color},0.32) 34%, rgba(${light.color},0) 70%)`,
        })}
      />
      {light.core && (
        <span
          className="by-nlight-core"
          style={abs({
            left: light.x - light.core.w / 2,
            bottom: light.bottom - light.core.h / 2,
            width: light.core.w,
            height: light.core.h,
            borderRadius: light.core.radius ?? 4,
            background: light.core.color ?? `rgba(${light.color},0.95)`,
            boxShadow: `0 0 8px 2px rgba(${light.color},0.9)`,
          })}
        />
      )}
    </>
  );
}

export const BackyardNightLights = memo(function BackyardNightLights({ windowLight }: { windowLight: number }) {
  return (
    <div className="by-nlights" style={{ opacity: windowLight }} aria-hidden="true">
      {LIGHTS.map((light, index) => (
        <LightDot key={`l${index}`} light={light} />
      ))}
      {/* 路灯灯头：与 NearDecor 的灯柱同 X 点亮 */}
      {LAMP_POSTS.map((x) => (
        <LightDot
          key={`lamp${x}`}
          light={{ x, bottom: LAMP_HEAD_BOTTOM, r: 40, color: WARM, core: { w: 10, h: 12, radius: "4px 4px 5px 5px" }, flicker: true }}
        />
      ))}
    </div>
  );
});
