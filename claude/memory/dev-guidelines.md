---
name: dev-guidelines
description: Development guidelines, coding standards, and workflow
metadata:
  type: project
---

# Development Guidelines

## Workflow
1. **Feature Development**: Create feature branches from `main`
2. **Code Review**: All changes require review before merging
3. **Testing**: All new features must include appropriate tests
4. **Documentation**: Update documentation for all user-facing changes

## Coding Standards

### Frontend (TypeScript + Vue)
- Use TypeScript for all new code, avoid `any` type
- Follow Vue 3 Composition API best practices
- Use `<script setup>` syntax for single-file components
- Component names should be PascalCase, props camelCase
- CSS: Use scoped styles by default, utility classes where appropriate
- ESLint and Prettier are enforced on commit

### Backend (Rust)
- Follow Rust API guidelines and idiomatic patterns
- Use `cargo clippy` for linting, no warnings allowed
- Document all public APIs with rustdoc
- Error handling: Use `thiserror` for custom errors, `anyhow` for application code
- Performance: Avoid unnecessary allocations in hot paths

## Directory Conventions
```
projects/gulugulu-app/
├── src/                    # Frontend Vue code
│   ├── components/         # Reusable Vue components
│   ├── composables/        # Vue composables
│   ├── stores/             # Pinia state stores
│   ├── types/              # TypeScript type definitions
│   ├── utils/              # Utility functions
│   └── views/              # Page/view components
├── src-tauri/              # Rust backend code
│   ├── src/
│   │   ├── commands/       # Tauri IPC command handlers
│   │   ├── core/           # Core business logic
│   │   ├── db/             # Database access and models
│   │   ├── integrations/   # External system integrations
│   │   └── utils/          # Rust utility functions
│   └── tauri.conf.json     # Tauri configuration
```

## Commit Message Convention
Follow Conventional Commits format:
```
<type>(<scope>): <description>

[optional body]
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style/formatting changes
- `refactor`: Code refactoring without behavior changes
- `perf`: Performance improvements
- `test`: Test additions/updates
- `chore`: Build process, tooling, etc.

## Security Guidelines
- All IPC commands must validate input parameters
- Never expose sensitive user data in frontend
- Local storage data should be encrypted if containing personal information
- Network requests must use HTTPS, validate all responses
- Follow Tauri security best practices for filesystem access

## Testing Requirements
- Unit tests for all core logic
- Integration tests for IPC commands
- E2E tests for critical user flows
- Performance tests for resource-intensive operations
