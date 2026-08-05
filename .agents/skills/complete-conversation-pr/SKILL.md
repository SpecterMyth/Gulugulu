---
name: complete-conversation-pr
description: Complete every Codex conversation that changes the Gulugulu repository by committing only conversation-owned paths, pushing a codex/* branch, and creating or updating a compliant draft pull request. Use for any implementation, fix, refactor, documentation, configuration, asset, or workflow task that writes repository files; do not use for planning, explanation, or read-only diagnosis with no repository changes.
---

# Complete Conversation PR

Apply this workflow whenever the conversation changes repository files.

1. Work in the `main` worktree on a `codex/*` branch. Do not edit the `Release` or `SteamOnline` worktrees.
2. Preserve changes that existed before the conversation. Stage only explicit paths owned by the current conversation.
3. Run task-appropriate verification before preparing the PR.
4. Finish with `scripts/project-management/Complete-Conversation.ps1`, passing the session ID supplied by the SessionStart hook, a one-line Chinese summary, detailed Chinese description, verification results, and explicit paths.
5. Use `-Amend` when continuing the same conversation after its first push. Never create a second commit or PR for the same conversation.
6. Do not bypass a failing workflow check. Fix the reported condition and rerun the completion script.
7. End the final response with the draft PR URL. Never merge the PR unless the user explicitly requests it.

Example:

```powershell
./scripts/project-management/Complete-Conversation.ps1 `
  -SessionId '<session-id>' `
  -Summary '修复繁体中文引导文案' `
  -Details '统一繁体中文引导用词，并补充对应校验。' `
  -Tests 'npm test：通过' `
  -Risk '无已知风险' `
  -Paths @('projects/gulugulu-app/src/example.ts')
```

The script derives the `[MODEL]` PR-title prefix from the model captured by the hook. Do not write or guess that prefix manually. Pure planning and read-only conversations must not create empty commits or PRs.
