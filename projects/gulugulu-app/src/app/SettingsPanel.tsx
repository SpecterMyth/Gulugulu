import { PanelShell, SettingSelect, SettingToggle, type UiMode } from "../game/GamePanels";
import { type Language, LANGUAGES, t } from "../i18n";
import type { AgentModels, AppSettings } from "../types";

const AGENT_OPTIONS = [
  { id: "claude", label: "Claude" },
  { id: "codex", label: "Codex" },
];

type SettingsPanelProps = {
  copy: ReturnType<typeof t>;
  language: Language;
  appSettings: AppSettings | null;
  agentModels: AgentModels;
  goBack: () => void;
  changeLanguage: (nextLanguage: Language) => void;
  handleAlwaysOnTop: (enabled: boolean) => void;
  handleKeyboardCapture: (enabled: boolean) => void;
  handleRandomMovement: (enabled: boolean) => void;
  handleAutostart: (enabled: boolean) => void;
  handleDefaultAgent: (agent: string) => void;
  handleDefaultModel: (model: string) => void;
  selectPanel: (mode: Exclude<UiMode, "pet" | "menu">) => void;
  closePet: () => void;
};

export function SettingsPanel({
  copy,
  language,
  appSettings,
  agentModels,
  goBack,
  changeLanguage,
  handleAlwaysOnTop,
  handleKeyboardCapture,
  handleRandomMovement,
  handleAutostart,
  handleDefaultAgent,
  handleDefaultModel,
  selectPanel,
  closePet,
}: SettingsPanelProps) {
  const defaultAgent = appSettings?.defaultAgent === "codex" ? "codex" : "claude";
  const modelOptions = defaultAgent === "codex" ? agentModels.codex : agentModels.claude;
  const defaultModel = appSettings?.defaultModel ?? "";
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
        <SettingSelect
          label={copy.defaultAgent}
          value={defaultAgent}
          options={AGENT_OPTIONS}
          onChange={handleDefaultAgent}
        />
        <SettingSelect
          label={copy.defaultModel}
          value={defaultModel}
          options={modelOptions}
          onChange={handleDefaultModel}
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
