import { type RefObject, useCallback, useEffect, useState } from "react";
import { FALLBACK_AGENT_MODELS, type GameBridge } from "../../game/bridge";
import type { Language } from "../../i18n";
import type { AgentModels, AppSettings } from "../../types";

type UseAppSettingsResult = {
  appSettings: AppSettings | null;
  agentModels: AgentModels;
  handleAlwaysOnTop: (enabled: boolean) => void;
  handleKeyboardCapture: (enabled: boolean) => void;
  handleRandomMovement: (enabled: boolean) => void;
  handleAutostart: (enabled: boolean) => void;
  handleDefaultAgent: (agent: string) => void;
  handleDefaultModel: (model: string) => void;
};

/** 设备/隐私设置（键盘充能/总在最前/随机移动/语言）：托盘与设置面板共享的真源。 */
export function useAppSettings(
  bridge: GameBridge,
  applyLanguage: (nextLanguage: Language) => void,
  languageRef: RefObject<Language>,
): UseAppSettingsResult {
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  // AI 融合可选模型目录（「默认模型」下拉数据源）：启动向 Rust 取一次，失败用兜底。
  const [agentModels, setAgentModels] = useState<AgentModels>(FALLBACK_AGENT_MODELS);

  useEffect(() => {
    let disposed = false;
    bridge
      .listAgentModels()
      .then((next) => {
        if (!disposed && next?.claude?.length && next?.codex?.length) setAgentModels(next);
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
    };
  }, [bridge]);

  // 设备设置：启动读取一次 + 订阅托盘/其它入口的改动（settings://changed）。
  useEffect(() => {
    let disposed = false;
    bridge
      .getSettings()
      .then((next) => {
        if (disposed) return;
        setAppSettings(next);
        // 启动对齐：把 UI 记住的语言（localStorage）推给 Rust，让托盘与界面一致。
        if (next.language !== languageRef.current) {
          void bridge.setLanguage(languageRef.current).catch(() => undefined);
        }
      })
      .catch(() => undefined);
    const dispose = bridge.onSettingsChanged((next) => {
      setAppSettings(next);
      // 托盘切换语言 → 回流同步 UI（applyLanguage 自身对同语言幂等，不成环）。
      if (next.language === "zh" || next.language === "en") applyLanguage(next.language);
    });
    return () => {
      disposed = true;
      dispose();
    };
  }, [bridge, applyLanguage]);

  // 三个开关：乐观更新本地 state（即时反馈）+ 落 Rust（持久化 + 广播 + 同步托盘）。
  const handleAlwaysOnTop = useCallback(
    (enabled: boolean) => {
      setAppSettings((prev) => (prev ? { ...prev, alwaysOnTop: enabled } : prev));
      void bridge.setAlwaysOnTop(enabled).catch(() => undefined);
    },
    [bridge],
  );
  const handleKeyboardCapture = useCallback(
    (enabled: boolean) => {
      setAppSettings((prev) => (prev ? { ...prev, keyboardCapture: enabled } : prev));
      void bridge.setKeyboardCapture(enabled).catch(() => undefined);
    },
    [bridge],
  );
  const handleRandomMovement = useCallback(
    (enabled: boolean) => {
      setAppSettings((prev) => (prev ? { ...prev, randomMovement: enabled } : prev));
      void bridge.setRandomMovement(enabled).catch(() => undefined);
    },
    [bridge],
  );
  // 开机自启：真源在系统注册项，乐观更新即时反馈；set_autostart 会广播回填**实际**态
  // （写入失败时开关回弹到真实状态）。
  const handleAutostart = useCallback(
    (enabled: boolean) => {
      setAppSettings((prev) => (prev ? { ...prev, autostart: enabled } : prev));
      void bridge.setAutostart(enabled).catch(() => undefined);
    },
    [bridge],
  );

  // AI 融合首选 Agent：切 Agent 时若当前模型不在新 Agent 的模型表里，一并落到该 Agent
  // 的首个模型（避免出现「Codex + opus」这类无效组合）。
  const handleDefaultAgent = useCallback(
    (agent: string) => {
      const models = agent === "codex" ? agentModels.codex : agentModels.claude;
      setAppSettings((prev) => {
        if (!prev) return prev;
        const keepModel = models.some((m) => m.id === prev.defaultModel);
        const nextModel = keepModel ? prev.defaultModel : (models[0]?.id ?? "");
        if (!keepModel) void bridge.setDefaultModel(nextModel).catch(() => undefined);
        return { ...prev, defaultAgent: agent, defaultModel: nextModel };
      });
      void bridge.setDefaultAgent(agent).catch(() => undefined);
    },
    [bridge, agentModels],
  );
  const handleDefaultModel = useCallback(
    (model: string) => {
      setAppSettings((prev) => (prev ? { ...prev, defaultModel: model } : prev));
      void bridge.setDefaultModel(model).catch(() => undefined);
    },
    [bridge],
  );

  return {
    appSettings,
    agentModels,
    handleAlwaysOnTop,
    handleKeyboardCapture,
    handleRandomMovement,
    handleAutostart,
    handleDefaultAgent,
    handleDefaultModel,
  };
}
