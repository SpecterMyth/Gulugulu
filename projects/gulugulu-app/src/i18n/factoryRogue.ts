// 《职场叠叠乐》(工厂 roguelike)域词表:FactoryHub / RogueLoadout / RogueHud /
// RogueShop / RogueSummary 与 FactoryScene rogue 模式的全部 UI 词条。
// zh 为基准文案;en 走打工梗调性(与 i18n/factory.ts 同腔调,按钮词条保持短)。
// 卡牌 desc 是函数:传入「本次购买后到达的等级」,插当前级数值;数值单源 =
// rogueConfig 的 CARD_PARAMS / LOAN_*(此处只读消费,改数去 rogueConfig)。
// 本域不并入 i18n.ts 汇总(组件直接 FACTORY_ROGUE[lang] 取用),避免动共享汇总文件。

import { createLanguageMap, type DeepPartial, type Language } from "./core";
import { generatedFactoryRogueLocales } from "./generatedLocales";
import {
  CARD_PARAMS,
  LOAN_GAIN_RATE,
  LOAN_REPAY_RATE,
  LOAN_TOTAL_REPAY_RATE,
  LOAN_SHIFTS,
  valueAtLevel,
  type CardId,
} from "../game/factory/rogueConfig";

/** 单张卡的文案:name 固定,desc 按等级插值(lv = 购买后到达的等级,≥1)。 */
export type RogueCardText = { name: string; desc: (lv: number) => string };

/** 0.4 → "40"(百分数);1.35 → "1.35"(倍率,去尾零)。 */
const pc = (x: number) => String(Math.round(x * 1_000) / 10);
const mu = (x: number) => String(Math.round(x * 100) / 100);
/** 卡牌加成：不足一倍显示百分比，满一倍起改用 x 倍率。 */
const add = (x: number) => x < 1 ? `+${pc(x)}%` : `+${mu(x)}x`;
const addEn = (x: number) => x < 1 ? `+${pc(x)}%` : `+${mu(x)}x`;
const ratio = (x: number) => x < 1 ? `${pc(x)}%` : `${mu(x)}x`;
const ratioEn = (x: number) => x < 1 ? `${pc(x)}%` : `${mu(x)}x`;
const odds = (x: number) => x >= 1 ? "必定" : `${pc(x)}% 概率`;
const oddsEn = (x: number) => x >= 1 ? "Always" : `${pc(x)}% chance`;

const P = CARD_PARAMS;
const V = valueAtLevel;

export interface FactoryRogueStrings {
  // ---- FactoryHub 模式选择 ----
  hubTitle: string;
  hubDemoTitle: string;
  hubDemoDesc: string;
  hubRogueTitle: string;
  hubRogueDesc: string;
  hubBack: string;

  // ---- Loadout(桌图 + 出战名单) ----
  loTitle: string;
  loDeskMap: string;
  /** {min}/{max} */
  loPick: string;
  /** {n}/{max} */
  loPicked: string;
  loStart: string;
  /** {min} */
  loNeedMore: string;
  loEmpty: string;
  loBaseValue: string;
  /** {n} 吸取层数 */
  loReach: string;
  /** {n} 元素组编号 */
  loGroupNo: string;
  /** {pct} 工种基准价(% KPI) */
  loHireBase: string;
  /** {n} 工种(n 色) */
  loTier: string;

  // ---- HUD ----
  hudBack: string;
  hudRevenue: string;
  /** {n}/{total} */
  hudShift: string;
  /** 无限模式 {m} */
  hudShiftEndless: string;
  hudKpi: string;
  /** {v} 待缴账单 */
  hudBill: string;
  hudCash: string;
  hudQuota: string;
  /** {n} 连击 */
  hudCombo: string;
  /** 雇佣池标题（右立柱） */
  hudBag: string;
  hudBagEmpty: string;
  hudWarnBankrupt: string;
  /** 解雇模式提示 {n} */
  hudDismiss: string;
  hudSwapDesk: string;
  hudPricecut: string;
  /** {n} 工种按钮(n 色) */
  hudTierBtn: string;

  // ---- 检查日 ----
  modRush: string;
  modRushRule: string;
  /** {s} 剩余秒 */
  modRushLeft: string;
  modPower: string;
  /** {n} = 本班手动投放上限 */
  modPowerRule: string;
  /** {n} = 剩余手动投放次数 */
  modPowerLeft: string;
  modWind: string;
  modWindRule: string;
  modAudit: string;
  modAuditRule: string;

  // ---- 商店 ----
  /** {n} 班次 */
  shopTitle: string;
  dim1: string;
  dim2: string;
  dim3: string;
  dim4: string;
  dim5: string;
  shopBuy: string;
  /** {v} 返现 */
  shopSkip: string;
  /** {v} 刷新价 */
  shopReroll: string;
  shopResolved: string;
  shopNext: string;
  /** {lv} 已持有等级 */
  shopOwnedLv: string;
  shopFree: string;
  shopMaxLv: string;
  /** 已有贷款时免费贷款卡的禁用原因。 */
  shopLoanActive: string;
  /** {n}/{total} 三选一步骤标记 */
  shopStep: string;
  /** 三选全部敲定、准备开工 */
  shopAllDone: string;
  /** {n} 待完成操作(解雇/搬桌/压价)时的挑选暂停提示 */
  shopOpPaused: string;
  operationKicker: string;
  operationDismissTitle: string;
  operationDismissSceneHint: string;
  operationSwapTitle: string;
  operationSwapHint: string;
  operationPricecutTitle: string;
  operationPricecutHint: string;
  rarityCommon: string;
  rarityRare: string;
  rarityEpic: string;

  // ---- P3 演出层(结算链/班次仪式/罢工戏剧/教学/离局确认) ----
  /** 搬桌:第一张已选中桌的徽章。 */
  swapPicked: string;
  quitTitle: string;
  quitBody: string;
  quitYes: string;
  quitNo: string;
  // ---- 续局存档(未结束局:继续 / 重开) ----
  resumeTitle: string;
  resumeBody: string;
  /** {n} 上次打到的班次 */
  resumeShiftInfo: string;
  resumeContinue: string;
  resumeNew: string;
  /** KPI 达标自动收班的下班铃横幅。 */
  bellDone: string;
  /** KPI 达标后、工资单之前的自动投放阶段。 */
  overtimeTitle: string;
  overtimeStart: string;
  kpiBonus: string;
  /** {n} 加班角色剩余数。 */
  overtimeRemaining: string;
  /** {v} 商店头部「本班账单」金额。 */
  shopBillPaid: string;
  /** 账单盖章文案。 */
  paidStamp: string;
  /** 弹开失投原因浮字(没共同元素)。 */
  hintNoShare: string;
  landingFailed: string;
  /** 落定但一桌未接的原因浮字。 */
  hintNoDesk: string;
  connectionFailed: string;
  /** {element} 已连通，但该元素桌本班次被禁运。 */
  disabledDeskHint: string;
  disabledDeskStamp: string;
  /** 总营收数量级里程碑印章(1e4/1e5/1e6/1e8)。 */
  mile10k: string;
  mile100k: string;
  mile1m: string;
  mile100m: string;
  /** 解雇点选命中时盖的印章字。 */
  dismissStampText: string;
  /** 破产封条条幅文字。 */
  sealText: string;
  /** 毕业结算板上的无限模式解锁徽章。 */
  sumEndlessBadge: string;
  /** 首班教学四步气泡(04 §11)。 */
  tutThrow: string;
  tutStack: string;
  tutSame: string;
  tutKpi: string;

  // ---- 组件内通用标签 / 确认与状态提示 ----
  loShiftOne: string;
  loLeaderboard: string;
  loElementOdds: string;
  loWorkLegend: string;
  loExploitLegend: string;
  loIn: string;
  shopHeader: string;
  shopTakeFree: string;
  shopKeywordAria: string;
  shopKeywordTitle: string;
  shopKeywordEmpty: string;
  runtimeTeamPerformance: string;
  runtimeExploitationPerformance: string;
  runtimePaused: string;
  kpiAchieved: string;
  sumViewLeaderboard: string;
  steamGlobalRankEmpty: string;

  // ---- 招聘确认 ----
  hireTitle: string;
  hireShiftRound: string;
  hireCash: string;
  hirePool: string;
  hireTip: string;
  hireSelected: string;
  hirePick: string;
  hireWorkPerformance: string;
  hireExploitCount: string;
  hireVerb: string;
  hirePoolCurrent: string;
  hirePoolTotal: string;
  hirePoolEmpty: string;
  hirePicked: string;
  hireCost: string;
  hireCashAfter: string;
  hireAfterBill: string;
  hireReroll: string;
  hireRerollSpent: string;
  hireClearAll: string;
  hireSelectAll: string;
  hireNoCash: string;
  hirePoolFull: string;
  hirePayNext: string;
  hirePayStart: string;
  hireConfirmTitle: string;
  hireConfirmEmpty: string;
  hireConfirmLowPool: string;
  hireGoBack: string;
  hireContinue: string;

  // ---- 工资单 ----
  settlementEyebrow: string;
  settlementTitle: string;
  settlementSpent: string;
  settlementReceived: string;
  settlementBill: string;
  settlementRequired: string;
  settlementLoanPayment: string;
  settlementDetails: string;
  settlementTeam: string;
  settlementBase: string;
  settlementAbsorbed: string;
  settlementExtra: string;
  settlementPools: string;
  settlementEmpty: string;
  settlementDesks: string;
  settlementWallet: string;
  settlementAfter: string;
  settlementShortfall: string;
  settlementConfirmAll: string;
  settlementConfirmBill: string;
  settlementConfirmBankruptcy: string;
  settlementPaying: string;
  settlementPaid: string;
  settlementRefund: string;
  settlementTrickle: string;
  settlementKpiBonus: string;

  // ---- Steam 排行榜 ----
  lbAria: string;
  lbLegacyLineup: string;
  lbMe: string;
  lbBestRevenue: string;
  lbBestShift: string;
  lbEndless: string;
  lbNormal: string;
  lbBack: string;
  lbTitle: string;
  lbTop100: string;
  lbUpdated: string;
  lbRefresh: string;
  lbRankPlayer: string;
  lbColumns: string;
  lbConnecting: string;
  lbUnavailable: string;
  lbRetry: string;
  lbEmpty: string;
  lbMyRank: string;
  lbNotRanked: string;
  sumNewRecordBadge: string;
  sumFactoryDrop: string;
  cardAria: string;
  levelAria: string;

  // ---- 结算 ----
  sumBankrupt: string;
  sumGraduate: string;
  sumEndlessOver: string;
  sumRevenue: string;
  sumShifts: string;
  sumMaxPulse: string;
  sumMaxCombo: string;
  sumMaxDesks: string;
  sumStrikes: string;
  sumThrows: string;
  sumBounces: string;
  sumBestRevenue: string;
  sumBestShift: string;
  sumRuns: string;
  sumRewards: string;
  sumRewardsHint: string;
  /** {count} */
  sumRewardsTotal: string;
  sumRewardsEmpty: string;
  sumRewardsEmptyHint: string;
  sumCoinsEarned: string;
  sumThisRunItems: string;
  sumTodayItems: string;
  sumTodayEmpty: string;
  sumUpgradeHint: string;
  sumTapForTip: string;
  sumItemTipAria: string;
  sumItemUpgradeTip: string;
  sumPerformance: string;
  steamNewRecord: string;
  steamSyncing: string;
  steamGlobalRank: string;
  sumRetry: string;
  sumBack: string;
  /** 毕业 summary 上的「继续无限」(RogueRunApi.continueEndless,P1 追加)。 */
  sumContinueEndless: string;

  // ---- 罢工牌梗文案池(rogue 下随机抽) ----
  strikeSigns: string[];

  // ---- 35 张卡(名称 + 效果描述模板) ----
  cards: Record<CardId, RogueCardText>;
}

const zh: FactoryRogueStrings = {
  hubTitle: "打工工厂",
  hubDemoTitle: "经典演示",
  hubDemoDesc: "自由空投·堆山·罢工,想怎么玩怎么玩",
  hubRogueTitle: "职场叠叠乐",
  hubRogueDesc: "20 班 KPI 生死局：雇咕噜、垒高塔、赚团队业绩，千万别破产",
  hubBack: "← 返回",

  loTitle: "出战准备",
  loDeskMap: "本局桌位(随机排布,搬桌卡可换)",
  loPick: "从收藏里选 {min}~{max} 种咕噜出战：少而纯，容易压榨出高业绩；多而杂，更安全但会稀释构筑",
  loPicked: "已选 {n}/{max}",
  loStart: "开工!",
  loNeedMore: "至少选 {min} 个物种",
  loEmpty: "还没有咕噜——先去孵一只吧",
  loBaseValue: "打工业绩 {n}",
  loReach: "压榨数 {n}",
  loGroupNo: "编号 {n}",
  loHireBase: "雇价基准 {pct}% KPI",
  loTier: "{n} 色工种",

  hudBack: "← 离开",
  hudRevenue: "总营收",
  hudShift: "班次 {n}/{total}",
  hudShiftEndless: "班次 ∞+{m}",
  hudKpi: "KPI",
  hudBill: "账单 {v} 待缴",
  hudCash: "现金",
  hudQuota: "名额",
  hudCombo: "Combo ×{n}",
  hudBag: "雇佣池",
  hudBagEmpty: "雇佣池已空",
  hudWarnBankrupt: "⚠️ 破产预警:现金撑不住下一步了",
  hudDismiss: "解雇模式：点选场上的咕噜（剩 {n} 只）",
  hudSwapDesk: "搬桌模式:依次点选两张桌交换位置",
  hudPricecut: "压价:指定一个工种,本局雇价基准下调",
  hudTierBtn: "{n} 色",

  modRush: "赶工日",
  modRushRule: "{s} 秒内主动投放并达成 KPI；纸条烧尽时仍未达标，就会破产",
  modRushLeft: "⏱ {s}s",
  modPower: "限电日",
  modPowerRule: "本班仅可手动投放 {n} 次；每次出手都扣 1 次，用完未达 KPI 立即破产（加班不计）",
  modPowerLeft: "剩余投放 {n} 次",
  modWind: "大风日",
  modWindRule: "侧向大风,空投轨迹偏移;风向每 20 秒反转,看旗!",
  modAudit: "终局复合检查",
  modAuditRule: "全部桌面开放：在 5 分钟、20 次手动投放内达成 5000 万 KPI；全程大风每 20 秒反向",

  shopTitle: "班末商店(第 {n} 班)",
  dim1: "元素系列",
  dim2: "属性与经营",
  dim3: "连携",
  dim4: "属性与经营",
  dim5: "综合精选",
  shopBuy: "购买",
  shopSkip: "跳过 +{v}",
  shopReroll: "刷新 −{v}",
  shopResolved: "已处理",
  shopNext: "开下一班 →",
  shopOwnedLv: "已持有 Lv.{lv}",
  shopFree: "免费",
  shopMaxLv: "已满级",
  shopLoanActive: "还款中",
  shopStep: "第 {n}/{total} 选",
  shopAllDone: "强化结束，准备招聘",
  shopOpPaused: "完成本次操作后继续商店 · 还剩 {n} 次选择",
  operationKicker: "待完成操作",
  operationDismissTitle: "选择要解雇的咕噜",
  operationDismissSceneHint: "直接点击场景中的咕噜；每只退还 100% 最近雇价",
  operationSwapTitle: "选择要交换的桌子",
  operationSwapHint: "依次选择两张桌子；两座塔会随桌交换，连通部分会在两桌之间切开",
  operationPricecutTitle: "选择压价工种",
  operationPricecutHint: "本局内该工种的雇佣基准价将永久下调",
  rarityCommon: "普通",
  rarityRare: "稀有",
  rarityEpic: "史诗",

  swapPicked: "已选",
  quitTitle: "离开工厂?",
  quitBody: "进度和桌上的咕噜堆都会保存，下次进来可选「继续这局」",
  quitYes: "存档离开",
  quitNo: "继续打工",
  resumeTitle: "上次这局还没打完",
  resumeBody: "继续会回到当时的班次（现金、卡组、进度和桌上的咕噜堆都在）",
  resumeShiftInfo: "上次打到 第 {n} 班",
  resumeContinue: "继续这局",
  resumeNew: "重开一局",
  bellDone: "KPI达成，下班！",
  overtimeTitle: "加班时间",
  overtimeStart: "加班时间！剩余咕噜临时上场赚取团队业绩",
  kpiBonus: "绩效达成奖金",
  overtimeRemaining: "自动结算团队业绩并返池 · 还剩 {n} 只咕噜",
  shopBillPaid: "本班账单 {v}",
  paidStamp: "已缴✓",
  hintNoShare: "✗ 气场不合，啪叽弹开！",
  landingFailed: "落点没接稳，再试一次！",
  hintNoDesk: "✗ 没一个工位收到消息",
  connectionFailed: "没连通办公桌",
  disabledDeskHint: "本班次{element}系不计分",
  disabledDeskStamp: "本班次不计分",
  mile10k: "破万!",
  mile100k: "破十万!",
  mile1m: "破百万!",
  mile100m: "破亿!",
  dismissStampText: "裁",
  sealText: "查封",
  sumEndlessBadge: "∞ 无限模式已解锁",
  tutThrow: "把咕噜投到发光的同色桌上！",
  tutStack: "叠上去！上方咕噜会压榨下方咕噜的业绩",
  tutSame: "两只同类粘一起了——再来一只就罢工!",
  tutKpi: "用尽量少的咕噜达成 KPI；剩余咕噜会自动结算团队业绩并返回池中，下一班还能使用",

  loShiftOne: "第 1 班",
  loLeaderboard: "排行榜",
  loElementOdds: "签袋元素概率",
  loWorkLegend: "★ 打工业绩 = 咕噜本身产生的业绩",
  loExploitLegend: "⛓ 压榨数 = 可向下压榨的咕噜数量",
  loIn: "已选 ✓",
  shopHeader: "班末商店",
  shopTakeFree: "免费拿",
  shopKeywordAria: "关键词说明",
  shopKeywordTitle: "关键词说明",
  shopKeywordEmpty: "当前卡片没有额外关键词",
  runtimeTeamPerformance: "团队业绩",
  runtimeExploitationPerformance: "压榨业绩",
  runtimePaused: "后台计时已暂停 {seconds} 秒，继续开工！",
  kpiAchieved: "KPI 达成！",
  sumViewLeaderboard: "点击查看全球榜",
  steamGlobalRankEmpty: "Steam 全球第 — 名",

  hireTitle: "咕噜招聘",
  hireShiftRound: "第 {shift} 班 · 招聘 {round}/{max}",
  hireCash: "现有现金",
  hirePool: "咕噜池",
  hireTip: "所有咕噜均已预选；取消不需要的咕噜后一次付款。已选咕噜不会被刷新。",
  hireSelected: "录用 ✓",
  hirePick: "待选",
  hireWorkPerformance: "打工业绩",
  hireExploitCount: "压榨数",
  hireVerb: "雇佣",
  hirePoolCurrent: "当前咕噜池",
  hirePoolTotal: "共 {count} 只",
  hirePoolEmpty: "咕噜池为空",
  hirePicked: "本轮已选",
  hireCost: "雇佣费用",
  hireCashAfter: "支付后现金",
  hireAfterBill: "预留账单后",
  hireReroll: "刷新未选咕噜",
  hireRerollSpent: "刷新费用",
  hireClearAll: "取消全选",
  hireSelectAll: "选取所有",
  hireNoCash: "钱不够",
  hirePoolFull: "咕噜池已满",
  hirePayNext: "付款并进入下一轮",
  hirePayStart: "付款并开工！",
  hireConfirmTitle: "确认继续？",
  hireConfirmEmpty: "你这一轮没有选择任何咕噜。",
  hireConfirmLowPool: "开工后咕噜池中只有 {count} 只咕噜，储备已经很少。",
  hireGoBack: "返回招聘",
  hireContinue: "确认继续",

  settlementEyebrow: "第 {shift} 班 · 下班回执",
  settlementTitle: "本班结算单",
  settlementSpent: "本班花费",
  settlementReceived: "本班收入",
  settlementBill: "待缴账单",
  settlementRequired: "本次应付",
  settlementLoanPayment: "贷款还款",
  settlementDetails: "逐笔团队业绩明细",
  settlementTeam: "团队业绩",
  settlementBase: "打工业绩",
  settlementAbsorbed: "压榨业绩",
  settlementExtra: "额外业绩",
  settlementPools: "元素 · 连携 · 工种 · 连击",
  settlementEmpty: "本班没有获得团队业绩",
  settlementDesks: "{count} 张办公桌",
  settlementWallet: "我的钱包",
  settlementAfter: "全部支付后余额",
  settlementShortfall: "资金缺口",
  settlementConfirmAll: "确认并支付全部",
  settlementConfirmBill: "确认并缴账单",
  settlementConfirmBankruptcy: "资金不足 · 确认破产",
  settlementPaying: "正在缴账…",
  settlementPaid: "已缴 ✓",
  settlementRefund: "退款",
  settlementTrickle: "赶工滴入",
  settlementKpiBonus: "绩效达成奖金",

  lbAria: "Steam 全球排行榜",
  lbLegacyLineup: "历史记录未保存阵容",
  lbMe: "我",
  lbBestRevenue: "最高营收",
  lbBestShift: "最高班次",
  lbEndless: "无限",
  lbNormal: "普通",
  lbBack: "返回",
  lbTitle: "全球打工排行榜",
  lbTop100: "全球前 100 名",
  lbUpdated: "更新于 {time}",
  lbRefresh: "刷新",
  lbRankPlayer: "名次 / 玩家",
  lbColumns: "营收 / 班次 / 模式 / 创纪录阵容",
  lbConnecting: "正在连接 Steam 排行榜…",
  lbUnavailable: "排行榜暂时无法读取",
  lbRetry: "重试",
  lbEmpty: "榜单还是空的，去创造第一条纪录吧！",
  lbMyRank: "我的排名",
  lbNotRanked: "尚未上榜 · 完成一局即可提交成绩",
  sumNewRecordBadge: "★ 新纪录 ★",
  sumFactoryDrop: "工厂掉落",
  cardAria: "{name}，等级 {level}。{description}",
  levelAria: "等级 {level}",

  sumBankrupt: "破产查封",
  sumGraduate: "毕业!20 班通关",
  sumEndlessOver: "无限模式终局",
  sumRevenue: "总营收",
  sumShifts: "坚持班数",
  sumMaxPulse: "最高团队业绩",
  sumMaxCombo: "最长连击",
  sumMaxDesks: "最多接桌",
  sumStrikes: "罢工次数",
  sumThrows: "雇佣次数",
  sumBounces: "失投次数",
  sumBestRevenue: "历史最佳营收",
  sumBestShift: "历史最深班次",
  sumRuns: "开局次数",
  sumRewards: "本局收获",
  sumRewardsHint: "角色升阶道具 · 已放入训练馆仓库",
  sumRewardsTotal: "共 {count} 件",
  sumRewardsEmpty: "本局暂无新增升阶道具",
  sumRewardsEmptyHint: "今日相同进度的奖励已领过，冲到更深班次即可继续获得",
  sumCoinsEarned: "本局获得金币",
  sumThisRunItems: "本次获得的道具",
  sumTodayItems: "今日已获得道具",
  sumTodayEmpty: "今天还没有获得工厂道具",
  sumUpgradeHint: "获得的道具已放入训练馆，可用于咕噜升阶",
  sumTapForTip: "点击查看",
  sumItemTipAria: "{name} ×{count}，点击查看说明",
  sumItemUpgradeTip: "这是咕噜升阶道具。前往训练馆，消耗对应道具即可让咕噜提升阶级。",
  sumPerformance: "本局战绩",
  steamNewRecord: "你创造了新的个人历史记录",
  steamSyncing: "正在同步到 Steam 排行榜",
  steamGlobalRank: "Steam 全球第 {rank} 名",
  sumRetry: "再开一局",
  sumBack: "返回",
  sumContinueEndless: "继续无限模式 →",

  strikeSigns: [
    "加班不加钱",
    "拒绝画饼",
    "我要晒太阳",
    "周末是什么",
    "涨薪!现在!",
    "工位太挤了",
    "老板的饼太大",
    "带薪发呆权",
  ],

  cards: {
    "fire.burst": {
      name: "爆燃",
      desc: (lv) => `【点燃】：火系咕噜的打工业绩额外结算 ${V(P["fire.burst"].repeats, lv)} 次`,
    },
    "fire.ember": {
      name: "余烬",
      desc: (lv) => `火系咕噜压榨火系咕噜：后者压榨业绩 ×${mu(V(P["fire.ember"].asAbsorbed, lv))}`,
    },
    "fire.wildfire": {
      name: "燎原",
      desc: (lv) => `首次计分后，向至多 ${V(P["fire.wildfire"].spread, lv)} 只相邻火系咕噜【点燃】传火；各追加 1 次打工业绩`,
    },
    "fire.chain": {
      name: "引火链",
      desc: (lv) => `火系咕噜上工：压榨数 +${V(P["fire.chain"].reachBonus, lv)}`,
    },
    "electric.overload": {
      name: "过载",
      desc: (lv) => `电系咕噜每压榨 1 只咕噜：加成 ${add(V(P["electric.overload"].perDepth, lv))}`,
    },
    "electric.wire": {
      name: "导线",
      desc: (lv) => `电系咕噜上工：压榨数 +${V(P["electric.wire"].reachBonus, lv)}`,
    },
    "electric.parallel": {
      name: "并联回路",
      desc: (lv) => `电系咕噜每多接 1 桌：加成 ${add(V(P["electric.parallel"].perExtraDesk, lv))}`,
    },
    "electric.induction": {
      name: "感应",
      desc: (lv) => `电系咕噜的【线路】每接通 1 条桌边：加成 ${add(V(P["electric.induction"].perLink, lv))}`,
    },
    "ice.icicle": {
      name: "冰棱",
      desc: (lv) => `冰系咕噜正上方的咕噜：团队业绩 ×${mu(V(P["ice.icicle"].above, lv))}`,
    },
    "ice.freezeprice": {
      name: "冻价",
      desc: (lv) => `冰系咕噜的雇佣价格 ×${mu(V(P["ice.freezeprice"].priceMult, lv))}`,
    },
    "ice.prism": {
      name: "棱镜",
      desc: (lv) => `冰系咕噜已接桌：接桌数 +1，桌面加成 ${add(V(P["ice.prism"].extraShare, lv))}`,
    },
    "ice.chain": {
      name: "冰桥",
      desc: (lv) => `冰系咕噜上工：压榨数 +${V(P["ice.chain"].reachBonus, lv)}`,
    },
    "ice.freeze": {
      name: "急冻通路",
      desc: (lv) => `冰系咕噜结算后：${odds(V(P["ice.freeze"].chance, lv))}【冻结】下方 1 只被压榨咕噜`,
    },
    "ice.overstaff": {
      name: "超额编制奖",
      desc: (lv) => `冰系咕噜每有 1 只【超额人口】咕噜：加成 ${add(V(P["ice.overstaff"].per, lv))}`,
    },
    "water.reflow": {
      name: "回流",
      desc: (lv) =>
        `弹开失投返还雇佣费 ${pc(V(P["water.reflow"].refund, lv))}%`,
    },
    "water.reservoir": {
      name: "蓄水",
      desc: (lv) =>
        `班末现金利息 +${pc(V(P["water.reservoir"].interest, lv))}%`,
    },
    "water.fourday": {
      name: "工休",
      desc: (lv) => `同种水系咕噜达到 ${V(P["water.fourday"].line, lv)} 只即罢工；每只追加打工业绩 ×${mu(V(P["water.fourday"].strikeBonus, lv))}`,
    },
    "water.chain": {
      name: "水道",
      desc: (lv) => `水系咕噜上工：压榨数 +${V(P["water.chain"].reachBonus, lv)}`,
    },
    "water.same": {
      name: "同名增压",
      desc: (lv) => `水系咕噜本次计分团队每有 1 只【同种】咕噜：本卡 ×${mu(V(P["water.same"].perTeamSame, lv))}（至多 10 只）`,
    },
    "water.convert": {
      name: "水镜同化",
      desc: (lv) => `水系咕噜结算后，将本次压榨中业绩最高的 ${V(P["water.convert"].targets, lv)} 只非水咕噜【同化】`,
    },
    "grass.root": {
      name: "扎根",
      desc: (lv) => `草系咕噜踩桌：该桌团队业绩 ×${mu(V(P["grass.root"].deskMult, lv))}`,
    },
    "grass.symbiosis": {
      name: "共生",
      desc: (lv) => `草系咕噜每有 1 只非草邻居：压榨加成 ${add(V(P["grass.symbiosis"].perNeighbor, lv))}`,
    },
    "grass.growth": {
      name: "生长",
      desc: (lv) => `草系咕噜每跨 1 班：打工业绩加成 ${add(V(P["grass.growth"].perShift, lv))}（上限 ×${V(P["grass.growth"].capX, lv)}）`,
    },
    "grass.chain": {
      name: "藤链",
      desc: (lv) => `草系咕噜上工：压榨数 +${V(P["grass.chain"].reachBonus, lv)}`,
    },
    "grass.grow": {
      name: "野蛮生长",
      desc: (lv) => `草系咕噜结算后：${odds(V(P["grass.grow"].chance, lv))}【生长】`,
    },
    "grass.crowd": {
      name: "繁茂群落",
      desc: (lv) => `草系咕噜所在连通片每有 1 只咕噜（【繁茂】）：加成 ${add(V(P["grass.crowd"].perConnected, lv))}`,
    },
    "grass.height": {
      name: "高层冠幅",
      desc: (lv) => `草系咕噜【层高】超过 1 后，每层加成 ${add(V(P["grass.height"].perLayer, lv))}（上限 ${P["grass.height"].cap}）`,
    },
    "normal.crowd": {
      name: "人海",
      desc: (lv) =>
        `场上每有 5 只一般系咕噜，全局团队业绩 +${pc(V(P["normal.crowd"].per5, lv))}%`,
    },
    "normal.temp": {
      name: "临时工",
      desc: (lv) =>
        `1 色工种通胀率降为 ×${P["normal.temp"].inflation[Math.min(lv, P["normal.temp"].inflation.length) - 1]}`,
    },
    "normal.jack": {
      name: "万金油",
      desc: (lv) =>
        lv >= 2
          ? "一般系咕噜视为与任何咕噜共享元素，且可充当任意元素的接桌通路环节"
          : "一般系咕噜与任何咕噜都可按共享元素判定粘连",
    },
    "normal.chain": {
      name: "人脉",
      desc: (lv) => `一般系咕噜上工：压榨数 +${V(P["normal.chain"].reachBonus, lv)}`,
    },
    "normal.absorb": {
      name: "吸收",
      desc: (lv) => {
        const targets = V(P["normal.absorb"].targets, lv);
        const chance = odds(V(P["normal.absorb"].chance, lv));
        return `结算后：${chance}${targets > 1 ? `【吸收】最近的至多 ${targets} 只咕噜` : "【吸收】最近的咕噜"}；体型大者吞小者，同体型由结算者吞`;
      },
    },
    "normal.gluttony": {
      name: "暴食",
      desc: (lv) => `一般系咕噜【体型】超过 1 后，每点加成 ${add(V(P["normal.gluttony"].perSize, lv))}`,
    },
    "normal.emperor": {
      name: "打工皇帝",
      desc: (lv) => `结算后：本次团队中【体型】最大的一般系咕噜【体型】+${V(P["normal.emperor"].grow, lv)}，再【吸收】被其完全遮挡的咕噜`,
    },
    // 旧存档只读；不会再进入商店。
    "normal.tags": { name: "旧·全能履历", desc: () => "已迁移为【吸收】" },
    "normal.overlap": { name: "旧·同岗共鸣", desc: () => "已迁移为【暴食】" },
    "normal.dispatch": { name: "旧·全科调度", desc: () => "已迁移为【打工皇帝】" },
    "attr.pure": {
      name: "专精",
      desc: (lv) => `1 色咕噜：加成 ${add(V(P["attr.pure"].mult, lv) - 1)}`,
    },
    "attr.dual": {
      name: "双职工",
      desc: (lv) => `2 色咕噜：加成 ${add(V(P["attr.dual"].mult, lv) - 1)}`,
    },
    "attr.slash": {
      name: "斜杠青年",
      desc: (lv) => `3 色咕噜：加成 ${add(V(P["attr.slash"].mult, lv) - 1)}`,
    },
    "attr.hex": {
      name: "六边形津贴",
      desc: (lv) => `≥4 色咕噜每种元素：加成 ${add(V(P["attr.hex"].perElement, lv))}`,
    },
    "attr.balance": {
      name: "均衡红利",
      desc: (lv) => `1–6 色工种均在场：加成 ${add(V(P["attr.balance"].mult, lv) - 1)}`,
    },
    "syn.steam": {
      name: "蒸汽机",
      desc: (lv) =>
        `相邻火系咕噜＋冰系咕噜产生光环：两只咕噜及其直接邻居的团队业绩 ×${mu(V(P["syn.steam"].aura, lv))}`,
    },
    "syn.short": {
      name: "短路",
      desc: (lv) =>
        `电系咕噜的【线路】每经过 1 只【同种】水系咕噜，追加该水系咕噜打工业绩 ×${mu(V(P["syn.short"].burst, lv))}`,
    },
    "syn.greenhouse": {
      name: "温室",
      desc: (lv) => `火系咕噜压榨草系咕噜后：【生长】率 +${pc(V(P["syn.greenhouse"].chance, lv))}%${lv >= 5 ? "；生成 2 只" : ""}`,
    },
    "syn.permafrost": {
      name: "霜根网络",
      desc: (lv) => `冰系咕噜与草系咕噜【粘连】；每条冰–草边加成 ${add(V(P["syn.permafrost"].perCrossEdge, lv))}（至多 ${V(P["syn.permafrost"].cap, lv)} 条）${lv >= 5 ? "；Lv.5：计算整片粘连" : ""}`,
    },
    "syn.lightningrod": {
      name: "蓄能胃袋",
      desc: (lv) => `一般系咕噜中继电系咕噜【线路】；线路中每点【体型】加成 ${add(V(P["syn.lightningrod"].perMass, lv))}`,
    },
    "syn.mudslide": {
      name: "泥石流",
      desc: () => "塌方经过水系咕噜＋草系咕噜相邻对：原地重新【粘连】",
    },
    "syn.arcIgnite": {
      name: "电弧点火",
      desc: (lv) => `火系咕噜连到电系桌后，每多接 1 桌：加成 ${add(V(P["syn.arcIgnite"].perDesk, lv))}`,
    },
    "syn.thermalShock": {
      name: "热震",
      desc: (lv) => `火系咕噜每压榨 1 只【冻结】咕噜：追加该咕噜打工业绩 ×${mu(V(P["syn.thermalShock"].echo, lv))}`,
    },
    "syn.steamBurst": {
      name: "蒸汽爆发",
      desc: (lv) => `火系咕噜本次计分团队每有 1 只【同种】水系咕噜：加成 ${add(V(P["syn.steamBurst"].perSame, lv))}`,
    },
    "syn.fireDispatch": {
      name: "吞火",
      desc: (lv) => `火系咕噜＋一般系咕噜：【体型】超过 1 后，每点加成 ${add(V(P["syn.fireDispatch"].perMass, lv))}`,
    },
    "syn.superconduct": {
      name: "超导",
      desc: (lv) => `电系咕噜每压榨 1 只【冻结】咕噜：加成 ${add(V(P["syn.superconduct"].perFrozen, lv))}`,
    },
    "syn.bionet": {
      name: "生物电网",
      desc: (lv) => `生成咕噜可中继电系咕噜【线路】；每只相连的生成咕噜加成 ${add(V(P["syn.bionet"].perGenerated, lv))}（最多计 12 只${lv >= 5 ? "；每只 ×2 计" : ""}）`,
    },
    "syn.iceMirror": {
      name: "冰镜同化",
      desc: (lv) => `水系咕噜本次计分团队每有 1 只【冻结】【同种】咕噜：加成 ${add(V(P["syn.iceMirror"].perFrozenSame, lv))}`,
    },
    "syn.coldRotation": {
      name: "冰鲜储备",
      desc: (lv) => `被压榨的【冻结】咕噜【体型】超过 1 后，每点使压榨业绩 ${add(V(P["syn.coldRotation"].perMass, lv))}`,
    },
    "syn.irrigation": {
      name: "灌溉增殖",
      desc: (lv) => `水系咕噜＋草系咕噜【生长】时生成【同种】咕噜；成功率 ×${mu(V(P["syn.irrigation"].chanceMult, lv))}${lv >= 5 ? "；生成 3 只" : ""}`,
    },
    "syn.badge": {
      name: "液态融合",
      desc: (lv) => `水系咕噜＋一般系咕噜【吸收】后：追加团队业绩 ×${mu(V(P["syn.badge"].mult, lv) - 1)}`,
    },
    "syn.multiSeed": {
      name: "营养繁殖",
      desc: (lv) => `一般系咕噜＋草系咕噜【生长】时：生成咕噜继承母体 ${ratio(V(P["syn.multiSeed"].inheritMass, lv))}【体型】`,
    },
    "base.fire": {
      name: "火系培训",
      desc: (lv) => `火系咕噜上工：打工业绩 +${V(P["base.fire"].bonus, lv)}`,
    },
    "base.water": {
      name: "水系培训",
      desc: (lv) => `水系咕噜上工：打工业绩 +${V(P["base.water"].bonus, lv)}`,
    },
    "base.grass": {
      name: "草系培训",
      desc: (lv) => `草系咕噜上工：打工业绩 +${V(P["base.grass"].bonus, lv)}`,
    },
    "base.electric": {
      name: "电系培训",
      desc: (lv) => `电系咕噜上工：打工业绩 +${V(P["base.electric"].bonus, lv)}`,
    },
    "base.ice": {
      name: "冰系培训",
      desc: (lv) => `冰系咕噜上工：打工业绩 +${V(P["base.ice"].bonus, lv)}`,
    },
    "base.normal": {
      name: "一般系培训",
      desc: (lv) => `一般系咕噜上工：打工业绩 +${V(P["base.normal"].bonus, lv)}`,
    },
    "staff.fire3": {
      name: "解雇",
      desc: () => `一次性：解雇至多 ${P["staff.fire3"].picks} 只咕噜，返还 1x 雇价并塌方（无罢工/遣散费）`,
    },
    "staff.severance": {
      name: "遣散费",
      desc: (lv) => `咕噜因罢工或解雇离场：返还 ${ratio(V(P["staff.severance"].refund, lv))} 雇价`,
    },
    "staff.movedesk": {
      name: "搬桌",
      desc: () => "一次性：交换两桌及塔体，跨桌结构从中切开",
    },
    "staff.expand": {
      name: "扩编",
      desc: () => `咕噜总名额 +${P["staff.expand"].quota}`,
    },
    "staff.talentmarket": {
      name: "人才市场",
      desc: (lv) => `每轮招聘：刷新 +${P["staff.talentmarket"].rerollsPerLevel * lv}，候选 +${P["staff.talentmarket"].candidatesPerLevel * lv}（至多录用 10 名）`,
    },
    "staff.backfill": {
      name: "补招聘",
      desc: (lv) => `常规招聘后追加一轮招聘，可额外招聘 ${V(P["staff.backfill"].extraCandidates, lv)} 只咕噜`,
    },
    "staff.loan": {
      name: "贷款",
      desc: () => `立得 ${ratio(LOAN_GAIN_RATE)} KPI；后 ${LOAN_SHIFTS} 班各还 ${ratio(LOAN_REPAY_RATE)} 本金（共 ${ratio(LOAN_TOTAL_REPAY_RATE)}）`,
    },
    "staff.pricecut": {
      name: "压价",
      desc: (lv) => `指定工种：本局雇价 −${pc(V(P["staff.pricecut"].cut, lv))}%`,
    },
  },
};

const en: FactoryRogueStrings = {
  hubTitle: "Work Factory",
  hubDemoTitle: "Classic Sandbox",
  hubDemoDesc: "Free airdrops, pile mountains, strikes — no rules, just vibes",
  hubRogueTitle: "Office Stack-Up",
  hubRogueDesc: "20 shifts of KPI survival: hire Gulus, stack high, earn Team Performance — don't go broke",
  hubBack: "← Back",

  loTitle: "Gulu Draft",
  loDeskMap: "This run's desk map (random — the Desk Shuffle card can swap)",
  loPick: "Pick {min}–{max} Gulu species: fewer build stronger exploitation stacks but strike more; more are safer but dilute the build",
  loPicked: "Picked {n}/{max}",
  loStart: "Clock in!",
  loNeedMore: "Pick at least {min} species",
  loEmpty: "No Gulus yet — hatch one first",
  loBaseValue: "Work Performance {n}",
  loReach: "Exploitation Reach {n}",
  loGroupNo: "No.{n}",
  loHireBase: "Hire base {pct}% KPI",
  loTier: "{n}-color job",

  hudBack: "← Quit",
  hudRevenue: "Revenue",
  hudShift: "Shift {n}/{total}",
  hudShiftEndless: "Shift ∞+{m}",
  hudKpi: "KPI",
  hudBill: "Bill {v} due",
  hudCash: "Cash",
  hudQuota: "Seats",
  hudCombo: "Combo ×{n}",
  hudBag: "Hiring Pool",
  hudBagEmpty: "Hiring pool empty",
  hudWarnBankrupt: "⚠️ Bankruptcy alert: the wallet can't cover the next move",
  hudDismiss: "Layoff mode: click Gulus on the tower ({n} left)",
  hudSwapDesk: "Desk shuffle: pick two desks to swap",
  hudPricecut: "Lowball: pick a job tier to discount for this run",
  hudTierBtn: "{n}-color",

  modRush: "Crunch Day",
  modRushRule: "Hit the KPI with active drops in {s} seconds — miss it when the paper burns out and you go bankrupt",
  modRushLeft: "⏱ {s}s",
  modPower: "Brownout Day",
  modPowerRule: "Only {n} manual drops this shift. Every release costs 1; hit KPI before they run out (overtime is free)",
  modPowerLeft: "{n} drops left",
  modWind: "Gale Day",
  modWindRule: "Crosswind bends your drops; flips every 20s — watch the flag!",
  modAudit: "Final Combined Check",
  modAuditRule: "All desks open: hit 50M KPI within 5 minutes and 20 manual drops while the gale flips every 20s",

  shopTitle: "After-shift Shop (Shift {n})",
  dim1: "Element Series",
  dim2: "Traits & Operations",
  dim3: "Synergy",
  dim4: "Traits & Operations",
  dim5: "Mixed Selection",
  shopBuy: "Buy",
  shopSkip: "Skip +{v}",
  shopReroll: "Reroll −{v}",
  shopResolved: "Done",
  shopNext: "Next shift →",
  shopOwnedLv: "Owned Lv.{lv}",
  shopFree: "FREE",
  shopMaxLv: "Maxed",
  shopLoanActive: "LOAN ACTIVE",
  shopStep: "Pick {n}/{total}",
  shopAllDone: "Upgrade complete, ready to recruit",
  shopOpPaused: "Finish this action to resume the shop · {n} picks left",
  operationKicker: "ACTION REQUIRED",
  operationDismissTitle: "Choose Gulus to lay off",
  operationDismissSceneHint: "Click Gulus in the factory; each refunds 100% of its latest hire price",
  operationSwapTitle: "Choose desks to swap",
  operationSwapHint: "Pick two desks; swapping returns every Gulu on them to the hiring pool",
  operationPricecutTitle: "Choose a job tier to lowball",
  operationPricecutHint: "That tier's base hiring cost stays discounted for this run",
  rarityCommon: "Common",
  rarityRare: "Rare",
  rarityEpic: "Epic",

  swapPicked: "Picked",
  quitTitle: "Leave the factory?",
  quitBody: "Progress and desk piles are saved — pick “Resume run” next time",
  quitYes: "Save & leave",
  quitNo: "Back to work",
  resumeTitle: "You left a shift unfinished",
  resumeBody: "Resuming returns to that shift with cash, cards, progress, Gulus, and desk piles intact",
  resumeShiftInfo: "Last run: Shift {n}",
  resumeContinue: "Resume run",
  resumeNew: "Start fresh",
  bellDone: "SHIFT CLEARED — CLOCK OUT!",
  overtimeTitle: "OVERTIME",
  overtimeStart: "OVERTIME! Reserve Gulus clock in to earn Team Performance",
  kpiBonus: "KPI ACHIEVEMENT BONUS",
  overtimeRemaining: "Settling Team Performance and returning · {n} Gulu(s) left",
  shopBillPaid: "Shift bill {v}",
  paidStamp: "PAID ✓",
  hintNoShare: "✗ Zero chemistry. Boing!",
  landingFailed: "MISSED THE LANDING — TRY AGAIN!",
  hintNoDesk: "✗ Not a single desk got the memo",
  connectionFailed: "ALL DESKS OFFLINE!",
  disabledDeskHint: "{element} SCORES NOTHING THIS SHIFT",
  disabledDeskStamp: "NO SCORE THIS SHIFT",
  mile10k: "10K CLUB!",
  mile100k: "SIX FIGURES!",
  mile1m: "MILLIONAIRE!",
  mile100m: "100M MOGUL!",
  dismissStampText: "CUT",
  sealText: "SEIZED",
  sumEndlessBadge: "∞ Endless Mode unlocked",
  tutThrow: "Drop a Gulu onto the glowing matching desk!",
  tutStack: "Stack them! The Gulu above exploits performance from the Gulus below",
  tutSame: "Two of a kind stuck — one more and they unionize!",
  tutKpi: "Hit KPI with fewer Gulus — reserves settle Team Performance automatically, then return for the next shift",

  loShiftOne: "Shift 1",
  loLeaderboard: "LEADERBOARD",
  loElementOdds: "DRAW BAG ELEMENT ODDS",
  loWorkLegend: "★ WORK PERFORMANCE = score this Gulu produces on its own",
  loExploitLegend: "⛓ EXPLOITATION REACH = number of Gulus below it that can contribute",
  loIn: "IN ✓",
  shopHeader: "SHIFT-END SHOP",
  shopTakeFree: "TAKE IT",
  shopKeywordAria: "Keyword tips",
  shopKeywordTitle: "KEYWORD TIPS",
  shopKeywordEmpty: "No extra keywords on these cards",
  runtimeTeamPerformance: "TEAM PERFORMANCE",
  runtimeExploitationPerformance: "EXPLOITATION PERFORMANCE",
  runtimePaused: "Paused safely for {seconds}s — back to work!",
  kpiAchieved: "KPI ACHIEVED!",
  sumViewLeaderboard: "View leaderboard",
  steamGlobalRankEmpty: "Steam global rank —",

  hireTitle: "GULU HIRING",
  hireShiftRound: "Shift {shift} · Draft {round}/{max}",
  hireCash: "CASH",
  hirePool: "GULU POOL",
  hireTip: "All Gulus are preselected. Uncheck any you do not want, then pay once. Selected Gulus survive rerolls.",
  hireSelected: "IN ✓",
  hirePick: "PICK",
  hireWorkPerformance: "Work Performance",
  hireExploitCount: "Exploitation Reach",
  hireVerb: "HIRE",
  hirePoolCurrent: "CURRENT GULU POOL",
  hirePoolTotal: "{count} TOTAL",
  hirePoolEmpty: "GULU POOL IS EMPTY",
  hirePicked: "PICKED",
  hireCost: "HIRE COST",
  hireCashAfter: "CASH AFTER PAY",
  hireAfterBill: "AFTER BILL",
  hireReroll: "REROLL UNSELECTED GULUS",
  hireRerollSpent: "REROLL",
  hireClearAll: "CLEAR ALL",
  hireSelectAll: "SELECT ALL",
  hireNoCash: "NOT ENOUGH CASH",
  hirePoolFull: "GULU POOL FULL",
  hirePayNext: "PAY & NEXT DRAFT",
  hirePayStart: "PAY & CLOCK IN!",
  hireConfirmTitle: "CONTINUE?",
  hireConfirmEmpty: "You have not selected any Gulu this draft.",
  hireConfirmLowPool: "Only {count} Gulus will remain in your Gulu pool. Your reserve is running low.",
  hireGoBack: "GO BACK",
  hireContinue: "CONTINUE",

  settlementEyebrow: "SHIFT {shift} · CLOCK-OUT RECEIPT",
  settlementTitle: "Shift Statement",
  settlementSpent: "Spent",
  settlementReceived: "Received",
  settlementBill: "Bill Due",
  settlementRequired: "Required today",
  settlementLoanPayment: "Loan repayment",
  settlementDetails: "Team Performance breakdown",
  settlementTeam: "Team Performance",
  settlementBase: "Work Performance",
  settlementAbsorbed: "Exploitation Performance",
  settlementExtra: "Bonus Performance",
  settlementPools: "Element · Synergy · Job · Rhythm",
  settlementEmpty: "No Team Performance earned this shift",
  settlementDesks: "{count} desk(s)",
  settlementWallet: "My wallet",
  settlementAfter: "After all payments",
  settlementShortfall: "Shortfall",
  settlementConfirmAll: "Confirm all payments",
  settlementConfirmBill: "Confirm & pay bill",
  settlementConfirmBankruptcy: "Insufficient — confirm bankruptcy",
  settlementPaying: "Paying…",
  settlementPaid: "PAID ✓",
  settlementRefund: "Refund",
  settlementTrickle: "Rush trickle",
  settlementKpiBonus: "KPI achievement bonus",

  lbAria: "Steam Global Leaderboard",
  lbLegacyLineup: "Lineup unavailable for legacy record",
  lbMe: "ME",
  lbBestRevenue: "BEST REVENUE",
  lbBestShift: "BEST SHIFT",
  lbEndless: "ENDLESS",
  lbNormal: "NORMAL",
  lbBack: "BACK",
  lbTitle: "GLOBAL FACTORY LEADERBOARD",
  lbTop100: "GLOBAL TOP 100",
  lbUpdated: "Updated {time}",
  lbRefresh: "REFRESH",
  lbRankPlayer: "RANK / PLAYER",
  lbColumns: "REVENUE / SHIFT / MODE / RECORD LINEUP",
  lbConnecting: "Connecting to Steam leaderboard…",
  lbUnavailable: "Leaderboard unavailable",
  lbRetry: "TRY AGAIN",
  lbEmpty: "No records yet. Be the first!",
  lbMyRank: "MY RANK",
  lbNotRanked: "Not ranked · Finish a run to submit a score",
  sumNewRecordBadge: "★ NEW RECORD ★",
  sumFactoryDrop: "FACTORY DROP",
  cardAria: "{name}, level {level}. {description}",
  levelAria: "Level {level}",

  sumBankrupt: "SEIZED — Bankrupt",
  sumGraduate: "Graduated! 20 shifts cleared",
  sumEndlessOver: "Endless run over",
  sumRevenue: "Total revenue",
  sumShifts: "Shifts survived",
  sumMaxPulse: "Best Team Performance",
  sumMaxCombo: "Longest combo",
  sumMaxDesks: "Most desks linked",
  sumStrikes: "Strikes",
  sumThrows: "Hires",
  sumBounces: "Misses",
  sumBestRevenue: "Best revenue",
  sumBestShift: "Deepest shift",
  sumRuns: "Runs",
  sumRewards: "RUN HAUL",
  sumRewardsHint: "Rank-up items · delivered to the Training Hall",
  sumRewardsTotal: "{count} items total",
  sumRewardsEmpty: "No new rank-up items this run",
  sumRewardsEmptyHint: "Today's rewards for these shifts were already claimed — push deeper for more",
  sumCoinsEarned: "Coins earned this run",
  sumThisRunItems: "Items earned this run",
  sumTodayItems: "Items earned today",
  sumTodayEmpty: "No Factory items earned today",
  sumUpgradeHint: "Items are stored in the Training Hall and can rank up your Gulus",
  sumTapForTip: "Tap for info",
  sumItemTipAria: "{name} ×{count}. Tap for details",
  sumItemUpgradeTip: "This is a Gulu rank-up item. Spend it in the Training Hall to raise a Gulu's rank.",
  sumPerformance: "Run performance",
  steamNewRecord: "You set a new personal record",
  steamSyncing: "Syncing to the Steam leaderboard",
  steamGlobalRank: "Steam global rank #{rank}",
  sumRetry: "Run it back",
  sumBack: "Back",
  sumContinueEndless: "Keep grinding (Endless) →",

  strikeSigns: [
    "NO PAY NO WAY",
    "STOP THE GRIND",
    "SUN BREAK NOW",
    "WEEKENDS EXIST",
    "RAISE OR RAGE",
    "TOO PACKED IN HERE",
    "PROMISES ≠ PIZZA",
    "PAID NAP RIGHTS",
  ],

  cards: {
    "fire.burst": {
      name: "Burn Rate",
      desc: (lv) => `When Ignite triggers, add the Fire Gulu's Work Performance ${V(P["fire.burst"].repeats, lv)} extra times.`,
    },
    "fire.ember": {
      name: "Warm Handover",
      desc: (lv) =>
        `When a Fire Gulu exploits another Fire Gulu, the target's Exploitation Performance is ×${mu(V(P["fire.ember"].asAbsorbed, lv))}.`,
    },
    "fire.wildfire": {
      name: "Wildfire",
      desc: (lv) =>
        `After the first score, Ignite up to ${V(P["fire.wildfire"].spread, lv)} adjacent Fire Gulus. Each scores its Work Performance 1 extra time.`,
    },
    "fire.chain": {
      name: "Fireline",
      desc: (lv) => `Deploying a Fire Gulu increases its Exploitation Reach by +${V(P["fire.chain"].reachBonus, lv)}.`,
    },
    "electric.overload": {
      name: "Crunch Mode",
      desc: (lv) => `For an Electric Gulu, each exploited Gulu grants bonus ${addEn(V(P["electric.overload"].perDepth, lv))}.`,
    },
    "electric.wire": {
      name: "Live Wire",
      desc: (lv) => `Deploying an Electric Gulu increases its Exploitation Reach by +${V(P["electric.wire"].reachBonus, lv)}.`,
    },
    "electric.parallel": {
      name: "Parallel Circuit",
      desc: (lv) => `For an Electric Gulu, each linked desk after the first grants bonus ${addEn(V(P["electric.parallel"].perExtraDesk, lv))}.`,
    },
    "electric.induction": {
      name: "Corporate Ladder",
      desc: (lv) => `Each Circuit edge from an Electric Gulu to a linked desk grants bonus ${addEn(V(P["electric.induction"].perLink, lv))}.`,
    },
    "ice.icicle": {
      name: "Icicle",
      desc: (lv) =>
        `Gulus directly above an Ice Gulu multiply their Team Performance by ×${mu(V(P["ice.icicle"].above, lv))}.`,
    },
    "ice.freezeprice": {
      name: "Wage Freeze",
      desc: (lv) =>
        `Multiply the hire price of every Ice Gulu by ×${mu(V(P["ice.freezeprice"].priceMult, lv))}.`,
    },
    "ice.freeze": {
      name: "Flash-Freeze Route",
      desc: (lv) => `After an Ice Gulu scores, it has a ${oddsEn(V(P["ice.freeze"].chance, lv))} chance to Freeze 1 exploited Gulu below it.`,
    },
    "ice.overstaff": {
      name: "Overstaffing Bonus",
      desc: (lv) => `For an Ice Gulu, each Overstaff Gulu on the field grants bonus ${addEn(V(P["ice.overstaff"].per, lv))}.`,
    },
    "ice.prism": {
      name: "Prism",
      desc: (lv) => `An Ice Gulu at a desk counts 1 extra linked desk and gains bonus ${addEn(V(P["ice.prism"].extraShare, lv))}.`,
    },
    "ice.chain": {
      name: "Ice Bridge",
      desc: (lv) => `Deploying an Ice Gulu increases its Exploitation Reach by +${V(P["ice.chain"].reachBonus, lv)}.`,
    },
    "water.reflow": {
      name: "Backflow",
      desc: (lv) =>
        `After a failed throw, refund ${pc(V(P["water.reflow"].refund, lv))}% of the hire price.`,
    },
    "water.reservoir": {
      name: "Rainy-Day Fund",
      desc: (lv) =>
        `At shift end, add ${pc(V(P["water.reservoir"].interest, lv))}% interest to your cash.`,
    },
    "water.fourday": {
      name: "Four-Day Week",
      desc: (lv) => `A Same-species Water Gulu group strikes at ${V(P["water.fourday"].line, lv)} Gulus. Each one adds its Work Performance ×${mu(V(P["water.fourday"].strikeBonus, lv))}.`,
    },
    "water.same": {
      name: "Same-Name Tide",
      desc: (lv) => `Each Same-name Gulu in a Water Gulu's scoring team multiplies this card by ×${mu(V(P["water.same"].perTeamSame, lv))}, up to 10 Gulus.`,
    },
    "water.convert": {
      name: "Assimilation",
      desc: (lv) => `After a Water Gulu scores, Convert the ${V(P["water.convert"].targets, lv)} highest-scoring exploited non-Water Gulus.`,
    },
    "water.chain": {
      name: "Waterway",
      desc: (lv) => `Deploying a Water Gulu increases its Exploitation Reach by +${V(P["water.chain"].reachBonus, lv)}.`,
    },
    "grass.root": {
      name: "Deep Roots",
      desc: (lv) => `A Grass Gulu on a desk multiplies that desk's Team Performance by ×${mu(V(P["grass.root"].deskMult, lv))}.`,
    },
    "grass.symbiosis": {
      name: "Team Player",
      desc: (lv) => `For a Grass Gulu, each neighbor without Grass grants exploitation bonus ${addEn(V(P["grass.symbiosis"].perNeighbor, lv))}.`,
    },
    "grass.growth": {
      name: "Compound Growth",
      desc: (lv) =>
        `Each survived shift adds ${addEn(V(P["grass.growth"].perShift, lv))} Work Performance to a Grass Gulu, capped at ×${V(P["grass.growth"].capX, lv)}.`,
    },
    "grass.chain": {
      name: "Vine Network",
      desc: (lv) => `Deploying a Grass Gulu increases its Exploitation Reach by +${V(P["grass.chain"].reachBonus, lv)}.`,
    },
    "grass.grow": {
      name: "Self-Propagation",
      desc: (lv) => `After a Grass Gulu scores, it has a ${oddsEn(V(P["grass.grow"].chance, lv))} chance to Grow.`,
    },
    "grass.crowd": {
      name: "Lush Workforce",
      desc: (lv) => `Each Gulu in a Grass Gulu's connected group (Lush) grants bonus ${addEn(V(P["grass.crowd"].perConnected, lv))}.`,
    },
    "grass.height": {
      name: "Canopy",
      desc: (lv) => `Each Height above 1 grants a Grass Gulu bonus ${addEn(V(P["grass.height"].perLayer, lv))}, up to Height ${P["grass.height"].cap}.`,
    },
    "normal.crowd": {
      name: "Warm Bodies",
      desc: (lv) =>
        `For every 5 Normal Gulus on the field, all Team Performance increases by +${pc(V(P["normal.crowd"].per5, lv))}%.`,
    },
    "normal.temp": {
      name: "Temp Agency",
      desc: (lv) =>
        `Multiply wage growth for 1-color jobs by ×${P["normal.temp"].inflation[Math.min(lv, P["normal.temp"].inflation.length) - 1]}.`,
    },
    "normal.jack": {
      name: "Jack of All Trades",
      desc: (lv) =>
        lv >= 2
          ? "Normal Gulus can Stick to any Gulu and relay the desk path of any element."
          : "When using Stick, Normal Gulus count as sharing an element with every Gulu.",
    },
    "normal.chain": {
      name: "Office Network",
      desc: (lv) => `Deploying a Normal Gulu increases its Exploitation Reach by +${V(P["normal.chain"].reachBonus, lv)}.`,
    },
    "normal.absorb": {
      name: "Absorb",
      desc: (lv) => {
        const targets = V(P["normal.absorb"].targets, lv);
        const chance = oddsEn(V(P["normal.absorb"].chance, lv));
        return `After scoring, there is a ${chance} chance to Absorb ${targets > 1 ? `up to ${targets} nearest Gulus` : "the nearest Gulu"}. The larger Size wins; if tied, the scoring Gulu wins.`;
      },
    },
    "normal.gluttony": {
      name: "Gluttony",
      desc: (lv) => `Each Size above 1 grants a Normal Gulu bonus ${addEn(V(P["normal.gluttony"].perSize, lv))}.`,
    },
    "normal.emperor": {
      name: "Employee of the Universe",
      desc: (lv) => `After the team scores, the Normal Gulu with the largest Size gains +${V(P["normal.emperor"].grow, lv)} Size. It then uses Absorb on every Gulu completely below it.`,
    },
    "normal.tags": { name: "Legacy Résumé", desc: () => "Migrated to Absorb" },
    "normal.overlap": { name: "Legacy Resonance", desc: () => "Migrated to Gluttony" },
    "normal.dispatch": { name: "Legacy Dispatch", desc: () => "Migrated to Employee of the Universe" },
    "syn.arcIgnite": {
      name: "Arc Ignition",
      desc: (lv) => `For a Fire Gulu linked to an Electric desk, each extra linked desk grants bonus ${addEn(V(P["syn.arcIgnite"].perDesk, lv))}.`,
    },
    "syn.thermalShock": {
      name: "Thermal Shock",
      desc: (lv) =>
        `For a Fire Gulu, each exploited Frozen Gulu adds that target's Work Performance ×${mu(V(P["syn.thermalShock"].echo, lv))}.`,
    },
    "syn.steamBurst": {
      name: "Steam Burst",
      desc: (lv) => `Each Same-name Water Gulu in a Fire Gulu's scoring team grants bonus ${addEn(V(P["syn.steamBurst"].perSame, lv))}.`,
    },
    "syn.fireDispatch": {
      name: "Fire-Eater",
      desc: (lv) => `For a Fire Gulu with a Normal Gulu, each Size above 1 grants bonus ${addEn(V(P["syn.fireDispatch"].perMass, lv))}.`,
    },
    "syn.superconduct": {
      name: "Superconductor",
      desc: (lv) => `For an Electric Gulu, each exploited Frozen Gulu grants bonus ${addEn(V(P["syn.superconduct"].perFrozen, lv))}.`,
    },
    "syn.bionet": {
      name: "Bio-Network",
      desc: (lv) => `Generated Gulus relay an Electric Gulu's Circuit. Each connected Generated Gulu grants bonus ${addEn(V(P["syn.bionet"].perGenerated, lv))}, up to 12${lv >= 5 ? "; at level 5, each counts 2×" : ""}.`,
    },
    "syn.iceMirror": {
      name: "Ice Mirror",
      desc: (lv) => `Each Frozen Same-name Gulu in a Water Gulu's scoring team grants bonus ${addEn(V(P["syn.iceMirror"].perFrozenSame, lv))}.`,
    },
    "syn.coldRotation": {
      name: "Cold Storage",
      desc: (lv) => `For each exploited Frozen Gulu, every Size above 1 raises its Exploitation Performance by ${addEn(V(P["syn.coldRotation"].perMass, lv))}.`,
    },
    "syn.irrigation": {
      name: "Irrigation",
      desc: (lv) =>
        `When a Water Gulu helps a Grass Gulu Grow, it creates a Same-name Gulu with chance ×${mu(V(P["syn.irrigation"].chanceMult, lv))}${lv >= 5 ? "; at level 5, create 3 copies" : ""}.`,
    },
    "syn.badge": {
      name: "Liquid Fusion",
      desc: (lv) => `When a Water Gulu and Normal Gulu trigger Absorb together, add Team Performance ×${mu(V(P["syn.badge"].mult, lv) - 1)}.`,
    },
    "syn.multiSeed": {
      name: "Nutrient Seed",
      desc: (lv) => `A Generated Gulu from a Normal Gulu and Grass Gulu inherits ${ratioEn(V(P["syn.multiSeed"].inheritMass, lv))} of its parent's Size.`,
    },
    "attr.pure": {
      name: "Specialist",
      desc: (lv) => `All 1-color Gulus gain bonus ${addEn(V(P["attr.pure"].mult, lv) - 1)}.`,
    },
    "attr.dual": {
      name: "Dual Income",
      desc: (lv) => `All 2-color Gulus gain bonus ${addEn(V(P["attr.dual"].mult, lv) - 1)}.`,
    },
    "attr.slash": {
      name: "Side Hustler",
      desc: (lv) => `All 3-color Gulus gain bonus ${addEn(V(P["attr.slash"].mult, lv) - 1)}.`,
    },
    "attr.hex": {
      name: "Hexagon Allowance",
      desc: (lv) => `For Gulus with ≥4 colors, each element grants bonus ${addEn(V(P["attr.hex"].perElement, lv))}.`,
    },
    "attr.balance": {
      name: "Full-Roster Bonus",
      desc: (lv) => `If all 1–6-color jobs are on site, everyone gains bonus ${addEn(V(P["attr.balance"].mult, lv) - 1)}.`,
    },
    "syn.steam": {
      name: "Steam Engine",
      desc: (lv) => `When a Fire Gulu is next to an Ice Gulu, multiply the pair and their neighbors' Team Performance by ×${mu(V(P["syn.steam"].aura, lv))}.`,
    },
    "syn.short": {
      name: "Short Circuit",
      desc: (lv) => `In an Electric Gulu's Circuit, multiply Work Performance from each Same-name Water Gulu by ×${mu(V(P["syn.short"].burst, lv))}.`,
    },
    "syn.greenhouse": {
      name: "Greenhouse",
      desc: (lv) => `When a Fire Gulu exploits a Grass Gulu, Grow chance increases by +${pc(V(P["syn.greenhouse"].chance, lv))}%${lv >= 5 ? "; at level 5, create 2 copies" : ""}.`,
    },
    "syn.permafrost": {
      name: "Frostroot Network",
      desc: (lv) => `When an Ice Gulu and Grass Gulu use Stick, each link between them grants bonus ${addEn(V(P["syn.permafrost"].perCrossEdge, lv))}, up to ${V(P["syn.permafrost"].cap, lv)} links${lv >= 5 ? "; at level 5, count their whole connected group" : ""}.`,
    },
    "syn.lightningrod": {
      name: "Battery Belly",
      desc: (lv) => `Normal Gulus relay Electric Circuit. Each Size point along its routes grants bonus ${addEn(V(P["syn.lightningrod"].perMass, lv))}.`,
    },
    "syn.mudslide": {
      name: "Mudslide",
      desc: () => "When a tower collapses through a Water Gulu and Grass Gulu, they Stick again in place.",
    },
    "base.fire": {
      name: "Fire Training",
      desc: (lv) => `Each deployed Fire Gulu gains +${V(P["base.fire"].bonus, lv)} Work Performance.`,
    },
    "base.water": {
      name: "Water Training",
      desc: (lv) => `Each deployed Water Gulu gains +${V(P["base.water"].bonus, lv)} Work Performance.`,
    },
    "base.grass": {
      name: "Grass Training",
      desc: (lv) => `Each deployed Grass Gulu gains +${V(P["base.grass"].bonus, lv)} Work Performance.`,
    },
    "base.electric": {
      name: "Electric Training",
      desc: (lv) => `Each deployed Electric Gulu gains +${V(P["base.electric"].bonus, lv)} Work Performance.`,
    },
    "base.ice": {
      name: "Ice Training",
      desc: (lv) => `Each deployed Ice Gulu gains +${V(P["base.ice"].bonus, lv)} Work Performance.`,
    },
    "base.normal": {
      name: "Normal Training",
      desc: (lv) => `Each deployed Normal Gulu gains +${V(P["base.normal"].bonus, lv)} Work Performance.`,
    },
    "staff.fire3": {
      name: "Pink Slips",
      desc: () => `Use this card once to dismiss ${P["staff.fire3"].picks} Gulus and refund all their hiring costs. The tower collapses safely, with no strike or exit fee.`,
    },
    "staff.severance": {
      name: "Severance Package",
      desc: (lv) => `When a Gulu leaves by strike or dismissal, refund ${ratioEn(V(P["staff.severance"].refund, lv))} of its hire price.`,
    },
    "staff.movedesk": {
      name: "Desk Shuffle",
      desc: () => "Use once to exchange 2 desks with their towers. All links between those desks are cut.",
    },
    "staff.expand": {
      name: "Extra Seats",
      desc: () => `Increase the maximum staff count by +${P["staff.expand"].quota}.`,
    },
    "staff.talentmarket": {
      name: "Talent Market",
      desc: (lv) => `Each draft gains +${P["staff.talentmarket"].rerollsPerLevel * lv} rerolls and +${P["staff.talentmarket"].candidatesPerLevel * lv} candidates. You may choose up to 10.`,
    },
    "staff.backfill": {
      name: "Backfill",
      desc: (lv) => `After the regular draft, run an extra draft with ${V(P["staff.backfill"].extraCandidates, lv)} Gulus.`,
    },
    "staff.loan": {
      name: "Payday Loan",
      desc: () => `Receive ${ratioEn(LOAN_GAIN_RATE)} KPI immediately. Repay ${ratioEn(LOAN_REPAY_RATE)} of the borrowed amount for ${LOAN_SHIFTS} shifts (${ratioEn(LOAN_TOTAL_REPAY_RATE)} total).`,
    },
    "staff.pricecut": {
      name: "Lowball Offer",
      desc: (lv) => `Pick 1 job type. Its hire price drops by −${pc(V(P["staff.pricecut"].cut, lv))}% for this game.`,
    },
  },
};

/**
 * Japanese factory UI. Card names/descriptions still use the English fallback,
 * but every navigation label, warning, tutorial hint, confirmation dialog and
 * run-summary message is native Japanese.
 */
const ja = {
  hubTitle: "おしごと工場",
  hubDemoTitle: "クラシック・サンドボックス",
  hubDemoDesc: "自由に投下、山積み、ストライキ。ルールなしで遊べます",
  hubRogueTitle: "職場つみつみ",
  hubRogueDesc: "全20シフトのKPIサバイバル。グルを雇って積み上げ、チーム実績を稼ぎ、破産を避けよう",
  hubBack: "← 戻る",

  loTitle: "出勤準備",
  loDeskMap: "今回のデスク配置（ランダム。「デスク交換」カードで変更可能）",
  loPick: "コレクションから {min}～{max} 種のグルを選択。少数精鋭は高実績を狙いやすく、多種編成は安定する代わりに構成が薄まります",
  loPicked: "選択済み {n}/{max}",
  loStart: "シフト開始！",
  loNeedMore: "最低 {min} 種を選んでください",
  loEmpty: "グルがいません。まずは1匹ふ化させましょう",
  loBaseValue: "基本実績 {n}",
  loReach: "吸い上げ数 {n}",
  loGroupNo: "番号 {n}",
  loHireBase: "雇用基準 {pct}% KPI",
  loTier: "{n}色職種",
  loLeaderboard: "リーダーボード",
  loElementOdds: "採用プールの属性確率",
  loWorkLegend: "★ 作業実績 = グル自身が生み出すスコア",
  loExploitLegend: "⛓ 搾取回数 = 下にいる搾取可能なグル",
  loIn: "選択済み ✓",

  hudBack: "← 終了",
  hudRevenue: "総売上",
  hudShift: "シフト {n}/{total}",
  hudShiftEndless: "シフト ∞+{m}",
  hudKpi: "KPI",
  hudBill: "請求額 {v}",
  hudCash: "所持金",
  hudQuota: "定員",
  hudCombo: "Combo ×{n}",
  hudBag: "採用プール",
  hudBagEmpty: "採用プールは空です",
  hudWarnBankrupt: "⚠️ 破産警告：次の行動に必要な資金がありません",
  hudDismiss: "解雇モード：現場のグルを選択（残り {n} 匹）",
  hudSwapDesk: "デスク交換：入れ替えるデスクを2台選択",
  hudPricecut: "賃下げ：今回の雇用基準額を下げる職種を選択",
  hudTierBtn: "{n}色",

  modRush: "締切デー",
  modRushRule: "{s}秒以内に手動投下でKPIを達成。メモが燃え尽きるまでに届かなければ破産です",
  modRushLeft: "⏱ 残り{s}秒",
  modPower: "節電デー",
  modPowerRule: "このシフトの手動投下は{n}回まで。回数が尽きる前にKPIを達成してください（残業投下は無料）",
  modPowerLeft: "投下 残り{n}回",
  modWind: "強風デー",
  modWindRule: "横風で軌道が曲がり、20秒ごとに風向きが反転します。旗を確認！",
  modAudit: "最終総合検査",
  modAuditRule: "全デスク開放。5分・手動投下20回以内に5000万KPIを達成。強風は20秒ごとに反転します",

  shopTitle: "シフト後ショップ（第{n}シフト）",
  dim1: "属性シリーズ",
  dim2: "特性・運営",
  dim3: "シナジー",
  dim4: "特性・運営",
  dim5: "総合セレクション",
  shopBuy: "購入",
  shopSkip: "スキップ +{v}",
  shopReroll: "更新 −{v}",
  shopResolved: "決定済み",
  shopNext: "次のシフトへ →",
  shopOwnedLv: "所持 Lv.{lv}",
  shopFree: "無料",
  shopMaxLv: "最大レベル",
  shopLoanActive: "返済中",
  shopStep: "選択 {n}/{total}",
  shopAllDone: "強化完了。採用を始められます",
  shopOpPaused: "この操作を終えるとショップを再開します · 残り{n}回",
  operationKicker: "操作が必要です",
  operationDismissTitle: "解雇するグルを選択",
  operationDismissSceneHint: "工場内のグルを直接クリック。直近の雇用額を100%返金します",
  operationSwapTitle: "交換するデスクを選択",
  operationSwapHint: "デスクを2台選択。上のグルごと入れ替わり、デスク間の接続は切れます",
  operationPricecutTitle: "賃下げする職種を選択",
  operationPricecutHint: "今回のプレイ中、その職種の基本雇用額が下がります",
  rarityCommon: "コモン",
  rarityRare: "レア",
  rarityEpic: "エピック",

  swapPicked: "選択済み",
  quitTitle: "工場を退出しますか？",
  quitBody: "進行状況とデスク上のグルは保存されます。次回は「続きから」を選べます",
  quitYes: "保存して退出",
  quitNo: "仕事に戻る",
  resumeTitle: "未完了のシフトがあります",
  resumeBody: "続きから再開すると、所持金、カード、進行状況、グル、デスク上の配置がすべて復元されます",
  resumeShiftInfo: "前回：第{n}シフト",
  resumeContinue: "続きから",
  resumeNew: "最初からやり直す",
  bellDone: "KPI達成、退勤！",
  overtimeTitle: "残業タイム",
  overtimeStart: "残業開始！ 控えのグルが出勤し、チーム実績を稼ぎます",
  kpiBonus: "KPI達成ボーナス",
  overtimeRemaining: "チーム実績を精算してプールへ戻しています · 残り{n}匹",
  shopBillPaid: "今回の請求額 {v}",
  paidStamp: "支払済 ✓",
  hintNoShare: "✗ 相性ゼロ。はじかれた！",
  landingFailed: "着地失敗。もう一度！",
  hintNoDesk: "✗ 接続できるデスクがありません",
  connectionFailed: "デスク接続失敗！",
  disabledDeskHint: "このシフトでは{element}属性は得点になりません",
  disabledDeskStamp: "このシフトは得点なし",
  mile10k: "1万突破！",
  mile100k: "10万突破！",
  mile1m: "100万突破！",
  mile100m: "1億突破！",
  dismissStampText: "解雇",
  sealText: "差押え",
  sumEndlessBadge: "∞ エンドレスモード解放",
  tutThrow: "光っている同じ属性のデスクへグルを投下しよう！",
  tutStack: "積み上げよう！ 上のグルは下のグルから実績を吸い上げます",
  tutSame: "同種が2匹つながりました。もう1匹つながるとストライキ！",
  tutKpi: "少ないグルでKPIを達成しよう。控えは自動でチーム実績を精算し、次のシフト用にプールへ戻ります",

  sumBankrupt: "破産・差押え",
  sumGraduate: "クリア！ 20シフト達成",
  sumEndlessOver: "エンドレス終了",
  sumRevenue: "総売上",
  sumShifts: "到達シフト",
  sumMaxPulse: "最高チーム実績",
  sumMaxCombo: "最大コンボ",
  sumMaxDesks: "最大接続デスク数",
  sumStrikes: "ストライキ回数",
  sumThrows: "採用回数",
  sumBounces: "投下失敗数",
  sumBestRevenue: "自己ベスト売上",
  sumBestShift: "自己ベストシフト",
  sumRuns: "プレイ回数",
  sumRewards: "今回の報酬",
  sumRewardsHint: "ランクアップ素材 · トレーニングホールへ送付済み",
  sumRewardsTotal: "合計 {count} 個",
  sumRewardsEmpty: "今回は新しいランクアップ素材がありません",
  sumRewardsEmptyHint: "本日は同じ進行度の報酬を受取済みです。さらに先のシフトへ進むと追加報酬を獲得できます",
  sumCoinsEarned: "今回獲得したコイン",
  sumThisRunItems: "今回獲得したアイテム",
  sumTodayItems: "本日獲得したアイテム",
  sumTodayEmpty: "本日はまだ工場アイテムを獲得していません",
  sumUpgradeHint: "獲得した素材はトレーニングホールでグルのランクアップに使えます",
  sumTapForTip: "クリックして確認",
  sumItemTipAria: "{name} ×{count}。クリックして説明を表示",
  sumItemUpgradeTip: "グルのランクアップ素材です。トレーニングホールで対応する素材を使うとランクを上げられます。",
  sumPerformance: "今回の成績",
  steamNewRecord: "自己ベストを更新しました",
  steamSyncing: "Steamランキングに同期中",
  steamGlobalRank: "Steam世界ランキング {rank}位",
  sumRetry: "もう一度プレイ",
  sumBack: "戻る",
  sumContinueEndless: "エンドレスを続ける →",

  strikeSigns: [
    "残業代を払え",
    "やりがい搾取反対",
    "日光を浴びたい",
    "休日をください",
    "今すぐ昇給！",
    "席が狭すぎる",
    "空約束はもう嫌だ",
    "有給ぼんやり権",
  ],
} satisfies DeepPartial<FactoryRogueStrings>;

/**
 * Short action labels are especially prone to collapsing into punctuation in
 * offline machine translation. Keep the navigation/start actions reviewed and
 * deterministic for every generated locale.
 */
export const FACTORY_ACTION_LABEL_LOCALES = {
  "zh-Hant": { hubBack: "← 返回", loStart: "開工！", hudBack: "← 離開", hirePayStart: "付款並開工！", hireGoBack: "返回", lbBack: "返回", sumBack: "返回" },
  ja: { hubBack: "← 戻る", loStart: "業務開始！", hudBack: "← 終了", hirePayStart: "支払って業務開始！", hireGoBack: "戻る", lbBack: "戻る", sumBack: "戻る" },
  ko: { hubBack: "← 뒤로", loStart: "업무 시작!", hudBack: "← 나가기", hirePayStart: "결제하고 업무 시작!", hireGoBack: "뒤로", lbBack: "뒤로", sumBack: "뒤로" },
  fr: { hubBack: "← Retour", loStart: "Commencer le service !", hudBack: "← Quitter", hirePayStart: "Payer et commencer !", hireGoBack: "Retour", lbBack: "Retour", sumBack: "Retour" },
  de: { hubBack: "← Zurück", loStart: "Schicht starten!", hudBack: "← Verlassen", hirePayStart: "Bezahlen und Schicht starten!", hireGoBack: "Zurück", lbBack: "Zurück", sumBack: "Zurück" },
  "es-ES": { hubBack: "← Volver", loStart: "¡Empezar turno!", hudBack: "← Salir", hirePayStart: "¡Pagar y empezar!", hireGoBack: "Volver", lbBack: "Volver", sumBack: "Volver" },
  "es-419": { hubBack: "← Volver", loStart: "¡Empezar turno!", hudBack: "← Salir", hirePayStart: "¡Pagar y empezar!", hireGoBack: "Volver", lbBack: "Volver", sumBack: "Volver" },
  "pt-BR": { hubBack: "← Voltar", loStart: "Começar turno!", hudBack: "← Sair", hirePayStart: "Pagar e começar!", hireGoBack: "Voltar", lbBack: "Voltar", sumBack: "Voltar" },
  "pt-PT": { hubBack: "← Voltar", loStart: "Começar turno!", hudBack: "← Sair", hirePayStart: "Pagar e começar!", hireGoBack: "Voltar", lbBack: "Voltar", sumBack: "Voltar" },
  ru: { hubBack: "← Назад", loStart: "Начать смену!", hudBack: "← Выйти", hirePayStart: "Заплатить и начать смену!", hireGoBack: "Назад", lbBack: "Назад", sumBack: "Назад" },
  it: { hubBack: "← Indietro", loStart: "Inizia il turno!", hudBack: "← Esci", hirePayStart: "Paga e inizia!", hireGoBack: "Indietro", lbBack: "Indietro", sumBack: "Indietro" },
  pl: { hubBack: "← Wstecz", loStart: "Rozpocznij zmianę!", hudBack: "← Wyjdź", hirePayStart: "Zapłać i rozpocznij!", hireGoBack: "Wstecz", lbBack: "Wstecz", sumBack: "Wstecz" },
  tr: { hubBack: "← Geri", loStart: "Vardiyayı başlat!", hudBack: "← Çık", hirePayStart: "Öde ve başlat!", hireGoBack: "Geri", lbBack: "Geri", sumBack: "Geri" },
  uk: { hubBack: "← Назад", loStart: "Почати зміну!", hudBack: "← Вийти", hirePayStart: "Сплатити й почати зміну!", hireGoBack: "Назад", lbBack: "Назад", sumBack: "Назад" },
  ar: { hubBack: "رجوع", loStart: "ابدأ العمل!", hudBack: "مغادرة", hirePayStart: "ادفع وابدأ العمل!", hireGoBack: "رجوع", lbBack: "رجوع", sumBack: "رجوع" },
  th: { hubBack: "← กลับ", loStart: "เริ่มงาน!", hudBack: "← ออก", hirePayStart: "จ่ายและเริ่มงาน!", hireGoBack: "กลับ", lbBack: "กลับ", sumBack: "กลับ" },
  vi: { hubBack: "← Quay lại", loStart: "Bắt đầu ca!", hudBack: "← Thoát", hirePayStart: "Thanh toán và bắt đầu!", hireGoBack: "Quay lại", lbBack: "Quay lại", sumBack: "Quay lại" },
  id: { hubBack: "← Kembali", loStart: "Mulai sif!", hudBack: "← Keluar", hirePayStart: "Bayar dan mulai!", hireGoBack: "Kembali", lbBack: "Kembali", sumBack: "Kembali" },
  nl: { hubBack: "← Terug", loStart: "Dienst starten!", hudBack: "← Verlaten", hirePayStart: "Betalen en starten!", hireGoBack: "Terug", lbBack: "Terug", sumBack: "Terug" },
} satisfies Partial<Record<Language, DeepPartial<FactoryRogueStrings>>>;

/** Payment buttons are reviewed separately so shortcut mnemonics such as `(P)` never leak into UI copy. */
export const FACTORY_PAYMENT_BUTTON_LOCALES = {
  en: { settlementConfirmAll: "Pay everything", settlementConfirmBill: "Pay bill", settlementConfirmBankruptcy: "Insufficient funds · Confirm bankruptcy" },
  "zh-Hans": { settlementConfirmAll: "支付全部款项", settlementConfirmBill: "支付账单", settlementConfirmBankruptcy: "余额不足 · 确认破产" },
  "zh-Hant": { settlementConfirmAll: "支付全部款項", settlementConfirmBill: "支付帳單", settlementConfirmBankruptcy: "餘額不足 · 確認破產" },
  ja: { settlementConfirmAll: "まとめて支払う", settlementConfirmBill: "請求を支払う", settlementConfirmBankruptcy: "残高不足・破産を確定" },
  ko: { settlementConfirmAll: "모두 결제", settlementConfirmBill: "청구서 결제", settlementConfirmBankruptcy: "잔액 부족 · 파산 확정" },
  fr: { settlementConfirmAll: "Tout payer", settlementConfirmBill: "Payer la facture", settlementConfirmBankruptcy: "Fonds insuffisants · Confirmer la faillite" },
  de: { settlementConfirmAll: "Alles bezahlen", settlementConfirmBill: "Rechnung bezahlen", settlementConfirmBankruptcy: "Guthaben reicht nicht · Bankrott bestätigen" },
  "es-ES": { settlementConfirmAll: "Pagar todo", settlementConfirmBill: "Pagar la factura", settlementConfirmBankruptcy: "Saldo insuficiente · Confirmar quiebra" },
  "es-419": { settlementConfirmAll: "Pagar todo", settlementConfirmBill: "Pagar la cuenta", settlementConfirmBankruptcy: "Saldo insuficiente · Confirmar quiebra" },
  "pt-BR": { settlementConfirmAll: "Pagar tudo", settlementConfirmBill: "Pagar a conta", settlementConfirmBankruptcy: "Saldo insuficiente · Confirmar falência" },
  "pt-PT": { settlementConfirmAll: "Pagar tudo", settlementConfirmBill: "Pagar a fatura", settlementConfirmBankruptcy: "Saldo insuficiente · Confirmar falência" },
  ru: { settlementConfirmAll: "Оплатить всё", settlementConfirmBill: "Оплатить счёт", settlementConfirmBankruptcy: "Недостаточно средств · Подтвердить банкротство" },
  it: { settlementConfirmAll: "Paga tutto", settlementConfirmBill: "Paga il conto", settlementConfirmBankruptcy: "Fondi insufficienti · Conferma bancarotta" },
  pl: { settlementConfirmAll: "Zapłać wszystko", settlementConfirmBill: "Zapłać rachunek", settlementConfirmBankruptcy: "Brak środków · Potwierdź bankructwo" },
  tr: { settlementConfirmAll: "Hepsini öde", settlementConfirmBill: "Faturayı öde", settlementConfirmBankruptcy: "Bakiye yetersiz · İflası onayla" },
  uk: { settlementConfirmAll: "Сплатити все", settlementConfirmBill: "Сплатити рахунок", settlementConfirmBankruptcy: "Недостатньо коштів · Підтвердити банкрутство" },
  ar: { settlementConfirmAll: "ادفع الكل", settlementConfirmBill: "ادفع الفاتورة", settlementConfirmBankruptcy: "الرصيد غير كافٍ · أكّد الإفلاس" },
  th: { settlementConfirmAll: "จ่ายทั้งหมด", settlementConfirmBill: "จ่ายบิล", settlementConfirmBankruptcy: "เงินไม่พอ · ยืนยันล้มละลาย" },
  vi: { settlementConfirmAll: "Thanh toán tất cả", settlementConfirmBill: "Thanh toán hóa đơn", settlementConfirmBankruptcy: "Không đủ tiền · Xác nhận phá sản" },
  id: { settlementConfirmAll: "Bayar semua", settlementConfirmBill: "Bayar tagihan", settlementConfirmBankruptcy: "Saldo kurang · Konfirmasi bangkrut" },
  nl: { settlementConfirmAll: "Alles betalen", settlementConfirmBill: "Rekening betalen", settlementConfirmBankruptcy: "Onvoldoende saldo · Faillissement bevestigen" },
} satisfies Partial<Record<Language, DeepPartial<FactoryRogueStrings>>>;

/**
 * `Shift` always means a factory work shift / run round. Short labels gave the
 * offline translator too little context and were repeatedly rendered as
 * movement, switching, or bit shifting, so these high-visibility surfaces are
 * reviewed as one terminology set for every supported language.
 */
export const FACTORY_SHIFT_LABEL_LOCALES = {
  en: { hudShift: "Shift {n}/{total}", hudShiftEndless: "Shift ∞+{m}", shopTitle: "After-shift Shop (Shift {n})", shopNext: "Next shift →", resumeShiftInfo: "Last run: Shift {n}", shopBillPaid: "Shift bill {v}", loShiftOne: "Shift 1", shopHeader: "SHIFT-END SHOP", hireShiftRound: "Shift {shift} · Draft {round}/{max}", settlementEyebrow: "SHIFT {shift} · CLOCK-OUT RECEIPT", settlementTitle: "Shift Statement", lbBestShift: "BEST SHIFT", lbColumns: "REVENUE / SHIFT / MODE / RECORD LINEUP", sumShifts: "Shifts survived", sumBestShift: "Deepest shift" },
  "zh-Hans": { hudShift: "班次 {n}/{total}", hudShiftEndless: "班次 ∞+{m}", shopTitle: "班末商店（第 {n} 班）", shopNext: "下一班 →", resumeShiftInfo: "上次打到：第 {n} 班", shopBillPaid: "本班账单 {v}", loShiftOne: "第 1 班", shopHeader: "班末商店", hireShiftRound: "第 {shift} 班 · 招聘 {round}/{max}", settlementEyebrow: "第 {shift} 班 · 下班回执", settlementTitle: "本班结算单", lbBestShift: "最高班次", lbColumns: "营收 / 班次 / 模式 / 创纪录阵容", sumShifts: "坚持班数", sumBestShift: "历史最深班次" },
  "zh-Hant": { hudShift: "班次 {n}/{total}", hudShiftEndless: "班次 ∞+{m}", shopTitle: "班末商店（第 {n} 班）", shopNext: "下一班 →", resumeShiftInfo: "上次打到：第 {n} 班", shopBillPaid: "本班帳單 {v}", loShiftOne: "第 1 班", shopHeader: "班末商店", hireShiftRound: "第 {shift} 班 · 招聘 {round}/{max}", settlementEyebrow: "第 {shift} 班 · 下班收據", settlementTitle: "本班結算單", lbBestShift: "最高班次", lbColumns: "營收 / 班次 / 模式 / 紀錄陣容", sumShifts: "撐過班數", sumBestShift: "歷史最深班次" },
  ja: { hudShift: "シフト {n}/{total}", hudShiftEndless: "シフト ∞+{m}", shopTitle: "シフト後ショップ（第{n}シフト）", shopNext: "次のシフトへ →", resumeShiftInfo: "前回：第{n}シフト", shopBillPaid: "今回の請求額 {v}", loShiftOne: "第1シフト", shopHeader: "シフト後ショップ", hireShiftRound: "第{shift}シフト · 採用 {round}/{max}", settlementEyebrow: "第{shift}シフト · 退勤明細", settlementTitle: "シフト明細", lbBestShift: "最高シフト", lbColumns: "売上 / シフト / モード / 記録編成", sumShifts: "到達シフト数", sumBestShift: "最高到達シフト" },
  ko: { hudShift: "근무 {n}/{total}", hudShiftEndless: "근무 ∞+{m}", shopTitle: "근무 후 상점 ({n}번째 근무)", shopNext: "다음 근무 →", resumeShiftInfo: "지난 플레이: {n}번째 근무", shopBillPaid: "이번 근무 청구서 {v}", loShiftOne: "첫 근무", shopHeader: "근무 후 상점", hireShiftRound: "{shift}번째 근무 · 채용 {round}/{max}", settlementEyebrow: "{shift}번째 근무 · 퇴근 정산서", settlementTitle: "근무 정산서", lbBestShift: "최고 근무 기록", lbColumns: "매출 / 근무 / 모드 / 기록 편성", sumShifts: "버틴 근무 횟수", sumBestShift: "최고 도달 근무" },
  fr: { hudShift: "Service {n}/{total}", hudShiftEndless: "Service ∞+{m}", shopTitle: "Boutique de fin de service (service {n})", shopNext: "Service suivant →", resumeShiftInfo: "Dernière partie : service {n}", shopBillPaid: "Facture du service {v}", loShiftOne: "Service 1", shopHeader: "BOUTIQUE DE FIN DE SERVICE", hireShiftRound: "Service {shift} · Recrutement {round}/{max}", settlementEyebrow: "SERVICE {shift} · REÇU DE FIN DE SERVICE", settlementTitle: "Bilan du service", lbBestShift: "MEILLEUR SERVICE", lbColumns: "RECETTES / SERVICE / MODE / ÉQUIPE RECORD", sumShifts: "Services terminés", sumBestShift: "Service le plus avancé" },
  de: { hudShift: "Schicht {n}/{total}", hudShiftEndless: "Schicht ∞+{m}", shopTitle: "Feierabend-Shop (Schicht {n})", shopNext: "Nächste Schicht →", resumeShiftInfo: "Letzte Runde: Schicht {n}", shopBillPaid: "Schichtrechnung {v}", loShiftOne: "Schicht 1", shopHeader: "FEIERABEND-SHOP", hireShiftRound: "Schicht {shift} · Auswahl {round}/{max}", settlementEyebrow: "SCHICHT {shift} · FEIERABEND-ABRECHNUNG", settlementTitle: "Schichtabrechnung", lbBestShift: "BESTE SCHICHT", lbColumns: "UMSATZ / SCHICHT / MODUS / REKORD-TEAM", sumShifts: "Überstandene Schichten", sumBestShift: "Höchste erreichte Schicht" },
  "es-ES": { hudShift: "Turno {n}/{total}", hudShiftEndless: "Turno ∞+{m}", shopTitle: "Tienda de fin de turno (turno {n})", shopNext: "Siguiente turno →", resumeShiftInfo: "Última partida: turno {n}", shopBillPaid: "Factura del turno {v}", loShiftOne: "Turno 1", shopHeader: "TIENDA DE FIN DE TURNO", hireShiftRound: "Turno {shift} · Selección {round}/{max}", settlementEyebrow: "TURNO {shift} · RECIBO DE SALIDA", settlementTitle: "Resumen del turno", lbBestShift: "MEJOR TURNO", lbColumns: "INGRESOS / TURNO / MODO / ALINEACIÓN RÉCORD", sumShifts: "Turnos superados", sumBestShift: "Turno más avanzado" },
  "es-419": { hudShift: "Turno {n}/{total}", hudShiftEndless: "Turno ∞+{m}", shopTitle: "Tienda de fin de turno (turno {n})", shopNext: "Siguiente turno →", resumeShiftInfo: "Última partida: turno {n}", shopBillPaid: "Cuenta del turno {v}", loShiftOne: "Turno 1", shopHeader: "TIENDA DE FIN DE TURNO", hireShiftRound: "Turno {shift} · Selección {round}/{max}", settlementEyebrow: "TURNO {shift} · RECIBO DE SALIDA", settlementTitle: "Resumen del turno", lbBestShift: "MEJOR TURNO", lbColumns: "INGRESOS / TURNO / MODO / ALINEACIÓN RÉCORD", sumShifts: "Turnos superados", sumBestShift: "Turno más avanzado" },
  "pt-BR": { hudShift: "Turno {n}/{total}", hudShiftEndless: "Turno ∞+{m}", shopTitle: "Loja pós-turno (turno {n})", shopNext: "Próximo turno →", resumeShiftInfo: "Última partida: turno {n}", shopBillPaid: "Conta do turno {v}", loShiftOne: "Turno 1", shopHeader: "LOJA PÓS-TURNO", hireShiftRound: "Turno {shift} · Seleção {round}/{max}", settlementEyebrow: "TURNO {shift} · RECIBO DE FIM DE TURNO", settlementTitle: "Resumo do turno", lbBestShift: "MELHOR TURNO", lbColumns: "RECEITA / TURNO / MODO / EQUIPE RECORDE", sumShifts: "Turnos concluídos", sumBestShift: "Turno mais avançado" },
  "pt-PT": { hudShift: "Turno {n}/{total}", hudShiftEndless: "Turno ∞+{m}", shopTitle: "Loja de fim de turno (turno {n})", shopNext: "Próximo turno →", resumeShiftInfo: "Última partida: turno {n}", shopBillPaid: "Fatura do turno {v}", loShiftOne: "Turno 1", shopHeader: "LOJA DE FIM DE TURNO", hireShiftRound: "Turno {shift} · Seleção {round}/{max}", settlementEyebrow: "TURNO {shift} · RECIBO DE FIM DE TURNO", settlementTitle: "Resumo do turno", lbBestShift: "MELHOR TURNO", lbColumns: "RECEITA / TURNO / MODO / FORMAÇÃO RECORDE", sumShifts: "Turnos superados", sumBestShift: "Turno mais avançado" },
  ru: { hudShift: "Смена {n}/{total}", hudShiftEndless: "Смена ∞+{m}", shopTitle: "Магазин после смены (смена {n})", shopNext: "Следующая смена →", resumeShiftInfo: "Прошлая игра: смена {n}", shopBillPaid: "Счёт за смену {v}", loShiftOne: "Смена 1", shopHeader: "МАГАЗИН ПОСЛЕ СМЕНЫ", hireShiftRound: "Смена {shift} · Найм {round}/{max}", settlementEyebrow: "СМЕНА {shift} · ИТОГОВЫЙ ЛИСТ", settlementTitle: "Итоги смены", lbBestShift: "ЛУЧШАЯ СМЕНА", lbColumns: "ВЫРУЧКА / СМЕНА / РЕЖИМ / РЕКОРДНЫЙ СОСТАВ", sumShifts: "Пройдено смен", sumBestShift: "Самая дальняя смена" },
  it: { hudShift: "Turno {n}/{total}", hudShiftEndless: "Turno ∞+{m}", shopTitle: "Negozio di fine turno (turno {n})", shopNext: "Turno successivo →", resumeShiftInfo: "Ultima partita: turno {n}", shopBillPaid: "Conto del turno {v}", loShiftOne: "Turno 1", shopHeader: "NEGOZIO DI FINE TURNO", hireShiftRound: "Turno {shift} · Selezione {round}/{max}", settlementEyebrow: "TURNO {shift} · RICEVUTA DI FINE TURNO", settlementTitle: "Riepilogo del turno", lbBestShift: "MIGLIOR TURNO", lbColumns: "RICAVI / TURNO / MODALITÀ / FORMAZIONE RECORD", sumShifts: "Turni superati", sumBestShift: "Turno più avanzato" },
  pl: { hudShift: "Zmiana {n}/{total}", hudShiftEndless: "Zmiana ∞+{m}", shopTitle: "Sklep po zmianie (zmiana {n})", shopNext: "Następna zmiana →", resumeShiftInfo: "Ostatnia gra: zmiana {n}", shopBillPaid: "Rachunek za zmianę {v}", loShiftOne: "Zmiana 1", shopHeader: "SKLEP PO ZMIANIE", hireShiftRound: "Zmiana {shift} · Rekrutacja {round}/{max}", settlementEyebrow: "ZMIANA {shift} · RAPORT PO ZMIANIE", settlementTitle: "Podsumowanie zmiany", lbBestShift: "NAJLEPSZA ZMIANA", lbColumns: "PRZYCHÓD / ZMIANA / TRYB / REKORDOWY SKŁAD", sumShifts: "Przetrwane zmiany", sumBestShift: "Najwyższa osiągnięta zmiana" },
  tr: { hudShift: "Vardiya {n}/{total}", hudShiftEndless: "Vardiya ∞+{m}", shopTitle: "Vardiya sonrası mağaza (vardiya {n})", shopNext: "Sonraki vardiya →", resumeShiftInfo: "Son oyun: {n}. vardiya", shopBillPaid: "Vardiya faturası {v}", loShiftOne: "1. vardiya", shopHeader: "VARDİYA SONU MAĞAZASI", hireShiftRound: "{shift}. vardiya · İşe alım {round}/{max}", settlementEyebrow: "{shift}. VARDİYA · ÇIKIŞ FİŞİ", settlementTitle: "Vardiya özeti", lbBestShift: "EN İYİ VARDİYA", lbColumns: "GELİR / VARDİYA / MOD / REKOR KADRO", sumShifts: "Tamamlanan vardiyalar", sumBestShift: "Ulaşılan en ileri vardiya" },
  uk: { hudShift: "Зміна {n}/{total}", hudShiftEndless: "Зміна ∞+{m}", shopTitle: "Магазин після зміни (зміна {n})", shopNext: "Наступна зміна →", resumeShiftInfo: "Попередня гра: зміна {n}", shopBillPaid: "Рахунок за зміну {v}", loShiftOne: "Зміна 1", shopHeader: "МАГАЗИН ПІСЛЯ ЗМІНИ", hireShiftRound: "Зміна {shift} · Найм {round}/{max}", settlementEyebrow: "ЗМІНА {shift} · ПІДСУМКОВИЙ ЧЕК", settlementTitle: "Підсумки зміни", lbBestShift: "НАЙКРАЩА ЗМІНА", lbColumns: "ДОХІД / ЗМІНА / РЕЖИМ / РЕКОРДНИЙ СКЛАД", sumShifts: "Пройдено змін", sumBestShift: "Найвища досягнута зміна" },
  ar: { hudShift: "الوردية {n}/{total}", hudShiftEndless: "الوردية ∞+{m}", shopTitle: "متجر نهاية الوردية (الوردية {n})", shopNext: "الوردية التالية →", resumeShiftInfo: "آخر جولة: الوردية {n}", shopBillPaid: "فاتورة الوردية {v}", loShiftOne: "الوردية 1", shopHeader: "متجر نهاية الوردية", hireShiftRound: "الوردية {shift} · التوظيف {round}/{max}", settlementEyebrow: "الوردية {shift} · إيصال نهاية الدوام", settlementTitle: "ملخص الوردية", lbBestShift: "أفضل وردية", lbColumns: "الإيرادات / الوردية / النمط / التشكيلة القياسية", sumShifts: "الورديات المكتملة", sumBestShift: "أبعد وردية وصلت إليها" },
  th: { hudShift: "กะ {n}/{total}", hudShiftEndless: "กะ ∞+{m}", shopTitle: "ร้านค้าหลังเลิกกะ (กะ {n})", shopNext: "กะถัดไป →", resumeShiftInfo: "เกมล่าสุด: กะ {n}", shopBillPaid: "บิลกะ {v}", loShiftOne: "กะ 1", shopHeader: "ร้านค้าหลังเลิกกะ", hireShiftRound: "กะ {shift} · รับสมัคร {round}/{max}", settlementEyebrow: "กะ {shift} · ใบสรุปหลังเลิกงาน", settlementTitle: "สรุปกะ", lbBestShift: "กะที่ดีที่สุด", lbColumns: "รายได้ / กะ / โหมด / ทีมสถิติ", sumShifts: "จำนวนกะที่ผ่าน", sumBestShift: "กะที่ไปได้ไกลที่สุด" },
  vi: { hudShift: "Ca {n}/{total}", hudShiftEndless: "Ca ∞+{m}", shopTitle: "Cửa hàng cuối ca (ca {n})", shopNext: "Ca tiếp theo →", resumeShiftInfo: "Lần chơi trước: ca {n}", shopBillPaid: "Hóa đơn ca {v}", loShiftOne: "Ca 1", shopHeader: "CỬA HÀNG CUỐI CA", hireShiftRound: "Ca {shift} · Tuyển dụng {round}/{max}", settlementEyebrow: "CA {shift} · PHIẾU TAN CA", settlementTitle: "Tổng kết ca", lbBestShift: "CA TỐT NHẤT", lbColumns: "DOANH THU / CA / CHẾ ĐỘ / ĐỘI HÌNH KỶ LỤC", sumShifts: "Số ca đã vượt qua", sumBestShift: "Ca xa nhất" },
  id: { hudShift: "Sif {n}/{total}", hudShiftEndless: "Sif ∞+{m}", shopTitle: "Toko akhir sif (sif {n})", shopNext: "Sif berikutnya →", resumeShiftInfo: "Permainan terakhir: sif {n}", shopBillPaid: "Tagihan sif {v}", loShiftOne: "Sif 1", shopHeader: "TOKO AKHIR SIF", hireShiftRound: "Sif {shift} · Rekrutmen {round}/{max}", settlementEyebrow: "SIF {shift} · STRUK SELESAI KERJA", settlementTitle: "Ringkasan sif", lbBestShift: "SIF TERBAIK", lbColumns: "PENDAPATAN / SIF / MODE / FORMASI REKOR", sumShifts: "Sif yang diselesaikan", sumBestShift: "Sif terjauh" },
  nl: { hudShift: "Dienst {n}/{total}", hudShiftEndless: "Dienst ∞+{m}", shopTitle: "Winkel na dienst (dienst {n})", shopNext: "Volgende dienst →", resumeShiftInfo: "Vorige ronde: dienst {n}", shopBillPaid: "Dienstrekening {v}", loShiftOne: "Dienst 1", shopHeader: "WINKEL NA DIENST", hireShiftRound: "Dienst {shift} · Werving {round}/{max}", settlementEyebrow: "DIENST {shift} · UITKLOKBEWIJS", settlementTitle: "Dienstoverzicht", lbBestShift: "BESTE DIENST", lbColumns: "OMZET / DIENST / MODUS / RECORDTEAM", sumShifts: "Voltooide diensten", sumBestShift: "Hoogst bereikte dienst" },
} satisfies Partial<Record<Language, DeepPartial<FactoryRogueStrings>>>;

/** Reviewed meanings for terse factory terms that are highly polysemous. */
export const FACTORY_TERM_LABEL_LOCALES = {
  en: { loTitle: "Gulu Draft", hudBag: "Hiring Pool", hudBagEmpty: "Hiring pool empty", hirePool: "GULU POOL", hirePayNext: "PAY & NEXT DRAFT", resumeContinue: "Resume run", sumRuns: "Runs", sumPerformance: "Run performance", sumRetry: "Run it back", loWorkLegend: "★ WORK PERFORMANCE = score this Gulu produces on its own", loExploitLegend: "⛓ EXPLOITATION REACH = number of Gulus below it that can contribute" },
  "zh-Hans": { loTitle: "出战准备", hudBag: "雇佣池", hudBagEmpty: "雇佣池已空", hirePool: "咕噜池", hirePayNext: "付款并进入下一轮", resumeContinue: "继续这局", sumRuns: "开局次数", sumPerformance: "本局战绩", sumRetry: "再开一局", loWorkLegend: "★ 打工业绩 = 咕噜本身产生的业绩", loExploitLegend: "⛓ 压榨数 = 可向下压榨的咕噜数量" },
  "zh-Hant": { loTitle: "出戰準備", hudBag: "招聘池", hudBagEmpty: "招聘池已空", hirePool: "咕嚕招聘池", hirePayNext: "付款並進入下一輪招聘", resumeContinue: "繼續這局", sumRuns: "開局次數", sumPerformance: "本局戰績", sumRetry: "再開一局", loWorkLegend: "★ 打工業績 = 咕嚕本身產生的業績", loExploitLegend: "⛓ 壓榨數 = 可向下壓榨的咕嚕數量" },
  ja: { loTitle: "出勤準備", hudBag: "採用候補", hudBagEmpty: "採用候補なし", hirePool: "グル採用候補", hirePayNext: "支払って次の採用へ", resumeContinue: "続きから", sumRuns: "プレイ回数", sumPerformance: "今回の成績", sumRetry: "もう一度プレイ", loWorkLegend: "★ 作業実績 = このグル自身が出す実績", loExploitLegend: "⛓ 搾取範囲 = 下方向から参加できるグルの数" },
  ko: { loTitle: "근무 준비", hudBag: "채용 후보", hudBagEmpty: "채용 후보 없음", hirePool: "GULU 채용 후보", hirePayNext: "결제하고 다음 채용으로", resumeContinue: "이어서 하기", sumRuns: "플레이 횟수", sumPerformance: "이번 게임 성적", sumRetry: "한 판 더", loWorkLegend: "★ 작업 실적 = 이 Gulu가 직접 만든 실적", loExploitLegend: "⛓ 착취 범위 = 아래에서 참여할 수 있는 Gulu 수" },
  fr: { loTitle: "Sélection des Gulus", hudBag: "Réserve de recrutement", hudBagEmpty: "Aucun candidat", hirePool: "CANDIDATS GULU", hirePayNext: "PAYER & RECRUTER LA SUITE", resumeContinue: "Reprendre la partie", sumRuns: "Parties jouées", sumPerformance: "Résultat de la partie", sumRetry: "Rejouer", loWorkLegend: "★ Rendement individuel = score produit par ce Gulu seul", loExploitLegend: "⛓ Portée d’exploitation = Gulus du dessous pouvant contribuer" },
  de: { loTitle: "Gulu-Auswahl", hudBag: "Bewerberpool", hudBagEmpty: "Keine Bewerber", hirePool: "GULU-BEWERBER", hirePayNext: "ZAHLEN & WEITER AUSWÄHLEN", resumeContinue: "Spiel fortsetzen", sumRuns: "Gespielte Runden", sumPerformance: "Ergebnis dieser Runde", sumRetry: "Noch eine Runde", loWorkLegend: "★ Arbeitsleistung = Punkte dieses Gulus allein", loExploitLegend: "⛓ Ausbeutungsreichweite = beitragende Gulus darunter" },
  "es-ES": { loTitle: "Selección de Gulus", hudBag: "Reserva de contratación", hudBagEmpty: "No quedan candidatos", hirePool: "CANDIDATOS GULU", hirePayNext: "PAGAR Y SEGUIR CONTRATANDO", resumeContinue: "Continuar partida", sumRuns: "Partidas jugadas", sumPerformance: "Resultado de la partida", sumRetry: "Jugar otra", loWorkLegend: "★ Rendimiento laboral = puntos propios de este Gulu", loExploitLegend: "⛓ Alcance de explotación = Gulus inferiores que pueden aportar" },
  "es-419": { loTitle: "Selección de Gulus", hudBag: "Reserva de contratación", hudBagEmpty: "No quedan candidatos", hirePool: "CANDIDATOS GULU", hirePayNext: "PAGAR Y SEGUIR CONTRATANDO", resumeContinue: "Continuar partida", sumRuns: "Partidas jugadas", sumPerformance: "Resultado de la partida", sumRetry: "Jugar otra", loWorkLegend: "★ Rendimiento laboral = puntos propios de este Gulu", loExploitLegend: "⛓ Alcance de explotación = Gulus inferiores que pueden aportar" },
  "pt-BR": { loTitle: "Seleção de Gulus", hudBag: "Reserva de contratação", hudBagEmpty: "Sem candidatos", hirePool: "CANDIDATOS GULU", hirePayNext: "PAGAR E CONTINUAR CONTRATANDO", resumeContinue: "Continuar partida", sumRuns: "Partidas jogadas", sumPerformance: "Resultado da partida", sumRetry: "Jogar de novo", loWorkLegend: "★ Desempenho individual = pontos deste Gulu sozinho", loExploitLegend: "⛓ Alcance de exploração = Gulus abaixo que podem contribuir" },
  "pt-PT": { loTitle: "Seleção de Gulus", hudBag: "Reserva de recrutamento", hudBagEmpty: "Sem candidatos", hirePool: "CANDIDATOS GULU", hirePayNext: "PAGAR E CONTINUAR A RECRUTAR", resumeContinue: "Continuar partida", sumRuns: "Partidas jogadas", sumPerformance: "Resultado da partida", sumRetry: "Jogar de novo", loWorkLegend: "★ Desempenho individual = pontos deste Gulu sozinho", loExploitLegend: "⛓ Alcance de exploração = Gulus abaixo que podem contribuir" },
  ru: { loTitle: "Выбор Gulu", hudBag: "Кандидаты", hudBagEmpty: "Кандидатов нет", hirePool: "КАНДИДАТЫ GULU", hirePayNext: "ЗАПЛАТИТЬ И ПРОДОЛЖИТЬ НАЙМ", resumeContinue: "Продолжить игру", sumRuns: "Сыграно игр", sumPerformance: "Результат игры", sumRetry: "Сыграть ещё", loWorkLegend: "★ Личная эффективность = очки самого Gulu", loExploitLegend: "⛓ Радиус эксплуатации = число участвующих Gulu ниже" },
  it: { loTitle: "Selezione Gulu", hudBag: "Riserva assunzioni", hudBagEmpty: "Nessun candidato", hirePool: "CANDIDATI GULU", hirePayNext: "PAGA E CONTINUA LE ASSUNZIONI", resumeContinue: "Continua partita", sumRuns: "Partite giocate", sumPerformance: "Risultato della partita", sumRetry: "Gioca ancora", loWorkLegend: "★ Rendimento individuale = punti prodotti da questo Gulu", loExploitLegend: "⛓ Portata di sfruttamento = Gulu sottostanti che contribuiscono" },
  pl: { loTitle: "Wybór Gulu", hudBag: "Pula rekrutacji", hudBagEmpty: "Brak kandydatów", hirePool: "KANDYDACI GULU", hirePayNext: "ZAPŁAĆ I KONTYNUUJ REKRUTACJĘ", resumeContinue: "Kontynuuj grę", sumRuns: "Rozegrane gry", sumPerformance: "Wynik tej gry", sumRetry: "Zagraj ponownie", loWorkLegend: "★ Wydajność pracy = punkty tego Gulu", loExploitLegend: "⛓ Zasięg eksploatacji = Gulu poniżej, które mogą dołączyć" },
  tr: { loTitle: "Gulu Seçimi", hudBag: "Aday havuzu", hudBagEmpty: "Aday kalmadı", hirePool: "GULU ADAYLARI", hirePayNext: "ÖDE VE İŞE ALIMA DEVAM ET", resumeContinue: "Oyuna devam et", sumRuns: "Oynanan oyunlar", sumPerformance: "Bu oyunun sonucu", sumRetry: "Bir daha oyna", loWorkLegend: "★ İş performansı = bu Gulu'nun kendi puanı", loExploitLegend: "⛓ Sömürü menzili = aşağıdan katkı veren Gulu sayısı" },
  uk: { loTitle: "Вибір Gulu", hudBag: "Кандидати", hudBagEmpty: "Кандидатів немає", hirePool: "КАНДИДАТИ GULU", hirePayNext: "СПЛАТИТИ Й ПРОДОВЖИТИ НАЙМ", resumeContinue: "Продовжити гру", sumRuns: "Зіграно ігор", sumPerformance: "Результат гри", sumRetry: "Зіграти ще", loWorkLegend: "★ Особиста ефективність = очки самого Gulu", loExploitLegend: "⛓ Радіус експлуатації = кількість Gulu нижче, що долучаються" },
  ar: { loTitle: "اختيار Gulu", hudBag: "قائمة المرشحين", hudBagEmpty: "لا يوجد مرشحون", hirePool: "مرشحو GULU", hirePayNext: "ادفع وتابع التوظيف", resumeContinue: "متابعة الجولة", sumRuns: "الجولات الملعوبة", sumPerformance: "نتيجة الجولة", sumRetry: "العب جولة أخرى", loWorkLegend: "★ أداء العمل = نقاط ينتجها هذا الـGulu وحده", loExploitLegend: "⛓ مدى الاستغلال = عدد وحدات Gulu المساهمة تحته" },
  th: { loTitle: "เลือก Gulu", hudBag: "รายชื่อผู้สมัคร", hudBagEmpty: "ไม่มีผู้สมัคร", hirePool: "ผู้สมัคร GULU", hirePayNext: "จ่ายแล้วรับสมัครต่อ", resumeContinue: "เล่นต่อ", sumRuns: "จำนวนเกมที่เล่น", sumPerformance: "ผลงานเกมนี้", sumRetry: "เล่นอีกเกม", loWorkLegend: "★ ผลงานส่วนตัว = แต้มที่ Gulu ตัวนี้ทำเอง", loExploitLegend: "⛓ ระยะรีดเค้น = จำนวน Gulu ด้านล่างที่ร่วมทำแต้ม" },
  vi: { loTitle: "Chọn Gulu", hudBag: "Nhóm tuyển dụng", hudBagEmpty: "Hết ứng viên", hirePool: "ỨNG VIÊN GULU", hirePayNext: "TRẢ TIỀN VÀ TUYỂN TIẾP", resumeContinue: "Chơi tiếp", sumRuns: "Số ván đã chơi", sumPerformance: "Thành tích ván này", sumRetry: "Chơi ván nữa", loWorkLegend: "★ Hiệu suất làm việc = điểm riêng của Gulu này", loExploitLegend: "⛓ Tầm khai thác = số Gulu bên dưới có thể góp điểm" },
  id: { loTitle: "Seleksi Gulu", hudBag: "Kandidat rekrutmen", hudBagEmpty: "Kandidat habis", hirePool: "KANDIDAT GULU", hirePayNext: "BAYAR DAN LANJUT REKRUTMEN", resumeContinue: "Lanjutkan permainan", sumRuns: "Permainan dimainkan", sumPerformance: "Hasil permainan ini", sumRetry: "Main lagi", loWorkLegend: "★ Kinerja kerja = poin milik Gulu ini sendiri", loExploitLegend: "⛓ Jangkauan eksploitasi = jumlah Gulu bawah yang ikut menyumbang" },
  nl: { loTitle: "Gulu-selectie", hudBag: "Kandidatenpool", hudBagEmpty: "Geen kandidaten", hirePool: "GULU-KANDIDATEN", hirePayNext: "BETALEN & VERDER WERVEN", resumeContinue: "Spel hervatten", sumRuns: "Gespeelde rondes", sumPerformance: "Resultaat van deze ronde", sumRetry: "Nog een ronde", loWorkLegend: "★ Werkprestatie = punten van deze Gulu zelf", loExploitLegend: "⛓ Exploitatiebereik = aantal meewerkende Gulus eronder" },
} satisfies Partial<Record<Language, DeepPartial<FactoryRogueStrings>>>;

/** Reviewed resume copy: "shift" is a work shift and "start fresh" means a new game. */
export const FACTORY_RESUME_LOCALES = {
  en: { resumeTitle: "You left a shift unfinished", resumeBody: "Resume that shift with your cash, cards, progress, Gulus, and desk stacks intact.", resumeNew: "New game" },
  "zh-Hans": { resumeTitle: "上一局还没下班", resumeBody: "继续后会回到原班次；现金、卡牌、进度、咕噜和工位上的堆叠都会保留。", resumeNew: "重开一局" },
  "zh-Hant": { resumeTitle: "上一局還沒下班", resumeBody: "繼續後會回到原班次；現金、卡牌、進度、咕嚕和工位上的堆疊都會保留。", resumeNew: "重開一局" },
  ja: { resumeTitle: "未完了のシフトがあります", resumeBody: "続きから再開すると、所持金、カード、進行状況、グル、デスク上の配置がすべて復元されます。", resumeNew: "最初からやり直す" },
  ko: { resumeTitle: "끝내지 못한 근무가 있어요", resumeBody: "이어서 하면 현금, 카드, 진행도, Gulus와 작업대 더미가 그대로 복원됩니다.", resumeNew: "새로 시작" },
  fr: { resumeTitle: "Un service est resté en plan", resumeBody: "Reprendre restaure ce service avec l’argent, les cartes, la progression, les Gulus et les piles sur les postes.", resumeNew: "Nouvelle partie" },
  de: { resumeTitle: "Eine Schicht ist noch offen", resumeBody: "Beim Fortsetzen kehrst du mit Geld, Karten, Fortschritt, Gulus und allen Stapeln an den Arbeitsplätzen in diese Schicht zurück.", resumeNew: "Neu starten" },
  "es-ES": { resumeTitle: "Dejaste un turno a medias", resumeBody: "Al continuar volverás a ese turno con el dinero, las cartas, el progreso, los Gulus y las pilas de los puestos intactos.", resumeNew: "Nueva partida" },
  "es-419": { resumeTitle: "Dejaste un turno a medias", resumeBody: "Al continuar volverás a ese turno con el dinero, las cartas, el progreso, los Gulus y las pilas de los puestos intactos.", resumeNew: "Nueva partida" },
  "pt-BR": { resumeTitle: "Você deixou um turno pela metade", resumeBody: "Ao continuar, você volta ao turno com dinheiro, cartas, progresso, Gulus e pilhas das mesas intactos.", resumeNew: "Nova partida" },
  "pt-PT": { resumeTitle: "Deixaste um turno a meio", resumeBody: "Ao continuar, voltas ao turno com dinheiro, cartas, progresso, Gulus e pilhas das mesas intactos.", resumeNew: "Nova partida" },
  ru: { resumeTitle: "Смена осталась незавершённой", resumeBody: "Продолжение вернёт вас в эту смену: деньги, карты, прогресс, Gulus и стопки на рабочих местах сохранятся.", resumeNew: "Новая игра" },
  it: { resumeTitle: "Hai lasciato un turno a metà", resumeBody: "Continuando tornerai a quel turno con denaro, carte, progressi, Gulus e pile sulle postazioni intatti.", resumeNew: "Nuova partita" },
  pl: { resumeTitle: "Zmiana została niedokończona", resumeBody: "Kontynuacja przywróci tę zmianę wraz z gotówką, kartami, postępem, Gulus i stosami na stanowiskach.", resumeNew: "Nowa gra" },
  tr: { resumeTitle: "Yarım kalan bir vardiyan var", resumeBody: "Devam edersen para, kartlar, ilerleme, Gulus ve masalardaki yığınlarla o vardiyaya dönersin.", resumeNew: "Yeni oyun" },
  uk: { resumeTitle: "Зміна залишилася незавершеною", resumeBody: "Продовження поверне вас до цієї зміни: гроші, карти, прогрес, Gulus і стоси на робочих місцях збережуться.", resumeNew: "Нова гра" },
  ar: { resumeTitle: "لديك وردية غير مكتملة", resumeBody: "عند المتابعة ستعود إلى تلك الوردية مع بقاء المال والبطاقات والتقدم وGulus والأكوام على محطات العمل كما هي.", resumeNew: "جولة جديدة" },
  th: { resumeTitle: "มีกะที่ยังไม่จบ", resumeBody: "เล่นต่อเพื่อกลับเข้ากะเดิม โดยเงิน การ์ด ความคืบหน้า Gulus และกองบนโต๊ะยังอยู่ครบ", resumeNew: "เริ่มเกมใหม่" },
  vi: { resumeTitle: "Bạn còn một ca chưa xong", resumeBody: "Chơi tiếp sẽ đưa bạn về ca đó với tiền, thẻ, tiến độ, Gulus và các chồng trên bàn được giữ nguyên.", resumeNew: "Ván mới" },
  id: { resumeTitle: "Ada sif yang belum selesai", resumeBody: "Lanjutkan untuk kembali ke sif itu dengan uang, kartu, progres, Gulus, dan tumpukan meja tetap utuh.", resumeNew: "Permainan baru" },
  nl: { resumeTitle: "Er staat nog een dienst open", resumeBody: "Bij hervatten keer je terug naar die dienst met geld, kaarten, voortgang, Gulus en stapels op de werkplekken intact.", resumeNew: "Nieuw spel" },
} satisfies Partial<Record<Language, DeepPartial<FactoryRogueStrings>>>;

/**
 * Human-reviewed copy for the run summary.  These labels are intentionally
 * kept together: isolated words such as "run", "haul", "hire", and "miss"
 * were repeatedly mistranslated without the end-of-game screen context.
 */
export const FACTORY_SUMMARY_LOCALES = {
  "zh-Hant": { sumRewards: "本局獎勵", sumRewardsHint: "升階物品 · 已送往訓練館", sumRewardsTotal: "共 {count} 件物品", sumRewardsEmpty: "本局沒有獲得新的升階物品", sumRewardsEmptyHint: "今天這些班次的獎勵已領取 · 挑戰更後面的班次可獲得更多", sumCoinsEarned: "本局獲得的金幣", sumThisRunItems: "本局獲得的物品", sumTodayItems: "今天獲得的物品", sumTodayEmpty: "今天尚未獲得工廠物品", sumUpgradeHint: "物品會存放在訓練館，可用來提升咕嚕的階級", sumTapForTip: "點擊查看說明", sumItemUpgradeTip: "這是咕嚕升階物品。可在訓練館使用，提升咕嚕的階級。", sumMaxPulse: "最高團隊業績", sumMaxCombo: "最長連擊", sumMaxDesks: "最多連結工位", sumThrows: "投放次數", sumBounces: "未命中次數", sumBestRevenue: "最高營收", sumPerformance: "本局表現", sumContinueEndless: "繼續挑戰（無限模式）→" },
  ja: { sumRewards: "今回の報酬", sumRewardsHint: "ランクアップ素材 · トレーニングホールへ送付済み", sumRewardsTotal: "アイテム合計 {count} 個", sumRewardsEmpty: "今回は新しいランクアップ素材を獲得できませんでした", sumRewardsEmptyHint: "本日分の報酬は受取済みです · さらに先のシフトへ進みましょう", sumCoinsEarned: "今回獲得したコイン", sumThisRunItems: "今回獲得したアイテム", sumTodayItems: "本日獲得したアイテム", sumTodayEmpty: "本日は工場アイテムをまだ獲得していません", sumUpgradeHint: "アイテムはトレーニングホールに保管され、グルのランクアップに使えます", sumTapForTip: "タップして説明を見る", sumItemUpgradeTip: "グルのランクアップ素材です。トレーニングホールで使うとグルのランクを上げられます。", sumMaxPulse: "最高チーム実績", sumMaxCombo: "最長コンボ", sumMaxDesks: "最多連結デスク", sumThrows: "投入回数", sumBounces: "ミス回数", sumBestRevenue: "最高売上", sumContinueEndless: "続ける（エンドレス）→" },
  ko: { sumRewards: "이번 게임 보상", sumRewardsHint: "랭크 상승 아이템 · 훈련관으로 지급됨", sumRewardsTotal: "아이템 총 {count}개", sumRewardsEmpty: "이번 게임에서는 새 랭크 상승 아이템을 얻지 못했습니다", sumRewardsEmptyHint: "오늘 이 근무 구간의 보상은 이미 받았습니다 · 더 높은 근무에 도전하세요", sumCoinsEarned: "이번 게임에서 획득한 코인", sumThisRunItems: "이번 게임에서 획득한 아이템", sumTodayItems: "오늘 획득한 아이템", sumTodayEmpty: "오늘 획득한 공장 아이템이 없습니다", sumUpgradeHint: "아이템은 훈련관에 보관되며 굴루의 랭크를 올리는 데 사용할 수 있습니다", sumTapForTip: "눌러서 설명 보기", sumItemUpgradeTip: "굴루 랭크 상승 아이템입니다. 훈련관에서 사용해 굴루의 랭크를 올릴 수 있습니다.", sumMaxPulse: "최고 팀 실적", sumMaxCombo: "최장 콤보", sumMaxDesks: "최다 연결 책상", sumThrows: "배치 횟수", sumBounces: "빗나간 횟수", sumBestRevenue: "최고 매출", sumContinueEndless: "계속하기(무한 모드) →" },
  fr: { sumRewards: "BUTIN DE LA PARTIE", sumRewardsHint: "Objets de rang · envoyés à la salle d’entraînement", sumRewardsTotal: "{count} objets au total", sumRewardsEmpty: "Aucun nouvel objet de rang obtenu dans cette partie", sumRewardsEmptyHint: "Les récompenses de ces services ont déjà été récupérées aujourd’hui · allez plus loin pour en obtenir davantage", sumCoinsEarned: "Pièces gagnées pendant cette partie", sumThisRunItems: "Objets gagnés pendant cette partie", sumTodayItems: "Objets gagnés aujourd’hui", sumTodayEmpty: "Aucun objet d’usine gagné aujourd’hui", sumUpgradeHint: "Les objets sont conservés dans la salle d’entraînement et servent à améliorer le rang de vos Gulus", sumTapForTip: "Touchez pour afficher l’aide", sumItemUpgradeTip: "Cet objet améliore le rang d’un Gulu. Utilisez-le dans la salle d’entraînement.", sumMaxPulse: "Meilleur rendement d’équipe", sumMaxCombo: "Combo le plus long", sumMaxDesks: "Maximum de bureaux reliés", sumThrows: "Lancers", sumBounces: "Lancers manqués", sumBestRevenue: "Meilleur chiffre d’affaires", sumContinueEndless: "Continuer (mode sans fin) →" },
  de: { sumRewards: "BELOHNUNGEN DIESER RUNDE", sumRewardsHint: "Rangaufstiegsitems · in die Trainingshalle geliefert", sumRewardsTotal: "Insgesamt {count} Items", sumRewardsEmpty: "In dieser Runde wurden keine neuen Rangaufstiegsitems verdient", sumRewardsEmptyHint: "Die heutigen Belohnungen für diese Schichten wurden bereits abgeholt · dringe weiter vor, um mehr zu erhalten", sumCoinsEarned: "In dieser Runde verdiente Münzen", sumThisRunItems: "In dieser Runde verdiente Items", sumTodayItems: "Heute verdiente Items", sumTodayEmpty: "Heute wurden keine Fabrikitems verdient", sumUpgradeHint: "Items werden in der Trainingshalle aufbewahrt und erhöhen den Rang deiner Gulus", sumTapForTip: "Antippen für Details", sumItemUpgradeTip: "Dieses Item erhöht den Rang eines Gulus. Verwende es in der Trainingshalle.", sumMaxPulse: "Beste Teamleistung", sumMaxCombo: "Längste Kombo", sumMaxDesks: "Meiste verbundene Schreibtische", sumThrows: "Einsätze", sumBounces: "Fehlwürfe", sumBestRevenue: "Höchster Umsatz", sumContinueEndless: "Weiterspielen (Endlos) →" },
  "es-ES": { sumRewards: "RECOMPENSAS DE LA PARTIDA", sumRewardsHint: "Objetos de ascenso · enviados a la sala de entrenamiento", sumRewardsTotal: "{count} objetos en total", sumRewardsEmpty: "No has conseguido nuevos objetos de ascenso en esta partida", sumRewardsEmptyHint: "Ya has recogido hoy las recompensas de estos turnos · avanza más para conseguir otras", sumCoinsEarned: "Monedas conseguidas en esta partida", sumThisRunItems: "Objetos conseguidos en esta partida", sumTodayItems: "Objetos conseguidos hoy", sumTodayEmpty: "Hoy no has conseguido objetos de fábrica", sumUpgradeHint: "Los objetos se guardan en la sala de entrenamiento y sirven para subir el rango de tus Gulus", sumTapForTip: "Pulsa para ver información", sumItemUpgradeTip: "Este objeto sube el rango de un Gulu. Úsalo en la sala de entrenamiento.", sumMaxPulse: "Mejor rendimiento del equipo", sumMaxCombo: "Combo más largo", sumMaxDesks: "Máximo de puestos conectados", sumThrows: "Lanzamientos", sumBounces: "Fallos", sumBestRevenue: "Mejores ingresos", sumContinueEndless: "Continuar (infinito) →" },
  "es-419": { sumRewards: "RECOMPENSAS DE LA PARTIDA", sumRewardsHint: "Objetos de ascenso · enviados a la sala de entrenamiento", sumRewardsTotal: "{count} objetos en total", sumRewardsEmpty: "No obtuviste nuevos objetos de ascenso en esta partida", sumRewardsEmptyHint: "Ya recogiste hoy las recompensas de estos turnos · avanza más para obtener otras", sumCoinsEarned: "Monedas obtenidas en esta partida", sumThisRunItems: "Objetos obtenidos en esta partida", sumTodayItems: "Objetos obtenidos hoy", sumTodayEmpty: "Hoy no obtuviste objetos de fábrica", sumUpgradeHint: "Los objetos se guardan en la sala de entrenamiento y sirven para subir el rango de tus Gulus", sumTapForTip: "Toca para ver información", sumItemUpgradeTip: "Este objeto sube el rango de un Gulu. Úsalo en la sala de entrenamiento.", sumMaxPulse: "Mejor rendimiento del equipo", sumMaxCombo: "Combo más largo", sumMaxDesks: "Máximo de puestos conectados", sumThrows: "Lanzamientos", sumBounces: "Fallos", sumBestRevenue: "Mejores ingresos", sumContinueEndless: "Continuar (infinito) →" },
  "pt-BR": { sumRewards: "RECOMPENSAS DA PARTIDA", sumRewardsHint: "Itens de promoção · enviados ao Centro de Treinamento", sumRewardsTotal: "{count} itens no total", sumRewardsEmpty: "Nenhum item novo de promoção foi obtido nesta partida", sumRewardsEmptyHint: "As recompensas destes turnos já foram coletadas hoje · avance mais para obter outras", sumCoinsEarned: "Moedas obtidas nesta partida", sumThisRunItems: "Itens obtidos nesta partida", sumTodayItems: "Itens obtidos hoje", sumTodayEmpty: "Nenhum item de Fábrica foi obtido hoje", sumUpgradeHint: "Os itens ficam no Centro de Treinamento e servem para aumentar o nível dos seus Gulus", sumTapForTip: "Toque para ver detalhes", sumItemUpgradeTip: "Este item aumenta o nível de um Gulu. Use-o no Centro de Treinamento.", sumMaxPulse: "Melhor desempenho da equipe", sumMaxCombo: "Combo mais longo", sumMaxDesks: "Máximo de mesas conectadas", sumThrows: "Lançamentos", sumBounces: "Erros", sumBestRevenue: "Maior receita", sumContinueEndless: "Continuar (Infinito) →" },
  "pt-PT": { sumRewards: "RECOMPENSAS DA PARTIDA", sumRewardsHint: "Itens de promoção · enviados para o Centro de Treino", sumRewardsTotal: "{count} itens no total", sumRewardsEmpty: "Não obtiveste novos itens de promoção nesta partida", sumRewardsEmptyHint: "As recompensas destes turnos já foram recolhidas hoje · avança mais para obter outras", sumCoinsEarned: "Moedas obtidas nesta partida", sumThisRunItems: "Itens obtidos nesta partida", sumTodayItems: "Itens obtidos hoje", sumTodayEmpty: "Hoje não obtiveste itens da Fábrica", sumUpgradeHint: "Os itens ficam no Centro de Treino e servem para aumentar o nível dos teus Gulus", sumTapForTip: "Toca para ver detalhes", sumItemUpgradeTip: "Este item aumenta o nível de um Gulu. Usa-o no Centro de Treino.", sumMaxPulse: "Melhor desempenho da equipa", sumMaxCombo: "Combo mais longo", sumMaxDesks: "Máximo de mesas ligadas", sumThrows: "Lançamentos", sumBounces: "Falhas", sumBestRevenue: "Maior receita", sumContinueEndless: "Continuar (Infinito) →" },
  it: { sumRewards: "RICOMPENSE DELLA PARTITA", sumRewardsHint: "Oggetti promozione · inviati alla Sala addestramento", sumRewardsTotal: "{count} oggetti in totale", sumRewardsEmpty: "Nessun nuovo oggetto promozione ottenuto in questa partita", sumRewardsEmptyHint: "Le ricompense odierne per questi turni sono già state ritirate · avanza ancora per ottenerne altre", sumCoinsEarned: "Monete ottenute in questa partita", sumThisRunItems: "Oggetti ottenuti in questa partita", sumTodayItems: "Oggetti ottenuti oggi", sumTodayEmpty: "Nessun oggetto Fabbrica ottenuto oggi", sumUpgradeHint: "Gli oggetti sono conservati nella Sala addestramento e aumentano il rango dei tuoi Gulu", sumTapForTip: "Tocca per i dettagli", sumItemUpgradeTip: "Questo oggetto aumenta il rango di un Gulu. Usalo nella Sala addestramento.", sumMaxPulse: "Miglior rendimento della squadra", sumMaxCombo: "Combo più lunga", sumMaxDesks: "Massimo di postazioni collegate", sumThrows: "Lanci", sumBounces: "Errori", sumBestRevenue: "Ricavi migliori", sumContinueEndless: "Continua (Infinita) →" },
  id: { sumRewards: "HADIAH PERMAINAN INI", sumRewardsHint: "Item naik peringkat · dikirim ke Aula Pelatihan", sumRewardsTotal: "Total {count} item", sumRewardsEmpty: "Tidak ada item naik peringkat baru dalam permainan ini", sumRewardsEmptyHint: "Hadiah untuk sif ini sudah diambil hari ini · maju lebih jauh untuk mendapat lebih banyak", sumCoinsEarned: "Koin yang diperoleh dalam permainan ini", sumThisRunItems: "Item yang diperoleh dalam permainan ini", sumTodayItems: "Item yang diperoleh hari ini", sumTodayEmpty: "Belum ada item Pabrik yang diperoleh hari ini", sumUpgradeHint: "Item disimpan di Aula Pelatihan dan dapat digunakan untuk menaikkan peringkat Gulu", sumTapForTip: "Ketuk untuk melihat info", sumItemUpgradeTip: "Ini adalah item naik peringkat Gulu. Gunakan di Aula Pelatihan untuk menaikkan peringkat Gulu.", sumMaxPulse: "Kinerja tim terbaik", sumMaxCombo: "Kombo terpanjang", sumMaxDesks: "Meja terhubung terbanyak", sumThrows: "Lemparan", sumBounces: "Meleset", sumBestRevenue: "Pendapatan terbaik", sumContinueEndless: "Lanjutkan (Tanpa Akhir) →" },
  nl: { sumRewards: "BELONINGEN VAN DEZE RONDE", sumRewardsHint: "Rangitems · naar de trainingshal gebracht", sumRewardsTotal: "In totaal {count} items", sumRewardsEmpty: "In deze ronde zijn geen nieuwe rangitems verdiend", sumRewardsEmptyHint: "De beloningen voor deze diensten zijn vandaag al opgehaald · kom verder voor meer", sumCoinsEarned: "Munten verdiend in deze ronde", sumThisRunItems: "Items verdiend in deze ronde", sumTodayItems: "Items vandaag verdiend", sumTodayEmpty: "Vandaag geen fabrieksitems verdiend", sumUpgradeHint: "Items worden in de trainingshal bewaard en verhogen de rang van je Gulus", sumTapForTip: "Tik voor uitleg", sumItemUpgradeTip: "Dit item verhoogt de rang van een Gulu. Gebruik het in de trainingshal.", sumMaxPulse: "Beste teamprestatie", sumMaxCombo: "Langste combo", sumMaxDesks: "Meeste gekoppelde bureaus", sumThrows: "Worpen", sumBounces: "Missers", sumBestRevenue: "Hoogste omzet", sumContinueEndless: "Doorgaan (Eindeloos) →" },
  ru: { sumRewards: "НАГРАДЫ ЗА ЗАБЕГ", sumRewardsHint: "Предметы повышения ранга · доставлены в тренировочный зал", sumRewardsTotal: "Всего предметов: {count}", sumRewardsEmpty: "В этом забеге нет новых предметов повышения ранга", sumRewardsEmptyHint: "Сегодня награды за эти смены уже получены · пройдите дальше, чтобы получить больше", sumCoinsEarned: "Монеты за этот забег", sumThisRunItems: "Предметы за этот забег", sumTodayItems: "Предметы за сегодня", sumTodayEmpty: "Сегодня предметы Фабрики ещё не получены", sumUpgradeHint: "Предметы хранятся в тренировочном зале и повышают ранг ваших Gulu", sumTapForTip: "Нажмите, чтобы узнать подробнее", sumItemUpgradeTip: "Этот предмет повышает ранг Gulu. Используйте его в тренировочном зале.", sumMaxPulse: "Лучшая эффективность команды", sumMaxCombo: "Самое длинное комбо", sumMaxDesks: "Максимум связанных столов", sumThrows: "Броски", sumBounces: "Промахи", sumBestRevenue: "Лучшая выручка", sumContinueEndless: "Продолжить (Бесконечный режим) →" },
  pl: { sumRewards: "NAGRODY Z TEJ ROZGRYWKI", sumRewardsHint: "Przedmioty awansu · dostarczone do sali treningowej", sumRewardsTotal: "Łącznie przedmiotów: {count}", sumRewardsEmpty: "W tej rozgrywce nie zdobyto nowych przedmiotów awansu", sumRewardsEmptyHint: "Dzisiejsze nagrody za te zmiany zostały już odebrane · dotrzyj dalej, aby zdobyć więcej", sumCoinsEarned: "Monety zdobyte w tej rozgrywce", sumThisRunItems: "Przedmioty zdobyte w tej rozgrywce", sumTodayItems: "Przedmioty zdobyte dzisiaj", sumTodayEmpty: "Nie zdobyto dziś przedmiotów z Fabryki", sumUpgradeHint: "Przedmioty są przechowywane w sali treningowej i służą do podnoszenia rangi Gulu", sumTapForTip: "Dotknij, aby zobaczyć opis", sumItemUpgradeTip: "Ten przedmiot podnosi rangę Gulu. Użyj go w sali treningowej.", sumMaxPulse: "Najlepsza wydajność zespołu", sumMaxCombo: "Najdłuższe kombo", sumMaxDesks: "Najwięcej połączonych biurek", sumThrows: "Rzuty", sumBounces: "Pudła", sumBestRevenue: "Najwyższy przychód", sumContinueEndless: "Kontynuuj (tryb nieskończony) →" },
  tr: { sumRewards: "BU OYUNUN ÖDÜLLERİ", sumRewardsHint: "Rütbe yükseltme eşyaları · Eğitim Salonuna gönderildi", sumRewardsTotal: "Toplam {count} eşya", sumRewardsEmpty: "Bu oyunda yeni rütbe yükseltme eşyası kazanılmadı", sumRewardsEmptyHint: "Bu vardiyaların bugünkü ödülleri alındı · daha fazlası için ilerle", sumCoinsEarned: "Bu oyunda kazanılan paralar", sumThisRunItems: "Bu oyunda kazanılan eşyalar", sumTodayItems: "Bugün kazanılan eşyalar", sumTodayEmpty: "Bugün Fabrika eşyası kazanılmadı", sumUpgradeHint: "Eşyalar Eğitim Salonunda saklanır ve Gulu'ların rütbesini yükseltmekte kullanılır", sumTapForTip: "Bilgi için dokun", sumItemUpgradeTip: "Bu bir Gulu rütbe yükseltme eşyasıdır. Eğitim Salonunda kullanabilirsin.", sumMaxPulse: "En iyi takım performansı", sumMaxCombo: "En uzun kombo", sumMaxDesks: "En fazla bağlı masa", sumThrows: "Atışlar", sumBounces: "Iskalar", sumBestRevenue: "En yüksek gelir", sumContinueEndless: "Devam et (Sonsuz) →" },
  uk: { sumRewards: "НАГОРОДИ ЗА ЦЮ ГРУ", sumRewardsHint: "Предмети підвищення рангу · доставлено до тренувальної зали", sumRewardsTotal: "Усього предметів: {count}", sumRewardsEmpty: "У цій грі не здобуто нових предметів підвищення рангу", sumRewardsEmptyHint: "Сьогодні нагороди за ці зміни вже отримано · пройдіть далі, щоб здобути більше", sumCoinsEarned: "Монети за цю гру", sumThisRunItems: "Предмети за цю гру", sumTodayItems: "Предмети за сьогодні", sumTodayEmpty: "Сьогодні предметів Фабрики ще не здобуто", sumUpgradeHint: "Предмети зберігаються в тренувальній залі та підвищують ранг ваших Gulu", sumTapForTip: "Натисніть, щоб переглянути опис", sumItemUpgradeTip: "Цей предмет підвищує ранг Gulu. Використайте його в тренувальній залі.", sumMaxPulse: "Найкраща ефективність команди", sumMaxCombo: "Найдовше комбо", sumMaxDesks: "Найбільше з’єднаних столів", sumThrows: "Кидки", sumBounces: "Промахи", sumBestRevenue: "Найкращий дохід", sumContinueEndless: "Продовжити (Нескінченний режим) →" },
  ar: { sumRewards: "مكافآت هذه الجولة", sumRewardsHint: "عناصر رفع الرتبة · أُرسلت إلى قاعة التدريب", sumRewardsTotal: "إجمالي العناصر: {count}", sumRewardsEmpty: "لم تحصل على عناصر جديدة لرفع الرتبة في هذه الجولة", sumRewardsEmptyHint: "حصلت اليوم على مكافآت هذه الورديات · تقدّم أكثر لتحصل على المزيد", sumCoinsEarned: "العملات المكتسبة في هذه الجولة", sumThisRunItems: "العناصر المكتسبة في هذه الجولة", sumTodayItems: "العناصر المكتسبة اليوم", sumTodayEmpty: "لم تحصل على عناصر من المصنع اليوم", sumUpgradeHint: "تُحفظ العناصر في قاعة التدريب وتُستخدم لرفع رتبة مخلوقات Gulu", sumTapForTip: "اضغط لعرض التفاصيل", sumItemUpgradeTip: "هذا عنصر لرفع رتبة Gulu. استخدمه في قاعة التدريب.", sumMaxPulse: "أفضل أداء للفريق", sumMaxCombo: "أطول مجموعة متتالية", sumMaxDesks: "أكبر عدد من المكاتب المتصلة", sumThrows: "مرات الإلقاء", sumBounces: "مرات الإخفاق", sumBestRevenue: "أفضل إيراد", sumContinueEndless: "متابعة اللعب (اللانهائي) ←" },
  th: { sumRewards: "รางวัลจากเกมนี้", sumRewardsHint: "ไอเทมเลื่อนระดับ · ส่งไปยังห้องฝึกแล้ว", sumRewardsTotal: "ไอเทมทั้งหมด {count} ชิ้น", sumRewardsEmpty: "เกมนี้ไม่ได้รับไอเทมเลื่อนระดับชิ้นใหม่", sumRewardsEmptyHint: "รับรางวัลของกะเหล่านี้สำหรับวันนี้แล้ว · ไปให้ไกลขึ้นเพื่อรับเพิ่ม", sumCoinsEarned: "เหรียญที่ได้รับในเกมนี้", sumThisRunItems: "ไอเทมที่ได้รับในเกมนี้", sumTodayItems: "ไอเทมที่ได้รับวันนี้", sumTodayEmpty: "วันนี้ยังไม่ได้รับไอเทมจากโรงงาน", sumUpgradeHint: "ไอเทมจะเก็บไว้ในห้องฝึกและใช้เลื่อนระดับ Gulu ได้", sumTapForTip: "แตะเพื่อดูรายละเอียด", sumItemUpgradeTip: "นี่คือไอเทมเลื่อนระดับ Gulu ใช้ได้ที่ห้องฝึก", sumMaxPulse: "ผลงานทีมสูงสุด", sumMaxCombo: "คอมโบยาวที่สุด", sumMaxDesks: "โต๊ะที่เชื่อมกันมากที่สุด", sumThrows: "จำนวนครั้งที่โยน", sumBounces: "จำนวนครั้งที่พลาด", sumBestRevenue: "รายได้สูงสุด", sumContinueEndless: "เล่นต่อ (โหมดไม่สิ้นสุด) →" },
  vi: { sumRewards: "PHẦN THƯỞNG VÁN NÀY", sumRewardsHint: "Vật phẩm tăng hạng · đã chuyển đến Phòng Huấn luyện", sumRewardsTotal: "Tổng cộng {count} vật phẩm", sumRewardsEmpty: "Không nhận được vật phẩm tăng hạng mới trong ván này", sumRewardsEmptyHint: "Phần thưởng hôm nay của các ca này đã được nhận · hãy tiến xa hơn để nhận thêm", sumCoinsEarned: "Xu nhận được trong ván này", sumThisRunItems: "Vật phẩm nhận được trong ván này", sumTodayItems: "Vật phẩm nhận được hôm nay", sumTodayEmpty: "Hôm nay chưa nhận được vật phẩm Nhà máy", sumUpgradeHint: "Vật phẩm được cất trong Phòng Huấn luyện và dùng để tăng hạng cho Gulu", sumTapForTip: "Chạm để xem thông tin", sumItemUpgradeTip: "Đây là vật phẩm tăng hạng Gulu. Hãy dùng tại Phòng Huấn luyện.", sumMaxPulse: "Hiệu suất đội cao nhất", sumMaxCombo: "Combo dài nhất", sumMaxDesks: "Nhiều bàn liên kết nhất", sumThrows: "Số lần thả", sumBounces: "Số lần trượt", sumBestRevenue: "Doanh thu cao nhất", sumContinueEndless: "Tiếp tục (Vô tận) →" },
} satisfies Partial<Record<Language, DeepPartial<FactoryRogueStrings>>>;

export const FACTORY_SETTLEMENT_SCORE_LOCALES = {
  "zh-Hant": { settlementDetails: "團隊績效明細", settlementTeam: "團隊績效", settlementBase: "工作績效", settlementAbsorbed: "壓榨績效", settlementExtra: "額外績效", settlementPools: "元素 · 協同 · 工種 · 節奏" },
  ja: { settlementDetails: "チーム実績の内訳", settlementTeam: "チーム実績", settlementBase: "作業実績", settlementAbsorbed: "搾取実績", settlementExtra: "ボーナス実績", settlementPools: "属性 · シナジー · 職種 · リズム" },
  ko: { settlementDetails: "팀 성과 내역", settlementTeam: "팀 성과", settlementBase: "작업 성과", settlementAbsorbed: "착취 성과", settlementExtra: "보너스 성과", settlementPools: "속성 · 시너지 · 직무 · 리듬" },
  fr: { settlementDetails: "Détail de la performance d’équipe", settlementTeam: "Performance d’équipe", settlementBase: "Performance de travail", settlementAbsorbed: "Performance d’exploitation", settlementExtra: "Performance bonus", settlementPools: "Élément · Synergie · Métier · Rythme" },
  de: { settlementDetails: "Aufschlüsselung der Teamleistung", settlementTeam: "Teamleistung", settlementBase: "Arbeitsleistung", settlementAbsorbed: "Ausbeutungsleistung", settlementExtra: "Bonusleistung", settlementPools: "Element · Synergie · Beruf · Rhythmus" },
  "es-ES": { settlementDetails: "Desglose del rendimiento del equipo", settlementTeam: "Rendimiento del equipo", settlementBase: "Rendimiento laboral", settlementAbsorbed: "Rendimiento de explotación", settlementExtra: "Rendimiento adicional", settlementPools: "Elemento · Sinergia · Profesión · Ritmo" },
  "es-419": { settlementDetails: "Desglose del rendimiento del equipo", settlementTeam: "Rendimiento del equipo", settlementBase: "Rendimiento laboral", settlementAbsorbed: "Rendimiento de explotación", settlementExtra: "Rendimiento adicional", settlementPools: "Elemento · Sinergia · Profesión · Ritmo" },
  "pt-BR": { settlementDetails: "Detalhes do desempenho da equipe", settlementTeam: "Desempenho da equipe", settlementBase: "Desempenho de trabalho", settlementAbsorbed: "Desempenho de exploração", settlementExtra: "Desempenho bônus", settlementPools: "Elemento · Sinergia · Função · Ritmo" },
  "pt-PT": { settlementDetails: "Detalhes do desempenho da equipa", settlementTeam: "Desempenho da equipa", settlementBase: "Desempenho de trabalho", settlementAbsorbed: "Desempenho de exploração", settlementExtra: "Desempenho bónus", settlementPools: "Elemento · Sinergia · Função · Ritmo" },
  ru: { settlementDetails: "Разбивка эффективности команды", settlementTeam: "Эффективность команды", settlementBase: "Эффективность работы", settlementAbsorbed: "Эффективность эксплуатации", settlementExtra: "Бонусная эффективность", settlementPools: "Стихия · Синергия · Профессия · Ритм" },
  it: { settlementDetails: "Dettaglio rendimento squadra", settlementTeam: "Rendimento squadra", settlementBase: "Rendimento lavorativo", settlementAbsorbed: "Rendimento da sfruttamento", settlementExtra: "Rendimento bonus", settlementPools: "Elemento · Sinergia · Ruolo · Ritmo" },
  pl: { settlementDetails: "Podział wydajności zespołu", settlementTeam: "Wydajność zespołu", settlementBase: "Wydajność pracy", settlementAbsorbed: "Wydajność eksploatacji", settlementExtra: "Wydajność premiowa", settlementPools: "Żywioł · Synergia · Rola · Rytm" },
  tr: { settlementDetails: "Takım performansı dökümü", settlementTeam: "Takım performansı", settlementBase: "İş performansı", settlementAbsorbed: "Sömürü performansı", settlementExtra: "Bonus performansı", settlementPools: "Element · Sinerji · Meslek · Ritim" },
  uk: { settlementDetails: "Розподіл ефективності команди", settlementTeam: "Ефективність команди", settlementBase: "Ефективність роботи", settlementAbsorbed: "Ефективність експлуатації", settlementExtra: "Бонусна ефективність", settlementPools: "Стихія · Синергія · Професія · Ритм" },
  ar: { settlementDetails: "تفصيل أداء الفريق", settlementTeam: "أداء الفريق", settlementBase: "أداء العمل", settlementAbsorbed: "أداء الاستغلال", settlementExtra: "الأداء الإضافي", settlementPools: "العنصر · التآزر · الوظيفة · الإيقاع" },
  th: { settlementDetails: "รายละเอียดผลงานทีม", settlementTeam: "ผลงานทีม", settlementBase: "ผลงานการทำงาน", settlementAbsorbed: "ผลงานการใช้ประโยชน์", settlementExtra: "ผลงานโบนัส", settlementPools: "ธาตุ · การเสริมพลัง · อาชีพ · จังหวะ" },
  vi: { settlementDetails: "Chi tiết hiệu suất đội", settlementTeam: "Hiệu suất đội", settlementBase: "Hiệu suất công việc", settlementAbsorbed: "Hiệu suất khai thác", settlementExtra: "Hiệu suất thưởng", settlementPools: "Nguyên tố · Hiệp lực · Nghề nghiệp · Nhịp độ" },
  id: { settlementDetails: "Rincian kinerja tim", settlementTeam: "Kinerja tim", settlementBase: "Kinerja kerja", settlementAbsorbed: "Kinerja eksploitasi", settlementExtra: "Kinerja bonus", settlementPools: "Elemen · Sinergi · Pekerjaan · Ritme" },
  nl: { settlementDetails: "Uitsplitsing teamprestatie", settlementTeam: "Teamprestatie", settlementBase: "Werkprestatie", settlementAbsorbed: "Exploitatieprestatie", settlementExtra: "Bonusprestatie", settlementPools: "Element · Synergie · Functie · Ritme" },
} satisfies Partial<Record<Language, DeepPartial<FactoryRogueStrings>>>;

const generatedLocales = Object.fromEntries(
  Object.entries(generatedFactoryRogueLocales()).map(([language, locale]) => [
    language,
    {
      ...locale,
      ...(FACTORY_SUMMARY_LOCALES as Partial<
        Record<Language, DeepPartial<FactoryRogueStrings>>
      >)[language as Language],
      ...(FACTORY_SETTLEMENT_SCORE_LOCALES as Partial<
        Record<Language, DeepPartial<FactoryRogueStrings>>
      >)[language as Language],
      ...(FACTORY_ACTION_LABEL_LOCALES as Partial<
        Record<Language, DeepPartial<FactoryRogueStrings>>
      >)[language as Language],
      ...(FACTORY_PAYMENT_BUTTON_LOCALES as Partial<
        Record<Language, DeepPartial<FactoryRogueStrings>>
      >)[language as Language],
      ...(FACTORY_SHIFT_LABEL_LOCALES as Partial<
        Record<Language, DeepPartial<FactoryRogueStrings>>
      >)[language as Language],
      ...(FACTORY_TERM_LABEL_LOCALES as Partial<
        Record<Language, DeepPartial<FactoryRogueStrings>>
      >)[language as Language],
      ...(FACTORY_RESUME_LOCALES as Partial<
        Record<Language, DeepPartial<FactoryRogueStrings>>
      >)[language as Language],
    },
  ]),
) as Partial<Record<Language, DeepPartial<FactoryRogueStrings>>>;
export const FACTORY_ROGUE: Record<Language, FactoryRogueStrings> = createLanguageMap<FactoryRogueStrings>(en, zh, {
  en: { ...FACTORY_SHIFT_LABEL_LOCALES.en, ...FACTORY_TERM_LABEL_LOCALES.en, ...FACTORY_RESUME_LOCALES.en, ...FACTORY_PAYMENT_BUTTON_LOCALES.en },
  "zh-Hans": { ...FACTORY_SHIFT_LABEL_LOCALES["zh-Hans"], ...FACTORY_TERM_LABEL_LOCALES["zh-Hans"], ...FACTORY_RESUME_LOCALES["zh-Hans"], ...FACTORY_PAYMENT_BUTTON_LOCALES["zh-Hans"] },
  ...generatedLocales,
  // Keep the hand-tuned Japanese interface copy while using generated Japanese
  // card names/descriptions for the full shop catalogue.
  ja: { ...generatedLocales.ja, ...ja, ...FACTORY_ACTION_LABEL_LOCALES.ja, ...FACTORY_PAYMENT_BUTTON_LOCALES.ja, ...FACTORY_SHIFT_LABEL_LOCALES.ja, ...FACTORY_TERM_LABEL_LOCALES.ja, ...FACTORY_RESUME_LOCALES.ja },
});
