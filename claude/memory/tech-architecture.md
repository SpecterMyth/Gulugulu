---
name: tech-architecture
description: Technical stack and architecture decisions for Gulugulu
metadata:
  type: project
---

# Technical Architecture

## Technology Stack
### Core
- **Desktop Framework**: Tauri 2 (Rust backend, Web frontend)
- **Frontend**: Vue 3 + TypeScript + Vite
- **Backend**: Rust (Tauri core, native system integration)
- **AI Integration**: Claude API (Anthropic SDK)

### Supporting Tools
- **Package Manager**: npm
- **Build Tool**: Vite + Tauri CLI
- **Linting**: ESLint + TypeScript ESLint
- **Formatting**: Prettier
- **Version Control**: Git

## Architecture Layers
```
┌─────────────────────────────────────────────────────┐
│                     Frontend UI                     │
│  (Vue 3 + TypeScript - Pet rendering, interactions) │
└───────────────────────────────────┬─────────────────┘
                                    │
┌───────────────────────────────────▼─────────────────┐
│                   Tauri IPC Bridge                  │
│  (Communication between frontend and Rust backend)  │
└───────────────────────────────────┬─────────────────┘
                                    │
┌───────────────────────────────────▼─────────────────┐
│                     Rust Core                       │
│  (System integration, data persistence, pet logic)  │
└───────────────────────────────────┬─────────────────┘
                                    │
┌───────────────────────────────────▼─────────────────┐
│                 External Integrations               │
│  (Claude API, system monitoring, optional network)  │
└─────────────────────────────────────────────────────┘
```

## Key Components
1. **Pet Engine**: Core logic for pet behavior, growth, and state management
2. **Activity Monitor**: Tracks user development activity and agent usage
3. **Data Store**: Local persistent storage for pet state and user history
4. **Integration Layer**: Connects with IDEs, version control, and AI agents
5. **Social Module**: Optional peer-to-peer connectivity for pet interactions

## Data Flow
1. User/agent activity is captured by the monitor
2. Activity data is processed to generate pet state changes
3. State updates are sent to frontend for rendering
4. Long-term data is persisted locally for growth tracking
5. Optional: State can be shared for social features
