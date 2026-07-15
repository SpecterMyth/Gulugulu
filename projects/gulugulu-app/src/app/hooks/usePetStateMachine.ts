import { type Dispatch, type MutableRefObject, type RefObject, type SetStateAction, useCallback, useRef, useState } from "react";
import {
  AGENT_ACTIVE_WINDOW_MS,
  agentActivityEventTypes,
  stateForPetEvent,
  sustainedAgentBaseline,
} from "../../petEvents";
import type { PetEvent, PetEventType, PetState } from "../../types";
import { makePetEvent, shouldSpeakForEvent } from "../speech";

const interruptibleDuringSuccess = new Set<PetEventType>([
  "pet_idle",
  "user_click",
  "user_work_click",
  "user_drag_start",
  "user_drag_move",
  "user_drag_end",
  "agent_error",
]);

/** "软归位"事件：只是把状态收回 idle、本身没有动画表现（工具收尾/会话开始/漫游停止）。
 *  睡着或趴着恢复精力时忽略它们——否则每次 agent 工具结束都会闪一帧站立待机。 */
const idleSettleEventTypes = new Set<PetEventType>([
  "pet_idle",
  "pet_move_stop",
  "agent_tool_finish",
]);

export type PetStateMachine = {
  petState: PetState;
  stateRef: RefObject<PetState>;
  lastEventAt: number;
  setLastEventAt: Dispatch<SetStateAction<number>>;
  agentActiveUntilRef: RefObject<number>;
  dispatchPetEvent: (event: PetEvent) => void;
  dispatchLocalEvent: (type: PetEventType) => void;
  settleAfterOneShot: () => void;
};

/** 宠物状态机 + Agent 活跃锁存：拥有 petState/stateRef/lastEventAt 与活跃期 latch refs，
 *  以及 dispatchPetEvent/dispatchLocalEvent/settleAfterOneShot 三个转移回调。相关的到期
 *  归位/睡眠/锁存超时 effect 仍留在 App（读取这里 return 的 API），以保证 effect 顺序不变。 */
export function usePetStateMachine(
  showSpeechForState: (state: PetState) => void,
  activePetExhaustedRef: MutableRefObject<boolean>,
  autonomousMovePlayedRef: MutableRefObject<boolean>,
): PetStateMachine {
  const [petState, setPetState] = useState<PetState>("idle");
  const [lastEventAt, setLastEventAt] = useState(Date.now());
  const stateRef = useRef<PetState>("idle");

  // Agent 活跃锁存：agentActiveUntilRef = 「有 Agent 在跑」的截止时刻（每条
  // codex://activity 事件刷新）；agentBaselineRef = 活跃期底色（thinking/working）。
  const agentActiveUntilRef = useRef(0);
  const agentBaselineRef = useRef<PetState>("working");

  const dispatchPetEvent = useCallback((event: PetEvent) => {
    // 任何 Agent 事件都刷新活跃窗口 + 记录持续型基线——即使随后被 success /
    // 睡眠守卫丢弃，也保持"有 Agent 在跑"，避免基线在事件突发的间隙过早回落。
    if (agentActivityEventTypes.has(event.type)) {
      agentActiveUntilRef.current = Date.now() + AGENT_ACTIVE_WINDOW_MS;
      const baseline = sustainedAgentBaseline[event.type];
      if (baseline) agentBaselineRef.current = baseline;
    }

    if (stateRef.current === "success" && !interruptibleDuringSuccess.has(event.type)) {
      return;
    }

    // 睡着/趴着时忽略"软归位"事件（agent 工具收尾等，映射为 idle 且无动画表现），
    // 否则每次 tool_finished 都会闪一帧站立待机再被按回趴姿。
    // 有表现的事件（thinking/working/喂食/点击/拖拽）仍照常唤醒演出。
    if (
      (stateRef.current === "sleeping" || stateRef.current === "exhausted") &&
      idleSettleEventTypes.has(event.type)
    ) {
      return;
    }

    let nextState = stateForPetEvent(event);
    // 工具收尾不再掉出工作态：活跃期保持在基线（working/thinking）；Agent 静默
    // 超过活跃窗后，再由下方专用锁存超时收回 idle。
    if (event.type === "agent_tool_finish" && Date.now() < agentActiveUntilRef.current) {
      nextState = agentBaselineRef.current;
    }
    // 耗尽恢复期间，一切"归位到待机"（吃完、演完 thinking 等）都直接落回趴姿，
    // 不经过 idle 中转帧（§耗尽只显示趴着的角色）。pet_wake 是真正的苏醒，豁免。
    if (nextState === "idle" && event.type !== "pet_wake" && activePetExhaustedRef.current) {
      nextState = "exhausted";
    }
    stateRef.current = nextState;
    setPetState(nextState);
    setLastEventAt(Date.now());

    if (shouldSpeakForEvent(event.type)) {
      showSpeechForState(nextState);
    }

    if (!event.type.startsWith("pet_move")) {
      autonomousMovePlayedRef.current = false;
    }
  }, [showSpeechForState]);

  const dispatchLocalEvent = useCallback(
    (type: PetEventType) => {
      dispatchPetEvent(makePetEvent(type));
    },
    [dispatchPetEvent],
  );

  // 活跃期一次性演出（吃/庆祝/困惑/落地…）结束后的归位：仍有 Agent 在跑 → 回到
  // 基线动画（working/thinking）而非 idle；否则正常回落 idle（耗尽期落回趴姿）。
  // 直接改状态（不走 dispatch）以免刷新活跃锁存、把活跃期无限续命。
  const settleAfterOneShot = useCallback(() => {
    if (Date.now() < agentActiveUntilRef.current && !activePetExhaustedRef.current) {
      const baseline = agentBaselineRef.current;
      stateRef.current = baseline;
      setPetState(baseline);
      setLastEventAt(Date.now());
    } else {
      dispatchLocalEvent("pet_idle");
    }
  }, [dispatchLocalEvent]);

  return {
    petState,
    stateRef,
    lastEventAt,
    setLastEventAt,
    agentActiveUntilRef,
    dispatchPetEvent,
    dispatchLocalEvent,
    settleAfterOneShot,
  };
}
