import { createLanguageMap, type Language } from "./core";
import { generatedDomainLocales } from "./generatedLocales";

export type DebugStrings = {
  states: Record<string, string>;
  error: string;
  coinAdded: string;
  hatchReady: string;
  hatchNone: string;
  petsMaxed: string;
  petsNone: string;
  dangerTitle: string;
  confirm: string;
  cancel: string;
  clearSavePrompt: string;
  clearSaveDone: string;
  staminaDrained: string;
  keysFed: string;
  clearWorkshopPrompt: string;
  workshopPartial: string;
  workshopDeleted: string;
  workshopEmpty: string;
  clearInventoryPrompt: string;
  inventoryDeleted: string;
  inventoryEmpty: string;
  clearFactoryPrompt: string;
  clearFactoryDone: string;
  saveDebug: string;
  readout: string;
  addCoins: string;
  hatchNow: string;
  maxNow: string;
  clearSave: string;
  drainStamina: string;
  simulateKeys: string;
  steamDebug: string;
  clearWorkshop: string;
  clearInventory: string;
  factoryDebug: string;
  clearFactory: string;
  classicDemo: string;
  previewTitle: string;
  faceLeft: string;
  faceRight: string;
  clickFeedback: string;
  stopCycle: string;
  autoCycle: string;
  singleElement: string;
  multiElement: string;
};

export const DEBUG_EN: DebugStrings = {
  states: { idle: "Idle", moving: "Moving", working: "Working", success: "Celebrating", fed: "Eating", thinking: "Thinking", sleeping: "Sleeping", dragging: "Dragging", drop: "Landing", error: "Error" },
  error: "Operation failed",
  coinAdded: "+{amount} coins (current: {coins})",
  hatchReady: "Finished hatching {count} egg(s); ready to collect",
  hatchNone: "No eggs are currently hatching",
  petsMaxed: "Raised {count} pet(s) to max level",
  petsNone: "There are no pets yet",
  dangerTitle: "Confirm dangerous operation",
  confirm: "Confirm",
  cancel: "Cancel",
  clearSavePrompt: "Clear the save and return to the initial state? This cannot be undone.",
  clearSaveDone: "Save cleared; returned to the initial state",
  staminaDrained: "Main pet stamina drained (tests recovery, wake-up, and keyboard charging)",
  keysFed: "Simulated 30 keystrokes (restores companion stamina and records it by tier)",
  clearWorkshopPrompt: "Delete every item this account published to this game's Workshop? This cannot be undone.",
  workshopPartial: "Deleted {deleted} Workshop item(s); {failed} failed (see logs)",
  workshopDeleted: "Deleted {deleted} Workshop item(s)",
  workshopEmpty: "No Workshop items from this game can be deleted",
  clearInventoryPrompt: "Clear every inventory item for this game from this Steam account?\nThis cannot be undone. Pets still in the local save may be issued again; clear the save too for a full reset.",
  inventoryDeleted: "Cleared {count} inventory item(s)",
  inventoryEmpty: "Inventory is already empty",
  clearFactoryPrompt: "Clear Steam factory rankings, local history, resume data, and today's factory rewards? This cannot be undone.",
  clearFactoryDone: "Factory data and Steam ranking scores cleared; testing can restart",
  saveDebug: "Save debug",
  readout: "Coins {coins} · Pets {pets} · Eggs {eggs}",
  addCoins: "Add coins +{amount}",
  hatchNow: "Hatch now",
  maxNow: "Max level now",
  clearSave: "Clear save",
  drainStamina: "Drain stamina",
  simulateKeys: "Simulate 30 keys",
  steamDebug: "Steam debug",
  clearWorkshop: "Clear my Workshop",
  clearInventory: "Clear my inventory",
  factoryDebug: "Factory debug",
  clearFactory: "🧹 Clear factory data",
  classicDemo: "🛝 Classic Sandbox demo",
  previewTitle: "Click to preview click feedback",
  faceLeft: "← Face left",
  faceRight: "Face right →",
  clickFeedback: "Click feedback",
  stopCycle: "Stop cycling",
  autoCycle: "Auto cycle",
  singleElement: "Single element ({count})",
  multiElement: "Multi-element fusion ({count})",
};

const zh: DebugStrings = {
  states: { idle: "待机", moving: "移动", working: "工作", success: "庆祝", fed: "进食", thinking: "思考", sleeping: "睡眠", dragging: "拖拽", drop: "落地", error: "出错" },
  error: "操作失败", coinAdded: "+{amount} 金币（当前 {coins}）", hatchReady: "已完成 {count} 颗蛋的孵化，可立即领取", hatchNone: "当前没有正在孵化的蛋", petsMaxed: "{count} 只精灵已升到满级", petsNone: "还没有精灵",
  dangerTitle: "危险操作确认", confirm: "确认执行", cancel: "取消", clearSavePrompt: "确定清除存档并回到初始状态？此操作不可撤销。", clearSaveDone: "存档已清除，回到初始状态", staminaDrained: "主宠精力已放空（验证恢复期/唤醒/键盘充能）", keysFed: "模拟敲了 30 个键（只给陪伴宠回精力，按阶换算入账）",
  clearWorkshopPrompt: "确定删除本账号在创意工坊发布的本游戏全部内容？此操作不可撤销。", workshopPartial: "已删除 {deleted} 件创意工坊物品，{failed} 件失败（详见日志）", workshopDeleted: "已删除 {deleted} 件创意工坊物品", workshopEmpty: "创意工坊没有可删除的本游戏物品",
  clearInventoryPrompt: "确定清除本账号在 Steam 的本游戏全部库存物品？\n此操作不可撤销；若本地存档仍有宠物，集成会稍后自动重新发放（彻底清零请配合“清除存档”）。", inventoryDeleted: "已清除 {count} 件库存物品", inventoryEmpty: "库存已空，无可清除",
  clearFactoryPrompt: "确定清除 Steam 工厂排行、本地工厂历史、续局和今日工厂奖励数据？此操作不可撤销。", clearFactoryDone: "工厂数据与 Steam 排行成绩已清除，可以从头测试",
  saveDebug: "存档调试", readout: "金币 {coins} · 精灵 {pets} · 蛋 {eggs}", addCoins: "增加金币 +{amount}", hatchNow: "立即孵化", maxNow: "立即满级", clearSave: "清除存档", drainStamina: "放空精力", simulateKeys: "模拟 30 键", steamDebug: "Steam 调试", clearWorkshop: "清空我的创意工坊", clearInventory: "清空我的库存资产", factoryDebug: "工厂调试", clearFactory: "🧹 清除工厂数据记录", classicDemo: "🛝 经典演示 Classic Sandbox", previewTitle: "点击预览点击反馈", faceLeft: "← 朝左", faceRight: "朝右 →", clickFeedback: "点击反馈", stopCycle: "停止轮播", autoCycle: "自动轮播", singleElement: "单元素（{count}）", multiElement: "多元素融合（{count}）",
};

export const DEBUG_STRINGS: Record<Language, DebugStrings> = createLanguageMap(
  DEBUG_EN,
  zh,
  generatedDomainLocales("debug") as Partial<Record<Language, DebugStrings>>,
);
