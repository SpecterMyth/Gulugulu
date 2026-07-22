import type { EggInstance, GameConfig, GameSave } from "../types";
import { fmt, speciesDisplayName, type Language, t } from "../i18n";
import { useT } from "../useT";
import { EggSvg, SvgSprite } from "../sprites/SvgSprite";
import { eggHatchInfo, expToNext, isMaxLevel } from "./config";
import { DailyLoveMeter, EnergyBar, ExpBar } from "./EnergyBar";
import { formatCount } from "./format";
import { formatCountdown } from "./useGame";

export type UiMode = "pet" | "menu" | "backyard" | "settings" | "debug";

/** 菜单栏固定高度（styles.css .game-menubar 同值）：菜单模式窗口高度 =
 *  pet 高度 + shell 间隙 8 + 菜单栏高度，保证开菜单时角色在屏幕上纹丝不动。 */
export const MENUBAR_HEIGHT = 124;

/** Window size table (GDD §10.1, logical px). */
export const WINDOW_SIZES: Record<UiMode, { w: number; h: number }> = {
  pet: { w: 280, h: 320 },
  menu: { w: 280, h: 320 + 8 + MENUBAR_HEIGHT },
  backyard: { w: 760, h: 560 },
  // 设置面板容纳语言 + 三个开关 + 调试/关闭；panel-body 可滚动兜底。
  settings: { w: 280, h: 540 },
  debug: { w: 340, h: 560 },
};

const MENU_ITEMS: Array<{
  mode: Exclude<UiMode, "pet" | "menu">;
  labelKey: "backyard" | "settings";
  icon: string;
}> = [
  { mode: "backyard", labelKey: "backyard", icon: "🏡" },
  { mode: "settings", labelKey: "settings", icon: "⚙️" },
];

// ---------------------------------------------------------------------------
// Menu bar + HUD — 木质吊牌（handoff 设计语言）
// ---------------------------------------------------------------------------

export function MenuBar({
  uiMode,
  save,
  config,
  language,
  onSelect,
  onPetAvatarClick,
  backyardBadge,
  energyPulse,
}: {
  uiMode: UiMode;
  save: GameSave;
  config: GameConfig;
  language: Language;
  onSelect: (mode: Exclude<UiMode, "pet" | "menu">) => void;
  onPetAvatarClick: () => void;
  backyardBadge?: boolean;
  /** 键盘入账计数：变化时精力条播一次获得脉冲（Token 经验另走进食演出）。 */
  energyPulse?: number;
}) {
  const activePet = save.pets.find((pet) => pet.id === save.activePetId) ?? null;
  const copy = t(language);

  return (
    <div className="game-menubar" data-tauri-drag-region>
      <div className="game-menu-items">
        {uiMode !== "menu" && (
          <button type="button" className="menu-item menu-avatar" onClick={onPetAvatarClick} title={copy.backToPet}>
            {activePet ? (
              <SvgSprite species={activePet.species} config={config} petState="idle" className="menu-avatar-sprite" />
            ) : (
              <span className="menu-item-icon">🥚</span>
            )}
          </button>
        )}
        {MENU_ITEMS.map((item) => (
          <button
            key={item.mode}
            type="button"
            className={`menu-item ${uiMode === item.mode ? "is-active" : ""}`}
            data-coach={item.mode === "backyard" ? "menuBackyard" : undefined}
            onClick={() => onSelect(item.mode)}
          >
            <span className="menu-item-icon">
              {item.icon}
              {item.mode === "backyard" && backyardBadge && <span className="menu-badge" />}
            </span>
            <span className="menu-item-label">{copy[item.labelKey]}</span>
          </button>
        ))}
      </div>
      <div className="game-hud">
        {/* col1·row1：精力标签（⚡ + 当前精力值），对齐右侧精力条 */}
        <div
          className="hud-stamina-value"
          title={
            activePet
              ? fmt(copy.bk.energyTitle, { value: activePet.stamina, max: config.staminaMax })
              : copy.bk.panels.noPet
          }
        >
          <span className="hud-icon">⚡</span>
          <span className="hud-num">{activePet?.stamina ?? 0}</span>
        </div>
        {/* col2·row1：精力条（纯条） */}
        <EnergyBar
          value={activePet?.stamina ?? 0}
          max={config.staminaMax}
          wakeThreshold={config.wakeThreshold}
          variant="hud"
          pulseKey={energyPulse}
        />
        {/* col3·row1：爱心 + 今日剩余点击数 */}
        <DailyLoveMeter clicks={save.daily.clicks} cap={config.dailyClickCap} showCount />

        {/* col1·row2：经验标签（等级药丸 = 经验里程碑），对齐右侧经验条 */}
        <span
          className="hud-level"
          title={
            activePet
              ? fmt(copy.bk.panels.levelTitle, {
                  name:
                    language === "zh"
                      ? config.species[activePet.species]?.nameZh ?? ""
                      : speciesDisplayName(activePet.species, language, config.species[activePet.species]?.nameZh, config.species[activePet.species]?.nameEn),
                })
              : copy.bk.panels.noPet
          }
        >
          Lv{activePet?.level ?? 0}
        </span>
        {/* col2·row2：经验条（纯条；满级 → 满格金条，不隐藏） */}
        {activePet && !isMaxLevel(config, activePet) ? (
          <ExpBar value={activePet.exp} max={expToNext(config, activePet.tier, activePet.level)} />
        ) : (
          <div className="exp-bar exp-bar-full" aria-hidden="true">
            <div className="exp-bar-fill" style={{ width: "100%" }} />
          </div>
        )}
        {/* col3·row2：金币 */}
        <div className="hud-coins">
          <span className="hud-icon">🪙</span>
          <span className="hud-coins-value">{formatCount(save.coins)}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel chrome (仅调试面板还在用)
// ---------------------------------------------------------------------------

export function PanelShell({
  title,
  subtitle,
  backLabel,
  onBack,
  children,
}: {
  title: string;
  subtitle?: string;
  /** 返回按钮的无障碍标签（双语）。缺省回退当前语言词条。 */
  backLabel?: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  const { T } = useT();
  return (
    <div className="game-panel">
      <header className="panel-header" data-tauri-drag-region>
        <button type="button" className="panel-back" onClick={onBack} aria-label={backLabel ?? T.back}>
          ←
        </button>
        <span className="panel-title">{title}</span>
        {subtitle && <span className="panel-subtitle">{subtitle}</span>}
      </header>
      <div className="panel-body">{children}</div>
    </div>
  );
}

/** 设置面板里的开关行：标签 + 开/关分段按钮（与语言选择器同一视觉语言）。 */
export function SettingToggle({
  label,
  enabled,
  onToggle,
  onText,
  offText,
}: {
  label: string;
  enabled: boolean;
  onToggle: (next: boolean) => void;
  onText: string;
  offText: string;
}) {
  return (
    <div className="settings-row">
      <span className="settings-label">{label}</span>
      <div className="settings-options">
        <button
          type="button"
          className={`settings-btn ${enabled ? "is-selected" : ""}`}
          aria-pressed={enabled}
          onClick={() => onToggle(true)}
        >
          {onText}
        </button>
        <button
          type="button"
          className={`settings-btn ${!enabled ? "is-selected" : ""}`}
          aria-pressed={!enabled}
          onClick={() => onToggle(false)}
        >
          {offText}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Egg on the pet stage (before the first pet hatches)
// ---------------------------------------------------------------------------

export function StageEgg({ egg, config, now }: { egg: EggInstance; config: GameConfig; now: number }) {
  const { T } = useT();
  const ready = egg.hatchAt != null && now >= egg.hatchAt;
  const { remaining, progress } = eggHatchInfo(config, egg, now);
  return (
    <div className="stage-egg">
      <EggSvg
        species={egg.species}
        tier={egg.tier}
        config={config}
        phase={ready ? "ready" : "incubating"}
        progress={progress}
        secondsLeft={remaining}
        className="stage-egg-svg"
      />
      <span className="stage-egg-label">
        {ready
          ? T.bk.panels.eggReady
          : fmt(T.bk.panels.eggHatching, { countdown: formatCountdown((egg.hatchAt ?? 0) - now) })}
      </span>
    </div>
  );
}
