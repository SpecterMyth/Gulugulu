// 分镜(7 段)。字幕走 layoutCaps 自动排布:每行 = 打字 + 强制停留 2s + 淡出,
// 场景时长与各段内部节点(宠物状态/特效)都从排布结果派生,中英文都保证每行停 ≥2s。
import { type CSSProperties, type ReactNode } from "react";
import type { SceneProps } from "./timeline";
import { FADE } from "./timeline";
import {
  Captions,
  TitleCard,
  TypeText,
  DeskBackdrop,
  SceneGlitch,
  Sprite,
  SceneFade,
  ELEMENTS,
  canonRoster,
  starters,
  flagship,
  speciesName,
  tierOf,
  CFG,
  LANG,
  layoutCaps,
  titleSpan,
} from "./ui";
import { COPY } from "./copy";
import { TITLE_CPS } from "./lang";
import { MockIde } from "./MockIde";
import type { PetState } from "../types";

const C = COPY[LANG];

// --- 小工具 ---
const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp(t);
function vars(o: Record<string, string | number>): CSSProperties {
  return o as CSSProperties;
}

function pick(code: string, fallback: string): string {
  return CFG.species[code] ? code : fallback;
}
function pickByCount(n: number): string | undefined {
  return canonRoster().find((k) => (CFG.species[k].elements?.length ?? 1) === n);
}
function aiPicks(n: number, exclude: string[] = []): string[] {
  const r = canonRoster().filter((k) => (CFG.species[k].elements?.length ?? 1) >= 3 && !exclude.includes(k));
  const step = Math.max(1, Math.floor(r.length / n));
  const out: string[] = [];
  for (let i = 0; i < n && i * step < r.length; i++) out.push(r[i * step]);
  return out;
}
const DUCK = pick("guluduck", starters()[0]);

/** 周期性飞入物(Token 芯片 / 键帽 / 金币)。 */
function Fly({
  localT,
  win,
  from,
  to,
  every,
  className,
  render,
  rot,
}: {
  localT: number;
  win: [number, number];
  from: { x: number; y: number };
  to: { x: number; y: number };
  every: number;
  className: string;
  render: (k: number) => ReactNode;
  rot?: boolean;
}) {
  const [s, e] = win;
  if (localT < s || localT >= e) return null;
  const b = Math.floor((localT - s) / every);
  const out: ReactNode[] = [];
  for (let k = Math.max(0, b - 3); k <= b; k++) {
    const jx = ((k * 53) % 90) - 45;
    const jy = ((k * 29) % 46) - 23;
    const sx = from.x + jx;
    const sy = from.y + jy;
    out.push(
      <div
        key={k}
        className={className}
        style={vars({ left: sx, top: sy, "--dx": `${to.x - sx}px`, "--dy": `${to.y - sy}px`, "--rot": rot ? `${((k * 41) % 40) - 20}deg` : "0deg" })}
      >
        {render(k)}
      </div>,
    );
  }
  return <>{out}</>;
}

function Speech({ lines, style, right, nowrap }: { lines: Array<{ t: ReactNode; dim?: boolean }>; style: CSSProperties; right?: boolean; nowrap?: boolean }) {
  return (
    <div className={`tr-speech ${right ? "right" : ""} ${nowrap ? "nowrap" : ""}`} style={style}>
      {lines.map((l, i) => (
        <span className={`tr-spl ${l.dim ? "dim" : ""}`} key={i}>
          {l.t}
        </span>
      ))}
    </div>
  );
}

/** 标题卡:独占场景开头(打字 + 停留 + 淡出),content 随后淡入。 */
function TitleView({ localT, kicker, text, span }: { localT: number; kicker: string; text: string; span: number }) {
  const op = localT < span - 500 ? 1 : Math.max(0, 1 - (localT - (span - 500)) / 500);
  if (op <= 0) return null;
  return (
    <div style={{ opacity: op }}>
      <TitleCard kicker={kicker} text={text} localT={localT} cps={TITLE_CPS[LANG]} />
    </div>
  );
}

// =============================================================================
// Beat 0 — Cold open
// =============================================================================
const COLD_CAPS = layoutCaps(500, [
  { line: C.cold.c1, pos: "mid" },
  { line: C.cold.c2, pos: "mid" },
]);
const COLD_BUBBLE = COLD_CAPS.ends[1] - 600;
export const COLD_DUR = COLD_BUBBLE + 1800;

export function ColdOpen({ localT, dur }: SceneProps) {
  const petState: PetState = localT > COLD_BUBBLE - 200 && localT < COLD_BUBBLE + 1300 ? "success" : "idle";
  return (
    <SceneFade localT={localT} dur={dur} fade={FADE}>
      <div className="scene">
        <DeskBackdrop />
        <MockIde status="thinking" style={{ left: 150, top: 150, width: 760, height: 360 }} />
        <div className="pet-box" style={{ right: 150, bottom: 110, width: 210, height: 210 }}>
          <Sprite species={DUCK} state={petState} />
        </div>
        {localT > COLD_BUBBLE && (
          <Speech lines={[{ t: C.cold.bubble }]} nowrap right style={{ right: 190, bottom: 340, opacity: clamp((localT - COLD_BUBBLE) / 240) }} />
        )}
        <Captions localT={localT} items={COLD_CAPS.items} />
        <SceneGlitch localT={localT} label="> boot gulugulu.exe" />
      </div>
    </SceneFade>
  );
}

// =============================================================================
// Beat 1 — Live reaction (USP)
// =============================================================================
const LIVE_TITLE = titleSpan(C.live.title);
const LIVE_CAPS = layoutCaps(LIVE_TITLE + 250, [
  { line: C.live.c1 },
  { line: C.live.c2 },
  { line: C.live.c3 },
  { line: C.live.c4 },
]);
const LIVE_BUBBLE = LIVE_CAPS.total + 100;
export const LIVE_DUR = LIVE_BUBBLE + 1800;

function liveState(t: number): PetState {
  if (t < LIVE_CAPS.at[1]) return "thinking";
  if (t < LIVE_CAPS.at[2]) return "working";
  if (t < LIVE_CAPS.at[3]) return "fed";
  if (t < LIVE_BUBBLE) return "error";
  return "sleeping";
}
function liveStatus(t: number): "thinking" | "tool" | "tokens" | "error" | undefined {
  if (t < LIVE_CAPS.at[1]) return "thinking";
  if (t < LIVE_CAPS.at[2]) return "tool";
  if (t < LIVE_CAPS.at[3]) return "tokens";
  if (t < LIVE_BUBBLE) return "error";
  return undefined;
}
export function LiveReaction({ localT, dur }: SceneProps) {
  const petX = 1380;
  const petY = 470;
  const contentOp = clamp((localT - (LIVE_TITLE - 250)) / 450);
  const tokFrom = LIVE_CAPS.at[2];
  const tokTo = LIVE_CAPS.at[3];
  // Token 芯片喂的是经验（2026-07-21 机制修订）：条读作 EXP 进度而非精力。
  const expPct = clamp((localT - tokFrom) / (tokTo - tokFrom - 300)) * 100;
  return (
    <SceneFade localT={localT} dur={dur} fade={FADE}>
      <div className="scene">
        <div className="bg-fill bg-dusk" />
        {contentOp > 0 && (
          <div style={{ opacity: contentOp }}>
            <MockIde status={liveStatus(localT)} style={{ left: 150, top: 300, width: 830, height: 470 }} />
            <div className="pet-box" style={{ left: petX - 170, top: petY - 170, width: 340, height: 340 }}>
              <Sprite species={DUCK} state={liveState(localT)} />
            </div>
            {localT >= tokFrom && localT < tokTo + 400 && (
              <div className="expbar" style={{ left: petX - 120, top: petY + 190, width: 240 }}>
                <i style={{ width: `${expPct}%` }} />
              </div>
            )}
            <Fly localT={localT} win={[tokFrom + 150, tokTo - 200]} from={{ x: 920, y: 480 }} to={{ x: petX - 40, y: petY - 20 }} every={340} className="tok-chip" render={() => "T"} />
          </div>
        )}
        {localT > LIVE_BUBBLE && (
          <Speech lines={[{ t: C.live.bubble1 }, { t: C.live.bubble2, dim: true }]} style={{ left: petX - 120, top: petY - 320, opacity: clamp((localT - LIVE_BUBBLE) / 240) }} />
        )}
        <TitleView localT={localT} kicker={C.live.kicker} text={C.live.title} span={LIVE_TITLE} />
        <Captions localT={localT} items={LIVE_CAPS.items} />
        <SceneGlitch localT={localT} label="> attach codex://activity" />
      </div>
    </SceneFade>
  );
}

// =============================================================================
// Beat 2 — Keyboard feeding
// =============================================================================
const KEYS = ["W", "A", "S", "D", "fn", "⌫", "↵", "E", "R", "T"];
const KEYS_CAPS = layoutCaps(500, [
  { line: C.keys.c1, sub: C.keys.c1sub, pos: "top" },
  { line: C.keys.c2, pos: "top" },
]);
export const KEYS_DUR = KEYS_CAPS.total + 500;

export function KeyboardFeed({ localT, dur }: SceneProps) {
  const walkStart = KEYS_CAPS.at[1];
  const walk = clamp((localT - walkStart) / 1600);
  const petLeft = 1380 + walk * 300;
  const petState: PetState = localT < walkStart ? "fed" : localT < walkStart + 1600 ? "moving" : "idle";
  return (
    <SceneFade localT={localT} dur={dur} fade={FADE}>
      <div className="scene">
        <DeskBackdrop />
        <MockIde status="tool" style={{ left: 150, top: 340, width: 720, height: 350 }} />
        <div className="pet-box" style={{ left: petLeft - 150, bottom: 120, width: 300, height: 300 }}>
          <Sprite species={DUCK} state={petState} />
        </div>
        <Fly localT={localT} win={[KEYS_CAPS.at[0] + 300, KEYS_CAPS.ends[0]]} from={{ x: 620, y: 430 }} to={{ x: petLeft, y: 800 }} every={300} className="keycap" rot render={(k) => KEYS[k % KEYS.length]} />
        <Captions localT={localT} items={KEYS_CAPS.items} />
        <SceneGlitch localT={localT} label="> hook keyboard (count only)" />
      </div>
    </SceneFade>
  );
}

// =============================================================================
// Beat 3 — Diversity / collection
// =============================================================================
const COLLECT_CAPS = layoutCaps(500, [
  { line: C.collect.c1 },
  { line: C.collect.c2 },
  { line: C.collect.c3 },
  { line: C.collect.c4, sub: C.collect.c4sub },
]);
const COLLECT_HERO = COLLECT_CAPS.at[2];
export const COLLECT_DUR = COLLECT_CAPS.total + 400;
const ROSTER = canonRoster();
const FLAG = flagship();

export function Collection({ localT, dur }: SceneProps) {
  const wallOn = localT < COLLECT_HERO + 100;
  const wallOp = localT < COLLECT_HERO - 400 ? clamp(localT / 400) : clamp(1 - (localT - (COLLECT_HERO - 400)) / 400);
  const heroOp = clamp((localT - (COLLECT_HERO - 300)) / 400);
  const legendFrom = COLLECT_CAPS.at[1];
  return (
    <SceneFade localT={localT} dur={dur} fade={FADE}>
      <div className="scene">
        <div className="bg-fill bg-dusk" />
        {wallOn && (
          <div className="wall" style={{ gridTemplateColumns: "repeat(12, 1fr)", opacity: wallOp }}>
            {ROSTER.map((code) => (
              <div className="wall-cell" key={code}>
                <Sprite species={code} state="idle" />
              </div>
            ))}
          </div>
        )}
        {localT > legendFrom && localT < COLLECT_HERO - 200 && (
          <div className="elem-legend" style={{ opacity: clamp((localT - legendFrom) / 300) * wallOp }}>
            {ELEMENTS.map((e) => (
              <div className="elem-dot" key={e.id}>
                <i style={{ background: e.color }} />
                {e.name}
              </div>
            ))}
          </div>
        )}
        {localT > COLLECT_HERO - 300 && (
          <div style={{ position: "absolute", inset: 0, opacity: heroOp }}>
            {localT < COLLECT_CAPS.at[3] ? (
              <div className="pet-box" style={{ left: 960 - 240, top: 250, width: 480, height: 480 }}>
                <Sprite species={DUCK} state="working" />
              </div>
            ) : (
              <>
                <div className="pet-box" style={{ left: 960 - 280, top: 200, width: 560, height: 560 }}>
                  <Sprite species={FLAG} state="success" tier={tierOf(FLAG)} />
                </div>
                <div className="pet-name" style={{ left: 960, top: 790, transform: "translateX(-50%)" }}>
                  {speciesName(FLAG)}
                </div>
              </>
            )}
          </div>
        )}
        <Captions localT={localT} items={COLLECT_CAPS.items} />
        <SceneGlitch localT={localT} label="> load pokedex[63]" />
      </div>
    </SceneFade>
  );
}

// =============================================================================
// Beat 4 — AI creation (重头戏)
// =============================================================================
const CREATE_TITLE = titleSpan(C.create.title);
const CREATE_CAPS = layoutCaps(CREATE_TITLE + 250, [
  { line: C.create.c1 },
  { line: C.create.c2 },
  { line: C.create.c3 },
  { line: C.create.c4 },
  { line: C.create.c5 },
]);
const BURST = CREATE_CAPS.at[2] - 800; // 融合爆发在 c3(登场)之前
const BORN_AT = CREATE_CAPS.at[2];
const ROW_AT = CREATE_CAPS.at[3];
export const CREATE_DUR = CREATE_CAPS.total + 400;
const PARENT_A = pick("emberfox", starters()[1] ?? starters()[0]);
const PARENT_B = pick("bubblefrog", starters()[3] ?? starters()[0]);
const BORN = pickByCount(4) ?? pickByCount(3) ?? flagship();
const AI_ROW = aiPicks(4, [BORN]);

export function AiCreation({ localT, dur }: SceneProps) {
  const cx = 960;
  const cy = 0.46 * 1080;
  const fz = localT - BURST;
  const bornIn = fz > 250;

  const showParents = localT > CREATE_TITLE && !bornIn;
  const approach = clamp((localT - (CREATE_TITLE + 200)) / (BURST - 1200 - CREATE_TITLE - 200));
  const spiral = clamp((localT - (BURST - 1200)) / 1200);
  const ax = lerp(lerp(540, 830, approach), cx, spiral);
  const bx = lerp(lerp(1380, 1090, approach), cx, spiral);
  const pScale = 1 - spiral * 0.82;
  const pRot = spiral * 540;
  const pOp = 1 - clamp((spiral - 0.75) / 0.25);

  let coreSize = 0;
  let coreOp = 0;
  if (localT > BURST - 1400 && !bornIn) {
    if (fz < 0) {
      const g = clamp((localT - (BURST - 1400)) / 1600);
      coreSize = 30 + g * 180;
      coreOp = g;
    } else {
      coreSize = 210 + fz * 1.4;
      coreOp = Math.max(0, 1 - fz / 340);
    }
  }
  const flashOp = fz >= 0 && fz < 400 ? (fz < 80 ? fz / 80 : Math.max(0, 1 - (fz - 80) / 320)) : 0;
  const singleOn = bornIn && localT < ROW_AT - 100;
  const singleScale = bornIn ? clamp((fz - 250) / 450) : 0;
  const rowOn = localT > ROW_AT - 400;

  return (
    <SceneFade localT={localT} dur={dur} fade={FADE}>
      <div className="scene">
        <div className="bg-fill bg-dusk" />

        {showParents && (
          <>
            <div className="pet-box" style={{ left: ax - 150, top: cy - 150, width: 300, height: 300, opacity: pOp, transform: `scale(${pScale}) rotate(${pRot}deg)` }}>
              <Sprite species={PARENT_A} state="idle" />
            </div>
            <div className="pet-box" style={{ left: bx - 150, top: cy - 150, width: 300, height: 300, opacity: pOp, transform: `scale(${pScale}) rotate(${-pRot}deg)` }}>
              <Sprite species={PARENT_B} state="idle" />
            </div>
          </>
        )}

        {localT > CREATE_CAPS.at[1] - 200 && localT < BURST + 100 && (
          <div className="terminal" style={{ left: 700, top: 200, width: 500, opacity: clamp((localT - (CREATE_CAPS.at[1] - 200)) / 300) }}>
            <div>
              $ <TypeText text="summon --local claude|codex" localT={localT} start={CREATE_CAPS.at[1]} cps={26} />
            </div>
          </div>
        )}

        {coreOp > 0 && <div className="energy-core" style={{ width: coreSize, height: coreSize, opacity: coreOp }} />}
        {fz >= 0 && fz < 900 && <div className="rays" style={{ opacity: Math.max(0, 1 - fz / 700) * 0.85, top: cy }} />}
        {[0, 1, 2].map((n) => {
          const rz = fz - n * 110;
          if (rz < 0 || rz > 700) return null;
          const size = Math.min(1500, rz * 2.5);
          return <div key={n} className="ring-pulse" style={{ width: size, height: size, top: cy, borderWidth: 6, borderStyle: "solid", borderColor: n === 1 ? "var(--tr-gold-hi)" : "#8fd8e8", opacity: Math.max(0, 1 - rz / 620) }} />;
        })}
        {fz >= 0 &&
          fz < 700 &&
          Array.from({ length: 20 }).map((_, i) => {
            const ang = (i / 20) * Math.PI * 2;
            const d = clamp(fz / 520);
            const r = d * 540;
            const sz = 12 * (1 - d) + 4;
            return <div key={i} className="spark" style={{ left: cx + Math.cos(ang) * r - sz / 2, top: cy + Math.sin(ang) * r - sz / 2, width: sz, height: sz, opacity: 1 - d }} />;
          })}
        <div className="fusion-flash" style={{ opacity: flashOp, top: cy - 540 }} />

        {singleOn && (
          <div style={{ opacity: localT < ROW_AT - 400 ? 1 : clamp(1 - (localT - (ROW_AT - 400)) / 300) }}>
            <div className="pet-box" style={{ left: cx - 230, top: cy - 210, width: 460, height: 460, transform: `scale(${singleScale})` }}>
              <Sprite species={BORN} state="success" tier={tierOf(BORN)} />
            </div>
            <div className="pet-name" style={{ left: cx, top: cy + 310, transform: "translateX(-50%)", opacity: singleScale }}>
              {speciesName(BORN)}
            </div>
          </div>
        )}

        {rowOn &&
          [BORN, ...AI_ROW].slice(0, 4).map((code, i) => {
            const app = clamp((localT - ROW_AT - i * 260) / 360);
            const x = 300 + i * 440;
            return (
              <div key={code} className="pet-box" style={{ left: x - 150, top: 320, width: 300, height: 300, opacity: app, transform: `translateY(${(1 - app) * 34}px) scale(${0.9 + app * 0.1})` }}>
                <Sprite species={code} state={i % 2 === 0 ? "success" : "idle"} tier={tierOf(code)} />
              </div>
            );
          })}

        <TitleView localT={localT} kicker={C.create.kicker} text={C.create.title} span={CREATE_TITLE} />
        <Captions localT={localT} items={CREATE_CAPS.items} />
        <SceneGlitch localT={localT} label="> exec fusion.ai --local" />
      </div>
    </SceneFade>
  );
}

// =============================================================================
// Beat 5 — Workshop + trading
// =============================================================================
const TRADE_TITLE = titleSpan(C.trade.title);
const TRADE_CAPS = layoutCaps(TRADE_TITLE + 250, [
  { line: C.trade.c1 },
  { line: C.trade.c2 },
  { line: C.trade.c3 },
  { line: C.trade.c4, tag: C.trade.c4tag },
]);
const TRADE_SWITCH = TRADE_CAPS.at[2];
export const TRADE_DUR = TRADE_CAPS.total + 400;
const TRADE_CARDS = (() => {
  const r = canonRoster();
  const two = r.filter((k) => (CFG.species[k].elements?.length ?? 1) === 2);
  const three = r.filter((k) => (CFG.species[k].elements?.length ?? 1) === 3);
  return [starters()[1], two[0], three[0], two[1]].filter(Boolean).slice(0, 4) as string[];
})();
const TRADE_HERO = pickByCount(5) ?? pickByCount(4) ?? flagship();

export function WorkshopTrade({ localT, dur }: SceneProps) {
  const wsOn = localT > TRADE_TITLE - 200 && localT < TRADE_SWITCH + 100;
  const wsOp = localT < TRADE_SWITCH - 300 ? clamp((localT - (TRADE_TITLE - 200)) / 400) : clamp(1 - (localT - (TRADE_SWITCH - 300)) / 300);
  const tradeOn = localT > TRADE_SWITCH - 300;
  const tradeOp = clamp((localT - (TRADE_SWITCH - 300)) / 400);
  const coinFrom = TRADE_SWITCH + 600;
  return (
    <SceneFade localT={localT} dur={dur} fade={FADE}>
      <div className="scene">
        <div className="bg-fill bg-dusk" />

        {wsOn && (
          <div style={{ position: "absolute", inset: 0, opacity: wsOp }}>
            <div className="beam" style={{ height: 260, top: 250, left: "50%", opacity: 0.5, transform: "translateX(-50%)" }} />
            <div className="pet-box" style={{ left: 960 - 240, top: 250, width: 480, height: 480 }}>
              <Sprite species={TRADE_HERO} state="success" tier={tierOf(TRADE_HERO)} />
            </div>
            <div className="trade-badge" style={{ left: 1150, top: 230, color: "#ffd93b", borderColor: "#ffd93b", boxShadow: "0 0 26px rgba(255,217,59,0.5)", fontSize: 28 }}>
              {C.trade.badgeWs}
            </div>
            <div className="price-tag" style={{ left: 720, top: 250, right: "auto" }}>{C.trade.badgeFirst}</div>
          </div>
        )}

        {tradeOn && (
          <div style={{ position: "absolute", inset: 0, opacity: tradeOp }}>
            <div className="market-grid">
              {TRADE_CARDS.map((code, i) => (
                <div className="market-card" key={code}>
                  <Sprite species={code} state={i === 1 ? "working" : "idle"} tier={tierOf(code)} />
                  <div className="price-tag">{C.trade.prices[i]}</div>
                </div>
              ))}
            </div>
            {localT > coinFrom && (
              <>
                <Fly localT={localT} win={[coinFrom, TRADE_CAPS.total - 200]} from={{ x: 720, y: 620 }} to={{ x: 1560, y: 210 }} every={300} className="coin-fly" render={() => "¥"} />
                {localT > coinFrom + 300 && <div className="trade-badge" style={{ left: 1360, top: 150, opacity: clamp((localT - coinFrom - 300) / 250) }}>{C.trade.badgeTraded}</div>}
              </>
            )}
          </div>
        )}

        <TitleView localT={localT} kicker={C.trade.kicker} text={C.trade.title} span={TRADE_TITLE} />
        <Captions localT={localT} items={TRADE_CAPS.items} />
        <SceneGlitch localT={localT} label="> upload workshop.item" />
      </div>
    </SceneFade>
  );
}

// =============================================================================
// Beat 6 — End card (定格)
// =============================================================================
export const END_DUR = 4000;

export function EndCard({ localT, dur }: SceneProps) {
  const op = clamp((localT - 300) / 500);
  return (
    <SceneFade localT={localT} dur={dur} fade={FADE} holdEnd>
      <div className="scene">
        <div className="bg-fill bg-cozy" />
        <div className="endcard" style={{ opacity: op }}>
          <div className="wordmark">{C.end.wordmark}</div>
          <div className="tagline">{C.end.tagline}</div>
          <div className="cta">{C.end.cta}</div>
          <Speech lines={[{ t: C.end.bubble }]} nowrap style={{ position: "relative", marginTop: 10 }} />
        </div>
        <SceneGlitch localT={localT} label="> store.steampowered.com" />
      </div>
    </SceneFade>
  );
}
