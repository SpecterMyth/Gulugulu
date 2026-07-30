import type { CardId } from "../rogueConfig";

type Palette = {
  bg: string;
  ink: string;
  main: string;
  light: string;
  accent: string;
};

const PALETTES: Record<string, Palette> = {
  fire: { bg: "#FBE0C4", ink: "#64301F", main: "#E85D3A", light: "#FFF0C7", accent: "#FFB03A" },
  electric: { bg: "#FFF1B8", ink: "#58451B", main: "#F7C531", light: "#FFFBE5", accent: "#8A6B10" },
  ice: { bg: "#DDF4F7", ink: "#28576A", main: "#7BD3E8", light: "#F5FEFF", accent: "#4194B0" },
  water: { bg: "#DCECF9", ink: "#234F79", main: "#4B94CE", light: "#F2FAFF", accent: "#2E7BD6" },
  grass: { bg: "#E0F1D3", ink: "#315126", main: "#57B84C", light: "#F8FFF2", accent: "#E8A94D" },
  normal: { bg: "#E7E6E2", ink: "#4D4A47", main: "#9A9AA6", light: "#FFFDF4", accent: "#D19460" },
  attr: { bg: "#F1E6D2", ink: "#553C2B", main: "#C88D58", light: "#FFF9E9", accent: "#9B6BD6" },
  syn: { bg: "#E8E0F4", ink: "#49395E", main: "#9B6BD6", light: "#FCF8FF", accent: "#E8A94D" },
  staff: { bg: "#F2E5CF", ink: "#533B29", main: "#B07B44", light: "#FFFDF4", accent: "#D9553F" },
};

function paletteFor(id: CardId): Palette {
  const [family, element] = id.split(".");
  return PALETTES[family === "base" ? element : family] ?? PALETTES.staff;
}

const S = { strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** 工厂升级卡的独立 SVG 插画。全部图形共用 72×72 坐标系，便于卡面缩放。 */
export function RogueCardIcon({ id, title }: { id: CardId; title?: string }) {
  const p = paletteFor(id);
  const art = cardArt(id, p);
  return (
    <svg
      className="fr-card-art"
      viewBox="0 0 72 72"
      role="img"
      aria-label={title ?? id}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title ?? id}</title>
      <rect x="3" y="3" width="66" height="66" rx="16" fill={p.bg} stroke={p.ink} strokeWidth="2.4" />
      <path d="M13 18c5-7 12-10 22-10" fill="none" stroke={p.light} strokeWidth="3" opacity=".9" {...S} />
      <circle cx="59" cy="14" r="3" fill={p.accent} opacity=".75" />
      <circle cx="13" cy="58" r="2.2" fill={p.main} opacity=".45" />
      {art}
    </svg>
  );
}

function cardArt(id: CardId, p: Palette) {
  const common = { stroke: p.ink, strokeWidth: 2.4, ...S };
  switch (id) {
    case "fire.burst":
      return <g><path d="m36 15 5 12 11-5-5 11 11 5-12 4 4 12-11-6-6 10-2-12-12 3 7-10-10-7 12-1Z" fill={p.main} {...common}/><path d="m36 28 4 8-7 8 2-8-5-4Z" fill={p.accent}/></g>;
    case "fire.ember":
      return <g><path d="M20 50c3-10 9-15 17-17 8-2 14 4 15 14-7 9-24 11-32 3Z" fill={p.ink}/><path d="M28 46c4-8 9-15 8-24 8 6 13 13 8 23-4 7-13 8-16 1Z" fill={p.main} {...common}/><path d="M34 45c-2-5 2-8 4-12 4 5 4 9 0 13Z" fill={p.accent}/><circle cx="22" cy="26" r="2" fill={p.accent}/><circle cx="50" cy="20" r="2.5" fill={p.main}/></g>;
    case "fire.wildfire":
      return <g><path d="M16 52c2-13 10-15 9-28 7 4 8 10 8 15 5-7 8-14 7-22 13 8 18 23 12 35-8 8-27 8-36 0Z" fill={p.main} {...common}/><path d="M28 54c-3-7 4-12 7-18 1 6 7 9 5 18Z" fill={p.accent}/><path d="M17 21h6m26 8 6-4m-3 14h7" fill="none" {...common}/></g>;
    case "fire.chain":
      return <g><path d="M16 51 27 39l9 7 18-25" fill="none" stroke={p.ink} strokeWidth="5" {...S}/><circle cx="16" cy="51" r="6" fill={p.main} {...common}/><circle cx="36" cy="46" r="6" fill={p.accent} {...common}/><circle cx="54" cy="21" r="6" fill={p.main} {...common}/><path d="M23 32c-2-6 4-9 5-15 6 6 7 11 2 16Z" fill={p.main} {...common}/></g>;
    case "electric.overload":
      return <g><rect x="15" y="24" width="42" height="28" rx="6" fill={p.light} {...common}/><path d="M24 24v-6h24v6M20 47h32" fill="none" {...common}/><path d="m39 27-9 13h7l-3 9 10-14h-7Z" fill={p.main} {...common}/><path d="M20 31v7m32-7v7" stroke={p.accent} strokeWidth="3" {...S}/></g>;
    case "electric.wire":
      return <g><path d="M18 27c5-11 19-8 19 2s-15 9-15 19 15 11 18 1" fill="none" stroke={p.main} strokeWidth="6" {...S}/><path d="M17 22v9m5-7v9M40 48h10v-8m-4 0h8" fill="none" {...common}/><circle cx="18" cy="27" r="3" fill={p.light} {...common}/><path d="m45 17-6 9h5l-2 7 8-11h-5Z" fill={p.main} {...common}/></g>;
    case "electric.parallel":
      return <g><path d="M17 20v32m38-32v32M17 27h38M17 45h38" fill="none" stroke={p.ink} strokeWidth="3.2" {...S}/><path d="m35 17-8 14h7l-5 12 14-18h-8l6-8Z" fill={p.main} {...common}/><circle cx="17" cy="27" r="4" fill={p.light} {...common}/><circle cx="55" cy="27" r="4" fill={p.light} {...common}/><circle cx="17" cy="45" r="4" fill={p.accent} {...common}/><circle cx="55" cy="45" r="4" fill={p.accent} {...common}/></g>;
    case "electric.induction":
      return <g><path d="M25 56V18m22 38V18M25 25h22M25 36h22M25 47h22" fill="none" stroke={p.main} strokeWidth="4" {...S}/><path d="m18 21-6 9h5l-2 7 8-11h-5Zm39 17-6 9h5l-2 7 8-11h-5Z" fill={p.accent} {...common}/></g>;
    case "ice.icicle":
      return <g><path d="M18 18h36l-8 13-5-7-6 30-7-27-5 9Z" fill={p.main} {...common}/><path d="m35 22-2 23m9-23 4 6" fill="none" stroke={p.light} strokeWidth="2.4" {...S}/><path d="M18 18h36" stroke={p.light} strokeWidth="3" {...S}/></g>;
    case "ice.freezeprice":
      return <g><circle cx="36" cy="38" r="16" fill={p.light} {...common}/><path d="M36 23v30M23 30l26 16M23 46l26-16" fill="none" stroke={p.main} strokeWidth="3" {...S}/><path d="M14 18h18l-4 8H10Z" fill={p.accent} {...common}/><path d="M18 19v6m6-6v4" stroke={p.light} strokeWidth="2" {...S}/></g>;
    case "ice.prism":
      return <g><path d="m36 14 20 40H16Z" fill={p.light} {...common}/><path d="m36 14 2 40m-18-8 17-12 15 12" fill="none" stroke={p.main} strokeWidth="2.6" {...S}/><path d="m40 35 16-9M42 39l17 1m-18 4 14 9" fill="none" stroke={p.accent} strokeWidth="3" {...S}/></g>;
    case "ice.freeze":
      return <g><path d="M17 22h38v32H17Z" fill={p.light} {...common}/><path d="M36 15v44M18 28l36 20M18 48l36-20" fill="none" stroke={p.main} strokeWidth="3" {...S}/><path d="m31 39 5 6 5-6" fill="none" stroke={p.accent} strokeWidth="4" {...S}/></g>;
    case "ice.overstaff":
      return <g><path d="M14 53h44" fill="none" {...common}/><path d="M18 53V38h11v15m4 0V30h11v23m4 0V22h10v31" fill={p.main} {...common}/><path d="M13 25h14l3 7-10 7-10-7Z" fill={p.light} {...common}/><path d="M20 20v10m-5-5h10" stroke={p.accent} strokeWidth="3" {...S}/><path d="M38 18v7m-4-3h8" stroke={p.light} strokeWidth="2.5" {...S}/></g>;
    case "ice.chain":
      return <g><path d="M13 50h14V39h14V28h18" fill="none" stroke={p.main} strokeWidth="8" {...S}/><path d="m18 43 6-6m8-4 6-6m8-4 6-6" fill="none" stroke={p.light} strokeWidth="2.5" {...S}/><path d="m14 51 5 7m34-30 6 6" fill="none" {...common}/><circle cx="13" cy="50" r="4" fill={p.accent} {...common}/><circle cx="59" cy="28" r="4" fill={p.accent} {...common}/></g>;
    case "water.reflow":
      return <g><path d="M51 28A17 17 0 0 0 23 21l-4 5" fill="none" stroke={p.main} strokeWidth="5" {...S}/><path d="m17 17 2 9 9-1" fill={p.main} {...common}/><path d="M21 43a17 17 0 0 0 28 7l4-5" fill="none" stroke={p.accent} strokeWidth="5" {...S}/><path d="m55 54-2-9-9 1" fill={p.accent} {...common}/><path d="M31 42c0-5 5-8 6-14 4 5 7 9 4 14-2 4-8 4-10 0Z" fill={p.light} {...common}/></g>;
    case "water.reservoir":
      return <g><path d="M20 20h32v34H20Z" fill={p.light} {...common}/><path d="M20 38c7-5 12 4 18 0s9 3 14 0v16H20Z" fill={p.main}/><path d="M20 38c7-5 12 4 18 0s9 3 14 0M27 20v-6h18v6" fill="none" {...common}/><circle cx="29" cy="45" r="2" fill={p.light}/><circle cx="44" cy="48" r="3" fill={p.light}/></g>;
    case "water.fourday":
      return <g><rect x="15" y="20" width="42" height="37" rx="5" fill={p.light} {...common}/><path d="M15 30h42M25 16v9m22-9v9" fill="none" {...common}/><path d="M23 38h8v8h-8zm12 0h8v8h-8zm12 0h5v8h-5z" fill={p.main}/><path d="m22 52 3 3 7-7" fill="none" stroke={p.accent} strokeWidth="3" {...S}/></g>;
    case "water.same":
      return <g><path d="M20 38c0-9 10-15 16-25 6 10 16 16 16 25a16 16 0 0 1-32 0Z" fill={p.main} {...common}/><circle cx="31" cy="38" r="6" fill={p.light} {...common}/><circle cx="43" cy="38" r="6" fill={p.light} {...common}/><path d="M31 50h12" stroke={p.accent} strokeWidth="3" {...S}/></g>;
    case "water.convert":
      return <g><circle cx="26" cy="37" r="13" fill={p.light} {...common}/><circle cx="48" cy="37" r="13" fill={p.main} {...common}/><path d="M30 20c10-7 23-1 26 8m-3-9 3 9-9 1M43 54c-10 7-23 1-26-8m3 9-3-9 9-1" fill="none" stroke={p.accent} strokeWidth="3" {...S}/></g>;
    case "water.chain":
      return <g><path d="M13 47c9-12 18 9 27-3s11-15 20-7" fill="none" stroke={p.main} strokeWidth="6" {...S}/><circle cx="13" cy="47" r="5" fill={p.light} {...common}/><circle cx="40" cy="44" r="5" fill={p.light} {...common}/><circle cx="60" cy="37" r="5" fill={p.light} {...common}/><path d="M29 32c0-6 6-10 8-17 5 6 8 11 4 17-3 5-9 5-12 0Z" fill={p.accent} {...common}/></g>;
    case "grass.root":
      return <g><path d="M36 34v22m0-8-9 7m9-13 9 13m-9-4 4 7m-4-11-5 4" fill="none" stroke={p.ink} strokeWidth="3" {...S}/><path d="M36 35c-1-13-10-17-18-14 1 10 8 16 18 14Z" fill={p.main} {...common}/><path d="M37 31c3-12 12-14 19-9-3 9-10 13-19 9Z" fill="#79C765" {...common}/><path d="M17 40h38" stroke={p.accent} strokeWidth="3" {...S}/></g>;
    case "grass.symbiosis":
      return <g><path d="M31 42c-12 1-18-7-17-17 12-1 18 6 17 17Zm10 0c12 1 18-7 17-17-12-1-18 6-17 17Z" fill={p.main} {...common}/><path d="M25 31c7 4 10 9 11 25m11-25c-7 4-10 9-11 25" fill="none" {...common}/><circle cx="36" cy="45" r="6" fill={p.accent} {...common}/><path d="m33 45 2 2 4-5" fill="none" stroke={p.light} strokeWidth="2.2" {...S}/></g>;
    case "grass.growth":
      return <g><path d="M17 55h39M22 55V44h8v11m5 0V35h8v20m5 0V24h8v31" fill={p.main} {...common}/><path d="M19 38c5-10 10-15 20-20m0 0-1 9m1-9-9 2" fill="none" stroke={p.accent} strokeWidth="3" {...S}/><path d="M48 19c0-5 4-8 9-8 0 6-3 9-9 8Z" fill={p.main} {...common}/></g>;
    case "grass.grow":
      return <g><path d="M36 57V26" fill="none" stroke={p.ink} strokeWidth="4" {...S}/><path d="M36 35c-13 1-19-6-18-16 12-1 18 5 18 16Zm1 8c12 1 18-6 17-16-11-1-17 5-17 16Z" fill={p.main} {...common}/><circle cx="36" cy="17" r="8" fill={p.light} {...common}/><path d="M36 12v10m-5-5h10" stroke={p.accent} strokeWidth="3" {...S}/></g>;
    case "grass.crowd":
      return <g><path d="M16 53c2-12 9-19 20-19s18 7 20 19Z" fill={p.main} {...common}/><circle cx="23" cy="38" r="9" fill="#79C765" {...common}/><circle cx="37" cy="31" r="12" fill={p.main} {...common}/><circle cx="51" cy="39" r="9" fill="#79C765" {...common}/><path d="M36 54V29m-8 25V39m16 15V39" fill="none" stroke={p.ink} strokeWidth="3" {...S}/><path d="M20 23c6-7 13-9 20-8m6 3 6-4" fill="none" stroke={p.accent} strokeWidth="3" {...S}/></g>;
    case "grass.height":
      return <g><path d="M14 56h44M20 56V45h11v11m3 0V34h11v22m3 0V21h10v35" fill={p.main} {...common}/><path d="m15 39 10-9 10 5 16-19m0 0-1 9m1-9-9 1" fill="none" stroke={p.accent} strokeWidth="3" {...S}/></g>;
    case "grass.chain":
      return <g><path d="M14 54c5-18 18-8 22-25 3-12 12-15 22-12" fill="none" stroke={p.ink} strokeWidth="5" {...S}/><path d="M22 43c-7-1-11-5-11-11 8-1 13 3 13 10Zm17-15c-1-8 3-13 10-15 2 8-2 13-10 15Zm5 10c7-1 12 3 13 10-8 1-13-3-13-10Z" fill={p.main} {...common}/><circle cx="14" cy="54" r="4" fill={p.accent} {...common}/><circle cx="58" cy="17" r="4" fill={p.accent} {...common}/></g>;
    case "normal.crowd":
      return <g><circle cx="36" cy="24" r="8" fill={p.main} {...common}/><circle cx="19" cy="31" r="6" fill={p.light} {...common}/><circle cx="53" cy="31" r="6" fill={p.light} {...common}/><path d="M23 56c0-12 5-19 13-19s13 7 13 19ZM10 55c0-10 3-16 9-16 3 0 5 1 7 4m36 12c0-10-3-16-9-16-3 0-5 1-7 4" fill={p.main} {...common}/></g>;
    case "normal.temp":
      return <g><rect x="18" y="17" width="36" height="40" rx="5" fill={p.light} {...common}/><path d="M26 17v-5h20v5M25 28h22m-22 9h13m-13 8h10" fill="none" {...common}/><circle cx="48" cy="46" r="10" fill={p.main} {...common}/><path d="M48 40v7l4 2" fill="none" stroke={p.light} strokeWidth="2.5" {...S}/></g>;
    case "normal.jack":
      return <g><path d="M20 21h12l4 9 4-9h12l-6 14 8 18H42l-6-11-6 11H18l8-18Z" fill={p.main} {...common}/><circle cx="20" cy="17" r="4" fill="#E85D3A"/><circle cx="36" cy="13" r="4" fill="#F7C531"/><circle cx="52" cy="17" r="4" fill="#4B94CE"/><path d="M29 36h14" stroke={p.light} strokeWidth="3" {...S}/></g>;
    case "normal.absorb":
      return <g><circle cx="43" cy="38" r="18" fill={p.main} {...common}/><circle cx="18" cy="38" r="8" fill={p.light} {...common}/><path d="M27 38h8m-5-5 6 5-6 5" fill="none" stroke={p.accent} strokeWidth="3.4" {...S}/><path d="M35 38c5 7 12 7 17 0" fill="none" stroke={p.light} strokeWidth="3" {...S}/><circle cx="40" cy="31" r="2" fill={p.ink}/><circle cx="49" cy="31" r="2" fill={p.ink}/></g>;
    case "normal.gluttony":
      return <g><path d="M15 36c7-16 35-20 44 0-8 22-36 22-44 0Z" fill={p.main} {...common}/><path d="M22 37c9 9 20 11 30 0-2 14-25 18-30 0Z" fill={p.ink}/><path d="m27 39 4 5 4-5 4 5 5-5" fill="none" stroke={p.light} strokeWidth="2.6" {...S}/><circle cx="28" cy="28" r="3" fill={p.light}/><circle cx="47" cy="28" r="3" fill={p.light}/></g>;
    case "normal.emperor":
      return <g><path d="m16 31 7-15 12 12 11-12 10 15-5 23H21Z" fill={p.accent} {...common}/><circle cx="23" cy="16" r="4" fill={p.light} {...common}/><circle cx="46" cy="16" r="4" fill={p.light} {...common}/><path d="M36 53V27m0 0-7 8m7-8 7 8M26 54h20" fill="none" stroke={p.ink} strokeWidth="3" {...S}/><circle cx="36" cy="15" r="5" fill={p.main} {...common}/></g>;
    case "normal.tags":
      return <g><path d="M18 18h29l10 10-26 28-14-14Z" fill={p.light} {...common}/><circle cx="25" cy="27" r="4" fill={p.main}/><circle cx="45" cy="25" r="4" fill="#E85D3A"/><circle cx="51" cy="34" r="4" fill="#F7C531"/><circle cx="43" cy="43" r="4" fill="#4B94CE"/><circle cx="33" cy="39" r="4" fill="#57B84C"/></g>;
    case "normal.overlap":
      return <g><circle cx="30" cy="35" r="17" fill={p.main} fillOpacity=".8" {...common}/><circle cx="44" cy="35" r="17" fill={p.accent} fillOpacity=".7" {...common}/><path d="M37 20c6 4 10 9 10 15s-4 12-10 16c-6-4-10-10-10-16s4-11 10-15Z" fill={p.light} {...common}/></g>;
    case "normal.dispatch":
      return <g><circle cx="36" cy="36" r="9" fill={p.light} {...common}/><path d="M36 27V17h17m-8-6 8 6-8 6M28 34 17 27v-9m-5 7 5-7 7 5m18 20 9 6v9m5-7-5 7-7-5" fill="none" stroke={p.accent} strokeWidth="3.2" {...S}/><circle cx="36" cy="36" r="4" fill={p.main}/><circle cx="54" cy="17" r="4" fill="#E85D3A" {...common}/><circle cx="17" cy="17" r="4" fill="#57B84C" {...common}/><circle cx="51" cy="58" r="4" fill="#4B94CE" {...common}/></g>;
    case "normal.chain":
      return <g><path d="M19 46 36 27l17 19M19 46h34" fill="none" stroke={p.accent} strokeWidth="4" {...S}/><circle cx="36" cy="21" r="7" fill={p.main} {...common}/><path d="M26 36c1-8 4-12 10-12s9 4 10 12" fill={p.light} {...common}/><circle cx="18" cy="45" r="7" fill={p.main} {...common}/><circle cx="54" cy="45" r="7" fill={p.main} {...common}/><path d="M8 59c1-7 4-11 10-11s9 4 10 11m16 0c1-7 4-11 10-11s9 4 10 11" fill={p.light} {...common}/></g>;
    case "attr.pure":
      return <g><circle cx="36" cy="36" r="19" fill={p.light} {...common}/><circle cx="36" cy="36" r="11" fill={p.main} {...common}/><circle cx="36" cy="36" r="4" fill={p.accent}/><path d="M36 11v7m0 36v7M11 36h7m36 0h7" fill="none" {...common}/></g>;
    case "attr.dual":
      return <g><circle cx="29" cy="36" r="16" fill={p.main} {...common}/><circle cx="43" cy="36" r="16" fill={p.accent} fillOpacity=".78" {...common}/><path d="M36 23c5 4 8 8 8 13s-3 10-8 13c-5-3-8-8-8-13s3-9 8-13Z" fill={p.light} {...common}/></g>;
    case "attr.slash":
      return <g><path d="M17 19h12l7 11 7-11h12L43 36l12 17H43l-7-11-7 11H17l12-17Z" fill={p.light} {...common}/><path d="M25 17 47 55M47 17 25 55" stroke={p.main} strokeWidth="5" {...S}/><circle cx="36" cy="36" r="5" fill={p.accent} {...common}/></g>;
    case "attr.hex":
      return <g><path d="m36 12 21 12v24L36 60 15 48V24Z" fill={p.light} {...common}/><path d="m36 21 13 8v14l-13 8-13-8V29Z" fill={p.main} {...common}/><circle cx="36" cy="21" r="3" fill={p.accent}/><circle cx="49" cy="29" r="3" fill={p.accent}/><circle cx="49" cy="43" r="3" fill={p.accent}/><circle cx="23" cy="29" r="3" fill={p.accent}/></g>;
    case "attr.balance":
      return <g><path d="M36 16v39M23 56h26M20 23h32" fill="none" {...common}/><path d="m20 23-9 18h18Zm32 0-9 18h18Z" fill={p.light} {...common}/><path d="M11 41c2 7 16 7 18 0m14 0c2 7 16 7 18 0" fill={p.main} {...common}/><circle cx="36" cy="16" r="5" fill={p.accent} {...common}/></g>;
    case "syn.arcIgnite":
      return <g><path d="M13 49h12V36h13V23h20" fill="none" stroke="#F7C531" strokeWidth="5" {...S}/><path d="m40 15-9 15h8l-5 13 14-19h-8l6-9Z" fill="#F7C531" {...common}/><circle cx="14" cy="49" r="5" fill={p.light} {...common}/><circle cx="58" cy="23" r="5" fill={p.light} {...common}/><path d="M47 55c-3-7 4-11 6-18 6 7 7 13 2 18Z" fill="#E85D3A" {...common}/></g>;
    case "syn.thermalShock":
      return <g><path d="M16 47c-2-9 7-14 9-25 9 8 12 17 6 27Z" fill="#E85D3A" {...common}/><path d="M48 18v34M34 27l28 16M34 43l28-16" fill="none" stroke="#7BD3E8" strokeWidth="4" {...S}/><path d="m36 29 4 6 7-2-4 6 5 5-7-1-3 7-1-7-8 1 6-5-4-6 7 2Z" fill={p.light} {...common}/></g>;
    case "syn.steamBurst":
      return <g><path d="M16 50c-2-8 6-13 9-23 8 8 10 16 4 24Z" fill="#E85D3A" {...common}/><path d="M42 30c0-6 7-11 10-18 5 7 10 12 8 19-2 6-13 7-18-1Z" fill="#4B94CE" {...common}/><path d="M30 26c-5-5 4-8-1-13m10 12c-5-5 4-8-1-13" fill="none" stroke={p.ink} strokeWidth="2.6" {...S}/><path d="m37 39 3 6 7-2-4 6 5 5-7-1-4 6-1-7-7 1 5-5-4-6 7 2Z" fill={p.light} {...common}/></g>;
    case "syn.fireDispatch":
      return <g><circle cx="36" cy="39" r="19" fill="#9A9AA6" {...common}/><path d="M25 42c7 8 15 9 23 0" fill="none" stroke={p.light} strokeWidth="3.2" {...S}/><path d="M28 19c-2-7 5-11 8-18 7 8 8 14 2 20Z" fill="#E85D3A" {...common}/><path d="m47 17 4 7 8-2-5 7 5 6-8-1-4 7-2-8-8 1 6-6-4-7 8 3Z" fill="#FFB03A" {...common}/></g>;
    case "syn.superconduct":
      return <g><path d="M15 22h42M15 50h42" fill="none" stroke="#F7C531" strokeWidth="4" {...S}/><path d="M36 15v42M22 23l28 26M22 49l28-26" fill="none" stroke="#7BD3E8" strokeWidth="3.5" {...S}/><path d="m38 17-9 17h8l-5 17 13-22h-8l6-12Z" fill={p.light} {...common}/><circle cx="15" cy="22" r="4" fill="#FFF1B8" {...common}/><circle cx="57" cy="50" r="4" fill="#FFF1B8" {...common}/></g>;
    case "syn.bionet":
      return <g><path d="M36 55V31m0 10-13-9m13 2 13-9m-13 19 14 8" fill="none" stroke="#57B84C" strokeWidth="4" {...S}/><path d="M35 31c-10 0-15-6-14-14 9-1 15 5 14 14Zm3 4c10 0 15-6 14-14-9-1-15 5-14 14Z" fill="#57B84C" {...common}/><circle cx="21" cy="31" r="5" fill="#F7C531" {...common}/><circle cx="50" cy="24" r="5" fill="#F7C531" {...common}/><circle cx="51" cy="52" r="5" fill="#F7C531" {...common}/><path d="m20 27-3 5h3l-2 4 6-7h-3l2-3Z" fill={p.light}/></g>;
    case "syn.iceMirror":
      return <g><path d="m36 13 17 8v30l-17 8-17-8V21Z" fill={p.light} {...common}/><path d="M36 14v44" fill="none" stroke={p.ink} strokeWidth="2.6" {...S}/><path d="M24 36c0-6 6-10 8-17 5 7 7 11 3 17-3 5-8 5-11 0Z" fill="#4B94CE" {...common}/><path d="M45 23v27M37 29l16 15M37 44l16-15" fill="none" stroke="#7BD3E8" strokeWidth="3" {...S}/></g>;
    case "syn.coldRotation":
      return <g><circle cx="36" cy="39" r="18" fill="#9A9AA6" {...common}/><path d="M28 42c5 5 11 5 16 0" fill="none" stroke={p.light} strokeWidth="3" {...S}/><path d="M36 10v20M27 15l18 10M27 25l18-10" fill="none" stroke="#7BD3E8" strokeWidth="3.2" {...S}/><path d="M15 39h8m26 0h8M20 25l6 5m26-5-6 5M20 53l6-5m26 5-6-5" fill="none" stroke="#7BD3E8" strokeWidth="3" {...S}/></g>;
    case "syn.irrigation":
      return <g><path d="M12 27h28v23H16Z" fill="#4B94CE" {...common}/><path d="M40 32c10-1 15 2 18 8m-18-2 14 8" fill="none" stroke="#4B94CE" strokeWidth="4" {...S}/><path d="M18 27v-8h16l6 8" fill="none" {...common}/><path d="M42 51c0-9 5-15 13-17 1 9-3 15-13 17Zm-1 2c-8-1-12-6-12-13 8 0 13 5 12 13Z" fill="#57B84C" {...common}/><circle cx="57" cy="49" r="3" fill="#4B94CE"/><circle cx="62" cy="42" r="2.5" fill="#4B94CE"/></g>;
    case "syn.badge":
      return <g><path d="M13 42c0-8 8-13 13-23 5 10 13 15 13 23a13 13 0 0 1-26 0Z" fill="#4B94CE" {...common}/><path d="M34 42c0-10 10-16 16-28 6 12 16 18 16 28a16 16 0 0 1-32 0Z" fill="#9A9AA6" fillOpacity=".9" {...common}/><path d="M29 40h13m-5-5 6 5-6 5" fill="none" stroke={p.light} strokeWidth="3.2" {...S}/><circle cx="51" cy="43" r="5" fill={p.light}/></g>;
    case "syn.multiSeed":
      return <g><path d="M17 52c8-17 18-25 34-31" fill="none" stroke="#57B84C" strokeWidth="4" {...S}/><path d="M34 35c-10 1-16-5-15-14 10-1 16 5 15 14Zm7-7c0-9 6-14 15-15 1 9-5 15-15 15Z" fill="#57B84C" {...common}/><circle cx="19" cy="51" r="11" fill="#9A9AA6" {...common}/><circle cx="51" cy="45" r="15" fill="#9A9AA6" {...common}/><path d="m33 44 6 1m-3-5 5 5-6 4" fill="none" stroke={p.accent} strokeWidth="3" {...S}/><path d="M44 48c4 4 8 4 12 0" fill="none" stroke={p.light} strokeWidth="2.5" {...S}/></g>;
    case "syn.steam":
      return <g><circle cx="26" cy="44" r="13" fill="#E85D3A" {...common}/><path d="M22 46c-2-6 4-9 5-15 6 6 7 11 2 16Z" fill="#FFB03A"/><path d="M37 51h17V34H37Z" fill="#7BD3E8" {...common}/><path d="m37 34 8-9 9 9" fill="#F5FEFF" {...common}/><path d="M33 26c-5-5 4-7-1-12m10 11c-5-5 4-7-1-12m10 13c-5-5 4-7-1-12" fill="none" stroke={p.main} strokeWidth="2.6" {...S}/></g>;
    case "syn.short":
      return <g><path d="M17 20v31h15M55 20v31H40" fill="none" stroke="#4B94CE" strokeWidth="6" {...S}/><path d="m40 15-11 18h9l-5 15 14-21h-9Z" fill="#F7C531" {...common}/><circle cx="18" cy="19" r="5" fill="#DCECF9" {...common}/><circle cx="54" cy="19" r="5" fill="#FFF1B8" {...common}/><path d="M25 53h22" stroke={p.ink} strokeWidth="3" strokeDasharray="3 4" {...S}/></g>;
    case "syn.greenhouse":
      return <g><path d="m14 37 22-21 22 21v20H14Z" fill={p.light} {...common}/><path d="M36 17v40M16 37h40" fill="none" {...common}/><path d="M28 51c-2-11 2-17 8-20 6 4 9 10 6 20Z" fill="#57B84C" {...common}/><path d="M36 47c-5-6-10-8-15-8 0 8 6 12 15 10m1-4c5-6 9-8 14-8 0 8-5 11-14 10" fill="#79C765" {...common}/><circle cx="50" cy="25" r="5" fill="#FFB03A"/></g>;
    case "syn.permafrost":
      return <g><path d="M12 43c8-9 14-13 24-13s16 4 24 13l-7 13H19Z" fill="#7BD3E8" {...common}/><path d="m18 43 6 4 7-6 7 6 8-5 8 4" fill="none" stroke={p.light} strokeWidth="3" {...S}/><path d="M36 31V16m0 0-6 6m6-6 6 6" fill="none" {...common}/><path d="M19 34c-5-7-2-14 5-17 5 7 2 14-5 17Z" fill="#57B84C" {...common}/></g>;
    case "syn.lightningrod":
      return <g><rect x="16" y="23" width="38" height="34" rx="13" fill="#9A9AA6" {...common}/><path d="M54 33h5v14h-5" fill="#F7C531" {...common}/><path d="m39 13-12 19h10l-7 19 17-25H37l8-13Z" fill="#F7C531" {...common}/><path d="M24 51c6 4 13 4 20 0" fill="none" stroke={p.light} strokeWidth="3" {...S}/></g>;
    case "syn.mudslide":
      return <g><path d="M11 51c9-11 12-21 21-30 5 12 15 20 29 30Z" fill="#8A6437" {...common}/><path d="M16 49c8-5 12-9 15-16 4 7 11 11 22 16" fill="#B78A53"/><path d="M18 24c0-7 5-11 12-11 0 8-4 12-12 11Z" fill="#57B84C" {...common}/><path d="M47 20c0-5 4-9 8-10 2 6-1 10-8 10Z" fill="#79C765" {...common}/><path d="M50 29c0-5 5-8 6-13 4 5 6 9 2 13Z" fill="#4B94CE" {...common}/></g>;
    case "base.fire":
      return <g><path d="M15 52h42v8H15Z" fill={p.ink} {...common}/><path d="M23 52V38h26v14Z" fill={p.light} {...common}/><path d="M29 39c-3-9 6-14 8-25 10 9 12 18 5 26Z" fill={p.main} {...common}/><path d="m49 32 7-7m0 0h-7m7 0v7" fill="none" stroke={p.accent} strokeWidth="3" {...S}/></g>;
    case "base.water":
      return <g><path d="M18 46c0-11 12-19 18-32 7 13 18 21 18 32a18 18 0 0 1-36 0Z" fill={p.main} {...common}/><path d="M27 46c3 6 12 8 19 2" fill="none" stroke={p.light} strokeWidth="3" {...S}/><path d="M58 42V24m0 0-6 7m6-7 6 7" fill="none" stroke={p.accent} strokeWidth="3" {...S}/></g>;
    case "base.grass":
      return <g><path d="M22 45h28l-4 15H26Z" fill={p.accent} {...common}/><path d="M36 46V24" fill="none" stroke={p.ink} strokeWidth="4" {...S}/><path d="M35 33c-11 1-16-5-15-14 10-1 16 5 15 14Zm2 7c10 1 16-5 15-14-10-1-15 5-15 14Z" fill={p.main} {...common}/><path d="M57 29V16m0 0-5 6m5-6 5 6" fill="none" stroke={p.accent} strokeWidth="3" {...S}/></g>;
    case "base.electric":
      return <g><rect x="18" y="24" width="35" height="30" rx="5" fill={p.light} {...common}/><path d="M53 34h6v10h-6" fill={p.main} {...common}/><path d="m38 17-10 17h9l-6 17 15-22h-9l7-12Z" fill={p.main} {...common}/><path d="M16 20h12m-6-6 6 6-6 6" fill="none" stroke={p.accent} strokeWidth="3" {...S}/></g>;
    case "base.ice":
      return <g><path d="m27 13 9 12 9-12 6 20-15 27-15-27Z" fill={p.main} {...common}/><circle cx="36" cy="38" r="12" fill={p.light} {...common}/><path d="M36 29v18m-8-13 16 9m-16 0 16-9" fill="none" stroke={p.accent} strokeWidth="2.8" {...S}/></g>;
    case "base.normal":
      return <g><path d="M17 27h38v30H17Z" fill={p.main} {...common}/><path d="M27 27v-8h18v8M17 38h38" fill="none" {...common}/><path d="m36 32 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" fill={p.light} {...common}/><path d="M58 33V18m0 0-5 6m5-6 5 6" fill="none" stroke={p.accent} strokeWidth="3" {...S}/></g>;
    case "staff.fire3":
      return <g><rect x="18" y="14" width="35" height="44" rx="4" fill={p.light} {...common}/><path d="M25 25h20m-20 8h17m-17 8h11" fill="none" stroke={p.main} strokeWidth="2.5" {...S}/><path d="m40 49 14-14m-4 4 8 8M40 49l-4 9 9-4" fill="none" stroke={p.accent} strokeWidth="4" {...S}/><path d="M15 20h9" stroke={p.accent} strokeWidth="3" {...S}/></g>;
    case "staff.severance":
      return <g><path d="M13 29h46v29H13Z" fill={p.main} {...common}/><path d="m13 29 23 17 23-17" fill={p.light} {...common}/><path d="m13 58 18-17m28 17L41 41" fill="none" {...common}/><circle cx="36" cy="28" r="11" fill={p.accent} {...common}/><path d="M36 21v14m-5-10h10m-9 6h8" fill="none" stroke={p.light} strokeWidth="2.3" {...S}/></g>;
    case "staff.movedesk":
      return <g><path d="M12 28h20v13H12Zm28 4h20v13H40Z" fill={p.main} {...common}/><path d="M17 41v14m10-14v14m18-10v10m10-10v10" fill="none" {...common}/><path d="M18 20h29l-5-5m12 11H25l5 5" fill="none" stroke={p.accent} strokeWidth="3" {...S}/></g>;
    case "staff.expand":
      return <g><path d="M18 21h36v35H18Z" fill={p.light} {...common}/><path d="M18 38h36M36 21v35" fill="none" stroke={p.main} strokeWidth="2.6" {...S}/><path d="M10 29V13h16m-8-5 8 5-8 5M62 47v15H46m8 5-8-5 8-5" fill="none" stroke={p.accent} strokeWidth="3.2" {...S}/><circle cx="27" cy="30" r="4" fill={p.main}/><circle cx="45" cy="47" r="4" fill={p.main}/></g>;
    case "staff.talentmarket":
      return <g><rect x="12" y="17" width="48" height="40" rx="5" fill={p.light} {...common}/><circle cx="28" cy="31" r="8" fill={p.main} {...common}/><path d="M16 52c1-10 5-15 12-15s11 5 12 15m7-20 5 5 8-11" fill="none" stroke={p.accent} strokeWidth="3" {...S}/></g>;
    case "staff.backfill":
      return <g><rect x="12" y="17" width="34" height="42" rx="5" fill={p.light} {...common}/><circle cx="29" cy="31" r="8" fill={p.main} {...common}/><path d="M17 54c1-10 5-15 12-15s11 5 12 15" fill="none" stroke={p.accent} strokeWidth="3" {...S}/><circle cx="53" cy="43" r="12" fill={p.main} {...common}/><path d="M53 36v14m-7-7h14" fill="none" stroke={p.light} strokeWidth="3.2" {...S}/></g>;
    case "staff.loan":
      return <g><path d="m12 29 24-15 24 15Z" fill={p.main} {...common}/><path d="M16 31h40M19 31v20m11-20v20m12-20v20m11-20v20M13 56h46" fill="none" {...common}/><circle cx="36" cy="22" r="5" fill={p.light} {...common}/><path d="m47 48 9 9m0-9v9h-9" fill="none" stroke={p.accent} strokeWidth="3" {...S}/></g>;
    case "staff.pricecut":
      return <g><path d="M14 20h27l17 17-21 21-23-23Z" fill={p.main} {...common}/><circle cx="24" cy="29" r="4" fill={p.light} {...common}/><path d="m27 47 18-18m-15 3h.1m12 13h.1" stroke={p.light} strokeWidth="4" {...S}/><path d="M14 54h13m-6-6 6 6-6 6" fill="none" stroke={p.accent} strokeWidth="3" {...S}/></g>;
  }
  id satisfies never;
  return null;
}
