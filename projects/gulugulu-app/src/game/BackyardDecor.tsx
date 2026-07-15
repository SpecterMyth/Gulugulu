import { memo } from "react";
import { WORLD_W, abs } from "./backyardShared";

// ---------------------------------------------------------------------------
// 静态装饰层（memo：场景每秒因倒计时重渲，装饰不重排）
// 三个视差层的纯布景：远景（太阳/远山/云）、中景（灌木/风车/小屋）、
// 近景（草皮/各区建筑立面）。零 props、无状态，从 BackyardScene 抽出。
// ---------------------------------------------------------------------------

/** 蓬蓬云：底部长条 + 三团大小不一的圆叠出云朵轮廓 */
function Cloud({ left, top, size = 1, opacity = 0.75 }: { left: number; top: number; size?: number; opacity?: number }) {
  return (
    <div style={abs({ left, top, width: 150 * size, height: 56 * size, opacity })}>
      <div style={abs({ left: 0, bottom: 0, width: "100%", height: "44%", borderRadius: 999, background: "#FFFFFF" })} />
      <div style={abs({ left: "10%", bottom: "20%", width: "36%", height: "58%", borderRadius: "50%", background: "#FFFFFF" })} />
      <div style={abs({ left: "34%", bottom: "24%", width: "44%", height: "76%", borderRadius: "50%", background: "#FFFFFF" })} />
      <div style={abs({ left: "64%", bottom: "16%", width: "30%", height: "50%", borderRadius: "50%", background: "#FFFFFF" })} />
    </div>
  );
}

/** 远景（速率 0.25）：太阳、远山、云。
 *  透明窗口下山丘整体下沉贴住近景地面（草皮顶 160），避免纵向透明缝隙。 */
export const FarDecor = memo(function FarDecor() {
  return (
    <>
      {/* top 锚定物注意：层整体下移 56 + 视高 420 ⇒ 窗口上缘 = top 坐标 84，
          top 需 ≥ ~96 才不会被裁顶（用户拉伸窗口时该比例恒定） */}
      <div style={abs({ left: 1750, top: 102, width: 74, height: 74, borderRadius: "50%", background: "#FFF3D0", boxShadow: "0 0 40px 18px rgba(255,243,208,0.55)", opacity: 0.9 })} />
      <div style={abs({ inset: 0, transform: "translateY(45px)" })}>
        <div style={abs({ left: 120, bottom: 200, width: 700, height: 170, borderRadius: "50% 50% 0 0", background: "#B9C9B3", opacity: 0.7 })} />
        <div style={abs({ left: 1300, bottom: 200, width: 760, height: 190, borderRadius: "50% 50% 0 0", background: "#B9C9B3", opacity: 0.7 })} />
        <div style={abs({ left: 0, bottom: 180, width: 520, height: 110, borderRadius: "50% 50% 0 0", background: "#C6D4C0", opacity: 0.9 })} />
        <div style={abs({ left: 480, bottom: 180, width: 640, height: 140, borderRadius: "50% 50% 0 0", background: "#CFDCC9", opacity: 0.9 })} />
        <div style={abs({ left: 1100, bottom: 180, width: 560, height: 120, borderRadius: "50% 50% 0 0", background: "#C6D4C0", opacity: 0.9 })} />
        <div style={abs({ left: 1650, bottom: 180, width: 600, height: 150, borderRadius: "50% 50% 0 0", background: "#CFDCC9", opacity: 0.9 })} />
        <div style={abs({ left: 2220, bottom: 180, width: 400, height: 100, borderRadius: "50% 50% 0 0", background: "#C6D4C0", opacity: 0.9 })} />
        <div style={abs({ left: 2560, bottom: 195, width: 620, height: 160, borderRadius: "50% 50% 0 0", background: "#B9C9B3", opacity: 0.7 })} />
        <div style={abs({ left: 2620, bottom: 180, width: 480, height: 115, borderRadius: "50% 50% 0 0", background: "#CFDCC9", opacity: 0.9 })} />
        <div style={abs({ left: 3020, bottom: 185, width: 380, height: 105, borderRadius: "50% 50% 0 0", background: "#C6D4C0", opacity: 0.9 })} />
      </div>
      <Cloud left={250} top={118} size={0.9} opacity={0.75} />
      <Cloud left={640} top={158} size={0.66} opacity={0.62} />
      <Cloud left={900} top={100} size={1.1} opacity={0.75} />
      <Cloud left={1500} top={140} size={0.8} opacity={0.68} />
      <Cloud left={2100} top={178} size={1} opacity={0.72} />
      <Cloud left={2680} top={112} size={0.85} opacity={0.7} />
    </>
  );
});

/** 中景（速率 0.55）：灌木、风车、栅栏、小屋、树。
 *  整层下沉 18px：原基线 168 → 150，收进近景草皮（132–160）后面，不留缝。 */
export const MidDecor = memo(function MidDecor() {
  return (
    <div style={abs({ inset: 0, transform: "translateY(18px)" })}>
      <div style={abs({ left: 40, bottom: 168, width: 96, height: 58, borderRadius: "50% 50% 0 0", background: "#A3C49B", opacity: 0.9 })} />
      <div style={abs({ left: 170, bottom: 168, width: 180, height: 34, borderRadius: "17px 17px 0 0", background: "#9CBE94", opacity: 0.85 })} />
      <div style={abs({ left: 280, bottom: 168, width: 14, height: 62, borderRadius: 7, background: "#A98D6B" })} />
      <div style={abs({ left: 236, bottom: 216, width: 102, height: 86, borderRadius: "50%", background: "#8FB98A", opacity: 0.95 })} />
      <div style={abs({ left: 262, bottom: 252, width: 64, height: 52, borderRadius: "50%", background: "#A9C77F", opacity: 0.9 })} />
      <div style={abs({ left: 520, bottom: 168, width: 130, height: 52, borderRadius: "50% 50% 0 0", background: "#9CBE94", opacity: 0.9 })} />
      <div style={abs({ left: 640, bottom: 168, width: 80, height: 40, borderRadius: "50% 50% 0 0", background: "#A3C49B", opacity: 0.85 })} />
      {/* 风车 */}
      <div style={abs({ left: 860, bottom: 168, width: 32, height: 132, borderRadius: "9px 9px 4px 4px", background: "linear-gradient(90deg,#C9B08C,#B9A07C)", opacity: 0.95 })} />
      <div style={abs({ left: 868, bottom: 294, width: 16, height: 16, borderRadius: "50%", background: "#8A7458", zIndex: 1 })} />
      <div style={abs({ left: 836, bottom: 254, width: 80, height: 80, animation: "gg-spin 10s linear infinite", opacity: 0.9 })}>
        <div style={abs({ left: 0, top: 35, width: 80, height: 10, borderRadius: 6, background: "#B9A58A" })} />
        <div style={abs({ left: 35, top: 0, width: 10, height: 80, borderRadius: 6, background: "#B9A58A" })} />
      </div>
      <div style={abs({ left: 1010, bottom: 168, width: 88, height: 48, borderRadius: "50% 50% 0 0", background: "#A3C49B", opacity: 0.9 })} />
      <div style={abs({ left: 1180, bottom: 168, width: 200, height: 30, borderTop: "5px solid #C0A276", background: "repeating-linear-gradient(90deg, #C0A276 0 8px, transparent 8px 48px)", opacity: 0.8 })} />
      <div style={abs({ left: 1450, bottom: 168, width: 14, height: 66, borderRadius: 7, background: "#A98D6B" })} />
      <div style={abs({ left: 1404, bottom: 220, width: 104, height: 90, borderRadius: "50%", background: "#8FB98A", opacity: 0.95 })} />
      <div style={abs({ left: 1432, bottom: 262, width: 60, height: 50, borderRadius: "50%", background: "#A9C77F", opacity: 0.9 })} />
      <div style={abs({ left: 1680, bottom: 168, width: 120, height: 54, borderRadius: "50% 50% 0 0", background: "#9CBE94", opacity: 0.9 })} />
      <div style={abs({ left: 1790, bottom: 168, width: 82, height: 44, borderRadius: "50% 50% 0 0", background: "#A3C49B", opacity: 0.85 })} />
      {/* 远处小屋 */}
      <div style={abs({ left: 2040, bottom: 168, width: 112, height: 72, borderRadius: 4, background: "#C9B8A0", opacity: 0.95 })} />
      <div style={abs({ left: 2036, bottom: 238, width: 0, height: 0, borderLeft: "60px solid transparent", borderRight: "60px solid transparent", borderBottom: "46px solid #A98D6B", opacity: 0.95 })} />
      <div style={abs({ left: 2118, bottom: 270, width: 13, height: 26, borderRadius: 3, background: "#A98D6B", opacity: 0.95 })} />
      <div style={abs({ left: 2084, bottom: 190, width: 22, height: 26, borderRadius: "3px 3px 0 0", background: "#8A7458", opacity: 0.9 })} />
      <div style={abs({ left: 2230, bottom: 168, width: 110, height: 50, borderRadius: "50% 50% 0 0", background: "#9CBE94", opacity: 0.9 })} />
      <div style={abs({ left: 2480, bottom: 168, width: 14, height: 70, borderRadius: 7, background: "#A98D6B" })} />
      <div style={abs({ left: 2436, bottom: 224, width: 100, height: 88, borderRadius: "50%", background: "#7FA97A", opacity: 0.95 })} />
      <div style={abs({ left: 2600, bottom: 168, width: 190, height: 32, borderRadius: "16px 16px 0 0", background: "#9CBE94", opacity: 0.85 })} />
      <div style={abs({ left: 2700, bottom: 168, width: 92, height: 46, borderRadius: "50% 50% 0 0", background: "#A3C49B", opacity: 0.9 })} />
      <div style={abs({ left: 2930, bottom: 168, width: 14, height: 74, borderRadius: 7, background: "#A98D6B" })} />
      <div style={abs({ left: 2886, bottom: 228, width: 100, height: 92, borderRadius: "50%", background: "#8FB98A", opacity: 0.95 })} />
      <div style={abs({ left: 2914, bottom: 272, width: 56, height: 46, borderRadius: "50%", background: "#A9C77F", opacity: 0.9 })} />
      <div style={abs({ left: 3160, bottom: 168, width: 120, height: 52, borderRadius: "50% 50% 0 0", background: "#9CBE94", opacity: 0.9 })} />
      {/* 图鉴馆/交易市场身后的延伸绿化（世界扩宽到 5200 的中景补充） */}
      <div style={abs({ left: 3380, bottom: 168, width: 150, height: 46, borderRadius: "50% 50% 0 0", background: "#A3C49B", opacity: 0.85 })} />
      <div style={abs({ left: 3600, bottom: 168, width: 14, height: 68, borderRadius: 7, background: "#A98D6B" })} />
      <div style={abs({ left: 3556, bottom: 222, width: 100, height: 88, borderRadius: "50%", background: "#8FB98A", opacity: 0.95 })} />
      <div style={abs({ left: 3760, bottom: 168, width: 180, height: 32, borderRadius: "16px 16px 0 0", background: "#9CBE94", opacity: 0.85 })} />
      <div style={abs({ left: 3900, bottom: 168, width: 96, height: 50, borderRadius: "50% 50% 0 0", background: "#A3C49B", opacity: 0.9 })} />
      <div style={abs({ left: 4060, bottom: 168, width: 140, height: 44, borderRadius: "50% 50% 0 0", background: "#9CBE94", opacity: 0.88 })} />
      <div style={abs({ left: 4240, bottom: 168, width: 14, height: 64, borderRadius: 7, background: "#A98D6B" })} />
      <div style={abs({ left: 4198, bottom: 218, width: 98, height: 84, borderRadius: "50%", background: "#8FB98A", opacity: 0.95 })} />
    </div>
  );
});

/** 近景静态装饰：地面 + 各区布景（不含蛋坑/商店板/公告板内容等动态件） */
export const NearDecor = memo(function NearDecor() {
  return (
    <>
      {/* 草皮 + 剖面土层（土层一直铺到窗口底边，透明窗口下不留缝） */}
      <div style={abs({ left: 0, bottom: 132, width: WORLD_W, height: 28, borderRadius: "16px 16px 0 0", background: "linear-gradient(180deg,#9ED67F,#7CBE5F)", boxShadow: "0 -4px 10px rgba(59,43,29,0.12)" })} />
      <div
        style={abs({
          left: 0,
          bottom: 0,
          width: WORLD_W,
          height: 132,
          background:
            "radial-gradient(circle at 90px 34px, #C6A15B 0 6px, transparent 7px), radial-gradient(circle at 260px 60px, #96703E 0 5px, transparent 6px), radial-gradient(circle at 430px 28px, #C6A15B 0 4px, transparent 5px), linear-gradient(180deg,#A9814F,#8A6437)",
          backgroundSize: "560px 132px, 560px 132px, 560px 132px, 100% 100%",
        })}
      />

      {/* ── 孵化区布景 ── */}
      <div style={abs({ left: 20, bottom: 150, width: 9, height: 40, borderRadius: 5, background: "#C89B62", boxShadow: "inset 0 -3px 0 rgba(59,43,29,0.25)" })} />
      <div style={abs({ left: 56, bottom: 150, width: 9, height: 44, borderRadius: 5, background: "#C89B62", boxShadow: "inset 0 -3px 0 rgba(59,43,29,0.25)" })} />
      <div style={abs({ left: 14, bottom: 172, width: 58, height: 7, borderRadius: 4, background: "#B98A4E" })} />
      <div style={abs({ left: 96, bottom: 150, width: 8, height: 88, borderRadius: 4, background: "#8A6437" })} />
      <div style={abs({ left: 58, bottom: 226, padding: "4px 14px 5px", borderRadius: 8, border: "2.5px solid #6B4520", background: "linear-gradient(180deg,#C08A4E,#A06A33)", fontFamily: "var(--font-display)", fontSize: 14, color: "#FFF3D9", textShadow: "0 -1px 0 rgba(0,0,0,0.4)", transform: "rotate(-2deg)", whiteSpace: "nowrap" })}>
        🥚 孵化区
      </div>

      {/* ── 小院 ── */}
      <div style={abs({ left: 480, bottom: 152, width: 7, height: 60, borderRadius: 4, background: "#8A6437" })} />
      <div style={abs({ left: 460, bottom: 208, width: 48, height: 28, borderRadius: "13px 13px 5px 5px", background: "#D9553F", border: "2.5px solid #6B4520", boxSizing: "border-box" })}>
        <span style={abs({ right: -6, top: -10, width: 4, height: 14, borderRadius: 2, background: "#F7D373" })} />
      </div>
      <div style={abs({ left: 560, bottom: 152, width: 7, height: 78, borderRadius: 4, background: "#8A6437" })} />
      <div style={abs({ left: 780, bottom: 152, width: 7, height: 78, borderRadius: 4, background: "#8A6437" })} />
      <div style={abs({ left: 563, bottom: 224, width: 222, height: 3, borderRadius: 2, background: "#6B4520", transform: "rotate(-1deg)" })} />
      <div style={abs({ left: 610, bottom: 184, width: 30, height: 40, borderRadius: "3px 3px 5px 5px", background: "#F5C0A8", boxShadow: "inset 0 -8px 0 rgba(0,0,0,0.06)", transformOrigin: "50% 0", animation: "gg-sway 3.4s ease-in-out infinite" })} />
      <div style={abs({ left: 668, bottom: 188, width: 34, height: 36, borderRadius: "3px 3px 5px 5px", background: "#9BDCFF", boxShadow: "inset 0 -8px 0 rgba(0,0,0,0.06)", transformOrigin: "50% 0", animation: "gg-sway 4.1s ease-in-out 0.5s infinite" })} />
      <div style={abs({ left: 880, bottom: 152, width: 56, height: 38, borderRadius: 6, background: "linear-gradient(90deg,#96703E,#A9814F 50%,#8A6437)" })} />
      <div style={abs({ left: 880, bottom: 182, width: 56, height: 22, borderRadius: "50%", background: "#D9B37C", border: "2.5px solid #8A6437", boxSizing: "border-box" })} />
      <div style={abs({ left: 530, bottom: 154, width: 10, height: 10, borderRadius: "50%", background: "radial-gradient(circle,#F5D95A 0 3px,#FFFDF4 3px)" })} />
      <div style={abs({ left: 840, bottom: 156, width: 9, height: 9, borderRadius: "50%", background: "radial-gradient(circle,#F5D95A 0 3px,#F5917B 3px)" })} />

      {/* ── 商店建筑 ── */}
      <div style={abs({ left: 1016, bottom: 150, width: 7, height: 120, borderRadius: 4, background: "#6B4520" })} />
      <div style={abs({ left: 1288, bottom: 150, width: 7, height: 120, borderRadius: 4, background: "#6B4520" })} />
      <div style={abs({ left: 1030, bottom: 150, width: 240, height: 132, borderRadius: "10px 10px 4px 4px", border: "3px solid #6B4520", background: "repeating-linear-gradient(90deg, rgba(59,32,10,0.12) 0 3px, transparent 3px 30px), linear-gradient(180deg,#B07B44,#96622F)", boxSizing: "border-box" })} />
      <div style={abs({ left: 1064, bottom: 196, width: 52, height: 44, borderRadius: 8, background: "#5C3B1E", boxShadow: "inset 0 0 0 3px #6B4520, inset 0 4px 8px rgba(0,0,0,0.4)" })} />
      <div style={abs({ left: 1052, bottom: 150, width: 196, height: 42, borderRadius: 6, border: "3px solid #6B4520", background: "repeating-linear-gradient(92deg, rgba(59,32,10,0.12) 0 2px, transparent 2px 30px), linear-gradient(180deg,#C08A4E,#A06A33)", boxSizing: "border-box" })} />
      <div style={abs({ left: 1152, bottom: 192, width: 20, height: 26, borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%", border: "2px solid #3B2B1D", boxSizing: "border-box", background: "radial-gradient(circle at 60% 40%, #2E7BD6 0 3px, transparent 4px), #FFFDF6" })} />
      <div style={abs({ left: 1180, bottom: 192, width: 20, height: 26, borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%", border: "2px solid #3B2B1D", boxSizing: "border-box", background: "radial-gradient(circle at 60% 40%, #E85D3A 0 3px, transparent 4px), #FFFDF6" })} />
      <div style={abs({ left: 1010, bottom: 270, width: 280, height: 40, borderRadius: "10px 10px 0 0", border: "3px solid #6B4520", background: "repeating-linear-gradient(90deg,#D9553F 0 28px,#FFF3D9 28px 56px)", boxSizing: "border-box", boxShadow: "0 8px 12px rgba(43,26,8,0.22)" })} />
      <div style={abs({ left: 1104, bottom: 306, padding: "4px 18px 5px", borderRadius: 9, border: "2.5px solid #6B4520", background: "linear-gradient(180deg,#B07B44,#96622F)", fontFamily: "var(--font-display)", fontSize: 17, color: "#FFE9AD", textShadow: "0 2px 0 rgba(0,0,0,0.35)", whiteSpace: "nowrap" })}>
        🛒 商店
      </div>

      {/* ── 菜园 ── */}
      <div style={abs({ left: 1340, bottom: 150, width: 200, height: 46, borderRadius: 8, border: "3px solid #8A6437", background: "repeating-linear-gradient(90deg, rgba(59,32,10,0.18) 0 10px, transparent 10px 36px), linear-gradient(180deg,#9B6B3A,#845222)", boxSizing: "border-box" })} />
      <div style={abs({ left: 1368, bottom: 192, width: 14, height: 18, borderRadius: "50% 50% 0 0", background: "#8CD97B" })} />
      <div style={abs({ left: 1430, bottom: 192, width: 14, height: 15, borderRadius: "50% 50% 0 0", background: "#6FB35F" })} />
      <div style={abs({ left: 1488, bottom: 192, width: 14, height: 19, borderRadius: "50% 50% 0 0", background: "#8CD97B" })} />
      <div style={abs({ left: 1572, bottom: 150, width: 8, height: 132, borderRadius: 4, background: "#8A6437" })} />
      <div style={abs({ left: 1528, bottom: 244, width: 96, height: 8, borderRadius: 4, background: "#8A6437" })} />
      <div style={abs({ left: 1556, bottom: 276, width: 40, height: 40, borderRadius: "50%", background: "#F5C0A8", border: "2.5px solid #6B4520", boxSizing: "border-box" })} />
      <div style={abs({ left: 1550, bottom: 312, width: 52, height: 8, borderRadius: 4, background: "#8A6437" })} />
      <div style={abs({ left: 1560, bottom: 318, width: 32, height: 16, borderRadius: "7px 7px 0 0", background: "#8A6437" })} />
      <div style={abs({ left: 1640, bottom: 150, width: 36, height: 30, borderRadius: "50%", background: "#E07B39", boxShadow: "inset -7px 0 0 rgba(150,60,20,0.3)" })}>
        <span style={abs({ left: "50%", top: -6, transform: "translateX(-50%)", width: 6, height: 9, borderRadius: 3, background: "#6B8F33" })} />
      </div>
      <div style={abs({ left: 1686, bottom: 150, width: 25, height: 21, borderRadius: "50%", background: "#E07B39", boxShadow: "inset -5px 0 0 rgba(150,60,20,0.3)" })}>
        <span style={abs({ left: "50%", top: -5, transform: "translateX(-50%)", width: 5, height: 7, borderRadius: 3, background: "#6B8F33" })} />
      </div>

      {/* ── 池塘 ── */}
      <div style={abs({ left: 1810, bottom: 148, width: 34, height: 16, borderRadius: "50%", background: "#C9CFD2", boxShadow: "inset 0 -4px 0 rgba(0,0,0,0.12)" })} />
      <div style={abs({ left: 1860, bottom: 134, width: 320, height: 46, borderRadius: "50%", background: "radial-gradient(ellipse at 42% 38%, #D6F1FF, #9BDCFF 72%)", boxShadow: "inset 0 5px 10px rgba(27,95,176,0.3)" })} />
      <div style={abs({ left: 1874, bottom: 150, width: 4, height: 46, borderRadius: 2, background: "#57964B" })} />
      <div style={abs({ left: 1872, bottom: 192, width: 8, height: 18, borderRadius: 5, background: "#7A5230" })} />
      <div style={abs({ left: 1890, bottom: 150, width: 4, height: 58, borderRadius: 2, background: "#57964B" })} />
      <div style={abs({ left: 1888, bottom: 204, width: 8, height: 18, borderRadius: 5, background: "#7A5230" })} />
      <div style={abs({ left: 1906, bottom: 150, width: 4, height: 40, borderRadius: 2, background: "#57964B" })} />
      <div style={abs({ left: 2020, bottom: 158, width: 34, height: 12, borderRadius: "50%", background: "#6FB35F" })} />
      <div style={abs({ left: 2230, bottom: 148, width: 28, height: 13, borderRadius: "50%", background: "#D4D9DB", boxShadow: "inset 0 -3px 0 rgba(0,0,0,0.12)" })} />

      {/* ── 公告板骨架（内容动态） ── */}
      <div style={abs({ left: 2330, bottom: 150, width: 11, height: 158, borderRadius: 5, background: "linear-gradient(90deg,#8A6437,#A9814F)" })} />
      <div style={abs({ left: 2548, bottom: 150, width: 11, height: 158, borderRadius: 5, background: "linear-gradient(90deg,#8A6437,#A9814F)" })} />
      {/* 标题牌骑在板体上缘：底部与板框相接（板顶 394），完整露出文字 */}
      <div style={abs({ left: 2384, bottom: 392, padding: "5px 18px 6px", borderRadius: 9, border: "2.5px solid #6B4520", background: "linear-gradient(180deg,#B07B44,#96622F)", fontFamily: "var(--font-display)", fontSize: 16, lineHeight: 1.2, color: "#FFE9AD", textShadow: "0 2px 0 rgba(0,0,0,0.35)", whiteSpace: "nowrap", zIndex: 1 })}>
        📊 公告板
      </div>

      {/* ── 果园 ── */}
      <div style={abs({ left: 2920, bottom: 152, width: 22, height: 158, borderRadius: 10, background: "linear-gradient(90deg,#8A6437,#A9814F 55%,#7A5230)" })} />
      <div style={abs({ left: 2790, bottom: 270, width: 130, height: 118, borderRadius: "50%", background: "#69AE52" })} />
      <div style={abs({ left: 2868, bottom: 296, width: 150, height: 132, borderRadius: "50%", background: "#7CBE5F" })} />
      <div style={abs({ left: 2972, bottom: 268, width: 118, height: 108, borderRadius: "50%", background: "#5E9E52" })} />
      <span style={abs({ left: 2842, bottom: 320, width: 13, height: 13, borderRadius: "50%", background: "#E2432E" })} />
      <span style={abs({ left: 2930, bottom: 360, width: 13, height: 13, borderRadius: "50%", background: "#E2432E" })} />
      <span style={abs({ left: 3010, bottom: 314, width: 13, height: 13, borderRadius: "50%", background: "#E2432E" })} />
      <span style={abs({ left: 2896, bottom: 284, width: 12, height: 12, borderRadius: "50%", background: "#E2432E" })} />
      <div style={abs({ left: 2788, bottom: 158, width: 86, height: 130, transformOrigin: "50% 0", animation: "gg-swing 4.4s ease-in-out infinite" })}>
        <div style={abs({ left: 10, top: 0, width: 3, height: 104, background: "repeating-linear-gradient(0deg,#C6A15B 0 4px,#A9814F 4px 8px)" })} />
        <div style={abs({ left: 72, top: 0, width: 3, height: 104, background: "repeating-linear-gradient(0deg,#C6A15B 0 4px,#A9814F 4px 8px)" })} />
        <div style={abs({ left: 0, top: 102, width: 86, height: 11, borderRadius: 5, border: "2px solid #6B4520", background: "linear-gradient(180deg,#B07B44,#96622F)", boxSizing: "border-box" })} />
      </div>
      <div style={abs({ left: 3056, bottom: 288, width: 3, height: 26, background: "#8A6437" })} />
      <div style={abs({ left: 3038, bottom: 244, width: 40, height: 46, borderRadius: "45%", border: "2px solid #8A6437", background: "repeating-linear-gradient(0deg, rgba(138,100,55,0.5) 0 4px, transparent 4px 12px), linear-gradient(180deg,#F0C35B,#D9A032)", boxSizing: "border-box" })}>
        <span style={abs({ left: "50%", bottom: 8, transform: "translateX(-50%)", width: 9, height: 9, borderRadius: "50%", background: "#6B4520" })} />
      </div>
      <div style={abs({ left: 3330, bottom: 156, width: 10, height: 10, borderRadius: "50%", background: "radial-gradient(circle,#F5D95A 0 3px,#FFFDF4 3px)" })} />
      <div style={abs({ left: 3410, bottom: 148, width: 78, height: 46, borderRadius: "50% 50% 0 0", background: "#69AE52" })} />

      {/* ── 营地 ── */}
      <div style={abs({ left: 3560, bottom: 152, width: 0, height: 0, borderLeft: "82px solid transparent", borderRight: "82px solid transparent", borderBottom: "122px solid #D9553F" })} />
      <div style={abs({ left: 3616, bottom: 152, width: 0, height: 0, borderLeft: "26px solid transparent", borderRight: "26px solid transparent", borderBottom: "54px solid #A93B29" })} />
      <div style={abs({ left: 3770, bottom: 128, width: 200, height: 100, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(255,176,58,0.4) 0%, rgba(255,176,58,0) 70%)", animation: "gg-glow 2.4s ease-in-out infinite" })} />
      <div style={abs({ left: 3830, bottom: 150, width: 60, height: 11, borderRadius: 6, background: "#6B4520", transform: "rotate(14deg)" })} />
      <div style={abs({ left: 3836, bottom: 150, width: 60, height: 11, borderRadius: 6, background: "#5C3B1E", transform: "rotate(-13deg)" })} />
      <div style={abs({ left: 3846, bottom: 164, width: 32, height: 42, borderRadius: "50% 50% 50% 50% / 64% 64% 36% 36%", background: "#E85D3A", animation: "gg-flame 0.8s ease-in-out infinite" })} />
      <div style={abs({ left: 3852, bottom: 168, width: 20, height: 30, borderRadius: "50% 50% 50% 50% / 64% 64% 36% 36%", background: "#FFB03A", animation: "gg-flame 0.62s ease-in-out 0.1s infinite" })} />
      <div style={abs({ left: 3857, bottom: 172, width: 11, height: 18, borderRadius: "50% 50% 50% 50% / 64% 64% 36% 36%", background: "#FFF1C9", animation: "gg-flame 0.5s ease-in-out 0.2s infinite" })} />
      <div style={abs({ left: 4150, bottom: 152, width: 7, height: 150, borderRadius: 4, background: "#8A6437" })} />
      <div style={abs({ left: 4153, bottom: 294, width: 44, height: 6, borderRadius: 3, background: "#8A6437" })} />
      <div style={abs({ left: 4188, bottom: 280, width: 3, height: 16, background: "#8A6437" })} />
      <div style={abs({ left: 4178, bottom: 246, width: 24, height: 32, borderRadius: 7, border: "2px solid #6B4520", background: "linear-gradient(180deg,#FFD98A,#FFB03A)", boxShadow: "0 0 16px 6px rgba(255,176,58,0.5)", animation: "gg-glow 3s ease-in-out infinite", boxSizing: "border-box" })} />
      <div style={abs({ left: 4240, bottom: 154, width: 9, height: 9, borderRadius: "50%", background: "radial-gradient(circle,#F5D95A 0 3px,#F5917B 3px)" })} />
      <div style={abs({ left: 4300, bottom: 150, width: 9, height: 40, borderRadius: 5, background: "#C89B62", boxShadow: "inset 0 -3px 0 rgba(59,43,29,0.25)" })} />
      <div style={abs({ left: 4336, bottom: 150, width: 9, height: 44, borderRadius: 5, background: "#C89B62", boxShadow: "inset 0 -3px 0 rgba(59,43,29,0.25)" })} />
      <div style={abs({ left: 4372, bottom: 150, width: 9, height: 40, borderRadius: 5, background: "#C89B62", boxShadow: "inset 0 -3px 0 rgba(59,43,29,0.25)" })} />
      <div style={abs({ left: 4294, bottom: 172, width: 94, height: 7, borderRadius: 4, background: "#B98A4E" })} />

      {/* ── 图鉴馆（博物馆立面：台基 + 四柱 + 山花） ── */}
      <div style={abs({ left: 4470, bottom: 150, width: 280, height: 16, borderRadius: 4, background: "linear-gradient(180deg,#D4D9DB,#B9BFC2)", boxShadow: "inset 0 -4px 0 rgba(0,0,0,0.12)" })} />
      <div style={abs({ left: 4484, bottom: 166, width: 252, height: 12, borderRadius: 3, background: "linear-gradient(180deg,#E0E4E6,#C9CFD2)" })} />
      <div style={abs({ left: 4492, bottom: 178, width: 236, height: 92, background: "linear-gradient(180deg,#EFE8D2,#DED2B2)" })} />
      {[4498, 4560, 4666, 4702].map((x) => (
        <div key={x} style={abs({ left: x, bottom: 178, width: 20, height: 92, borderRadius: 4, background: "linear-gradient(90deg,#F5EFDD,#D9CCA8 60%,#C4B890)", boxShadow: "inset 0 4px 0 rgba(59,43,29,0.12), inset 0 -4px 0 rgba(59,43,29,0.18)" })} />
      ))}
      <div style={abs({ left: 4596, bottom: 178, width: 52, height: 66, borderRadius: "26px 26px 0 0", background: "#5C3B1E", boxShadow: "inset 0 0 0 4px #6B4520" })} />
      <div style={abs({ left: 4482, bottom: 270, width: 256, height: 16, borderRadius: 4, border: "2px solid #6B4520", background: "linear-gradient(180deg,#B07B44,#96622F)", boxSizing: "border-box" })} />
      <div style={abs({ left: 4482, bottom: 286, width: 0, height: 0, borderLeft: "128px solid transparent", borderRight: "128px solid transparent", borderBottom: "54px solid #D9B37C" })} />
      <div style={abs({ left: 4494, bottom: 286, width: 0, height: 0, borderLeft: "116px solid transparent", borderRight: "116px solid transparent", borderBottom: "48px solid #C9A15B" })} />
      <div style={abs({ left: 4596, bottom: 296, width: 28, height: 28, borderRadius: "50%", background: "radial-gradient(circle at 40% 35%, #FFFDF6, #D9CCA8)", border: "2.5px solid #6B4520", boxSizing: "border-box" })} />
      <div style={abs({ left: 4548, bottom: 352, padding: "4px 16px 5px", borderRadius: 9, border: "2.5px solid #6B4520", background: "linear-gradient(180deg,#B07B44,#96622F)", fontFamily: "var(--font-display)", fontSize: 15, lineHeight: 1.2, color: "#FFE9AD", textShadow: "0 2px 0 rgba(0,0,0,0.35)", whiteSpace: "nowrap" })}>
        📖 图鉴馆
      </div>

      {/* ── 交易市场（集市摊位：柜台 + 条纹遮阳棚 + 货箱） ── */}
      <div style={abs({ left: 4862, bottom: 150, width: 8, height: 128, borderRadius: 4, background: "#6B4520" })} />
      <div style={abs({ left: 5110, bottom: 150, width: 8, height: 128, borderRadius: 4, background: "#6B4520" })} />
      <div style={abs({ left: 4870, bottom: 150, width: 240, height: 48, borderRadius: 6, border: "3px solid #6B4520", background: "repeating-linear-gradient(92deg, rgba(59,32,10,0.12) 0 2px, transparent 2px 30px), linear-gradient(180deg,#C08A4E,#A06A33)", boxSizing: "border-box" })} />
      <div style={abs({ left: 4886, bottom: 198, width: 40, height: 30, borderRadius: 4, border: "2px solid #6B4520", background: "repeating-linear-gradient(0deg, rgba(59,32,10,0.25) 0 4px, transparent 4px 10px), #C9A15B", boxSizing: "border-box" })} />
      <div style={abs({ left: 4934, bottom: 198, width: 32, height: 24, borderRadius: 4, border: "2px solid #6B4520", background: "#D9B37C", boxSizing: "border-box" })} />
      <div style={abs({ left: 5052, bottom: 198, width: 34, height: 26, borderRadius: "50%", background: "radial-gradient(circle at 38% 32%, #D9B37C, #B98A4E 78%)", border: "2px solid #6B4520", boxSizing: "border-box" })}>
        <span style={abs({ left: "50%", top: "50%", transform: "translate(-50%,-50%)", fontSize: 13 })}>🪙</span>
      </div>
      <div style={abs({ left: 4846, bottom: 268, width: 288, height: 42, borderRadius: "12px 12px 0 0", border: "3px solid #6B4520", background: "repeating-linear-gradient(90deg,#57964B 0 30px,#FFF3D9 30px 60px)", boxSizing: "border-box", boxShadow: "0 8px 12px rgba(43,26,8,0.22)" })} />
      <div style={abs({ left: 4906, bottom: 318, padding: "4px 16px 5px", borderRadius: 9, border: "2.5px solid #6B4520", background: "linear-gradient(180deg,#B07B44,#96622F)", fontFamily: "var(--font-display)", fontSize: 15, lineHeight: 1.2, color: "#FFE9AD", textShadow: "0 2px 0 rgba(0,0,0,0.35)", whiteSpace: "nowrap" })}>
        💰 交易市场
      </div>

      {/* ── 世界尾部收边（给市场面板向右展开留出的余量地带） ── */}
      <div style={abs({ left: 5260, bottom: 154, width: 10, height: 10, borderRadius: "50%", background: "radial-gradient(circle,#F5D95A 0 3px,#FFFDF4 3px)" })} />
      <div style={abs({ left: 5330, bottom: 148, width: 84, height: 48, borderRadius: "50% 50% 0 0", background: "#69AE52" })} />
      <div style={abs({ left: 5440, bottom: 150, width: 9, height: 40, borderRadius: 5, background: "#C89B62", boxShadow: "inset 0 -3px 0 rgba(59,43,29,0.25)" })} />
      <div style={abs({ left: 5476, bottom: 150, width: 9, height: 44, borderRadius: 5, background: "#C89B62", boxShadow: "inset 0 -3px 0 rgba(59,43,29,0.25)" })} />
      <div style={abs({ left: 5512, bottom: 150, width: 9, height: 40, borderRadius: 5, background: "#C89B62", boxShadow: "inset 0 -3px 0 rgba(59,43,29,0.25)" })} />
      <div style={abs({ left: 5434, bottom: 172, width: 94, height: 7, borderRadius: 4, background: "#B98A4E" })} />
    </>
  );
});
