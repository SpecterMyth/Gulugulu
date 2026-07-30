// 班末商店(03 §1 · 卡牌化三选一 + Sticky Note Pop 撕牌演出):三个维度**逐步三选一**——
// 一次只亮一维度的 3 张便签卡(元素技★恒为第 1 步),玩家「三选一」(买 / 跳过返现 /
// 刷新一次)。买中的卡 peelFly 折飞、其余 peelOff 折落、进下一步整排 stickOn 贴上;
// 三步全定后播放 2 秒便签过场 → 自动 finishShop。
// 撕牌是**纯 UI 演出**:本地状态机拦住点击、放完动画(~850ms)再调 RogueRunApi,
// 不改任何逻辑口径。一次性操作(解雇/搬桌/压价)买后仍让位为不挡点的暂停提示。
// 价格展示按 rogueConfig 单源公式本地复算(买不买得起最终由 buyCard 裁决)。

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { GameConfig } from "../../../types";
import { elementName, fmt } from "../../../i18n";
import { useT } from "../../../useT";
import { formatCount } from "../../format";
import { ElementIcon } from "../../ElementIcon";
import { FACTORY_ROGUE, type RogueCardText } from "../../../i18n/factoryRogue";
import {
  CARD_DEFS,
  CARD_LEVEL_PRICE_MULTIPLIER,
  CARD_PRICE_RATE,
  shopRerollCost,
  SHOP_SKIP_REFUND_RATE,
  type CardId,
} from "../rogueConfig";
import type { CardDef, RogueRunApi, RunView } from "../rogueTypes";
import { RogueCardIcon } from "./RogueCardIcon";
import {
  ROGUE_CARD_KEYWORDS,
  rogueKeywordText,
  type RogueKeywordId,
} from "../rogueKeywords";
import { emitPaperFx } from "../../../ui/PaperFx";

const CARD_DEF_BY_ID = new Map<string, CardDef>(CARD_DEFS.map((def) => [def.id, def]));
/** 首局强引导只指向能立即结算的卡，避免一次性点选任务把“点这里”目标切走。 */
const GUIDE_DEFERRED_CARD_IDS = new Set(["staff.fire3", "staff.movedesk", "staff.pricecut"]);

/** 撕牌演出时长(design §Interactions,speed 1)。 */
const PEEL_FLY_MS = 800;
const PEEL_OFF_MS = 620;
const SHOP_COMPLETE_MS = 2000;

/** 稀有度顶边色(design §Rarity)。 */
const RARITY_EDGE: Record<string, string> = {
  common: "#B5BCC8",
  rare: "#5A9CEE",
  epic: "#B06AF5",
  free: "#6FC75E",
};
/** 卡片微倾(三张各异)。 */
const TILTS = [-3, 0, 3];
const PRICECUT_TIER_COLORS = ["#8BCF73", "#62C7AE", "#65AEEA", "#8E91E8", "#D486D5", "#F29A63"];

/** 展示价:稀有度基价 ×1.5^当前已持有级× 当班 KPI(与逻辑层同一公式源)。 */
function displayPrice(def: CardDef, kpi: number, ownedLv: number): number {
  const rate = CARD_PRICE_RATE[def.rarity] ?? 0.06;
  return Math.max(1, Math.round(rate * kpi * Math.pow(CARD_LEVEL_PRICE_MULTIPLIER, ownedLv)));
}

function ShopComplete({ run, message }: { run: RogueRunApi; message: string }) {
  useEffect(() => {
    const timer = window.setTimeout(() => run.finishShop(), SHOP_COMPLETE_MS);
    return () => window.clearTimeout(timer);
  }, [run]);

  return (
    <div className="fr-shop-alldone" role="status" aria-live="polite">
      <div className="fr-shop-note-burst" aria-hidden="true">
        <span className="fr-shop-burst-note is-mint" />
        <span className="fr-shop-burst-note is-pink" />
        <span className="fr-shop-burst-note is-blue" />
        <span className="fr-shop-burst-note is-small" />
      </div>
      <div className="fr-note fr-note-yellow fr-shop-alldone-note">
        <span className="fr-fold" />
        <span className="fr-shop-alldone-check" aria-hidden="true">✓</span>
        <span className="fr-shop-alldone-txt">{message}</span>
      </div>
    </div>
  );
}

export function RogueShop({
  run,
  view,
  config,
  firstRunGuide = false,
}: {
  run: RogueRunApi;
  view: RunView;
  config: GameConfig;
  firstRunGuide?: boolean;
}) {
  const { lang } = useT();
  const R = FACTORY_ROGUE[lang];
  const isZh = lang === "zh";
  const shop = view.shop;
  const pendingSwap = run.pendingDeskSwap();

  // 撕牌本地状态机:{kind, idx}。idx = 被选中卡序(buy 用),skip/reroll 忽略。
  const [anim, setAnim] = useState<{ kind: "buy" | "skip" | "reroll"; idx: number } | null>(null);
  const [focusedKeyword, setFocusedKeyword] = useState<RogueKeywordId | null>(null);
  const [tipsOpen, setTipsOpen] = useState(false);
  const timerRef = useRef<number | null>(null);
  useEffect(() => () => { if (timerRef.current != null) window.clearTimeout(timerRef.current); }, []);

  // 当前步 = 首个未敲定维度(-1 = 三步全敲定)。
  const activeIndex = shop?.resolved.findIndex((resolved) => !resolved) ?? -1;
  // 步骤/刷新变化 → 清演出态,让新一排卡走 stickOn 入场。
  const rerolledKey = shop ? shop.rerollCounts.join("-") : "";
  useEffect(() => { setAnim(null); }, [activeIndex, rerolledKey]);

  if (shop == null) return null;

  const dimName = (dim: number) =>
    dim === 1 ? R.dim1 : dim === 2 ? R.dim2 : dim === 3 ? R.dim3 : dim === 4 ? R.dim4 : R.dim5;
  const rarityName = (r: CardDef["rarity"]) =>
    r === "epic" ? R.rarityEpic : r === "rare" ? R.rarityRare : R.rarityCommon;

  const skipRefund = Math.round(view.kpi * SHOP_SKIP_REFUND_RATE);

  // 一次性操作待完成(解雇剩余点选 / 搬桌选桌中 / 压价选工种):商店让位,操作在场景/HUD 提示条完成。
  const opBusy = view.pendingDismiss > 0 || pendingSwap || view.pendingPricecut;
  const allResolved = activeIndex < 0;
  const remaining = shop.resolved.filter((resolved) => !resolved).length;
  const busy = anim != null;

  // ---- 演出后再调逻辑层(拦住点击 → 放动画 → 提交) ----
  const runAfter = (ms: number, fn: () => void) => {
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(fn, ms);
  };
  const onBuy = (dimIndex: 0 | 1 | 2, id: string, i: number, anchor: DOMRect) => {
    if (busy) return;
    setAnim({ kind: "buy", idx: i });
    runAfter(PEEL_FLY_MS, () => {
      const bought = run.buyCard(dimIndex, id);
      // A rejected purchase does not change the step, so release the local lock.
      if (!bought) {
        setAnim(null);
        emitPaperFx({
          intensity: 1,
          preset: "failure",
          anchor,
          eventId: `factory-card-failed:${view.shiftIndex}:${dimIndex}:${id}`,
        });
        return;
      }
    });
  };
  const onSkip = (dimIndex: 0 | 1 | 2) => {
    if (busy) return;
    setAnim({ kind: "skip", idx: -1 });
    runAfter(PEEL_OFF_MS, () => run.skipDim(dimIndex));
  };
  const onReroll = (dimIndex: 0 | 1 | 2) => {
    if (busy) return;
    setAnim({ kind: "reroll", idx: -1 });
    runAfter(PEEL_OFF_MS, () => run.rerollDim(dimIndex));
  };
  // 每张卡的入场/离场动画(stickOn 入场;buy → 选中 peelFly、其余 peelOff;skip/reroll → 全 peelOff)。
  const cardAnim = (i: number): string => {
    if (anim == null) return `fr-stickOn 0.6s cubic-bezier(.25,1.2,.4,1) ${(i * 0.09).toFixed(2)}s both`;
    if (anim.kind === "buy" && anim.idx === i)
      return "fr-peelFly 0.8s cubic-bezier(.5,-.2,.85,.5) forwards";
    return `fr-peelOff 0.55s cubic-bezier(.6,0,.9,.6) ${(i * 0.07).toFixed(2)}s forwards`;
  };

  // ---- 一次性操作选择器:三种操作共用同一张商店区任务卡，卡外仍可点场景 ----
  if (opBusy) {
    const kind = view.pendingDismiss > 0 ? "dismiss" : pendingSwap ? "swap" : "pricecut";
    const title =
      kind === "dismiss"
        ? R.operationDismissTitle
        : kind === "swap"
          ? R.operationSwapTitle
          : R.operationPricecutTitle;
    const prompt =
      kind === "dismiss"
        ? fmt(R.hudDismiss, { n: view.pendingDismiss })
        : kind === "swap"
          ? R.operationSwapHint
          : R.operationPricecutHint;
    const icon = kind === "dismiss" ? "🔨" : kind === "swap" ? "🔀" : "💸";

    return (
      <div className={`fr-operation-layer is-${kind}`} aria-live="polite">
        <section className="fr-operation-card" onPointerDown={(event) => event.stopPropagation()}>
          <span className="fr-operation-tape" aria-hidden="true" />
          <header className="fr-operation-head">
            <span className="fr-operation-icon" aria-hidden="true">{icon}</span>
            <div className="fr-operation-heading">
              <span className="fr-operation-kicker">{R.operationKicker}</span>
              <h2>{title}</h2>
            </div>
            {kind === "dismiss" && (
              <span className="fr-operation-count">{view.pendingDismiss}</span>
            )}
          </header>

          <p className="fr-operation-prompt">{prompt}</p>

          {kind === "dismiss" && (
            <div className="fr-operation-scene-hint">
              <span className="fr-operation-cursor" aria-hidden="true">☝</span>
              <span>{R.operationDismissSceneHint}</span>
            </div>
          )}

          {kind === "swap" && (
            <div className="fr-operation-choices is-desk">
              {view.deskOrder.map((element) => {
                const info = config.elements[element];
                const picked = view.deskSwapFirst === element;
                return (
                  <button
                    type="button"
                    key={element}
                    className={`fr-operation-choice${picked ? " is-picked" : ""}`}
                    style={{ "--fr-choice": info?.color ?? "#B07B44" } as CSSProperties}
                    aria-pressed={picked}
                    onClick={() => run.pickDeskForSwap(element)}
                  >
                    {info != null && (
                      <span className="fr-operation-choice-icon" aria-hidden="true">
                        <ElementIcon badge={info.badge} color={info.color} size={28} />
                      </span>
                    )}
                    <span className="fr-operation-choice-label">{elementName(element, lang)}</span>
                    {picked && <span className="fr-operation-picked">{R.swapPicked}</span>}
                  </button>
                );
              })}
            </div>
          )}

          {kind === "pricecut" && (
            <div className="fr-operation-choices is-tier">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  type="button"
                  key={n}
                  className="fr-operation-choice"
                  style={{ "--fr-choice": PRICECUT_TIER_COLORS[n - 1] } as CSSProperties}
                  onClick={() => run.pickPricecutTier(n)}
                >
                  <span className="fr-operation-tier-num">{n}</span>
                  <span className="fr-operation-choice-label">{fmt(R.hudTierBtn, { n })}</span>
                </button>
              ))}
            </div>
          )}

          <footer className="fr-operation-foot">
            <span className="fr-operation-status-dot" aria-hidden="true" />
            {fmt(R.shopOpPaused, { n: remaining })}
          </footer>
          <span className="fr-fold" />
        </section>
      </div>
    );
  }

  return (
    <div className="fr-overlay fr-shop-overlay">
      <div className="fr-shop-wrap" onPointerDown={(event) => event.stopPropagation()}>
        {/* ---- 头部:黄色标题 + 薄荷轮次 + 进度点 + 已缴章 + 粉色现金 ---- */}
        {!allResolved && <div className="fr-shop-head">
          <div className="fr-note fr-note-yellow fr-shop-title">
            <span className="fr-fold" />
            {isZh ? "班末商店" : "SHIFT-END SHOP"}
          </div>
          <span className="fr-note fr-note-mint fr-shop-round">
            {fmt(R.shopStep, { n: (activeIndex as number) + 1, total: 3 })} ·{" "}
            {(activeIndex as number) === 0 ? "★ " : ""}
            {dimName(shop.dims[activeIndex as 0 | 1 | 2])}
          </span>
          <div className="fr-shop-dots" aria-hidden="true">
            {shop.resolved.map((done, i) => (
              <span key={i} className={`fr-shop-dot${done ? " is-on" : ""}`} />
            ))}
          </div>
          <div className="fr-paid">
            <span className="fr-paid-bill">
              {fmt(R.shopBillPaid, { v: `¥${formatCount(view.bill)}` })}
            </span>
            <span className="fr-paid-stamp">{R.paidStamp}</span>
          </div>
          <span className="fr-note fr-note-pink fr-shop-cash">💰 {formatCount(view.cash)}</span>
        </div>}

        {allResolved ? (
          <ShopComplete run={run} message={R.shopAllDone} />
        ) : (
          (() => {
            const dimIndex = activeIndex as 0 | 1 | 2;
            const rerollCost = shopRerollCost(view.kpi, shop.rerollCounts[dimIndex]);
            const guideCardIndex = firstRunGuide
              ? shop.cards[dimIndex].findIndex((id) => {
                  if (GUIDE_DEFERRED_CARD_IDS.has(id)) return false;
                  const def = CARD_DEF_BY_ID.get(id);
                  if (def == null) return false;
                  const ownedLv = view.cards[id] ?? 0;
                  const maxed = def.maxLevel != null && ownedLv >= def.maxLevel;
                  const price = def.free ? 0 : displayPrice(def, view.kpi, ownedLv);
                  const loanBusy = id === "staff.loan" && view.loan != null;
                  return !maxed && !loanBusy && (def.free || view.cash >= price);
                })
              : -1;
            const keywordIds = [...new Set(
              shop.cards[dimIndex].flatMap((id) => ROGUE_CARD_KEYWORDS[id as CardId] ?? []),
            )];
            return (
              <div className="fr-shop-step">
                <div className="fr-shop-layout">
                  <div className="fr-shop-main">
                {/* key=步骤+刷新:每进一步/刷新重挂,重播 stickOn 入场 */}
                <div className="fr-shop-cards" key={`${dimIndex}-${rerolledKey}`}>
                  {shop.cards[dimIndex].map((id, i) => {
                    const def = CARD_DEF_BY_ID.get(id);
                    if (def == null) return null;
                    const text: RogueCardText | undefined = R.cards[id as CardId];
                    const ownedLv = view.cards[id] ?? 0;
                    const maxed = def.maxLevel != null && ownedLv >= def.maxLevel;
                    const price = def.free ? 0 : displayPrice(def, view.kpi, ownedLv);
                    // 贷款同一时间至多一笔在还(在还期间置灰)。
                    const loanBusy = id === "staff.loan" && view.loan != null;
                    const affordable = def.free || view.cash >= price;
                    const disabled = maxed || loanBusy || !affordable || busy;
                    const cardElements = def.element != null ? [def.element] : (def.pair ?? []);
                    const cardKeywords = ROGUE_CARD_KEYWORDS[id as CardId] ?? [];
                    const edge = def.free ? RARITY_EDGE.free : RARITY_EDGE[def.rarity];
                    // 价格条底色:免费=绿、稀有/史诗=热粉、普通=墨。
                    const barCls = def.free
                      ? "is-free"
                      : def.rarity === "common"
                        ? "is-ink"
                        : "is-cta";
                    return (
                      <div className="fr-card-wrap" key={id} style={{ transform: `rotate(${TILTS[i] ?? 0}deg)` }}>
                        <div className="fr-card-residue" aria-hidden="true" />
                        <div
                          className={`fr-card fr-card-big is-${def.rarity}`}
                          style={{ borderTopColor: edge, animation: cardAnim(i) }}
                        >
                          <span className="fr-fold" />
                          <div className="fr-card-top">
                            <span className="fr-card-rarity">
                              {def.free ? R.shopFree : rarityName(def.rarity)}
                            </span>
                            {cardElements.length > 0 && (
                              <div
                                className={`fr-card-elements${cardElements.length > 1 ? " is-pair" : ""}`}
                                aria-label={cardElements.map((el) => elementName(el, lang)).join(" + ")}
                              >
                                {cardElements.map((element) => {
                                  const info = config.elements[element];
                                  if (info == null) return null;
                                  return (
                                    <span className="fr-card-element" key={element}>
                                      <ElementIcon
                                        badge={info.badge}
                                        color={info.color}
                                        title={elementName(element, lang)}
                                        size={26}
                                      />
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          <div className="fr-card-artblock">
                            <RogueCardIcon id={id as CardId} title={text?.name ?? id} />
                          </div>

                          <div className="fr-card-name">{text?.name ?? id}</div>
                          {ownedLv > 0 && (
                            <span className="fr-card-lv">
                              {maxed ? R.shopMaxLv : fmt(R.shopOwnedLv, { lv: ownedLv })}
                            </span>
                          )}
                          {cardKeywords.length > 0 && (
                            <div className="fr-card-keywords">
                              {cardKeywords.map((keyword) => {
                                const keywordText = rogueKeywordText(keyword, lang);
                                const tipId = `fr-keyword-tip-${dimIndex}-${i}-${keyword}`;
                                return (
                                  <button
                                    type="button"
                                    key={keyword}
                                    className={`fr-card-keyword${focusedKeyword === keyword ? " is-active" : ""}`}
                                    aria-describedby={tipId}
                                    onPointerEnter={() => setFocusedKeyword(keyword)}
                                    onPointerLeave={() => setFocusedKeyword(null)}
                                    onFocus={() => setFocusedKeyword(keyword)}
                                    onBlur={() => setFocusedKeyword(null)}
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    【{keywordText.name}】
                                    <span id={tipId} className="fr-card-keyword-tip" role="tooltip">
                                      <strong>【{keywordText.name}】</strong>
                                      <span>{keywordText.tip}</span>
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          <div className="fr-card-desc">{text?.desc(Math.max(1, ownedLv + 1)) ?? ""}</div>

                          <button
                            type="button"
                            className={`fr-card-buybar ${barCls}`}
                            data-coach={
                              firstRunGuide && i === guideCardIndex
                                ? "factoryShopChoice"
                                : undefined
                            }
                            disabled={disabled}
                            onClick={(event) => onBuy(dimIndex, id, i, event.currentTarget.getBoundingClientRect())}
                          >
                            {def.free
                              ? isZh ? "免费拿" : "TAKE IT"
                              : `${R.shopBuy} ¥${formatCount(price)}`}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="fr-shop-actions">
                  <button
                    type="button"
                    className="fr-note fr-btn fr-shop-act fr-shop-act-reroll"
                    disabled={busy || view.cash < rerollCost}
                    onClick={() => onReroll(dimIndex)}
                  >
                    ↻ {fmt(R.shopReroll, { v: formatCount(rerollCost) })}
                  </button>
                  <button
                    type="button"
                    className="fr-note fr-btn fr-shop-act fr-shop-act-skip"
                    data-coach={
                      firstRunGuide && guideCardIndex < 0
                        ? "factoryShopChoice"
                        : undefined
                    }
                    disabled={busy}
                    onClick={() => onSkip(dimIndex)}
                  >
                    {fmt(R.shopSkip, { v: formatCount(skipRefund) })}
                  </button>
                </div>
                  </div>
                  <aside
                    className={`fr-shop-keyword-panel${tipsOpen ? " is-open" : ""}`}
                    aria-label={isZh ? "关键词说明" : "Keyword tips"}
                  >
                    <button
                      type="button"
                      className="fr-shop-keyword-title"
                      onClick={() => setTipsOpen((open) => !open)}
                    >
                      {isZh ? "关键词说明" : "KEYWORD TIPS"}
                    </button>
                    {keywordIds.length === 0 ? (
                      <div className="fr-shop-keyword-empty">
                        {isZh ? "当前卡片没有额外关键词" : "No extra keywords on these cards"}
                      </div>
                    ) : keywordIds.map((keyword) => {
                      const text = rogueKeywordText(keyword, lang);
                      return (
                        <div
                          key={keyword}
                          className={`fr-shop-keyword-tip${focusedKeyword === keyword ? " is-active" : ""}`}
                          onPointerEnter={() => setFocusedKeyword(keyword)}
                          onPointerLeave={() => setFocusedKeyword(null)}
                        >
                          <strong>【{text.name}】</strong>
                          <span>{text.tip}</span>
                        </div>
                      );
                    })}
                  </aside>
                </div>
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
}
