# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Two modes: installing vs. developing

- **A user asking to *install* Gulugulu** → this is the common case. Do not build from source by default. Read `INSTALL.md`, then prefer the latest published GitHub Release installer for the current OS:
  - Windows: `scripts/install.ps1`, or the latest `.msi` / `.exe` asset.
  - macOS / Linux: `scripts/install.sh`, or the latest `.dmg` / `.AppImage` / `.deb` asset.
  - Only build from source when no matching Release asset exists. Source builds need Node.js LTS, Rust stable, and Tauri system dependencies.
- **Working on the code** → the rest of this file.

## Repository shape

This is a monorepo with one buildable Node project plus supporting material:

- `projects/gulugulu-app/` — the product: a **Tauri 2 + React 19 + TypeScript (Vite)** desktop pet app. Rust backend in `src-tauri/`, React frontend in `src/`.
- `arts/` concept art · `docs/` + `specification/` planning · `config/` project config · `codex/` + `claude/` agent working notes.
- `start.bat` / `stop.bat` (repo root) — Windows helpers that launch/stop the desktop app.

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

There is **no lint, no formatter, and no JS test suite**. `npm run build` (app) is the only frontend static gate. The Rust backend, however, **does** have unit tests — run `cargo test` from `src-tauri/` (covers the pure game logic, CLI-output validation, and fusion-job scheduling) — plus `cargo build` via `tauri:dev` / `tauri:build`.

## Desktop app architecture

The whole app is a single **frameless, transparent, always-on-top 260×320 window** (see `src-tauri/tauri.conf.json`) that renders one animated pet reacting to coding-agent activity.

### Backend (Rust, `src-tauri/src/`)

- `lib.rs` — Tauri entrypoint. Builds the tray menu (show / hide / always-on-top / quit), registers all `#[tauri::command]` IPC handlers, and spawns the two watcher threads.
- `codex_adapter.rs` — the core. Two polling threads (`spawn_codex_watcher`, `spawn_claude_code_watcher`) tail the **latest** agent session log and turn JSONL lines into `CodexActivityEvent`s:
  - Codex: `<CODEX_HOME>/sessions/**/*.jsonl` (homes discovered from `CODEX_HOME` env or platform candidates).
  - Claude Code: `<CLAUDE_HOME>/projects/**/*.jsonl` (`CLAUDE_HOME` env or platform candidates).
  - Both threads share one `SharedCodexState` and **emit on the same `codex://activity` event channel** — the channel name is historical; the `source` field (`"codex"` | `"claudeCode"`) distinguishes them.
  - Per-project running totals (`total_tokens`, and `experience` = tokens/1000) are persisted to `gulugulu-progress.json` in the app data dir, with per-session byte offsets so restarts don't double-count.
- `cli_spawn.rs` — the shared Windows-safe CLI spawn toolset (`where`/`which` resolution, `.cmd` wrapping, `CREATE_NO_WINDOW`, `taskkill /T` tree-kill, the `claude -p` / `codex exec` invocation, and brace-balanced JSON extraction). `Provider` / `available_providers` / `run_provider` are `pub(crate)` and reused by **both** `fusion_gen.rs` and `quote_gen.rs`.
- `fusion_gen.rs` — AI species-fusion worker. Spawns the local Codex/Claude CLI (via `cli_spawn`) off the UI thread to design new species, validates the returned JSON against a strict schema, and pushes progress on `fusion://progress`. A background worker drains pending-fusion eggs one at a time; on generation failure it **auto-retries in-session** up to `MAX_FUSION_ATTEMPTS` (and startup recovery resets `failed`/`generating` → `pending`), before the egg falls back to a `guluduck` hatch at its deadline. The pick order is pure and unit-tested (`pick_fusion_job`): new `pending` eggs first, then retryable `failed` ones.
- `quote_gen.rs` — background worker that, once a Codex/Claude CLI is connected, pre-generates a batch of humorous bilingual speech quotes (via `cli_spawn`'s toolset, run in a neutral temp cwd), caches them to `gulugulu-quotes.json`, exposes `get_dynamic_quotes` / `regenerate_quotes`, and pushes `quotes://ready`. The frontend mixes them 50/50 with the static `ai_quotes.json` pool.
- `game/` — the gameplay backend (save data, click-economy, shop/egg-pool, hatching, fusion, facility upgrades, Steam sync), split into submodules: `model` (serde save DTOs, `#[serde(rename_all = "camelCase")]`), `state` (the shared `Mutex<GameSave>` + id counter), `logic/*` (pure, **unit-tested** rules — `progression` / `economy` / `fusion` / `facility` / `energy`), `persist` (atomic save write + the central `with_save` lock wrapper + schema migration + the watcher-thread entry points), `commands` (`#[tauri::command]` IPC, incl. the Steam-integrated blocking flows), `debug` (debug-build-only cheats), and `tests`. **All mutable state funnels through `with_save`**; the `logic_*` functions take `&GameConfig` + `&mut GameSave` and never touch the lock, which is why they're directly testable. `game_config.rs`, `fusion_slots.rs`, and `steam*.rs` back these.
- `window_tracker.rs` — Windows-only Win32 call returning the foreground window bounds so the pet can wander *away* from the active window. No-op (returns `None`) on other platforms.

### Frontend (React, `projects/gulugulu-app/src/`)

- `App.tsx` — the top-level UI **composition root** plus the coupled interaction core that resists extraction (pointer drag/click, the feeding/experience queue, click-fx juice, the `codex://activity` subscription + 2s `get_codex_status` poll). It has been decomposed into `src/app/`:
  - `app/hooks/usePetStateMachine.ts` — the pet state machine + **agent-active latch** (keeps the pet in the looping `working`/`thinking` animation while any Codex/Claude session runs; one-shot events like `fed`/`success`/`error` settle back to that baseline, not idle). It owns `stateRef`/`lastEventAt`/the latch refs and the three dispatch callbacks; the *state-machine effects* deliberately stay in `App.tsx` (reading the hook's returned API) so effect ordering is unchanged.
  - `app/` pure helpers — `geometry.ts`, `wander.ts` (`chooseAutonomousTarget` avoids the active window), `speech.ts` (the bilingual quote engine).
  - `app/` presentational — `PetStage.tsx`, `Overlays.tsx`, `SettingsPanel.tsx`, `SpeechBubble.tsx`, `pops.ts`.
  - `app/hooks/` subscription hooks — `useAppSettings`, `useSteamStatus`, `useDynamicQuotes`, `useFusionProgress`, `useEggCountdown`, `useWelcomeBack`.
- `game/BackyardScene.tsx` — the full-screen backyard/economy scene (its own composition root). Decomposed into sibling presentational components (`BackyardDecor`, `BackyardHatcheryPits`, `BackyardShopPopup`, `BackyardMuseumPanel`, `BackyardMarketPanel`, `BackyardNoticeBoard`, `BackyardNearPetActions`, `BackyardDex`) and hooks (`useBackyardMotion` — the rAF walk/camera/parallax loop; `useBackyardWorkFx`; `useCharSpeech`). It mutates game state only through `game/bridge.ts` + callback props passed down from `App.tsx`.
- `petEvents.ts` — the state-machine tables: `PetEventType → PetState` (`stateForPetEvent`), one-shot durations (`transientStateDurationMs` / `svgStateDurationMs`), the activity-latch constants (`AGENT_ACTIVE_WINDOW_MS`, `agentActivityEventTypes`, `sustainedAgentBaseline`), and normalization of raw agent events (`normalizeCodexEvent`).
- `sprites/SvgSprite.tsx` — renders every species from a code-drawn SVG **rig**; the current `petState` becomes a `.svg-sprite-state-<petState>` class and `sprites.css` drives all motion (loop vs one-shot lives in the CSS iteration-count). This is the only render path — there are no PNG frames.
- `types.ts` — TypeScript mirrors of the Rust structs.
- `tauri.ts` — `isTauri()` guard. When false ("preview mode", i.e. plain browser via `npm run dev`), all `invoke`/native calls are skipped and the pet just idles/animates.

### End-to-end flow

Agent writes a JSONL session line → Rust watcher tails the file, parses it, updates the progress store, and emits `codex://activity` → `App.tsx` dispatches a pet event through the state machine (`usePetStateMachine`, refreshing the agent-active latch) → `SvgSprite` renders the matching `.svg-sprite-state-*` animation. `token_count` events additionally drive an "experience / feeding" queue that plays the `eat` animation (frontend dedupes them via `seenTokenEventKeysRef`); the pet then returns to the `working`/`thinking` baseline until the session goes quiet (~10s), when it falls back to idle.

### Cross-cutting rules

- **Rust ↔ TS type parity**: Rust serde structs use `#[serde(rename_all = "camelCase")]` to match `types.ts`. Change one side → change the other.
- **Adding a pet animation** is SVG-only: add the `PetState` in `types.ts`, map events to it in `stateForPetEvent` (`petEvents.ts`), add a `.svg-sprite-state-<state>` rule in `sprites/sprites.css` (loop vs one-shot = CSS iteration-count), and — for one-shots — a duration in `transientStateDurationMs` / `svgStateDurationMs`.
- The window CSP (`tauri.conf.json`) allows `img-src` only from self/`data:`.

## Release

Pushing a `v*` tag (or manual `workflow_dispatch`) runs `.github/workflows/release.yml`, which builds macOS / Ubuntu 22.04 / Windows installers with `tauri-action` and uploads them to a **draft** GitHub Release. Generated dirs (`node_modules`, `dist`, `src-tauri/target`) are gitignored — build from a clean checkout.
