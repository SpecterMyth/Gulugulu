// 宣传片共用件:记忆化精灵、字幕层、打字机、标题卡、黑客过场、仿桌面,以及从真实
// 目录派生的物种名单助手。生物一律走真实 SvgSprite(config 目录驱动),画面即游戏。
import { memo, type CSSProperties, type ReactNode } from "react";
import { SvgSprite } from "../sprites/SvgSprite";
import { localGameConfig } from "../game/config";
import { speciesDisplayName, elementName } from "../i18n/species";
import type { PetState } from "../types";
import { CPS, TITLE_CPS, trLang, type Seg } from "./lang";
import { COPY } from "./copy";

export const CFG = localGameConfig;
/** 本次播放语言(?lang=zh = 全中文版)。模块级读取:URL 不会中途改变。 */
export const LANG = trLang();
const C = COPY[LANG];

// ---- 物种名单(全部从真实 config 派生,绝不硬编码不存在的 codename)----

export function allSpecies(): string[] {
  return Object.keys(CFG.species);
}
export function starters(): string[] {
  return allSpecies().filter((k) => CFG.species[k].tier === 1);
}
/** 63 只 canon:跳过 21 只 legacy 二阶副本(tier===2)。 */
export function canonRoster(): string[] {
  return allSpecies()
    .filter((k) => (CFG.species[k].tier ?? 0) !== 2)
    .sort((a, b) => {
      const ea = CFG.species[a].elements?.length ?? 1;
      const eb = CFG.species[b].elements?.length ?? 1;
      return ea - eb || a.localeCompare(b);
    });
}
export function flagship(): string {
  let best = "guluduck";
  let n = 0;
  for (const k of allSpecies()) {
    const c = CFG.species[k].elements?.length ?? 0;
    if (c > n) {
      n = c;
      best = k;
    }
  }
  return best;
}
/** 物种显示名:英文版 = TitleCase codename;中文版 = config 的 nameZh。 */
export function speciesName(code: string): string {
  return speciesDisplayName(code, LANG, CFG.species[code]?.nameZh);
}
export function tierOf(code: string): number {
  return CFG.species[code]?.elements?.length ?? 1;
}

export const ELEMENTS: Array<{ id: string; name: string; color: string }> = [
  "fire",
  "electric",
  "water",
  "grass",
  "ice",
  "normal",
].map((id) => ({ id, name: elementName(id, LANG), color: CFG.elements[id]?.color ?? "#888" }));

// ---- 记忆化精灵 ----

type SpriteProps = {
  species: string;
  state?: PetState;
  tier?: number;
  className?: string;
  style?: CSSProperties;
};
export const Sprite = memo(function Sprite({ species, state = "idle", tier, className, style }: SpriteProps) {
  return (
    <SvgSprite species={species} config={CFG} petState={state} tier={tier} className={className} style={style} />
  );
});

// ---- 打字机 ----

/** 按 localT 逐字揭示纯文本 + 闪烁光标(打完自动隐藏光标)。 */
export function TypeText({
  text,
  localT,
  start = 0,
  cps = 34,
  caret = true,
  caretInk = false,
  className,
}: {
  text: string;
  localT: number;
  start?: number;
  cps?: number;
  caret?: boolean;
  caretInk?: boolean;
  className?: string;
}) {
  const n = Math.max(0, Math.floor(((localT - start) / 1000) * cps));
  const done = n >= text.length;
  return (
    <span className={className}>
      {text.slice(0, n)}
      {caret && !done && <span className={`type-caret ${caretInk ? "ink" : ""}`} />}
    </span>
  );
}

// ---- 字幕层(打字机出字 + 高亮 + 快节奏淡入淡出)----

// 分段类型/构造器在 ./lang(copy.ts 复用);此处转出保持既有引用路径。
export { S, H } from "./lang";
export type { Seg } from "./lang";

export type CapItem = {
  at: [number, number];
  line: Seg[];
  sub?: string;
  tag?: string;
  pos?: "lower" | "mid" | "top";
  /** 打字速度(字/秒),默认 44。 */
  cps?: number;
};

const clampN = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));

function capOpacity(localT: number, [s, e]: [number, number]): { opacity: number; dy: number } {
  if (localT < s || localT >= e) return { opacity: 0, dy: 10 };
  const inN = Math.min(1, (localT - s) / 170);
  const outN = Math.min(1, (e - localT) / 220);
  return { opacity: Math.min(inN, outN), dy: (1 - inN) * 10 };
}

/** 逐字揭示分段字幕(高亮段着金色),未打完带光标。 */
function TypeCaption({ segments, localT, start, cps }: { segments: Seg[]; localT: number; start: number; cps: number }) {
  const n = Math.max(0, Math.floor(((localT - start) / 1000) * cps));
  let rem = n;
  const total = segments.reduce((a, sg) => a + sg.t.length, 0);
  const done = n >= total;
  return (
    <>
      {segments.map((sg, i) => {
        if (rem <= 0) return null;
        const take = Math.min(sg.t.length, rem);
        rem -= take;
        return (
          <span key={i} className={sg.hi ? "hi" : undefined}>
            {sg.t.slice(0, take)}
          </span>
        );
      })}
      {!done && <span className="type-caret" />}
    </>
  );
}

export function Captions({ localT, items }: { localT: number; items: CapItem[] }) {
  return (
    <div className="cap-layer">
      {items.map((c, i) => {
        const { opacity, dy } = capOpacity(localT, c.at);
        if (opacity <= 0) return null;
        const cps = c.cps ?? CPS[LANG];
        const total = c.line.reduce((a, sg) => a + sg.t.length, 0);
        const typedAt = c.at[0] + (total / cps) * 1000;
        const subOp = clampN((localT - typedAt - 120) / 260); // 打完再淡出副标题/标签
        return (
          <div
            key={i}
            className={`cap ${c.pos ?? "lower"}`}
            style={{ opacity, transform: `translate(-50%, ${dy}px)` }}
          >
            <div className="cap-line">
              <TypeCaption segments={c.line} localT={localT} start={c.at[0]} cps={cps} />
            </div>
            {c.sub != null && <div className="cap-sub" style={{ opacity: subOp }}>{c.sub}</div>}
            {c.tag != null && <div className="cap-tag" style={{ opacity: subOp }}>{c.tag}</div>}
          </div>
        );
      })}
    </div>
  );
}

// ---- 字幕自动排布:每行 = 打字 + 强制停留(默认 2s) + 淡出,顺序排下去 ----
// 解决"某行打完立刻切下一幕"——停留时长与语言/字数无关,恒 ≥ CAP_HOLD。

/** 每行打完后的全显停留(用户定 1 秒;想更慢就调大)。 */
export const CAP_HOLD = 1000;
const CAP_FADE = 220; // 与 capOpacity 的淡出窗对齐
const CAP_GAP = 170; // 两行之间的干净间隔

/** 一段文本的打字时长(ms),按当前语言 cps。 */
export function typeMs(line: Seg[], cps = CPS[LANG]): number {
  const chars = line.reduce((a, s) => a + s.t.length, 0);
  return Math.round((chars / cps) * 1000);
}

export type CapEntry = {
  line: Seg[];
  sub?: string;
  tag?: string;
  pos?: "lower" | "mid" | "top";
  /** 覆盖默认停留(ms);有 sub 时自动多给 1s 读副标题。 */
  hold?: number;
};
export type CapLayout = { items: CapItem[]; at: number[]; ends: number[]; total: number };

/** 从 start(ms)起顺序排布若干字幕行,保证每行打完停 ≥ hold。 */
export function layoutCaps(start: number, entries: CapEntry[]): CapLayout {
  let cursor = start;
  const items: CapItem[] = [];
  const at: number[] = [];
  const ends: number[] = [];
  for (const e of entries) {
    const type = typeMs(e.line);
    const hold = (e.hold ?? CAP_HOLD) + (e.sub ? 700 : 0);
    const end = cursor + type + hold + CAP_FADE;
    items.push({ at: [cursor, end], line: e.line, sub: e.sub, tag: e.tag, pos: e.pos });
    at.push(cursor);
    ends.push(end);
    cursor = end + CAP_GAP;
  }
  return { items, at, ends, total: cursor };
}

/** 标题卡占用时长(ms):打字 + 停留 + 淡出,供场景排布内容起点。 */
export function titleSpan(text: string, hold = 700): number {
  return typeMs([{ t: text }], TITLE_CPS[LANG]) + hold + 500;
}

// ---- 标题卡(打字机出字)----

export function TitleCard({
  kicker,
  text,
  localT,
  start = 0,
  cps = 30,
}: {
  kicker?: string;
  text: string;
  localT: number;
  start?: number;
  cps?: number;
}) {
  const inN = Math.max(0, Math.min(1, (localT - start) / 150));
  return (
    <div className="title-card" style={{ opacity: inN }}>
      {kicker && <div className="title-kicker">{kicker}</div>}
      <div className="title-main">
        <TypeText text={text} localT={localT} start={start} cps={cps} />
      </div>
    </div>
  );
}

// ---- 黑客过场(每段前 ~0.46s:黑条滑出 + 青扫 + 起手闪)----

export function SceneGlitch({ localT, dur = 520, label }: { localT: number; dur?: number; label?: string }) {
  if (localT >= dur) return null;
  const p = localT / dur;
  const boot = localT < 100 ? 1 - localT / 100 : 0;
  const rgb = localT < 210 ? 1 - localT / 210 : 0;
  const bucket = Math.floor(localT / 45); // 伪随机档(冻结帧可复现)
  const cols = ["rgba(143,216,232,0.55)", "rgba(217,86,127,0.45)", "rgba(247,211,115,0.45)", "#05070c"];
  return (
    <div className="glitch">
      {/* 黑条滑出 */}
      {[0, 1, 2].map((i) => {
        const dir = i % 2 === 0 ? -1 : 1;
        return <div key={`b${i}`} className="bar" style={{ top: `${i * 34.5}%`, transform: `translateX(${p * 135 * dir}%)`, opacity: 1 - p }} />;
      })}
      {/* RGB 裂像闪 */}
      {rgb > 0 && (
        <>
          <div className="rgb r" style={{ opacity: rgb * 0.55 }} />
          <div className="rgb c" style={{ opacity: rgb * 0.5 }} />
        </>
      )}
      {/* 数据故障条(伪随机闪烁 + 水平位移) */}
      {p < 0.86 &&
        Array.from({ length: 8 }).map((_, i) => {
          const seed = bucket * 7 + i * 13;
          if (seed % 5 >= 3) return null;
          const y = (i * 137 + bucket * 41) % 92;
          const h = 1.6 + (seed % 4) * 1.7;
          const dx = ((seed % 7) - 3) * 3;
          return <div key={`g${i}`} className="gblk" style={{ top: `${y}%`, height: `${h}%`, transform: `translateX(${dx}%)`, background: cols[seed % 4] }} />;
        })}
      {/* 密扫描线 */}
      {p < 0.86 && <div className="gscanlines" style={{ opacity: (1 - p) * 0.6 }} />}
      {/* 快速下滚扫描 */}
      <div className="scan" style={{ top: `${p * 118 - 12}%`, opacity: (1 - p) * 0.95 }} />
      {/* 终端解码字幕 */}
      {label && p < 0.8 && <div className="decode" style={{ opacity: bucket % 2 === 0 ? 0.85 : 0.4 }}>{label}</div>}
      {/* 起手闪 */}
      {boot > 0 && <div className="boot" style={{ opacity: boot * 0.55 }} />}
    </div>
  );
}

// ---- 仿"经典桌面"背景(带真实图标字形;纯通用图形,无任何品牌标识)----

const DESK_GLYPHS: Record<string, ReactNode> = {
  pc: (
    <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="6" width="40" height="28" rx="4" fill="#cfe8ff" stroke="#2d5f8a" strokeWidth={2.5} />
      <rect x="8" y="10" width="32" height="20" rx="2" fill="#7fb8e8" />
      <rect x="18" y="35" width="12" height="4" rx="2" fill="#2d5f8a" />
      <rect x="12" y="40" width="24" height="3.6" rx="1.8" fill="#2d5f8a" />
    </svg>
  ),
  bin: (
    <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 12 L38 12 L34 44 L14 44 Z" fill="#e8f4ff" stroke="#2d5f8a" strokeWidth={2.5} />
      <rect x="7" y="7" width="34" height="6" rx="3" fill="#9fc9ec" stroke="#2d5f8a" strokeWidth={2} />
      <line x1="19" y1="18" x2="20" y2="38" stroke="#7fb0d8" strokeWidth={2.5} />
      <line x1="29" y1="18" x2="28" y2="38" stroke="#7fb0d8" strokeWidth={2.5} />
    </svg>
  ),
  docs: (
    <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M5 14 Q5 10 9 10 L19 10 L23 15 L39 15 Q43 15 43 19 L43 38 Q43 42 39 42 L9 42 Q5 42 5 38 Z"
        fill="#ffd977"
        stroke="#b07708"
        strokeWidth={2.5}
      />
      <path d="M5 20 L43 20 L43 38 Q43 42 39 42 L9 42 Q5 42 5 38 Z" fill="#ffe9ad" />
    </svg>
  ),
  code: (
    <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="8" width="38" height="32" rx="4" fill="#2f3440" stroke="#171b24" strokeWidth={2.5} />
      <rect x="5" y="8" width="38" height="8" rx="4" fill="#454c5e" />
      <path d="M14 22 L10 26 L14 30" stroke="#8fd8e8" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 22 L26 26 L22 30" stroke="#8fd8e8" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="31" y1="21" x2="36" y2="31" stroke="#ffd93b" strokeWidth={2.5} strokeLinecap="round" />
    </svg>
  ),
};

export function DeskBackdrop() {
  const items: Array<[string, string]> = [
    ["pc", C.desk.pc],
    ["bin", C.desk.bin],
    ["docs", C.desk.docs],
    ["code", C.desk.code],
  ];
  return (
    <div className="desk">
      <div className="desk-icons">
        {items.map(([k, l]) => (
          <div className="desk-icon" key={k}>
            <i>{DESK_GLYPHS[k]}</i>
            {l}
          </div>
        ))}
      </div>
      <div className="desk-taskbar">
        <span className="desk-orb" />
        <span style={{ opacity: 0.6 }}>{C.desk.search}</span>
        <span style={{ marginLeft: "auto" }}>10:24</span>
      </div>
    </div>
  );
}

/** 场景整体淡入淡出;holdEnd=true 时不做尾部淡出(收尾定格用)。 */
export function SceneFade({
  localT,
  dur,
  fade,
  holdEnd,
  children,
}: {
  localT: number;
  dur: number;
  fade: number;
  holdEnd?: boolean;
  children: ReactNode;
}) {
  const inN = Math.min(1, localT / fade);
  const outN = holdEnd ? 1 : Math.min(1, (dur - localT) / fade);
  const opacity = Math.max(0, Math.min(inN, outN));
  return <div style={{ position: "absolute", inset: 0, opacity }}>{children}</div>;
}
