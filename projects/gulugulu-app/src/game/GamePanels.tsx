import type { EggInstance, GameConfig, GameSave } from "../types";
import { fmt, speciesDisplayName, type Language, t } from "../i18n";
import { useT } from "../useT";
import { EggSvg, SvgSprite } from "../sprites/SvgSprite";
import { eggHatchInfo, expToNext, isMaxLevel } from "./config";
import { DailyLoveMeter, EnergyBar, ExpBar } from "./EnergyBar";
import { formatCount } from "./format";
import { formatCountdown } from "./useGame";

export type UiMode = "pet" | "menu" | "backyard" | "factory" | "settings" | "debug";

/** 菜单栏固定高度（styles.css .game-menubar 同值）：菜单模式窗口高度 =
 *  pet 高度 + shell 间隙 8 + 菜单栏高度，保证开菜单时角色在屏幕上纹丝不动。 */
export const MENUBAR_HEIGHT = 124;

/** Window size table (GDD §10.1, logical px). */
export const WINDOW_SIZES: Record<UiMode, { w: number; h: number }> = {
  pet: { w: 280, h: 320 },
  menu: { w: 280, h: 320 + 8 + MENUBAR_HEIGHT },
  backyard: { w: 760, h: 560 },
  // 工厂玩法：真机走 dock_factory_window 停靠整个工作区（屏顶→任务栏上沿），
  // 此表值仅作浏览器预览/回退尺寸。
  factory: { w: 760, h: 560 },
  // 设置面板容纳语言 + 三个开关 + 调试/关闭；panel-body 可滚动兜底。
  settings: { w: 280, h: 540 },
  debug: { w: 340, h: 560 },
};

const MENU_ITEMS: Array<{
  mode: Exclude<UiMode, "pet" | "menu">;
  labelKey: "backyard" | "factory" | "settings";
}> = [
  { mode: "backyard", labelKey: "backyard" },
  { mode: "factory", labelKey: "factory" },
  { mode: "settings", labelKey: "settings" },
];

/** 菜单便签顶部的大幅矢量插画。保持纯 SVG，避免不同系统的 emoji 字形差异。 */
function MenuItemIcon({ mode }: { mode: (typeof MENU_ITEMS)[number]["mode"] }) {
  if (mode === "backyard") {
    return (
      <svg className="menu-item-svg" viewBox="0 0 72 48" aria-hidden="true">
        <path className="menu-icon-ground" d="M5 40.5c9-5.4 16.1-1.2 24.1-3.7 9.3-3 19-2.2 37.9 3.7v4.2H5z" />
        <circle className="menu-icon-sun" cx="57" cy="10" r="5.5" />
        <path className="menu-icon-tree" d="M11.5 29.5V42m-6.1-17c0-4.7 3-8.4 6.6-8.4s6.6 3.7 6.6 8.4c0 4.5-2.9 7.3-6.6 7.3S5.4 29.5 5.4 25Z" />
        <path className="menu-icon-house" d="M22 24.5 37 12l15 12.5V42H22z" />
        <path className="menu-icon-roof" d="m19.5 25.5 17.5-15 17.5 15M42.5 17v-5.5h6v10.2" />
        <path className="menu-icon-door" d="M33 42V29h8v13m-15-13h4m14 0h4" />
        <path className="menu-icon-fence" d="M53 31v12m8-12v12m-11-8.5h16m-16 5h16" />
      </svg>
    );
  }

  if (mode === "factory") {
    return (
      <svg className="menu-item-svg" viewBox="0 0 72 48" aria-hidden="true">
        <path className="menu-icon-smoke" d="M18 10.5c-3.9-1-4.2-5.3-.7-6.6 1.2-.4 2.6-.2 3.4.7.6-2.2 4-2.4 5.1-.5 1.2 2-.3 4.5-2.6 4.8" />
        <path className="menu-icon-smoke" d="M38 10c-3.2-1.2-3.1-5.3.2-6.3 1.6-.5 3.2.4 3.8 1.8 1.1-1.3 3.6-.6 3.8 1.2.2 1.6-1 2.8-2.5 3" />
        <path className="menu-icon-stack" d="M14 10h10l1.3 27H12.7zM34 10h10l1.3 27H32.7z" />
        <path className="menu-icon-factory" d="M5 44V25l15 8v-8l15 8v-8l15 8v-8l17 9v10z" />
        <path className="menu-icon-window" d="M11 35h5v4h-5zm13 0h5v4h-5zm13 0h5v4h-5zm13 0h5v4h-5z" />
        <path className="menu-icon-factory-line" d="M5 44h62M13.5 15h11m8.5 0h11" />
      </svg>
    );
  }

  return (
    <svg className="menu-item-svg" viewBox="0 0 72 48" aria-hidden="true">
      <path
        className="menu-icon-gear"
        d="m40.2 6.3 1.4 5.2c1.3.5 2.5 1.2 3.6 2.1l5.2-1.5 4.2 7.2-3.9 3.8c.2.7.2 1.4.2 2.1s0 1.4-.2 2.1l3.9 3.8-4.2 7.2-5.2-1.5c-1.1.9-2.3 1.6-3.6 2.1l-1.4 5.2h-8.4l-1.4-5.2a15 15 0 0 1-3.6-2.1l-5.2 1.5-4.2-7.2 3.9-3.8a11 11 0 0 1 0-4.2l-3.9-3.8 4.2-7.2 5.2 1.5c1.1-.9 2.3-1.6 3.6-2.1l1.4-5.2z"
      />
      <circle className="menu-icon-gear-core" cx="36" cy="25.2" r="8.2" />
      <path className="menu-icon-spark" d="M59 6v8M55 10h8M10 32v7M6.5 35.5h7" />
    </svg>
  );
}

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
            className={`menu-item menu-${item.mode} ${uiMode === item.mode ? "is-active" : ""}`}
            data-coach={
              item.mode === "backyard"
                ? "menuBackyard"
                : item.mode === "factory"
                  ? "menuFactory"
                  : undefined
            }
            onClick={() => onSelect(item.mode)}
          >
            <span className="menu-item-icon">
              <MenuItemIcon mode={item.mode} />
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
  onTitleClick,
  children,
}: {
  title: string;
  subtitle?: string;
  /** 返回按钮的无障碍标签（双语）。缺省回退当前语言词条。 */
  backLabel?: string;
  onBack: () => void;
  /** 可选的标题点击入口；设置页用它承载隐藏的调试解锁手势。 */
  onTitleClick?: () => void;
  children: React.ReactNode;
}) {
  const { T } = useT();
  return (
    <div className="game-panel">
      <header className="panel-header" data-tauri-drag-region>
        <button type="button" className="panel-back" onClick={onBack} aria-label={backLabel ?? T.back}>
          ←
        </button>
        {onTitleClick ? (
          <button type="button" className="panel-title panel-title-button" onClick={onTitleClick}>
            {title}
          </button>
        ) : (
          <span className="panel-title">{title}</span>
        )}
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

/** 设置面板里的下拉行：标签在上、下拉框在下（与开关行同一视觉语言）。 */
export function SettingSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (next: string) => void;
}) {
  return (
    <div className="settings-row">
      <span className="settings-label">{label}</span>
      <select className="settings-select" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
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
