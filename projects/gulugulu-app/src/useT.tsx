// 语言上下文:App 根部 Provide 当前语言,任意深度组件用 useT() 取词条,
// 免层层传 language props。无 Provider 时回退英文(与 Rust settings 默认一致)。

import { createContext, useContext } from "react";
import { type AllStrings, type Language, t } from "./i18n";

export const LanguageContext = createContext<Language>("en");

/** 当前语言 + 词条包。T 覆盖 UiStrings 平铺键与 bk/sh 域词表。 */
export function useT(): { lang: Language; T: AllStrings } {
  const lang = useContext(LanguageContext);
  return { lang, T: t(lang) };
}
