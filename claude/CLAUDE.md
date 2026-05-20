# Gulugulu Project Configuration
> Desktop virtual pet project for agent-assisted workflows

## Project Overview
- **Name**: Gulugulu
- **Type**: Desktop virtual pet application
- **Core Concept**: Virtual pet that grows alongside user's agent-assisted work
- **Status**: Initialization phase

## Core Features
1. Agent activity drives pet reactions and behavior
2. Token usage consumption as pet food/resource
3. Long-term work history contributes to pet growth and evolution
4. Cross-user pet connectivity and social features
5. Autonomous inter-pet communication capabilities

## Directory Structure
```
gulugulu/
├── arts/              # Art assets, concept art, character designs
├── claude/            # Claude Code project configuration (this directory)
├── codex/             # Codex working notes, memory, collaboration records
├── config/            # Project configuration files
├── docs/              # Planning documents, implementation notes
├── projects/          # Buildable application projects
│   └── gulugulu-app/  # Main Tauri + Vue desktop application
└── specification/     # Product and technical specifications
```

## Technology Stack
- **Frontend**: Vue 3 + TypeScript + Vite
- **Desktop Framework**: Tauri 2
- **Backend**: Rust (Tauri core)
- **AI Integration**: Claude API for agent interactions and pet behavior

## Commonly Used Commands
```bash
# Development
cd projects/gulugulu-app
npm run tauri dev       # Start Tauri development server
npm run dev             # Start Vite dev server only

# Build
npm run tauri build     # Build production desktop app
npm run build           # Build frontend only

# Project Management
npm run lint            # Lint code
npm run type-check      # TypeScript type checking
```

## Working Guidelines
1. All Claude-related files are stored locally in `/claude/` directory, not in global storage
2. Project memory and work logs are stored in `/codex/` directory
3. Follow specification documents in `/specification/` for implementation
4. All application code must be placed in `/projects/` directory
5. Keep configuration files in `/config/` directory centralized

## Memory System
- Project memory is stored in `/claude/memory/` directory
- Memory index file: `/claude/MEMORY.md`
- All memories are project-specific, not global
