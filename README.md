# Gulugulu

Gulugulu is a desktop virtual pet companion for agent-assisted workflows. It watches coding-agent activity and turns progress signals, such as token usage and task events, into little pet reactions.

The current application is a Tauri + React + Vite desktop app.

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
npm install
npm run tauri:dev
```

## Build

```powershell
cd projects/gulugulu-app
npm run tauri:build
```

## Notes

Generated folders such as `node_modules`, `dist`, and `src-tauri/target` are intentionally ignored by git. Release installers should be produced from a clean checkout.
