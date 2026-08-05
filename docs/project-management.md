# 项目分支与发布流程

完整开发仓库位于 `Gulugulu/main`。`Release` 是由白名单生成的最小可构建快照，`SteamOnline` 只快进到确认上线的 Release 提交。不要直接编辑后两个工作区。

## Codex 日常开发

任何修改仓库文件的 Codex 对话都必须使用 `complete-conversation-pr` skill，并在 `main` 工作区的 `codex/*` 分支完成。纯计划、解释和只读诊断不创建空提交或 PR。

对话结束前运行：

```powershell
./scripts/project-management/Complete-Conversation.ps1 `
  -SessionId '<SessionStart hook 提供的 ID>' `
  -Summary '一句话中文描述' `
  -Details '详细改动说明' `
  -Tests '验证命令与结果' `
  -Risk '风险或备注' `
  -Paths @('本次对话修改的路径')
```

脚本只暂存显式路径，为当前对话保留一个提交，推送分支，并创建目标为 `main` 的草稿 PR。同一对话续改时添加 `-Amend`，脚本会使用 `--force-with-lease` 并更新原 PR。

PR 标题格式固定为 `[模型名]一句话中文描述`，例如 `[GPT5.6SOL]修复繁体中文引导文案`。模型标签来自 Codex hook 捕获的真实模型，不手工填写。正文必须包含“详细说明”“验证结果”“风险与备注”。最终回复必须包含 PR URL；代理不得自行合并。

`.codex/hooks.json` 在会话开始时记录 Git 基线，并在 Codex 准备停止时验证提交、远端分支和 PR。首次发现 hook 或 hook 内容变化后，需要在 Codex `/hooks` 中审核并信任。项目 hook 可由拥有本机配置权限的人禁用；若未来需要管理员级不可关闭策略，应再通过托管的 `requirements.toml` 部署。

## 创建 Release

先把候选改动合入 `main`，确保候选 SHA 等于 main 工作区的 `HEAD`。运行 `New-ReleaseSnapshot.ps1 -SourceRevision <sha>`。脚本先在完整 main 候选上运行 Cargo 测试，再从 Git 对象读取白名单，并在精简 Release 中执行 npm 构建和 Cargo 构建。所有门禁通过后才提交 Release 快照并生成 `.release-metadata.json`。`-SkipTests` 只预览候选树，绝不会提交。

## 发布 Steam

获得明确发布批准后运行 `Promote-SteamOnline.ps1`。该操作只允许 fast-forward，并校验两个分支的文件树一致。Steam 上传成功后，把 Steam Build ID、SteamOnline SHA 和版本记录在 main 的发布记录中。

## 故障处理

测试失败时不要推进 Release。修复必须回到 main 的新对话分支完成，再重新生成快照。需要重建干净测试依赖时运行 `Reset-ReleaseEnvironment.ps1`；它只会清理 Release 内明确列出的缓存目录。
