// 出战准备(loadout):先亮本局六桌随机排布(桌图是信息,不是惩罚),
// 再从收藏(去重物种)里多选 3~10 个出战。每张物种卡露出进局关键数:
// 元素点 / 编号→吸取层数 / 基础值 / 工种基准价(% KPI)。选满区间才亮「开工」。

import { useMemo, useState } from "react";
import type { GameConfig } from "../../../types";
import { elementName, fmt, speciesDisplayName } from "../../../i18n";
import { useT } from "../../../useT";
import { formatCount } from "../../format";
import { SvgSprite } from "../../../sprites/SvgSprite";
import { ElementIcon } from "../../ElementIcon";
import { FACTORY_ROGUE } from "../../../i18n/factoryRogue";
import {
  hirePrice,
  kpiForShift,
  LOADOUT_MAX,
  LOADOUT_MIN,
  QUOTA_START,
  START_CASH,
} from "../rogueConfig";
import type { RogueElement, SpeciesRogueMeta } from "../rogueTypes";

function elementStripe(elements: RogueElement[], config: GameConfig): string {
  const colors = elements.map((element) => config.elements[element]?.color ?? "#C9CFD9");
  const safe = colors.length > 0 ? colors : ["#C9CFD9"];
  const stops = safe.flatMap((color, index) => {
    const start = (index / safe.length) * 100;
    const end = ((index + 1) / safe.length) * 100;
    return [`${color} ${start}%`, `${color} ${end}%`];
  });
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

// 上次出战名单的本地记忆键(与战绩存档 key `gulugulu.factory_rogue.v1` 区分,勿混用)。
const LAST_LOADOUT_KEY = "gulugulu.factory_rogue.lastLoadout";

// 读上次出战名单:只返回原始字符串数组,读取/解析失败一律退化为空。
// 加 SSR / 无 window 守卫 + try/catch(隐私模式或配额异常时不炸)。
function readLastLoadout(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LAST_LOADOUT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

// 写回本次出战名单;失败静默(隐私模式/配额)。
function writeLastLoadout(loadout: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_LOADOUT_KEY, JSON.stringify(loadout));
  } catch {
    // 忽略:本地记忆只是便利,写不进不影响出战。
  }
}

// 计算「初始默认选中」:读上次记忆 → 过滤掉已不在本局 meta 的物种 →
// 不足 LOADOUT_MAX(10) 则从未选中候选里补足。
// 补足优先级:编号(groupNo)降序 → 元素数(tierCount)降序 → 物种名 localeCompare 稳定兜底。
// 补到 10 即停;候选总数不足 10 则全选。首次无记录(过滤后 0 个)也走同一条补足路径。
function computeInitialPicked(meta: Record<string, SpeciesRogueMeta>): string[] {
  const remembered = readLastLoadout().filter((s) => meta[s] != null);
  // 去重,保留记忆里的先后顺序。
  const picked: string[] = [];
  const seen = new Set<string>();
  for (const s of remembered) {
    if (!seen.has(s)) {
      seen.add(s);
      picked.push(s);
    }
  }
  if (picked.length >= LOADOUT_MAX) return picked.slice(0, LOADOUT_MAX);

  // 未选中候选按补足优先级排序,依次补入直到达到 10 个或候选用尽。
  const fillers = Object.values(meta)
    .filter((m) => !seen.has(m.species))
    .sort(
      (a, b) =>
        b.groupNo - a.groupNo || b.tierCount - a.tierCount || a.species.localeCompare(b.species),
    );
  for (const m of fillers) {
    if (picked.length >= LOADOUT_MAX) break;
    picked.push(m.species);
  }
  return picked;
}

export function RogueLoadout({
  config,
  meta,
  deskOrder,
  onStart,
  onBack,
  firstRunGuide = false,
  onGuideLoadoutToggle,
}: {
  config: GameConfig;
  /** 物种 → 进局元数据(rogueSpecies.buildSpeciesMeta 的产物;键即候选名单)。 */
  meta: Record<string, SpeciesRogueMeta>;
  deskOrder: RogueElement[];
  onStart: (loadout: string[]) => void;
  onBack: () => void;
  firstRunGuide?: boolean;
  onGuideLoadoutToggle?: () => void;
}) {
  const { lang } = useT();
  const R = FACTORY_ROGUE[lang];
  // 惰性初始化:读上次记忆 → 过滤失效 → 不足 10 自动补足,作为默认选中(用户仍可自由增删)。
  const [picked, setPicked] = useState<string[]>(() => computeInitialPicked(meta));

  // 候选名单:按工种(元素数)→编号→物种名排序,读起来像一张分档工资表。
  const candidates = useMemo(
    () =>
      Object.values(meta).sort(
        (a, b) =>
          a.tierCount - b.tierCount || a.groupNo - b.groupNo || a.species.localeCompare(b.species),
      ),
    [meta],
  );

  const toggle = (species: string) => {
    setPicked((prev) =>
      prev.includes(species)
        ? prev.filter((s) => s !== species)
        : prev.length >= LOADOUT_MAX
          ? prev
          : [...prev, species],
    );
  };

  const ready = picked.length >= LOADOUT_MIN && picked.length <= LOADOUT_MAX;
  const guideSpecies = firstRunGuide ? picked[0] : undefined;
  const isZh = lang === "zh";

  // 出战准备是「局前」屏:KPI/现金/名额取第 1 班的权威初值(数值单源 = rogueConfig)。
  const shift1Kpi = kpiForShift(1);
  // 每个已选物种的每个元素都贡献一次；多元素物种会同时计入多个元素。
  const bagElements = picked.flatMap((species) => meta[species]?.elements ?? []);
  const bagElementTotal = bagElements.length;
  const bagElementStats = deskOrder.map((element) => {
    const count = bagElements.filter((candidate) => candidate === element).length;
    return {
      element,
      count,
      percentage: bagElementTotal > 0 ? (count / bagElementTotal) * 100 : 0,
    };
  });

  return (
    <div className="fr-overlay fr-lo-overlay">
      <div className="fr-lo-wrap" onPointerDown={(event) => event.stopPropagation()}>
        {/* ---- 顶栏:黄色标题便签 + 薄荷班次/KPI + 粉色现金 + 蓝色名额 ---- */}
        <div className="fr-lo-head">
          <button type="button" className="fr-note fr-note-plain fr-btn fr-lo-back" onClick={onBack}>
            {R.hubBack}
          </button>
          <div className="fr-note fr-note-yellow fr-lo-title">
            <span className="fr-fold" />
            {isZh ? "出战准备" : "SHIFT PREP"}
          </div>
          <span className="fr-note fr-note-mint fr-lo-shiftkpi">
            {isZh ? "第 1 班" : "Shift 1"} · KPI ${formatCount(shift1Kpi)}
          </span>
          <span className="fr-note fr-note-pink fr-lo-cash">${formatCount(START_CASH)}</span>
          <span className="fr-note fr-note-blue fr-lo-seats">👥 0/{QUOTA_START}</span>
        </div>

        <div className="fr-lo-sub">{fmt(R.loPick, { min: LOADOUT_MIN, max: LOADOUT_MAX })}</div>

        <div className="fr-lo-element-odds">
          <span className="fr-lo-element-odds-label">
            {isZh ? "签袋元素概率" : "DRAW BAG ELEMENT ODDS"}
          </span>
          <div className="fr-lo-element-odds-bar">
            {bagElementStats.map(({ element, count, percentage }) => {
              const info = config.elements[element];
              return (
                <div
                  key={element}
                  className={`fr-lo-element-odd${count === 0 ? " is-empty" : ""}`}
                  style={{
                    "--fr-el": info?.color ?? "#B07B44",
                    "--fr-weight": count || 0.0001,
                  } as React.CSSProperties}
                >
                  <ElementIcon
                    badge={info?.badge ?? "star"}
                    color={info?.color ?? "#B07B44"}
                    size={16}
                  />
                  <span>{elementName(element, lang)}</span>
                  <strong>{percentage.toFixed(1)}%</strong>
                </div>
              );
            })}
          </div>
        </div>

        {/* 物种多选(便签花名册卡:元素色顶边 + IN✓ 贴角 + ⛓ DRAIN 深底 chip) */}
        {candidates.length === 0 ? (
          <div className="fr-lo-empty">{R.loEmpty}</div>
        ) : (
          <div className="fr-lo-grid">
            {candidates.map((m) => {
              const info = config.species[m.species];
              const isPicked = picked.includes(m.species);
              const primary = m.elements[0] ?? "normal";
              const elColor = config.elements[primary]?.color ?? "#C9CFD9";
              const hire = hirePrice({ tierCount: m.tierCount, kpi: shift1Kpi, hiredThisShift: 0 });
              return (
                <button
                  type="button"
                  key={m.species}
                  className={`fr-lo-card${isPicked ? " is-picked" : ""}`}
                  data-coach={
                    firstRunGuide && m.species === guideSpecies
                      ? "factoryLoadoutCard"
                      : undefined
                  }
                  style={{
                    "--fr-el": elColor,
                    "--fr-stripe": elementStripe(m.elements, config),
                  } as React.CSSProperties}
                  onClick={() => {
                    toggle(m.species);
                    if (m.species === guideSpecies) onGuideLoadoutToggle?.();
                  }}
                >
                  <span className="fr-lo-card-stripe" aria-hidden="true" />
                  {isPicked && <span className="fr-lo-in">IN ✓</span>}
                  <div className="fr-lo-sprite">
                    <SvgSprite species={m.species} config={config} petState="idle" />
                  </div>
                  <div className="fr-lo-name">
                    {speciesDisplayName(m.species, lang, info?.nameZh, info?.nameEn)}
                  </div>
                  <div className="fr-lo-chiprow">
                    <span className="fr-lo-els">
                      {m.elements.map((el) => (
                        <ElementIcon
                          key={el}
                          badge={config.elements[el]?.badge ?? "star"}
                          color={config.elements[el]?.color ?? "#B07B44"}
                          size={22}
                          title={elementName(el, lang)}
                        />
                      ))}
                    </span>
                    <span className="fr-lo-hire">${hire}</span>
                  </div>
                  <div className="fr-lo-stats">
                    <span className="fr-lo-basev" title={fmt(R.loBaseValue, { n: m.baseValue })}>
                      ★{m.baseValue}
                    </span>
                    <span className="fr-lo-drain" title={fmt(R.loReach, { n: m.reach })}>
                      ⛓ {m.reach}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ---- 底栏:左侧分项说明 + 右侧选择计数/CLOCK IN ---- */}
        <div className="fr-lo-foot">
          <div className="fr-lo-legends">
            <span className="fr-note fr-lo-legend fr-lo-legend-score">
              {isZh
                ? "★ 打工业绩 = 咕噜本身产生的业绩"
                : "★ WORK PERFORMANCE = score produced by the Gulu"}
            </span>
            <span className="fr-note fr-lo-legend fr-lo-legend-drain">
              {isZh
                ? "⛓ 压榨数 = 可向下压榨的咕噜数量"
                : "⛓ EXPLOITATION COUNT = Gulus below that can be exploited"}
            </span>
          </div>
          <span className="fr-lo-count">
            {picked.length < LOADOUT_MIN
              ? fmt(R.loNeedMore, { min: LOADOUT_MIN })
              : fmt(R.loPicked, { n: picked.length, max: LOADOUT_MAX })}
          </span>
          <button
            type="button"
            className="fr-note fr-note-cta fr-btn fr-btn-primary fr-lo-clockin"
            data-coach={firstRunGuide ? "factoryLoadoutStart" : "factoryFormalStart"}
            disabled={!ready}
            onClick={() => {
              if (!ready) return;
              writeLastLoadout(picked); // 记住本次出战名单,下局默认沿用。
              onStart(picked);
            }}
          >
            {isZh ? "开工!" : "CLOCK IN!"}
          </button>
        </div>
      </div>
    </div>
  );
}
