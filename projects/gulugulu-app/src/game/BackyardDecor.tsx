import { memo } from "react";
import { useT } from "../useT";
import { LAMP_HEAD_BOTTOM, LAMP_POSTS, WORLD_MIN, WORLD_SPAN, abs } from "./backyardShared";

// ---------------------------------------------------------------------------
// 两侧装饰带的可复用小件：圆叶树 / 灌木 / 花 / 指路牌。
// 只在左右尽头的纯风景区使用，风格沿用近景既有布景（圆润色块 + 木牌）。
// ---------------------------------------------------------------------------

/** 圆叶树：木纹树干 + 三团交叠树冠（left 为树干中心区左缘）。 */
function RoundTree({ left, tone = "#7CBE5F" }: { left: number; tone?: string }) {
  return (
    <>
      <div style={abs({ left: left + 54, bottom: 150, width: 18, height: 94, borderRadius: 8, background: "linear-gradient(90deg,#8A6437,#A9814F 55%,#7A5230)" })} />
      <div style={abs({ left, bottom: 220, width: 118, height: 104, borderRadius: "50%", background: "#5E9E52" })} />
      <div style={abs({ left: left + 30, bottom: 244, width: 130, height: 116, borderRadius: "50%", background: tone })} />
      <div style={abs({ left: left + 86, bottom: 218, width: 104, height: 96, borderRadius: "50%", background: "#69AE52" })} />
    </>
  );
}

/** 灌木：半圆色块，贴地。 */
function Bush({ left, w, h, color, bottom = 150 }: { left: number; w: number; h: number; color: string; bottom?: number }) {
  return <div style={abs({ left, bottom, width: w, height: h, borderRadius: "50% 50% 0 0", background: color })} />;
}

/** 小花：黄蕊 + 彩瓣的圆点。 */
function Flower({ left, color = "#E2432E", bottom = 152 }: { left: number; color?: string; bottom?: number }) {
  return <div style={abs({ left, bottom, width: 10, height: 10, borderRadius: "50%", background: `radial-gradient(circle,#F5D95A 0 3px,${color} 3px)` })} />;
}

/** 指路木牌：立柱 + 略微倾斜的木牌。 */
function SignPost({ left, label }: { left: number; label: string }) {
  return (
    <>
      <div style={abs({ left: left + 24, bottom: 150, width: 8, height: 76, borderRadius: 4, background: "#8A6437" })} />
      <div className="by-scene-note" style={abs({ left, bottom: 198, padding: "3px 12px 4px", fontSize: 13, whiteSpace: "nowrap", transform: "rotate(-2deg)" })}>
        {label}
      </div>
    </>
  );
}

/** 路灯柱：铁艺立柱 + 顶罩铁盖（都是冷色金属件，随昼夜正常调色）。灯罩玻璃（暖光）
 *  另由 NearLights 的 LampGlass 在同 X 单独渲染、不调色，入夜/黄昏仍保暖亮。
 *  x 为灯罩/灯光中心（与 LAMP_POSTS / BackyardNightLights / LampGlass 对齐）。 */
function LampPost({ x }: { x: number }) {
  return (
    <>
      <div style={abs({ left: x - 3.5, bottom: 150, width: 7, height: 92, borderRadius: 4, background: "linear-gradient(90deg,#3d2f22,#5f4a35 55%,#332619)" })} />
      <div style={abs({ left: x - 7, bottom: 148, width: 14, height: 6, borderRadius: "50%", background: "#3d2f22" })} />
      <div style={abs({ left: x - 9, bottom: LAMP_HEAD_BOTTOM + 9, width: 18, height: 5, borderRadius: "4px 4px 0 0", background: "#332619" })} />
    </>
  );
}

/** 路灯灯罩玻璃（暖光）：从 LampPost 拆出，单独渲染在不调色的 NearLights 层，
 *  入夜/黄昏仍保暖亮。x 与 LampPost 立柱对齐。 */
function LampGlass({ x }: { x: number }) {
  return (
    <div style={abs({ left: x - 8, bottom: LAMP_HEAD_BOTTOM - 9, width: 16, height: 18, borderRadius: "6px 6px 4px 4px", border: "1.5px solid #332619", boxSizing: "border-box", background: "linear-gradient(180deg,#ffe6a8,#e6b25f)" })} />
  );
}

/** 小蘑菇：圆帽 + 白点 + 短柄，成簇点在树根/草地。 */
function Mushroom({ left, bottom = 150, cap = "#D9553F", s = 1 }: { left: number; bottom?: number; cap?: string; s?: number }) {
  return (
    <>
      <div style={abs({ left: left + 3 * s, bottom, width: 6 * s, height: 9 * s, borderRadius: "3px 3px 2px 2px", background: "#F3E7CE" })} />
      <div style={abs({ left, bottom: bottom + 6 * s, width: 12 * s, height: 8 * s, borderRadius: "50% 50% 40% 40%", background: cap })}>
        <span style={abs({ left: 2.5 * s, top: 1.5 * s, width: 2.5 * s, height: 2.5 * s, borderRadius: "50%", background: "rgba(255,255,255,0.85)" })} />
        <span style={abs({ right: 2 * s, top: 3 * s, width: 2 * s, height: 2 * s, borderRadius: "50%", background: "rgba(255,255,255,0.8)" })} />
      </div>
    </>
  );
}

/** 世界边界栅栏：两根木桩 + 横档，标出可漫步范围的尽头。 */
function EdgeFence({ left }: { left: number }) {
  return (
    <>
      <div style={abs({ left, bottom: 150, width: 9, height: 44, borderRadius: 5, background: "#C89B62", boxShadow: "inset 0 -3px 0 rgba(59,43,29,0.25)" })} />
      <div style={abs({ left: left + 36, bottom: 150, width: 9, height: 40, borderRadius: 5, background: "#C89B62", boxShadow: "inset 0 -3px 0 rgba(59,43,29,0.25)" })} />
      <div style={abs({ left: left - 6, bottom: 172, width: 58, height: 7, borderRadius: 4, background: "#B98A4E" })} />
    </>
  );
}

// ---------------------------------------------------------------------------
// 静态装饰层（memo：场景每秒因倒计时重渲，装饰不重排）
// 三个视差层的纯布景：远景（太阳/远山/云）、中景（灌木/风车/小屋）、
// 近景（草皮/各区建筑立面）。零 props、无状态，从 BackyardScene 抽出。
// ---------------------------------------------------------------------------

/** 蓬蓬云：底部长条 + 三团大小不一的圆叠出云朵轮廓（drift = 错峰缓移相位/秒） */
function Cloud({ left, top, size = 1, opacity = 0.75, drift = 0 }: { left: number; top: number; size?: number; opacity?: number; drift?: number }) {
  return (
    <div
      className="by-cloud"
      style={abs({ left, top, width: 150 * size, height: 56 * size, opacity, animationDuration: `${30 + drift * 2}s`, animationDelay: `${drift}s` })}
    >
      <div style={abs({ left: 0, bottom: 0, width: "100%", height: "44%", borderRadius: 999, background: "#FFFFFF" })} />
      <div style={abs({ left: "10%", bottom: "20%", width: "36%", height: "58%", borderRadius: "50%", background: "#FFFFFF" })} />
      <div style={abs({ left: "34%", bottom: "24%", width: "44%", height: "76%", borderRadius: "50%", background: "#FFFFFF" })} />
      <div style={abs({ left: "64%", bottom: "16%", width: "30%", height: "50%", borderRadius: "50%", background: "#FFFFFF" })} />
    </div>
  );
}

/** 远景（速率 0.25）：太阳、远处两层山（后弧形 + 前三角）、云。
 *  用冷调（偏蓝灰）远山——比中景的暖绿圆丘更远、更冷、更朦胧。两层刻意反差轮廓：
 *  后层圆顶弧线、前层参差尖峰，峰高峰距都不均（错落有致），避免拍平成一条直线。
 *  两处关键约束：① 山体横向跨度要覆盖含两侧装饰带的整段视差取景范围（远景速率
 *  0.25，相机 camX∈[WORLD_MIN,WORLD_MAX] ⇒ 需铺到约 [-320, 3600]）；② 底边压到
 *  近景草皮线（顶 160）以下——否则山脚与草皮之间会露出一条透明横缝。 */
export const FarDecor = memo(function FarDecor() {
  return (
    <>
      {/* top 锚定物注意：层整体下移 56 + 视高 420 ⇒ 窗口上缘 = top 坐标 84，
          top 需 ≥ ~96 才不会被裁顶（用户拉伸窗口时该比例恒定） */}
      {/* 太阳/月亮已迁到 BackyardSky（按真实时间在天空升落）——远景层不再画静态太阳。 */}
      {/* ── 最远一层·弧形山（错落叠放的平底圆顶：最浅、最冷、最高，朦胧退到天边） ──
          圆顶（borderRadius 顶圆底平）互相交叠、底边同线 → 无透明缝；峰高刻意不均。 */}
      {(
        [
          [-560, 1050, 210],
          [120, 880, 244],
          [720, 1000, 172],
          [1420, 1120, 232],
          [2180, 940, 160],
          [2820, 1080, 222],
          [3480, 1000, 190],
          [4050, 900, 205],
        ] as Array<[number, number, number]>
      ).map(([left, w, h]) => (
        <div
          key={left}
          style={abs({
            left,
            bottom: 146,
            width: w,
            height: h,
            borderRadius: "50% 50% 0 0",
            background: "linear-gradient(180deg,#CBDAE0,#B4C8D0)",
            opacity: 0.7,
          })}
        />
      ))}
      {/* ── 较近一层·三角山（参差尖峰：稍深、稍绿、稍矮，压在弧形山之前叠出纵深） ──
          峰高/峰距刻意不均（错落有致），底边连续无缝。 */}
      <div
        style={abs({
          left: -560,
          bottom: 150,
          width: 4760,
          height: 150,
          background: "linear-gradient(180deg,#AAC3C1,#96B4AE)",
          opacity: 0.9,
          clipPath:
            "polygon(0% 100%,0% 66%,5% 34%,11% 70%,17% 18%,23% 64%,30% 46%,36% 72%,43% 26%,50% 60%,57% 50%,63% 74%,69% 22%,75% 66%,82% 40%,88% 70%,94% 30%,100% 58%,100% 100%)",
        })}
      />
      <Cloud left={-380} top={130} size={0.8} opacity={0.64} drift={0} />
      <Cloud left={250} top={118} size={0.9} opacity={0.75} drift={3} />
      <Cloud left={640} top={158} size={0.66} opacity={0.62} drift={6} />
      <Cloud left={900} top={100} size={1.1} opacity={0.75} drift={1.5} />
      <Cloud left={1500} top={140} size={0.8} opacity={0.68} drift={4.5} />
      <Cloud left={2100} top={178} size={1} opacity={0.72} drift={2} />
      <Cloud left={2680} top={112} size={0.85} opacity={0.7} drift={5.5} />
      <Cloud left={3320} top={150} size={0.95} opacity={0.66} drift={3.5} />
    </>
  );
});

/** 中景（速率 0.55）：连绵矮丘 + 风车 / 小屋 / 树 / 栅栏等具象点缀。
 *  整层下沉 18px：矮丘带底边落到近景草皮（132–160）之下，两处作用——① 与近景
 *  无缝衔接（消除中景/近景之间的透明横缝）；② 圆丘带横跨 [-600,4600] 覆盖含两侧
 *  装饰带的整段视差取景范围（中景速率 0.55）。具象点缀改为不规则疏密散布，配合
 *  暖绿圆丘（对比远景的冷色尖峰）弱化重复感。 */
export const MidDecor = memo(function MidDecor() {
  return (
    <div style={abs({ inset: 0, transform: "translateY(18px)" })}>
      {/* 连绵矮丘（两道错峰的暖绿圆丘带）：底边压到草皮线下，横向铺满整段视差范围 */}
      <div style={abs({ left: -600, bottom: 150, width: 5200, height: 130, background: "linear-gradient(180deg,#93B98A,#7EAD79)", opacity: 0.9, clipPath: "polygon(0% 100%,0% 60%,6% 40%,14% 64%,23% 42%,32% 68%,41% 44%,51% 66%,60% 40%,70% 64%,80% 46%,90% 62%,100% 44%,100% 100%)" })} />
      <div style={abs({ left: -600, bottom: 158, width: 5200, height: 94, background: "linear-gradient(180deg,#8CB383,#79A874)", opacity: 0.92, clipPath: "polygon(0% 100%,0% 72%,9% 50%,19% 74%,30% 52%,41% 76%,53% 50%,64% 74%,75% 54%,87% 72%,100% 52%,100% 100%)" })} />

      {/* —— 具象点缀（尺寸/比例各异，不规则散布） —— */}
      {/* 左端装饰带后方的远树（一高一矮双冠） */}
      {/* 训练馆（近景 -580..-260）后方留空，中景树移入扩展后的林间空地。 */}
      <div style={abs({ left: -920, bottom: 168, width: 14, height: 64, borderRadius: 7, background: "#A98D6B" })} />
      <div style={abs({ left: -964, bottom: 218, width: 100, height: 86, borderRadius: "50%", background: "#7EAD79", opacity: 0.95 })} />
      <div style={abs({ left: -934, bottom: 258, width: 56, height: 46, borderRadius: "50%", background: "#9BC06E", opacity: 0.9 })} />

      {/* 风车 */}
      <div style={abs({ left: 860, bottom: 168, width: 32, height: 132, borderRadius: "9px 9px 4px 4px", background: "linear-gradient(90deg,#C9B08C,#B9A07C)", opacity: 0.95 })} />
      <div style={abs({ left: 868, bottom: 294, width: 16, height: 16, borderRadius: "50%", background: "#8A7458", zIndex: 1 })} />
      <div style={abs({ left: 836, bottom: 254, width: 80, height: 80, animation: "gg-spin 10s linear infinite", opacity: 0.9 })}>
        <div style={abs({ left: 0, top: 35, width: 80, height: 10, borderRadius: 6, background: "#B9A58A" })} />
        <div style={abs({ left: 35, top: 0, width: 10, height: 80, borderRadius: 6, background: "#B9A58A" })} />
      </div>

      {/* 木栅栏 */}
      <div style={abs({ left: 1180, bottom: 168, width: 200, height: 30, borderTop: "5px solid #C0A276", background: "repeating-linear-gradient(90deg, #C0A276 0 8px, transparent 8px 48px)", opacity: 0.8 })} />

      {/* 高瘦的一棵树 */}
      <div style={abs({ left: 1450, bottom: 168, width: 14, height: 76, borderRadius: 7, background: "#A98D6B" })} />
      <div style={abs({ left: 1404, bottom: 226, width: 108, height: 94, borderRadius: "50%", background: "#7EAD79", opacity: 0.95 })} />
      <div style={abs({ left: 1438, bottom: 270, width: 60, height: 50, borderRadius: "50%", background: "#9BC06E", opacity: 0.9 })} />

      {/* 远处小屋 */}
      <div style={abs({ left: 2040, bottom: 168, width: 112, height: 72, borderRadius: 4, background: "#C9B8A0", opacity: 0.95 })} />
      <div style={abs({ left: 2036, bottom: 238, width: 0, height: 0, borderLeft: "60px solid transparent", borderRight: "60px solid transparent", borderBottom: "46px solid #A98D6B", opacity: 0.95 })} />
      <div style={abs({ left: 2118, bottom: 270, width: 13, height: 26, borderRadius: 3, background: "#A98D6B", opacity: 0.95 })} />
      <div style={abs({ left: 2084, bottom: 190, width: 22, height: 26, borderRadius: "3px 3px 0 0", background: "#8A7458", opacity: 0.9 })} />
      {/* 小屋炊烟：从烟囱口缓缓升腾（CSS 关键帧 by-smoke-rise） */}
      <span className="by-smoke" style={abs({ left: 2119, bottom: 296, width: 16, height: 16 })} />
      <span className="by-smoke" style={abs({ left: 2119, bottom: 296, width: 20, height: 20, animationDelay: "1.6s" })} />
      <span className="by-smoke" style={abs({ left: 2119, bottom: 296, width: 13, height: 13, animationDelay: "3.2s" })} />

      {/* 矮胖的一棵树（换比例避免与前一棵雷同） */}
      <div style={abs({ left: 2930, bottom: 168, width: 16, height: 78, borderRadius: 8, background: "#A98D6B" })} />
      <div style={abs({ left: 2870, bottom: 224, width: 130, height: 108, borderRadius: "50%", background: "#6FA268", opacity: 0.95 })} />
      <div style={abs({ left: 2912, bottom: 274, width: 66, height: 54, borderRadius: "50%", background: "#9BC06E", opacity: 0.9 })} />

      {/* 第二道栅栏 + 右段尽头一棵树，收束右侧装饰带后方 */}
      <div style={abs({ left: 3620, bottom: 168, width: 180, height: 28, borderTop: "5px solid #C0A276", background: "repeating-linear-gradient(90deg, #C0A276 0 8px, transparent 8px 46px)", opacity: 0.78 })} />
      <div style={abs({ left: 4180, bottom: 168, width: 14, height: 70, borderRadius: 7, background: "#A98D6B" })} />
      <div style={abs({ left: 4136, bottom: 222, width: 102, height: 88, borderRadius: "50%", background: "#7EAD79", opacity: 0.95 })} />
      <div style={abs({ left: 4168, bottom: 264, width: 58, height: 48, borderRadius: "50%", background: "#9BC06E", opacity: 0.9 })} />
    </div>
  );
});

/** 近景静态装饰：地面 + 各区布景（不含蛋坑/商店板/公告板内容等动态件） */
export const NearDecor = memo(function NearDecor() {
  const { T } = useT();
  return (
    <>
      {/* 草皮 + 剖面土层（横跨含两侧装饰带的整个世界；透明窗口下不留缝） */}
      <div style={abs({ left: WORLD_MIN, bottom: 132, width: WORLD_SPAN, height: 28, borderRadius: "16px 16px 0 0", background: "linear-gradient(180deg,#9ED67F,#7CBE5F)", boxShadow: "0 -4px 10px rgba(59,43,29,0.12)" })} />
      <div
        style={abs({
          left: WORLD_MIN,
          bottom: 0,
          width: WORLD_SPAN,
          height: 132,
          background:
            "radial-gradient(circle at 90px 34px, #C6A15B 0 6px, transparent 7px), radial-gradient(circle at 260px 60px, #96703E 0 5px, transparent 6px), radial-gradient(circle at 430px 28px, #C6A15B 0 4px, transparent 5px), linear-gradient(180deg,#A9814F,#8A6437)",
          backgroundSize: "560px 132px, 560px 132px, 560px 132px, 100% 100%",
        })}
      />

      {/* ── 左尽头·林间空地（训练馆之前的收边装饰） ── */}
      <EdgeFence left={-1040} />
      <Bush left={-988} w={110} h={56} color="#93B98A" />
      <RoundTree left={-930} tone="#7CBE5F" />
      <Flower left={-808} color="#F5917B" />
      <SignPost left={-784} label={T.bk.decor.glade} />

      {/* ── 训练馆（世界 x≈-420，孵化区左侧） ──
           馆体、屋顶、门窗和器械统一画在同一张 SVG 坐标系里，避免缩放时屋顶分层错位。
           暖色灰泥墙 + 赤陶屋顶沿用后院建筑的纸绘色块与深棕描边；窗内哑铃、
           门侧沙袋和户外杠铃让建筑在小尺寸下也能一眼读成健身房。 */}
      <div
        aria-hidden="true"
        style={abs({ left: -620, bottom: 146, width: 420, height: 236, pointerEvents: "none" })}
      >
        <svg viewBox="0 0 420 236" width="420" height="236" style={{ display: "block", overflow: "visible" }}>
          <defs>
            <linearGradient id="training-wall" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#F2DFB9" />
              <stop offset="1" stopColor="#D7B47A" />
            </linearGradient>
            <linearGradient id="training-roof" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#DE7257" />
              <stop offset="1" stopColor="#B94738" />
            </linearGradient>
            <linearGradient id="training-glass" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#CDEFF1" />
              <stop offset="1" stopColor="#7FC2CA" />
            </linearGradient>
            <linearGradient id="training-door" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#F5B968" />
              <stop offset="1" stopColor="#DB764E" />
            </linearGradient>
          </defs>

          {/* 地基与整块馆体 */}
          <rect x="54" y="221" width="292" height="14" rx="6" fill="#9C8B72" />
          <rect x="47" y="218" width="306" height="8" rx="4" fill="#C7B698" />
          <rect x="68" y="82" width="264" height="142" rx="10" fill="url(#training-wall)" stroke="#6B4520" strokeWidth="4" />
          <path d="M70 188H330V222H70Z" fill="#C98758" opacity=".75" />
          <path d="M86 84V222M314 84V222" fill="none" stroke="#B77C4B" strokeWidth="8" opacity=".48" />
          <path d="M76 112H324" fill="none" stroke="#6B4520" strokeWidth="4" opacity=".28" />

          {/* 单体赤陶屋顶：轮廓和屋檐共用一个坐标系，不再由两块 DOM 拼接 */}
          <path d="M46 85L79 42Q81 39 86 39H314Q319 39 321 42L354 85Q357 89 351 89H49Q43 89 46 85Z" fill="url(#training-roof)" stroke="#6B4520" strokeWidth="4" strokeLinejoin="round" />
          <path d="M82 42L67 86M141 42L133 86M200 42V86M259 42L267 86M318 42L333 86" fill="none" stroke="#9B382F" strokeWidth="3" opacity=".5" />
          <path d="M43 84H357L346 103H54Z" fill="#F4D18A" stroke="#6B4520" strokeWidth="4" strokeLinejoin="round" />
          <path d="M76 86V101M120 86V101M164 86V101M208 86V101M252 86V101M296 86V101M340 86V101" fill="none" stroke="#D79B58" strokeWidth="5" opacity=".8" />

          {/* 两侧大窗：玻璃内的哑铃剪影强化健身房识别 */}
          <g>
            <rect x="82" y="124" width="62" height="54" rx="9" fill="#6B4520" />
            <rect x="87" y="129" width="52" height="44" rx="6" fill="url(#training-glass)" />
            <path d="M99 149H127" stroke="#426D70" strokeWidth="5" strokeLinecap="round" />
            <path d="M97 142V156M103 139V159M123 139V159M129 142V156" stroke="#426D70" strokeWidth="5" strokeLinecap="round" />
            <path d="M90 132L111 132" stroke="#F7FBF2" strokeWidth="3" strokeLinecap="round" opacity=".7" />
          </g>
          <g>
            <rect x="256" y="124" width="62" height="54" rx="9" fill="#6B4520" />
            <rect x="261" y="129" width="52" height="44" rx="6" fill="url(#training-glass)" />
            <path d="M273 149H301" stroke="#426D70" strokeWidth="5" strokeLinecap="round" />
            <path d="M271 142V156M277 139V159M297 139V159M303 142V156" stroke="#426D70" strokeWidth="5" strokeLinecap="round" />
            <path d="M264 132L285 132" stroke="#F7FBF2" strokeWidth="3" strokeLinecap="round" opacity=".7" />
          </g>

          {/* 带拱顶的双开入口 */}
          <path d="M154 224V170A46 46 0 0 1 246 170V224Z" fill="url(#training-door)" stroke="#6B4520" strokeWidth="4" />
          <path d="M200 126V224" fill="none" stroke="#6B4520" strokeWidth="4" />
          <path d="M158 171H242" fill="none" stroke="#8E4E36" strokeWidth="3" opacity=".55" />
          <circle cx="190" cy="191" r="4" fill="#FFE28A" stroke="#6B4520" strokeWidth="2" />
          <circle cx="210" cy="191" r="4" fill="#FFE28A" stroke="#6B4520" strokeWidth="2" />

          {/* 左侧挂架与沙袋 */}
          <path d="M68 111H27V127" fill="none" stroke="#6B4520" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M27 126V136" fill="none" stroke="#6B4520" strokeWidth="4" />
          <rect x="13" y="135" width="28" height="66" rx="13" fill="#C85543" stroke="#6B4520" strokeWidth="4" />
          <path d="M17 151H37" fill="none" stroke="#E7876D" strokeWidth="4" opacity=".7" />

          {/* 右侧户外举重台与杠铃 */}
          <path d="M350 213H414" fill="none" stroke="#6B4520" strokeWidth="8" strokeLinecap="round" />
          <path d="M363 213L356 226M401 213L408 226" fill="none" stroke="#6B4520" strokeWidth="6" strokeLinecap="round" />
          <path d="M354 197H410" fill="none" stroke="#4F4A44" strokeWidth="5" strokeLinecap="round" />
          <path d="M350 189V205M358 186V208M406 186V208M414 189V205" fill="none" stroke="#3F3A35" strokeWidth="7" strokeLinecap="round" />
        </svg>
      </div>
      {/* 白天在实景层渲染；纸张主题会隐藏它，并使用上方 NearUiNotes 的同位副本。 */}
      <div className="by-scene-note" style={abs({ left: -472, bottom: 338, padding: "4px 16px 5px", fontSize: 16, whiteSpace: "nowrap", zIndex: 1 })}>
        {T.bk.decor.trainingHall}
      </div>
      {/* 训练馆两侧的收边绿植 */}
      <Bush left={-676} w={96} h={54} color="#7CBE5F" />
      <Flower left={-244} color="#F5D95A" />
      <Bush left={-176} w={110} h={56} color="#7EAD79" />
      <Flower left={-96} color="#E2432E" />

      {/* ── 右尽头·旷野观景（交易市场之后的一屏纯装饰带） ── */}
      <Bush left={5888} w={120} h={58} color="#7EAD79" />
      <Flower left={5952} color="#F5D95A" />
      <RoundTree left={6000} tone="#7CBE5F" />
      <SignPost left={6146} label={T.bk.decor.wilds} />
      <Bush left={6244} w={100} h={54} color="#93B98A" />
      {/* 长椅（歇脚点） */}
      <div style={abs({ left: 6350, bottom: 186, width: 84, height: 9, borderRadius: 4, background: "#96703E" })} />
      <div style={abs({ left: 6350, bottom: 166, width: 84, height: 10, borderRadius: 4, background: "#A9814F" })} />
      <div style={abs({ left: 6354, bottom: 150, width: 8, height: 18, background: "#7A5230" })} />
      <div style={abs({ left: 6426, bottom: 150, width: 8, height: 18, background: "#7A5230" })} />
      <Flower left={6476} color="#F5917B" />
      <RoundTree left={6528} tone="#69AE52" />
      <Flower left={6660} color="#E2432E" />
      <Bush left={6632} w={110} h={60} color="#7CBE5F" />
      <EdgeFence left={6710} />

      {/* ── 孵化区布景 ── */}
      <div style={abs({ left: 20, bottom: 150, width: 9, height: 40, borderRadius: 5, background: "#C89B62", boxShadow: "inset 0 -3px 0 rgba(59,43,29,0.25)" })} />
      <div style={abs({ left: 56, bottom: 150, width: 9, height: 44, borderRadius: 5, background: "#C89B62", boxShadow: "inset 0 -3px 0 rgba(59,43,29,0.25)" })} />
      <div style={abs({ left: 14, bottom: 172, width: 58, height: 7, borderRadius: 4, background: "#B98A4E" })} />
      <div style={abs({ left: 96, bottom: 150, width: 8, height: 88, borderRadius: 4, background: "#8A6437" })} />
      <div className="by-scene-note" style={abs({ left: 58, bottom: 226, padding: "4px 14px 5px", fontSize: 14, transform: "rotate(-2deg)", whiteSpace: "nowrap" })}>
        {T.bk.decor.hatchery}
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
      <div className="by-scene-note" style={abs({ left: 1104, bottom: 306, padding: "4px 18px 5px", fontSize: 17, whiteSpace: "nowrap" })}>
        {T.bk.decor.shop}
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
      {/* 睡莲叶 + 花 */}
      <div style={abs({ left: 1948, bottom: 150, width: 30, height: 13, borderRadius: "50%", background: "radial-gradient(ellipse at 40% 34%,#7EC86A,#4F9A45)" })} />
      <div style={abs({ left: 2096, bottom: 152, width: 24, height: 11, borderRadius: "50%", background: "radial-gradient(ellipse at 40% 34%,#8ED07A,#579E4B)" })} />
      <div style={abs({ left: 2060, bottom: 149, width: 12, height: 12, borderRadius: "50%", background: "radial-gradient(circle,#FFE38A 0 3px,#F5A8C0 3px 6px,#E77BA0 6px)" })} />
      {/* 香蒲（右岸） */}
      <div style={abs({ left: 2150, bottom: 150, width: 3, height: 42, borderRadius: 2, background: "#57964B" })} />
      <div style={abs({ left: 2148, bottom: 188, width: 7, height: 16, borderRadius: 5, background: "#7A5230" })} />
      <div style={abs({ left: 2164, bottom: 150, width: 3, height: 30, borderRadius: 2, background: "#57964B" })} />
      <div style={abs({ left: 2162, bottom: 176, width: 7, height: 14, borderRadius: 5, background: "#7A5230" })} />
      <div style={abs({ left: 1874, bottom: 150, width: 4, height: 46, borderRadius: 2, background: "#57964B" })} />
      <div style={abs({ left: 1872, bottom: 192, width: 8, height: 18, borderRadius: 5, background: "#7A5230" })} />
      <div style={abs({ left: 1890, bottom: 150, width: 4, height: 58, borderRadius: 2, background: "#57964B" })} />
      <div style={abs({ left: 1888, bottom: 204, width: 8, height: 18, borderRadius: 5, background: "#7A5230" })} />
      <div style={abs({ left: 1906, bottom: 150, width: 4, height: 40, borderRadius: 2, background: "#57964B" })} />
      <div style={abs({ left: 2020, bottom: 158, width: 34, height: 12, borderRadius: "50%", background: "#6FB35F" })} />
      <div style={abs({ left: 2230, bottom: 148, width: 28, height: 13, borderRadius: "50%", background: "#D4D9DB", boxShadow: "inset 0 -3px 0 rgba(0,0,0,0.12)" })} />

      {/* ── 公告板骨架（内容动态；板体 2240..2588 · 底 208 · 顶 396） ── */}
      <div style={abs({ left: 2288, bottom: 150, width: 11, height: 90, borderRadius: 5, background: "linear-gradient(90deg,#8A6437,#A9814F)" })} />
      <div style={abs({ left: 2529, bottom: 150, width: 11, height: 90, borderRadius: 5, background: "linear-gradient(90deg,#8A6437,#A9814F)" })} />
      {/* 标题牌悬在板框上方，和内容纸完全分离（板顶 426）。 */}
      <div className="by-scene-note" style={abs({ left: 2353, bottom: 436, padding: "5px 18px 6px", fontSize: 16, lineHeight: 1.2, whiteSpace: "nowrap", zIndex: 1 })}>
        {T.bk.decor.board}
      </div>

      {/* ── 交易市场 → 果园 的过渡小丛（衔接功能区簇与右侧自然带） ── */}
      <Bush left={4220} w={92} h={52} color="#7EAD79" />
      <Flower left={4286} color="#F5D95A" />

      {/* ── 果园（迁到市场右侧的自然景观带，原位于公告板与图鉴馆之间） ── */}
      <div style={abs({ left: 4340, bottom: 152, width: 22, height: 158, borderRadius: 10, background: "linear-gradient(90deg,#8A6437,#A9814F 55%,#7A5230)" })} />
      <div style={abs({ left: 4210, bottom: 270, width: 130, height: 118, borderRadius: "50%", background: "#69AE52" })} />
      <div style={abs({ left: 4288, bottom: 296, width: 150, height: 132, borderRadius: "50%", background: "#7CBE5F" })} />
      <div style={abs({ left: 4392, bottom: 268, width: 118, height: 108, borderRadius: "50%", background: "#5E9E52" })} />
      <span style={abs({ left: 4262, bottom: 320, width: 13, height: 13, borderRadius: "50%", background: "#E2432E" })} />
      <span style={abs({ left: 4350, bottom: 360, width: 13, height: 13, borderRadius: "50%", background: "#E2432E" })} />
      <span style={abs({ left: 4430, bottom: 314, width: 13, height: 13, borderRadius: "50%", background: "#E2432E" })} />
      <span style={abs({ left: 4316, bottom: 284, width: 12, height: 12, borderRadius: "50%", background: "#E2432E" })} />
      <div style={abs({ left: 4208, bottom: 158, width: 86, height: 130, transformOrigin: "50% 0", animation: "gg-swing 4.4s ease-in-out infinite" })}>
        <div style={abs({ left: 10, top: 0, width: 3, height: 104, background: "repeating-linear-gradient(0deg,#C6A15B 0 4px,#A9814F 4px 8px)" })} />
        <div style={abs({ left: 72, top: 0, width: 3, height: 104, background: "repeating-linear-gradient(0deg,#C6A15B 0 4px,#A9814F 4px 8px)" })} />
        <div style={abs({ left: 0, top: 102, width: 86, height: 11, borderRadius: 5, border: "2px solid #6B4520", background: "linear-gradient(180deg,#B07B44,#96622F)", boxSizing: "border-box" })} />
      </div>
      <div style={abs({ left: 4476, bottom: 288, width: 3, height: 26, background: "#8A6437" })} />
      <div style={abs({ left: 4458, bottom: 244, width: 40, height: 46, borderRadius: "45%", border: "2px solid #8A6437", background: "repeating-linear-gradient(0deg, rgba(138,100,55,0.5) 0 4px, transparent 4px 12px), linear-gradient(180deg,#F0C35B,#D9A032)", boxSizing: "border-box" })}>
        <span style={abs({ left: "50%", bottom: 8, transform: "translateX(-50%)", width: 9, height: 9, borderRadius: "50%", background: "#6B4520" })} />
      </div>
      <div style={abs({ left: 4750, bottom: 156, width: 10, height: 10, borderRadius: "50%", background: "radial-gradient(circle,#F5D95A 0 3px,#FFFDF4 3px)" })} />
      <div style={abs({ left: 4830, bottom: 148, width: 78, height: 46, borderRadius: "50% 50% 0 0", background: "#69AE52" })} />

      {/* ── 营地（迁到果园右侧，与果园一同收束右端自然带；原位于图鉴馆之前） ── */}
      <div style={abs({ left: 4980, bottom: 152, width: 0, height: 0, borderLeft: "82px solid transparent", borderRight: "82px solid transparent", borderBottom: "122px solid #D9553F" })} />
      <div style={abs({ left: 5036, bottom: 152, width: 0, height: 0, borderLeft: "26px solid transparent", borderRight: "26px solid transparent", borderBottom: "54px solid #A93B29" })} />
      {/* 柴堆（地面火光 + 三层跳动火舌 → 不调色，见 NearLights 的营地篝火） */}
      <div style={abs({ left: 5250, bottom: 150, width: 60, height: 11, borderRadius: 6, background: "#6B4520", transform: "rotate(14deg)" })} />
      <div style={abs({ left: 5256, bottom: 150, width: 60, height: 11, borderRadius: 6, background: "#5C3B1E", transform: "rotate(-13deg)" })} />
      {/* 挂灯支架（灯杆 + 横臂 + 挂钩，冷色木件随昼夜调色）；暖光灯笼另见 NearLights */}
      <div style={abs({ left: 5570, bottom: 152, width: 7, height: 150, borderRadius: 4, background: "#8A6437" })} />
      <div style={abs({ left: 5573, bottom: 294, width: 44, height: 6, borderRadius: 3, background: "#8A6437" })} />
      <div style={abs({ left: 5608, bottom: 280, width: 3, height: 16, background: "#8A6437" })} />
      <div style={abs({ left: 5660, bottom: 154, width: 9, height: 9, borderRadius: "50%", background: "radial-gradient(circle,#F5D95A 0 3px,#F5917B 3px)" })} />
      <div style={abs({ left: 5720, bottom: 150, width: 9, height: 40, borderRadius: 5, background: "#C89B62", boxShadow: "inset 0 -3px 0 rgba(59,43,29,0.25)" })} />
      <div style={abs({ left: 5756, bottom: 150, width: 9, height: 44, borderRadius: 5, background: "#C89B62", boxShadow: "inset 0 -3px 0 rgba(59,43,29,0.25)" })} />
      <div style={abs({ left: 5792, bottom: 150, width: 9, height: 40, borderRadius: 5, background: "#C89B62", boxShadow: "inset 0 -3px 0 rgba(59,43,29,0.25)" })} />
      <div style={abs({ left: 5714, bottom: 172, width: 94, height: 7, borderRadius: 4, background: "#B98A4E" })} />

      {/* ── 图鉴馆（博物馆立面：台基 + 四柱 + 山花）·紧贴公告板右侧 ── */}
      <div style={abs({ left: 3170, bottom: 150, width: 280, height: 16, borderRadius: 4, background: "linear-gradient(180deg,#D4D9DB,#B9BFC2)", boxShadow: "inset 0 -4px 0 rgba(0,0,0,0.12)" })} />
      <div style={abs({ left: 3184, bottom: 166, width: 252, height: 12, borderRadius: 3, background: "linear-gradient(180deg,#E0E4E6,#C9CFD2)" })} />
      <div style={abs({ left: 3192, bottom: 178, width: 236, height: 92, background: "linear-gradient(180deg,#EFE8D2,#DED2B2)" })} />
      {[3198, 3260, 3366, 3402].map((x) => (
        <div key={x} style={abs({ left: x, bottom: 178, width: 20, height: 92, borderRadius: 4, background: "linear-gradient(90deg,#F5EFDD,#D9CCA8 60%,#C4B890)", boxShadow: "inset 0 4px 0 rgba(59,43,29,0.12), inset 0 -4px 0 rgba(59,43,29,0.18)" })} />
      ))}
      <div style={abs({ left: 3296, bottom: 178, width: 52, height: 66, borderRadius: "26px 26px 0 0", background: "#5C3B1E", boxShadow: "inset 0 0 0 4px #6B4520" })} />
      <div style={abs({ left: 3182, bottom: 270, width: 256, height: 16, borderRadius: 4, border: "2px solid #6B4520", background: "linear-gradient(180deg,#B07B44,#96622F)", boxSizing: "border-box" })} />
      <div style={abs({ left: 3182, bottom: 286, width: 0, height: 0, borderLeft: "128px solid transparent", borderRight: "128px solid transparent", borderBottom: "54px solid #D9B37C" })} />
      <div style={abs({ left: 3194, bottom: 286, width: 0, height: 0, borderLeft: "116px solid transparent", borderRight: "116px solid transparent", borderBottom: "48px solid #C9A15B" })} />
      <div style={abs({ left: 3296, bottom: 296, width: 28, height: 28, borderRadius: "50%", background: "radial-gradient(circle at 40% 35%, #FFFDF6, #D9CCA8)", border: "2.5px solid #6B4520", boxSizing: "border-box" })} />
      <div className="by-scene-note" style={abs({ left: 3248, bottom: 352, padding: "4px 16px 5px", fontSize: 15, lineHeight: 1.2, whiteSpace: "nowrap" })}>
        {T.bk.decor.museum}
      </div>

      {/* ── 交易市场（集市摊位：柜台 + 条纹遮阳棚 + 货箱）·图鉴馆右侧（留出更宽间距，避免弹板互相遮挡） ── */}
      <div style={abs({ left: 3902, bottom: 150, width: 8, height: 128, borderRadius: 4, background: "#6B4520" })} />
      <div style={abs({ left: 4150, bottom: 150, width: 8, height: 128, borderRadius: 4, background: "#6B4520" })} />
      <div style={abs({ left: 3910, bottom: 150, width: 240, height: 48, borderRadius: 6, border: "3px solid #6B4520", background: "repeating-linear-gradient(92deg, rgba(59,32,10,0.12) 0 2px, transparent 2px 30px), linear-gradient(180deg,#C08A4E,#A06A33)", boxSizing: "border-box" })} />
      <div style={abs({ left: 3926, bottom: 198, width: 40, height: 30, borderRadius: 4, border: "2px solid #6B4520", background: "repeating-linear-gradient(0deg, rgba(59,32,10,0.25) 0 4px, transparent 4px 10px), #C9A15B", boxSizing: "border-box" })} />
      <div style={abs({ left: 3974, bottom: 198, width: 32, height: 24, borderRadius: 4, border: "2px solid #6B4520", background: "#D9B37C", boxSizing: "border-box" })} />
      <div style={abs({ left: 4092, bottom: 198, width: 34, height: 26, borderRadius: "50%", background: "radial-gradient(circle at 38% 32%, #D9B37C, #B98A4E 78%)", border: "2px solid #6B4520", boxSizing: "border-box" })}>
        <span style={abs({ left: "50%", top: "50%", transform: "translate(-50%,-50%)", fontSize: 13 })}>🪙</span>
      </div>
      <div style={abs({ left: 3886, bottom: 268, width: 288, height: 42, borderRadius: "12px 12px 0 0", border: "3px solid #6B4520", background: "repeating-linear-gradient(90deg,#57964B 0 30px,#FFF3D9 30px 60px)", boxSizing: "border-box", boxShadow: "0 8px 12px rgba(43,26,8,0.22)" })} />
      <div className="by-scene-note" style={abs({ left: 3946, bottom: 318, padding: "4px 16px 5px", fontSize: 15, lineHeight: 1.2, whiteSpace: "nowrap" })}>
        {T.bk.decor.market}
      </div>

      {/* ── 公告板 → 图鉴馆 之间的小树丛（填补功能区簇内的空档，避免过空） ── */}
      <Bush left={2716} w={104} h={56} color="#7EAD79" />
      <RoundTree left={2772} tone="#7CBE5F" />
      <Flower left={2952} color="#E2432E" />
      <Bush left={2980} w={92} h={60} color="#7CBE5F" />
      <Flower left={3092} color="#F5917B" />

      {/* ── 路灯（沿路四盏，入夜由 BackyardNightLights 在同 X 点亮） ── */}
      {LAMP_POSTS.map((x) => (
        <LampPost key={`lamp${x}`} x={x} />
      ))}

      {/* ── 蘑菇簇（林间/树根/果园） ── */}
      <Mushroom left={-860} cap="#D9553F" />
      <Mushroom left={-844} bottom={150} cap="#E8843B" s={0.8} />
      <Mushroom left={-406} cap="#C74631" s={1.1} />
      <Mushroom left={2764} cap="#C74631" />
      <Mushroom left={4246} cap="#D9553F" />
      <Mushroom left={4264} bottom={150} cap="#E8843B" s={0.8} />
      <Mushroom left={6556} cap="#D9553F" s={1.1} />

      {/* ── 补花（草地空档，前景更繁茂） ── */}
      <Flower left={360} color="#F5D95A" />
      <Flower left={432} color="#F5917B" />
      <Flower left={2705} color="#F5D95A" />
      <Flower left={3560} color="#E2432E" />
      <Flower left={3690} color="#F5917B" />
      <Flower left={5030} color="#F5D95A" />
      <Flower left={5470} color="#E2432E" />

      {/* ── 商店门前彩灯串·灯线（两柱间垂挂；暖色小灯泡另见 NearLights，不调色保暖亮） ── */}
      <div style={abs({ left: 1028, bottom: 268, width: 262, height: 3, borderRadius: 2, background: "#5a4632", transform: "rotate(0.5deg)" })} />
    </>
  );
});

/**
 * Functional location labels render above the day/night scenery grade so the
 * UI labels remain readable and semantically consistent at night.
 */
export const NearUiNotes = memo(function NearUiNotes() {
  const { T } = useT();
  return (
    <div className="by-scene-notes" aria-hidden="true">
      <div className="by-scene-note" style={abs({ left: -784, bottom: 198, padding: "3px 12px 4px", fontSize: 13, whiteSpace: "nowrap", transform: "rotate(-2deg)" })}>
        {T.bk.decor.glade}
      </div>
      <div className="by-scene-note" style={abs({ left: -472, bottom: 338, padding: "4px 16px 5px", fontSize: 16, whiteSpace: "nowrap", zIndex: 1 })}>
        {T.bk.decor.trainingHall}
      </div>
      <div className="by-scene-note" style={abs({ left: 58, bottom: 226, padding: "4px 14px 5px", fontSize: 14, transform: "rotate(-2deg)", whiteSpace: "nowrap" })}>
        {T.bk.decor.hatchery}
      </div>
      <div className="by-scene-note" style={abs({ left: 1104, bottom: 306, padding: "4px 18px 5px", fontSize: 17, whiteSpace: "nowrap" })}>
        {T.bk.decor.shop}
      </div>
      <div className="by-scene-note" style={abs({ left: 2353, bottom: 436, padding: "5px 18px 6px", fontSize: 16, lineHeight: 1.2, whiteSpace: "nowrap", zIndex: 1 })}>
        {T.bk.decor.board}
      </div>
      <div className="by-scene-note" style={abs({ left: 3248, bottom: 352, padding: "4px 16px 5px", fontSize: 15, lineHeight: 1.2, whiteSpace: "nowrap" })}>
        {T.bk.decor.museum}
      </div>
      <div className="by-scene-note" style={abs({ left: 3946, bottom: 318, padding: "4px 16px 5px", fontSize: 15, lineHeight: 1.2, whiteSpace: "nowrap" })}>
        {T.bk.decor.market}
      </div>
      <div className="by-scene-note" style={abs({ left: 6146, bottom: 198, padding: "3px 12px 4px", fontSize: 13, whiteSpace: "nowrap", transform: "rotate(-2deg)" })}>
        {T.bk.decor.wilds}
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// 近景「发光体」层（世界锚定，随相机平移，**不受实景昼夜调色 filter**）。
// 把本该自发光的物件——路灯灯罩玻璃、营地篝火、营地挂灯、商店彩灯泡——从随昼夜
// 变暗的 NearDecor 里拎出来单独渲染：黄昏/入夜时实景整体压暗、偏蓝/偏橙，而这些
// 灯火保持原本的暖亮，自然成为变暗画面里的「亮点」点缀（承托它们的木柱/柴堆/帐篷/
// 灯线仍在 NearDecor 内随昼夜调色，光才落在正确的暗环境里）。入夜后再由
// BackyardNightLights 在同位叠加柔和光晕强化，日间该组件不挂载。
// ---------------------------------------------------------------------------
export const NearLights = memo(function NearLights() {
  return (
    <>
      {/* 路灯灯罩玻璃（与 NearDecor 的灯柱同 x 对齐） */}
      {LAMP_POSTS.map((x) => (
        <LampGlass key={`lampglass${x}`} x={x} />
      ))}

      {/* ── 营地篝火：地面火光 + 三层跳动火舌 ── */}
      <div style={abs({ left: 5190, bottom: 128, width: 200, height: 100, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(255,176,58,0.4) 0%, rgba(255,176,58,0) 70%)", animation: "gg-glow 2.4s ease-in-out infinite" })} />
      <div style={abs({ left: 5266, bottom: 164, width: 32, height: 42, borderRadius: "50% 50% 50% 50% / 64% 64% 36% 36%", background: "#E85D3A", animation: "gg-flame 0.8s ease-in-out infinite" })} />
      <div style={abs({ left: 5272, bottom: 168, width: 20, height: 30, borderRadius: "50% 50% 50% 50% / 64% 64% 36% 36%", background: "#FFB03A", animation: "gg-flame 0.62s ease-in-out 0.1s infinite" })} />
      <div style={abs({ left: 5277, bottom: 172, width: 11, height: 18, borderRadius: "50% 50% 50% 50% / 64% 64% 36% 36%", background: "#FFF1C9", animation: "gg-flame 0.5s ease-in-out 0.2s infinite" })} />

      {/* ── 营地挂灯（暖光灯笼） ── */}
      <div style={abs({ left: 5598, bottom: 246, width: 24, height: 32, borderRadius: 7, border: "2px solid #6B4520", background: "linear-gradient(180deg,#FFD98A,#FFB03A)", boxShadow: "0 0 16px 6px rgba(255,176,58,0.5)", animation: "gg-glow 3s ease-in-out infinite", boxSizing: "border-box" })} />

      {/* ── 商店门前彩灯泡（暖色/粉/绿，与夜间暖光呼应；灯线在 NearDecor 内） ── */}
      {[1052, 1086, 1120, 1154, 1188, 1222, 1256].map((x, index) => (
        <span
          key={`bulb${x}`}
          style={abs({
            left: x,
            bottom: 259,
            width: 7,
            height: 8,
            borderRadius: "50% 50% 55% 55%",
            background: ["#FFD98A", "#F5917B", "#8ED07A"][index % 3],
            boxShadow: `0 0 5px 1px ${["rgba(255,217,138,0.9)", "rgba(245,145,123,0.85)", "rgba(142,208,122,0.8)"][index % 3]}`,
          })}
        />
      ))}
    </>
  );
});
