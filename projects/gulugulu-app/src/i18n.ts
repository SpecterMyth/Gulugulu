// 界面文案的单一真源。托盘菜单（src-tauri/src/tray.rs）保持同一套词条的镜像。
//
// 扩展一门新语言：给 `Language` 加一个码、给 `STRINGS` 加一套词条、给 `LANGUAGES`
// 加一项，并在 Rust tray.rs 的 labels() 加一个分支——UI 与托盘即同时支持。

export type Language = "zh" | "en";

/** 语言选择项。label 用该语言自身书写（各语言下都显示母语名，符合习惯）。 */
export const LANGUAGES: Array<{ id: Language; label: string }> = [
  { id: "zh", label: "简体中文" },
  { id: "en", label: "English" },
];

export interface UiStrings {
  // 状态栏 / 舞台
  previewMode: string;
  codexOnline: string;
  findingCodex: string;
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
  on: string;
  off: string;
  closePet: string;
}

const zh: UiStrings = {
  previewMode: "预览模式",
  codexOnline: "Codex 在线",
  findingCodex: "寻找 Codex",
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
  on: "开",
  off: "关",
  closePet: "关闭宠物",
};

const en: UiStrings = {
  previewMode: "Preview mode",
  codexOnline: "Codex online",
  findingCodex: "Finding Codex",
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
  on: "On",
  off: "Off",
  closePet: "Close pet",
};

export const STRINGS: Record<Language, UiStrings> = { zh, en };

/** 取某语言的词条；未知语言回退中文（与 Rust settings 默认一致）。 */
export function t(language: Language): UiStrings {
  return STRINGS[language] ?? STRINGS.zh;
}
