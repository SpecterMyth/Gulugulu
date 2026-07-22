# WS2 · Rust 集成与状态机

状态:✅ 代码完成(2026-07-12,主会话);真机冒烟(G3 的 Steam 在线部分)移交 WS4
门禁结果:`cargo check --tests` ✅ · `cargo test` **47 通过 0 失败**(含 13 个 steam_sync 故障矩阵用例)· `cargo build` ✅(无警告)· `npm run build` ✅

## 实际落地的文件

| 文件 | 内容 |
|---|---|
| `src-tauri/src/steam_inventory.rs`(新) | 唯一 unsafe:steamworks-sys ISteamInventory 薄封装 + 结果句柄轮询(15s 超时,必 DestroyResult;`Uncertain ≠ Failed`) |
| `src-tauri/src/steam.rs`(新) | `Client::init_app(4956830)`(失败→unavailable 降级,不调 RestartAppIfNecessary);泵线程全串行:命令请求→60s outbox 巡检(意图探测→认领→单飞 mint 重试,退避 1/2/5/10min)→5min 对账;宽限集 30s;命令 `get_steam_status`/`steam_sync_now`/`steam_confirm_rebind`/`debug_steam_generate_items` |
| `src-tauri/src/steam_sync.rs`(新) | 纯逻辑:`attach_mints`(认领优先于导入)/`resolve_intents`(崩溃回放;融合回放走配方路径)/`reconcile`(按 def 分组计数收敛+墓碑+容量溢出待认领)/`migration_sweep`/`strip_steam_bindings`/`apply_fusion_local`;全部单测覆盖 |
| `src-tauri/src/game.rs` | schema v2(`steam_item_id: Option<String>` **字符串防 JS 精度**、`steam_item_def`、`steam_owner_id`、`steam_outbox`、`steam_tombstones`,serde default 兼容 v1);原子写(temp+rename);`collect_hatched`/`release_pet` 三段式(一阶本地先行+MintTier1 入队;二阶/绑定 Steam 先行);`fuse_pets` 拒绝已同步 Steam 素材;debug 命令 `ensure_debug_build()` 闸门 |
| `src-tauri/src/fusion_gen.rs` | `fuse_pets_ai` 三段式:CLI 预检→写 Fuse 意图→ExchangeItems(蛋 def←双材料)→成功后掷骰(AI/配方)并 `apply_fusion_local`;**掷骰在兑换成功之后** |
| `src-tauri/src/game_config.rs` | `SpeciesInfo.steam_item_def` + `steam_def_for_species`/`species_for_steam_def` + 偏移常量 + 编号冻结测试 |
| `src-tauri/Cargo.toml` | `steamworks = "0.13"` + `steamworks-sys = "0.13"`(高层 crate 的 sys 是私有 re-export,必须显式依赖) |
| `src-tauri/build.rs` | 从 cargo registry 定位 steamworks-sys 附带的 `steam_api64.dll` 拷到 target 目录(已验证 debug 落位;找不到只警告) |
| `src/types.ts` / `src/game/bridge.ts` | 全量镜像(SteamOp/SteamTombstone/SteamStatus;`steamItemId?: string`);TauriBridge + MockBridge(预览恒 unavailable) |
| `src/App.tsx` / `src/game/BackyardScene.tsx` | steam://status 订阅;ownerMismatch confirm→`steam_confirm_rebind`;交易所面板连接点/待发放/待认领 + 「立即同步」;行情列表宠物徽章(⏳同步中/🏠本地) |

## 关键实现决定(超出原任务分解的部分,均已在代码注释与 00-decisions 留痕)

1. **AI 自定义物种的 Steam 记账**:游戏已实装 50% AI 随机融合(动态物种无法映射静态 itemdef)。实现为:融合无论 AI/配方路径都兑换该配方的目录蛋 def;收取时若蛋已解析为自定义物种,本地宠物用自定义外观,但**绑定目录物种的物品**——交易转移的是目录资产,AI 外观是本地增值(不随交易转移)。⚠️ 列入待决清单等用户复核。
2. 二阶收取物种**一律取 Steam 实际发放 def**(随机就绪);AI 已解析蛋除外(见上)。
3. 泵线程全串行(每操作内轮询+run_callbacks),不注册库存回调——低频操作下无并发窗口,代码最简。
4. offline 状态暂未与 unavailable 区分(连接中断表现为操作失败+重试),留待后续细分。

## 剩余项(移交)

- [ ] G3(真机部分):Steam 客户端 + 拥有 4956830 的账号登录后 `npm run tauri:dev` 验证 init/泵/快照 → WS4-A
- [ ] 遗留:`bundle.resources` 未配置(GitHub 安装包不含 steam_api64.dll,装完启动会缺 dll)→ 05-release R7 前置,**下次发 GitHub Release 前必须处理**
- [x] 2026-07-16 **修复 mint 靶向 bug**:outbox 巡检曾直拿 `MintTier1.def`(宠物 def 101-106)打 `TriggerItemDrop`——目标必须是 playtimegenerator def,该调用必空手(从未真机跑过故未暴露)。现改为 `fusion_slots::shop_gen_def(1, def)` → tier1 商店 gen 21011-21016(interval:1/cap10/窗口 1440,bundle 单条目=掉出的就是 op.def 宠物);401-406 被动掉落 faucet 保留为独立水龙头(应用级参数)
- [x] 2026-07-16 **铸造/collect 重接线**(融合 2.0 上架语义,详见 00-decisions「铸造/collect 重接线已实装」):fuse→同种自 def/异种并集 gen、物种取实发 def、未注册 AI 槽 forced_codename 锁槽;商店蛋 2 阶+ Steam-first NeedDrop;拆栈守卫;乱序槽注册;apply_fusion_local 按亲代阶。旧 3XX/5XX 流保留兼容。cargo 99 绿

## 笔记

- 2026-07-12 检测到并行会话在本会话改 game_config.rs 后同步修复了 game.rs/fusion_gen.rs 的 SpeciesInfo 字面量(steam_item_def: 0)——协作正常,未冲突。
