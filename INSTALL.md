# Install Gulugulu

Gulugulu is distributed through GitHub Releases:

https://github.com/SpecterMyth/Gulugulu/releases/latest

Download the installer that matches your operating system. The first public builds are unsigned, so Windows or macOS may show a security warning.

## Install With an Agent

Use this prompt in Codex:

```text
请从 https://github.com/SpecterMyth/Gulugulu.git 安装 Gulugulu。先阅读仓库根目录的 AGENTS.md 和 INSTALL.md，优先下载最新 GitHub Release 中适合当前系统的安装包；只有在没有可用 Release 资产时，才按 INSTALL.md 从源码构建。
```

Use this prompt in Claude:

```text
请从 https://github.com/SpecterMyth/Gulugulu.git 安装 Gulugulu。先阅读仓库根目录的 CLAUDE.md 和 INSTALL.md，优先使用最新 GitHub Release 的系统安装包，不要默认源码编译；安装完成后告诉我安装包来源和结果。
```

Short version:

```text
从 https://github.com/SpecterMyth/Gulugulu.git 安装 Gulugulu，按仓库里的 Agent 安装说明操作，优先使用最新 Release 安装包。
```

## Install With Scripts

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install.ps1
```

macOS or Linux:

```bash
chmod +x scripts/install.sh
./scripts/install.sh
```

The scripts download the latest published Release asset for the current system. If no suitable asset exists, use the source build fallback below.

## Source Build Fallback

Source builds are intended for developers or when no Release installer is available. Install Node.js LTS, Rust stable, and the system dependencies required by Tauri for your operating system first.

```powershell
cd projects/gulugulu-app
npm ci
npm run tauri:build
```

The generated installers are written under `projects/gulugulu-app/src-tauri/target/release/bundle/`.
