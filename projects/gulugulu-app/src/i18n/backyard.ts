// 后院域词表:后院场景 + 商店/孵化屋/博物馆/图鉴/交易所/布告栏/融合台/庆祝动画
// 等 src/game/ 组件的全部 UI 词条。zh 值与原硬编码逐字一致(不改中文文案,只搬家);
// en 走轻松/AI 梗调性,按钮词条保持短(布局宽度受限)。
// 占位符用 fmt() 插值;物种/元素名一律由调用方经 speciesDisplayName/elementName 求出后传入。

import { createLanguageMap, type DeepPartial, type Language } from "./core";
import { generatedDomainLocales } from "./generatedLocales";

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
    trainingHall: string;
  };

  /** 训练馆弹板 + 训练弹窗(BackyardTrainingPanel / TrainingModal)。 */
  training: {
    title: string;
    /** 未建造时的招徕文案与建造按钮。 */
    lockedHint: string;
    buildBtn: string;
    hallLevel: string;
    /** 馆等级说明：当前可做到第几级升阶。 */
    hallUnlocks: string;
    hallMaxed: string;
    upgradeHallBtn: string;
    slots: string;
    expandSlotsBtn: string;
    slotsMaxed: string;
    idleSlot: string;
    training: string;
    remaining: string;
    collectBtn: string;
    openBtn: string;
    materialsTitle: string;
    noMaterials: string;
    /** 弹窗：选宠与确认。 */
    pickTitle: string;
    pickHint: string;
    noEligible: string;
    tierUp: string;
    needMaxLevel: string;
    needHallLevel: string;
    atTopTier: string;
    inTraining: string;
    costCoins: string;
    costTime: string;
    useUniversal: string;
    universalShort: string;
    startBtn: string;
    cancelBtn: string;
    /** 材料名（含万能券）。 */
    materialNames: Record<string, string>;
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
  };

  /** 融合条件未达成时的主角气泡提示。 */
  hint: {
    followFirst: string;
    sameTier: string;
    otherNotMax: string;
    yoursNotMax: string;
    needCoins: string;
    steamReconciling: string;
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
    queuedProvider: string;
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
    todayCoins: string;
    todayWorkBest: string;
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

/**
 * Reviewed short labels used directly on the backyard scene. Short sign and
 * button copy is easy for offline translation to collapse into punctuation or
 * leave as near-English, so these labels stay deterministic in every locale.
 */
export const BACKYARD_LABEL_LOCALES = {
  "zh-Hant": {
    dexProgress: "📖 收藏 {collected}/{total}", museum: { moreTitle: "打開收藏查看全部", openBtn: "📖 打開收藏" }, dex: { overlayTitle: "📖 收藏", progress: "固定配方 {collected}/{total}" }, dexDetail: { unknownDesc: "收集後解鎖收藏資訊", shareText: "【Gulugulu】寵物分享：{name} {url}（複製整段文字，在「收藏」中點「匯入造型」貼上即可）" },
    training: { hallUnlocks: "可訓練至 {tier} 階", hallMaxed: "已滿級 · 可訓練至 6 階", materialsTitle: "升階材料", pickTitle: "選擇要升階的夥伴", pickHint: "保留夥伴與等級，只提升階級。", noEligible: "沒有滿級夥伴可升階", atTopTier: "已達最高階" },
    decor: { glade: "🌲 森林空地", wilds: "🌾 荒野 →", hatchery: "🥚 孵化場", shop: "🛒 商店", board: "公告欄", museum: "📖 博物館", market: "💰 市場", trainingHall: "🏋️ 訓練館" },
    scene: { soilTitle: "後院", backBtn: "← 返回", yardUpgrade: "⬆ 升級後院 → Lv{level}", yardUpgradeSub: "{cost} 🪙 → {cap} 隻寵物" },
    hatchery: { unlockThisTitle: "解鎖這個蛋坑", unlockPrevTitle: "先解鎖前一個蛋坑", unlockPill: "解鎖 {cost} 🪙", lockedPill: "待解鎖", needCoinsUnlock: "金幣不足，解鎖需要 {cost} 🪙", collectPill: "✨ 收取！" }, nearPet: { fuse: "融合", follow: "跟隨", release: "放生" },
  },
  ja: {
    dexProgress: "📖 コレクション {collected}/{total}", museum: { moreTitle: "コレクションを開いて全部見る", openBtn: "📖 コレクションを開く" }, dex: { overlayTitle: "📖 コレクション", progress: "固定レシピ {collected}/{total}" }, dexDetail: { unknownDesc: "集めるとコレクション情報が解放されます", shareText: "【Gulugulu】ペット共有：{name} {url}（全文をコピーし、コレクションで「スキンをインポート」を押して貼り付けてください）" },
    training: { hallUnlocks: "ランク{tier}まで訓練可能", hallMaxed: "最大強化済み · ランク6まで訓練可能", materialsTitle: "ランクアップ素材", pickTitle: "ランクアップする仲間を選ぶ", pickHint: "仲間とレベルはそのまま、ランクだけ上がります。", noEligible: "ランクアップできる最大レベルの仲間はいません", atTopTier: "最高ランクです" },
    decor: { glade: "🌲 森の空き地", wilds: "🌾 荒野 →", hatchery: "🥚 孵化場", shop: "🛒 ショップ", board: "掲示板", museum: "📖 博物館", market: "💰 マーケット", trainingHall: "🏋️ トレーニングホール" },
    scene: { soilTitle: "裏庭", backBtn: "← 戻る", yardUpgrade: "⬆ 裏庭を Lv{level} に拡張", yardUpgradeSub: "{cost} 🪙 → ペット {cap} 匹" },
    hatchery: { unlockThisTitle: "この卵穴を開放", unlockPrevTitle: "先に前の卵穴を開放", unlockPill: "開放 {cost} 🪙", lockedPill: "未開放", needCoinsUnlock: "コインが足りません。開放には {cost} 🪙 必要です", collectPill: "✨ 受け取る！" }, nearPet: { fuse: "合成", follow: "ついていく", release: "放す" },
  },
  ko: {
    dexProgress: "📖 컬렉션 {collected}/{total}", museum: { moreTitle: "컬렉션을 열어 모두 보기", openBtn: "📖 컬렉션 열기" }, dex: { overlayTitle: "📖 컬렉션", progress: "고정 레시피 {collected}/{total}" }, dexDetail: { unknownDesc: "수집하면 컬렉션 정보가 해금됩니다", shareText: "【Gulugulu】펫 공유: {name} {url} (전체 문장을 복사한 뒤 컬렉션에서 ‘스킨 가져오기’를 눌러 붙여 넣으세요)" },
    training: { hallUnlocks: "{tier}등급까지 훈련 가능", hallMaxed: "최대 업그레이드 · 6등급까지 훈련 가능", materialsTitle: "등급 상승 재료", pickTitle: "등급을 올릴 친구 선택", pickHint: "친구와 레벨은 유지하고 등급만 올립니다.", noEligible: "등급을 올릴 만렙 친구가 없습니다", atTopTier: "최고 등급입니다" },
    decor: { glade: "🌲 숲속 공터", wilds: "🌾 황야 →", hatchery: "🥚 부화장", shop: "🛒 상점", board: "게시판", museum: "📖 박물관", market: "💰 시장", trainingHall: "🏋️ 훈련장" },
    scene: { soilTitle: "뒤뜰", backBtn: "← 뒤로", yardUpgrade: "⬆ 뒤뜰 확장 → Lv{level}", yardUpgradeSub: "{cost} 🪙 → 펫 {cap}마리" },
    hatchery: { unlockThisTitle: "이 알 구덩이 잠금 해제", unlockPrevTitle: "먼저 앞 알 구덩이 잠금 해제", unlockPill: "잠금 해제 {cost} 🪙", lockedPill: "잠김", needCoinsUnlock: "코인이 부족합니다. 잠금 해제에 {cost} 🪙 필요합니다", collectPill: "✨ 받기!" }, nearPet: { fuse: "융합", follow: "따라가기", release: "놓아주기" },
  },
  fr: {
    dexProgress: "📖 Collection {collected}/{total}", museum: { moreTitle: "Ouvrir la collection pour tout voir", openBtn: "📖 Ouvrir la collection" }, dex: { overlayTitle: "📖 Collection", progress: "Recettes fixes {collected}/{total}" }, dexDetail: { unknownDesc: "Collectionne-le pour débloquer sa fiche", shareText: "[Gulugulu] Partage de compagnon : {name} {url} (copie tout le texte, puis utilise « Importer un skin » dans la collection)" },
    training: { hallUnlocks: "Entraîne jusqu’au rang {tier}", hallMaxed: "Amélioration max. · jusqu’au rang 6", materialsTitle: "Matériaux de promotion", pickTitle: "Choisis un compagnon à promouvoir", pickHint: "Le compagnon et son niveau restent ; seul son rang augmente.", noEligible: "Aucun compagnon au niveau max prêt à monter de rang", atTopTier: "Déjà au rang max" },
    decor: { glade: "🌲 Clairière", wilds: "🌾 Terres sauvages →", hatchery: "🥚 Couveuse", shop: "🛒 Boutique", board: "Panneau d’affichage", museum: "📖 Musée", market: "💰 Marché", trainingHall: "🏋️ Salle d’entraînement" },
    scene: { soilTitle: "Cour arrière", backBtn: "← Retour", yardUpgrade: "⬆ Améliorer la cour → niv. {level}", yardUpgradeSub: "{cost} 🪙 → {cap} animaux" },
    hatchery: { unlockThisTitle: "Déverrouiller ce nid", unlockPrevTitle: "Déverrouillez d’abord le nid précédent", unlockPill: "Déverrouiller {cost} 🪙", lockedPill: "À déverrouiller", needCoinsUnlock: "Pas assez de pièces : il faut {cost} 🪙 pour le déverrouiller", collectPill: "✨ Récupérer !" }, nearPet: { fuse: "Fusionner", follow: "Suivre", release: "Relâcher" },
  },
  de: {
    dexProgress: "📖 Sammlung {collected}/{total}", museum: { moreTitle: "Sammlung öffnen und alle ansehen", openBtn: "📖 Sammlung öffnen" }, dex: { overlayTitle: "📖 Sammlung", progress: "Feste Rezepte {collected}/{total}" }, dexDetail: { unknownDesc: "Sammle es, um den Sammlungseintrag freizuschalten", shareText: "[Gulugulu] Begleiter teilen: {name} {url} (kopiere den ganzen Text und wähle in der Sammlung „Skin importieren“)" },
    training: { hallUnlocks: "Training bis Rang {tier}", hallMaxed: "Voll ausgebaut · Training bis Rang 6", materialsTitle: "Aufstiegsmaterial", pickTitle: "Wähle einen Gefährten für den Aufstieg", pickHint: "Gefährte und Level bleiben; nur der Rang steigt.", noEligible: "Kein Gefährte auf Maximallevel ist aufstiegsbereit", atTopTier: "Bereits auf höchstem Rang" },
    decor: { glade: "🌲 Waldlichtung", wilds: "🌾 Wildnis →", hatchery: "🥚 Brutstation", shop: "🛒 Laden", board: "Schwarzes Brett", museum: "📖 Museum", market: "💰 Markt", trainingHall: "🏋️ Trainingshalle" },
    scene: { soilTitle: "Hinterhof", backBtn: "← Zurück", yardUpgrade: "⬆ Hof ausbauen → Lv.{level}", yardUpgradeSub: "{cost} 🪙 → {cap} Tiere" },
    hatchery: { unlockThisTitle: "Diese Brutgrube freischalten", unlockPrevTitle: "Zuerst die vorherige Brutgrube freischalten", unlockPill: "Freischalten {cost} 🪙", lockedPill: "Nicht freigeschaltet", needCoinsUnlock: "Nicht genug Münzen – zum Freischalten werden {cost} 🪙 benötigt", collectPill: "✨ Einsammeln!" }, nearPet: { fuse: "Verschmelzen", follow: "Folgen", release: "Freilassen" },
  },
  "es-ES": {
    dexProgress: "📖 Colección {collected}/{total}", museum: { moreTitle: "Abre la colección para verlos a todos", openBtn: "📖 Abrir la colección" }, dex: { overlayTitle: "📖 Colección", progress: "Recetas fijas {collected}/{total}" }, dexDetail: { unknownDesc: "Consíguelo para desbloquear su ficha en la colección", shareText: "[Gulugulu] Compartir mascota: {name} {url} (copia el texto completo y pulsa «Importar aspecto» en la colección para pegarlo)" },
    training: { hallUnlocks: "Entrena hasta el rango {tier}", hallMaxed: "Mejora máxima · hasta rango 6", materialsTitle: "Materiales de ascenso", pickTitle: "Elige un compañero para ascender", pickHint: "Conserva el compañero y su nivel; solo sube su rango.", noEligible: "No hay compañeros de nivel máximo listos para ascender", atTopTier: "Ya está en el rango máximo" },
    decor: { glade: "🌲 Claro del bosque", wilds: "🌾 Tierras salvajes →", hatchery: "🥚 Incubadora", shop: "🛒 Tienda", board: "Tablón de anuncios", museum: "📖 Museo", market: "💰 Mercado", trainingHall: "🏋️ Sala de entrenamiento" },
    scene: { soilTitle: "Patio", backBtn: "← Volver", yardUpgrade: "⬆ Mejorar patio → niv. {level}", yardUpgradeSub: "{cost} 🪙 → {cap} mascotas" },
    hatchery: { unlockThisTitle: "Desbloquear este nido", unlockPrevTitle: "Desbloquea primero el nido anterior", unlockPill: "Desbloquear {cost} 🪙", lockedPill: "Por desbloquear", needCoinsUnlock: "No tienes suficientes monedas: necesitas {cost} 🪙 para desbloquearlo", collectPill: "✨ Recoger!" }, nearPet: { fuse: "Fusionar", follow: "Seguir", release: "Liberar" },
  },
  "es-419": {
    dexProgress: "📖 Colección {collected}/{total}", museum: { moreTitle: "Abre la colección para verlos a todos", openBtn: "📖 Abrir la colección" }, dex: { overlayTitle: "📖 Colección", progress: "Recetas fijas {collected}/{total}" }, dexDetail: { unknownDesc: "Consíguelo para desbloquear su ficha en la colección", shareText: "[Gulugulu] Compartir mascota: {name} {url} (copia todo el texto y toca «Importar aspecto» en la colección para pegarlo)" },
    training: { hallUnlocks: "Entrena hasta el rango {tier}", hallMaxed: "Mejora máxima · hasta rango 6", materialsTitle: "Materiales de ascenso", pickTitle: "Elige un compañero para ascender", pickHint: "Conserva el compañero y su nivel; solo sube su rango.", noEligible: "No hay compañeros de nivel máximo listos para ascender", atTopTier: "Ya está en el rango máximo" },
    decor: { glade: "🌲 Claro del bosque", wilds: "🌾 Tierras salvajes →", hatchery: "🥚 Incubadora", shop: "🛒 Tienda", board: "Tablón de anuncios", museum: "📖 Museo", market: "💰 Mercado", trainingHall: "🏋️ Sala de entrenamiento" },
    scene: { soilTitle: "Patio", backBtn: "← Volver", yardUpgrade: "⬆ Mejorar patio → niv. {level}", yardUpgradeSub: "{cost} 🪙 → {cap} mascotas" },
    hatchery: { unlockThisTitle: "Desbloquear este nido", unlockPrevTitle: "Desbloquea primero el nido anterior", unlockPill: "Desbloquear {cost} 🪙", lockedPill: "Por desbloquear", needCoinsUnlock: "No tienes suficientes monedas: necesitas {cost} 🪙 para desbloquearlo", collectPill: "✨ Recoger!" }, nearPet: { fuse: "Fusionar", follow: "Seguir", release: "Liberar" },
  },
  "pt-BR": {
    dexProgress: "📖 Coleção {collected}/{total}", museum: { moreTitle: "Abra a coleção para ver todos", openBtn: "📖 Abrir coleção" }, dex: { overlayTitle: "📖 Coleção", progress: "Receitas fixas {collected}/{total}" }, dexDetail: { unknownDesc: "Colete para desbloquear a ficha na coleção", shareText: "[Gulugulu] Compartilhar pet: {name} {url} (copie o texto inteiro e toque em “Importar visual” na coleção para colar)" },
    training: { hallUnlocks: "Treina até o grau {tier}", hallMaxed: "Melhoria máxima · até o grau 6", materialsTitle: "Materiais de promoção", pickTitle: "Escolha um amigo para promover", pickHint: "O amigo e o nível ficam; só o grau aumenta.", noEligible: "Nenhum amigo no nível máximo está pronto para promoção", atTopTier: "Já está no grau máximo" },
    decor: { glade: "🌲 Clareira", wilds: "🌾 Terras selvagens →", hatchery: "🥚 Incubadora", shop: "🛒 Loja", board: "Quadro de avisos", museum: "📖 Museu", market: "💰 Mercado", trainingHall: "🏋️ Sala de treino" },
    scene: { soilTitle: "Quintal", backBtn: "← Voltar", yardUpgrade: "⬆ Melhorar quintal → Nv.{level}", yardUpgradeSub: "{cost} 🪙 → {cap} mascotes" },
    hatchery: { unlockThisTitle: "Desbloquear este ninho", unlockPrevTitle: "Desbloqueie primeiro o ninho anterior", unlockPill: "Desbloquear {cost} 🪙", lockedPill: "A desbloquear", needCoinsUnlock: "Moedas insuficientes: são necessárias {cost} 🪙 para desbloquear", collectPill: "✨ Coletar!" }, nearPet: { fuse: "Fundir", follow: "Seguir", release: "Soltar" },
  },
  "pt-PT": {
    dexProgress: "📖 Coleção {collected}/{total}", museum: { moreTitle: "Abre a coleção para veres todos", openBtn: "📖 Abrir coleção" }, dex: { overlayTitle: "📖 Coleção", progress: "Receitas fixas {collected}/{total}" }, dexDetail: { unknownDesc: "Recolhe-o para desbloquear a ficha na coleção", shareText: "[Gulugulu] Partilhar animal: {name} {url} (copia o texto completo e prime «Importar visual» na coleção para colar)" },
    training: { hallUnlocks: "Treina até ao grau {tier}", hallMaxed: "Melhoria máxima · até ao grau 6", materialsTitle: "Materiais de promoção", pickTitle: "Escolhe um amigo para promover", pickHint: "O amigo e o nível mantêm-se; só o grau aumenta.", noEligible: "Nenhum amigo no nível máximo está pronto para promoção", atTopTier: "Já está no grau máximo" },
    decor: { glade: "🌲 Clareira", wilds: "🌾 Terras selvagens →", hatchery: "🥚 Incubadora", shop: "🛒 Loja", board: "Quadro de avisos", museum: "📖 Museu", market: "💰 Mercado", trainingHall: "🏋️ Sala de treino" },
    scene: { soilTitle: "Quintal", backBtn: "← Voltar", yardUpgrade: "⬆ Melhorar quintal → Nv.{level}", yardUpgradeSub: "{cost} 🪙 → {cap} animais" },
    hatchery: { unlockThisTitle: "Desbloquear este ninho", unlockPrevTitle: "Desbloqueia primeiro o ninho anterior", unlockPill: "Desbloquear {cost} 🪙", lockedPill: "Por desbloquear", needCoinsUnlock: "Moedas insuficientes: precisas de {cost} 🪙 para desbloquear", collectPill: "✨ Recolher!" }, nearPet: { fuse: "Fundir", follow: "Seguir", release: "Libertar" },
  },
  ru: {
    dexProgress: "📖 Коллекция {collected}/{total}", museum: { moreTitle: "Открыть коллекцию и посмотреть всех", openBtn: "📖 Открыть коллекцию" }, dex: { overlayTitle: "📖 Коллекция", progress: "Фиксированные рецепты {collected}/{total}" }, dexDetail: { unknownDesc: "Соберите его, чтобы открыть запись в коллекции", shareText: "[Gulugulu] Поделиться питомцем: {name} {url} (скопируйте весь текст и нажмите «Импортировать облик» в коллекции)" },
    training: { hallUnlocks: "Тренировка до ранга {tier}", hallMaxed: "Максимальное улучшение · до ранга 6", materialsTitle: "Материалы повышения ранга", pickTitle: "Выберите питомца для повышения ранга", pickHint: "Питомец и уровень сохранятся; повысится только ранг.", noEligible: "Нет питомцев максимального уровня для повышения ранга", atTopTier: "Уже максимальный ранг" },
    decor: { glade: "🌲 Лесная поляна", wilds: "🌾 Дикие земли →", hatchery: "🥚 Инкубатор", shop: "🛒 Магазин", board: "Доска объявлений", museum: "📖 Музей", market: "💰 Рынок", trainingHall: "🏋️ Тренировочный зал" },
    scene: { soilTitle: "Задний двор", backBtn: "← Назад", yardUpgrade: "⬆ Улучшить двор → ур. {level}", yardUpgradeSub: "{cost} 🪙 → {cap} питомцев" },
    hatchery: { unlockThisTitle: "Открыть это гнездо", unlockPrevTitle: "Сначала откройте предыдущее гнездо", unlockPill: "Открыть {cost} 🪙", lockedPill: "Не открыто", needCoinsUnlock: "Недостаточно монет: для открытия нужно {cost} 🪙", collectPill: "✨ Забрать!" }, nearPet: { fuse: "Слияние", follow: "Следовать", release: "Отпустить" },
  },
  it: {
    dexProgress: "📖 Collezione {collected}/{total}", museum: { moreTitle: "Apri la collezione per vederli tutti", openBtn: "📖 Apri la collezione" }, dex: { overlayTitle: "📖 Collezione", progress: "Ricette fisse {collected}/{total}" }, dexDetail: { unknownDesc: "Raccoglilo per sbloccare la sua scheda nella collezione", shareText: "[Gulugulu] Condividi compagno: {name} {url} (copia tutto il testo e premi «Importa skin» nella collezione per incollarlo)" },
    training: { hallUnlocks: "Addestra fino al grado {tier}", hallMaxed: "Potenziamento massimo · fino al grado 6", materialsTitle: "Materiali promozione", pickTitle: "Scegli un compagno da promuovere", pickHint: "Compagno e livello restano; aumenta solo il grado.", noEligible: "Nessun compagno al livello massimo è pronto per la promozione", atTopTier: "Già al grado massimo" },
    decor: { glade: "🌲 Radura forestale", wilds: "🌾 Terre selvagge →", hatchery: "🥚 Incubatoio", shop: "🛒 Negozio", board: "Bacheca", museum: "📖 Museo", market: "💰 Mercato", trainingHall: "🏋️ Sala allenamento" },
    scene: { soilTitle: "Cortile", backBtn: "← Indietro", yardUpgrade: "⬆ Migliora cortile → Lv.{level}", yardUpgradeSub: "{cost} 🪙 → {cap} animali" },
    hatchery: { unlockThisTitle: "Sblocca questo nido", unlockPrevTitle: "Sblocca prima il nido precedente", unlockPill: "Sblocca {cost} 🪙", lockedPill: "Da sbloccare", needCoinsUnlock: "Monete insufficienti: servono {cost} 🪙 per sbloccarlo", collectPill: "✨ Raccogli!" }, nearPet: { fuse: "Fondi", follow: "Segui", release: "Libera" },
  },
  pl: {
    dexProgress: "📖 Kolekcja {collected}/{total}", museum: { moreTitle: "Otwórz kolekcję, aby zobaczyć wszystkie", openBtn: "📖 Otwórz kolekcję" }, dex: { overlayTitle: "📖 Kolekcja", progress: "Stałe receptury {collected}/{total}" }, dexDetail: { unknownDesc: "Zdobądź go, aby odblokować wpis w kolekcji", shareText: "[Gulugulu] Udostępnij pupila: {name} {url} (skopiuj cały tekst i wybierz „Importuj skórkę” w kolekcji)" },
    training: { hallUnlocks: "Trening do rangi {tier}", hallMaxed: "Maksymalne ulepszenie · trening do rangi 6", materialsTitle: "Materiały awansu", pickTitle: "Wybierz pupila do awansu", pickHint: "Pupil i poziom zostają; rośnie tylko ranga.", noEligible: "Brak pupili na maksymalnym poziomie gotowych do awansu", atTopTier: "Najwyższa ranga osiągnięta" },
    decor: { glade: "🌲 Leśna polana", wilds: "🌾 Dzicz →", hatchery: "🥚 Wylęgarnia", shop: "🛒 Sklep", board: "Tablica ogłoszeń", museum: "📖 Muzeum", market: "💰 Rynek", trainingHall: "🏋️ Sala treningowa" },
    scene: { soilTitle: "Podwórko", backBtn: "← Wstecz", yardUpgrade: "⬆ Ulepsz podwórko → poz. {level}", yardUpgradeSub: "{cost} 🪙 → {cap} zwierząt" },
    hatchery: { unlockThisTitle: "Odblokuj to gniazdo", unlockPrevTitle: "Najpierw odblokuj poprzednie gniazdo", unlockPill: "Odblokuj {cost} 🪙", lockedPill: "Do odblokowania", needCoinsUnlock: "Za mało monet: odblokowanie wymaga {cost} 🪙", collectPill: "✨ Odbierz!" }, nearPet: { fuse: "Połącz", follow: "Podążaj", release: "Zwolnij" },
  },
  tr: {
    dexProgress: "📖 Koleksiyon {collected}/{total}", museum: { moreTitle: "Hepsini görmek için koleksiyonu aç", openBtn: "📖 Koleksiyonu aç" }, dex: { overlayTitle: "📖 Koleksiyon", progress: "Sabit tarifler {collected}/{total}" }, dexDetail: { unknownDesc: "Koleksiyon kaydını açmak için onu topla", shareText: "[Gulugulu] Dostunu paylaş: {name} {url} (metnin tamamını kopyala ve Koleksiyon'da “Görünüm içe aktar”a bas)" },
    training: { hallUnlocks: "{tier}. kademeye kadar eğitir", hallMaxed: "Tam geliştirildi · 6. kademeye kadar eğitir", materialsTitle: "Kademe atlama malzemeleri", pickTitle: "Kademe atlatılacak dostu seç", pickHint: "Dost ve seviyesi kalır; yalnızca kademesi yükselir.", noEligible: "Kademe atlamaya hazır azami seviyede dost yok", atTopTier: "Zaten en yüksek kademede" },
    decor: { glade: "🌲 Orman açıklığı", wilds: "🌾 Vahşi doğa →", hatchery: "🥚 Kuluçkahane", shop: "🛒 Mağaza", board: "Duyuru panosu", museum: "📖 Müze", market: "💰 Pazar", trainingHall: "🏋️ Eğitim salonu" },
    scene: { soilTitle: "Arka bahçe", backBtn: "← Geri", yardUpgrade: "⬆ Bahçeyi geliştir → Sv.{level}", yardUpgradeSub: "{cost} 🪙 → {cap} evcil hayvan" },
    hatchery: { unlockThisTitle: "Bu yuvanın kilidini aç", unlockPrevTitle: "Önce önceki yuvanın kilidini aç", unlockPill: "Kilidi aç {cost} 🪙", lockedPill: "Kilitli", needCoinsUnlock: "Yeterli jeton yok; kilidi açmak için {cost} 🪙 gerekiyor", collectPill: "✨ Topla!" }, nearPet: { fuse: "Birleştir", follow: "Takip et", release: "Serbest bırak" },
  },
  uk: {
    dexProgress: "📖 Колекція {collected}/{total}", museum: { moreTitle: "Відкрийте колекцію, щоб побачити всіх", openBtn: "📖 Відкрити колекцію" }, dex: { overlayTitle: "📖 Колекція", progress: "Фіксовані рецепти {collected}/{total}" }, dexDetail: { unknownDesc: "Зберіть його, щоб відкрити запис у колекції", shareText: "[Gulugulu] Поділитися улюбленцем: {name} {url} (скопіюйте весь текст і натисніть «Імпортувати вигляд» у колекції)" },
    training: { hallUnlocks: "Тренування до рангу {tier}", hallMaxed: "Максимальне покращення · до рангу 6", materialsTitle: "Матеріали підвищення рангу", pickTitle: "Виберіть улюбленця для підвищення рангу", pickHint: "Улюбленець і рівень збережуться; зросте лише ранг.", noEligible: "Немає улюбленців максимального рівня для підвищення рангу", atTopTier: "Уже максимальний ранг" },
    decor: { glade: "🌲 Лісова галявина", wilds: "🌾 Дикі землі →", hatchery: "🥚 Інкубатор", shop: "🛒 Крамниця", board: "Дошка оголошень", museum: "📖 Музей", market: "💰 Ринок", trainingHall: "🏋️ Тренувальна зала" },
    scene: { soilTitle: "Задній двір", backBtn: "← Назад", yardUpgrade: "⬆ Покращити двір → рів. {level}", yardUpgradeSub: "{cost} 🪙 → {cap} улюбленців" },
    hatchery: { unlockThisTitle: "Відкрити це гніздо", unlockPrevTitle: "Спочатку відкрийте попереднє гніздо", unlockPill: "Відкрити {cost} 🪙", lockedPill: "Не відкрито", needCoinsUnlock: "Недостатньо монет: для відкриття потрібно {cost} 🪙", collectPill: "✨ Забрати!" }, nearPet: { fuse: "Злити", follow: "Слідувати", release: "Відпустити" },
  },
  ar: {
    dexProgress: "📖 المجموعة {collected}/{total}", museum: { moreTitle: "افتح المجموعة لرؤية الجميع", openBtn: "📖 فتح المجموعة" }, dex: { overlayTitle: "📖 المجموعة", progress: "الوصفات الثابتة {collected}/{total}" }, dexDetail: { unknownDesc: "اجمعه لفتح صفحته في المجموعة", shareText: "[Gulugulu] مشاركة الرفيق: {name} {url} (انسخ النص كاملًا، ثم اختر «استيراد المظهر» في المجموعة للصقه)" },
    training: { hallUnlocks: "يدرّب حتى الرتبة {tier}", hallMaxed: "تطوير كامل · حتى الرتبة 6", materialsTitle: "مواد ترقية الرتبة", pickTitle: "اختر رفيقًا لترقية رتبته", pickHint: "يبقى الرفيق ومستواه كما هما؛ ترتفع الرتبة فقط.", noEligible: "لا يوجد رفيق بأقصى مستوى جاهز للترقية", atTopTier: "بلغ أعلى رتبة" },
    decor: { glade: "🌲 فسحة الغابة", wilds: "🌾 البراري", hatchery: "🥚 المفرخ", shop: "🛒 المتجر", board: "لوحة الإعلانات", museum: "📖 المتحف", market: "💰 السوق", trainingHall: "🏋️ قاعة التدريب" },
    scene: { soilTitle: "الفناء الخلفي", backBtn: "رجوع", yardUpgrade: "⬆ ترقية الفناء · المستوى {level}", yardUpgradeSub: "{cost} 🪙 · السعة {cap} حيوانًا" },
    hatchery: { unlockThisTitle: "افتح هذا العش", unlockPrevTitle: "افتح العش السابق أولًا", unlockPill: "فتح {cost} 🪙", lockedPill: "غير مفتوح", needCoinsUnlock: "العملات غير كافية؛ يلزم {cost} 🪙 لفتحه", collectPill: "✨ جمع!" }, nearPet: { fuse: "دمج", follow: "اتبع", release: "إطلاق" },
  },
  th: {
    dexProgress: "📖 คอลเลกชัน {collected}/{total}", museum: { moreTitle: "เปิดคอลเลกชันเพื่อดูทั้งหมด", openBtn: "📖 เปิดคอลเลกชัน" }, dex: { overlayTitle: "📖 คอลเลกชัน", progress: "สูตรตายตัว {collected}/{total}" }, dexDetail: { unknownDesc: "สะสมเพื่อปลดล็อกข้อมูลในคอลเลกชัน", shareText: "[Gulugulu] แชร์สัตว์เลี้ยง: {name} {url} (คัดลอกข้อความทั้งหมด แล้วกด “นำเข้าสกิน” ในคอลเลกชันเพื่อวาง)" },
    training: { hallUnlocks: "ฝึกได้ถึงขั้น {tier}", hallMaxed: "อัปเกรดเต็มแล้ว · ฝึกได้ถึงขั้น 6", materialsTitle: "วัสดุเลื่อนขั้น", pickTitle: "เลือกเพื่อนที่จะเลื่อนขั้น", pickHint: "เพื่อนและเลเวลยังคงเดิม เพิ่มเฉพาะขั้นเท่านั้น", noEligible: "ไม่มีเพื่อนเลเวลเต็มที่พร้อมเลื่อนขั้น", atTopTier: "ถึงขั้นสูงสุดแล้ว" },
    decor: { glade: "🌲 ลานป่า", wilds: "🌾 พื้นที่ป่า →", hatchery: "🥚 โรงฟัก", shop: "🛒 ร้านค้า", board: "กระดานข่าว", museum: "📖 พิพิธภัณฑ์", market: "💰 ตลาด", trainingHall: "🏋️ ห้องฝึก" },
    scene: { soilTitle: "สวนหลังบ้าน", backBtn: "← กลับ", yardUpgrade: "⬆ อัปเกรดสวน → Lv{level}", yardUpgradeSub: "{cost} 🪙 → สัตว์เลี้ยง {cap} ตัว" },
    hatchery: { unlockThisTitle: "ปลดล็อกหลุมฟักนี้", unlockPrevTitle: "ปลดล็อกหลุมฟักก่อนหน้าก่อน", unlockPill: "ปลดล็อก {cost} 🪙", lockedPill: "ยังไม่ปลดล็อก", needCoinsUnlock: "เหรียญไม่พอ ต้องใช้ {cost} 🪙 เพื่อปลดล็อก", collectPill: "✨ เก็บ!" }, nearPet: { fuse: "ผสม", follow: "ติดตาม", release: "ปล่อย" },
  },
  vi: {
    dexProgress: "📖 Bộ sưu tập {collected}/{total}", museum: { moreTitle: "Mở bộ sưu tập để xem tất cả", openBtn: "📖 Mở bộ sưu tập" }, dex: { overlayTitle: "📖 Bộ sưu tập", progress: "Công thức cố định {collected}/{total}" }, dexDetail: { unknownDesc: "Thu thập để mở khóa mục trong bộ sưu tập", shareText: "[Gulugulu] Chia sẻ thú cưng: {name} {url} (sao chép toàn bộ văn bản rồi nhấn “Nhập ngoại hình” trong Bộ sưu tập để dán)" },
    training: { hallUnlocks: "Huấn luyện đến bậc {tier}", hallMaxed: "Nâng cấp tối đa · đến bậc 6", materialsTitle: "Nguyên liệu tăng bậc", pickTitle: "Chọn bạn để tăng bậc", pickHint: "Giữ nguyên bạn và cấp độ; chỉ tăng bậc.", noEligible: "Không có bạn đạt cấp tối đa để tăng bậc", atTopTier: "Đã ở bậc cao nhất" },
    decor: { glade: "🌲 Khoảng rừng", wilds: "🌾 Vùng hoang dã →", hatchery: "🥚 Trại ấp", shop: "🛒 Cửa hàng", board: "Bảng tin", museum: "📖 Bảo tàng", market: "💰 Chợ", trainingHall: "🏋️ Phòng huấn luyện" },
    scene: { soilTitle: "Sân sau", backBtn: "← Quay lại", yardUpgrade: "⬆ Nâng cấp sân → cấp {level}", yardUpgradeSub: "{cost} 🪙 → {cap} thú cưng" },
    hatchery: { unlockThisTitle: "Mở ô ấp này", unlockPrevTitle: "Hãy mở ô ấp trước đó trước", unlockPill: "Mở {cost} 🪙", lockedPill: "Chưa mở", needCoinsUnlock: "Không đủ xu; cần {cost} 🪙 để mở", collectPill: "✨ Thu thập!" }, nearPet: { fuse: "Dung hợp", follow: "Theo sau", release: "Thả" },
  },
  id: {
    dexProgress: "📖 Koleksi {collected}/{total}", museum: { moreTitle: "Buka koleksi untuk melihat semuanya", openBtn: "📖 Buka koleksi" }, dex: { overlayTitle: "📖 Koleksi", progress: "Resep tetap {collected}/{total}" }, dexDetail: { unknownDesc: "Kumpulkan untuk membuka entri koleksi", shareText: "[Gulugulu] Bagikan peliharaan: {name} {url} (salin seluruh teks lalu tekan “Impor tampilan” di Koleksi untuk menempelkannya)" },
    training: { hallUnlocks: "Melatih hingga peringkat {tier}", hallMaxed: "Peningkatan maksimal · hingga peringkat 6", materialsTitle: "Bahan naik peringkat", pickTitle: "Pilih teman untuk naik peringkat", pickHint: "Teman dan level tetap; hanya peringkat yang naik.", noEligible: "Tidak ada teman level maksimal yang siap naik peringkat", atTopTier: "Sudah di peringkat tertinggi" },
    decor: { glade: "🌲 Padang hutan", wilds: "🌾 Alam liar →", hatchery: "🥚 Penetasan", shop: "🛒 Toko", board: "Papan pengumuman", museum: "📖 Museum", market: "💰 Pasar", trainingHall: "🏋️ Aula latihan" },
    scene: { soilTitle: "Halaman belakang", backBtn: "← Kembali", yardUpgrade: "⬆ Tingkatkan halaman → Lv.{level}", yardUpgradeSub: "{cost} 🪙 → {cap} peliharaan" },
    hatchery: { unlockThisTitle: "Buka sarang ini", unlockPrevTitle: "Buka sarang sebelumnya terlebih dahulu", unlockPill: "Buka {cost} 🪙", lockedPill: "Belum dibuka", needCoinsUnlock: "Koin tidak cukup; perlu {cost} 🪙 untuk membukanya", collectPill: "✨ Ambil!" }, nearPet: { fuse: "Fusi", follow: "Ikuti", release: "Lepaskan" },
  },
  nl: {
    dexProgress: "📖 Verzameling {collected}/{total}", museum: { moreTitle: "Open de verzameling om ze allemaal te bekijken", openBtn: "📖 Verzameling openen" }, dex: { overlayTitle: "📖 Verzameling", progress: "Vaste recepten {collected}/{total}" }, dexDetail: { unknownDesc: "Verzamel hem om het item in je verzameling te ontgrendelen", shareText: "[Gulugulu] Maatje delen: {name} {url} (kopieer de hele tekst en kies ‘Skin importeren’ in de verzameling)" },
    training: { hallUnlocks: "Traint tot rang {tier}", hallMaxed: "Volledig verbeterd · traint tot rang 6", materialsTitle: "Promotiematerialen", pickTitle: "Kies een maatje voor promotie", pickHint: "Maatje en level blijven; alleen de rang stijgt.", noEligible: "Geen maatje op maximumlevel is klaar voor promotie", atTopTier: "Al op de hoogste rang" },
    decor: { glade: "🌲 Open plek in het bos", wilds: "🌾 Wildernis →", hatchery: "🥚 Broederij", shop: "🛒 Winkel", board: "Prikbord", museum: "📖 Museum", market: "💰 Markt", trainingHall: "🏋️ Trainingshal" },
    scene: { soilTitle: "Achtertuin", backBtn: "← Terug", yardUpgrade: "⬆ Tuin verbeteren → Lv.{level}", yardUpgradeSub: "{cost} 🪙 → {cap} huisdieren" },
    hatchery: { unlockThisTitle: "Dit nest vrijspelen", unlockPrevTitle: "Speel eerst het vorige nest vrij", unlockPill: "Vrijspelen {cost} 🪙", lockedPill: "Nog niet vrijgespeeld", needCoinsUnlock: "Niet genoeg munten; vrijspelen kost {cost} 🪙", collectPill: "✨ Ophalen!" }, nearPet: { fuse: "Fuseren", follow: "Volgen", release: "Vrijlaten" },
  },
} satisfies Partial<Record<Language, DeepPartial<BackyardStrings>>>;

/** Bilingual review of terse English copy whose literal sense is ambiguous. */
export const BACKYARD_SEMANTIC_LOCALES = {
  "zh-Hant": { training: { lockedHint: "融合會更換物種；訓練只提升階級。蓋好訓練館，把你最喜歡的夥伴練上去。", slots: "訓練位 {used}/{total}", remaining: "還需 {time}", openBtn: "開始訓練", costTime: "耗時 {time}", universalShort: "還缺 {count}" }, scene: { backTitle: "回到寵物（Esc）" } },
  ja: { training: { lockedHint: "合成では種族が変わり、訓練ではランクだけが上がります。訓練場を建てて、お気に入りを育てよう。", slots: "訓練枠 {used}/{total}", remaining: "あと {time}", openBtn: "訓練を始める", costTime: "所要時間 {time}", universalShort: "あと {count} 個" }, scene: { backTitle: "ペットに戻る（Esc）" } },
  ko: { training: { lockedHint: "융합은 종을 바꾸고, 훈련은 등급만 올려요. 훈련장을 지어 정말 아끼는 친구를 키워 보세요.", slots: "훈련 슬롯 {used}/{total}", remaining: "{time} 남음", openBtn: "훈련 시작", costTime: "소요 시간 {time}", universalShort: "{count}개 부족" }, scene: { backTitle: "펫으로 돌아가기 (Esc)" } },
  fr: { training: { lockedHint: "La fusion change l’espèce ; l’entraînement augmente seulement le rang. Construis la salle et entraîne ton compagnon préféré.", slots: "Places d’entraînement {used}/{total}", remaining: "Encore {time}", openBtn: "Commencer l’entraînement", costTime: "Durée : {time}", universalShort: "Il en manque {count}" }, scene: { backTitle: "Retour au compagnon (Échap)" } },
  de: { training: { lockedHint: "Fusion ändert die Art; Training erhöht nur den Rang. Baue die Halle und trainiere deinen Lieblingsbegleiter.", slots: "Trainingsplätze {used}/{total}", remaining: "Noch {time}", openBtn: "Training starten", costTime: "Dauer: {time}", universalShort: "Noch {count} nötig" }, scene: { backTitle: "Zurück zum Begleiter (Esc)" } },
  "es-ES": { training: { lockedHint: "La fusión cambia la especie; el entrenamiento solo sube el rango. Construye la sala y entrena a tu compañero favorito.", slots: "Plazas de entrenamiento {used}/{total}", remaining: "Faltan {time}", openBtn: "Empezar entrenamiento", costTime: "Duración: {time}", universalShort: "Faltan {count}" }, scene: { backTitle: "Volver a la mascota (Esc)" } },
  "es-419": { training: { lockedHint: "La fusión cambia la especie; el entrenamiento solo sube el rango. Construye la sala y entrena a tu mascota favorita.", slots: "Espacios de entrenamiento {used}/{total}", remaining: "Faltan {time}", openBtn: "Empezar entrenamiento", costTime: "Duración: {time}", universalShort: "Faltan {count}" }, scene: { backTitle: "Volver a la mascota (Esc)" } },
  "pt-BR": { training: { lockedHint: "A fusão troca a espécie; o treino só aumenta o grau. Construa a sala e treine seu pet favorito.", slots: "Vagas de treino {used}/{total}", remaining: "Faltam {time}", openBtn: "Começar treino", costTime: "Duração: {time}", universalShort: "Faltam {count}" }, scene: { backTitle: "Voltar ao pet (Esc)" } },
  "pt-PT": { training: { lockedHint: "A fusão muda a espécie; o treino só aumenta o grau. Constrói a sala e treina o teu companheiro favorito.", slots: "Lugares de treino {used}/{total}", remaining: "Faltam {time}", openBtn: "Começar treino", costTime: "Duração: {time}", universalShort: "Faltam {count}" }, scene: { backTitle: "Voltar ao companheiro (Esc)" } },
  ru: { training: { lockedHint: "Слияние меняет вид, а тренировка повышает только ранг. Постройте зал и развивайте любимого питомца.", slots: "Места для тренировки {used}/{total}", remaining: "Осталось {time}", openBtn: "Начать тренировку", costTime: "Время: {time}", universalShort: "Не хватает {count}" }, scene: { backTitle: "Вернуться к питомцу (Esc)" } },
  it: { training: { lockedHint: "La fusione cambia la specie; l’allenamento aumenta solo il grado. Costruisci la sala e allena il tuo compagno preferito.", slots: "Posti allenamento {used}/{total}", remaining: "Mancano {time}", openBtn: "Inizia allenamento", costTime: "Durata: {time}", universalShort: "Ne mancano {count}" }, scene: { backTitle: "Torna al compagno (Esc)" } },
  pl: { training: { lockedHint: "Fuzja zmienia gatunek, a trening podnosi tylko rangę. Zbuduj salę i trenuj ulubionego pupila.", slots: "Miejsca treningowe {used}/{total}", remaining: "Pozostało {time}", openBtn: "Rozpocznij trening", costTime: "Czas: {time}", universalShort: "Brakuje {count}" }, scene: { backTitle: "Wróć do pupila (Esc)" } },
  tr: { training: { lockedHint: "Birleştirme türü değiştirir; eğitim yalnızca kademeyi yükseltir. Salonu kur ve en sevdiğin dostu eğit.", slots: "Eğitim yerleri {used}/{total}", remaining: "{time} kaldı", openBtn: "Eğitimi başlat", costTime: "Süre: {time}", universalShort: "{count} eksik" }, scene: { backTitle: "Dosta dön (Esc)" } },
  uk: { training: { lockedHint: "Злиття змінює вид, а тренування підвищує лише ранг. Збудуйте зал і розвивайте улюбленця.", slots: "Місця для тренування {used}/{total}", remaining: "Залишилося {time}", openBtn: "Почати тренування", costTime: "Час: {time}", universalShort: "Не вистачає {count}" }, scene: { backTitle: "Повернутися до улюбленця (Esc)" } },
  ar: { training: { lockedHint: "يغيّر الدمج النوع، بينما يرفع التدريب الرتبة فقط. ابنِ القاعة ودرّب رفيقك المفضل.", slots: "أماكن التدريب {used}/{total}", remaining: "متبقٍ {time}", openBtn: "بدء التدريب", costTime: "المدة: {time}", universalShort: "ينقص {count}" }, scene: { backTitle: "العودة إلى الرفيق (Esc)" } },
  th: { training: { lockedHint: "การผสมจะเปลี่ยนสายพันธุ์ ส่วนการฝึกเพิ่มเฉพาะขั้น สร้างห้องฝึกแล้วปั้นเพื่อนตัวโปรดของคุณได้เลย", slots: "ช่องฝึก {used}/{total}", remaining: "เหลือ {time}", openBtn: "เริ่มฝึก", costTime: "ใช้เวลา {time}", universalShort: "ขาดอีก {count}" }, scene: { backTitle: "กลับไปหาเพื่อน (Esc)" } },
  vi: { training: { lockedHint: "Dung hợp sẽ đổi loài; huấn luyện chỉ tăng bậc. Hãy xây phòng và rèn luyện người bạn bạn yêu thích.", slots: "Ô huấn luyện {used}/{total}", remaining: "Còn {time}", openBtn: "Bắt đầu huấn luyện", costTime: "Thời gian: {time}", universalShort: "Thiếu {count}" }, scene: { backTitle: "Trở lại với thú cưng (Esc)" } },
  id: { training: { lockedHint: "Fusi mengubah spesies; latihan hanya menaikkan peringkat. Bangun aula dan latih teman favoritmu.", slots: "Slot latihan {used}/{total}", remaining: "Tersisa {time}", openBtn: "Mulai latihan", costTime: "Durasi: {time}", universalShort: "Kurang {count}" }, scene: { backTitle: "Kembali ke peliharaan (Esc)" } },
  nl: { training: { lockedHint: "Fusie verandert de soort; training verhoogt alleen de rang. Bouw de hal en train je favoriete maatje.", slots: "Trainingsplekken {used}/{total}", remaining: "Nog {time}", openBtn: "Training starten", costTime: "Duur: {time}", universalShort: "Nog {count} nodig" }, scene: { backTitle: "Terug naar je maatje (Esc)" } },
} satisfies Partial<Record<Language, DeepPartial<BackyardStrings>>>;

const zh: BackyardStrings = {
  energyTitle: "精力 {value}/{max}",
  expTitle: "经验 {value}/{max}",
  clickToWork: "{name}（点击打工）",
  dexProgress: "📖 收藏 {collected}/{total}",

  decor: {
    glade: "🌲 林间空地",
    wilds: "🌾 旷野 →",
    hatchery: "🥚 孵化区",
    shop: "🛒 商店",
    board: "公告板",
    museum: "📖 图鉴馆",
    market: "💰 交易市场",
    trainingHall: "🏋️ 训练馆",
  },

  training: {
    title: "🏋️ 训练馆",
    lockedHint: "融合换物种，训练升阶数——盖起训练馆，把你最喜欢的那只练上去。",
    buildBtn: "建造训练馆 · {cost}🪙",
    hallLevel: "训练馆 Lv{level}",
    hallUnlocks: "可训练至 {tier} 阶",
    hallMaxed: "已满级 · 可训练至 6 阶",
    upgradeHallBtn: "升级 · {cost}🪙",
    slots: "训练位 {used}/{total}",
    expandSlotsBtn: "扩建训练位 · {cost}🪙",
    slotsMaxed: "训练位已扩满",
    idleSlot: "空闲",
    training: "{name} · {from}阶 → {to}阶",
    remaining: "还需 {time}",
    collectBtn: "出师",
    openBtn: "开始训练",
    materialsTitle: "升阶材料",
    noMaterials: "还没有升阶材料——去工厂打工赚材料吧",
    pickTitle: "选择要升阶的伙伴",
    pickHint: "保留伙伴和等级，只提升阶数。",
    noEligible: "还没有满级的伙伴可以升阶",
    tierUp: "{from} 阶 → {to} 阶",
    needMaxLevel: "需先点到满级",
    needHallLevel: "需训练馆 Lv{level}",
    atTopTier: "已达最高阶",
    inTraining: "训练中",
    costCoins: "{cost}🪙",
    costTime: "耗时 {time}",
    useUniversal: "用 {count} 张{name}补足",
    universalShort: "材料不足 {count}",
    startBtn: "开始训练",
    cancelBtn: "取消",
    materialNames: {
      ironBadge: "🔩 铁质工牌",
      copperGoggles: "🥽 铜质护目镜",
      silverHelmet: "⛑️ 银质安全帽",
      goldWrench: "🔧 鎏金扳手",
      platinumVest: "🦺 铂金工装",
      goldenBadge: "🎫 金牌工牌",
    },
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
  },

  hint: {
    followFirst: "先跟随一只精灵再来融合",
    sameTier: "需要两只同阶精灵",
    otherNotMax: "需对方满级 Lv{level}（{name}未满级）",
    yoursNotMax: "你的{name}还没满级",
    needCoins: "金币不足（融合需 {fee} 🪙）",
    steamReconciling: "Steam 正在核对这只精灵，整理好后会自动恢复融合",
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
    generating: "🤖 {provider} 设计中",
    queued: "🤖 等待 AI 设计",
    queuedProvider: "🤖 等待 {provider} 设计",
    syncing: "🎮 等待 Steam",
    syncingTitle: "正在等待 Steam 销毁融合材料并发放结果；完成后才会进入 AI 设计阶段",
    collectTitle: "点击收取",
    collectPill: "✨ 点击收取",
    noFreePitTitle: "没有空蛋坑",
    placeToHatchTitle: "放入蛋坑孵化",
    pitsFull: "蛋坑都满了，先收取或解锁新坑",
    waitingCount: "待孵化 ×{count}",
  },

  museum: {
    aiSuffix: " · AI ×{count}",
    moreTitle: "打开收藏查看全部",
    empty: "还没有收集到伙伴——孵化或融合精灵试试！",
    openBtn: "📖 打开收藏",
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
    todayCoins: "今日金币",
    todayWorkBest: "打工最高分",
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
    fuse: "融合",
    notEligible: "条件未满足",
    follow: "陪伴",
    confirmRelease: "确认放生（返 {refund} 🪙）",
    release: "放生",
    lastPetTitle: "最后一只伙伴不能放生",
  },

  dex: {
    overlayTitle: "📖 收藏",
    progress: "固定配方 {collected}/{total}",
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
    unknownDesc: "收集后解锁收藏信息",
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
    shareText: "【咕噜咕噜】宠物分享：{name} {url}（复制整段文本，在「收藏」中点「导入皮肤」粘贴即可）",
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
  dexProgress: "📖 Collection {collected}/{total}",

  decor: {
    glade: "🌲 Forest Glade",
    wilds: "🌾 Wilds →",
    hatchery: "🥚 Hatchery",
    shop: "🛒 Shop",
    board: "Notice Board",
    museum: "📖 Museum",
    market: "💰 Market",
    trainingHall: "🏋️ Training Hall",
  },

  training: {
    title: "🏋️ Training Hall",
    lockedHint:
      "Fusion swaps species; training raises tiers — build the hall and level up the one you actually love.",
    buildBtn: "Build Training Hall · {cost}🪙",
    hallLevel: "Training Hall Lv{level}",
    hallUnlocks: "Trains up to tier {tier}",
    hallMaxed: "Fully upgraded · trains up to tier 6",
    upgradeHallBtn: "Upgrade · {cost}🪙",
    slots: "Slots {used}/{total}",
    expandSlotsBtn: "Add slot · {cost}🪙",
    slotsMaxed: "All slots built",
    idleSlot: "Idle",
    training: "{name} · T{from} → T{to}",
    remaining: "{time} left",
    collectBtn: "Graduate",
    openBtn: "Train a buddy",
    materialsTitle: "Tier-up materials",
    noMaterials: "No materials yet — earn them on the factory floor",
    pickTitle: "Pick a buddy to tier up",
    pickHint: "Keep the buddy and its level. Raise only its tier.",
    noEligible: "No max-level buddies ready to tier up",
    tierUp: "T{from} → T{to}",
    needMaxLevel: "Needs max level first",
    needHallLevel: "Needs Training Hall Lv{level}",
    atTopTier: "Already top tier",
    inTraining: "In training",
    costCoins: "{cost}🪙",
    costTime: "Takes {time}",
    useUniversal: "Cover the gap with {count} × {name}",
    universalShort: "{count} short",
    startBtn: "Start training",
    cancelBtn: "Cancel",
    materialNames: {
      ironBadge: "🔩 Iron Badge",
      copperGoggles: "🥽 Copper Goggles",
      silverHelmet: "⛑️ Silver Helmet",
      goldWrench: "🔧 Gilded Wrench",
      platinumVest: "🦺 Platinum Vest",
      goldenBadge: "🎫 Gold Badge",
    },
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
  },

  hint: {
    followFirst: "Follow a pet first, then come fuse",
    sameTier: "Fusion needs two same-tier pets",
    otherNotMax: "Partner must be max Lv{level} ({name} isn't there yet)",
    yoursNotMax: "Your {name} isn't max level yet",
    needCoins: "Not enough coins (fusion costs {fee} 🪙)",
    steamReconciling: "Steam is reconciling this pet; fusion will return automatically when it is ready",
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
    generating: "🤖 {provider} designing",
    queued: "🤖 Waiting for AI design",
    queuedProvider: "🤖 Waiting for {provider}",
    syncing: "🎮 Waiting for Steam",
    syncingTitle: "Waiting for Steam to burn the fusion materials and grant the result; AI design starts afterward",
    collectTitle: "Click to collect",
    collectPill: "✨ Collect!",
    noFreePitTitle: "No free pits",
    placeToHatchTitle: "Pop it into a pit to hatch",
    pitsFull: "All pits are full — collect or unlock one first",
    waitingCount: "Waiting ×{count}",
  },

  museum: {
    aiSuffix: " · AI ×{count}",
    moreTitle: "Open the collection to see them all",
    empty: "No buddies collected yet — try hatching or fusing!",
    openBtn: "📖 Open collection",
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
    todayCoins: "Coins today",
    todayWorkBest: "Best work score",
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
    fuse: "Fuse",
    notEligible: "not eligible",
    follow: "Follow",
    confirmRelease: "Sure? +{refund} 🪙",
    release: "Release",
    lastPetTitle: "Can't release your last buddy",
  },

  dex: {
    overlayTitle: "📖 Collection",
    progress: "Fixed recipes {collected}/{total}",
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
    unknownDesc: "Collect it to unlock its collection entry",
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
    shareText: "[Gulugulu] Pet share: {name} {url} (copy the whole text, then hit \"Import skin\" in Collection to paste)",
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

const generatedLocales = Object.fromEntries(
  Object.entries(generatedDomainLocales("backyard")).map(([language, locale]) => {
    const reviewed = (BACKYARD_LABEL_LOCALES as Partial<
      Record<Language, DeepPartial<BackyardStrings>>
    >)[language as Language];
    const semantic = (BACKYARD_SEMANTIC_LOCALES as Partial<
      Record<Language, DeepPartial<BackyardStrings>>
    >)[language as Language];
    return [language, {
      ...locale,
      dexProgress: reviewed?.dexProgress ?? locale?.dexProgress,
      training: { ...locale?.training, ...reviewed?.training, ...semantic?.training },
      decor: { ...locale?.decor, ...reviewed?.decor },
      scene: { ...locale?.scene, ...reviewed?.scene, ...semantic?.scene },
      hatchery: { ...locale?.hatchery, ...reviewed?.hatchery },
      nearPet: { ...locale?.nearPet, ...reviewed?.nearPet },
      museum: { ...locale?.museum, ...reviewed?.museum },
      dex: { ...locale?.dex, ...reviewed?.dex },
      dexDetail: { ...locale?.dexDetail, ...reviewed?.dexDetail },
    }];
  }),
) as Partial<Record<Language, DeepPartial<BackyardStrings>>>;

export const BACKYARD: Record<Language, BackyardStrings> = createLanguageMap<BackyardStrings>(
  en,
  zh,
  generatedLocales,
);
