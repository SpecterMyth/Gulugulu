# Gulugulu

Gulugulu is a desktop virtual pet companion for agent-assisted workflows. It watches coding-agent activity and turns progress signals, such as token usage and task events, into little pet reactions.

The current application is a Tauri + React + Vite desktop app.

## Download

Download the latest installer from GitHub Releases:

https://github.com/SpecterMyth/Gulugulu/releases/latest

The first public builds are unsigned, so Windows or macOS may show a security warning.

## Agent Install

Codex:

```text
请从 https://github.com/SpecterMyth/Gulugulu.git 安装 Gulugulu。先阅读仓库根目录的 AGENTS.md 和 INSTALL.md，优先下载最新 GitHub Release 中适合当前系统的安装包；只有在没有可用 Release 资产时，才按 INSTALL.md 从源码构建。
```

Claude:

```text
请从 https://github.com/SpecterMyth/Gulugulu.git 安装 Gulugulu。先阅读仓库根目录的 CLAUDE.md 和 INSTALL.md，优先使用最新 GitHub Release 的系统安装包，不要默认源码编译；安装完成后告诉我安装包来源和结果。
```

## Directory Layout

- `projects/gulugulu-app/` - buildable Tauri desktop application.
- `arts/` - character concepts and generated visual assets.
- `codex/` - Codex-specific working notes, memory, prompts, and collaboration records.
- `claude/` - Claude project memory and collaboration notes.
- `config/` - project-local configuration files.
- `docs/` - planning documents, decisions, and implementation notes.
- `specification/` - product and technical specifications.

## Development

```powershell
cd projects/gulugulu-app
npm ci
npm run tauri:dev
```

## Build

```powershell
cd projects/gulugulu-app
npm run tauri:build
```

GitHub Actions builds Windows, macOS, and Linux installers when a `v*` tag is pushed.

## Keyboard Charging & Privacy

Typing anywhere on your desktop feeds the pet's stamina ("键盘充能", Windows only). The privacy contract, enforced in `src-tauri/src/key_watcher.rs`:

- Game logic only ever receives a per-second **count** of key presses.
- Key characters exist solely as transient glyphs (≤250ms) to render the flying-keycap effect — they are **never logged, saved to disk, or transmitted**, and no text-reconstruction APIs (e.g. `ToUnicode`) are used.
- Toggle it off anytime via the tray menu item "键盘充能" — disabling truly uninstalls the system hook.

## Notes

Generated folders such as `node_modules`, `dist`, and `src-tauri/target` are intentionally ignored by git. Release installers should be produced from a clean checkout.
