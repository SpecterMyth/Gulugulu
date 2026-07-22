// 后院域词表:后院场景 + 商店/孵化屋/博物馆/图鉴/交易所/布告栏/融合台/庆祝动画
// 等 src/game/ 组件的全部 UI 词条。zh 值与原硬编码逐字一致(不改中文文案,只搬家);
// en 走轻松/AI 梗调性,按钮词条保持短(布局宽度受限)。
// 占位符用 fmt() 插值;物种/元素名一律由调用方经 speciesDisplayName/elementName 求出后传入。

import type { Language } from "./core";

export interface BackyardStrings {
  /** 通用:精力 tooltip(精力 {value}/{max}),后院/菜单栏共用。 */
  energyTitle: string;
  /** 通用:经验 tooltip(经验 {value}/{max}),打工经验条用。 */
  expTitle: string;
  /** 通用:点击打工 tooltip({name}(点击打工))。 */
  clickToWork: string;
  /** 通用:图鉴进度徽标(📖 图鉴 {collected}/{total}),博物馆弹板与公告板共用。 */
  dexProgress: string;

  /** 场景布景木牌(BackyardDecor)。 */
  decor: {
    glade: string;
    wilds: string;
    hatchery: string;
    shop: string;
    board: string;
    museum: string;
    market: string;
  };

  /** 后院主场景(BackyardScene):左下牌簇 / 升级木牌 / 主角与驻留伙伴 / 引导。 */
  scene: {
    soilTitle: string;
    soilSub: string;
    backBtn: string;
    backTitle: string;
    coinsTitle: string;
    yardMaxed: string;
    yardUpgrade: string;
    yardUpgradeSub: string;
    /** 后院升级庆典徽章：主标题（含新等级）与副标题（新容量）。 */
    yardUpgradedFx: string;
    yardUpgradedFxSub: string;
    petExhaustedTitle: string;
    tierAria: string;
    charRecoveringTitle: string;
    guideTitle: string;
    guideSub: string;
  };

  /** 融合条件未达成时的主角气泡提示。 */
  hint: {
    followFirst: string;
    sameTier: string;
    otherNotMax: string;
    yoursNotMax: string;
    needCoins: string;
    /** 物种信息缺失时的兜底称呼(zh:精灵)。 */
    genericName: string;
  };

  /** 进后院时的一次性红点点题（幽默指引；引导期让位）。 */
  entryGuide: {
    /** 可融合：{name}=待融合的同阶满级搭档物种名。 */
    fuse: string;
    /** 有蛋孵好待收。 */
    collectEgg: string;
    /** 金币够买蛋。 */
    buyEgg: string;
  };

  /** 商店弹出商品板(BackyardShopPopup)。 */
  shop: {
    prevTier: string;
    nextTier: string;
    header: string;
    eggName: string;
    eggTierSuffix: string;
    tooltipT1: string;
    tooltipTier: string;
    outcomeJoiner: string;
    upgrade: string;
    maxed: string;
  };

  /** 孵化区蛋坑(BackyardHatcheryPits)。 */
  hatchery: {
    unlockThisTitle: string;
    unlockPrevTitle: string;
    unlockPill: string;
    lockedPill: string;
    needCoinsUnlock: string;
    placeEggTitle: string;
    emptyPitTitle: string;
    placeEggPill: string;
    emptyPill: string;
    mysteryEggTitle: string;
    speciesEggTitle: string;
    designDone: string;
    genFailed: string;
    generating: string;
    queued: string;
    syncing: string;
    syncingTitle: string;
    collectTitle: string;
    collectPill: string;
    noFreePitTitle: string;
    placeToHatchTitle: string;
    pitsFull: string;
    waitingCount: string;
  };

  /** 图鉴馆弹板(BackyardMuseumPanel)。 */
  museum: {
    aiSuffix: string;
    moreTitle: string;
    empty: string;
    openBtn: string;
  };

  /** 交易市场弹板(BackyardMarketPanel)。 */
  market: {
    header: string;
    syncingBadge: string;
    localBadge: string;
    empty: string;
    connected: string;
    pendingMints: string;
    pendingReleases: string;
    unclaimed: string;
    cloudOn: string;
    cloudOff: string;
    disabled: string;
    offline: string;
    workshopLegal: string;
    workshopBtn: string;
    syncBtn: string;
    /** 导入我的宠物按钮。 */
    importBtn: string;
    /** 真实市价条目的悬浮说明。 */
    priceReal: string;
    /** 估价条目的悬浮说明(暂无市场挂单)。 */
    priceEst: string;
    /** 无真实挂单时行情列显示的文案。 */
    priceUnknown: string;
    openBtn: string;
  };

  /** 公告板(BackyardNoticeBoard)。 */
  notice: {
    totalTokens: string;
    /** 口径说明 tooltip：累计 Token 为 raw 总量，含每轮重复读取的上下文缓存；四分明细见「详情」。 */
    totalTokensTitle: string;
    /** 累计 Token 时间窗切换按钮（1d/1w/1m/all）。 */
    range: { d1: string; w1: string; m1: string; all: string };
    /** 「详情」按钮（打开四分明细页）。 */
    detailOpen: string;
    /** 详情页返回按钮。 */
    detailBack: string;
    /** 详情页标题。{range} */
    detailTitle: string;
    /** 四分明细行标签。 */
    parts: { input: string; cacheCreate: string; cacheRead: string; output: string };
    /** raw 总量减去已分类明细的差额（明细账本上线前的历史）。 */
    partsUnclassified: string;
    /** 合计行。 */
    partsTotal: string;
    /** 权重列的 tooltip（每类 token 折算经验的乘率）。 */
    weightHint: string;
    loveTitle: string;
    loveLabel: string;
    tokenLine: string;
    /** AI 连接（Claude/Codex 登录态）：两个并排按钮，标签自带 {name}+状态。 */
    agentConnect: string;
    agentConnecting: string;
    /** 尚未取到连接态时的占位（探测中）。 */
    agentChecking: string;
    /** 已连接按钮文案（{name} 已连接；点击进入断开二次确认）。 */
    agentConnected: string;
    /** 断开二次确认按钮文案。 */
    agentDisconnectConfirm: string;
    agentDisconnecting: string;
    agentNotInstalled: string;
    /** 未安装时的引导 tooltip（无法直接打开，提示先安装）。 */
    agentNotInstalledHint: string;
    /** 已连接按钮悬浮：{name} 已连接（{account}）。 */
    agentConnectedTitle: string;
    agentNeedsLoginTitle: string;
  };

  /** 靠近伙伴的动作牌(BackyardNearPetActions)。 */
  nearPet: {
    fuse: string;
    notEligible: string;
    follow: string;
    confirmRelease: string;
    release: string;
    lastPetTitle: string;
  };

  /** 图鉴全屏浮层 + 单元格/配方行(BackyardScene 浮层 + BackyardDex)。 */
  dex: {
    overlayTitle: string;
    progress: string;
    aiSuffix: string;
    closeTitle: string;
    baseSection: string;
    recipeSection: string;
    ownedCount: string;
    probTitle: string;
    unknownName: string;
    elementCount: string;
  };

  /** 图鉴物种详情弹窗 + 皮肤系统(SkinWorkshop.md)。 */
  dexDetail: {
    slotBase: string;
    slotFixed: string;
    slotAi: string;
    closeTitle: string;
    unknownName: string;
    unknownDesc: string;
    probLine: string;
    mysteryLine: string;
    statEver: string;
    statOwned: string;
    statBorn: string;
    statParents: string;
    statGenerator: string;
    skinsLabel: string;
    skinDefaultSub: string;
    skinLocalSub: string;
    skinBadgeDefault: string;
    skinBadgeLocal: string;
    skinBadgeFirst: string;
    skinBadgeShared: string;
    skinUse: string;
    skinUsing: string;
    skinApplied: string;
    skinCellBadge: string;
    skinsImportedNote: string;
    uploadersLabel: string;
    uploadersRefresh: string;
    uploadersLoading: string;
    uploadersError: string;
    uploadersRetry: string;
    uploadersEmpty: string;
    uploadersOffline: string;
    uploaderFirst: string;
    uploaderMe: string;
    uploaderDate: string;
    uploaderInstall: string;
    uploaderInstalledToast: string;
    uploaderSelfNote: string;
    shareMyPet: string;
    shareBtn: string;
    shareText: string;
    shareCopied: string;
    shareManualTitle: string;
    shareManualNote: string;
    shareLegalNote: string;
    publishBtn: string;
    publishDone: string;
    importBtn: string;
    importNeedSteam: string;
    importTitle: string;
    importPlaceholder: string;
    importCancel: string;
    importGo: string;
    importBusy: string;
    importOk: string;
    importDup: string;
    dialogClose: string;
  };

  /** AI 融合弹窗(FusionModal)。 */
  fusion: {
    ritual: string;
    checking: string;
    unavailableTitle: string;
    unavailableSub: string;
    unavailableNote: string;
    close: string;
    recheck: string;
    bySub: string;
    consumePrefix: string;
    consumeBold: string;
    consumeSuffix: string;
    resultNote: string;
    cancel: string;
    starting: string;
    start: string;
    errorTitle: string;
    errorNote: string;
    gotIt: string;
  };

  /** 菜单栏 HUD / 舞台蛋(GamePanels)。 */
  panels: {
    levelTitle: string;
    noPet: string;
    eggReady: string;
    eggHatching: string;
  };

  /** 每日爱心计(EnergyBar.DailyLoveMeter)。 */
  love: {
    title: string;
    tomorrow: string;
  };

  /** 庆典电影化揭晓(CelebrationCinematic)。 */
  celebration: {
    aiNewHero: string;
    nameQuoted: string;
    aiNewSub: string;
    aiReuse: string;
    fallbackLine: string;
    fallbackSub: string;
    recipeLine: string;
    recipeSub: string;
    aiPendingLine: string;
    aiPendingSub: string;
    standardSub: string;
    skipTitle: string;
  };
}

const zh: BackyardStrings = {
  energyTitle: "精力 {value}/{max}",
  expTitle: "经验 {value}/{max}",
  clickToWork: "{name}（点击打工）",
  dexProgress: "📖 图鉴 {collected}/{total}",

  decor: {
    glade: "🌲 林间空地",
    wilds: "🌾 旷野 →",
    hatchery: "🥚 孵化区",
    shop: "🛒 商店",
    board: "📊 公告板",
    museum: "📖 图鉴馆",
    market: "💰 交易市场",
  },

  scene: {
    soilTitle: "后 院",
    soilSub: "Lv{level} · {count}/{cap} 只",
    backBtn: "← 返回",
    backTitle: "回到宠物（Esc）",
    coinsTitle: "金币",
    yardMaxed: "后院已满级 · {cap} 只",
    yardUpgrade: "⬆ 升级后院 Lv{level}",
    yardUpgradeSub: "{cost} 🪙 → {cap} 只",
    yardUpgradedFx: "⬆ 后院升级 Lv{level}",
    yardUpgradedFxSub: "容量 {cap} 只",
    petExhaustedTitle: "趴着充电中…回到 10% 就起来",
    tierAria: "{tier} 阶",
    charRecoveringTitle: "精力恢复中…还可以带它散步",
    guideTitle: "🖱 点击场景走过去 · ⌨ ← → / A D 移动",
    guideSub: "走到商店、公告板或伙伴身边看看吧 · 拖动窗口边缘可以缩放后院",
  },

  hint: {
    followFirst: "先跟随一只精灵再来融合",
    sameTier: "需要两只同阶精灵",
    otherNotMax: "需对方满级 Lv{level}（{name}未满级）",
    yoursNotMax: "你的{name}还没满级",
    needCoins: "金币不足（融合需 {fee} 🪙）",
    genericName: "精灵",
  },

  entryGuide: {
    fuse: "那只「{name}」正冲你抛媚眼呢——过去把它俩捏一块儿融了吧！",
    collectEgg: "有颗蛋憋不住要破壳啦，快去孵化屋接生～",
    buyEgg: "钱包鼓鼓的，去店里挑颗蛋抱回来孵吧！",
  },

  shop: {
    prevTier: "低阶蛋",
    nextTier: "高阶蛋",
    header: "{tier} 阶蛋 · 页 {page}/{pages}",
    eggName: "{element}蛋",
    eggTierSuffix: " ·{tier}阶",
    tooltipT1: "{element}蛋 → {outcomes}",
    tooltipTier: "{tier} 阶{element}蛋 · 可能产出：{outcomes}（含元素越多越稀有）",
    outcomeJoiner: "、",
    upgrade: "升级商店 → 解锁 {tier} 阶蛋（{cost} 🪙）",
    maxed: "商店已满级 · {tier} 阶蛋封顶（5~6 阶融合专属）",
  },

  hatchery: {
    unlockThisTitle: "解锁这个蛋坑",
    unlockPrevTitle: "先解锁前一个蛋坑",
    unlockPill: "解锁 {cost} 🪙",
    lockedPill: "待解锁",
    needCoinsUnlock: "金币不足，解锁需要 {cost} 🪙",
    placeEggTitle: "放入一颗待孵化的蛋",
    emptyPitTitle: "空蛋坑",
    placeEggPill: "🥚 放蛋孵化",
    emptyPill: "空位",
    mysteryEggTitle: "神秘融合蛋：{provider} 正在设计新物种",
    speciesEggTitle: "{name}的蛋",
    designDone: "✨ 设计完成",
    genFailed: "💤 生成未完成",
    generating: "🤖 {provider} 设计中…",
    queued: "🤖 Claude/Codex 设计中…",
    syncing: "🔄 同步中",
    syncingTitle: "正在 Steam 上销毁融合材料、生成结果",
    collectTitle: "点击收取",
    collectPill: "✨ 点击收取",
    noFreePitTitle: "没有空蛋坑",
    placeToHatchTitle: "放入蛋坑孵化",
    pitsFull: "蛋坑都满了，先收取或解锁新坑",
    waitingCount: "待孵化 ×{count}",
  },

  museum: {
    aiSuffix: " · AI ×{count}",
    moreTitle: "打开图鉴查看全部",
    empty: "还没有收集到伙伴——孵化或融合精灵试试！",
    openBtn: "📖 打开图鉴",
  },

  market: {
    header: "💰 我的伙伴行情",
    syncingBadge: " ⏳同步中",
    localBadge: " 🏠本地",
    empty: "还没有伙伴可以估价",
    connected: "🟢 Steam 已连接",
    pendingMints: " · ⏳待发放 {count}",
    pendingReleases: " · 🕊️放生同步中 {count}(后台自动完成)",
    unclaimed: " · 📦待认领 {count}(扩建后院后同步领取)",
    cloudOn: " · ☁️云存档已开",
    cloudOff: " · ☁️云存档已关",
    disabled: "🔧 Steam 集成已关闭(本地调试模式)——全部玩法走本地逻辑",
    offline: "⚪ Steam 未连接——融合/二阶孵化/放生 Steam 精灵暂不可用",
    workshopLegal:
      "⚠️ 你的 AI 伙伴形象已上传创意工坊,但需先接受《Steam 创意工坊法律协议》—— 接受前形象对其他玩家不可见。",
    workshopBtn: "📜 去接受创意工坊协议",
    syncBtn: "🔄 立即同步",
    importBtn: "📥 导入我的宠物",
    priceReal: "Steam 社区市场实时价",
    priceEst: "估价（社区市场暂无挂单）",
    priceUnknown: "价格未知",
    openBtn: "🛒 进入 Steam 市场",
  },

  notice: {
    totalTokens: "累计 Token",
    totalTokensTitle: "raw 总量，含每轮重复读取的上下文缓存（cache_read）。点「详情」看输入/写缓存/读缓存/产出四分明细。",
    range: { d1: "今日", w1: "本周", m1: "本月", all: "全部" },
    detailOpen: "详情 ›",
    detailBack: "返回",
    detailTitle: "Token 明细 · {range}",
    parts: { input: "输入", cacheCreate: "写缓存", cacheRead: "读缓存", output: "产出" },
    partsUnclassified: "未分类",
    partsTotal: "合计",
    weightHint: "该类 token 折算陪伴宠经验的权重（喂养用）",
    loveTitle: "今日还能给的爱（点击额度）",
    loveLabel: "今日的爱",
    tokenLine: "🍙 Token→✨经验",
    agentConnect: "连接 {name}",
    agentConnecting: "{name} 登录中…",
    agentChecking: "{name} 探测中…",
    agentConnected: "{name} 已连接",
    agentDisconnectConfirm: "确认断开?",
    agentDisconnecting: "{name} 断开中…",
    agentNotInstalled: "{name} 未安装",
    agentNotInstalledHint: "未检测到 {name} CLI，请先安装并登录后再连接",
    agentConnectedTitle: "{name} 已连接（{account}）",
    agentNeedsLoginTitle: "{name} 未登录或登录已过期，点击打开终端登录",
  },

  nearPet: {
    fuse: "✨ 融合",
    notEligible: "条件未满足",
    follow: "🤝 陪伴",
    confirmRelease: "确认放生（返 {refund} 🪙）",
    release: "放生",
    lastPetTitle: "最后一只伙伴不能放生",
  },

  dex: {
    overlayTitle: "📖 图鉴",
    progress: "固定 {collected}/{total}",
    aiSuffix: " · AI 变种 ×{count}",
    closeTitle: "关闭（Esc）",
    baseSection: "基础物种 · 单元素（商店蛋直出）",
    recipeSection: "融合配方 · 元素并集（低阶在上 · 未收集黑影上是当前生成概率）",
    ownedCount: "曾获 ×{count}",
    probTitle: "当前融合生成概率",
    unknownName: "？？？",
    elementCount: "{count}元素",
  },

  dexDetail: {
    slotBase: "基础物种",
    slotFixed: "配方物种 · 0号",
    slotAi: "{index}号 AI 变种",
    closeTitle: "关闭（Esc）",
    unknownName: "？？？",
    unknownDesc: "收集后解锁图鉴描述",
    probLine: "当前融合生成概率 {p}",
    mysteryLine: "继续融合，有机会解锁这个 AI 变种槽位",
    statEver: "曾获 ×{count}",
    statOwned: "在养 ×{count}",
    statBorn: "诞生 {date}",
    statParents: "亲代：{a} × {b}",
    statGenerator: "由 {provider} 生成",
    skinsLabel: "外观皮肤",
    skinDefaultSub: "配方标准形态",
    skinLocalSub: "我的 AI 生成",
    skinBadgeDefault: "默认",
    skinBadgeLocal: "本地",
    skinBadgeFirst: "首发",
    skinBadgeShared: "分享",
    skinUse: "使用",
    skinUsing: "使用中",
    skinApplied: "已换上「{name}」外观",
    skinCellBadge: "皮肤×{count}",
    skinsImportedNote: "已导入 {count} 款皮肤 · 获得该变种后即可使用",
    uploadersLabel: "创意工坊 · 上传玩家",
    uploadersRefresh: "刷新",
    uploadersLoading: "正在获取创意工坊列表…",
    uploadersError: "获取失败，请稍后重试",
    uploadersRetry: "重试",
    uploadersEmpty: "还没有玩家分享过这只的皮肤，快去当第一个吧！",
    uploadersOffline: "连接 Steam 后可浏览其他玩家分享的皮肤",
    uploaderFirst: "首发",
    uploaderMe: "我",
    uploaderDate: "{date} 上传",
    uploaderInstall: "安装",
    uploaderInstalledToast: "皮肤已安装，点「使用」即可换上",
    uploaderSelfNote: "这是你上传的皮肤",
    shareMyPet: "分享我的宠物",
    shareBtn: "复制分享链接",
    shareText: "【咕噜咕噜】宠物分享：{name} {url} （复制整段文本，在游戏图鉴点「导入皮肤」粘贴即可）",
    shareCopied: "分享链接已复制，发给好友吧！",
    shareManualTitle: "分享我的皮肤",
    shareManualNote: "自动复制没成功，手动复制下面的文本发给好友：",
    shareLegalNote: "接受创意工坊协议后，其他玩家才能看到你的皮肤",
    publishBtn: "上传我的皮肤",
    publishDone: "已上传到创意工坊！现在可以复制分享文本了",
    importBtn: "导入皮肤",
    importNeedSteam: "需要连接 Steam 才能导入皮肤",
    importTitle: "导入好友分享的皮肤",
    importPlaceholder: "把好友发来的分享文本粘贴到这里…",
    importCancel: "取消",
    importGo: "导入",
    importBusy: "正在下载皮肤…",
    importOk: "皮肤「{name}」导入成功！",
    importDup: "这款皮肤之前已经导入过了",
    dialogClose: "关闭",
  },

  fusion: {
    ritual: "融合仪式",
    checking: "正在检测本地 Claude Code / Codex…",
    unavailableTitle: "⛔ 无法融合",
    unavailableSub: "融合仪式需要连接本地 Claude Code 或 Codex CLI",
    unavailableNote: "没有检测到可用的 CLI。请安装并在终端登录 Claude Code（优先）或 Codex 后再试。",
    close: "关闭",
    recheck: "重新检测",
    bySub: "由本地 {provider} 现场生成",
    consumePrefix: "两只精灵将被",
    consumeBold: "消耗",
    consumeSuffix: "，花费 {fee} 🪙。",
    resultNote: "结果可能触发经典配方，也可能由 AI 创造一只独一无二的新物种！",
    cancel: "取消",
    starting: "仪式进行中…",
    start: "✨ 开始融合",
    errorTitle: "😥 融合没有开始",
    errorNote: "两只精灵和金币都没有被消耗。",
    gotIt: "知道了",
  },

  panels: {
    levelTitle: "{name} 等级",
    noPet: "还没有精灵",
    eggReady: "孵化完成！点我收取",
    eggHatching: "孵化中 {countdown}",
  },

  love: {
    title: "今日点击 {clicks}/{cap}",
    tomorrow: "明天见",
  },

  celebration: {
    aiNewHero: "🎉 全新物种诞生",
    nameQuoted: "「{name}」",
    aiNewSub: "{tier} 阶 · 独一无二",
    aiReuse: "🧬 AI 变种登场",
    fallbackLine: "🧬 AI 设计未完成",
    fallbackSub: "孵出了这个配方的经典形象 ♪",
    recipeLine: "📜 触发经典配方",
    recipeSub: "「{name}」的蛋已入孵化区",
    aiPendingLine: "🤖 AI 正在设计全新物种",
    aiPendingSub: "神秘蛋已入孵化区 · 完成会通知你",
    standardSub: "破壳而出！",
    skipTitle: "点击跳过",
  },
};

const en: BackyardStrings = {
  energyTitle: "Energy {value}/{max}",
  expTitle: "EXP {value}/{max}",
  clickToWork: "{name} (click to work)",
  dexProgress: "📖 Dex {collected}/{total}",

  decor: {
    glade: "🌲 Forest Glade",
    wilds: "🌾 Wilds →",
    hatchery: "🥚 Hatchery",
    shop: "🛒 Shop",
    board: "📊 Notice Board",
    museum: "📖 Museum",
    market: "💰 Market",
  },

  scene: {
    soilTitle: "Backyard",
    soilSub: "Lv{level} · {count}/{cap} pets",
    backBtn: "← Back",
    backTitle: "Back to pet (Esc)",
    coinsTitle: "Coins",
    yardMaxed: "Yard maxed · {cap} pets",
    yardUpgrade: "⬆ Yard → Lv{level}",
    yardUpgradeSub: "{cost} 🪙 → {cap} pets",
    yardUpgradedFx: "⬆ Yard Upgraded · Lv{level}",
    yardUpgradedFxSub: "{cap} pets",
    petExhaustedTitle: "Recharging… back on its feet at 10%",
    tierAria: "Tier {tier}",
    charRecoveringTitle: "Recovering… walkies still allowed",
    guideTitle: "🖱 Click to walk there · ⌨ ← → / A D to move",
    guideSub: "Visit the shop, the board, or a buddy · Drag window edges to resize the yard",
  },

  hint: {
    followFirst: "Follow a pet first, then come fuse",
    sameTier: "Fusion needs two same-tier pets",
    otherNotMax: "Partner must be max Lv{level} ({name} isn't there yet)",
    yoursNotMax: "Your {name} isn't max level yet",
    needCoins: "Not enough coins (fusion costs {fee} 🪙)",
    genericName: "pet",
  },

  entryGuide: {
    fuse: "That {name} keeps batting its eyes at you — go smoosh the two together!",
    collectEgg: "An egg's about to pop — hustle to the hatchery and catch it!",
    buyEgg: "Pockets jingling — grab an egg from the shop and get hatching!",
  },

  shop: {
    prevTier: "Lower tier eggs",
    nextTier: "Higher tier eggs",
    header: "T{tier} Eggs · {page}/{pages}",
    eggName: "{element} Egg",
    eggTierSuffix: " · T{tier}",
    tooltipT1: "{element} Egg → {outcomes}",
    tooltipTier: "T{tier} {element} Egg · may hatch: {outcomes} (more elements = rarer)",
    outcomeJoiner: ", ",
    upgrade: "Upgrade shop → T{tier} eggs ({cost} 🪙)",
    maxed: "Shop maxed · tops out at T{tier} eggs (T5–6 are fusion-only)",
  },

  hatchery: {
    unlockThisTitle: "Unlock this pit",
    unlockPrevTitle: "Unlock the previous pit first",
    unlockPill: "Unlock {cost} 🪙",
    lockedPill: "Locked",
    needCoinsUnlock: "Not enough coins — unlocking costs {cost} 🪙",
    placeEggTitle: "Place an egg to incubate",
    emptyPitTitle: "Empty pit",
    placeEggPill: "🥚 Place egg",
    emptyPill: "Empty",
    mysteryEggTitle: "Mystery fusion egg: {provider} is designing a new species",
    speciesEggTitle: "{name} egg",
    designDone: "✨ Design ready",
    genFailed: "💤 Gen unfinished",
    generating: "🤖 {provider} designing…",
    queued: "🤖 Claude/Codex designing…",
    syncing: "🔄 syncing",
    syncingTitle: "Burning materials & minting on Steam",
    collectTitle: "Click to collect",
    collectPill: "✨ Collect!",
    noFreePitTitle: "No free pits",
    placeToHatchTitle: "Pop it into a pit to hatch",
    pitsFull: "All pits are full — collect or unlock one first",
    waitingCount: "Waiting ×{count}",
  },

  museum: {
    aiSuffix: " · AI ×{count}",
    moreTitle: "Open the dex to see them all",
    empty: "No buddies collected yet — try hatching or fusing!",
    openBtn: "📖 Open Dex",
  },

  market: {
    header: "💰 My Buddy Prices",
    syncingBadge: " ⏳ syncing",
    localBadge: " 🏠 local",
    empty: "No buddies to appraise yet",
    connected: "🟢 Steam connected",
    pendingMints: " · ⏳ {count} pending",
    pendingReleases: " · 🕊️ {count} release(s) syncing (finishes in the background)",
    unclaimed: " · 📦 {count} unclaimed (expand the yard, then sync)",
    cloudOn: " · ☁️ Cloud save on",
    cloudOff: " · ☁️ Cloud save off",
    disabled: "🔧 Steam integration off (local debug mode) — everything runs locally",
    offline: "⚪ Steam offline — fusion, tier-2 hatching, and releasing Steam-minted pets are unavailable",
    workshopLegal:
      "⚠️ Your AI buddy's art is on the Workshop, but you must accept the Steam Workshop Legal Agreement first — until then, other players can't see it.",
    workshopBtn: "📜 Accept Workshop terms",
    syncBtn: "🔄 Sync now",
    importBtn: "📥 Import my pets",
    priceReal: "Live Steam Community Market price",
    priceEst: "Estimate (no market listing yet)",
    priceUnknown: "Price unknown",
    openBtn: "🛒 Steam Market",
  },

  notice: {
    totalTokens: "Total Tokens",
    totalTokensTitle: "Raw total, including context re-read from cache each turn (cache_read). Tap Details for the input / cache-write / cache-read / output split.",
    range: { d1: "1d", w1: "1w", m1: "1m", all: "All" },
    detailOpen: "Details ›",
    detailBack: "Back",
    detailTitle: "Token detail · {range}",
    parts: { input: "Input", cacheCreate: "Cache write", cacheRead: "Cache read", output: "Output" },
    partsUnclassified: "Unclassified",
    partsTotal: "Total",
    weightHint: "Feed weight — how much EXP this token type grants your companion",
    loveTitle: "Love left today (click quota)",
    loveLabel: "Today's love",
    tokenLine: "🍙 Tokens→✨EXP",
    agentConnect: "Connect {name}",
    agentConnecting: "{name} signing in…",
    agentChecking: "{name} checking…",
    agentConnected: "{name} connected",
    agentDisconnectConfirm: "Confirm?",
    agentDisconnecting: "{name} signing out…",
    agentNotInstalled: "{name} not installed",
    agentNotInstalledHint: "No {name} CLI detected — install it and sign in, then connect",
    agentConnectedTitle: "{name} connected ({account})",
    agentNeedsLoginTitle: "{name} not signed in or session expired — click to open a terminal and sign in",
  },

  nearPet: {
    fuse: "✨ Fuse",
    notEligible: "not eligible",
    follow: "🤝 Follow",
    confirmRelease: "Sure? +{refund} 🪙",
    release: "Release",
    lastPetTitle: "Can't release your last buddy",
  },

  dex: {
    overlayTitle: "📖 Dex",
    progress: "Fixed {collected}/{total}",
    aiSuffix: " · AI variants ×{count}",
    closeTitle: "Close (Esc)",
    baseSection: "Base species · single element (straight from shop eggs)",
    recipeSection: "Fusion recipes · element unions (low tiers first · % on a silhouette = current odds)",
    ownedCount: "Owned ×{count}",
    probTitle: "Current fusion odds",
    unknownName: "???",
    elementCount: "{count} elems",
  },

  dexDetail: {
    slotBase: "Base species",
    slotFixed: "Recipe species · slot 0",
    slotAi: "AI variant #{index}",
    closeTitle: "Close (Esc)",
    unknownName: "???",
    unknownDesc: "Collect it to unlock the dex entry",
    probLine: "Current fusion odds {p}",
    mysteryLine: "Keep fusing for a chance to unlock this AI variant slot",
    statEver: "Owned ×{count}",
    statOwned: "In yard ×{count}",
    statBorn: "Born {date}",
    statParents: "Parents: {a} × {b}",
    statGenerator: "Generated by {provider}",
    skinsLabel: "Skins",
    skinDefaultSub: "Standard recipe form",
    skinLocalSub: "My AI creation",
    skinBadgeDefault: "Default",
    skinBadgeLocal: "Local",
    skinBadgeFirst: "First",
    skinBadgeShared: "Shared",
    skinUse: "Use",
    skinUsing: "In use",
    skinApplied: "Now wearing \"{name}\"",
    skinCellBadge: "Skins ×{count}",
    skinsImportedNote: "{count} skins imported · usable once you obtain this variant",
    uploadersLabel: "Workshop · Uploaders",
    uploadersRefresh: "Refresh",
    uploadersLoading: "Fetching Workshop list…",
    uploadersError: "Fetch failed — try again later",
    uploadersRetry: "Retry",
    uploadersEmpty: "No one has shared a skin for this one yet — be the first!",
    uploadersOffline: "Connect Steam to browse skins shared by other players",
    uploaderFirst: "First",
    uploaderMe: "Me",
    uploaderDate: "Uploaded {date}",
    uploaderInstall: "Install",
    uploaderInstalledToast: "Skin installed — hit \"Use\" to wear it",
    uploaderSelfNote: "This is your upload",
    shareMyPet: "Share my pet",
    shareBtn: "Copy share link",
    shareText: "[Gulugulu] Pet share: {name} {url} (copy the whole text, then hit \"Import skin\" in the Dex to paste)",
    shareCopied: "Share link copied — send it to a friend!",
    shareManualTitle: "Share my skin",
    shareManualNote: "Auto-copy failed — copy the text below manually:",
    shareLegalNote: "Accept the Workshop legal agreement so others can see your skin",
    publishBtn: "Upload my skin",
    publishDone: "Uploaded to the Workshop! You can copy the share text now",
    importBtn: "Import skin",
    importNeedSteam: "Connect Steam to import skins",
    importTitle: "Import a friend's skin",
    importPlaceholder: "Paste the share text from your friend here…",
    importCancel: "Cancel",
    importGo: "Import",
    importBusy: "Downloading skin…",
    importOk: "Skin \"{name}\" imported!",
    importDup: "That skin was already imported",
    dialogClose: "Close",
  },

  fusion: {
    ritual: "Fusion Ritual",
    checking: "Detecting local Claude Code / Codex…",
    unavailableTitle: "⛔ Can't Fuse",
    unavailableSub: "The ritual needs a local Claude Code or Codex CLI",
    unavailableNote: "No usable CLI found. Install and sign in to Claude Code (preferred) or Codex in a terminal, then retry.",
    close: "Close",
    recheck: "Re-check",
    bySub: "Generated live by your local {provider}",
    consumePrefix: "Both pets will be ",
    consumeBold: "consumed",
    consumeSuffix: ", costing {fee} 🪙.",
    resultNote: "You might hit a classic recipe — or the AI invents a one-of-a-kind new species!",
    cancel: "Cancel",
    starting: "Ritual underway…",
    start: "✨ Fuse!",
    errorTitle: "😥 Fusion Didn't Start",
    errorNote: "No pets or coins were consumed.",
    gotIt: "Got it",
  },

  panels: {
    levelTitle: "{name} level",
    noPet: "No pets yet",
    eggReady: "Hatched! Click to collect",
    eggHatching: "Hatching {countdown}",
  },

  love: {
    title: "Today's clicks {clicks}/{cap}",
    tomorrow: "Tomorrow!",
  },

  celebration: {
    aiNewHero: "🎉 A New Species Is Born",
    nameQuoted: "“{name}”",
    aiNewSub: "Tier {tier} · one of a kind",
    aiReuse: "🧬 AI Variant Appears",
    fallbackLine: "🧬 AI Design Unfinished",
    fallbackSub: "The recipe's classic form hatched instead ♪",
    recipeLine: "📜 Classic Recipe!",
    recipeSub: "A “{name}” egg is in the hatchery",
    aiPendingLine: "🤖 AI Is Designing a New Species",
    aiPendingSub: "Mystery egg placed · you'll be pinged when it's done",
    standardSub: "It hatched!",
    skipTitle: "Click to skip",
  },
};

export const BACKYARD: Record<Language, BackyardStrings> = { zh, en };
