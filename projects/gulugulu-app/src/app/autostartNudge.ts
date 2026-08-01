/** 里程碑达成后是否该弹「开机自启」引导。设置未加载或系统已启用时不弹。 */
export function shouldPromptAutostart(
  settings: { autostart: boolean; autostartPromptCount: number } | null | undefined,
): boolean {
  if (!settings) return false;
  return !settings.autostart;
}
