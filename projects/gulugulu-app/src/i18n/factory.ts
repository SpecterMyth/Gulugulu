// 工厂域词表:工厂玩法场景(FactoryScene)的全部 UI 词条。
// zh 为基准文案;en 走轻松/打工梗调性,按钮词条保持短(布局宽度受限)。
// 占位符用 fmt() 插值。

import type { Language } from "./core";

export interface FactoryStrings {
  /** 场景标题(顶部木牌)。 */
  title: string;
  /** 左上返回木牌。 */
  backBtn: string;
  backTitle: string;
  /** 首次进入的操作提示(第一次空投后淡出)。 */
  hint: string;
  /** 操作提示副行:属性配对规则(同属性粘住/异属性弹开)。 */
  hintMatch: string;
  /** 操作提示副行:解雇/罢工规则(点宠解雇;三只同种连一起罢工跑路)。 */
  hintFire: string;
  /** 罢工者头顶举的小牌子文案。 */
  strikeSign: string;
  /** 属性打工桌的无障碍标签({name}=元素名)。 */
  deskAria: string;
  /** 没有任何宠物时的空态提示。 */
  empty: string;
  /** 打工山已满(达到上限)时点击的提示。 */
  full: string;
  /** 右上角计数(打工中 ×{n})。 */
  working: string;
  /** 运输机的无障碍标签。 */
  planeAria: string;
}

export const FACTORY: Record<Language, FactoryStrings> = {
  zh: {
    title: "打工工厂",
    backBtn: "← 返回",
    backTitle: "回到主界面",
    hint: "点击 / 空格：空投一只咕噜",
    hintMatch: "落在同属性咕噜身上会粘住，属性不合会被弹开",
    hintFire: "点击打工中的咕噜可以解雇；三只相同的凑一起会罢工！",
    strikeSign: "罢工!",
    deskAria: "{name}属性工位",
    empty: "还没有咕噜——先去孵一只吧",
    full: "办公室堆满啦，放不下了！",
    working: "打工咕噜 ×{n}",
    planeAria: "运输机",
  },
  en: {
    title: "Work Factory",
    backBtn: "← Back",
    backTitle: "Back to main",
    hint: "Click / Space: airdrop a Gulu",
    hintMatch: "Land on a matching Gulu to stick — no match, you bounce",
    hintFire: "Click a working Gulu to fire it — three of a kind walk out on strike!",
    strikeSign: "STRIKE!",
    deskAria: "{name} desk",
    empty: "No Gulus yet — hatch one first",
    full: "The office is packed — no room left!",
    working: "Gulus on shift ×{n}",
    planeAria: "Cargo plane",
  },
};
