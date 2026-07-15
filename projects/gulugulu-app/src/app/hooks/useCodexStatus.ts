import { type SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { isTauri } from "../../tauri";
import { type Language, t } from "../../i18n";
import { normalizeCodexEvent } from "../../petEvents";
import type { GameBridge } from "../../game/bridge";
import type { CodexActivityEvent, CodexStatus, GameSave, PetEvent, PetEventType } from "../../types";

type UseCodexStatusResult = {
  status: CodexStatus | null;
  projectTokens: number;
  statusText: string;
};

// --- codex status + activity ---
export function useCodexStatus(
  bridge: GameBridge,
  language: Language,
  dispatchPetEvent: (event: PetEvent) => void,
  dispatchLocalEvent: (type: PetEventType) => void,
  enqueueFed: (stamina: number, tokens: number, source: string) => void,
  setSave: (action: SetStateAction<GameSave | null>) => void,
): UseCodexStatusResult {
  const [status, setStatus] = useState<CodexStatus | null>(null);
  const [projectTokens, setProjectTokens] = useState(0);
  const seenTokenEventKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;

    invoke<CodexStatus>("get_codex_status")
      .then((nextStatus) => {
        if (disposed) return;
        setStatus(nextStatus);
        setProjectTokens(nextStatus.totalTokens);
        if (nextStatus.error) dispatchLocalEvent("agent_error");
      })
      .catch(() => dispatchLocalEvent("agent_error"));

    const statusTimer = window.setInterval(() => {
      invoke<CodexStatus>("get_codex_status")
        .then((nextStatus) => {
          if (disposed) return;
          setStatus(nextStatus);
          setProjectTokens(nextStatus.totalTokens);
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
        setProjectTokens(payload.projectTotalTokens);
        if (payload.tokenDelta > 0 && payload.fedStamina > 0) {
          enqueueFed(payload.fedStamina, payload.tokenDelta, payload.source);
        }
        // Token events change the save (stamina/buffers) — refresh it.
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
    if (status?.codexWatching && status.claudeCodeWatching) {
      return language === "zh" ? "Codex + Claude Code 在线" : "Codex + Claude Code online";
    }
    if (status?.codexWatching) return copy.codexOnline;
    if (status?.claudeCodeWatching) {
      return language === "zh" ? "Claude Code 在线" : "Claude Code online";
    }
    if (status?.watching && status.activeSource === "claudeCode") {
      return language === "zh" ? "Claude Code 在线" : "Claude Code online";
    }
    if (status?.watching && status.activeSource && status.activeSource !== "codex") {
      return language === "zh" ? "Agent 在线" : "Agent online";
    }
    if (status?.watching) return copy.codexOnline;
    if (status?.claudeHome && !status?.codexHome) {
      return language === "zh" ? "寻找 Agent" : "Finding agent";
    }
    return copy.findingCodex;
  }, [language, status]);

  return { status, projectTokens, statusText };
}
