# WS5 · 上架发布 —— ⛔ 冻结

> **用户指示(2026-07-11):先进行测试,不要正式发布。**
> 本工作流冻结,任何会话在用户明确 go-ahead 前**不得执行**以下任何动作(包括商店页可见性变更、提审、定价提交、build 设为默认公开分支)。

## 解冻后的任务清单(预备,不执行)

- [ ] R1. `scripts/steam/` depot 管线:depot 布局(release `gulugulu.exe` + `steam_api64.dll` + 前端 dist,**不是** NSIS/MSI 安装包)、`app_build.vdf`、steamcmd 上传脚本;👤 steamcmd 首次登录用户本人(之后凭据缓存可自动)
- [ ] R2. `installscript.vdf`:首启安装 WebView2 Runtime(Tauri 上 Steam 常见坑;多数 Win10/11 已带,仍需兜底)
- [ ] R3. Steam overlay 在透明无边框 WebView2 窗口上的表现实测(本方案不依赖 overlay,异常则文档说明)
- [ ] R4. 👤 商店页素材(胶囊图/截图/预告/文案)与定价决策(免费会提高玩家侧受限账号的交易门槛——届时给利弊分析)
- [ ] R5. 👤 提交商店页与 build 审核(提交点击用户确认);发售
- [ ] R6. 发售后:验证宠物市场页出现、marketable 生效(WS4-D5 遗留);市场公开价格接口接入交易所面板行情(可选)
- [ ] R7. release CI:决定 GitHub 双分发是否保留;若保留,`bundle.resources` 已带 dll(WS2-A3),验证 mac/linux 矩阵联编
- [ ] R8. **收紧掉落参数**:库存服务页应用级参数从测试值 5/10/5 改回生产值 45/2/120(2026-07-11 为便于 WS4 测试放宽,发布前必须改回并重新发布配置)

## 笔记

(解冻时追加)
