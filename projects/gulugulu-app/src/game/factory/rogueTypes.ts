// 《危楼打工记》契约类型(设计权威:docs/gdd/factory_working/)。
// 本文件是逻辑层(rogue*.ts)与场景/UI 层(FactoryRogueScene 等)的共同契约:
// 逻辑线可追加,UI 线只读;改语义先在 plans/factory_rogue/PROGRESS.md 留言。

// ---- 元素与物种 -------------------------------------------------------------

export const ROGUE_ELEMENTS = ["fire", "water", "grass", "electric", "ice", "normal"] as const;
export type RogueElement = (typeof ROGUE_ELEMENTS)[number];

/** 一个出战物种进局所需的全部静态元数据(rogueSpecies.ts 从 config+save 推导)。 */
export type SpeciesRogueMeta = {
  species: string;
  elements: RogueElement[];
  /** 工种 = 元素数(1~6),决定雇价基准与通胀。 */
  tierCount: number;
  /** 元素组编号:目录物种=1;AI 物种=1+组内 AI 创建序;多元素取各组最大。 */
  groupNo: number;
  /** 压榨数:目录宠固定为 2,AI 宠为 groupNo + 2。 */
  reach: number;
  /** 基础值按元素数取 15/12/9/6/4/3，与主线等级无关。 */
  baseValue: number;
};

export type HiringCandidate = {
  id: number;
  species: string;
  selected: boolean;
  price: number;
  tierCount: number;
  baseValue: number;
  reach: number;
  elements: RogueElement[];
};

export type HiringView = {
  round: number;
  roundsMax: number;
  canContinue: boolean;
  candidates: HiringCandidate[];
  selectedCount: number;
  allAffordableSelected: boolean;
  hireCost: number;
  rerollSpent: number;
  rerollsUsed: number;
  rerollsMax: number;
  rerollCost: number | null;
  canConfirm: boolean;
  canAfford: boolean;
  hasQuota: boolean;
  poolCounts: { species: string; count: number }[];
  poolTotal: number;
  projectedPoolTotal: number;
  inflationCounts: number[];
};

// ---- 物理侧快照(场景 → 逻辑) ----------------------------------------------

/** 场景物理体的只读快照(落定宠;圆心 x/y、半径 r,脚底 = y + r,y 向下增大)。 */
export type BodyLike = {
  uid: number;
  species: string;
  elements: string[];
  x: number;
  y: number;
  r: number;
  settled: boolean;
  /** 因塌方重新落体中(泥石流连携的重粘判定用;落定后清)。 */
  fromCollapse?: boolean;
  /** 状态效果形成的罢工豁免连接快照；连接或位置变化后失效。 */
  strikeProtection?: {
    species: string;
    members: number[];
    positions: Array<{ uid: number; x: number; y: number }>;
  };
};

export type RogueBodyState = {
  uid: number;
  /** 永久冻结：仍计分/连通，但不占人口。 */
  frozen?: boolean;
  /** 由草系生长产生：不占人口。 */
  generated?: boolean;
  /** 水镜同化后的逻辑物种与固有元素覆写。 */
  speciesOverride?: string;
  elementsOverride?: RogueElement[];
  /** 旧存档兼容：早期版本曾按班次记录同化罢工保护。 */
  strikeImmuneShift?: number;
  /** 旧存档兼容；新一般系不再生成额外标签。 */
  extraTags?: RogueElement[];
  /** 【吸收】后的体型质量。1 为普通大小，吃掉目标时累加目标质量。 */
  sizeLevel?: number;
  /** 被吸收单位原有邻接点转移到本体，保证吞掉支点后逻辑通路不丢失。 */
  absorbedLinks?: number[];
  /** 被吸收单位原先直接接通的桌面，同样由本体继承。 */
  absorbedDesks?: RogueElement[];
};

export type RogueBodyMutation =
  | {
      kind: "absorb";
      sourceUid: number;
      targetUid: number;
    }
  | {
      /** 水镜同化：逻辑层通知场景把目标的实际立绘换成同化者。 */
      kind: "convert";
      sourceUid: number;
      targetUid: number;
      species: string;
      elements: RogueElement[];
    };

export type RogueSpawnRequest = {
  species: string;
  /** 生成目标中心；场景会做防重叠和边界修正。 */
  x: number;
  y: number;
  parentUid: number;
  generated: true;
  extraTags?: RogueElement[];
  sizeLevel?: number;
  /** 生长角色要等结算压暗结束后才进入物理场景。 */
  readyAt?: number;
};

export type RogueTriggerKind =
  | "ignite" | "ember" | "wildfire"
  | "wire" | "overload" | "parallel" | "induction"
  | "freezePrice" | "freeze" | "overstaff"
  | "workRest" | "sameName" | "convert" | "convertEcho"
  | "grow" | "lush" | "height"
  | "absorb" | "gluttony" | "emperor"
  | "arcIgnite" | "thermalShock" | "steamBurst" | "greenhouse" | "fireDispatch"
  | "superconduct" | "shortCircuit" | "bionet" | "lightningrod"
  | "iceMirror" | "permafrost" | "coldRotation"
  | "irrigation" | "badge" | "multiSeed";

export type RogueTriggerEvent = {
  kind: RogueTriggerKind;
  sourceUid: number;
  targetUids?: number[];
  value?: number;
  persistent?: boolean;
};

/** 桌面板快照(top = 桌面上表面 y)。 */
export type DeskLike = {
  element: string;
  x: number;
  w: number;
  top: number;
};

// ---- 脉冲结算 ---------------------------------------------------------------

/** 单次落地脉冲的完整拆解(HUD 明细/演出分档都读它)。 */
export type PulseBreakdown = {
  uid: number;
  species: string;
  /** 来自班末「加班时间」的自动投放；演出层据此把压暗缩短为 1 秒。 */
  overtime?: boolean;
  /** 基础值(含草·生长后的当前值)。 */
  base: number;
  /** 吸取和(去重 BFS,含被吸取折算类技能)。 */
  absorbSum: number;
  /** 吸取到的宠数(演出:吸取波逐宠弹跳)。 */
  absorbUids: number[];
  /** 筹码 = base + 1.0 × absorbSum；每只被压榨咕噜默认贡献 100% 有效基础分。 */
  chips: number;
  /** 三类卡牌乘区 + 节奏池：池内卡牌加成相加、池间相乘。 */
  elementMult: number;
  synergyCardMult: number;
  jobMult: number;
  rhythmMult: number;
  /** 旧五池字段，供存量 UI/结算快照兼容。 */
  individualMult: number;
  teamMult: number;
  networkMult: number;
  statusMult: number;
  /** 旧结算字段：分别镜像「个体×团队」「网络×状态」「节奏」，供存量 UI/快照兼容。 */
  skillMult: number;
  synergyMult: number;
  comboMult: number;
  /** 接通的桌元素(棱镜的虚拟桌记 "prism")。 */
  desks: string[];
  deskCount: number;
  /** 接桌计分次数：1/2/4/8/12/16；与物理桌数分开供计分和演出使用。 */
  deskScoreMult: number;
  /** 实际连通、但因本班次禁运而不参与计分的桌面元素。 */
  disabledDeskElements?: RogueElement[];
  /** 各桌通路(桌元素 → 通路上的 uid 链,演出描色用)。 */
  deskPaths: Record<string, number[]>;
  /** 最终入账。 */
  total: number;
  /** 精确到宠物的本次主脉冲贡献；所有 amount 之和恒等于 total。 */
  contributors: { uid: number; species: string; role: "head" | "absorbed"; amount: number }[];
  /** 追加脉冲(燎原回响/短路爆发/工休罢工业绩),各自入账并演出。 */
  /** protest 仅为旧结算快照兼容；当前工休追加业绩使用 workRest。 */
  extras: {
    kind: "echo" | "shortCircuit" | "workRest" | "protest" | "convertEcho"
      | "fireBurst" | "wildfire" | "emperor";
    uid: number;
    amount: number;
  }[];
  /** 本次结算触发的元素/连携演出，不参与入账。 */
  triggers?: RogueTriggerEvent[];
  cardContributions?: { id: string; amount: number }[];
};

// ---- 卡牌 -------------------------------------------------------------------

export type CardDim = 1 | 2 | 3 | 4 | 5;
export type CardRarity = "common" | "rare" | "epic";

export type CardDef = {
  id: string;
  dim: CardDim;
  rarity: CardRarity;
  /** 维度一:所属元素(按出战名单过滤);维度三:配对元素(不过滤)。 */
  element?: RogueElement;
  pair?: [RogueElement, RogueElement];
  /**
   * 出现在商店前必须已购买的全部卡牌。
   * 这里只控制后续商店候选，不回收旧存档里已经持有的卡牌。
   */
  requires?: string[];
  /** 可升级上限;undefined = 无上限。 */
  maxLevel?: number;
  /** 一次性(解雇/搬桌):买即生效,不占等级。 */
  oneShot?: boolean;
  /** 免费(贷款):不占三选一购买预算的现金。 */
  free?: boolean;
};

/** 商店一次开门的陈列:恒 3 个维度,dims[0] 必为 1(元素系列保底)。 */
export type ShopOffer = {
  dims: [CardDim, CardDim, CardDim];
  /** 每维度 3 张(卡 id);UI 按 index 对齐 dims。 */
  cards: [string[], string[], string[]];
  /** 每维度是否已购/已跳过。 */
  resolved: [boolean, boolean, boolean];
  /** 每维度已刷新次数；下一次刷新价格按次数翻倍。 */
  rerollCounts: [number, number, number];
};

export type LoanState = {
  principal: number;
  totalDue: number;
  paid: number;
  shiftsLeft: number;
};

/** 搬桌时由逻辑层按桌面支撑图切割后交给场景的水平平移命令。 */
export type DeskMove = {
  uid: number;
  dx: number;
};

// ---- 检查日 -----------------------------------------------------------------

export type ShiftModifier = "none" | "rush" | "power" | "wind" | "audit";

// ---- 局状态 -----------------------------------------------------------------

export type RunPhase =
  | "loadout" // 亮桌图 + 选 3-10 物种
  | "hiring" // 开班 10 候选招聘
  | "shift" // 投掷中
  | "overtime" // KPI 达标后，剩余雇佣池逐只自动投放
  | "settlement" // 班末工资单（账单尚未支付）
  | "shop" // 班末商店(账单已付)
  | "summary" // 通关/无限死亡结算
  | "bankrupt"; // 破产结算

export type RunStats = {
  throws: number;
  bounces: number;
  strikes: number;
  dismissals: number;
  maxPulse: number;
  maxCombo: number;
  maxDesks: number;
};

export type ShiftCashFlow = {
  kind: "hire" | "reroll" | "refund" | "trickle" | "kpiBonus";
  amount: number;
};

/** Settlement detail rows only contain credited income. Hiring and rerolling
 * are already represented by spentTotal, so rendering them again as positive
 * flows would be both duplicate accounting and misleading UI. */
export function settlementIncomeFlows(cashFlows: readonly ShiftCashFlow[]): ShiftCashFlow[] {
  return cashFlows.filter((flow) => (
    flow.amount > 0
    && flow.kind !== "hire"
    && flow.kind !== "reroll"
  ));
}

export type ShiftSettlement = {
  shiftIndex: number;
  spentTotal: number;
  receivedTotal: number;
  bill: number;
  cashBeforeBill: number;
  /** 兼容旧续档：只扣常规账单后的余额；新 UI 使用 cashAfterPayment。 */
  cashAfterBill: number;
  /** 本班必须偿还的贷款金额；无贷款为 0。 */
  loanPayment?: number;
  /** 常规账单 + 本班贷款还款。 */
  requiredPayment?: number;
  /** 全部必要支付成功后的余额；不足时为 0。 */
  cashAfterPayment?: number;
  /** 现金不足以覆盖全部必要支付时的缺口。 */
  shortfall?: number;
  pulses: PulseBreakdown[];
  cashFlows: ShiftCashFlow[];
};

/** RogueRun.state 的只读视图(UI 渲染以此为准;引用每次变更都换新)。 */
export type RunView = {
  phase: RunPhase;
  shiftIndex: number; // 1 起
  endless: boolean;
  modifier: ShiftModifier;
  cash: number;
  revenueTotal: number;
  revenueShift: number;
  kpi: number;
  bill: number;
  quotaMax: number;
  quotaUsed: number;
  deskOrder: RogueElement[];
  /** 本班停用、不参与计分的桌子元素。 */
  disabledDesks: RogueElement[];
  loadout: string[];
  /** 雇佣池预览:[当前, 下一, 下下](物种 + 招聘记账价;不足补 null)。 */
  bagPreview: ({ species: string; price: number; baseValue: number; reach: number } | null)[];
  bagTotal: number;
  /** 加班时间尚未完成的人数（待跳 + 正在抛物线中 + 得分后正在返池）。 */
  overtimeRemaining: number;
  hiring: HiringView | null;
  combo: number;
  comboMult: number;
  strikeLine: number;
  /** 已购卡 id → 等级。 */
  cards: Record<string, number>;
  bodyStates: RogueBodyState[];
  loan: { perShift: number; remaining: number; shiftsLeft: number } | null;
  /** 解雇模式剩余点选数(>0 时场景进入点选)。 */
  pendingDismiss: number;
  /** 压价卡待选工种(买后 UI 弹 1~6 工种选择)。 */
  pendingPricecut: boolean;
  /** 搬桌模式已选中的第一张桌(null=未选;UI 给选中态描边)。 */
  deskSwapFirst: RogueElement | null;
  /** 破产预警(GDD 01 §10 预测口径:预测下班账单 > 现金 + 本班剩余 KPI 缺口)。 */
  dangerBankrupt: boolean;
  shop: ShopOffer | null;
  settlement: ShiftSettlement | null;
  /** 检查日运行参数（赶工墙钟截止 ts / 限电剩余手动投放次数；无则 null）。 */
  rushDeadline: number | null;
  powerThrowsLeft: number | null;
  stats: RunStats;
  /** 本局是否曾购买任意卡（含一次性卡和贷款）。 */
  boughtCardEver: boolean;
  /** 本局是否曾使用贷款；还清后仍保持 true。 */
  usedLoanEver: boolean;
  /** 本局已通过的四个检查节点：bit 0/1/2/3 = 第 5/10/15/20 班。 */
  inspectionMask: number;
  /** 本局是否曾在同一班发生至少三次罢工后仍通过该班。 */
  strikeClearEver: boolean;
  /** 本局是否已经完成第 20 班毕业；继续无限后仍保持 true。 */
  graduated: boolean;
};

// ---- 场景桥(FactoryScene 的 rogue prop) -----------------------------------

/** 场景 → 逻辑 的事件出口 + 逻辑 → 场景 的控制入口。全部回调都必须轻(热路径)。 */
export type RogueSceneBridge = {
  /** 续局时恢复的桌面宠物物理快照；仅首次挂载场景时消费。 */
  initialBodies?: BodyLike[];
  /** 机上下一只(雇佣池头);null = 空钩。 */
  nextCarried: () => { species: string } | null;
  /** 出手瞬间(付雇佣费;返回 false 则场景拒绝本次投掷)。 */
  onThrow: (uid: number, species: string) => boolean;
  /** 加班时间当前待跳角色；非加班阶段为 null。 */
  nextOvertime: () => { species: string } | null;
  /** 消费池头并计算当前场景的最高分落点。 */
  onOvertimeThrow: (uid: number, species: string, radius: number) => { x: number; y: number } | null;
  /** 落定并粘住:场景传 uid;逻辑层自取 bodies/desks 快照结算脉冲。 */
  onSettled: (uid: number) => void;
  /** 弹开确定(滚落地面/出场,未入塔):连击清零、回流退款。 */
  onBounced: (uid: number, species: string) => void;
  /** 罢工带走一组(uid 列表,同物种)。 */
  onStrike: (uids: number[], species: string) => void;
  /** 点选解雇命中(解雇模式下)。 */
  onDismissPick: (uid: number) => void;
  /** 任意方式离场(跑路者出屏):名额回收。 */
  onGone: (uid: number, reason: "strike" | "dismiss" | "rolloff" | "overtime") => void;
  /** 桌序(每局洗牌;搬桌后换新数组引用,场景重排+重算支撑)。 */
  deskOrder: RogueElement[];
  /** 搬桌操作切割后的塔体平移命令。 */
  takeDeskMoves?: () => DeskMove[];
  /** 停用桌用于场景特殊样式；计分过滤由逻辑层负责。 */
  disabledDesks?: RogueElement[];
  /** 罢工阈值（默认 3；工休只改变含水罢工组）。 */
  strikeCount: (elements?: readonly string[]) => number;
  /** 旧版按个体记录的当班豁免兼容入口。 */
  countsForStrike?: (uid: number) => boolean;
  /** 粘连判定覆写(万金油):返回 null = 按默认交集;true/false = 强制。 */
  stickOverride?: (a: BodyLike, b: BodyLike) => boolean | null;
  /** 横向风加速度 px/s²(大风日;0 = 无)。 */
  windAx: () => number;
  /** 全局时间倍率(hit-stop 慢镜;1=正常):场景 rAF 每帧乘到 dt 上。 */
  timeScale?: () => number;
  /** 桌宽倍率(首班教学加宽,04 §11;1=正常)。变更 → 场景重排桌子。 */
  deskWiden?: () => number;
  /** 首班前几次投放的落点指示；只读提示，不修改真实投放物理。 */
  showDropGuide?: () => boolean;
  /** 点击落定宠的行为:none=忽略(默认),dismiss=点选解雇。 */
  clickMode: () => "none" | "dismiss";
  /** 冻结状态供画布渲染层读取：冻结宠物定格姿态，只随冰块整体浮动。 */
  isBodyFrozen?: (uid: number) => boolean;
  /** 生长生成状态供画布渲染藤蔓；图案随角色共用同一变换与压暗。 */
  isBodyGenerated?: (uid: number) => boolean;
  /** 当前接入异属性桌通路、应显示为灰色睡眠态的咕噜。 */
  sleepingPathUids?: () => number[];
  /** 吸收质量对应的持久视觉缩放。 */
  bodyScale?: (uid: number) => number;
  /** 场景领取逻辑侧的吞噬移除命令。 */
  takeBodyMutations?: () => RogueBodyMutation[];
  /** 场景主循环同步永久状态层的位置，避免 DOM 落体与覆盖层各跑各的。 */
  positionBodyState?: (uid: number, x: number, y: number, bobY: number) => void;
  /** 草系生长队列；场景分配 uid 后从逻辑层领取一个生成请求。 */
  takeGeneratedSpawn?: (uid: number) => RogueSpawnRequest | null;
  /** 场景把 bodies/desks 快照读取器挂回来(逻辑层结算时调用)。 */
  registerSnapshots: (fns: { bodies: () => BodyLike[]; desks: () => DeskLike[] }) => void;
};

// ---- 局引擎公开 API(rogueRun.ts 的 RogueRun 实现它;UI 只经它交互) ----------

export interface RogueRunApi {
  /** 订阅变更(useSyncExternalStore);返回退订。 */
  subscribe(fn: () => void): () => void;
  /** 只读视图;每次变更换新引用。 */
  view(): RunView;

  // 场景桥入口(FactoryRogueScene 把这些转接进 RogueSceneBridge):
  nextCarried(): { species: string } | null;
  onThrow(uid: number, species: string): boolean;
  nextOvertime(): { species: string } | null;
  onOvertimeThrow(uid: number, species: string, radius: number): { x: number; y: number } | null;
  onSettled(uid: number): void;
  onBounced(uid: number, species: string): void;
  onStrike(uids: number[], species: string): void;
  onDismissPick(uid: number): void;
  onGone(uid: number, reason: "strike" | "dismiss" | "rolloff" | "overtime"): void;
  registerSnapshots(fns: { bodies: () => BodyLike[]; desks: () => DeskLike[] }): void;
  strikeCount(elements?: readonly string[]): number;
  stickOverride(a: BodyLike, b: BodyLike): boolean | null;
  windAx(): number;
  /** hit-stop 慢镜时间倍率(默认 1;大脉冲/多接桌短暂 <1)。 */
  timeScale(): number;
  /** 首班教学桌宽倍率(1=正常)。 */
  deskWiden(): number;
  clickMode(): "none" | "dismiss";
  isBodyFrozen(uid: number): boolean;
  isBodyGenerated(uid: number): boolean;
  sleepingPathUids(): number[];
  bodyScale(uid: number): number;
  takeBodyMutations(): RogueBodyMutation[];
  takeGeneratedSpawn(uid: number): RogueSpawnRequest | null;
  getDeskOrder(): RogueElement[];
  takeDeskMoves(): DeskMove[];
  countsForStrike(uid: number): boolean;

  // 商店:
  buyCard(dimIndex: 0 | 1 | 2, cardId: string): boolean;
  skipDim(dimIndex: 0 | 1 | 2): void;
  rerollDim(dimIndex: 0 | 1 | 2): boolean;
  /** 三维度全部处理完(买/跳)后进入下一班。 */
  finishShop(): void;
  /** 班末工资单确认后提交付款；成功进入商店，失败进入破产。 */
  confirmSettlement(): boolean;

  toggleHiringCandidate(id: number): void;
  setAllHiringCandidates(selected: boolean): void;
  toggleAllHiringCandidates(): void;
  rerollHiring(): boolean;
  confirmHiring(continueRecruiting?: boolean): boolean;

  // 搬桌（staff.movedesk 生效期；交换桌位与各自塔体，连通塔按图距离切割）:
  pendingDeskSwap(): boolean;
  pickDeskForSwap(element: RogueElement): void;
  /** 压价卡:选定工种(1~6)。 */
  pickPricecutTier(tierCount: number): void;

  /** 检查日/兜底驱动（250ms 间隔调用）：赶工、限电末次判定、风向翻转、破产复查。 */
  tick(nowMs: number): void;

  /** 毕业(20 班通关 summary)后继续无限模式:endless=true、进入第 21 班。
   *  (P1 追加:仅通关 summary 可调;无限段破产回 summary 冲榜。) */
  continueEndless(): void;

  /** 演出事件队列(取走即清):落地脉冲/追加脉冲。 */
  takePulses(): PulseBreakdown[];

  records(): RogueRecords;
}

// ---- 战绩持久化 -------------------------------------------------------------

export type RogueRecords = {
  bestRevenue: number;
  bestShift: number;
  endlessUnlocked: boolean;
  /** 累计开局数；与 runs（已结算局数）分开。 */
  starts: number;
  runs: number;
};

export const ROGUE_STORAGE_KEY = "gulugulu.factory_rogue.v1";

// ---- 未结束局的本地续局存档(与 ROGUE_STORAGE_KEY 战绩表分开,勿混用) ----------

/** 一局未结束的可续存档:只落「与物理堆无关」的经济/班次/商店状态 —— 桌上垒的塔
 *  不进存档(续局时堆从空开始),故 uid 维度/签袋/在班进度不序列化(续 shift 时重置)。
 *  仅在 phase 为 "shift" / "shop" 时写盘;结算/破产即清盘。 */
export type RogueRunSnapshot = {
  /** schema 版本(不兼容时读盘直接弃档)。 */
  v: number;
  /** 本局已经实际入库的角色升阶材料；仅供续局后终局结算展示。 */
  rewards?: Record<string, number>;
  loadout: string[];
  deskOrder: RogueElement[];
  /** 当前班次被禁运、不可参与计分的桌子；旧续档缺失时按空列表迁移。 */
  disabledDesks?: RogueElement[];
  /** 当前班桌面上的宠物。 */
  bodies: BodyLike[];
  /** 每只在场宠物的雇佣账务，供退款、成长与脉冲继续使用。 */
  bodyEconomy: {
    uid: number;
    species: string;
    cost: number;
    base: number;
    /** Departure ledger already settled while the scene exit animation is pending. */
    departed?: boolean;
  }[];
  bodyStates?: RogueBodyState[];
  /** mulberry32 内部状态(续局后随机序列可复现)。 */
  rngState: number;
  phase: "hiring" | "shift" | "overtime" | "settlement" | "shop";
  shiftIndex: number;
  endless: boolean;
  modifier: ShiftModifier;
  cash: number;
  revenueTotal: number;
  revenueShift: number;
  kpi: number;
  bill: number;
  quotaMax: number;
  quotaUsed: number;
  hireInflation: number[];
  hirePool: { species: string; price: number }[];
  /** 已完成加班得分、等待或已经逃回池中的角色；不会在读档后重复得分。 */
  overtimeReturned?: { species: string; price: number }[];
  hiringCandidates: { id: number; species: string; selected: boolean }[];
  hiringRound: number;
  hiringRerollsUsed: number;
  hiringRerollSpent: number;
  combo: number;
  cards: Record<string, number>;
  /** principal/totalDue/paid 为新贷款字段；兼容只有 shiftsLeft 的旧档。 */
  loan: ({ shiftsLeft: number } & Partial<Pick<LoanState, "principal" | "totalDue" | "paid">>) | null;
  boughtCardEver: boolean;
  usedLoanEver: boolean;
  inspectionMask: number;
  strikeClearEver: boolean;
  shiftStrikeCount: number;
  graduated: boolean;
  pendingDismissN: number;
  pendingPricecutFlag: boolean;
  pricecutTier: number | null;
  shopOffer: ShopOffer | null;
  settlement: ShiftSettlement | null;
  /** 限电日剩余手动投放次数；v9 旧档缺失时按完整额度迁移。 */
  powerThrowsLeft?: number | null;
  /** 赶工墙钟剩余的有效游玩时间；v9 旧档缺失时按完整时限迁移。 */
  rushRemainingMs?: number | null;
  /** 大风当前方向与距离下次翻向的有效游玩时间。 */
  windSign?: 1 | -1;
  windFlipRemainingMs?: number | null;
  stats: RunStats;
  deskSwapPending: boolean;
  deskSwapFirst: RogueElement | null;
};

export const ROGUE_RUN_STORAGE_KEY = "gulugulu.factory_rogue.run.v1";
