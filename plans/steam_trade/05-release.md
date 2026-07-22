# WS5 · 上架发布 —— ⛔ 冻结

> **用户指示(2026-07-11):先进行测试,不要正式发布。**
> 本工作流冻结,任何会话在用户明确 go-ahead 前**不得执行**以下任何动作(包括商店页可见性变更、提审、定价提交、build 设为默认公开分支)。

## 解冻后的任务清单(预备,不执行)

- [ ] R1. `scripts/steam/` depot 管线:depot 布局(release `gulugulu.exe` + `steam_api64.dll` + 前端 dist,**不是** NSIS/MSI 安装包)、`app_build.vdf`、steamcmd 上传脚本;👤 steamcmd 首次登录用户本人(之后凭据缓存可自动)
- [ ] R2. `installscript.vdf`:首启安装 WebView2 Runtime(Tauri 上 Steam 常见坑;多数 Win10/11 已带,仍需兜底)
- [ ] R3. Steam overlay 在透明无边框 WebView2 窗口上的表现实测(本方案不依赖 overlay,异常则文档说明)
- [~] R4. 👤 商店页素材(胶囊图/截图/预告/文案)与定价决策 —— **素材+文案已产出(2026-07-17,详见 [06-store-page.md](06-store-page.md))**:全套胶囊/库图/图标 + 12 张双语截图、中英文案定稿、定价拍板 $0.99/¥6(用户选付费:免费会提高玩家侧受限账号交易门槛,与 Steam 交易核心冲突)。**剩余**:desktop_hero 真机镜头(需重编译含本地化的 release exe + 约时机);预告片(非硬性,后补);后台上传+填写(下条)。
- [ ] R5. 👤 后台填写商店页(素材/文案/系统需求/语言/内容问卷+AI 披露)+ 定价 + 开启创意工坊 → **提交商店页与 build 审核**(用户登录 partner 站,AI 用文本工具驱动填写;**提审/完成发行类点击用户本人**);Coming Soon ≥2 周 + 30 天付费规则(≈2026-08-10)后发售
- [ ] R6. 发售后:验证宠物市场页出现、marketable 生效(WS4-D5 遗留);市场公开价格接口接入交易所面板行情(可选)
- [ ] R7. release CI:决定 GitHub 双分发是否保留;若保留,`bundle.resources` 已带 dll(WS2-A3),验证 mac/linux 矩阵联编
- [ ] R8. **收紧掉落参数**(2026-07-16 改口径:窗口应用级=1440 是**设计值不回改**;`drop_window` 非 per-def,见 00-decisions 实证):发布前把应用级 `inventory_playtime_frequency` 5→45(被动掉落游玩门槛)、`_max_items_per_window` 10→2(401-406 被动掉落每日 2 只;商店 gen 有 per-def max 不受影响)、`_minimum` **保持 1440**;并复核商店 gen per-def `drop_interval:1` 生产是否上调
- [ ] R9. **⚠️ 取消勾选 Steam 云「仅为开发人员启用云支持」**(partner 站 App Admin → 云,`hidecloudui`;2026-07-18 为发行前测试勾上)——不取消则**正式玩家上传创意工坊皮肤时预览图会静默失败**(工坊物品缩略图存上传者 per-app 云空间;云配额 100MB/1000 文件已配置勿动,根因实证见 00-decisions 创意工坊落地状态)。改完须走发布页发行生效。

## 笔记

(解冻时追加)
