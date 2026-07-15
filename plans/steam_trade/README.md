# Steam 交易接入 · 跨会话进度总览

> 目标:孵化结果全部经 Steam Inventory Service 记录为玩家 Steam 资产;宠物可在 Steam 交易。
> 本目录是**唯一进度事实源**。任何会话(人或 AI)开工前必读本文件 + 所认领工作流文档;设计层面的疑问以 [00-decisions.md](00-decisions.md) 为准。

## 状态看板

| WS | 工作流 | 文档 | 状态 | 依赖 | 备注 |
|----|--------|------|------|------|------|
| WS1 | 创建应用与网站配置 | [01-app-setup.md](01-app-setup.md) | ✅ 完成(2026-07-12) | — | **App ID 4956830**;库存服务已启用;掉落参数测试值 5/10/5 已发布 |
| WS2 | Rust 集成与状态机 | [02-rust-core.md](02-rust-core.md) | ✅ 代码完成(2026-07-12) | — | cargo test 47 通过;真机冒烟移交 WS4 |
| WS3 | 物品目录/脚本/图标 | [03-itemdefs.md](03-itemdefs.md) | ✅ 完成(2026-07-12) | — | **75 条 itemdefs 已上传生效**;图标 27/27 已渲染(icon_url 待图标推送 GitHub 后重传) |
| WS4 | 联调与交易验收 | [04-testing.md](04-testing.md) | ⏸️ 暂缓(2026-07-12 用户指示:先本地调试) | 用户本地调试完成 + 重开集成开关 + Steam 客户端 | 重启时先设 `GULUGULU_STEAM=1`(见 00-decisions.md「集成总开关」) |
| WS5 | 上架发布 | [05-release.md](05-release.md) | ⛔ 冻结 | 用户明确 go-ahead | **用户指示:先测试,不正式发布** |
| WS6 | 融合2.0目录预创建 + 创意工坊代码 | (本 README 进度日志 + FusionSystem.md §9) | 🚧 代码/目录完成并暂存(2026-07-15),真机上传待 go-ahead | WS1 + 用户推图标到公开仓库 + 重开集成开关 | 63 固定宠 + 570 AI 占位 = 702 itemdefs;创意工坊 UGC 代码就位(默认关);**真机上传/开工坊 = WS5 冻结区,须用户明确** |

状态图例:⬜ 未开始 · 🚧 进行中 · ⛔ 阻塞/冻结 · ✅ 完成

## 依赖关系

```
WS1(App ID + Inventory Service 开通)──┐
WS2(Rust/前端代码,不等 App ID)───────┼──► WS4(联调+交易验收)──► WS5(上架,冻结中)
WS3(itemdefs 生成;上传一步等 WS1)────┘
```

## 会话约定(必读)

1. **开工**:读本 README + 认领的 WS 文档;把看板对应行改成 🚧 并在"备注"写明会话/日期。
2. **完成任务**:在 WS 文档把 `- [ ]` 改 `- [x]`,行尾追加 `(YYYY-MM-DD,一行结果)`;整个 WS 完成后更新看板为 ✅。
3. **改设计**:先改 [00-decisions.md](00-decisions.md)(附理由与日期),再动代码。**安全不变量与 itemdefid 编号一经使用不可回改**。
4. **受阻**:看板标 ⛔ 并在 WS 文档写明阻塞原因与需要谁解除。
5. **验证门**:任何代码合入前跑 `npm run build`(projects/gulugulu-app)+ `cargo build && cargo test`(src-tauri)。仓库无 lint/test 之外的静态门。
6. **安全红线**(对所有会话生效):支付、签署协议、输入任何密码/密钥必须用户本人;合作伙伴网站"保存/发布"类不可逆点击须先经用户确认;全程**不创建、不经手** Steam Web API key;WS5 冻结期间不得执行任何发布动作。

## 进度日志

- 2026-07-11 计划批准(v2:随机生成器接口 / 先测不发 / 跨会话文档),本目录建立。WS1 于同会话启动。
- 2026-07-11 用户完成 $100 支付;创建应用 **Gulugulu(App ID 4956830)**;启用库存服务,掉落参数设测试值 5/10/5。
- 2026-07-12 配置发布成功(仅所有者可见)。WS1 A/B 完成;WS2、WS3 解锁,可并行认领。
- 2026-07-12 主会话完成 WS2(Rust/前端全量,cargo test 47 通过)+ WS3(75 条 itemdefs 上传生效,27 图标渲染)。WS1 全部完成。**下一步 = WS4 联调**(需 Steam 客户端 + 拥有 4956830 的账号);待决事项清单见主会话汇报(或 00-decisions.md 待决节)。
- 2026-07-12 **用户指示:本地调试期关闭 Steam 集成** → 加总开关(默认关,`GULUGULU_STEAM=1` 或改 `STEAM_DEFAULT_ENABLED` 重开,详见 00-decisions.md「集成总开关」)。关闭时全部玩法回退纯本地逻辑。门禁复跑全绿(cargo test 47 / cargo build / npm build)。**WS4 暂缓,等用户本地调试完成后重启。**
- 2026-07-14 **用户拍板两项新机制**(纯 Steam、无自建服务器)→ 记入 00-decisions.md「用户拍板(2026-07-14)」:①孵化率挂钩全局存量 = **手调 generator 权重**(承接「热调 itemdef」不变量,不做客户端概率耦合);②AI 物种形象/名字由首个生成者上传 = **创意工坊 UGC**(按 petId 全局共享、跨交易保留,解决待决 1、化解待决 4 外观面)。均为**研究+决策**,暂未进入实现。
- 2026-07-15 **WS6:融合2.0 Steam 预创建 + 创意工坊落地(准备+暂存,不触真机)**。①**确定性槽位身份**(`fusion_slots.rs`↔`fusionSlots.ts` 加 `recipeOrdinal`/`aiItemDef`/`slotCodename`,替换随机 `aif{6hex}`;`verify_fusion_slots.mjs` 逐位对拍绿)。②**加法编号**(永不重编旧 101-521):57 新固定宠 `601-657`(config `steamItemDef` 已写两份、`game_config.rs` 冻结测试改断言);570 AI 占位 `10000 + 序号*100 + slot`(codename=`aif`+2位序+2位槽,同为创意工坊 petId 标签)。③`generate_itemdefs.mjs` 产 **702 itemdefs**(仅宠物条目,新蛋/生成器龙头链推迟——3+元素并集 exchange 未解,§9 P5 待决 2);`render_steam_icons.tsx` 出 84 物种 + 5 张 AI 占位图 = 89 PNG;新增 `verify_itemdefs.mjs`。④**创意工坊 UGC 代码**:`steam_workshop.rs`(高层 `Client::ugc()` 发布/查询/下载,最早发布者胜)接入 `steam.rs` 泵线程(独立 workshop 通道,全 gated);`fusion_gen.rs` 生成即用确定性 codename、生成后 best-effort 上传认领、生成前查询命中则下载复用。门禁:`cargo test` 92 绿 / `cargo build`(check)绿 / `npm run build` 绿 / 两 verify 脚本绿。**真机上传 702 目录 + 开启创意工坊 = 冻结区,待用户 go-ahead(先推图标到公开仓库,再 `--with-icons` 重传)。**
