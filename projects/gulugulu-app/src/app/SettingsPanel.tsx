import { PanelShell, SettingToggle, type UiMode } from "../game/GamePanels";
import { type Language, LANGUAGES, t } from "../i18n";
import type { AppSettings } from "../types";

type SettingsPanelProps = {
  copy: ReturnType<typeof t>;
  language: Language;
  appSettings: AppSettings | null;
  goBack: () => void;
  changeLanguage: (nextLanguage: Language) => void;
  handleAlwaysOnTop: (enabled: boolean) => void;
  handleKeyboardCapture: (enabled: boolean) => void;
  handleRandomMovement: (enabled: boolean) => void;
  handleAutostart: (enabled: boolean) => void;
  selectPanel: (mode: Exclude<UiMode, "pet" | "menu">) => void;
  closePet: () => void;
};

export function SettingsPanel({
  copy,
  language,
  appSettings,
  goBack,
  changeLanguage,
  handleAlwaysOnTop,
  handleKeyboardCapture,
  handleRandomMovement,
  handleAutostart,
  selectPanel,
  closePet,
}: SettingsPanelProps) {
  return (
    <PanelShell title={copy.settings} backLabel={copy.back} onBack={goBack}>
      <div className="settings-panel">
        <span className="settings-label">{copy.language}</span>
        <div className="settings-options">
          {LANGUAGES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`settings-btn ${language === item.id ? "is-selected" : ""}`}
              onClick={() => changeLanguage(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <SettingToggle
          label={copy.alwaysOnTop}
          enabled={appSettings?.alwaysOnTop ?? true}
          onText={copy.on}
          offText={copy.off}
          onToggle={handleAlwaysOnTop}
        />
        <SettingToggle
          label={copy.keyboardCharging}
          enabled={appSettings?.keyboardCapture ?? true}
          onText={copy.on}
          offText={copy.off}
          onToggle={handleKeyboardCapture}
        />
        <SettingToggle
          label={copy.randomMovement}
          enabled={appSettings?.randomMovement ?? true}
          onText={copy.on}
          offText={copy.off}
          onToggle={handleRandomMovement}
        />
        <SettingToggle
          label={copy.autostart}
          enabled={appSettings?.autostart ?? false}
          onText={copy.on}
          offText={copy.off}
          onToggle={handleAutostart}
        />
        <button type="button" className="settings-btn settings-action" onClick={() => selectPanel("debug")}>
          🛠 {copy.debug}
        </button>
        <button type="button" className="settings-btn settings-action is-danger" onClick={closePet}>
          {copy.closePet}
        </button>
      </div>
    </PanelShell>
  );
}
