// 离线渲染 41 枚 Steam 成就图标（解锁彩色 + 未解锁灰锁两态，256×256 PNG）。
// 无字体依赖：全部矢量字形。**同系列的更高档成就用更华丽的 emblem 表现**（放射光芒 /
// 宝石环 / 桂冠 / 王冠 / 更丰富的场景），而非叠点数。风格沿用精灵描边 #3B2B1D + 平涂 + 圆角。
// 跑法（projects/gulugulu-app 下）：
//   npm install --no-save @resvg/resvg-js   # 一次性
//   node scripts/render_achievement_icons.mjs
// 产物 → <repo>/assets/steam-achievements/<ID>.png、<ID>_locked.png、_contact_sheet.png
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const OUT = "#3B2B1D";
const S = 256;
const scriptDir = dirname(fileURLToPath(import.meta.url));
const outDir = join(scriptDir, "..", "..", "..", "assets", "steam-achievements");
mkdirSync(outDir, { recursive: true });

const EL = { normal: "#6E6E78", fire: "#E85D3A", electric: "#FFD93B", water: "#2E7BD6", grass: "#57B84C", ice: "#8FD8E8" };
// 品阶光圈色（FusionSystem §2.3）：t3 青碧 / t4 湛蓝 / t5 绛紫 / t6 鎏金。
const TIER_COL = { 3: "#6FD3A6", 4: "#5AA9F0", 5: "#B07DE8", 6: "#F5C542" };
const CAT = {
  A: ["#7BD07A", "#3E8E3A"], B: ["#5A9BEA", "#1E5AA8"], C: ["#9B7BE0", "#5B3EA0"],
  D: ["#3FC7B4", "#1E8E80"], E: ["#7C86EE", "#4048B8"], F: ["#F4B857", "#D2892A"],
  G: ["#F0C64A", "#C79320"], H: ["#EE7BB0", "#C43F82"], I: ["#4B4A7E", "#2A294B"],
};

// —— 基础绘制 ——
const P = (d, fill, sw = 4) => `<path d="${d}" fill="${fill}" stroke="${OUT}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>`;
const C_ = (cx, cy, r, fill, sw = 4) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${OUT}" stroke-width="${sw}"/>`;
const RECT = (x, y, w, h, r, fill, sw = 4) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${OUT}" stroke-width="${sw}"/>`;
const starPath = (cx, cy, R, r, fill, sw = 4) => {
  let d = "";
  for (let i = 0; i < 10; i++) { const rad = (Math.PI / 5) * i - Math.PI / 2, rr = i % 2 ? r : R; d += (i ? "L" : "M") + (cx + rr * Math.cos(rad)).toFixed(1) + " " + (cy + rr * Math.sin(rad)).toFixed(1) + " "; }
  return P(d + "Z", fill, sw);
};

// —— 华丽度装饰（越高档叠越多，画在 emblem 之后/之前）——
const glow = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" opacity="0.16"/>`;
const rays = (cx, cy, n, ri, ro, color) => {
  let s = "";
  for (let i = 0; i < n; i++) { const a = (2 * Math.PI / n) * i - Math.PI / 2, a1 = a - 0.05, a2 = a + 0.05;
    s += `<path d="M${(cx + ri * Math.cos(a1)).toFixed(1)} ${(cy + ri * Math.sin(a1)).toFixed(1)} L${(cx + ro * Math.cos(a)).toFixed(1)} ${(cy + ro * Math.sin(a)).toFixed(1)} L${(cx + ri * Math.cos(a2)).toFixed(1)} ${(cy + ri * Math.sin(a2)).toFixed(1)} Z" fill="${color}"/>`; }
  return s;
};
const gem = (x, y, s, fill) => P(`M${x} ${y - s} L${x + s} ${y} L${x} ${y + s} L${x - s} ${y} Z`, fill, 2.2);
const gemRing = (cx, cy, R, fill, n = 8) => { let s = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${OUT}" stroke-width="3"/>`; for (let i = 0; i < n; i++) { const a = (2 * Math.PI / n) * i - Math.PI / 2; s += gem(cx + R * Math.cos(a), cy + R * Math.sin(a), 4, fill); } return s; };
const crown = (cx, cy, fill) => P(`M${cx - 18} ${cy + 9} L${cx - 18} ${cy - 8} L${cx - 9} ${cy + 1} L${cx} ${cy - 12} L${cx + 9} ${cy + 1} L${cx + 18} ${cy - 8} L${cx + 18} ${cy + 9} Z`, fill) + C_(cx - 18, cy - 8, 2.6, fill, 1.5) + C_(cx, cy - 12, 2.6, fill, 1.5) + C_(cx + 18, cy - 8, 2.6, fill, 1.5);
const wings = (cx, cy, fill) => P(`M${cx - 18} ${cy} C${cx - 40} ${cy - 10} ${cx - 44} ${cy + 6} ${cx - 22} ${cy + 11} C${cx - 33} ${cy + 3} ${cx - 30} ${cy - 3} ${cx - 18} ${cy} Z`, fill, 2.5) + P(`M${cx + 18} ${cy} C${cx + 40} ${cy - 10} ${cx + 44} ${cy + 6} ${cx + 22} ${cy + 11} C${cx + 33} ${cy + 3} ${cx + 30} ${cy - 3} ${cx + 18} ${cy} Z`, fill, 2.5);
// 桂冠（底部对称 U，两侧各若干叶）。
const laurel = (fill) => {
  let s = `<path d="M22 46 Q26 80 50 86 Q74 80 78 46" fill="none" stroke="${OUT}" stroke-width="3"/>`;
  const L = [[24, 54, -55], [27, 65, -38], [34, 74, -18], [44, 81, 4], [56, 81, -4], [66, 74, 18], [73, 65, 38], [76, 54, 55]];
  for (const [x, y, r] of L) s += `<g transform="translate(${x} ${y}) rotate(${r})"><ellipse cx="0" cy="0" rx="8" ry="3.6" fill="${fill}" stroke="${OUT}" stroke-width="2"/></g>`;
  return s;
};
const ribbonTails = (cx, cy, fill) => P(`M${cx - 13} ${cy} L${cx - 19} ${cy + 26} L${cx - 7} ${cy + 18} L${cx} ${cy + 28} L${cx + 7} ${cy + 18} L${cx + 19} ${cy + 26} L${cx + 13} ${cy} Z`, fill, 3);

// —— 单体字形（无系列，保持原设计）——
const onigiri = (cx, cy, s, f = "#fff") => P(`M${cx} ${cy - s} Q${cx + 0.2 * s} ${cy - s} ${cx + 0.92 * s} ${cy + 0.7 * s} Q${cx + s} ${cy + 0.95 * s} ${cx + 0.6 * s} ${cy + 0.95 * s} L${cx - 0.6 * s} ${cy + 0.95 * s} Q${cx - s} ${cy + 0.95 * s} ${cx - 0.92 * s} ${cy + 0.7 * s} Q${cx - 0.2 * s} ${cy - s} ${cx} ${cy - s} Z`, f) + RECT(cx - 0.4 * s, cy + 0.14 * s, 0.8 * s, 0.6 * s, 3, "#454552", 3);

const GLYPH = {
  egg: (f) => P("M50 12 C70 12 80 45 80 62 A30 30 0 0 1 20 62 C20 45 30 12 50 12 Z", f),
  star: (f) => starPath(50, 48, 40, 17, f),
  ring6: (f) => { let s = C_(50, 48, 12, f); [EL.normal, EL.fire, EL.electric, EL.water, EL.grass, EL.ice].forEach((c, i) => { const a = (Math.PI / 3) * i - Math.PI / 2; s += C_(50 + 33 * Math.cos(a), 48 + 33 * Math.sin(a), 8.5, c, 3); }); return s; },
  penta: (f) => { let d = ""; for (let i = 0; i < 5; i++) { const a = (2 * Math.PI / 5) * i - Math.PI / 2; d += (i ? "L" : "M") + (50 + 36 * Math.cos(a)).toFixed(1) + " " + (48 + 36 * Math.sin(a)).toFixed(1) + " "; } return P(d + "Z", f); },
  prism: () => P("M50 12 L82 48 L50 84 L18 48 Z", "#fff") + P("M50 12 L82 48 L50 48 Z", "#F5A3C7", 0) + P("M50 12 L18 48 L50 48 Z", "#9AD0F0", 0) + P("M50 84 L82 48 L50 48 Z", "#F5C542", 0) + P("M50 84 L18 48 L50 48 Z", "#9EE6B8", 0) + `<path d="M50 12 L82 48 L50 84 L18 48 Z M50 12 V84 M18 48 H82" fill="none" stroke="${OUT}" stroke-width="3.5"/>`,
  chip: (f) => RECT(26, 24, 48, 48, 8, f) + RECT(38, 36, 24, 24, 4, "#fff", 3) + [30, 45, 60].map((y) => `<rect x="14" y="${y - 3}" width="12" height="6" rx="2" fill="${f}" stroke="${OUT}" stroke-width="2.5"/><rect x="74" y="${y - 3}" width="12" height="6" rx="2" fill="${f}" stroke="${OUT}" stroke-width="2.5"/>`).join("") + [30, 45, 60].map((x) => `<rect x="${x - 3}" y="14" width="6" height="12" rx="2" fill="${f}" stroke="${OUT}" stroke-width="2.5"/><rect x="${x - 3}" y="74" width="6" height="12" rx="2" fill="${f}" stroke="${OUT}" stroke-width="2.5"/>`).join(""),
  ladder: (f) => [[30, 62, 20], [30, 48, 34], [30, 34, 48]].map(([x, y, w]) => RECT(x, y, w, 12, 3, f)).join("") + starPath(72, 30, 10, 4, "#FFF3B0", 2),
  keycap: (f) => RECT(24, 26, 52, 48, 10, "#fff") + RECT(32, 32, 36, 30, 6, f) + `<path d="M42 52 L58 52 M50 40 L50 52" stroke="${OUT}" stroke-width="4" stroke-linecap="round"/>`,
  coin: (f) => C_(50, 48, 34, f) + C_(50, 48, 25, "#fff", 3) + starPath(50, 48, 14, 6, f, 2.5),
  treasure: (f) => rays(50, 52, 10, 30, 44, "#FFE9A8") + C_(36, 42, 19, f) + C_(60, 38, 16, "#FFE07A") + C_(50, 58, 22, f) + starPath(50, 58, 11, 4.5, "#fff", 2),
  incubator: (f) => RECT(20, 30, 60, 52, 12, f) + P("M50 40 C62 40 68 58 68 66 A18 18 0 0 1 32 66 C32 58 38 40 50 40 Z", "#fff"),
  fence: (f) => [24, 42, 60].map((x) => P(`M${x} 40 L${x + 6} 34 L${x + 12} 40 V80 H${x} Z`, f)).join("") + `<path d="M20 52 H78 M20 66 H78" stroke="${OUT}" stroke-width="4"/>`,
  shop: (f) => RECT(24, 46, 52, 34, 6, "#fff") + P("M18 30 H82 L74 48 H26 Z", f) + [26, 40, 54, 68].map((x) => `<path d="M${x} 32 V47" stroke="${OUT}" stroke-width="2.5"/>`).join("") + RECT(44, 60, 14, 20, 2, f),
  house: (f) => P("M50 18 L84 48 H74 V80 H26 V48 H16 Z", f) + RECT(42, 56, 16, 24, 2, "#fff"),
  hanger: (f) => `<path d="M50 26 A7 7 0 1 1 57 33 C57 40 50 40 50 46 M20 68 L50 46 L80 68" fill="none" stroke="${OUT}" stroke-width="5" stroke-linecap="round"/>` + P("M18 66 H82 L78 78 H22 Z", f),
  wear: (f) => P("M34 28 L44 24 C48 30 52 30 56 24 L66 28 L74 42 L64 48 V78 H36 V48 L26 42 Z", f),
  wardrobe: (f) => RECT(24, 20, 52, 62, 8, f) + `<path d="M50 20 V82" stroke="${OUT}" stroke-width="3.5"/>` + C_(42, 50, 3.5, "#fff", 2) + C_(58, 50, 3.5, "#fff", 2),
  owl: (f) => P("M28 30 L24 16 L38 26 M72 30 L76 16 L62 26", f, 3) + P("M50 24 C74 24 78 50 78 62 A28 28 0 0 1 22 62 C22 50 26 24 50 24 Z", f) + C_(40, 50, 11, "#fff") + C_(60, 50, 11, "#fff") + C_(40, 50, 4.5, OUT, 0) + C_(60, 50, 4.5, OUT, 0) + P("M46 62 L50 68 L54 62 Z", "#FFD93B", 2),
  farewell: (f) => P("M40 78 V46 C40 42 46 42 46 46 V40 C46 36 52 36 52 40 V42 C52 38 58 38 58 42 V44 C58 40 64 40 64 44 V64 C64 74 58 80 50 80 Z", f) + starPath(70, 26, 9, 4, "#FFF3B0", 2) + starPath(30, 30, 7, 3, "#FFF3B0", 2),
  heart: (f) => P("M50 80 C20 58 20 34 34 28 C44 24 50 34 50 38 C50 34 56 24 66 28 C80 34 80 58 50 80 Z", f),

  // —— 系列字形：华丽度随档位递增 ——
  // 图鉴：小册 → 书+书签星 → 光芒书+双宝石 → 桂冠王冠辉光大典（B 蓝）。
  book: (f, lv) => {
    const book = P("M50 30 C40 23 24 23 16 28 V78 C24 73 40 73 50 80 C60 73 76 73 84 78 V28 C76 23 60 23 50 30 Z", f) + `<path d="M50 32 V80" stroke="${OUT}" stroke-width="3.5"/>`;
    if (lv === 1) return book;
    if (lv === 2) return book + P("M60 22 H72 V42 L66 36 L60 42 Z", "#E85D3A") + starPath(76, 24, 7, 3, "#FFD93B", 2);
    if (lv === 3) return glow(50, 54, 32) + rays(50, 54, 12, 22, 44, "#FFE9A8") + book + gem(20, 66, 5, "#F5A3C7") + gem(80, 66, 5, "#9AD0F0") + starPath(50, 20, 9, 4, "#FFD93B", 2.5);
    return glow(50, 54, 40) + rays(50, 54, 16, 20, 50, "#FFE9A8") + laurel("#7FD08A") + book + crown(50, 18, "#F5C542") + gem(20, 62, 5, "#F5A3C7") + gem(80, 62, 5, "#9AD0F0");
  },
  // 品阶：环+星 → +双翼 → 宝石环+光芒 → 王冠+巨星+满放射+宝石环（鎏金巅峰）。
  tier: (col, t) => {
    if (t === 3) return C_(50, 48, 32, col) + C_(50, 48, 21, "#fff", 3) + starPath(50, 48, 13, 5.5, col, 2.5);
    if (t === 4) return wings(50, 50, col) + C_(50, 46, 30, col) + C_(50, 46, 20, "#fff", 3) + starPath(50, 46, 13, 5.5, col, 2.5);
    if (t === 5) return glow(50, 48, 34) + rays(50, 48, 12, 26, 46, col) + gemRing(50, 48, 34, col, 8) + C_(50, 48, 22, "#fff", 3) + starPath(50, 48, 15, 6.5, col, 2.5);
    return glow(50, 50, 42) + rays(50, 50, 18, 22, 52, "#FFE9A8") + wings(50, 56, col) + gemRing(50, 48, 33, col, 10) + C_(50, 48, 22, "#fff", 3) + starPath(50, 48, 17, 7, col, 2.5) + crown(50, 20, col);
  },
  // 融合：并球+火花 → +菱核细环 → +核星轨道宝石 → 曼陀罗（放射+宝石环+轨道球+爆核星）。
  fusion: (f, lv) => {
    const pair = C_(38, 50, 20, f) + C_(62, 50, 20, f);
    if (lv === 0) return pair + starPath(50, 50, 11, 4.5, "#FFF3B0", 2.5);
    if (lv === 1) return `<circle cx="50" cy="50" r="40" fill="none" stroke="${OUT}" stroke-width="2.5"/>` + pair + gem(50, 50, 10, "#FFF3B0");
    if (lv === 2) return glow(50, 50, 34) + `<circle cx="50" cy="50" r="40" fill="none" stroke="${OUT}" stroke-width="2.5"/>` + pair + starPath(50, 50, 13, 5.5, "#FFF3B0", 2.5) + [0, 120, 240].map((d) => { const a = d * Math.PI / 180; return gem(50 + 40 * Math.cos(a), 50 + 40 * Math.sin(a), 5, "#FFE07A"); }).join("");
    return glow(50, 50, 42) + rays(50, 50, 16, 24, 52, "#FFE9A8") + gemRing(50, 50, 38, "#FFE07A", 8) + pair + starPath(50, 50, 16, 6.5, "#fff", 2.5) + [30, 150, 270].map((d) => { const a = d * Math.PI / 180; return C_(50 + 27 * Math.cos(a), 50 + 27 * Math.sin(a), 7, "#FFF3B0", 2.5); }).join("");
  },
  // AI 收藏：三方块簇 → 展柜（画框 + 2×3 变种格 + 星徽 + 角宝石 + 辉光）。
  aicollect: (f, lv) => {
    if (lv === 1) return RECT(20, 40, 24, 24, 5, f) + RECT(56, 40, 24, 24, 5, f) + RECT(38, 22, 24, 24, 5, "#fff");
    return glow(50, 52, 34) + RECT(16, 24, 68, 56, 8, f) + [24, 42, 60].flatMap((x) => [34, 56].map((y) => RECT(x, y, 16, 16, 3, "#fff", 2.5))).join("") + starPath(50, 20, 8, 3.5, "#FFD93B", 2) + gem(16, 24, 4, "#FFE07A") + gem(84, 24, 4, "#FFE07A");
  },
  // 发布：托盘+上箭头 → 玫瑰绶带奖章（放射 + 宝石环章 + 飘带 + 分享箭头）。
  publish: (f, lv) => {
    if (lv === 1) return RECT(24, 60, 52, 20, 5, "#fff") + P("M50 20 L68 44 H57 V60 H43 V44 H32 Z", f);
    return rays(50, 44, 14, 20, 40, "#FFE9A8") + ribbonTails(50, 56, f) + gemRing(50, 42, 26, "#FFE07A", 8) + C_(50, 42, 19, "#fff", 3) + P("M50 30 L61 46 H54 V56 H46 V46 H39 Z", f);
  },
  // 连登：日历+勾 → 月度奖章（放射 + 满月 + 宝石环 + 飘带）。
  streak: (f, lv) => {
    if (lv === 1) return RECT(20, 26, 60, 56, 8, "#fff") + P("M20 26 H80 V42 H20 Z", f) + `<path d="M34 20 V32 M66 20 V32" stroke="${OUT}" stroke-width="5" stroke-linecap="round"/>` + `<path d="M36 60 L46 70 L64 50" fill="none" stroke="${f}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`;
    return rays(50, 44, 14, 22, 42, "#FFE9A8") + ribbonTails(50, 58, f) + gemRing(50, 42, 28, "#FFE07A", 10) + C_(50, 42, 20, "#FFF3C4") + P("M58 30 A20 20 0 1 0 58 54 A16 16 0 0 1 58 30 Z", "#FFFBEA", 2.5);
  },
  // 喂养 Token：饭团 → 双饭团+筷子 → 盛宴大盘（放射 + 盘 + 主副菜 + 星）。
  tokens: (f, lv) => {
    if (lv === 1) return onigiri(50, 48, 30);
    if (lv === 2) return onigiri(42, 54, 24) + onigiri(66, 42, 16) + `<path d="M74 28 L58 62 M80 32 L64 66" stroke="#C08A3E" stroke-width="4" stroke-linecap="round"/>`;
    return rays(50, 48, 12, 30, 48, "#FFE9A8") + `<ellipse cx="50" cy="70" rx="38" ry="11" fill="#EDEDF2" stroke="${OUT}" stroke-width="3"/>` + onigiri(50, 50, 22) + C_(26, 62, 9, "#F5B0C0") + C_(74, 62, 9, "#9EE6B8") + starPath(50, 22, 8, 3.5, "#FFD93B", 2);
  },
};

// —— 41 枚成就 → (分组, 字形, 档位) ——
const A = [
  ["ACH_FIRST_HATCH", "A", "egg"], ["ACH_FIRST_MAXLEVEL", "A", "star"], ["ACH_FIRST_FUSION", "A", "fusion", 0],
  ["ACH_DEX_10", "B", "book", 1], ["ACH_DEX_25", "B", "book", 2], ["ACH_DEX_45", "B", "book", 3], ["ACH_DEX_ALL63", "B", "book", 4],
  ["ACH_ALL_ELEMENTS", "B", "ring6"], ["ACH_FIRST_PENTA", "B", "penta"], ["ACH_FLAGSHIP_KIRIN", "B", "prism"],
  ["ACH_TIER3", "C", "tier", 3], ["ACH_TIER4", "C", "tier", 4], ["ACH_TIER5", "C", "tier", 5], ["ACH_TIER6_APEX", "C", "tier", 6],
  ["ACH_FUSE_10", "D", "fusion", 1], ["ACH_FUSE_50", "D", "fusion", 2], ["ACH_FUSE_200", "D", "fusion", 3],
  ["ACH_AI_FIRST", "E", "chip"], ["ACH_AI_COLLECT_5", "E", "aicollect", 1], ["ACH_AI_COLLECT_20", "E", "aicollect", 2], ["ACH_AI_LADDER_5", "E", "ladder"],
  ["ACH_TOKENS_1M", "F", "tokens", 1], ["ACH_TOKENS_50M", "F", "tokens", 2], ["ACH_TOKENS_1B", "F", "tokens", 3], ["ACH_KEYS_100K", "F", "keycap"],
  ["ACH_COINS_1M", "G", "coin"], ["ACH_HATCHERY_MAX", "G", "incubator"], ["ACH_YARD_MAX", "G", "fence"], ["ACH_SHOP_MAX", "G", "shop"], ["ACH_FULL_HOUSE", "G", "house"],
  ["ACH_WORKSHOP_IMPORT", "H", "hanger"], ["ACH_WORKSHOP_WEAR", "H", "wear"], ["ACH_WORKSHOP_PUBLISH", "H", "publish", 1], ["ACH_WORKSHOP_PUBLISH_5", "H", "publish", 2], ["ACH_WORKSHOP_COLLECT_5", "H", "wardrobe"],
  ["ACH_STREAK_7", "I", "streak", 1], ["ACH_STREAK_30", "I", "streak", 2], ["ACH_NIGHT_OWL", "I", "owl"], ["ACH_FAREWELL", "I", "farewell"], ["ACH_LOVED", "I", "heart"], ["ACH_TREASURY", "I", "treasure"],
];

function glyphMarkup(a, locked) {
  const [, , g, arg] = a;
  const f = locked ? "#cfcfd6" : "#ffffff";
  if (g === "tier") return GLYPH.tier(locked ? "#b9b9c2" : TIER_COL[arg], arg);
  return GLYPH[g](f, arg);
}

const lockBadge = () => C_(210, 210, 30, "#2A2A33", 5) + RECT(198, 204, 24, 20, 4, "#E8E8EE", 3) + `<path d="M203 204 V198 A7 7 0 0 1 217 198 V204" fill="none" stroke="#E8E8EE" stroke-width="4"/>`;

function iconSvg(a, locked) {
  const [c0, c1] = locked ? ["#7A7A82", "#42424B"] : CAT[a[1]];
  const uid = a[0] + (locked ? "_L" : "");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs><linearGradient id="bg_${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c0}"/><stop offset="1" stop-color="${c1}"/></linearGradient>
  <radialGradient id="sh_${uid}" cx="0.5" cy="0.32" r="0.7"><stop offset="0" stop-color="#fff" stop-opacity="0.28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
  <rect x="10" y="10" width="236" height="236" rx="50" fill="url(#bg_${uid})" stroke="${OUT}" stroke-width="7"/>
  <rect x="10" y="10" width="236" height="236" rx="50" fill="url(#sh_${uid})"/>
  <g transform="translate(48 48) scale(1.6)" ${locked ? 'opacity="0.9"' : ""}>${glyphMarkup(a, locked)}</g>
  ${locked ? lockBadge() : ""}
</svg>`;
}

const png = (svg) => new Resvg(svg, { fitTo: { mode: "width", value: S } }).render().asPng();

let count = 0;
for (const a of A) {
  writeFileSync(join(outDir, `${a[0]}.png`), png(iconSvg(a, false)));
  writeFileSync(join(outDir, `${a[0]}_locked.png`), png(iconSvg(a, true)));
  count += 2;
}

// 接触表（QA）：前 41 解锁 + 后 8 未解锁样例。
const COLS = 8, CELL = 96, PAD = 6;
const items = [...A.map((a) => [a, false]), ...A.slice(0, 8).map((a) => [a, true])];
const rows = Math.ceil(items.length / COLS);
let cells = "";
items.forEach(([a, lk], i) => {
  const cx = (i % COLS) * CELL + PAD, cy = Math.floor(i / COLS) * CELL + PAD;
  cells += `<g transform="translate(${cx} ${cy}) scale(${(CELL - 2 * PAD) / S})">${iconSvg(a, lk).replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "")}</g>`;
});
writeFileSync(join(outDir, "_contact_sheet.png"), new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${COLS * CELL}" height="${rows * CELL}" viewBox="0 0 ${COLS * CELL} ${rows * CELL}"><rect width="100%" height="100%" fill="#1b1b22"/>${cells}</svg>`, { fitTo: { mode: "width", value: COLS * CELL } }).render().asPng());

console.log(`✓ rendered ${count} icons (${A.length} achieved + ${A.length} locked) + contact sheet → ${outDir}`);
