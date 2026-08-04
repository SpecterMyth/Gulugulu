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

1. Work only in the `main` worktree on a `codex/*` branch.
2. Stage only files changed for the current conversation. Never use an unscoped `git add -A` in a dirty worktree.
3. Create one concise commit for the conversation. If the same conversation changes files again before merge, amend that commit.
4. Update a published amended branch only with `git push --force-with-lease`.
5. After pushing, the agent creates or updates a draft pull request targeting `main` and reports its URL. Use the GitHub connector first and an authenticated browser fallback when connector permissions do not allow PR creation.
6. The user is responsible only for the final review and merge confirmation. Agents must not merge the PR unless the user explicitly asks.
7. Do not edit the `Release` or `SteamOnline` worktrees manually. They are maintained by the promotion scripts in `scripts/project-management/`.

Pure planning, explanation, and read-only diagnosis do not create empty commits.
