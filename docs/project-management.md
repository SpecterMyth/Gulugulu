# 项目分支与发布流程

完整开发仓库位于 `Gulugulu/main`。`Release` 是由白名单生成的最小可构建快照，`SteamOnline` 只快进到确认上线的 Release 提交。不要直接编辑后两个工作区。

## 日常开发

实际修改使用 `codex/*` 分支。每次对话只保留一个提交；续改使用 `scripts/project-management/Commit-Conversation.ps1 -Amend`。分支推送后由代理创建或更新目标为 `main` 的草稿 PR，并把链接交给用户；用户只负责最终审核和合并。代理不得在没有明确指令时自行合并。

## 创建 Release

先把候选改动合入 `main`，确保候选 SHA 等于 main 工作区的 `HEAD`。运行 `New-ReleaseSnapshot.ps1 -SourceRevision <sha>`。脚本先在完整 main 候选上运行 Cargo 测试（这里保留测试素材），再从 Git 对象读取白名单，并在精简 Release 中执行 npm 构建和 Cargo 构建。所有门禁通过后才提交 Release 快照并生成 `.release-metadata.json`。`-SkipTests` 只预览候选树，绝不会提交。

## 发布 Steam

获得明确发布批准后运行 `Promote-SteamOnline.ps1`。该操作只允许 fast-forward，并校验两个分支的文件树一致。Steam 上传成功后，把 Steam Build ID、SteamOnline SHA 和版本记录在 main 的发布记录中。

## 故障处理

测试失败时不要推送 Release。修复必须回到 main 的新对话分支完成，再重新生成快照。需要重建干净测试依赖时运行 `Reset-ReleaseEnvironment.ps1`；它只会清理 Release 内明确列出的缓存目录。
