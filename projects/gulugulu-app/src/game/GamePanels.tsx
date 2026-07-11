import type { EggInstance, GameConfig, GameSave } from "../types";
import { EggSvg, SvgSprite } from "../sprites/SvgSprite";
import { eggHatchInfo } from "./config";
import { formatCountdown } from "./useGame";

export type UiMode = "pet" | "menu" | "backyard" | "settings" | "debug";

/** 菜单栏固定高度（styles.css .game-menubar 同值）：菜单模式窗口高度 =
 *  pet 高度 + shell 间隙 8 + 菜单栏高度，保证开菜单时角色在屏幕上纹丝不动。 */
export const MENUBAR_HEIGHT = 100;

/** Window size table (GDD §10.1, logical px). */
export const WINDOW_SIZES: Record<UiMode, { w: number; h: number }> = {
  pet: { w: 260, h: 320 },
  menu: { w: 260, h: 320 + 8 + MENUBAR_HEIGHT },
  backyard: { w: 760, h: 560 },
  settings: { w: 260, h: 420 },
  debug: { w: 340, h: 560 },
};

export const PANEL_TITLES: Record<Exclude<UiMode, "pet" | "menu" | "backyard">, string> = {
  settings: "设置",
  debug: "调试",
};

const MENU_ITEMS: Array<{ mode: Exclude<UiMode, "pet" | "menu">; label: string; icon: string }> = [
  { mode: "backyard", label: "后院", icon: "🏡" },
  { mode: "settings", label: "设置", icon: "⚙️" },
];

// ---------------------------------------------------------------------------
// Menu bar + HUD — 木质吊牌（handoff 设计语言）
// ---------------------------------------------------------------------------

export function MenuBar({
  uiMode,
  save,
  config,
  onSelect,
  onPetAvatarClick,
  backyardBadge,
}: {
  uiMode: UiMode;
  save: GameSave;
  config: GameConfig;
  onSelect: (mode: Exclude<UiMode, "pet" | "menu">) => void;
  onPetAvatarClick: () => void;
  backyardBadge?: boolean;
}) {
  const activePet = save.pets.find((pet) => pet.id === save.activePetId) ?? null;
  const staminaPct = activePet ? Math.round((activePet.stamina / config.staminaMax) * 100) : 0;

  return (
    <div className="game-menubar" data-tauri-drag-region>
      <div className="game-menu-items">
        {uiMode !== "menu" && (
          <button type="button" className="menu-item menu-avatar" onClick={onPetAvatarClick} title="回到宠物">
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
            onClick={() => onSelect(item.mode)}
          >
            <span className="menu-item-icon">
              {item.icon}
              {item.mode === "backyard" && backyardBadge && <span className="menu-badge" />}
            </span>
            <span className="menu-item-label">{item.label}</span>
          </button>
        ))}
      </div>
      <div className="game-hud">
        {activePet && (
          <span className="hud-level" title={`${config.species[activePet.species]?.nameZh ?? ""} 等级`}>
            Lv{activePet.level}
          </span>
        )}
        <div className="hud-stamina" title={activePet ? `精力 ${activePet.stamina}/${config.staminaMax}` : "还没有精灵"}>
          <span className="hud-icon">⚡</span>
          <div className="hud-stamina-track">
            <div
              className={`hud-stamina-fill ${activePet?.exhausted ? "is-exhausted" : staminaPct <= 25 ? "is-low" : ""}`}
              style={{ width: `${staminaPct}%` }}
            />
          </div>
        </div>
        <div className="hud-coins">
          <span className="hud-icon">🪙</span>
          <span className="hud-coins-value">{save.coins.toLocaleString()}</span>
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
  onBack,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="game-panel">
      <header className="panel-header" data-tauri-drag-region>
        <button type="button" className="panel-back" onClick={onBack} aria-label="返回">
          ←
        </button>
        <span className="panel-title">{title}</span>
        {subtitle && <span className="panel-subtitle">{subtitle}</span>}
      </header>
      <div className="panel-body">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Egg on the pet stage (before the first pet hatches)
// ---------------------------------------------------------------------------

export function StageEgg({ egg, config, now }: { egg: EggInstance; config: GameConfig; now: number }) {
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
        {ready ? "孵化完成！点我收取" : `孵化中 ${formatCountdown((egg.hatchAt ?? 0) - now)}`}
      </span>
    </div>
  );
}
