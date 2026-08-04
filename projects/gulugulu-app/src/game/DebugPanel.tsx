import { useEffect, useRef, useState } from "react";
import type { GameConfig, GameSave, PetState } from "../types";
import { SvgSprite } from "../sprites/SvgSprite";
import { ReactionBurst } from "../sprites/parts/vfx";
import { WORK_FX, WorkBurst } from "../sprites/parts/workFx";
import type { GameBridge } from "./bridge";
import { formatCount } from "./format";
import { ROGUE_RUN_STORAGE_KEY, ROGUE_STORAGE_KEY } from "./factory/rogueTypes";
import type { ConfirmGameDialog } from "../app/GameDialog";
import { useT } from "../useT";
import { DEBUG_STRINGS } from "../i18n/debug";
import { fmt } from "../i18n/core";
import { speciesDisplayName } from "../i18n/species";

// -----------------------------------------------------------------------------
// 动画调试面板（计划 §四）：逐个选择 27 只角色，预览全部状态动画。
// 全部状态自持（panel-local），与主舞台/真实 agent 事件完全隔离。
// -----------------------------------------------------------------------------

// 已合并的重复动画不再单列：打工=工作、力竭=睡眠、被拎起=拖拽中
const DEBUG_STATES: PetState[] = ["idle", "moving", "working", "success", "fed", "thinking", "sleeping", "dragging", "drop", "error"];

/** one-shot 状态在预览中自动循环重播的间隔（动画时长 + 缓冲） */
const ONE_SHOT_REPLAY_MS: Partial<Record<PetState, number>> = {
  success: 1900,
  fed: 2100,
  drop: 1400,
  error: 1600,
};

const CYCLE_INTERVAL_MS = 2500;

/** Coins granted per click of the “增加金币” debug button. */
const DEBUG_COIN_GRANT = 10000;

function debugErrorText(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : fallback;
}

export function DebugPanel({
  config,
  save,
  bridge,
  onSave,
  onToast,
  onFeedTokens,
  onOpenFactoryDemo,
  onConfirm,
}: {
  config: GameConfig;
  save: GameSave | null;
  bridge: GameBridge;
  onSave: (save: GameSave) => void;
  onToast: (message: string) => void;
  /** 预览模式专属：模拟 agent Token 喂食（→ 陪伴宠经验，走主舞台进食队列）。 */
  onFeedTokens?: (amount: number) => void;
  /** Debug 专属入口：进入工厂「经典演示」沙盒（FactoryScene 不传 rogue）。 */
  onOpenFactoryDemo?: () => void;
  /** 所有危险操作统一走游戏内便签确认，不调用浏览器原生对话框。 */
  onConfirm: ConfirmGameDialog;
}) {
  const { lang } = useT();
  const D = DEBUG_STRINGS[lang];
  const [species, setSpecies] = useState("guluduck");
  const [petState, setPetState] = useState<PetState>("idle");
  const [facing, setFacing] = useState<"left" | "right">("right");
  const [cycling, setCycling] = useState(false);
  const [replayTick, setReplayTick] = useState(0);
  const [pulseFlip, setPulseFlip] = useState(-1);
  const [bursts, setBursts] = useState<number[]>([]);
  const burstIdRef = useRef(0);

  // 存档调试：直接读写真实游戏存档（Tauri）或预览存档（浏览器）。
  const [saveBusy, setSaveBusy] = useState(false);

  const runSaveDebug = (action: () => Promise<GameSave>, describe: (save: GameSave) => string) => {
    if (saveBusy) return;
    setSaveBusy(true);
    action()
      .then((next) => {
        onSave(next);
        onToast(describe(next));
      })
      .catch((error) => onToast(debugErrorText(error, D.error)))
      .finally(() => setSaveBusy(false));
  };

  const debugAddCoins = () =>
    runSaveDebug(
      () => bridge.debugAddCoins(DEBUG_COIN_GRANT),
      (next) => fmt(D.coinAdded, { amount: DEBUG_COIN_GRANT, coins: next.coins }),
    );

  const debugHatchNow = () =>
    runSaveDebug(
      () => bridge.debugHatchNow(),
      (next) => {
        const ready = next.eggs.filter((egg) => egg.slot != null).length;
        return ready > 0 ? fmt(D.hatchReady, { count: ready }) : D.hatchNone;
      },
    );

  const debugMaxPets = () =>
    runSaveDebug(
      () => bridge.debugMaxPets(),
      (next) => (next.pets.length > 0 ? fmt(D.petsMaxed, { count: next.pets.length }) : D.petsNone),
    );

  const confirmDanger = (message: string) =>
    onConfirm({
      title: D.dangerTitle,
      message,
      confirmLabel: D.confirm,
      cancelLabel: D.cancel,
      tone: "danger",
    });

  const debugClearSave = async () => {
    if (!(await confirmDanger(D.clearSavePrompt))) return;
    runSaveDebug(
      () => bridge.debugClearSave(),
      () => D.clearSaveDone,
    );
  };

  const debugDrainStamina = () =>
    runSaveDebug(
      () => bridge.debugDrainStamina(),
      () => D.staminaDrained,
    );

  const debugFeedKeys = () =>
    runSaveDebug(
      () => bridge.debugFeedKeys(30),
      () => D.keysFed,
    );

  // 清空本账号在本游戏发布的全部创意工坊内容（真机 Steam 侧删除，不可逆）。
  // 复用 saveBusy 作在途闸门（删除可能耗时，期间禁其余调试按钮）。
  const debugClearWorkshop = async () => {
    if (saveBusy) return;
    if (!(await confirmDanger(D.clearWorkshopPrompt))) return;
    setSaveBusy(true);
    bridge
      .debugClearWorkshop()
      .then(({ deleted, failed }) => {
        onToast(
          failed > 0
            ? fmt(D.workshopPartial, { deleted, failed })
            : deleted > 0
              ? fmt(D.workshopDeleted, { deleted })
              : D.workshopEmpty,
        );
      })
      .catch((error) => onToast(debugErrorText(error, D.error)))
      .finally(() => setSaveBusy(false));
  };

  // 清空本账号在本游戏的 Steam 库存物品（逐件 ConsumeItem，不可逆）。
  // 注意：集成仍在跑时，本地存档尚有未绑定宠物会被 outbox 随后重新发放——
  // 要彻底清零请配合「清除存档」。
  const debugClearInventory = async () => {
    if (saveBusy) return;
    if (!(await confirmDanger(
      D.clearInventoryPrompt,
    ))) return;
    setSaveBusy(true);
    bridge
      .debugClearInventory()
      .then((count) => {
        onToast(count > 0 ? fmt(D.inventoryDeleted, { count }) : D.inventoryEmpty);
      })
      .catch((error) => onToast(debugErrorText(error, D.error)))
      .finally(() => setSaveBusy(false));
  };

  const debugClearFactory = async () => {
    if (saveBusy) return;
    if (!(await confirmDanger(D.clearFactoryPrompt))) return;
    setSaveBusy(true);
    bridge.debugClearFactoryLeaderboard()
      .then(() => bridge.debugClearFactoryData())
      .then((next) => {
        window.localStorage.removeItem(ROGUE_STORAGE_KEY);
        window.localStorage.removeItem(ROGUE_RUN_STORAGE_KEY);
        onSave(next);
        onToast(D.clearFactoryDone);
      })
      .catch((error) => onToast(debugErrorText(error, D.error)))
      .finally(() => setSaveBusy(false));
  };

  const speciesEntries = Object.entries(config.species);
  // 融合 2.0：新物种无自带 tier，按元素数分组（单元素基础 / 多元素融合），显示全谱。
  const tier1 = speciesEntries.filter(([, info]) => (info.elements?.length ?? 1) === 1);
  const tier2 = speciesEntries.filter(([, info]) => (info.elements?.length ?? 1) >= 2);
  const info = config.species[species];
  const elementColor = config.elements[info?.elements[0] ?? "normal"]?.color ?? "#F5917B";

  // one-shot 状态自动重播（重挂 sprite key）
  useEffect(() => {
    const interval = ONE_SHOT_REPLAY_MS[petState];
    if (!interval || cycling) return;
    const timer = window.setInterval(() => setReplayTick((tick) => tick + 1), interval);
    return () => window.clearInterval(timer);
  }, [petState, cycling]);

  // 自动轮播全部状态
  useEffect(() => {
    if (!cycling) return;
    const timer = window.setInterval(() => {
      setPetState((prev) => {
        const index = DEBUG_STATES.indexOf(prev);
        return DEBUG_STATES[(index + 1) % DEBUG_STATES.length];
      });
    }, CYCLE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [cycling]);

  // 打工粒子连点演示（本地连击计数，与真实存档无关）
  const demoComboRef = useRef({ count: 0, last: 0 });
  const [demoBursts, setDemoBursts] = useState<Array<{ id: number; tier: number; seed: number; boom: boolean }>>([]);

  const triggerReaction = () => {
    setPulseFlip((flip) => (flip < 0 ? 0 : flip + 1));
    const id = burstIdRef.current + 1;
    burstIdRef.current = id;
    setBursts((list) => [...list.slice(-2), id]);
    window.setTimeout(() => {
      setBursts((list) => list.filter((item) => item !== id));
    }, 650);

    // 六个一阶角色：同步演示工具粒子（连击窗口 1.1s）
    if (WORK_FX[species]) {
      const now = Date.now();
      const combo = demoComboRef.current;
      if (now - combo.last > 1100) combo.count = 0;
      combo.count += 1;
      combo.last = now;
      const burstId = id * 131 + combo.count;
      setDemoBursts((list) => [
        ...list.slice(-7),
        {
          id: burstId,
          tier: Math.min(combo.count, 18),
          seed: (Math.random() * 0xffffffff) >>> 0,
          boom: combo.count % 10 === 0,
        },
      ]);
      window.setTimeout(() => {
        setDemoBursts((list) => list.filter((item) => item.id !== burstId));
      }, 1250);
    }
  };

  const pulseClass =
    pulseFlip < 0 ? "" : pulseFlip % 2 === 0 ? "pet-react-pulse-a" : "pet-react-pulse-b";

  return (
    <div className="debug-panel">
      {/* 存档调试：真实读写游戏存档 */}
      <div className="debug-game">
        <span className="debug-group-label">{D.saveDebug}</span>
        <div className="debug-game-readout">
          {fmt(D.readout, { coins: formatCount(save?.coins ?? 0, lang), pets: save?.pets.length ?? 0, eggs: save?.eggs.length ?? 0 })}
        </div>
        <div className="debug-game-row">
          <button type="button" disabled={saveBusy} onClick={debugAddCoins}>
            {fmt(D.addCoins, { amount: DEBUG_COIN_GRANT })}
          </button>
          <button type="button" disabled={saveBusy} onClick={debugHatchNow}>
            {D.hatchNow}
          </button>
          <button type="button" disabled={saveBusy} onClick={debugMaxPets}>
            {D.maxNow}
          </button>
          <button type="button" className="is-danger" disabled={saveBusy} onClick={debugClearSave}>
            {D.clearSave}
          </button>
          <button type="button" disabled={saveBusy} onClick={debugDrainStamina}>
            {D.drainStamina}
          </button>
          <button type="button" disabled={saveBusy} onClick={debugFeedKeys}>
            {D.simulateKeys}
          </button>
          {onFeedTokens && (
            <>
              <button type="button" disabled={saveBusy} onClick={() => onFeedTokens(2000)}>
                Token 2k🍙
              </button>
              <button type="button" disabled={saveBusy} onClick={() => onFeedTokens(8000)}>
                Token 8k🍙
              </button>
              <button type="button" disabled={saveBusy} onClick={() => onFeedTokens(32000)}>
                Token 32k🍙
              </button>
            </>
          )}
        </div>
      </div>

      {/* Steam 调试：真机 Steam 侧操作（开发版 + 集成开启才生效，否则后端回错误提示） */}
      <div className="debug-game">
        <span className="debug-group-label">{D.steamDebug}</span>
        <div className="debug-game-row">
          <button type="button" className="is-danger" disabled={saveBusy} onClick={debugClearWorkshop}>
            {D.clearWorkshop}
          </button>
          <button type="button" className="is-danger" disabled={saveBusy} onClick={debugClearInventory}>
            {D.clearInventory}
          </button>
        </div>
      </div>

      {/* 工厂调试：经典演示沙盒（旧 FactoryScene，无关卡制/不产材料）。 */}
      {onOpenFactoryDemo && (
        <div className="debug-game">
          <span className="debug-group-label">{D.factoryDebug}</span>
          <div className="debug-game-row">
            <button type="button" className="is-danger" disabled={saveBusy} onClick={debugClearFactory}>
              {D.clearFactory}
            </button>
            <button type="button" onClick={onOpenFactoryDemo}>
              {D.classicDemo}
            </button>
          </div>
        </div>
      )}

      {/* 预览台：复用主舞台的 state/facing CSS（含 facing-left 镜像） */}
      <div className={`debug-stage state-${petState} facing-${facing}`}>
        <div className="duck-facing debug-preview" onPointerDown={triggerReaction} title={D.previewTitle}>
          <div className={`pet-react-pulse ${pulseClass}`}>
            <SvgSprite
              key={`${species}-${petState}-${replayTick}`}
              species={species}
              config={config}
              petState={petState}
              className="duck duck-svg"
            />
          </div>
          {bursts.map((id) => (
            <ReactionBurst key={id} color={elementColor} />
          ))}
          {demoBursts.map((burst) => (
            <WorkBurst key={burst.id} species={species} tier={burst.tier} seed={burst.seed} boom={burst.boom} />
          ))}
        </div>
      </div>
      <div className="debug-info">
        <strong>{speciesDisplayName(species, lang, info?.nameZh, info?.nameEn)}</strong>
        <span>{D.states[petState] ?? petState}</span>
        <span className="debug-info-dim">{species}</span>
      </div>

      {/* 控制行 */}
      <div className="debug-controls">
        <button
          type="button"
          className={facing === "left" ? "is-active" : ""}
          onClick={() => setFacing("left")}
        >
          {D.faceLeft}
        </button>
        <button
          type="button"
          className={facing === "right" ? "is-active" : ""}
          onClick={() => setFacing("right")}
        >
          {D.faceRight}
        </button>
        <button type="button" onClick={triggerReaction}>
          {D.clickFeedback}
        </button>
        <button
          type="button"
          className={cycling ? "is-active" : ""}
          onClick={() => setCycling((value) => !value)}
        >
          {cycling ? D.stopCycle : D.autoCycle}
        </button>
      </div>

      {/* 状态选择 */}
      <div className="debug-states">
        {DEBUG_STATES.map((state) => (
          <button
            key={state}
            type="button"
            className={petState === state ? "is-active" : ""}
            onClick={() => {
              setCycling(false);
              setPetState(state);
              setReplayTick((tick) => tick + 1);
            }}
          >
            {D.states[state] ?? state}
          </button>
        ))}
      </div>

      {/* 物种选择 */}
      <div className="debug-species">
        <span className="debug-group-label">{fmt(D.singleElement, { count: tier1.length })}</span>
        <div className="debug-species-grid">
          {tier1.map(([codename, speciesInfo]) => (
            <button
              key={codename}
              type="button"
              className={`debug-species-card ${species === codename ? "is-active" : ""}`}
              onClick={() => setSpecies(codename)}
              title={codename}
            >
              <SvgSprite species={codename} config={config} petState="idle" className="debug-thumb" />
              <span>{speciesDisplayName(codename, lang, speciesInfo.nameZh, speciesInfo.nameEn)}</span>
            </button>
          ))}
        </div>
        <span className="debug-group-label">{fmt(D.multiElement, { count: tier2.length })}</span>
        <div className="debug-species-grid">
          {tier2.map(([codename, speciesInfo]) => (
            <button
              key={codename}
              type="button"
              className={`debug-species-card ${species === codename ? "is-active" : ""}`}
              onClick={() => setSpecies(codename)}
              title={codename}
            >
              <SvgSprite species={codename} config={config} petState="idle" className="debug-thumb" />
              <span>{speciesDisplayName(codename, lang, speciesInfo.nameZh, speciesInfo.nameEn)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
