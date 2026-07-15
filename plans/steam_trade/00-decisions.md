# 00 · 已拍板决定与安全不变量

> 跨会话防漂移锚点。改动本文件 = 改设计,须附日期与理由。完整计划背景见 `C:\Users\admin\.claude\plans\steam-steam-majestic-pond.md`(批准版快照)。

## 用户拍板(2026-07-11)

1. **架构 = Steam 权威**:物品发放/消耗/随机全在 Valve 服务器侧强制;**零自建服务器、零 Web API key**。
2. **交易范围**:宠物 itemdef `tradable:true, marketable:true`;二阶蛋为**绑定物品**(两者皆 false);一阶蛋**不上 Steam**(纯本地)。
3. **随机就绪接口**:融合/孵化结果**将来会有随机性** → 一切发放走 generator 类接口,禁止固定直发接口。今天 bundle 单条目=确定性行为;将来只改 itemdef 权重,零客户端改动。
4. **先测试、不发布**:WS5 冻结;用户明确 go-ahead 前不执行任何商店发布动作。
5. 账号:合作伙伴 Shanghai Mobi Information Technology Co., Ltd(PartnerID 342361,账号 mobistudio)。
   - **App ID = 4956830**(名称 Gulugulu,类型=游戏,2026-07-11 创建,未勾免费——定价发布前可改)
   - 程序包:Developer Comp **1720179** / Beta Testing **1720180** / 商店包 **1720181**;store item 1247252
   - 发行商 auto-grant 已加(开发者账号自动拥有许可);"付费后 30 天方可发布"约束自 2026-07-11 起算(不影响测试)
   - 账号下另有旧应用「奇蛋生物」3950480,与本项目无关,不要动它。

## 集成总开关(用户 2026-07-12 指示:本地调试期先关闭)

> "我们暂时先把 Steam 的生成功能关掉,让我在本地可以操作。等我本地的调试做完之后,我们再重新开始调试 Steam 资产功能。"

- 开关:`steam.rs` 的 `STEAM_DEFAULT_ENABLED = false`(编译期默认)+ 运行时 env `GULUGULU_STEAM`(1/true/on 开,0/false/off 关)覆盖。
- 关闭时:不初始化 SteamAPI(状态=disabled);收取/融合/放生全部走原始本地逻辑,不入 MintTier1 队列、不做兑换/消耗;交易所面板显示"🔧 Steam 集成已关闭(本地调试模式)"。
- **重新开启方法**(二选一):把 `STEAM_DEFAULT_ENABLED` 改回 `true`,或设环境变量 `GULUGULU_STEAM=1` 后启动。开启后存量未上链一阶宠物由 migration_sweep 自动补入发放队列(限频兜底,供给不膨胀);关闭期间本地融合掉的宠物若曾绑定物品,物品会在对账时按目录物种导回——收敛但可能产生"多出来的本地宠物",测试期可接受。

## 授权边界(用户 2026-07-11 原话核准)

> "授权你发布,只要不正式上线,玩家看不到,你随便操作。"

即:**未发售状态下**合作伙伴网站的配置发布、itemdefs 上传等操作已获标准授权,无需逐次确认;**红线不变**——任何让游戏公开可见的动作(商店可见性、"即将推出"、提审、发行)仍属 WS5 冻结区,须用户明确 go-ahead;支付/协议/密钥类仍必须用户本人。

## 安全不变量(不可回改)

> 可交易物品供给只由 Steam 服务器侧水龙头控制:一阶 = `TriggerItemDrop` 游玩时长限频(drop_interval);二阶 = `ExchangeItems` 真实消耗 2 只一阶物品。本地存档一切内容(等级/金币/队列/绑定)只是诚实玩家的装饰与节奏;**对账职责是向 Steam 现实收敛,不是执法**。

推论(同样不可回改):
- **永不定义二阶 playtimegenerator**(发布即成永久可刷水龙头)。
- 客户端等级门槛(满级才能融合)对改客户端者是建议性的——接受,不做无效缓解;经济失衡时热调 itemdef(权重/drop_interval),优先于发版。
- 一切生成器 `hidden:true`、**不设 drop_limit**(终身上限会永久卡死待发队列)。

## itemdefid 编号(一经上传使用,永不回改)

| 段 | 内容 | 类型/旗标 |
|---|---|---|
| 101-106 | 一阶宠物,按 config.json elements 顺序(normal=101, fire=102, electric=103, water=104, grass=105, ice=106) | item,tradable+marketable |
| 201-221 | 二阶宠物,按 fusionTable **键名字典序**排序 | item,tradable+marketable |
| 301-321 | 二阶蛋 = 对应宠物 id + 100 | item,绑定,`exchange:"<材料A>,<材料B>"`(同元素 `"NNNx2"`) |
| 401-406 | 一阶掉落生成器 = 宠物 id + 300 | playtimegenerator,`bundle:"10X"`,hidden,`drop_interval≈45` 起步 |
| 501-521 | 二阶孵化生成器 = 蛋 id + 200 | generator,`exchange:"<对应蛋>"`,`bundle:"2XX"`(单条目 100%),hidden |

映射固化在 `src/game/config.json` + `config.test.json` 的 `steamItemDef` 字段(WS3 落地),由测试断言;合作伙伴网站 JSON 一律脚本生成,禁止手改。

**加法扩号(融合2.0,2026-07-15 WS6 落地;永不重编旧 101-521;与 FusionSystem.md §9 一致)**

| 段 | 内容 | 类型/旗标 |
|---|---|---|
| 601-657 | 57 个新多元素固定宠 = `601 + recipeOrdinal`(多元素配方按 元素数升序,键字典序 的冻结序号;2元素 601-615 / 3元素 616-635 / 4元素 636-650 / 5元素 651-656 / 6元素 657) | item,tradable+marketable |
| 10000 + 序号*100 + slot | 570 个 AI 变种占位(57 配方 × 10 槽;`slot∈1..10`;`10001..15610`) | item,tradable+marketable,占位图标 `_aislot_e<元素数>.png` |

- 序号/身份真源 = `fusion_slots.rs`↔`fusionSlots.ts` 的 `recipeOrdinal`/`fixedItemDef`/`aiItemDef`/`slotCodename`(逐位对拍,`verify_fusion_slots.mjs`);目录由 `generate_itemdefs.mjs` 产 **702 条**,`verify_itemdefs.mjs` 断言。
- **本期只产宠物条目**:新固定宠/AI 槽的**蛋+生成器龙头链推迟**——3+ 元素配方是「任意两只并集=该集合」多对多,Steam 固定 `exchange` 串表达不了(§9 P5 待决 2 未解),且集成默认关。铸造机制留给独立的「并集 exchange 重设计」。
- **AI 变种 codename = `aif`+2位序号+2位槽(如 `aif0503`)**:同时是 Steam `name_english` 与创意工坊 `petId` 标签,全局确定性、替换旧的随机 `aif{6hex}`(逐存档)。**这修订了 Feature 2 里「petId = 目录物种 ID」的旧措辞**——bounded 槽位模型下 petId = 该 AI 槽的确定性 codename;上传内容是紧凑 `CustomSpeciesEntry` JSON(`species.gulupet.json`,几 KB,SVG 参数化、非 `.gulupet.zip` 帧图)。代码见 `steam_workshop.rs`(默认关,真机联调归 WS4/阶段4)。

## 关键接口约定

- **二阶收获的本地宠物物种一律取 Steam 实际发放的 def**(GetResultItems 返回),本地 `egg.species` 降级为展示预测。将来一阶随机化时,收蛋从"本地先行"翻转为"Steam 先行"(与二阶收获共用代码路径)。
- `steam_item_id` 在 Rust/TS/JSON 中**一律字符串**(u64 超 JS 2^53 精度)。
- 超时语义 `Uncertain ≠ Failed`:超时**不清写前意图**,交给下轮意图探测。
- 对账按物种**计数**收敛(同物种物品不可区分),减员移除等级最低者并墓碑保等级;**认领优先于导入**(先把未绑定一阶物品认领给最旧 MintTier1,再准发新掉落)。
- 无 Steam 时阻断:融合、二阶收获、绑定宠放生;其余全部可用,一阶收获入队等待。
- `debug_*` 命令 `#[cfg(debug_assertions)]`,release 无作弊面。
- 不调 `SteamAPI_RestartAppIfNecessary`(GitHub 分发版要能独立运行,init 失败→优雅降级)。

## 用户拍板(2026-07-14):稀有度与 AI 物种形象

### Feature 1 · 孵化率挂钩全局存量 —— 手调权重实现(承接安全不变量「热调 itemdef」)

- **决定**:某物种「越多人拥有越难孵出」由**开发者定期手工重调该物种 generator 权重**实现,**不做**自动/实时耦合。用户明确:实时性要求低,粗粒度+滞后可接受。
- **理由**:Steam 无法让 generator 掉率读取全局 stat;把「存量→概率」放客户端算会破坏「发放由 Valve 水龙头强制」的安全不变量。手调保持发放服务器权威、防刷。
- **落地方式(不变量内)**:发放仍走 501-521 二阶孵化 generator / 401-406 一阶掉落 generator 的 bundle 权重;调稀有度 = 改对应 itemdef 的 bundle 权重后合作伙伴网站重传,**零客户端改动**(承接决定 3「随机就绪接口」)。
- **全局存量观测(可选、非必须、不阻塞)**:如需数据支撑调参,可在 stats schema 加**只增**聚合 stat `minted_<species>` / `removed_<species>`(放生/消耗计,**交易不计**),客户端 `RequestGlobalStats`+`GetGlobalStat` 读 全局 owned≈minted−removed。聚合为**小时级**、可被改客户端污染(仅 `max change` 限速)→ **只作人工调参参考,永不进入任何发放判定**。此项做不做待用户后续定。

### Feature 2 · AI 物种形象/名字由首个生成者上传 —— 创意工坊实现(解决待决 1)

- **决定**:预定义 N 种 AI 物种(petId = 目录物种 ID);**首个生成某 petId 的玩家把 avatar-gen 产出的 `.gulupet.zip` 发布为 Steam 创意工坊 UGC**,全员共享。**采用创意工坊/ISteamUGC,不采用动态属性**(动态属性上限 1024B 放不下图、交易即清空、且每实例非每 ID)。
- **上传**:`CreateItem`→`StartItemUpdate`→`SetItemContent`(帧 zip)+`SetItemTitle`(名字)+`AddItemKeyValueTag("petId","<id>")`→`SubmitItemUpdate`。运行时客户端调用,Valve 托管+CDN,**零自建服务器**。
- **读取/认领**:`CreateQueryAllUGCRequest`+`AddRequiredKeyValueTag("petId","<id>")`,**取创建时间最早者为权威**(并列用最小 publishedfileid 兜底)→`DownloadItem`。「首个胜」是**收敛式**(各客户端跑同一确定规则),非原子锁;首发有并发窗口 → 产生重复上传件、最终收敛,可接受。
- **形象按 petId(物种)绑定、非按物品实例** → 交易过去的宠物,收件方查同一 petId 得同一形象,**AI 外观随物种 ID 全局一致、跨交易保留**。此点**改写待决 1 旧默认**(「AI 外观本地增值、不随交易转移」作废),并化解待决 4 的「外观丢失」面(等级面仍未解,见待决 4)。可交易资产仍是目录 itemdef,工坊形象是其全局装饰层。
- **代价/前置(实现期确认)**:① **内容审核**——UGC 会成为全员看到的该物种形象,需开发者侧屏蔽清单(可托管在已用的公开 GitHub 仓或自控工坊条目)+ Valve 举报审核;② 需为 App **开启创意工坊**(面向社区的公开可见性大概率归 WS5 冻结区,与 marketable 同类);③ 首发竞态重复件(见上)。

## 待决事项(2026-07-12,等用户拍板;实现已按默认方案落地、随时可改)

1. ~~**AI 自定义物种的资产语义**~~ → **已决(2026-07-14)**:采用创意工坊 UGC(按 petId 全局共享、跨交易保留),见「用户拍板(2026-07-14)· Feature 2」。旧默认(按目录物种记账、外观本地增值不随交易)与动态属性备选**均作废**。
2. **图标上链**:icon_url 需公网直链——把 assets/steam-icons/ 推送到 GitHub(公开仓库)后 `--with-icons` 重传,或改用其他静态托管。推送公开仓库需用户执行/授权。
3. **一阶蛋价与 Steam 供给的关系**:蛋用本地金币购买、宠物由 Steam 限频发放,两套节奏并存;正式上线前是否要让"买蛋即保证可发放"(如购买前检查掉落可用性)待定。
4. **交易导入的等级重置**:交易得来的宠物按 1 级新实例导入(无服务器写不了跨端属性)。**外观/名字**面已由 Feature 2 工坊方案解决(按 petId 全局共享);**等级**面无解——动态属性**交易时会被清空**(已查证),扛不住跨交易带实例属性,故 serverless 下等级重置**接受为设计约束**,不再挂动态属性备选。
5. **正式发布前必办**(已列 05-release):掉落参数收紧 45/2/120;`bundle.resources` 带 dll(否则 GitHub 安装包启动缺 dll);debug 面确认剔除;WS4-D3 墓碑假设实证。

## 已查证的 Steamworks 事实(2026-07)

- 客户端可安全调用:`TriggerItemDrop` / `ExchangeItems`(配方支持两个不同指定物品 `"102,106"`)/ `ConsumeItem`;`GenerateItems` 仅开发期有效。
- itemdef 仅可经合作伙伴网站上传(https://partner.steamgames.com/apps/inventoryservice/),无上传 API。
- Rust `steamworks` crate v0.13.1 高层**无 Inventory 模块**;`steamworks-sys` 含全部 `SteamAPI_ISteamInventory_*` → 自写薄封装;运行时 `steam_api64.dll` 须在 exe 旁。
- marketable 实际生效以正式发售为前提(归 WS5);tradable 为 Steam 交易报价体系,用户账号资格(手机 Guard ≥15 天等)是玩家侧限制。
- 待冒烟确认(WS3/WS4 早期):ExchangeItems 目标为 generator 类型的随机开池行为(标准用法,但 480 测不了自定义 def,须在真 App ID 上首验)。
- **聚合全局 stat**(Feature 1 观测用):后台把 stat 标 "aggregated" → Steam 侧保存全体玩家该 stat 的总和;客户端 `RequestGlobalStats()`+`GetGlobalStat()`(int64/double)可读,**无需服务器/无需 Web API key**;历史查询上限 **60 天**;`max change` 限制每次上传对全局值的位移(限速防刷)。刷新周期官方未明示,社区理解为**小时级**、非实时。
- **动态属性**(Feature 2 已排除的备选):四类型(string/int/bool/float),**每件物品 ≤1024 字节 JSON**;客户端可写需在库存服务页**白名单**(官方明示「不可信客户端可伪造」);**交易时被清空**;社区/市场 UI 不展示。→ 放不下图、每实例非每 ID、且交易即丢,故 Feature 2 与「交易带等级」均不用它。
- **创意工坊/ISteamUGC**(Feature 2 采用):`CreateItem`/`StartItemUpdate`/`SetItemContent`/`SetItemTitle`/`SetItemTags`/`AddItemKeyValueTag`/`SubmitItemUpdate` 运行时客户端建内容;`CreateQueryAllUGCRequest`+`AddRequiredKeyValueTag` 按标签查询、按创建时间排序,`DownloadItem` 拉取;Valve 托管+CDN,**零自建服务器**。面向社区的公开可见性/工坊开启大概率需发售或 Valve 审核(归 WS5)。
