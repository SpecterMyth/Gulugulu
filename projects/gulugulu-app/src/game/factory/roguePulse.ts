// 六元素团队业绩结算。状态改变（冻结/同化/生长）由 RogueRun 在主脉冲入账后执行；
// 本文件只计算一次落地的打工业绩、压榨业绩、团队业绩与可视化触发记录。

import {
  ABSORB_FACTOR,
  CARD_PARAMS,
  COMBO_CAP,
  COMBO_PER_STACK,
  cardsForElementPlacement,
  elementReachBonus,
  valueAtLevel,
} from "./rogueConfig";
import { absorbSet, buildAdjacency, deskPaths, type Adjacency } from "./rogueGraph";
import type {
  BodyLike,
  DeskLike,
  PulseBreakdown,
  RogueBodyState,
  RogueElement,
  RogueTriggerEvent,
  SpeciesRogueMeta,
} from "./rogueTypes";

export type PulseCtx = {
  uid: number;
  bodies: BodyLike[];
  desks: DeskLike[];
  meta: Record<string, SpeciesRogueMeta>;
  effBase: (uid: number) => number;
  cards: Record<string, number>;
  comboStacks: number;
  stateOf?: (uid: number) => RogueBodyState | undefined;
  opts?: {
    stickOverride?: (a: BodyLike, b: BodyLike) => boolean | null;
    /** 候选落点批量评分时复用的完整邻接图（已包含吸收继承连接）。 */
    adjacency?: Adjacency;
  };
};

/** 构建计分使用的完整连接图，并合入一般系吸收后继承的逻辑连接。 */
export function buildPulseAdjacency(
  bodies: BodyLike[],
  stateOf?: (uid: number) => RogueBodyState | undefined,
  stickOverride?: (a: BodyLike, b: BodyLike) => boolean | null,
): Adjacency {
  const adj = buildAdjacency(bodies, { stickOverride });
  for (const body of bodies) {
    for (const targetUid of stateOf?.(body.uid)?.absorbedLinks ?? []) {
      if (!adj.has(targetUid) || targetUid === body.uid) continue;
      const own = adj.get(body.uid)!;
      const target = adj.get(targetUid)!;
      if (!own.includes(targetUid)) own.push(targetUid);
      if (!target.includes(body.uid)) target.push(body.uid);
    }
  }
  return adj;
}

export function normalTagsForCards(cards: Record<string, number>): RogueElement[] {
  void cards;
  return [];
}

export function comboParams(_cards: Record<string, number>): { per: number; cap: number } {
  return { per: COMBO_PER_STACK, cap: COMBO_CAP };
}

/** 本次团队只包含投放者与实际被压榨的咕噜；Buff 演出目标不属于团队。 */
export function pulseTeamUids(
  pulse: Pick<PulseBreakdown, "uid" | "absorbUids">,
): number[] {
  return [...new Set([pulse.uid, ...pulse.absorbUids])];
}

/** 单次主脉冲最多播放的角色技能触发数，与 RoguePulseFx 的演出预算一致。 */
export const PULSE_TRIGGER_MAX = 12;
/** 单个技能触发最多同时落到的可见角色数，与 RoguePulseFx 的演出预算一致。 */
export const PULSE_TRIGGER_TARGET_MAX = 5;

/** 物理接桌数 → 实际计分次数。 */
export function deskScoreMultiplier(deskCount: number): number {
  return [0, 1, 2, 4, 8, 12, 16][Math.min(6, Math.max(0, Math.round(deskCount)))] ?? 0;
}

/**
 * 聚光 = 实际团队 + 确实得到可见演出/额外计分的角色。
 * 大型结构统计可以保留完整 targetUids 供规则计算，但只有演出预算内真正播放
 * 特效的目标会被点亮，避免几十只连通角色一起冒充本次团队。
 */
export function pulseSpotlightUids(
  pulse: Pick<PulseBreakdown, "uid" | "absorbUids" | "extras" | "triggers">,
): number[] {
  const uids = new Set(pulseTeamUids(pulse));
  for (const extra of pulse.extras) uids.add(extra.uid);

  const triggers = pulse.triggers ?? [];
  // 收尾层不受主脉冲 12 条预算约束：冻结、生长、吞噬变形都必须照亮实际目标。
  for (const trigger of triggers) {
    if (
      trigger.kind !== "freeze"
      && trigger.kind !== "grow"
      && trigger.kind !== "absorb"
      && trigger.kind !== "emperor"
    ) continue;
    uids.add(trigger.sourceUid);
    for (const targetUid of trigger.targetUids ?? []) uids.add(targetUid);
  }

  triggers
    .filter((trigger) => trigger.kind !== "freeze" && trigger.kind !== "grow")
    .slice(0, PULSE_TRIGGER_MAX)
    .forEach((trigger) => {
      uids.add(trigger.sourceUid);
      for (const targetUid of (trigger.targetUids ?? []).slice(0, PULSE_TRIGGER_TARGET_MAX)) {
        uids.add(targetUid);
      }
    });
  return [...uids];
}

/** 新一般系不再靠标签粘连；仅保留明确写在连携卡上的结构改写。 */
export function stickOverrideForCards(
  cards: Record<string, number>,
): ((a: BodyLike, b: BodyLike) => boolean | null) | null {
  const lightningrod = (cards["syn.lightningrod"] ?? 0) > 0;
  const frostroot = (cards["syn.permafrost"] ?? 0) > 0;
  if (!lightningrod && !frostroot) return null;
  return (a, b) => {
    if (
      frostroot
      && (
        (a.elements.includes("ice") && b.elements.includes("grass"))
        || (a.elements.includes("grass") && b.elements.includes("ice"))
      )
    ) return true;
    if (!a.elements.includes("normal") && !b.elements.includes("normal")) return null;
    const normal = a.elements.includes("normal") ? a : b;
    const other = normal === a ? b : a;
    if (lightningrod && other.elements.includes("electric")) return true;
    return null;
  };
}

/** 双系连携开放专属中继；一般系本身不再凭标签中继。 */
export function relayAllowedForCards(
  cards: Record<string, number>,
  stateOf?: (uid: number) => RogueBodyState | undefined,
): (body: BodyLike, element: string) => boolean {
  void stateOf;
  const bionet = (cards["syn.bionet"] ?? 0) > 0;
  const lightningrod = (cards["syn.lightningrod"] ?? 0) > 0;
  return (body, element) => (
    (lightningrod && body.elements.includes("normal") && element === "electric")
    || (bionet && element === "electric" && stateOf?.(body.uid)?.generated === true)
  );
}

function tierCountOf(meta: Record<string, SpeciesRogueMeta>, body: BodyLike): number {
  return meta[body.species]?.tierCount ?? Math.min(6, Math.max(1, body.elements.length));
}

function connectedComponent(start: number, adj: Map<number, number[]>): number[] {
  const seen = new Set<number>([start]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    for (const next of adj.get(queue[i]) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return queue;
}

function runPipeline(ctx: PulseCtx, withCombo: boolean, withExtras: boolean): { bd: PulseBreakdown; raw: number } {
  const { uid, bodies, desks, meta } = ctx;
  const byUid = new Map(bodies.map((body) => [body.uid, body]));
  const self = byUid.get(uid);
  const triggers: RogueTriggerEvent[] = [];
  if (self == null) {
    return {
      bd: {
        uid,
        species: "",
        base: 0,
        absorbSum: 0,
        absorbUids: [],
        chips: 0,
        elementMult: 1,
        synergyCardMult: 1,
        jobMult: 1,
        rhythmMult: 1,
        individualMult: 1,
        teamMult: 1,
        networkMult: 1,
        statusMult: 1,
        skillMult: 1,
        synergyMult: 1,
        comboMult: 1,
        desks: [],
        deskCount: 0,
        deskScoreMult: 0,
        deskPaths: {},
        total: 0,
        contributors: [],
        extras: [],
        triggers,
      },
      raw: 0,
    };
  }

  const cards = cardsForElementPlacement(self.elements, ctx.cards);
  const lvl = (id: string) => cards[id] ?? 0;
  const has = (body: BodyLike, element: string) => body.elements.includes(element);
  const stickOverride = ctx.opts?.stickOverride ?? stickOverrideForCards(cards) ?? undefined;
  const adj = ctx.opts?.adjacency
    ?? buildPulseAdjacency(bodies, ctx.stateOf, stickOverride);

  let reach = (meta[self.species]?.reach ?? 2) + elementReachBonus(self.elements, cards);
  const superconductLevel = lvl("syn.superconduct");
  const absorbUids = absorbSet(bodies, adj, uid, reach);
  // 「团队」统一指本次投放者与本次被压榨的咕噜，不是全场单位。
  const teamUids = pulseTeamUids({ uid: self.uid, absorbUids });
  const sameNameUids = teamUids
    .filter((targetUid) => byUid.get(targetUid)?.species === self.species);
  const sameCount = sameNameUids.length;

  const emberLevel = lvl("fire.ember");
  const sameLevel = lvl("water.same");
  const coldRotationLevel = lvl("syn.coldRotation");
  let absorbSum = 0;
  const absorbedValues: { uid: number; species: string; value: number }[] = [];
  for (const targetUid of absorbUids) {
    const target = byUid.get(targetUid);
    if (target == null) continue;
    const state = ctx.stateOf?.(targetUid);
    const targetBase = ctx.effBase(targetUid);
    let exploitationBonus = 0;
    if (emberLevel > 0 && has(target, "fire") && has(self, "fire")) {
      exploitationBonus += valueAtLevel(CARD_PARAMS["fire.ember"].asAbsorbed, emberLevel) - 1;
    }
    if (coldRotationLevel > 0 && state?.frozen) {
      const mass = Math.max(1, state.sizeLevel ?? 1);
      exploitationBonus += valueAtLevel(CARD_PARAMS["syn.coldRotation"].perMass, coldRotationLevel) * (mass - 1);
    }
    const value = targetBase * (1 + exploitationBonus);
    absorbSum += value;
    absorbedValues.push({ uid: targetUid, species: target.species, value });
  }
  if (emberLevel > 0 && absorbedValues.some((item) => has(byUid.get(item.uid)!, "fire"))) {
    triggers.push({ kind: "ember", sourceUid: uid, targetUids: absorbUids });
  }
  if (sameLevel > 0 && sameCount > 0) {
    triggers.push({ kind: "sameName", sourceUid: uid, targetUids: sameNameUids, value: sameCount });
  }

  const base = ctx.effBase(uid);
  const chips = base + ABSORB_FACTOR * absorbSum;
  const extraBases: Record<string, number[]> = {};
  for (const body of bodies) {
    for (const element of ctx.stateOf?.(body.uid)?.absorbedDesks ?? []) {
      (extraBases[element] ??= []).push(body.uid);
    }
  }
  const paths = deskPaths(bodies, adj, desks, uid, {
    relayAllowed: relayAllowedForCards(cards, ctx.stateOf),
    extraBases,
  });
  const deskElements = Object.keys(paths);
  let pathEdges = Object.values(paths).reduce((sum, path) => sum + Math.max(0, path.length - 1), 0);
  const usedDepth = absorbUids.length;

  let elementBonus = 0;
  let synergyBonus = 0;
  let jobBonus = 0;
  const burstLevel = lvl("fire.burst");
  if (burstLevel > 0 && has(self, "fire")) {
    triggers.push({
      kind: "ignite",
      sourceUid: uid,
      targetUids: teamUids.filter((targetUid) => has(byUid.get(targetUid)!, "fire")),
      value: valueAtLevel(CARD_PARAMS["fire.burst"].repeats, burstLevel),
    });
  }
  const wildfireLevel = lvl("fire.wildfire");
  if (wildfireLevel > 0 && has(self, "fire")) {
    const limit = valueAtLevel(CARD_PARAMS["fire.wildfire"].spread, wildfireLevel);
    const reached: number[] = [];
    const seen = new Set<number>([self.uid]);
    const queue = [self.uid];
    for (let i = 0; i < queue.length && reached.length < limit; i++) {
      for (const next of adj.get(queue[i]) ?? []) {
        if (seen.has(next)) continue;
        seen.add(next);
        const target = byUid.get(next);
        if (target == null || !has(target, "fire")) continue;
        queue.push(next);
        reached.push(next);
        if (reached.length >= limit) break;
      }
    }
    if (reached.length > 0) {
      triggers.push({ kind: "wildfire", sourceUid: uid, targetUids: reached, value: reached.length });
    }
  }
  if (sameLevel > 0 && has(self, "water") && sameCount > 0) {
    const countedSame = Math.min(CARD_PARAMS["water.same"].countCap, sameCount);
    elementBonus += Math.pow(
      valueAtLevel(CARD_PARAMS["water.same"].perTeamSame, sameLevel),
      countedSame,
    ) - 1;
  }
  const gluttonyLevel = lvl("normal.gluttony");
  if (gluttonyLevel > 0 && has(self, "normal")) {
    const mass = Math.max(1, ctx.stateOf?.(self.uid)?.sizeLevel ?? 1);
    if (mass > 1) {
      elementBonus += valueAtLevel(CARD_PARAMS["normal.gluttony"].perSize, gluttonyLevel) * (mass - 1);
      triggers.push({ kind: "gluttony", sourceUid: uid, value: mass });
    }
  }
  const overloadLevel = lvl("electric.overload");
  if (overloadLevel > 0 && has(self, "electric") && usedDepth > 0) {
    elementBonus += valueAtLevel(CARD_PARAMS["electric.overload"].perDepth, overloadLevel) * usedDepth;
    triggers.push({ kind: "overload", sourceUid: uid, value: usedDepth });
  }
  const parallelLevel = lvl("electric.parallel");
  if (parallelLevel > 0 && has(self, "electric") && deskElements.length > 1) {
    const connectedDeskCount = deskElements.length;
    const extraDeskCount = connectedDeskCount - 1;
    elementBonus += valueAtLevel(CARD_PARAMS["electric.parallel"].perExtraDesk, parallelLevel) * extraDeskCount;
    // 演出显示真实桌数，而不是经过二次换算的“分流点”。
    triggers.push({ kind: "parallel", sourceUid: uid, value: connectedDeskCount });
  }
  const inductionLevel = lvl("electric.induction");
  if (inductionLevel > 0 && has(self, "electric") && pathEdges > 0) {
    elementBonus += valueAtLevel(CARD_PARAMS["electric.induction"].perLink, inductionLevel) * pathEdges;
    triggers.push({ kind: "induction", sourceUid: uid, value: pathEdges, persistent: true });
  }
  const overstaffLevel = lvl("ice.overstaff");
  if (overstaffLevel > 0 && has(self, "ice")) {
    const freePopulation = bodies.filter((body) => {
      const state = ctx.stateOf?.(body.uid);
      return state?.frozen || state?.generated;
    }).length;
    const counted = freePopulation;
    if (counted > 0) {
      elementBonus += valueAtLevel(CARD_PARAMS["ice.overstaff"].per, overstaffLevel) * counted;
      triggers.push({ kind: "overstaff", sourceUid: uid, value: counted, persistent: true });
    }
  }
  const connected = connectedComponent(uid, adj);
  const crowdLevel = lvl("grass.crowd");
  if (crowdLevel > 0 && has(self, "grass")) {
    const connectedCount = connected.length;
    const connectedBonus = valueAtLevel(CARD_PARAMS["grass.crowd"].perConnected, crowdLevel)
      * connectedCount;
    elementBonus += connectedBonus;
    triggers.push({ kind: "lush", sourceUid: uid, targetUids: connected, value: connectedCount, persistent: true });
  }
  const heightLevel = lvl("grass.height");
  if (heightLevel > 0 && has(self, "grass") && deskElements.length > 0) {
    const height = Math.min(
      CARD_PARAMS["grass.height"].cap,
      Object.values(paths).reduce((sum, path) => sum + path.length, 0),
    );
    elementBonus += valueAtLevel(CARD_PARAMS["grass.height"].perLayer, heightLevel) * Math.max(0, height - 1);
    triggers.push({ kind: "height", sourceUid: uid, targetUids: connected, value: height, persistent: true });
  }

  const selfTier = tierCountOf(meta, self);
  const attrChecks: Array<[string, boolean, number]> = [
    ["attr.pure", selfTier === 1, valueAtLevel(CARD_PARAMS["attr.pure"].mult, lvl("attr.pure"))],
    ["attr.dual", selfTier === 2, valueAtLevel(CARD_PARAMS["attr.dual"].mult, lvl("attr.dual"))],
    ["attr.slash", selfTier === 3, valueAtLevel(CARD_PARAMS["attr.slash"].mult, lvl("attr.slash"))],
  ];
  for (const [id, match, mult] of attrChecks) {
    if (lvl(id) > 0 && match) jobBonus += Math.max(0, mult - 1);
  }
  const hexLevel = lvl("attr.hex");
  if (hexLevel > 0 && selfTier >= CARD_PARAMS["attr.hex"].minCount) {
    jobBonus += valueAtLevel(CARD_PARAMS["attr.hex"].perElement, hexLevel) * selfTier;
  }
  const balanceLevel = lvl("attr.balance");
  if (balanceLevel > 0) {
    const tiers = new Set(bodies.filter((body) => body.settled).map((body) => tierCountOf(meta, body)));
    if (tiers.size >= 6) jobBonus += valueAtLevel(CARD_PARAMS["attr.balance"].mult, balanceLevel) - 1;
  }

  const arcLevel = lvl("syn.arcIgnite");
  if (arcLevel > 0 && has(self, "fire") && deskElements.includes("electric") && deskElements.length > 1) {
    const extraDesks = deskElements.length - 1;
    synergyBonus += valueAtLevel(CARD_PARAMS["syn.arcIgnite"].perDesk, arcLevel) * extraDesks;
    triggers.push({ kind: "arcIgnite", sourceUid: uid, value: extraDesks });
  }
  const steamBurstLevel = lvl("syn.steamBurst");
  if (steamBurstLevel > 0 && has(self, "fire")) {
    const waterSame = sameNameUids.filter((targetUid) => has(byUid.get(targetUid)!, "water")).length;
    if (waterSame > 0) {
      synergyBonus += valueAtLevel(CARD_PARAMS["syn.steamBurst"].perSame, steamBurstLevel) * waterSame;
      triggers.push({ kind: "steamBurst", sourceUid: uid, targetUids: sameNameUids, value: waterSame });
    }
  }
  const iceMirrorLevel = lvl("syn.iceMirror");
  if (iceMirrorLevel > 0 && has(self, "water")) {
    const frozenSame = sameNameUids.filter((targetUid) => ctx.stateOf?.(targetUid)?.frozen === true);
    if (frozenSame.length > 0) {
      synergyBonus += valueAtLevel(CARD_PARAMS["syn.iceMirror"].perFrozenSame, iceMirrorLevel) * frozenSame.length;
      triggers.push({ kind: "iceMirror", sourceUid: uid, targetUids: frozenSame, value: frozenSame.length });
    }
  }
  if (superconductLevel > 0 && has(self, "electric")) {
    const frozenInTeam = absorbUids.filter((targetUid) => ctx.stateOf?.(targetUid)?.frozen === true);
    if (frozenInTeam.length > 0) {
      synergyBonus += valueAtLevel(CARD_PARAMS["syn.superconduct"].perFrozen, superconductLevel) * frozenInTeam.length;
      triggers.push({ kind: "superconduct", sourceUid: uid, targetUids: frozenInTeam, persistent: true });
    }
  }
  const bionetLevel = lvl("syn.bionet");
  if (bionetLevel > 0 && has(self, "electric")) {
    const generated = connected.filter((targetUid) => ctx.stateOf?.(targetUid)?.generated === true);
    const count = Math.min(
      CARD_PARAMS["syn.bionet"].cap,
      generated.length * valueAtLevel(CARD_PARAMS["syn.bionet"].generatedWeight, bionetLevel),
    );
    if (count > 0) {
      synergyBonus += valueAtLevel(CARD_PARAMS["syn.bionet"].perGenerated, bionetLevel) * count;
      triggers.push({ kind: "bionet", sourceUid: uid, targetUids: generated, value: count, persistent: true });
    }
  }
  const lightningrodLevel = lvl("syn.lightningrod");
  if (lightningrodLevel > 0 && has(self, "electric")) {
    const relayUids = [...new Set(Object.values(paths).flat())];
    const relayMass = relayUids.reduce((sum, targetUid) => {
      const body = byUid.get(targetUid);
      if (!body?.elements.includes("normal")) return sum;
      return sum + Math.max(1, ctx.stateOf?.(targetUid)?.sizeLevel ?? 1);
    }, 0);
    if (relayMass > 0) {
      synergyBonus += valueAtLevel(CARD_PARAMS["syn.lightningrod"].perMass, lightningrodLevel) * relayMass;
      triggers.push({ kind: "lightningrod", sourceUid: uid, value: relayMass });
    }
  }
  const fireDispatchLevel = lvl("syn.fireDispatch");
  if (fireDispatchLevel > 0 && has(self, "fire") && has(self, "normal")) {
    const mass = Math.max(1, ctx.stateOf?.(self.uid)?.sizeLevel ?? 1);
    if (mass > 1) {
      synergyBonus += valueAtLevel(CARD_PARAMS["syn.fireDispatch"].perMass, fireDispatchLevel) * (mass - 1);
      triggers.push({ kind: "fireDispatch", sourceUid: uid, value: mass });
    }
  }
  const frostrootLevel = lvl("syn.permafrost");
  if (
    frostrootLevel > 0
    && deskElements.length > 0
    && (has(self, "ice") || has(self, "grass"))
  ) {
    // 文案口径是“本次团队每条冰草连接边”。只允许投放者和实际被压榨者
    // 参与计数，避免同一连通分量中未进入团队的远端冰草边偷加倍率。
    const scopeUids = frostrootLevel >= 5 ? connected : teamUids;
    const teamSet = new Set(scopeUids);
    const frostrootTargets = new Set<number>();
    let crossEdges = 0;
    for (const leftUid of scopeUids) {
      const left = byUid.get(leftUid);
      if (left == null) continue;
      for (const rightUid of adj.get(leftUid) ?? []) {
        if (rightUid <= leftUid || !teamSet.has(rightUid)) continue;
        const right = byUid.get(rightUid);
        if (right == null) continue;
        const linksIceAndGrass =
          (has(left, "ice") && has(right, "grass"))
          || (has(left, "grass") && has(right, "ice"));
        if (!linksIceAndGrass) continue;
        crossEdges++;
        frostrootTargets.add(leftUid);
        frostrootTargets.add(rightUid);
      }
    }
    const countedEdges = Math.min(
      valueAtLevel(CARD_PARAMS["syn.permafrost"].cap, frostrootLevel),
      crossEdges,
    );
    if (countedEdges > 0) {
      synergyBonus += valueAtLevel(CARD_PARAMS["syn.permafrost"].perCrossEdge, frostrootLevel) * countedEdges;
      triggers.push({
        kind: "permafrost",
        sourceUid: uid,
        targetUids: [...frostrootTargets],
        value: countedEdges,
        persistent: true,
      });
    }
  }

  const cp = comboParams(cards);
  const elementMult = 1 + Math.max(0, elementBonus);
  const synergyCardMult = 1 + Math.max(0, synergyBonus);
  const jobMult = 1 + Math.max(0, jobBonus);
  const rhythmMult = withCombo ? 1 + Math.min(cp.per * Math.max(0, ctx.comboStacks), cp.cap) : 1;
  // 旧字段继续提供兼容映射，避免存量结算快照和 UI 读取失败。
  const individualMult = jobMult;
  const teamMult = elementMult;
  const networkMult = synergyCardMult;
  const statusMult = 1;
  const skillMult = elementMult * jobMult;
  const synergyMult = synergyCardMult;
  const comboMult = rhythmMult;
  const deskCount = deskElements.length;
  const deskScoreMult = deskScoreMultiplier(deskCount);
  const allScoreMult = elementMult * synergyCardMult * jobMult * rhythmMult;
  // A connected desk is a complete scoring pass. Round one pass first, then
  // repeat it once per desk so the credited amount matches the visible ×N.
  const scorePerPass = deskCount === 0
    ? 0
    : Math.round(chips * allScoreMult);
  const total = scorePerPass * deskScoreMult;
  const raw = total;

  const weights = [
    { uid, species: self.species, role: "head" as const, weight: base },
    ...absorbedValues.map((item) => ({
      uid: item.uid,
      species: item.species,
      role: "absorbed" as const,
      weight: ABSORB_FACTOR * item.value,
    })),
  ];
  const weightTotal = weights.reduce((sum, item) => sum + item.weight, 0);
  const exact = weights.map((item) => ({
    ...item,
    exact: total > 0 && weightTotal > 0 ? total * item.weight / weightTotal : 0,
  }));
  const contributors: PulseBreakdown["contributors"] = exact.map((item) => ({
    uid: item.uid,
    species: item.species,
    role: item.role,
    amount: Math.floor(item.exact),
  }));
  let remainder = total - contributors.reduce((sum, item) => sum + item.amount, 0);
  const order = exact
    .map((item, index) => ({ index, fraction: item.exact - Math.floor(item.exact) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let i = 0; i < remainder && order.length > 0; i++) contributors[order[i % order.length].index].amount++;

  const extras: PulseBreakdown["extras"] = [];
  if (withExtras && deskCount > 0) {
    if (burstLevel > 0 && has(self, "fire")) {
      const repeats = valueAtLevel(CARD_PARAMS["fire.burst"].repeats, burstLevel);
      for (let repeat = 0; repeat < repeats; repeat++) {
        const amount = Math.round(base * allScoreMult) * deskScoreMult;
        if (amount > 0) extras.push({ kind: "fireBurst", uid: self.uid, amount });
      }
    }
    if (wildfireLevel > 0 && has(self, "fire")) {
      const spread = triggers.find((trigger) => trigger.kind === "wildfire")?.targetUids ?? [];
      for (const targetUid of spread) {
        const amount = Math.round(ctx.effBase(targetUid) * allScoreMult) * deskScoreMult;
        if (amount > 0) extras.push({ kind: "wildfire", uid: targetUid, amount });
      }
    }
    const thermalLevel = lvl("syn.thermalShock");
    if (thermalLevel > 0 && has(self, "fire")) {
      const targets = absorbUids.filter((targetUid) => ctx.stateOf?.(targetUid)?.frozen === true);
      for (const targetUid of targets) {
        const amount = Math.round(
          ctx.effBase(targetUid)
          * valueAtLevel(CARD_PARAMS["syn.thermalShock"].echo, thermalLevel)
          * allScoreMult,
        ) * deskScoreMult;
        if (amount > 0) extras.push({ kind: "echo", uid: targetUid, amount });
      }
      if (targets.length > 0) triggers.push({ kind: "thermalShock", sourceUid: uid, targetUids: targets });
    }
    const shortLevel = lvl("syn.short");
    if (shortLevel > 0 && has(self, "electric")) {
      const shortScope = [...new Set(Object.values(paths).flat())];
      const targets = shortScope.filter((targetUid) => {
        const target = byUid.get(targetUid);
        return targetUid !== self.uid
          && target?.species === self.species
          && has(target, "water");
      });
      for (const targetUid of targets) {
        const amount = Math.round(
          ctx.effBase(targetUid)
          * valueAtLevel(CARD_PARAMS["syn.short"].burst, shortLevel)
          * allScoreMult,
        ) * deskScoreMult;
        if (amount > 0) extras.push({ kind: "shortCircuit", uid: targetUid, amount });
      }
      if (targets.length > 0) {
        triggers.push({ kind: "shortCircuit", sourceUid: uid, targetUids: targets });
      }
    }
  }

  return {
    bd: {
      uid,
      species: self.species,
      base,
      absorbSum,
      absorbUids: absorbUids.slice(),
      chips,
      elementMult,
      synergyCardMult,
      jobMult,
      individualMult,
      teamMult,
      networkMult,
      statusMult,
      rhythmMult,
      skillMult,
      synergyMult,
      comboMult,
      desks: deskElements,
      deskCount,
      deskScoreMult,
      deskPaths: paths,
      total,
      contributors,
      extras,
      triggers,
    },
    raw,
  };
}

export function computePulse(ctx: PulseCtx): PulseBreakdown {
  return runPipeline(ctx, true, true).bd;
}
