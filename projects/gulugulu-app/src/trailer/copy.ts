// 宣传片全部文案(中英双版)。英文取自定稿商店文案;中文沿用商店页/角色设定的既有口吻
// (plans/steam_trade/06-store-page.md、arts/concepts/pet_duck_character.md)。
// ⚠️ 全是**纯文本**(打字机逐字渲染,不解码 HTML 实体)——直接写 Unicode 字符,
// 别写 &rsquo; / &mdash; / &hellip;。
import { S, H, type Seg, type TrLang } from "./lang";

type Copy = {
  cold: { c1: Seg[]; c2: Seg[]; bubble: string };
  live: {
    kicker: string;
    title: string;
    c1: Seg[];
    c2: Seg[];
    c3: Seg[];
    c4: Seg[];
    bubble1: string;
    bubble2: string;
  };
  keys: { c1: Seg[]; c1sub: string; c2: Seg[] };
  collect: { c1: Seg[]; c2: Seg[]; c3: Seg[]; c4: Seg[]; c4sub: string };
  create: { kicker: string; title: string; c1: Seg[]; c2: Seg[]; c3: Seg[]; c4: Seg[]; c5: Seg[] };
  trade: {
    kicker: string;
    title: string;
    c1: Seg[];
    c2: Seg[];
    c3: Seg[];
    c4: Seg[];
    c4tag: string;
    badgeFirst: string;
    badgeWs: string;
    badgeTraded: string;
    prices: string[];
  };
  end: { wordmark: string; tagline: string; cta: string; bubble: string };
  ide: { thinking: string; tool: string; tokens: string; error: string };
  desk: { pc: string; bin: string; docs: string; code: string; search: string };
};

const EN: Copy = {
  cold: {
    c1: [S("Your AI writes the code.")],
    c2: [S("You watch the "), H("progress bar.")],
    bubble: "Watch a duck instead.",
  },
  live: {
    kicker: "The whole point",
    title: "IT REACTS TO YOUR AI. LIVE.",
    c1: [S("Thinks when your agent thinks.")],
    c2: [S("Works when your agent works.")],
    c3: [S("Burns tokens? Now they "), H("feed the duck.")],
    c4: [S("Sighs when the build breaks.")],
    bubble1: "You’re absolutely right!",
    bubble2: "(falls asleep)",
  },
  keys: {
    c1: [S("It’s also fed by your "), H("real typing.")],
    c1sub: "Counts your keys — never reads them.",
    c2: [S("And it "), H("stays out of your way.")],
  },
  collect: {
    c1: [S("63 species. "), H("No two alike.")],
    c2: [S("Six elements. "), H("Every combo.")],
    c3: [S("From a scrappy little duck…")],
    c4: [S("…to a "), H("six-element flagship.")],
    c4sub: "(It hums its own BGM.)",
  },
  create: {
    kicker: "Claude & Codex, live",
    title: "AI-CREATED SPECIES",
    c1: [S("Fuse two maxed pets…")],
    c2: [S("…your local "), H("Claude or Codex"), S(" wakes up.")],
    c3: [S("It designs a "), H("brand-new species."), S(" Live.")],
    c4: [S("Every one’s "), H("one of a kind."), S(" Endless.")],
    c5: [S("No API key. No cloud. "), H("Just your CLI.")],
  },
  trade: {
    kicker: "Your creations, on Steam",
    title: "SHARE & TRADE",
    c1: [S("Ship it to the "), H("Steam Workshop.")],
    c2: [S("Roll one "), H("first"), S(" — it’s everyone’s canon.")],
    c3: [S("Trade & sell them as "), H("real Steam items.")],
    c4: [S("Creatures you "), H("truly own.")],
    c4tag: "at launch",
    badgeFirst: "GLOBAL FIRST",
    badgeWs: "↑ WORKSHOP",
    badgeTraded: "TRADED ✓",
    prices: ["$0.99", "¥6", "★ rare", "trade"],
  },
  end: {
    wordmark: "Gulugulu",
    tagline: "The AI works. You idle. That’s the game.",
    cta: "Search “Gulugulu” on Steam!",
    bubble: "Quack — is this even reasonable?",
  },
  ide: {
    thinking: "Claude Code · thinking…",
    tool: "running tool: edit_file…",
    tokens: "streaming tokens…",
    error: "build failed — 1 error",
  },
  desk: { pc: "This PC", bin: "Recycle Bin", docs: "Documents", code: "Code", search: "Search" },
};

const ZH: Copy = {
  cold: {
    c1: [S("AI 替你写代码。")],
    c2: [S("你呢？盯着"), H("进度条。")],
    bubble: "不如看鸭子。",
  },
  live: {
    kicker: "这才是重点",
    title: "它随你的 AI 实时反应",
    c1: [S("AI 思考，"), H("它跟着发呆。")],
    c2: [S("AI 干活，"), H("它跟着搬砖。")],
    c3: [S("烧 Token？这下"), H("能喂鸭子了。")],
    c4: [S("构建挂了，"), H("它跟着叹气。")],
    bubble1: "你说得对！",
    bubble2: "（睡着了）",
  },
  keys: {
    c1: [S("它也吃你"), H("真实的键盘输入。")],
    c1sub: "只数按键，从不读内容。",
    c2: [S("还会"), H("自动躲开你的窗口。")],
  },
  collect: {
    c1: [S("63 种物种，"), H("只只不同。")],
    c2: [S("六属性，"), H("组合全收录。")],
    c3: [S("从没啥本事的小鸭子……")],
    c4: [S("……到"), H("六属性旗舰。")],
    c4sub: "（自带 BGM，它自己哼。）",
  },
  create: {
    kicker: "Claude 与 Codex 现场设计",
    title: "AI 亲手造的物种",
    c1: [S("融合两只满级宠物……")],
    c2: [S("你本机的 "), H("Claude / Codex"), S(" 就醒了。")],
    c3: [S("它当场设计"), H("一只全新物种。")],
    c4: [S("只只"), H("独一无二"), S("，永不重样。")],
    c5: [S("不用 API key、不上云，"), H("就靠你的 CLI。")],
  },
  trade: {
    kicker: "你的造物，放上 Steam",
    title: "分享 与 交易",
    c1: [S("丢上 "), H("Steam 创意工坊。")],
    c2: [S("谁先掷出，"), H("设计就成标准。")],
    c3: [S("它们是"), H("真实 Steam 物品"), S("，可交易可出售。")],
    c4: [S("真正"), H("属于你的宠物。")],
    c4tag: "上线时开放",
    badgeFirst: "全球首发",
    badgeWs: "↑ 创意工坊",
    badgeTraded: "已成交 ✓",
    prices: ["$0.99", "¥6", "★ 稀有", "可交易"],
  },
  end: {
    wordmark: "咕噜咕噜",
    tagline: "AI 干活，你摸鱼，这就是游戏。",
    cta: "上 Steam 搜索「Gulugulu」！",
    bubble: "嘎？这合理吗？",
  },
  ide: {
    thinking: "Claude Code · 思考中…",
    tool: "运行工具: edit_file…",
    tokens: "Token 流式输出中…",
    error: "构建失败 —— 1 个错误",
  },
  desk: { pc: "此电脑", bin: "回收站", docs: "文档", code: "代码", search: "搜索" },
};

export const COPY: Record<TrLang, Copy> = { en: EN, zh: ZH };
