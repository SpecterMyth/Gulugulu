// i18n 基础类型与工具。域词表(backyard/shell/messages/species)只依赖本文件,
// 汇总入口 src/i18n.ts 负责合并——域文件禁止反向 import "../i18n"(防循环)。

export type Language = "zh" | "en";

/** 语言选择项。label 用该语言自身书写(各语言下都显示母语名,符合习惯)。 */
export const LANGUAGES: Array<{ id: Language; label: string }> = [
  { id: "en", label: "English" },
  { id: "zh", label: "简体中文" },
];

/** 模板插值:fmt("需要 {cost} 金币", {cost: 5}) → "需要 5 金币"。未知占位符原样保留。 */
export function fmt(template: string, args?: Record<string, string | number>): string {
  if (!args) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    args[key] != null ? String(args[key]) : match,
  );
}
