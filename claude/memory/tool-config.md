---
name: tool-config
description: Development toolchain configuration and setup instructions
metadata:
  type: reference
---

# Tool Configuration

## Development Environment Setup

### Prerequisites
1. **Rust**: Latest stable version (https://www.rust-lang.org/tools/install)
2. **Node.js**: v20+ LTS version (https://nodejs.org/)
3. **Tauri CLI**: v2+ (install via `cargo install tauri-cli`)
4. **System dependencies**: Follow Tauri prerequisites for your OS (https://beta.tauri.app/guides/prerequisites/)

### IDE Setup
**VS Code recommended extensions:
- `rust-lang.rust-analyzer` - Rust language support
- `Vue.volar` - Vue 3 language support
- `bradlc.vscode-tailwindcss` - Tailwind CSS IntelliSense
- `dbaeumer.vscode-eslint` - ESLint integration
- `esbenp.prettier-vscode` - Prettier formatting
- `tauri-apps.tauri-vscode` - Tauri integration

## Build and Development
### Development Commands
```bash
# Install dependencies
cd projects/gulugulu-app
npm install

# Start development server (frontend + Tauri)
npm run tauri dev

# Start only
npm run dev

# Build production application
npm run tauri build

# Type checking
npm run type-check

# Linting
npm run lint

# Format code
npm run format
```

## CI/CD Configuration
To be implemented - will include:
- Automated testing on PRs
- Automated builds for all platforms
- Release packaging and distribution
- Version management and changelog generation

## Useful Tools
- **Tauri Inspector**: Built-in devtools for Tauri applications
- **Vue DevTools**: For frontend debugging
- **Rust Debugger**: lldb/gdb for backend debugging
- **Clairvoyance**: For monitoring Claude API usage tracking and debugging
