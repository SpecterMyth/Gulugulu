# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Two modes: installing vs. developing

- **A user asking to *install* Gulugulu** → this is the common case. Do not build from source by default. Read `INSTALL.md`, then prefer the latest published GitHub Release installer for the current OS:
  - Windows: `scripts/install.ps1`, or the latest `.msi` / `.exe` asset.
  - macOS / Linux: `scripts/install.sh`, or the latest `.dmg` / `.AppImage` / `.deb` asset.
  - Only build from source when no matching Release asset exists. Source builds need Node.js LTS, Rust stable, and Tauri system dependencies.
- **Working on the code** → the rest of this file.

## Repository shape

This is a monorepo with two buildable Node projects plus supporting material:

- `projects/gulugulu-app/` — the product: a **Tauri 2 + React 19 + TypeScript (Vite)** desktop pet app. Rust backend in `src-tauri/`, React frontend in `src/`.
- `projects/services/avatar-gen/` — a separate **Node/Express + React (Vite)** service that turns an uploaded reference image into a custom avatar package the desktop app can import. Not part of the shipped installer.
- `arts/` concept art · `docs/` + `specification/` planning · `config/` project config · `codex/` + `claude/` agent working notes · `.agents/skills/gulugulu-avatar-imagegen/` a Codex skill used by avatar-gen.
- `start.bat` / `stop.bat` (repo root) — Windows helpers that launch/stop the avatar-gen service **and** the desktop app together.

> ⚠️ `claude/CLAUDE.md` and `claude/memory/*` predate the current implementation and describe an aspirational **Vue 3 / Pinia / ESLint / `commands/`+`core/`+`db/`** layout with `npm run lint` / `type-check` scripts. None of that exists — the app is React with the structure below and no lint/test tooling. Trust the code over those memory docs.

## Development commands

Desktop app (`cd projects/gulugulu-app`):

```
npm ci                # install (clean)
npm run tauri:dev     # run the full desktop app (Tauri + Vite on :1420)
npm run dev           # Vite only, opens in a browser in "preview mode" (see below)
npm run build         # tsc && vite build — this is also the typecheck gate
npm run tauri:build   # production bundle → src-tauri/target/release/bundle/
```

Avatar-gen service (`cd projects/services/avatar-gen`):

```
npm run dev     # API (tsx watch src/server.ts on :4178) + web UI (Vite on :4177), in parallel
npm run check   # tsc --noEmit typecheck
npm run build   # tsc + vite build
npm run start   # node dist/server.js
```

There is **no lint, no formatter, and no test suite** in either project. `npm run build` (app) and `npm run check` (avatar-gen) are the only static gates. Rust is checked by `cargo build` via `tauri:dev` / `tauri:build`.

## Desktop app architecture

The whole app is a single **frameless, transparent, always-on-top 260×320 window** (see `src-tauri/tauri.conf.json`) that renders one animated pet reacting to coding-agent activity.

### Backend (Rust, `src-tauri/src/`)

- `lib.rs` — Tauri entrypoint. Builds the tray menu (show / hide / always-on-top / quit), registers all `#[tauri::command]` IPC handlers, and spawns the two watcher threads.
- `codex_adapter.rs` — the core. Two polling threads (`spawn_codex_watcher`, `spawn_claude_code_watcher`) tail the **latest** agent session log and turn JSONL lines into `CodexActivityEvent`s:
  - Codex: `<CODEX_HOME>/sessions/**/*.jsonl` (homes discovered from `CODEX_HOME` env or platform candidates).
  - Claude Code: `<CLAUDE_HOME>/projects/**/*.jsonl` (`CLAUDE_HOME` env or platform candidates).
  - Both threads share one `SharedCodexState` and **emit on the same `codex://activity` event channel** — the channel name is historical; the `source` field (`"codex"` | `"claudeCode"`) distinguishes them.
  - Per-project running totals (`total_tokens`, and `experience` = tokens/1000) are persisted to `gulugulu-progress.json` in the app data dir, with per-session byte offsets so restarts don't double-count.
- `avatar_manager.rs` — built-in `guluduck` manifest + custom avatars unzipped from `.gulupet.zip` packages into `<app_data>/avatars/`. IPC to list / select / install avatars and open the avatar-gen URL. Validates manifests and does safe (no path-traversal) zip extraction.
- `window_tracker.rs` — Windows-only Win32 call returning the foreground window bounds so the pet can wander *away* from the active window. No-op (returns `None`) on other platforms.

### Frontend (React, `projects/gulugulu-app/src/`)

- `App.tsx` — everything UI: the pet state machine, pointer drag/click handling, autonomous screen wandering (`chooseAutonomousTarget` avoids the active window), bilingual speech bubbles, the token/exp status panel, and the avatar-selection context menu. Subscribes to `codex://activity` and also polls `get_codex_status` every 2s.
- `petEvents.ts` — the state-machine tables: `PetEventType → PetState` (`stateForPetEvent`), `PetState → AnimationKey` (`stateAnimationMap`), animation timing (`animationDefinitions`), and normalization of raw agent events (`normalizeCodexEvent`).
- `AnimationPlayer.tsx` — plays a PNG frame sequence with `setInterval` at each animation's fps; loads built-in frames from `public/animations/guluduck/frames/<key>/` or a custom avatar's frames via `convertFileSrc`; falls back to a static image on load error.
- `types.ts` — TypeScript mirrors of the Rust structs.
- `tauri.ts` — `isTauri()` guard. When false ("preview mode", i.e. plain browser via `npm run dev`), all `invoke`/native calls are skipped and the pet just idles/animates.

### End-to-end flow

Agent writes a JSONL session line → Rust watcher tails the file, parses it, updates the progress store, and emits `codex://activity` → `App.tsx` dispatches a pet event through the state machine → `AnimationPlayer` renders the matching sprite. `token_count` events additionally drive an "experience / feeding" queue that plays the `eat` animation (frontend dedupes them via `seenTokenEventKeysRef`).

### Cross-cutting rules

- **Rust ↔ TS type parity**: Rust serde structs use `#[serde(rename_all = "camelCase")]` to match `types.ts`. Change one side → change the other.
- **Adding a pet animation touches four places**: PNG frames under `public/animations/guluduck/frames/<key>/`, plus `animationDefinitions` + `stateAnimationMap` in `petEvents.ts`, `AnimationKey` in `types.ts`, and `builtin_manifest()` in `avatar_manager.rs`.
- The window CSP (`tauri.conf.json`) only allows `img-src` from self/`data:`/`asset:` — custom avatar frames must go through `convertFileSrc`.

## Avatar generation service

`projects/services/avatar-gen/` accepts a reference image and produces a `.gulupet.zip` (manifest + PNG frames + WebP strip) that the desktop app installs via `install_avatar_from_url`.

- `src/server.ts` — Express API + SSE job events; serves the built web UI.
- `src/pipeline.ts` — the generation pipeline: generate design + 16-frame idle pose sheet → slice → chroma-key to transparent frames → visual QA → WebP strip → manifest → zip.
- `AVATAR_IMAGE_PROVIDER` env selects the provider: `mock` (default, deterministic placeholders — no image quota) or `codex-cli` (runs Codex CLI with the `gulugulu-avatar-imagegen` skill).
- **Only `idle_normal` is customized** for imported avatars; all other pet states fall back to the built-in Guluduck frames.

## Release

Pushing a `v*` tag (or manual `workflow_dispatch`) runs `.github/workflows/release.yml`, which builds macOS / Ubuntu 22.04 / Windows installers with `tauri-action` and uploads them to a **draft** GitHub Release. Generated dirs (`node_modules`, `dist`, `src-tauri/target`, avatar-gen `.data/`) are gitignored — build from a clean checkout.
