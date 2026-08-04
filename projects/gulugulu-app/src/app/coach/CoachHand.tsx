// 自绘矢量小手：握拳 + 竖起食指的「☝」造型（袖口 + 拳 + 拇指 + 蜷指关节）。
// 整只放在目标下方、指尖点向目标；tap/连点差异走 CSS 动画。描边同物种美术 #3B2B1D。
export function CoachHand() {
  return (
    <svg width="46" height="62" viewBox="0 0 46 62" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g stroke="#3B2B1D" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round">
        {/* 袖口/手腕 */}
        <rect x="13" y="49" width="21" height="12" rx="4.5" fill="#7FB8D8" />
        {/* 手掌（握起的拳） */}
        <rect x="12" y="26" width="24" height="26" rx="11" fill="#FBD0A0" />
        {/* 拇指（贴拳左侧，微向上翘） */}
        <path d="M12 33 q-6.5 0.5 -7 6.5 q-0.3 4 3.4 5.6 l4 -1.4 q0.8 -5.4 -0.4 -10.7 z" fill="#FBD0A0" />
        {/* 竖起的食指（从拳顶伸出，最显眼） */}
        <rect x="16.5" y="4" width="11" height="26" rx="5.5" fill="#FEDDB4" />
        {/* 中/无名/小指的蜷缩关节（拳顶右侧三道弧） */}
        <path
          d="M28 28 q4 0.6 5 4.6 M31.6 26.8 q3.6 1 4 5.2 M35 30.4 q1.6 2 1.6 5"
          strokeWidth="1.4"
          opacity="0.55"
          fill="none"
        />
        {/* 食指与拳的指根线 */}
        <path d="M16.6 27 q5.4 -3.6 10.9 0" strokeWidth="1.4" opacity="0.5" fill="none" />
      </g>
    </svg>
  );
}
