// 界面文案的单一真源(汇总入口)。托盘菜单(src-tauri/src/tray.rs)保持同一套词条的镜像。
//
// 结构:基础平铺键(UiStrings,历史词条)+ 域词表(src/i18n/ 下 backyard/shell),
// 消息键协议(src/i18n/messages.ts)与物种/元素显示(src/i18n/species.ts)另见各文件。
// 组件取词优先走 src/useT.tsx 的 useT();少数无 React 上下文的场合用 t(language)。
//
// 扩展一门新语言:给 core.ts 的 Language 加码、各域词表加一套词条、LANGUAGES 加一项,
// 并在 Rust tray.rs 的 labels() 加一个分支——UI 与托盘即同时支持。

import { type Language } from "./i18n/core";
import { BACKYARD, type BackyardStrings } from "./i18n/backyard";
import { SHELL, type ShellStrings } from "./i18n/shell";

export { LANGUAGES, fmt, type Language } from "./i18n/core";
export { localizeGameMessage, MESSAGES } from "./i18n/messages";
export {
  ELEMENT_NAMES,
  elementName,
  isAiCodename,
  recipeLabel,
  speciesDesc,
  speciesDisplayName,
  titleCaseCode,
} from "./i18n/species";
export type { BackyardStrings } from "./i18n/backyard";
export type { ShellStrings } from "./i18n/shell";

export interface UiStrings {
  // 状态栏 / 舞台
  previewMode: string;
  codexOnline: string;
  codexClaudeOnline: string;
  claudeCodeOnline: string;
  agentOnline: string;
  findingCodex: string;
  findingAgent: string;
  statusError: string;
  duckAlt: string;
  // 菜单栏 + 面板骨架
  backyard: string;
  settings: string;
  debug: string;
  back: string;
  backToPet: string;
  // 设置面板
  language: string;
  alwaysOnTop: string;
  keyboardCharging: string;
  randomMovement: string;
  autostart: string;
  on: string;
  off: string;
  closePet: string;
}

const zh: UiStrings = {
  previewMode: "预览模式",
  codexOnline: "Codex 在线",
  codexClaudeOnline: "Codex + Claude Code 在线",
  claudeCodeOnline: "Claude Code 在线",
  agentOnline: "Agent 在线",
  findingCodex: "寻找 Codex",
  findingAgent: "寻找 Agent",
  statusError: "Codex 连接需要注意",
  duckAlt: "咕噜咕噜小鸭",
  backyard: "后院",
  settings: "设置",
  debug: "调试",
  back: "返回",
  backToPet: "回到宠物",
  language: "语言",
  alwaysOnTop: "总在最前",
  keyboardCharging: "键盘充能",
  randomMovement: "随机移动",
  autostart: "开机自动启动",
  on: "开",
  off: "关",
  closePet: "关闭宠物",
};

const en: UiStrings = {
  previewMode: "Preview mode",
  codexOnline: "Codex online",
  codexClaudeOnline: "Codex + Claude Code online",
  claudeCodeOnline: "Claude Code online",
  agentOnline: "Agent online",
  findingCodex: "Finding Codex",
  findingAgent: "Finding agent",
  statusError: "Codex connection needs attention",
  duckAlt: "Gulugulu duck",
  backyard: "Backyard",
  settings: "Settings",
  debug: "Debug",
  back: "Back",
  backToPet: "Back to pet",
  language: "Language",
  alwaysOnTop: "Always on top",
  keyboardCharging: "Keyboard charging",
  randomMovement: "Random movement",
  autostart: "Launch on startup",
  on: "On",
  off: "Off",
  closePet: "Close pet",
};

export const STRINGS: Record<Language, UiStrings> = { zh, en };

/** 平铺基础键 + 域词表(bk=后院域,sh=壳层域)。 */
export type AllStrings = UiStrings & { bk: BackyardStrings; sh: ShellStrings };

const ALL: Record<Language, AllStrings> = {
  zh: { ...zh, bk: BACKYARD.zh, sh: SHELL.zh },
  en: { ...en, bk: BACKYARD.en, sh: SHELL.en },
};

/** 取某语言的词条;未知语言回退英文(与 Rust settings 默认一致)。 */
export function t(language: Language): AllStrings {
  return ALL[language] ?? ALL.en;
}
