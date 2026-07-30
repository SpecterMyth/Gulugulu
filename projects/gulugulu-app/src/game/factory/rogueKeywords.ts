import type { Language } from "../../i18n/core";
import type { CardId } from "./rogueConfig";

export type RogueKeywordId =
  | "team" | "ignite" | "spreadFire" | "circuit" | "branch"
  | "frozen" | "overstaff" | "sameName" | "convert"
  | "grow" | "lush" | "height"
  | "absorb" | "size" | "growUp" | "stick";

export const ROGUE_CARD_KEYWORDS: Partial<Record<CardId, RogueKeywordId[]>> = {
  "fire.burst": ["team", "ignite"],
  "fire.ember": ["ignite"],
  "fire.wildfire": ["spreadFire"],
  "electric.parallel": ["branch"],
  "electric.induction": ["circuit"],
  "ice.freeze": ["frozen"],
  "ice.overstaff": ["overstaff"],
  "water.same": ["team", "sameName"],
  "water.convert": ["convert"],
  "grass.grow": ["grow"],
  "grass.crowd": ["lush"],
  "grass.height": ["height"],
  "normal.absorb": ["absorb", "size"],
  "normal.gluttony": ["size"],
  "normal.emperor": ["team", "growUp", "absorb"],
  "syn.arcIgnite": ["ignite", "branch"],
  "syn.thermalShock": ["ignite", "frozen"],
  "syn.steamBurst": ["ignite", "sameName"],
  "syn.greenhouse": ["ignite", "grow"],
  "syn.fireDispatch": ["ignite", "size"],
  "syn.superconduct": ["frozen", "circuit"],
  "syn.short": ["sameName", "circuit"],
  "syn.bionet": ["grow", "circuit"],
  "syn.lightningrod": ["size", "circuit"],
  "syn.iceMirror": ["convert", "frozen"],
  "syn.permafrost": ["stick"],
  "syn.coldRotation": ["frozen", "size"],
  "syn.irrigation": ["grow", "sameName"],
  "syn.badge": ["convert", "absorb"],
  "syn.multiSeed": ["grow", "size"],
};

const ZH: Record<RogueKeywordId, { name: string; tip: string }> = {
  team: { name: "团队", tip: "本次投放者与本次被压榨的咕噜；不包含未进入本次压榨链的场上单位。" },
  ignite: { name: "点燃", tip: "含火咕噜连到桌面并开始计分时触发。它只是技能的触发时机，不是持续状态。" },
  spreadFire: { name: "传火", tip: "首次计分完成后，点燃会沿相邻火系咕噜逐只传导；每只只触发一次。" },
  circuit: { name: "线路", tip: "从本次计分咕噜到每张已连通桌面，所有通路经过的连接段数之和，最多 48 段。" },
  branch: { name: "分流", tip: "本次一共连通到几张桌面。连通 3 张桌，就是 3 点分流。" },
  frozen: { name: "冻结", tip: "咕噜不再占用人口，但仍能支撑、连通、计分和参加罢工；同一只不能重复冻结。" },
  overstaff: { name: "超额人口", tip: "场上不占人口的咕噜数量，也就是被冻结或由生长生成的咕噜数量。" },
  sameName: { name: "同名", tip: "与本次计分咕噜属于同一物种、名称完全相同的咕噜。" },
  convert: { name: "同化", tip: "目标变得与压榨者同名并拥有相同固有元素；保留位置、基础业绩和状态，且不会触发罢工。" },
  grow: { name: "生长", tip: "在触发者左上或右上免费生成一只本局出现过的草系咕噜；不占人口，生成当次不计分。" },
  lush: { name: "繁茂", tip: "与本次计分咕噜连成一片的咕噜数量，包括它自己。连通 8 只，就是 8 点繁茂。" },
  height: { name: "层高", tip: "从本次计分咕噜到每张已连通桌面，分别数通路经过的咕噜，再将数量相加；最多 34 层。" },
  absorb: { name: "吸收", tip: "吞掉最近且体型不大于自己的咕噜：继承基础分与原连接，只占一个人口。" },
  size: { name: "体型", tip: "吸收会累加双方体型。体型提高暴食收益，也限制大咕噜不能被小咕噜吞掉。" },
  growUp: { name: "长大", tip: "体型增加 1 级；若旁边有更小咕噜，会把它吃掉并追加一次计分。" },
  stick: { name: "粘连", tip: "两只接触的咕噜形成连接。元素组合写作“冰草粘连”时，表示这两系即使没有共同元素也能连接。" },
};

const EN: Record<RogueKeywordId, { name: string; tip: string }> = {
  team: { name: "Team", tip: "The deployed Gulu and the Gulus exploited by this score; disconnected field units are excluded." },
  ignite: { name: "Ignite", tip: "An immediate Team Performance boost whenever a Fire Gulu scores through a route." },
  spreadFire: { name: "Spread Fire", tip: "After the first score, Ignite travels through adjacent Fire Gulus one by one." },
  circuit: { name: "Circuit", tip: "Unique edges from the scorer to linked desks, capped at 48." },
  branch: { name: "Branch", tip: "The number of desks linked by this score. Linking 3 desks means 3 Branch." },
  frozen: { name: "Frozen", tip: "Does not use headcount, but still supports, links and scores." },
  overstaff: { name: "Overstaff", tip: "Frozen or Generated Gulus that remain on the field without using headcount." },
  sameName: { name: "Same Name", tip: "A Gulu with exactly the same species as the scorer." },
  convert: { name: "Convert", tip: "Copies the scorer's species and innate elements while keeping position and state; it never triggers a strike." },
  grow: { name: "Grow", tip: "Spawns an existing Grass Gulu upper-left or upper-right; no headcount, no immediate score." },
  lush: { name: "Lush", tip: "The number of Gulus in the scorer's connected group, including the scorer." },
  height: { name: "Height", tip: "Sum of layer counts across all linked desk routes, capped at 34." },
  absorb: { name: "Absorb", tip: "Swallows the nearest Gulu no larger than itself, inheriting base score and connections while using one seat." },
  size: { name: "Size", tip: "Absorb combines both Size values. Size powers Gluttony and prevents smaller Gulus from eating larger ones." },
  growUp: { name: "Grow Up", tip: "Gain 1 Size. If a smaller neighbor exists, eat it and score once more." },
  stick: { name: "Stick", tip: "Two touching Gulus form a connection. A pairing such as Ice–Grass Stick means those elements can connect without sharing an element." },
};

export function rogueKeywordText(id: RogueKeywordId, lang: Language) {
  return (lang === "zh" ? ZH : EN)[id];
}
