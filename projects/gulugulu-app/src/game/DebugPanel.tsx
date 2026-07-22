import { useEffect, useRef, useState } from "react";
import type { GameConfig, GameSave, PetState } from "../types";
import { SvgSprite } from "../sprites/SvgSprite";
import { ReactionBurst } from "../sprites/parts/vfx";
import { WORK_FX, WorkBurst } from "../sprites/parts/workFx";
import type { GameBridge } from "./bridge";
import { formatCount } from "./format";

// -----------------------------------------------------------------------------
// 动画调试面板（计划 §四）：逐个选择 27 只角色，预览全部状态动画。
// 全部状态自持（panel-local），与主舞台/真实 agent 事件完全隔离。
// -----------------------------------------------------------------------------

// 已合并的重复动画不再单列：打工=工作、力竭=睡眠、被拎起=拖拽中
const DEBUG_STATES: Array<{ state: PetState; label: string }> = [
  { state: "idle", label: "待机" },
  { state: "moving", label: "移动" },
  { state: "working", label: "工作" },
  { state: "success", label: "庆祝" },
  { state: "fed", label: "进食" },
  { state: "thinking", label: "思考" },
  { state: "sleeping", label: "睡眠" },
  { state: "dragging", label: "拖拽" },
  { state: "drop", label: "落地" },
  { state: "error", label: "出错" },
];

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

function debugErrorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "操作失败";
}

export function DebugPanel({
  config,
  save,
  bridge,
  onSave,
  onToast,
  onFeedTokens,
}: {
  config: GameConfig;
  save: GameSave | null;
  bridge: GameBridge;
  onSave: (save: GameSave) => void;
  onToast: (message: string) => void;
  /** 预览模式专属：模拟 agent Token 喂食（→ 陪伴宠经验，走主舞台进食队列）。 */
  onFeedTokens?: (amount: number) => void;
}) {
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
      .catch((error) => onToast(debugErrorText(error)))
      .finally(() => setSaveBusy(false));
  };

  const debugAddCoins = () =>
    runSaveDebug(
      () => bridge.debugAddCoins(DEBUG_COIN_GRANT),
      (next) => `+${DEBUG_COIN_GRANT} 金币（当前 ${next.coins}）`,
    );

  const debugHatchNow = () =>
    runSaveDebug(
      () => bridge.debugHatchNow(),
      (next) => {
        const ready = next.eggs.filter((egg) => egg.slot != null).length;
        return ready > 0 ? `已完成 ${ready} 颗蛋的孵化，可立即领取` : "当前没有正在孵化的蛋";
      },
    );

  const debugMaxPets = () =>
    runSaveDebug(
      () => bridge.debugMaxPets(),
      (next) => (next.pets.length > 0 ? `${next.pets.length} 只精灵已升到满级` : "还没有精灵"),
    );

  const debugClearSave = () => {
    if (!window.confirm("确定清除存档并回到初始状态？此操作不可撤销。")) return;
    runSaveDebug(
      () => bridge.debugClearSave(),
      () => "存档已清除，回到初始状态",
    );
  };

  const debugDrainStamina = () =>
    runSaveDebug(
      () => bridge.debugDrainStamina(),
      () => "主宠精力已放空（验证恢复期/唤醒/键盘充能）",
    );

  const debugFeedKeys = () =>
    runSaveDebug(
      () => bridge.debugFeedKeys(30),
      () => "模拟敲了 30 个键（只给陪伴宠回精力，按阶换算入账）",
    );

  // 清空本账号在本游戏发布的全部创意工坊内容（真机 Steam 侧删除，不可逆）。
  // 复用 saveBusy 作在途闸门（删除可能耗时，期间禁其余调试按钮）。
  const debugClearWorkshop = () => {
    if (saveBusy) return;
    if (!window.confirm("确定删除本账号在创意工坊发布的本游戏全部内容？此操作不可撤销。")) return;
    setSaveBusy(true);
    bridge
      .debugClearWorkshop()
      .then(({ deleted, failed }) => {
        onToast(
          failed > 0
            ? `已删除 ${deleted} 件创意工坊物品，${failed} 件失败（详见日志）`
            : deleted > 0
              ? `已删除 ${deleted} 件创意工坊物品`
              : "创意工坊没有可删除的本游戏物品",
        );
      })
      .catch((error) => onToast(debugErrorText(error)))
      .finally(() => setSaveBusy(false));
  };

  // 清空本账号在本游戏的 Steam 库存物品（逐件 ConsumeItem，不可逆）。
  // 注意：集成仍在跑时，本地存档尚有未绑定宠物会被 outbox 随后重新发放——
  // 要彻底清零请配合「清除存档」。
  const debugClearInventory = () => {
    if (saveBusy) return;
    if (
      !window.confirm(
        "确定清除本账号在 Steam 的本游戏全部库存物品？\n此操作不可撤销；若本地存档仍有宠物，集成会稍后自动重新发放（彻底清零请配合「清除存档」）。",
      )
    )
      return;
    setSaveBusy(true);
    bridge
      .debugClearInventory()
      .then((count) => {
        onToast(count > 0 ? `已清除 ${count} 件库存物品` : "库存已空，无可清除");
      })
      .catch((error) => onToast(debugErrorText(error)))
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
        const index = DEBUG_STATES.findIndex((item) => item.state === prev);
        return DEBUG_STATES[(index + 1) % DEBUG_STATES.length].state;
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
        <span className="debug-group-label">存档调试</span>
        <div className="debug-game-readout">
          金币 {formatCount(save?.coins ?? 0)} · 精灵 {save?.pets.length ?? 0} · 蛋 {save?.eggs.length ?? 0}
        </div>
        <div className="debug-game-row">
          <button type="button" disabled={saveBusy} onClick={debugAddCoins}>
            增加金币 +{DEBUG_COIN_GRANT}
          </button>
          <button type="button" disabled={saveBusy} onClick={debugHatchNow}>
            立即孵化
          </button>
          <button type="button" disabled={saveBusy} onClick={debugMaxPets}>
            立即满级
          </button>
          <button type="button" className="is-danger" disabled={saveBusy} onClick={debugClearSave}>
            清除存档
          </button>
          <button type="button" disabled={saveBusy} onClick={debugDrainStamina}>
            放空精力
          </button>
          <button type="button" disabled={saveBusy} onClick={debugFeedKeys}>
            模拟 30 键
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
        <span className="debug-group-label">Steam 调试</span>
        <div className="debug-game-row">
          <button type="button" className="is-danger" disabled={saveBusy} onClick={debugClearWorkshop}>
            清空我的创意工坊
          </button>
          <button type="button" className="is-danger" disabled={saveBusy} onClick={debugClearInventory}>
            清空我的库存资产
          </button>
        </div>
      </div>

      {/* 预览台：复用主舞台的 state/facing CSS（含 facing-left 镜像） */}
      <div className={`debug-stage state-${petState} facing-${facing}`}>
        <div className="duck-facing debug-preview" onPointerDown={triggerReaction} title="点击预览点击反馈">
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
        <strong>{info?.nameZh ?? species}</strong>
        <span>{DEBUG_STATES.find((item) => item.state === petState)?.label ?? petState}</span>
        <span className="debug-info-dim">{species}</span>
      </div>

      {/* 控制行 */}
      <div className="debug-controls">
        <button
          type="button"
          className={facing === "left" ? "is-active" : ""}
          onClick={() => setFacing("left")}
        >
          ← 朝左
        </button>
        <button
          type="button"
          className={facing === "right" ? "is-active" : ""}
          onClick={() => setFacing("right")}
        >
          朝右 →
        </button>
        <button type="button" onClick={triggerReaction}>
          点击反馈
        </button>
        <button
          type="button"
          className={cycling ? "is-active" : ""}
          onClick={() => setCycling((value) => !value)}
        >
          {cycling ? "停止轮播" : "自动轮播"}
        </button>
      </div>

      {/* 状态选择 */}
      <div className="debug-states">
        {DEBUG_STATES.map((item) => (
          <button
            key={item.state}
            type="button"
            className={petState === item.state ? "is-active" : ""}
            onClick={() => {
              setCycling(false);
              setPetState(item.state);
              setReplayTick((tick) => tick + 1);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* 物种选择 */}
      <div className="debug-species">
        <span className="debug-group-label">单元素（{tier1.length}）</span>
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
              <span>{speciesInfo.nameZh}</span>
            </button>
          ))}
        </div>
        <span className="debug-group-label">多元素融合（{tier2.length}）</span>
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
              <span>{speciesInfo.nameZh}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
