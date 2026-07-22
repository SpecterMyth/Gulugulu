# WS4 · 联调与交易验收(依赖 WS1+WS2+WS3)

状态:⬜ 未开始
前置:App ID 就绪、Inventory Service 已开、itemdefs 已上传、WS2 代码合入、Steam 客户端以拥有该 App 的开发者账号运行。

## A. 铺场与冒烟

- [ ] A1. dev 构建跑 `debug_steam_generate_items` 铺测试库存 → steamcommunity.com/my/inventory 网页可见物品(名称/图标/绑定旗标正确)
- [x] A5. **窗口掉落冒烟·部分通过**(2026-07-16,`steam_smoke::a5_window_cap` + `a5_tail_check`):①**首会话 13 轮零掉落** → ②新会话尾测第 2/3/4 轮连掉 3 个 101 = **⚠️ Steam 游玩时长短会话滞后入账、会话结束才上报**(known behavior:同会话内挂时长不解锁掉落,重启会话即好;WS4 后续与生产都要按此理解)③`drop_interval:1` 每分钟一发节奏实证 ✓ ④**掉落同 def 自动堆叠**(同 item_id,quantity 1→2→3)——**"一宠一物品 id"绑定模型需拆栈**(TransferItemQuantity),列入铸造重接线设计输入 ⑤ConsumeItem 每次只消耗 q=1 → 残留 101×2(并入 A8 清理)。**满 10 封顶拒绝 + 次日重置**为长时/隔天观察项,机制面(掉落+计数+per-def interval 覆盖)已实证
- [x] A6. **set: 标签 ExchangeItems 冒烟(⛔ Rust 铸造重接线的前置)**(2026-07-16,`steam_smoke::a6_a7_exchange_primitives` 一次通过:GenerateItems 铺 90003+90004 → ExchangeItems(90006) 开出 90005 ✓;两只 101 → ExchangeItems(101,`sp:guluduck*2`)铸新 101 净−1 ✓ —— **set: 标签匹配与 item 型 def 自带 exchange 两个原语真机成立,重接线解锁**)
- [x] A7. **并集 generator 开池**(2026-07-16,同测试:101+104 打 20014(normal+water)→ 开出 **615 泡澡獭**(加权 bundle 掷中 0 号)✓;负例 101+104 打 20000(electric+fire)→ `k_EResultFail` 服务器拒绝 ✓ —— **物种稀有度服务器强制实证**;测试自带 Consume 清理,库存无残留)
- [ ] A8. **冒烟残留清理**:A5-A7 验完处理 90001-90007 冒烟 defs(merge 语义不会自动清;partner 站若无删除入口则重传为 hidden+不可交易+去 exchange 的中和态)
- [x] A9. **创意工坊双路真机验证**(2026-07-16,前置=partner 站开工坊「非公开」+ ISteamUGC 文件传输,用户已发行):①**上传路**:`spawn_workshop_backfill` 存量 9 个 AI 物种 9/9 上传成功(publishedFileId 3765893901~3765896102,`legalPending=false`;开工坊前 CreateItem 一致 `Busy`,开后即通;个别首批失败由"下次启动重扫"两轮收敛——含 Steam 侧偶发,重试设计实证有效)。②**查询/下载路**:`steam_smoke::workshop_resolve_roundtrip`(只读,~9s)——unlisted 曝光下 `query_all`+petId 标签正命中 aif0401、DownloadItem 回读 12KB 合法 CustomSpeciesEntry JSON(nameZh=汐跃侯),未认领槽 `aif9901` 返回 None ✓。跑法:`PATH="$PWD/target/debug:$PATH" cargo test --lib steam_smoke::workshop_resolve_roundtrip -- --ignored --nocapture`。网页端 filedetails 匿名访问"隐藏/无权限"=unlisted 预期(机器层 UGC 无公开网页)。
- [ ] A2. **generator 首验**(00 号文件遗留项):ExchangeItems 打 5XX 生成器,确认烧蛋→开出宠物、结果句柄返回的 def 正确
- [ ] A3. 泵稳定性:挂机 30 分钟无句柄泄漏(追踪器计数回零)、无 UI 卡顿

## B. 全流程回路

- [ ] B1. 一阶:买蛋→孵化→收获(本地先行)→ MintTier1 入队 → TriggerItemDrop 发放 → 按 id 绑定;连收多只同物种验证限频排队与退避重试
- [ ] B2. 融合:两只满级一阶 → ExchangeItems 烧材料出 3XX 蛋(Steam 先行,失败不动本地);材料不足/未绑定/op-lock 的拒绝路径
- [ ] B3. 二阶收获:ExchangeItems 5XX → **按返回 def 建宠**;放生三路(绑定/待发放/本地遗留)
- [ ] B4. 无 Steam 降级:关 Steam 客户端启动 app → unavailable 徽章、融合/二阶收获/绑定放生禁用有原因、一阶收获入队;重开 Steam 后队列消化

## C. 故障矩阵回放(对应 WS2-D6 单测的真机版)

- [ ] C1. 融合 ExchangeItems 成功与本地应用之间杀进程 → 重启意图探测补应用(费用不重扣)
- [ ] C2. 融合发起前杀进程(意图已写、Steam 未调)→ 重启弃意图解锁
- [ ] C3. MintTier1 发放与持久化之间杀进程 → 重启"认领优先于导入"不产生重复宠物/物品
- [ ] C4. 断网中途操作 → Uncertain 语义:意图保留、下轮探测解决、UI 提示"稍后自动核对"
- [ ] C5. 存档拷到第二路径/改 owner → 阻塞对话框流程
- [ ] C6. 手工编辑存档注水 outbox/等级 → 物品供给不膨胀(限频兜底),对账收敛

## D. 交易与市场行为实证

- [ ] D1. 👤 准备第二账号(交易资格:手机 Steam Guard ≥15 天、非受限账号);🌐 合作伙伴网站生成一枚 key(生成动作经用户确认)由第二账号激活
- [ ] D2. **最终验收**:账号 A 发交易报价送宠物给账号 B → A 端 app 对账后宠物消失(墓碑)、B 端导入(1 级新实例,设计如此)
- [ ] D3. 墓碑假设实证:挂市场→取消上架、交易报价托管→拒绝,观察物品 id 是否不变(变了则墓碑失配按 1 级导入,记录结论到 00-decisions.md)
- [ ] D4. drop_interval 手感调参:记录"正常游玩节奏 vs 限频等待"体验,必要时重传 itemdefs 热调(经用户确认)
- [ ] D5. marketable 无法在未发售时验证 → 显式记入 05-release.md 待办

## 笔记 / 阻塞记录

(执行时追加)
