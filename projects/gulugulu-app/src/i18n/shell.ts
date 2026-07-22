// 壳层域词表：App.tsx / Overlays / PetStage / 欢迎回来 / 教程 / 教练(coach)/
// 飘字(pops)等宠物窗口侧的全部 UI 词条。字段随本地化 pass 抽取逐步补全;
// zh 值必须与原硬编码逐字一致(不改中文文案,只搬家)。
//
// 模板占位符走 core.ts 的 fmt():"{n}"/"{name}" 等在渲染点插值。

import type { Language } from "./core";

/** 状态提示 / 收益横幅(showToastMsg 通道)。 */
export interface ShellToastStrings {
  /** 首次 Token 进食的一次性玩法发现提示（2026-07-21 起 Token → 陪伴宠经验）。 */
  firstTokenMeal: string;
  /** 首批键帽到达时的一次性键盘玩法提示。 */
  keyDiscovery: string;
  /** 日额度用尽后继续点击(纯抚摸)的一次性提示。 */
  capPetting: string;
  /** 第 2000 击达成(日额度点满)的一次性庆祝。 */
  capCelebrate: string;
  /** 满工收工结算横幅。{coins}/{exp} */
  barDone: string;
  /** 孵化揭晓:全新 AI 物种。{name} */
  hatchAiNew: string;
  /** 孵化揭晓:AI 生成未完成 → 孵出该配方的经典（0 号固有）形象。{name} */
  hatchFallback: string;
  /** 孵化揭晓:普通/经典。{name} */
  hatchStandard: string;
  eggToSlot: string;
  eggToInventory: string;
  hatchStart: string;
  fusionRecipe: string;
  fusionAi: string;
  /** 放生返还。{refund} */
  released: string;
  following: string;
  hatcheryUpgraded: string;
  yardUpgraded: string;
  shopUpgraded: string;
  steamMarketFail: string;
  steamSyncing: string;
  /** 导入我的宠物:点击即时提示。 */
  steamImporting: string;
  /** 导入完成、全部入院。{imported} */
  steamImportDone: string;
  /** 导入完成、部分留待认领。{imported} {skipped} */
  steamImportDonePartial: string;
  /** 后院已满、一只未导入。{skipped} */
  steamImportFull: string;
  /** 没有可导入的新宠物。 */
  steamImportNone: string;
  /** 调试投喂但陪伴宠已满级（Token 经验被浪费）。 */
  tokenMaxed: string;
  /** 10% 唤醒瞬间。 */
  wokeUp: string;
  /** 后院(非主宠)静默满级的环境提示。{name} */
  yardPetMaxed: string;
  /** 成就解锁横幅。{name} */
  achievementUnlocked: string;
  /** AI 生成进度:resolved 无消息时的兜底。 */
  fusionDesignDoneFallback: string;
  /** AI 生成进度:resolved 横幅。{msg} */
  fusionResolvedToast: string;
  /** AI 生成进度:failed 横幅。{msg} */
  fusionBlockedToast: string;
  /** 跨账号存档重绑确认弹窗(window.confirm)。 */
  steamRebindConfirm: string;
  /** 重绑完成。 */
  steamRebindDone: string;
}

/** 飘字(pops)与连击读数。 */
export interface ShellPopStrings {
  milestoneHalf: string;
  milestoneSprint: string;
  /** {n} 击段落横幅。 */
  milestoneHits: string;
  /** 满级星标飘字。 */
  maxLevel: string;
  /** 连击累计读数。{n} */
  combo: string;
}

/** 角色台词类(speech.ts 的兜底/模板行;随机台词池是双语数据,不在此)。 */
export interface ShellSpeechStrings {
  /** 恢复期点击驳回(无进度数据)。 */
  recoveryNap: string;
  /** 恢复期点击驳回(带进度)。{threshold}/{shown} */
  recoveryProgress: string;
  /** Token 餐气泡(带来源 Agent)。{name}/{amount}/{tail} */
  tokenMealNamed: string;
  /** Token 餐气泡(无来源)。{amount}/{tail} */
  tokenMealAnon: string;
  /** 餐气泡尾句·普通(经验涨了)。{exp} */
  tokenMealExp: string;
  /** 餐气泡尾句·升级。{exp} */
  tokenMealLevelUp: string;
  /** 主宠满级时的舞台台词。 */
  maxLevelFuse: string;
  /** 台词池 "XXX" 占位符的替换词。 */
  statePlaceholder: string;
}

/** 状态触发式轻引导(game/tutorial.ts)。 */
export interface ShellTutorialStrings {
  /** {collected}/{total} */
  graduation: string;
  collectEgg: string;
  recovering: string;
  capFull: string;
  fusionReady: string;
  /** {clicks} */
  expDiffEnough: string;
  /** {clicks} */
  expDiffCapped: string;
  maxSwitch: string;
  buySecond: string;
  shopUpgrade: string;
  release: string;
  pokedex: string;
  steam: string;
  /** {left} */
  capNear: string;
  menuWork: string;
  firstEgg: string;
  noPetMenu: string;
  noPetTry: string;
}

/** 新手强引导教练(coach)的气泡短标签(zh ≤12 字,EN 同样求短)。 */
export interface ShellCoachStrings {
  openMenu: string;
  keysForEnergy: string;
  eggReadyTap: string;
  eggWaiting: string;
  rapidWork: string;
  goYardWalk: string;
  walkKeys: string;
  earnCoins: string;
  goYardBuy: string;
  goShop: string;
  buyEggPair: string;
  goYardEgg: string;
  eggReadyCollect: string;
  goYardSwitch: string;
  approachOther: string;
  tapFollow: string;
  /** {n} = 还差点击数 */
  maxIt: string;
  goYardMax: string;
  findOther: string;
  goYardFuse: string;
  approachIt: string;
  makeFollow: string;
  earnFusionFee: string;
  walkToIt: string;
  tapFuse: string;
  /** #7 回主界面点满级。 */
  returnMain: string;
  /** #6 首融后回主界面收蛋（无其他在养宠，蛋顶到主舞台）。 */
  returnMainCollect: string;
  /** #6 首融后仍有其他角色：蛋只在后院孵化槽，引到后院直接收。 */
  goYardCollectFusion: string;
  /** #8 融合弹窗「开始融合」。 */
  tapFuseConfirm: string;
  /** 跳过教程按钮。 */
  skip: string;
}

/** 欢迎回来摘要卡(game/WelcomeBack.tsx)。 */
export interface ShellWelcomeStrings {
  title: string;
  aria: string;
  /** {duration} */
  awayFor: string;
  /** 离线时长单位(EN 单复数分开;zh 两者同文)。{n} */
  durDay: string;
  durDays: string;
  durHour: string;
  durHours: string;
  durMinute: string;
  durMinutes: string;
  noPet: string;
  /** {max} */
  staminaFull: string;
  /** {current}/{max} */
  staminaPartial: string;
  /** {n} */
  eggsReady: string;
  /** {n} */
  eggsIncubating: string;
  eggsEmpty: string;
  /** {goal} */
  todayGoal: string;
  goalFuse: string;
  goalBuyEgg: string;
  goalLevelUp: string;
  goalEarn: string;
  start: string;
  // —— 昨日战报（WelcomeBack 昨日总结改造）——
  /** 战报日期头。{date} */
  reportTitle: string;
  /** 非严格昨天（跳过了一天）时的日期头。{date} */
  reportTitlePrev: string;
  /** 尚无归档数据时的兜底提示。 */
  reportEmpty: string;
  rowTokens: string;
  rowTokensGen: string;
  rowKeys: string;
  rowClicks: string;
  rowHatches: string;
  rowFusions: string;
  rowCoins: string;
  /** 计数单位后缀（EN 留空）。 */
  unitTimes: string;
  unitPets: string;
  /** 吐槽档位候选（狠辣暴击；{tokens} 占位，按 dayIndex 定种子取一句）。 */
  roastT0: string[];
  roastT1: string[];
  roastT2: string[];
  roastT3: string[];
  roastT4: string[];
  roastT5: string[];
  /** 特殊组合吐槽（命中优先于档位）。 */
  roastNightOwl: string;
  /** {fusions} */
  roastFusionManiac: string;
  roastEggHoarder: string;
  roastHandsOff: string;
  /** {clicks} */
  roastClickStorm: string;
  roastNothing: string;
}

/** 「开机自启」引导弹窗(app/AutostartPromptCard.tsx)——首融领新宠后弹出。 */
export interface ShellAutostartStrings {
  title: string;
  aria: string;
  body: string;
  accept: string;
  decline: string;
}

export interface ShellStrings {
  stamina: string;
  /** 物种名兜底(孵化揭晓找不到任何名字时)。 */
  fallbackPetName: string;
  /** 经典配方产物名兜底。 */
  newSpeciesName: string;
  /** AI 融合尚未揭晓的占位名。 */
  mysterySpeciesName: string;
  toast: ShellToastStrings;
  pop: ShellPopStrings;
  speech: ShellSpeechStrings;
  tutorial: ShellTutorialStrings;
  coach: ShellCoachStrings;
  welcome: ShellWelcomeStrings;
  autostart: ShellAutostartStrings;
}

export const SHELL: Record<Language, ShellStrings> = {
  zh: {
    stamina: "体力",
    fallbackPetName: "精灵",
    newSpeciesName: "新物种",
    mysterySpeciesName: "神秘新物种",
    toast: {
      firstTokenMeal: "AI 干活产出的 Token，都喂给陪伴中的我涨经验啦🍙✨ 点我打工才有金币哦",
      keyDiscovery: "你敲的每个键，陪伴中的我都接住吃掉，回精力⚡（只数次数不记内容，设置里可关）",
      capPetting: "今天的爱已点满💛 现在点我都是纯摸摸",
      capCelebrate: "今天的爱点满啦！剩下的明天继续💛",
      barDone: "满工收工！本管 🪙+{coins} ✨+{exp}",
      hatchAiNew: "🎉 全新物种「{name}」诞生了！",
      hatchFallback: "AI 设计未完成，孵出了配方的经典形象「{name}」！",
      hatchStandard: "{name} 破壳而出！",
      eggToSlot: "蛋已放进孵化槽",
      eggToInventory: "孵化槽已满，蛋放进了库存",
      hatchStart: "开始孵化！",
      fusionRecipe: "触发经典配方！高阶蛋已放进孵化区",
      fusionAi: "✨ AI 开始设计新物种，神秘蛋已入孵化区",
      released: "已放生，返还 {refund} 金币",
      following: "它现在跟着你啦",
      hatcheryUpgraded: "孵化屋升级成功！",
      yardUpgraded: "后院升级成功！",
      shopUpgraded: "商店升级成功！解锁了更高阶的蛋",
      steamMarketFail: "打不开 Steam 市场，稍后再试",
      steamSyncing: "正在与 Steam 同步…",
      steamImporting: "正在导入 Steam 库存宠物…",
      steamImportDone: "已导入 {imported} 只宠物🎉",
      steamImportDonePartial: "已导入 {imported} 只，还有 {skipped} 只因后院已满留待认领（扩建后院再导入）",
      steamImportFull: "后院已满，{skipped} 只宠物留待认领（扩建后院后再导入）",
      steamImportNone: "没有可导入的新宠物",
      tokenMaxed: "我已经满级啦，Token 就当零嘴吃着玩～",
      wokeUp: "睡饱啦！精力回上来了⚡",
      yardPetMaxed: "🌟 {name} 满级啦！可以去融合了",
      achievementUnlocked: "🏆 成就解锁：{name}",
      fusionDesignDoneFallback: "新物种设计完成！",
      fusionResolvedToast: "🎉 {msg}",
      fusionBlockedToast: "融合生成受阻：{msg}",
      steamRebindConfirm:
        "此存档绑定的是另一个 Steam 账号。\n确认后将解除旧绑定，并以当前账号的 Steam 库存为准重新同步（本地精灵保留）。\n现在重绑吗？",
      steamRebindDone: "已重绑当前 Steam 账号",
    },
    pop: {
      milestoneHalf: "过半啦！",
      milestoneSprint: "最后冲刺！",
      milestoneHits: "{n} 击！",
      maxLevel: "★满级！",
      combo: "连击 ×{n}",
    },
    speech: {
      recoveryNap: "嘘…让我睡会，马上就好",
      recoveryProgress: "嘘…让我睡会，充到 {threshold}⚡ 就起来（{shown}/{threshold}）",
      tokenMealNamed: "吃到 {name} 的 {amount} Token，{tail}",
      tokenMealAnon: "吃到 {amount} Token，{tail}",
      tokenMealExp: "经验 +{exp}！",
      tokenMealLevelUp: "经验 +{exp}，升级啦！🎉",
      maxLevelFuse: "⭐ 满级啦！凑一对同阶就能融合",
      statePlaceholder: "状态",
    },
    tutorial: {
      graduation:
        "🎉 第一只 2 阶诞生！图鉴 {collected}/{total}——敲键盘回精力、AI 的 Token 喂我涨经验、点我打工赚金币，晚上融合早上收蛋，明天见",
      collectEgg: "蛋发光啦，点它抱走新伙伴！",
      recovering: "我趴下充电啦～挂机 / 敲键盘 都在回精力⚡",
      capFull: "今日的爱点满💛 现在都是纯摸摸，明天再一起攒经验",
      fusionReady: "两只满级同阶凑齐！后院走到一起就能融合——可能出经典配方，也可能 AI 现场造新种",
      expDiffEnough: "还差 {clicks} 下就满级，点满它！",
      expDiffCapped: "只差 {clicks} 下！今日额度用完了，明天点满它",
      maxSwitch: "它满级⭐ 去后院换只没满的继续养，两只都满就能融合",
      buySecond: "金币够啦！去🏡后院商店买颗蛋，凑一对好融合",
      shopUpgrade: "升级商店，能买更高阶的蛋（越高阶越强也越贵）",
      release: "后院满了～放生一只或扩容，才能收下新蛋",
      pokedex: "🏡后院博物馆能看图鉴📖 收集越多、蛋池越丰富",
      steam: "🏡后院交易所能把伙伴放上 Steam 交易🤝 收下掉落的新蛋",
      capNear: "今天的爱快点满啦（还剩 {left} 下），留着明天继续～",
      menuWork: "点我打工，金币经验一起涨",
      firstEgg: "第一颗蛋在🏡后院孵着，去看看",
      noPetMenu: "点我打开菜单，去看孵化区",
      noPetTry: "点我一下试试！",
    },
    coach: {
      openMenu: "戳我一下，菜单蹦出来~",
      keysForEnergy: "键盘敲两下，给我充充电⚡",
      eggReadyTap: "蛋壳裂啦！谁在里面呀~",
      eggWaiting: "咕噜蛋还在睡…嘘~",
      rapidWork: "手速拉满，点我打工",
      goYardWalk: "后院逛逛去呗?",
      walkKeys: "A/D 或 ←→，带我遛个弯~",
      earnCoins: "钱包瘪了，再赚几枚呗?",
      goYardBuy: "后院小店淘颗蛋去?",
      goShop: "商店在那头，晃过去瞅瞅~",
      buyEggPair: "再来一颗，凑对更配~",
      goYardEgg: "后院那颗蛋在等我们呢~",
      eggReadyCollect: "裂壳咯，快看是啥宝宝~",
      goYardSwitch: "后院换个搭子带带?",
      approachOther: "那小家伙在那边，蹭过去~",
      tapFollow: "点「陪伴」，它就当跟班啦~",
      maxIt: "再戳 {n} 下就封顶啦!",
      goYardMax: "后院里把它喂满级~",
      findOther: "另一只藏哪了，溜过去找~",
      goYardFuse: "后院搞个大新闻——融合!",
      approachIt: "凑到它边上去~",
      makeFollow: "先拐它来当跟班~",
      earnFusionFee: "接着点击赚钱，赚够融合钱再说！",
      walkToIt: "它就在前头，晃过去~",
      tapFuse: "点✨融合，见证奇迹!",
      returnMain: "回主界面，慢慢戳满它~",
      returnMainCollect: "回主界面，瞅瞅融出了啥~",
      goYardCollectFusion: "去后院收，瞅瞅融出了啥~",
      tapFuseConfirm: "点「开始融合」，砰!",
      skip: "跳过教程",
    },
    welcome: {
      title: "🌅 欢迎回来！",
      aria: "欢迎回来",
      awayFor: "你离开了约 {duration}",
      durDay: "{n} 天",
      durDays: "{n} 天",
      durHour: "{n} 小时",
      durHours: "{n} 小时",
      durMinute: "{n} 分钟",
      durMinutes: "{n} 分钟",
      noPet: "还没有精灵",
      staminaFull: "精力已回满，攒好 {max} 击随时开工",
      staminaPartial: "精力恢复到 {current}/{max}",
      eggsReady: "{n} 颗蛋孵好了，快去收！",
      eggsIncubating: "{n} 颗蛋还在孵化中",
      eggsEmpty: "孵化区空着，去商店挑颗蛋吧",
      todayGoal: "今日目标：{goal}",
      goalFuse: "把两只满级伙伴融合，见证 2 阶诞生",
      goalBuyEgg: "再买一颗蛋，凑一对好融合",
      goalLevelUp: "精力攒满了，亲手点它升到满级",
      goalEarn: "点两下打工攒金币，升级后院多养几只",
      start: "开始今天",
      reportTitle: "📊 昨日战报 · {date}",
      reportTitlePrev: "📊 上次开工 · {date}",
      reportEmpty: "还没有昨日数据——从今天起我帮你记着。",
      rowTokens: "消耗 Token",
      rowTokensGen: "AI 真正生成",
      rowKeys: "键盘充能",
      rowClicks: "戳宠物",
      rowHatches: "孵化",
      rowFusions: "融合",
      rowCoins: "金币收入",
      unitTimes: "次",
      unitPets: "只",
      roastT0: [
        "{tokens} token？昨天你是把电脑当暖手宝开着的吧。咕噜鸭饿到开始啃自己的脚。",
        "这点量，AI 摸鱼都比你敬业。今日目标：先证明你还活着。",
        "昨天的产出约等于一个屏保。咕噜鸭盯着空数据看了一宿。",
      ],
      roastT1: [
        "就这？{tokens} 也好意思弹总结。咕噜鸭懒得抬头看你。",
        "昨天你和 AI 各划各的水，配合得像两条挂科的咸鱼。",
        "{tokens}，浅尝辄止。AI 打了个哈欠就替你把电脑关了。",
      ],
      roastT2: [
        "{tokens}，标准的「看起来很忙」。咕噜鸭给你打 6 分，多一分怕你骄傲。",
        "不高不低刚够温饱，昨天你把「平庸」两个字焊死在了键盘上。",
        "{tokens} 下肚，饿不死也撑不着——这就是你的舒适区，是吧。",
      ],
      roastT3: [
        "{tokens}！昨天把 AI 当牲口使，它已经在偷偷更新简历了。",
        "咕噜鸭被你喂到走不动路，一边打嗝一边怀疑自己进了黑心厂。",
        "{tokens} token 一天……你是不是把「适度」两个字给吃了。",
      ],
      roastT4: [
        "{tokens}……给模型上刑呢？显卡在哭、电表在转，只有你觉得自己很牛。",
        "键盘都快被你敲进火化场了。咕噜鸭建议你了解一下「下班」这个高端概念。",
        "{tokens} token。昨天你不是在写代码，是在给硅基生命喂过量。",
      ],
      roastT5: [
        "{tokens}。已经不是你在用 AI，是 AI 在 ICU 里给你续命。",
        "恭喜，昨晚 Anthropic 账单部门为你单独开了个会。咕噜鸭想辞职。",
        "{tokens} token 破十亿。地球感谢你贡献的余热，你的显卡在写遗书。",
      ],
      roastNightOwl: "凌晨三点你还在——昨天是在写代码，还是在和 bug 谈一场没结果的恋爱？",
      roastFusionManiac: "缝了 {fusions} 次，缝合怪之神。你对「适可而止」是不是有什么误解。",
      roastEggHoarder: "花钱买蛋买完晾着，你对孵化区的态度和对健身卡一模一样。",
      roastHandsOff: "全程 AI 007，你只负责动鼠标。这班上得比甲方还体面。",
      roastClickStorm: "{clicks} 下把宠物戳到怀疑鸭生，手指是充电宝供电的？",
      roastNothing: "昨天完美地什么都没干。咕噜鸭都替你尴尬。",
    },
    autostart: {
      title: "🚀 开机自启？",
      aria: "开机自动启动提示",
      body: "随电脑一起启动，更早陪你写代码。设置里可关。",
      accept: "开启",
      decline: "暂不",
    },
  },
  en: {
    stamina: "Stamina",
    fallbackPetName: "Sprite",
    newSpeciesName: "New species",
    mysterySpeciesName: "Mysterious new species",
    toast: {
      firstTokenMeal: "Tokens from AI hard work feed me EXP while I'm by your side 🍙✨ Click me to earn coins",
      keyDiscovery: "While I'm with you I catch and eat every key you type — energy ⚡ (counts only, never content; toggle in Settings)",
      capPetting: "Today's love is maxed 💛 clicks are pure head pats now",
      capCelebrate: "Love maxed for today! Save the rest for tomorrow 💛",
      barDone: "Full shift done! This bar: 🪙+{coins} ✨+{exp}",
      hatchAiNew: "🎉 A brand-new species is born: {name}!",
      hatchFallback: "AI design didn't finish — the recipe's classic {name} hatched instead!",
      hatchStandard: "{name} hatched!",
      eggToSlot: "Egg tucked into a hatchery slot",
      eggToInventory: "Hatchery slots full — egg stored in inventory",
      hatchStart: "Incubation started!",
      fusionRecipe: "Classic recipe triggered! High-tier egg is in the hatchery",
      fusionAi: "✨ AI is designing a new species — mystery egg is incubating",
      released: "Released — {refund} coins refunded",
      following: "It's tagging along with you now",
      hatcheryUpgraded: "Hatchery upgraded!",
      yardUpgraded: "Backyard upgraded!",
      shopUpgraded: "Shop upgraded! Higher-tier eggs unlocked",
      steamMarketFail: "Couldn't open the Steam market — try again later",
      steamSyncing: "Syncing with Steam…",
      steamImporting: "Importing pets from your Steam inventory…",
      steamImportDone: "Imported {imported} pet(s) 🎉",
      steamImportDonePartial: "Imported {imported}; {skipped} left unclaimed (yard full — expand it, then import again)",
      steamImportFull: "Yard is full — {skipped} pet(s) left unclaimed (expand the yard, then import again)",
      steamImportNone: "No new pets to import",
      tokenMaxed: "I'm already max level — tokens are just tasty snacks now~",
      wokeUp: "Great nap! Energy's back up ⚡",
      yardPetMaxed: "🌟 {name} hit max level! Ready to fuse",
      achievementUnlocked: "🏆 Achievement Unlocked: {name}",
      fusionDesignDoneFallback: "New species design complete!",
      fusionResolvedToast: "🎉 {msg}",
      fusionBlockedToast: "Fusion generation hit a snag: {msg}",
      steamRebindConfirm:
        "This save is bound to a different Steam account.\nConfirming will unbind it and resync against the current account's Steam inventory (local pets are kept).\nRebind now?",
      steamRebindDone: "Rebound to the current Steam account",
    },
    pop: {
      milestoneHalf: "Halfway!",
      milestoneSprint: "Final sprint!",
      milestoneHits: "{n} hits!",
      maxLevel: "★MAX!",
      combo: "Combo ×{n}",
    },
    speech: {
      recoveryNap: "Shh… let me nap, almost done",
      recoveryProgress: "Shh… napping till {threshold}⚡ ({shown}/{threshold})",
      tokenMealNamed: "Ate {amount} tokens from {name} — {tail}",
      tokenMealAnon: "Ate {amount} tokens — {tail}",
      tokenMealExp: "+{exp} EXP!",
      tokenMealLevelUp: "+{exp} EXP — level up! 🎉",
      maxLevelFuse: "⭐ Max level! Pair two same-tier pets to fuse",
      statePlaceholder: "state",
    },
    tutorial: {
      graduation:
        "🎉 First tier-2 born! Dex {collected}/{total} — type for energy, AI tokens feed me EXP, click me for coins, fuse at night, collect at dawn. See you tomorrow",
      collectEgg: "The egg's glowing — tap it to scoop up your new buddy!",
      recovering: "Recharging belly-down~ idling / typing both restore energy ⚡",
      capFull: "Today's love is maxed 💛 pure pets for now — more EXP tomorrow",
      fusionReady: "Two maxed same-tier pals! Walk them together in the yard to fuse — classic recipe, or the AI invents a new species",
      expDiffEnough: "Only {clicks} clicks to max — finish it!",
      expDiffCapped: "Just {clicks} left! Daily cap's used up — max it tomorrow",
      maxSwitch: "It's maxed ⭐ switch to an unmaxed one in the yard — two maxed pets can fuse",
      buySecond: "Coins ready! Buy an egg at the 🏡 backyard shop to make a pair",
      shopUpgrade: "Upgrade the shop to buy higher-tier eggs (stronger, pricier)",
      release: "The yard's full~ release one or expand it to collect the new egg",
      pokedex: "The 🏡 backyard museum shows your dex 📖 — collect more, richer egg pool",
      steam: "The 🏡 backyard exchange puts buddies up for Steam trade 🤝 claim dropped eggs",
      capNear: "Today's love is almost maxed ({left} left) — save some for tomorrow~",
      menuWork: "Click me to work — coins and EXP together",
      firstEgg: "Your first egg is incubating in the 🏡 backyard — go take a look",
      noPetMenu: "Click me to open the menu and visit the hatchery",
      noPetTry: "Give me a click!",
    },
    coach: {
      openMenu: "Boop me — menu pops out~",
      keysForEnergy: "Tap some keys, I need a recharge ⚡",
      eggReadyTap: "Shell's cracking! Who's inside~",
      eggWaiting: "Egg's still snoozing… shh~",
      rapidWork: "Fast clicks — tap me to work!",
      goYardWalk: "Fancy a backyard stroll?",
      walkKeys: "A/D or ◀▶ — take me for a walk~",
      earnCoins: "Wallet's thin — a few more coins?",
      goYardBuy: "Grab an egg at the backyard shop?",
      goShop: "Shop's over there — mosey on over~",
      buyEggPair: "One more egg makes a lovely pair~",
      goYardEgg: "An egg's waiting for us out back~",
      eggReadyCollect: "It's cracking — who's the newbie~",
      goYardSwitch: "Swap in a backyard buddy?",
      approachOther: "That lil' one's over there — sidle over~",
      tapFollow: "Tap Follow — it'll tag along~",
      maxIt: "{n} more boops to the cap!",
      goYardMax: "Feed it to max out back~",
      findOther: "Where's the other one? Go find it~",
      goYardFuse: "Time for the big backyard fusion!",
      approachIt: "Scoot up next to it~",
      makeFollow: "Get it to tag along first~",
      earnFusionFee: "Keep clicking for coins — earn the fusion fee first!",
      walkToIt: "It's right ahead — drift over~",
      tapFuse: "Tap ✨ Fuse — watch the magic!",
      returnMain: "Back to the main view, boop it to the cap~",
      returnMainCollect: "Back to the main view — see what we fused~",
      goYardCollectFusion: "Collect it out back — see what we fused~",
      tapFuseConfirm: "Tap Start Fusion — boom!",
      skip: "Skip tutorial",
    },
    welcome: {
      title: "🌅 Welcome back!",
      aria: "Welcome back",
      awayFor: "You were away for about {duration}",
      durDay: "{n} day",
      durDays: "{n} days",
      durHour: "{n} hour",
      durHours: "{n} hours",
      durMinute: "{n} minute",
      durMinutes: "{n} minutes",
      noPet: "No pets yet",
      staminaFull: "Energy full — {max} clicks banked and ready",
      staminaPartial: "Energy back to {current}/{max}",
      eggsReady: "{n} hatched and ready — go collect!",
      eggsIncubating: "{n} still incubating",
      eggsEmpty: "The hatchery's empty — pick an egg at the shop",
      todayGoal: "Today's goal: {goal}",
      goalFuse: "Fuse two maxed buddies and meet tier 2",
      goalBuyEgg: "Buy one more egg to make a fusion pair",
      goalLevelUp: "Energy's full — click it up to max level",
      goalEarn: "Click to earn coins and expand the yard",
      start: "Start the day",
      reportTitle: "📊 Yesterday's report · {date}",
      reportTitlePrev: "📊 Last session · {date}",
      reportEmpty: "No yesterday to report yet — I'll start keeping score today.",
      rowTokens: "Tokens burned",
      rowTokensGen: "actually generated",
      rowKeys: "Keys charged",
      rowClicks: "Pet pokes",
      rowHatches: "Hatched",
      rowFusions: "Fusions",
      rowCoins: "Coins earned",
      unitTimes: "",
      unitPets: "",
      roastT0: [
        "{tokens} tokens? Pretty sure you just left the PC on as a space heater. Guluduck started gnawing its own foot.",
        "That's it? The AI slacked off more professionally than you did. Today's goal: prove you're alive.",
        "Yesterday's output was basically a screensaver. Guluduck stared at the empty stats all night.",
      ],
      roastT1: [
        "This? {tokens} and you dare open a summary? Guluduck won't even look up.",
        "You and the AI both coasted — a matched pair of fish that failed the exam.",
        "{tokens}. A timid little dip. The AI yawned and shut the laptop for you.",
      ],
      roastT2: [
        "{tokens} — textbook 'looks busy'. Guluduck gives you a 6; any higher and you'd get cocky.",
        "Not high, not low, just fed. You welded the word 'mediocre' onto your keyboard.",
        "{tokens} down the hatch. Won't starve, won't stuff — your cozy little comfort zone, huh.",
      ],
      roastT3: [
        "{tokens}! You worked the AI like an ox — it's quietly updating its résumé.",
        "Guluduck's too stuffed to walk, burping and wondering if it joined a sweatshop.",
        "{tokens} in one day… did you swallow the word 'moderation' whole?",
      ],
      roastT4: [
        "{tokens}… torturing the model, are we? The GPU's crying, the meter's spinning, and only you feel great.",
        "You nearly hammered the keyboard into a crematorium. Guluduck suggests you look up this fancy term: 'clocking out'.",
        "{tokens}. You weren't coding yesterday, you were force-feeding silicon life.",
      ],
      roastT5: [
        "{tokens}. It's not you using the AI anymore — the AI's in the ICU keeping YOU alive.",
        "Congrats, Anthropic's billing team held a meeting just for you last night. Guluduck wants to resign.",
        "{tokens} tokens, past a billion. The planet thanks you for the waste heat; your GPU is writing its will.",
      ],
      roastNightOwl: "Still up at 3 a.m. — were you coding, or in a doomed love affair with a bug?",
      roastFusionManiac: "{fusions} fusions. Frankenstein of the year. Do you even know what 'enough' means?",
      roastEggHoarder: "Bought eggs, left them to rot. You treat the hatchery exactly like your gym membership.",
      roastHandsOff: "Full-time AI, and you just wiggled the mouse. Classiest shift ever clocked.",
      roastClickStorm: "{clicks} pokes — you poked that pet into an existential crisis. Are your fingers on a power bank?",
      roastNothing: "You did absolutely nothing yesterday. Flawlessly. Guluduck is embarrassed for you.",
    },
    autostart: {
      title: "🚀 Launch on startup?",
      aria: "Launch on startup prompt",
      body: "Gulugulu starts with your computer. Turn it off anytime in Settings.",
      accept: "Enable",
      decline: "Not now",
    },
  },
};
