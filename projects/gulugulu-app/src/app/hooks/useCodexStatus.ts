import { type SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { isTauri } from "../../tauri";
import { type Language, t } from "../../i18n";
import { normalizeCodexEvent } from "../../petEvents";
import type { GameBridge } from "../../game/bridge";
import {
  type CodexActivityEvent,
  type CodexStatus,
  type GameSave,
  type PetEvent,
  type PetEventType,
  type TokenBreakdown,
  type TokenStats,
  breakdownTotal,
  EMPTY_TOKEN_WINDOW,
} from "../../types";

const EMPTY_TOKEN_STATS: TokenStats = {
  all: EMPTY_TOKEN_WINDOW,
  d1: EMPTY_TOKEN_WINDOW,
  w1: EMPTY_TOKEN_WINDOW,
  m1: EMPTY_TOKEN_WINDOW,
};

type UseCodexStatusResult = {
  status: CodexStatus | null;
  /** 全局 Token 的多时间窗聚合（默认 all；公告板本地切 1d/1w/1m）。 */
  tokenStats: TokenStats;
  statusText: string;
};

// --- codex status + activity ---
export function useCodexStatus(
  bridge: GameBridge,
  language: Language,
  dispatchPetEvent: (event: PetEvent) => void,
  dispatchLocalEvent: (type: PetEventType) => void,
  enqueueFed: (exp: number, breakdown: TokenBreakdown, source: string, leveledUp: boolean) => void,
  setSave: (action: SetStateAction<GameSave | null>) => void,
): UseCodexStatusResult {
  const [status, setStatus] = useState<CodexStatus | null>(null);
  const seenTokenEventKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;

    invoke<CodexStatus>("get_codex_status")
      .then((nextStatus) => {
        if (disposed) return;
        setStatus(nextStatus);
        if (nextStatus.error) dispatchLocalEvent("agent_error");
      })
      .catch(() => dispatchLocalEvent("agent_error"));

    const statusTimer = window.setInterval(() => {
      invoke<CodexStatus>("get_codex_status")
        .then((nextStatus) => {
          if (disposed) return;
          setStatus(nextStatus);
        })
        .catch(() => undefined);
    }, 2000);

    let unlisten: (() => void) | undefined;
    listen<CodexActivityEvent>("codex://activity", (event) => {
      const payload = event.payload;

      if (payload.kind === "token_count") {
        const eventKey = [
          payload.source,
          payload.sessionId,
          payload.timestamp,
          payload.projectPath ?? "",
          payload.tokenDelta,
          payload.projectTotalTokens,
          payload.projectExperience,
        ].join("|");
        if (seenTokenEventKeysRef.current.has(eventKey)) return;

        seenTokenEventKeysRef.current.add(eventKey);
        if (seenTokenEventKeysRef.current.size > 80) {
          const [oldestKey] = seenTokenEventKeysRef.current;
          seenTokenEventKeysRef.current.delete(oldestKey);
        }
      }

      if (payload.kind !== "token_count") {
        dispatchPetEvent(normalizeCodexEvent(payload));
      }

      if (payload.kind === "token_count") {
        // 累计读数改由下方 get_codex_status 刷新的 tokenStats 驱动（全局口径），
        // 不再用本事件的单项目 projectTotalTokens——那会让读数随项目跳变。
        // 只要真的吃进了 token 就播进食动画——陪伴宠满级也照吃，只是
        // fedExp=0 时不涨经验（下游按 exp>0 才冒 +经验 飘字/气泡）。
        // v1.3 四分喂养：喂养账本吃进的四分明细（fedBreakdown）驱动餐级/气泡，
        // 由后端加权账本差分算出（含 cache_read，但按 0.1 折算）。
        if (breakdownTotal(payload.fedBreakdown) > 0) {
          enqueueFed(payload.fedExp, payload.fedBreakdown, payload.source, payload.fedLeveledUp);
        }
        // Token events change the save (陪伴宠 exp/level + buffers) — refresh it.
        bridge
          .getState()
          .then(setSave)
          .catch(() => undefined);
      }

      invoke<CodexStatus>("get_codex_status")
        .then(setStatus)
        .catch(() => undefined);
    }).then((dispose) => {
      if (disposed) {
        dispose();
        return;
      }
      unlisten = dispose;
    });

    return () => {
      disposed = true;
      window.clearInterval(statusTimer);
      unlisten?.();
    };
  }, [bridge, dispatchLocalEvent, dispatchPetEvent, enqueueFed, setSave]);

  const statusText = useMemo(() => {
    const copy = t(language);
    if (!isTauri()) return copy.previewMode;
    if (status?.error) return language === "zh" ? copy.statusError : status.error;
    if (status?.codexWatching && status.claudeCodeWatching) return copy.codexClaudeOnline;
    if (status?.codexWatching) return copy.codexOnline;
    if (status?.claudeCodeWatching) return copy.claudeCodeOnline;
    if (status?.watching && status.activeSource === "claudeCode") return copy.claudeCodeOnline;
    if (status?.watching && status.activeSource && status.activeSource !== "codex") {
      return copy.agentOnline;
    }
    if (status?.watching) return copy.codexOnline;
    if (status?.claudeHome && !status?.codexHome) return copy.findingAgent;
    return copy.findingCodex;
  }, [language, status]);

  return { status, tokenStats: status?.tokenStats ?? EMPTY_TOKEN_STATS, statusText };
}
