import { type RefObject, useCallback, useEffect, useState } from "react";
import type { GameBridge } from "../../game/bridge";
import type { Language } from "../../i18n";
import type { AppSettings } from "../../types";

type UseAppSettingsResult = {
  appSettings: AppSettings | null;
  handleAlwaysOnTop: (enabled: boolean) => void;
  handleKeyboardCapture: (enabled: boolean) => void;
  handleRandomMovement: (enabled: boolean) => void;
};

/** 设备/隐私设置（键盘充能/总在最前/随机移动/语言）：托盘与设置面板共享的真源。 */
export function useAppSettings(
  bridge: GameBridge,
  applyLanguage: (nextLanguage: Language) => void,
  languageRef: RefObject<Language>,
): UseAppSettingsResult {
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);

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

  return { appSettings, handleAlwaysOnTop, handleKeyboardCapture, handleRandomMovement };
}
