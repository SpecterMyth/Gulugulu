import { type FormEvent, useEffect, useRef, useState } from "react";
import { PanelShell, SettingSelect, SettingToggle, type UiMode } from "../game/GamePanels";
import { type Language, LANGUAGES, normalizeLanguage, t } from "../i18n";
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
  handleDynamicQuoteAi: (enabled: boolean) => void;
  handleRandomMovement: (enabled: boolean) => void;
  handleAutostart: (enabled: boolean) => void;
  handleDefaultAgent: (agent: string) => void;
  handleDefaultModel: (model: string) => void;
  selectPanel: (mode: Exclude<UiMode, "pet" | "menu">) => void;
  debugUnlocked: boolean;
  onDebugUnlock: () => void;
  closePet: () => void;
};

// Store only the expected SHA-256 digest; the passphrase is never embedded as plaintext.
const DEBUG_PASSPHRASE_SHA256 = "c9a748f839058b3bf877efa68deca489a2d81f308c87c4440ecd8d3ed9b7670a";
const DEBUG_UNLOCK_CLICKS = 10;

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function SettingsPanel({
  copy,
  language,
  appSettings,
  agentModels,
  goBack,
  changeLanguage,
  handleAlwaysOnTop,
  handleKeyboardCapture,
  handleDynamicQuoteAi,
  handleRandomMovement,
  handleAutostart,
  handleDefaultAgent,
  handleDefaultModel,
  selectPanel,
  debugUnlocked,
  onDebugUnlock,
  closePet,
}: SettingsPanelProps) {
  const defaultAgent = appSettings?.defaultAgent === "codex" ? "codex" : "claude";
  const modelOptions = defaultAgent === "codex" ? agentModels.codex : agentModels.claude;
  const defaultModel = appSettings?.defaultModel ?? "";
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [unlockError, setUnlockError] = useState(false);
  const passphraseInputRef = useRef<HTMLInputElement>(null);
  const titleClickCountRef = useRef(0);

  useEffect(() => {
    if (unlockOpen) passphraseInputRef.current?.focus();
  }, [unlockOpen]);

  const openDebugUnlock = () => {
    if (!import.meta.env.DEV || debugUnlocked) return;
    titleClickCountRef.current += 1;
    if (titleClickCountRef.current < DEBUG_UNLOCK_CLICKS) return;
    titleClickCountRef.current = 0;
    setPassphrase("");
    setUnlockError(false);
    setUnlockOpen(true);
  };

  const submitDebugUnlock = async (event: FormEvent) => {
    event.preventDefault();
    if ((await sha256(passphrase)) === DEBUG_PASSPHRASE_SHA256) {
      onDebugUnlock();
      setUnlockOpen(false);
      setPassphrase("");
      setUnlockError(false);
      return;
    }
    setUnlockError(true);
    setPassphrase("");
    passphraseInputRef.current?.focus();
  };

  return (
    <PanelShell
      title={copy.settings}
      backLabel={copy.back}
      onBack={goBack}
      onTitleClick={import.meta.env.DEV ? openDebugUnlock : undefined}
    >
      <div className="settings-panel">
        <SettingSelect
          label={copy.language}
          value={language}
          options={LANGUAGES.map(({ id, label }) => ({ id, label }))}
          onChange={(value) => {
            const nextLanguage = normalizeLanguage(value);
            if (nextLanguage) changeLanguage(nextLanguage);
          }}
        />
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
          label={copy.dynamicQuoteAi}
          enabled={appSettings?.dynamicQuoteAi ?? true}
          onText={copy.on}
          offText={copy.off}
          onToggle={handleDynamicQuoteAi}
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
        {import.meta.env.DEV && debugUnlocked && (
          <button type="button" className="settings-btn settings-action" onClick={() => selectPanel("debug")}>
            🛠 {copy.debug}
          </button>
        )}
        <button type="button" className="settings-btn settings-action is-danger" onClick={closePet}>
          {copy.closePet}
        </button>
      </div>
      {import.meta.env.DEV && unlockOpen && (
        <div className="debug-unlock-backdrop" role="presentation" onMouseDown={() => setUnlockOpen(false)}>
          <form
            className="debug-unlock-note"
            role="dialog"
            aria-modal="true"
            aria-label={copy.sh.misc.debugAuthAria}
            onSubmit={submitDebugUnlock}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <span className="debug-unlock-tape" aria-hidden="true" />
            <label htmlFor="debug-passphrase">
              {copy.sh.misc.developerPassphrase}
            </label>
            <span className="debug-unlock-hint">
              {copy.sh.misc.developerPassphraseHint}
            </span>
            <input
              ref={passphraseInputRef}
              id="debug-passphrase"
              type="password"
              autoComplete="off"
              value={passphrase}
              onChange={(event) => {
                setPassphrase(event.target.value);
                setUnlockError(false);
              }}
            />
            {unlockError && (
              <span className="debug-unlock-error" role="alert">
                {copy.sh.misc.incorrectPassphrase}
              </span>
            )}
            <div className="debug-unlock-actions">
              <button type="button" onClick={() => setUnlockOpen(false)}>
                {copy.sh.misc.cancel}
              </button>
              <button type="submit">{copy.sh.misc.unlock}</button>
            </div>
          </form>
        </div>
      )}
    </PanelShell>
  );
}
