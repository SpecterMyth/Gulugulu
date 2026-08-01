// 《职场叠叠乐》(工厂 roguelike)域词表:FactoryHub / RogueLoadout / RogueHud /
// RogueShop / RogueSummary 与 FactoryScene rogue 模式的全部 UI 词条。
// zh 为基准文案;en 走打工梗调性(与 i18n/factory.ts 同腔调,按钮词条保持短)。
// 卡牌 desc 是函数:传入「本次购买后到达的等级」,插当前级数值;数值单源 =
// rogueConfig 的 CARD_PARAMS / LOAN_*(此处只读消费,改数去 rogueConfig)。
// 本域不并入 i18n.ts 汇总(组件直接 FACTORY_ROGUE[lang] 取用),避免动共享汇总文件。

import type { Language } from "./core";
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
  hudCombo: "连击 ×{n}",
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
  shopStep: "第 {n}/{total} 选",
  shopAllDone: "强化结束，准备招聘",
  shopOpPaused: "完成本次操作后继续商店 · 还剩 {n} 次选择",
  operationKicker: "待完成操作",
  operationDismissTitle: "选择要解雇的咕噜",
  operationDismissSceneHint: "直接点击场景中的咕噜",
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
  landingFailed: "没有下级可以压榨",
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
      desc: (lv) => `【点燃】：打工业绩额外结算 ${V(P["fire.burst"].repeats, lv)} 次`,
    },
    "fire.ember": {
      name: "余烬",
      desc: (lv) => `火系压榨业绩 ×${mu(V(P["fire.ember"].asAbsorbed, lv))}`,
    },
    "fire.wildfire": {
      name: "燎原",
      desc: (lv) => `首次计分后【传火】至多 ${V(P["fire.wildfire"].spread, lv)} 只`,
    },
    "fire.chain": {
      name: "引火链",
      desc: (lv) => `含火投放：压榨数 +${V(P["fire.chain"].reachBonus, lv)}`,
    },
    "electric.overload": {
      name: "过载",
      desc: (lv) => `每压榨 1 层：加成 ${add(V(P["electric.overload"].perDepth, lv))}`,
    },
    "electric.wire": {
      name: "导线",
      desc: (lv) => `含电投放：压榨数 +${V(P["electric.wire"].reachBonus, lv)}`,
    },
    "electric.parallel": {
      name: "并联回路",
      desc: (lv) => `每多接 1 桌：加成 ${add(V(P["electric.parallel"].perExtraDesk, lv))}`,
    },
    "electric.induction": {
      name: "感应",
      desc: (lv) => `每条电系接桌通路边：加成 ${add(V(P["electric.induction"].perLink, lv))}`,
    },
    "ice.icicle": {
      name: "冰棱",
      desc: (lv) => `冰系正上方咕噜：团队业绩 ×${mu(V(P["ice.icicle"].above, lv))}`,
    },
    "ice.freezeprice": {
      name: "冻价",
      desc: (lv) => `冰系咕噜的雇佣价格 ×${mu(V(P["ice.freezeprice"].priceMult, lv))}`,
    },
    "ice.prism": {
      name: "棱镜",
      desc: (lv) => `冰系已接桌：接桌数 +1，桌面加成 ${add(V(P["ice.prism"].extraShare, lv))}`,
    },
    "ice.chain": {
      name: "冰桥",
      desc: (lv) => `含冰投放：压榨数 +${V(P["ice.chain"].reachBonus, lv)}`,
    },
    "ice.freeze": {
      name: "急冻通路",
      desc: (lv) => `连通后：${odds(V(P["ice.freeze"].chance, lv))}【冻结】下方咕噜`,
    },
    "ice.overstaff": {
      name: "超额编制奖",
      desc: (lv) => `每点【超额人口】：加成 ${add(V(P["ice.overstaff"].per, lv))}`,
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
      desc: (lv) => `含水同种 ${V(P["water.fourday"].line, lv)} 只罢工；每只追加 ${ratio(V(P["water.fourday"].strikeBonus, lv))} 完整业绩`,
    },
    "water.chain": {
      name: "水道",
      desc: (lv) => `含水投放：压榨数 +${V(P["water.chain"].reachBonus, lv)}`,
    },
    "water.same": {
      name: "同名增压",
      desc: (lv) => `每只同名队友：本卡 ×${mu(V(P["water.same"].perTeamSame, lv))}（至多 10 只）`,
    },
    "water.convert": {
      name: "水镜同化",
      desc: (lv) => `结算后，将本次压榨中业绩最高的 ${V(P["water.convert"].targets, lv)} 个非水目标【同化】`,
    },
    "grass.root": {
      name: "扎根",
      desc: (lv) => `草系踩桌：该桌团队业绩 ×${mu(V(P["grass.root"].deskMult, lv))}`,
    },
    "grass.symbiosis": {
      name: "共生",
      desc: (lv) => `每只异元素邻居：草系压榨加成 ${add(V(P["grass.symbiosis"].perNeighbor, lv))}`,
    },
    "grass.growth": {
      name: "生长",
      desc: (lv) => `草系每跨 1 班：打工加成 ${add(V(P["grass.growth"].perShift, lv))}（上限 ×${V(P["grass.growth"].capX, lv)}）`,
    },
    "grass.chain": {
      name: "藤链",
      desc: (lv) => `含草投放：压榨数 +${V(P["grass.chain"].reachBonus, lv)}`,
    },
    "grass.grow": {
      name: "野蛮生长",
      desc: (lv) => `结算后：${odds(V(P["grass.grow"].chance, lv))}【生长】`,
    },
    "grass.crowd": {
      name: "繁茂群落",
      desc: (lv) => `每点【繁茂】：加成 ${add(V(P["grass.crowd"].perConnected, lv))}`,
    },
    "grass.height": {
      name: "高层冠幅",
      desc: (lv) => `每层【层高】：加成 ${add(V(P["grass.height"].perLayer, lv))}`,
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
      desc: (lv) => `含一般投放：压榨数 +${V(P["normal.chain"].reachBonus, lv)}`,
    },
    "normal.absorb": {
      name: "吸收",
      desc: (lv) => {
        const targets = V(P["normal.absorb"].targets, lv);
        const chance = odds(V(P["normal.absorb"].chance, lv));
        return `投放后：${chance}与最近的咕噜吸收；高等级吞低等级，同级由自己吞${targets > 1 ? `（至多 ${targets} 只）` : ""}`;
      },
    },
    "normal.gluttony": {
      name: "暴食",
      desc: (lv) => `投放者每点额外【体型】：加成 ${add(V(P["normal.gluttony"].perSize, lv))}`,
    },
    "normal.emperor": {
      name: "打工皇帝",
      desc: (lv) => `结算后：最大一般系体型 +${V(P["normal.emperor"].grow, lv)}，吞掉完全遮挡的咕噜`,
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
      desc: (lv) => `1~6 色工种均在场：加成 ${add(V(P["attr.balance"].mult, lv) - 1)}`,
    },
    "syn.steam": {
      name: "蒸汽机",
      desc: (lv) =>
        `火冰相邻对产生光环：两只咕噜及其直接邻居的团队业绩 ×${mu(V(P["syn.steam"].aura, lv))}`,
    },
    "syn.short": {
      name: "短路",
      desc: (lv) =>
        `【线路】每经过 1 只【同名】水咕噜，追加其打工业绩 ×${mu(V(P["syn.short"].burst, lv))}`,
    },
    "syn.greenhouse": {
      name: "温室",
      desc: (lv) => `【点燃】后：${odds(V(P["syn.greenhouse"].chance, lv))}额外【生长】${lv >= 5 ? " 2 只" : ""}`,
    },
    "syn.permafrost": {
      name: "霜根网络",
      desc: (lv) => `冰草【粘连】；每条边加成 ${add(V(P["syn.permafrost"].perCrossEdge, lv))}（至多 ${V(P["syn.permafrost"].cap, lv)} 条）${lv >= 5 ? "；Lv.5：计算整片粘连" : ""}`,
    },
    "syn.lightningrod": {
      name: "蓄能胃袋",
      desc: (lv) => `一般系中继电路；线路中每点【体型】加成 ${add(V(P["syn.lightningrod"].perMass, lv))}`,
    },
    "syn.mudslide": {
      name: "泥石流",
      desc: () => "塌方经过水草相邻对：原地重粘",
    },
    "syn.arcIgnite": {
      name: "电弧点火",
      desc: (lv) => `【点燃】每多接 1 桌：加成 ${add(V(P["syn.arcIgnite"].perDesk, lv))}`,
    },
    "syn.thermalShock": {
      name: "热震",
      desc: (lv) => `【点燃】压榨到【冻结】时，每只追加其打工业绩 ×${mu(V(P["syn.thermalShock"].echo, lv))}`,
    },
    "syn.steamBurst": {
      name: "蒸汽爆发",
      desc: (lv) => `【点燃】每只【同名】水系：加成 ${add(V(P["syn.steamBurst"].perSame, lv))}`,
    },
    "syn.fireDispatch": {
      name: "吞火",
      desc: (lv) => `火＋一般每点额外【体型】：加成 ${add(V(P["syn.fireDispatch"].perMass, lv))}`,
    },
    "syn.superconduct": {
      name: "超导",
      desc: (lv) => `每只【冻结】咕噜：加成 ${add(V(P["syn.superconduct"].perFrozen, lv))}`,
    },
    "syn.bionet": {
      name: "生物电网",
      desc: (lv) => `【生长】咕噜中继电路；每只加成 ${add(V(P["syn.bionet"].perGenerated, lv))}${lv >= 5 ? "；Lv.5：计作 2 只" : ""}`,
    },
    "syn.iceMirror": {
      name: "冰镜同化",
      desc: (lv) => `每只【冻结】同名水系：加成 ${add(V(P["syn.iceMirror"].perFrozenSame, lv))}`,
    },
    "syn.coldRotation": {
      name: "冰鲜储备",
      desc: (lv) => `【冻结】咕噜每点额外【体型】使压榨业绩 ${add(V(P["syn.coldRotation"].perMass, lv))}`,
    },
    "syn.irrigation": {
      name: "灌溉增殖",
      desc: (lv) => `【生长】优先复制同名水系；成功率 ×${mu(V(P["syn.irrigation"].chanceMult, lv))}${lv >= 5 ? "；Lv.5：3 只" : ""}`,
    },
    "syn.badge": {
      name: "液态融合",
      desc: (lv) => `水＋一般【吸收】后：额外结算完整业绩 ×${mu(V(P["syn.badge"].mult, lv) - 1)}`,
    },
    "syn.multiSeed": {
      name: "营养繁殖",
      desc: (lv) => `【生长】咕噜继承母体 ${ratio(V(P["syn.multiSeed"].inheritMass, lv))}【体型】`,
    },
    "base.fire": {
      name: "火系培训",
      desc: (lv) => `投放含火咕噜时，其打工业绩 +${V(P["base.fire"].bonus, lv)}`,
    },
    "base.water": {
      name: "水系培训",
      desc: (lv) => `投放含水咕噜时，其打工业绩 +${V(P["base.water"].bonus, lv)}`,
    },
    "base.grass": {
      name: "草系培训",
      desc: (lv) => `投放含草咕噜时，其打工业绩 +${V(P["base.grass"].bonus, lv)}`,
    },
    "base.electric": {
      name: "电系培训",
      desc: (lv) => `投放含电咕噜时，其打工业绩 +${V(P["base.electric"].bonus, lv)}`,
    },
    "base.ice": {
      name: "冰系培训",
      desc: (lv) => `投放含冰咕噜时，其打工业绩 +${V(P["base.ice"].bonus, lv)}`,
    },
    "base.normal": {
      name: "一般系培训",
      desc: (lv) => `投放含一般咕噜时，其打工业绩 +${V(P["base.normal"].bonus, lv)}`,
    },
    "staff.fire3": {
      name: "解雇",
      desc: () => `一次性：解雇至多 ${P["staff.fire3"].picks} 只，返还 1x 雇价并塌方（无罢工/遣散费）`,
    },
    "staff.severance": {
      name: "遣散费",
      desc: (lv) => `罢工/解雇离场：返还 ${ratio(V(P["staff.severance"].refund, lv))} 雇价`,
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
      desc: (lv) => `指定工种：本局雇价 −${ratio(V(P["staff.pricecut"].cut, lv))}`,
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
  loReach: "Exploitation Count {n}",
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
  shopStep: "Pick {n}/{total}",
  shopAllDone: "Upgrade complete, ready to recruit",
  shopOpPaused: "Finish this action to resume the shop · {n} picks left",
  operationKicker: "ACTION REQUIRED",
  operationDismissTitle: "Choose Gulus to lay off",
  operationDismissSceneHint: "Click Gulus directly in the factory scene",
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
  landingFailed: "NO UNDERLINGS TO EXPLOIT",
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
      desc: (lv) => `Ignite: score Work Performance ${V(P["fire.burst"].repeats, lv)} extra time(s)`,
    },
    "fire.ember": {
      name: "Warm Handover",
      desc: (lv) =>
        `Exploitation Performance supplied by Fire Gulus ×${mu(V(P["fire.ember"].asAbsorbed, lv))}`,
    },
    "fire.wildfire": {
      name: "Wildfire",
      desc: (lv) =>
        `After the first score, Ignite spreads through up to ${V(P["fire.wildfire"].spread, lv)} adjacent Fire Gulus`,
    },
    "fire.chain": {
      name: "Fireline",
      desc: (lv) => `Deploying a Fire Gulu grants +${V(P["fire.chain"].reachBonus, lv)} Exploitation Count`,
    },
    "electric.overload": {
      name: "Crunch Mode",
      desc: (lv) => `Each exploited layer: bonus ${addEn(V(P["electric.overload"].perDepth, lv))}`,
    },
    "electric.wire": {
      name: "Live Wire",
      desc: (lv) => `Deploying an Electric Gulu grants +${V(P["electric.wire"].reachBonus, lv)} Exploitation Count`,
    },
    "electric.parallel": {
      name: "Parallel Circuit",
      desc: (lv) => `Each extra linked desk: bonus ${addEn(V(P["electric.parallel"].perExtraDesk, lv))}`,
    },
    "electric.induction": {
      name: "Corporate Ladder",
      desc: (lv) => `Each Electric desk-path edge: bonus ${addEn(V(P["electric.induction"].perLink, lv))}`,
    },
    "ice.icicle": {
      name: "Icicle",
      desc: (lv) =>
        `Gulus stuck directly above an Ice Gulu gain ×${mu(V(P["ice.icicle"].above, lv))} Team Performance`,
    },
    "ice.freezeprice": {
      name: "Wage Freeze",
      desc: (lv) =>
        `Ice Gulus' hiring price ×${mu(V(P["ice.freezeprice"].priceMult, lv))}`,
    },
    "ice.freeze": {
      name: "Flash-Freeze Route",
      desc: (lv) => `After linking: ${oddsEn(V(P["ice.freeze"].chance, lv))} Freeze below`,
    },
    "ice.overstaff": {
      name: "Overstaffing Bonus",
      desc: (lv) => `Each Overstaffing point: bonus ${addEn(V(P["ice.overstaff"].per, lv))}`,
    },
    "ice.prism": {
      name: "Prism",
      desc: (lv) => `Ice linked to ≥1 desk: desk count +1, desk bonus ${addEn(V(P["ice.prism"].extraShare, lv))}`,
    },
    "ice.chain": {
      name: "Ice Bridge",
      desc: (lv) => `Deploying an Ice Gulu grants +${V(P["ice.chain"].reachBonus, lv)} Exploitation Count`,
    },
    "water.reflow": {
      name: "Backflow",
      desc: (lv) =>
        `Bounced hires refund ${pc(V(P["water.reflow"].refund, lv))}% of the fee`,
    },
    "water.reservoir": {
      name: "Rainy-Day Fund",
      desc: (lv) =>
        `+${pc(V(P["water.reservoir"].interest, lv))}% interest on cash at shift end`,
    },
    "water.fourday": {
      name: "Four-Day Week",
      desc: (lv) => `Water groups strike at ${V(P["water.fourday"].line, lv)}; each adds ${ratioEn(V(P["water.fourday"].strikeBonus, lv))} full performance`,
    },
    "water.same": {
      name: "Same-Name Tide",
      desc: (lv) => `Each same-name teammate: this card ×${mu(V(P["water.same"].perTeamSame, lv))} (max 10)`,
    },
    "water.convert": {
      name: "Assimilation",
      desc: (lv) => `Score: Convert top ${V(P["water.convert"].targets, lv)} non-Water targets`,
    },
    "water.chain": {
      name: "Waterway",
      desc: (lv) => `Deploying a Water Gulu grants +${V(P["water.chain"].reachBonus, lv)} Exploitation Count`,
    },
    "grass.root": {
      name: "Deep Roots",
      desc: (lv) => `Grass on desk: that desk's Team Performance ×${mu(V(P["grass.root"].deskMult, lv))}`,
    },
    "grass.symbiosis": {
      name: "Team Player",
      desc: (lv) => `Each off-element neighbor: Grass exploitation bonus ${addEn(V(P["grass.symbiosis"].perNeighbor, lv))}`,
    },
    "grass.growth": {
      name: "Compound Growth",
      desc: (lv) =>
        `Each survived shift adds ${addEn(V(P["grass.growth"].perShift, lv))} to a Grass Gulu's Work Performance (cap ×${V(P["grass.growth"].capX, lv)})`,
    },
    "grass.chain": {
      name: "Vine Network",
      desc: (lv) => `Deploying a Grass Gulu grants +${V(P["grass.chain"].reachBonus, lv)} Exploitation Count`,
    },
    "grass.grow": {
      name: "Self-Propagation",
      desc: (lv) => `After scoring: ${oddsEn(V(P["grass.grow"].chance, lv))} Grow`,
    },
    "grass.crowd": {
      name: "Lush Workforce",
      desc: (lv) => `Each Lush point: bonus ${addEn(V(P["grass.crowd"].perConnected, lv))}`,
    },
    "grass.height": {
      name: "Canopy",
      desc: (lv) => `Each linked Height: bonus ${addEn(V(P["grass.height"].perLayer, lv))}`,
    },
    "normal.crowd": {
      name: "Warm Bodies",
      desc: (lv) =>
        `Every 5 Normal Gulus on site: all Team Performance +${pc(V(P["normal.crowd"].per5, lv))}%`,
    },
    "normal.temp": {
      name: "Temp Agency",
      desc: (lv) =>
        `1-color job wage inflation drops to ×${P["normal.temp"].inflation[Math.min(lv, P["normal.temp"].inflation.length) - 1]}`,
    },
    "normal.jack": {
      name: "Jack of All Trades",
      desc: (lv) =>
        lv >= 2
          ? "Normal Gulus stick to any Gulu and can relay any element's desk path"
          : "Normal Gulus count as sharing an element with every Gulu when sticking",
    },
    "normal.chain": {
      name: "Office Network",
      desc: (lv) => `Deploying a Normal Gulu grants +${V(P["normal.chain"].reachBonus, lv)} Exploitation Count`,
    },
    "normal.absorb": {
      name: "Absorb",
      desc: (lv) => {
        const targets = V(P["normal.absorb"].targets, lv);
        const chance = oddsEn(V(P["normal.absorb"].chance, lv));
        return `Deploy: ${chance} absorb with the nearest Gulu; higher Size wins, self wins ties${targets > 1 ? ` (up to ${targets})` : ""}`;
      },
    },
    "normal.gluttony": {
      name: "Gluttony",
      desc: (lv) => `Each extra thrower Size: bonus ${addEn(V(P["normal.gluttony"].perSize, lv))}`,
    },
    "normal.emperor": {
      name: "Employee of the Universe",
      desc: (lv) => `Score: largest Normal +${V(P["normal.emperor"].grow, lv)} Size; swallow fully covered Gulus`,
    },
    "normal.tags": { name: "Legacy Résumé", desc: () => "Migrated to Absorb" },
    "normal.overlap": { name: "Legacy Resonance", desc: () => "Migrated to Gluttony" },
    "normal.dispatch": { name: "Legacy Dispatch", desc: () => "Migrated to Employee of the Universe" },
    "syn.arcIgnite": {
      name: "Arc Ignition",
      desc: (lv) => `Ignite, each extra desk: bonus ${addEn(V(P["syn.arcIgnite"].perDesk, lv))}`,
    },
    "syn.thermalShock": {
      name: "Thermal Shock",
      desc: (lv) =>
        `When an Ignited Gulu exploits a Frozen Gulu, add its Work Performance ×${mu(V(P["syn.thermalShock"].echo, lv))}`,
    },
    "syn.steamBurst": {
      name: "Steam Burst",
      desc: (lv) => `Ignite, each same-name Water: bonus ${addEn(V(P["syn.steamBurst"].perSame, lv))}`,
    },
    "syn.fireDispatch": {
      name: "Fire-Eater",
      desc: (lv) => `Each extra Fire+Normal Size: bonus ${addEn(V(P["syn.fireDispatch"].perMass, lv))}`,
    },
    "syn.superconduct": {
      name: "Superconductor",
      desc: (lv) => `Each Frozen Gulu: bonus ${addEn(V(P["syn.superconduct"].perFrozen, lv))}`,
    },
    "syn.bionet": {
      name: "Bio-Network",
      desc: (lv) => `Generated Gulus relay circuits; each: bonus ${addEn(V(P["syn.bionet"].perGenerated, lv))}${lv >= 5 ? "; Lv.5: count twice" : ""}`,
    },
    "syn.iceMirror": {
      name: "Ice Mirror",
      desc: (lv) => `Each Frozen same-name Water: bonus ${addEn(V(P["syn.iceMirror"].perFrozenSame, lv))}`,
    },
    "syn.coldRotation": {
      name: "Cold Storage",
      desc: (lv) => `Each extra Frozen Size: exploitation bonus ${addEn(V(P["syn.coldRotation"].perMass, lv))}`,
    },
    "syn.irrigation": {
      name: "Irrigation",
      desc: (lv) =>
        `Grow prioritizes a same-name Water Gulu; chance ×${mu(V(P["syn.irrigation"].chanceMult, lv))}${lv >= 5 ? "; Apex: Grow 3 copies" : ""}`,
    },
    "syn.badge": {
      name: "Liquid Fusion",
      desc: (lv) => `Water+Normal Absorb: score full performance ×${mu(V(P["syn.badge"].mult, lv) - 1)} extra`,
    },
    "syn.multiSeed": {
      name: "Nutrient Seed",
      desc: (lv) => `Generated Gulu Size: ${ratioEn(V(P["syn.multiSeed"].inheritMass, lv))} of parent`,
    },
    "attr.pure": {
      name: "Specialist",
      desc: (lv) => `1-color Gulus: bonus ${addEn(V(P["attr.pure"].mult, lv) - 1)}`,
    },
    "attr.dual": {
      name: "Dual Income",
      desc: (lv) => `2-color Gulus: bonus ${addEn(V(P["attr.dual"].mult, lv) - 1)}`,
    },
    "attr.slash": {
      name: "Side Hustler",
      desc: (lv) => `3-color Gulus: bonus ${addEn(V(P["attr.slash"].mult, lv) - 1)}`,
    },
    "attr.hex": {
      name: "Hexagon Allowance",
      desc: (lv) => `≥4-color Gulus, each element: bonus ${addEn(V(P["attr.hex"].perElement, lv))}`,
    },
    "attr.balance": {
      name: "Full-Roster Bonus",
      desc: (lv) => `All 1–6-color jobs on site: bonus ${addEn(V(P["attr.balance"].mult, lv) - 1)}`,
    },
    "syn.steam": {
      name: "Steam Engine",
      desc: (lv) => `Adjacent Fire+Ice: pair and neighbors' Team Performance ×${mu(V(P["syn.steam"].aura, lv))}`,
    },
    "syn.short": {
      name: "Short Circuit",
      desc: (lv) => `Each same-name Water in Circuit: add Work Performance ×${mu(V(P["syn.short"].burst, lv))}`,
    },
    "syn.greenhouse": {
      name: "Greenhouse",
      desc: (lv) => `Ignite: ${oddsEn(V(P["syn.greenhouse"].chance, lv))} extra Grow${lv >= 5 ? " ×2" : ""}`,
    },
    "syn.permafrost": {
      name: "Frostroot Network",
      desc: (lv) => `Ice–Grass Stick; each edge: bonus ${addEn(V(P["syn.permafrost"].perCrossEdge, lv))} (max ${V(P["syn.permafrost"].cap, lv)})${lv >= 5 ? "; Lv.5: whole cluster" : ""}`,
    },
    "syn.lightningrod": {
      name: "Battery Belly",
      desc: (lv) => `Normal relays circuits; each route Size: bonus ${addEn(V(P["syn.lightningrod"].perMass, lv))}`,
    },
    "syn.mudslide": {
      name: "Mudslide",
      desc: () => "Collapse through Water+Grass: re-stick in place",
    },
    "base.fire": {
      name: "Fire Training",
      desc: (lv) => `A deployed Fire Gulu gains +${V(P["base.fire"].bonus, lv)} Work Performance`,
    },
    "base.water": {
      name: "Water Training",
      desc: (lv) => `A deployed Water Gulu gains +${V(P["base.water"].bonus, lv)} Work Performance`,
    },
    "base.grass": {
      name: "Grass Training",
      desc: (lv) => `A deployed Grass Gulu gains +${V(P["base.grass"].bonus, lv)} Work Performance`,
    },
    "base.electric": {
      name: "Electric Training",
      desc: (lv) => `A deployed Electric Gulu gains +${V(P["base.electric"].bonus, lv)} Work Performance`,
    },
    "base.ice": {
      name: "Ice Training",
      desc: (lv) => `A deployed Ice Gulu gains +${V(P["base.ice"].bonus, lv)} Work Performance`,
    },
    "base.normal": {
      name: "Normal Training",
      desc: (lv) => `A deployed Normal Gulu gains +${V(P["base.normal"].bonus, lv)} Work Performance`,
    },
    "staff.fire3": {
      name: "Pink Slips",
      desc: () => `One-shot: dismiss ${P["staff.fire3"].picks}; refund 1x, collapse (no strike/severance)`,
    },
    "staff.severance": {
      name: "Severance Package",
      desc: (lv) => `Strike/layoff exit: refund ${ratioEn(V(P["staff.severance"].refund, lv))} hire price`,
    },
    "staff.movedesk": {
      name: "Desk Shuffle",
      desc: () => "One-shot: swap two desks and towers; cut cross-desk links midway",
    },
    "staff.expand": {
      name: "Extra Seats",
      desc: () => `Headcount cap +${P["staff.expand"].quota}`,
    },
    "staff.talentmarket": {
      name: "Talent Market",
      desc: (lv) => `Each draft: +${P["staff.talentmarket"].rerollsPerLevel * lv} rerolls, +${P["staff.talentmarket"].candidatesPerLevel * lv} candidates (hire max 10)`,
    },
    "staff.backfill": {
      name: "Backfill",
      desc: (lv) => `After regular draft: extra draft for ${V(P["staff.backfill"].extraCandidates, lv)} Gulus`,
    },
    "staff.loan": {
      name: "Payday Loan",
      desc: () => `Get ${ratioEn(LOAN_GAIN_RATE)} KPI; repay ${ratioEn(LOAN_REPAY_RATE)} principal for ${LOAN_SHIFTS} shifts (${ratioEn(LOAN_TOTAL_REPAY_RATE)} total)`,
    },
    "staff.pricecut": {
      name: "Lowball Offer",
      desc: (lv) => `Pick a job: hire price −${ratioEn(V(P["staff.pricecut"].cut, lv))} this run`,
    },
  },
};

export const FACTORY_ROGUE: Record<Language, FactoryRogueStrings> = { zh, en };
