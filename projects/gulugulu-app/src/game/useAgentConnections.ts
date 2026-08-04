import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentConnections } from "../types";
import { getGameBridge } from "./bridge";

// ---------------------------------------------------------------------------
// 开局探测 Claude / Codex 的真实登录态；未连接时后院公告板给「连接」按钮。
// 点击 connect(provider) → 后端开可见终端跑登录 → 本 hook 轮询直到已连接。
// ---------------------------------------------------------------------------

const POLL_MS = 3000;
/** 登录发起后最长轮询窗口（用户开浏览器 OAuth 需要时间）。 */
const POLL_TIMEOUT_MS = 3 * 60 * 1000;

export type AgentProvider = "claude" | "codex";

export type UseAgentConnections = {
  connections: AgentConnections | null;
  /** 正在登录（终端已开、等待完成）的 provider。 */
  connecting: Set<AgentProvider>;
  /** 正在登出（等待 CLI 清除凭据）的 provider。 */
  disconnecting: Set<AgentProvider>;
  connect: (provider: AgentProvider) => void;
  disconnect: (provider: AgentProvider) => void;
  refresh: () => void;
};

export function useAgentConnections(): UseAgentConnections {
  const bridge = getGameBridge();
  const [connections, setConnections] = useState<AgentConnections | null>(null);
  const [connecting, setConnecting] = useState<Set<AgentProvider>>(new Set());
  const [disconnecting, setDisconnecting] = useState<Set<AgentProvider>>(new Set());
  const aliveRef = useRef(true);
  const pollTimerRef = useRef<Map<AgentProvider, number>>(new Map());

  const probe = useCallback(async () => {
    try {
      const next = await bridge.checkAgentConnections();
      if (aliveRef.current) setConnections(next);
      return next;
    } catch {
      return null;
    }
  }, [bridge]);

  const stopPolling = useCallback((provider: AgentProvider) => {
    const timer = pollTimerRef.current.get(provider);
    if (timer != null) {
      window.clearInterval(timer);
      pollTimerRef.current.delete(provider);
    }
    setConnecting((prev) => {
      if (!prev.has(provider)) return prev;
      const next = new Set(prev);
      next.delete(provider);
      return next;
    });
  }, []);

  const connect = useCallback(
    (provider: AgentProvider) => {
      if (pollTimerRef.current.has(provider)) return; // 已在登录中
      setConnecting((prev) => new Set(prev).add(provider));
      void bridge.connectAgent(provider).catch(() => {
        /* 打开终端失败：仍会走轮询，超时自动收尾 */
      });
      const startedAt = Date.now();
      const timer = window.setInterval(async () => {
        const next = await probe();
        if (next && next[provider]?.loggedIn) {
          stopPolling(provider);
        } else if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          stopPolling(provider);
        }
      }, POLL_MS);
      pollTimerRef.current.set(provider, timer);
    },
    [bridge, probe, stopPolling],
  );

  const disconnect = useCallback(
    (provider: AgentProvider) => {
      stopPolling(provider); // 若正处于「登录中」轮询，登出请求优先，先收尾轮询
      setDisconnecting((prev) => new Set(prev).add(provider));
      void bridge
        .disconnectAgent(provider)
        .then(() => probe())
        .catch(() => {
          /* 登出失败：保持原态，用户可重试 */
        })
        .finally(() => {
          if (!aliveRef.current) return;
          setDisconnecting((prev) => {
            if (!prev.has(provider)) return prev;
            const next = new Set(prev);
            next.delete(provider);
            return next;
          });
        });
    },
    [bridge, probe, stopPolling],
  );

  useEffect(() => {
    aliveRef.current = true;
    void probe(); // 开局（后院挂载）探测一次
    const timers = pollTimerRef.current;
    return () => {
      aliveRef.current = false;
      for (const timer of timers.values()) window.clearInterval(timer);
      timers.clear();
    };
  }, [probe]);

  return { connections, connecting, disconnecting, connect, disconnect, refresh: () => void probe() };
}
