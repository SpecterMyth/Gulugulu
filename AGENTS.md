# Gulugulu Agent Guide

This repository contains the Gulugulu Tauri desktop app.

When a user asks to install Gulugulu from this repository:

1. Read `INSTALL.md`.
2. Prefer the latest published GitHub Release installer for the current operating system.
3. On Windows, run `scripts/install.ps1` or download the latest `.msi` / `.exe` asset.
4. On macOS or Linux, run `scripts/install.sh` or download the latest `.dmg`, `.AppImage`, or `.deb` asset.
5. Only build from source when no matching Release asset exists.

Do not default to source compilation for ordinary users. Source builds require Node.js, Rust, and Tauri system dependencies.

Release builds are created by GitHub Actions from `v*` tags and uploaded as draft GitHub Releases.

## Conversation Git workflow

When a conversation changes repository files:

1. Read and use the `complete-conversation-pr` skill.
2. Work only in the `main` worktree on a `codex/*` branch.
3. Stage only files changed for the current conversation. Never use an unscoped `git add -A` in a dirty worktree.
4. Run `scripts/project-management/Complete-Conversation.ps1` to create one concise commit, push the branch, and create or update its draft PR. If the same conversation changes files again before merge, pass `-Amend`; published amendments use `git push --force-with-lease`.
5. Target `main`. The PR title must be `[MODEL]一句话中文描述`; its body must contain detailed description, verification results, and risks or notes.
6. Report the verified PR URL in the final response. Codex `Stop` hooks reject completion while repository changes lack a compliant draft PR.
7. The user is responsible only for the final review and merge confirmation. Agents must not merge the PR unless the user explicitly asks.
8. Do not edit the `Release` or `SteamOnline` worktrees manually. They are maintained by the promotion scripts in `scripts/project-management/`.

Pure planning, explanation, and read-only diagnosis do not create empty commits.

Project hooks are stored in `.codex/hooks.json`. Review and trust them with `/hooks` when Codex first discovers them or after their definitions change.
