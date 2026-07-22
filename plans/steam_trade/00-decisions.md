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

## 集成总开关(2026-07-16 用户指示重新打开;2026-07-12 曾因本地调试关闭)

> 2026-07-12:"我们暂时先把 Steam 的生成功能关掉,让我在本地可以操作。等我本地的调试做完之后,我们再重新开始调试 Steam 资产功能。"
> 2026-07-16:用户指示"把开关打开,并且上传一下我们现在 AI 生成的宠物" → `STEAM_DEFAULT_ENABLED` 已改回 **true**。

- 开关:`steam.rs` 的 `STEAM_DEFAULT_ENABLED = true`(编译期默认,2026-07-16 起)+ 运行时 env `GULUGULU_STEAM`(1/true/on 开,0/false/off 关)覆盖——临时关闭用 `GULUGULU_STEAM=0`。
- 关闭时:不初始化 SteamAPI(状态=disabled);收取/融合/放生全部走原始本地逻辑,不入 MintTier1 队列、不做兑换/消耗;交易所面板显示"🔧 Steam 集成已关闭(本地调试模式)"。
- 开启后存量收敛:未同步 Steam 一阶宠物由 migration_sweep 自动补入发放队列(限频兜底,供给不膨胀);**存量 AI 变种形象由 `fusion_gen::spawn_workshop_backfill` 补传创意工坊**(2026-07-16 实装,见 Feature 2 落地状态);关闭期间本地融合掉的宠物若曾绑定物品,物品会在对账时按目录物种导回——收敛但可能产生"多出来的本地宠物",测试期可接受。

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

**加法扩号(融合2.0;⚠️ 2026-07-16 已全部上传使用 → 编号一经上传永不回改,以下各段今起冻结)**

| 段 | 内容 | 类型/旗标 |
|---|---|---|
| 601-657 | 57 个新多元素固定宠 = `601 + recipeOrdinal`(多元素配方按 元素数升序,键字典序 的冻结序号;2元素 601-615 / 3元素 616-635 / 4元素 636-650 / 5元素 651-656 / 6元素 657) | item,tradable+marketable,`tags:"set:<键>;sp:<codename>"`,`exchange:"sp:<codename>*2"` |
| 10000 + 序号*100 + slot | 570 个 AI 变种占位(57 配方 × 10 槽;`slot∈1..10`;`10001..15610`) | item,tradable+marketable,`tags:"set:<配方>;sp:<slotCodename>"`,`exchange:"sp:*2"`,占位图标 `_aislot_<配方键,+换->.png` |
| **20000-20056** | **57 条并集融合生成器** = `20000 + recipeOrdinal`(2026-07-16 上架) | generator,hidden,`exchange`=该集合全部并集对(6元素 364 条/20.4KB 已验收),`bundle`=0号固定+10 AI 槽加权(P0=1−A(e)、槽内几何衰减、GCD 归一) |
| **21011-21046** | **24 条商店蛋生成器** = `21000 + 阶*10 + (一阶宠def−100)`(阶 1..4 × 6 元素,2026-07-16 上架) | playtimegenerator,hidden,`drop_interval:1` + `drop_max_per_window:eggDailyMintCaps[阶−1]`(10/8/6/3;窗口=应用级 1440),`bundle`=「含该元素∧元素数≤阶」canonical 按 3^(6−c) 加权 |

- 序号/身份真源 = `fusion_slots.rs`↔`fusionSlots.ts` 的 `recipeOrdinal`/`fixedItemDef`/`aiItemDef`/`unionGenDef`/`slotCodename`(逐位对拍,`verify_fusion_slots.mjs`);目录构建核心 = `scripts/steam/build_itemdefs_core.mjs`(纯函数,Node 与浏览器上传共用同一份 → repo↔live 零漂移),`generate_itemdefs.mjs` 产 **783 条**,`verify_itemdefs.mjs` 断言(总量/标签/自升阶/并集对/窗口参数全逐位)。
- **宠物标签定案(2026-07-16 上架)**:canonical 633(101-106 + 601-657 + AI 570)= `set:<自身集合键>;sp:<自身codename>` + `exchange:"sp:*2"` 同种升阶(消耗 2 → 铸 1,净 −1);**legacy 201-221** = `set:<集合键>;sp:<该键 canonical codename>`(无 exchange)——旧物品可作融合材料、经同种升阶收敛为 canonical 物品。
- ~~新固定宠/AI 槽的蛋+生成器龙头链推迟~~ → **2026-07-16 已落**:铸造走 20000 段并集 generator(融合)+ 21xxx 商店 generator(购蛋);**不设新蛋 def**(旧 §9 提案 701-757/901-957 作废,孵化计时纯本地)。
- **AI 变种 codename = `aif`+2位序号+2位槽(如 `aif0503`)**:同时是 Steam `name_english` 与创意工坊 `petId` 标签,全局确定性、替换旧的随机 `aif{6hex}`(逐存档)。**这修订了 Feature 2 里「petId = 目录物种 ID」的旧措辞**——bounded 槽位模型下 petId = 该 AI 槽的确定性 codename;上传内容是紧凑 `CustomSpeciesEntry` JSON(`species.gulupet.json`,几 KB,SVG 参数化、非 `.gulupet.zip` 帧图)。代码见 `steam_workshop.rs`。
- **创意工坊落地状态(2026-07-16)**:①`publish` 显式 `visibility(Public)` 并返回 `(publishedFileId, 需接受法律协议)`;legal 标志透出 `SteamStatus.workshopLegalPending`,交易所面板提示 + 一键打开 steamcommunity.com/sharedfiles/workshoplegalagreement(接受前物品对他人隐藏——影响「最早发布者胜」的全局共享,须引导玩家接受)。②**存量补传** `fusion_gen::spawn_workshop_backfill`:Steam 连接后扫 `custom_species`,对无记录槽位先 `resolve`(已有全局形象 → 只记账 `""` 不上传不覆盖本地),无人认领则 `publish`;结果记入存档新字段 `workshop_published`(codename → publishedFileId 字符串,serde default 兼容旧档),失败不记账、下次启动重试。首发路径 `publish_generated_slot` 成功也记账。纯函数 `workshop_backfill_candidates` 单测。③**真机首跑与解锁(2026-07-16,SteamID 76561199838336217)**:init/连接/`resolve` 查询全部正常(9 槽均无人认领),但 9× `CreateItem` 一致返回 **`Busy`(k_EResultBusy)**,重启复现 → 根因 = **App 4956830 未在合作伙伴网站开启创意工坊**(Feature 2 代价② 预告过)。**解法(已完成)**:partner 站 App Admin → 创意工坊页设置 ①曝光状态=**非公开**(`unlisted:1,private:1`——无公开网页、任何人可经 ISteamUGC 访问,契合"机器层 UGC"设计且避开 WS5 公开可见冻结区;`ChangeVisibility` POST 即存) ②勾选 **ISteamUGC 文件传输**(`feature_workshop_depot` → depots 生成 `workshopdepot:4956830`,POST `/apps/setworkshopinfo/` 进待发布) → 用户手点发布(发布页 JS/合成点击被拦是 Claude 端权限分类器,DiffApp/PrepareApp 只读调用可自动化;"应用级窗口 1440"同批发行)。**发布后 9/9 全部上传成功**(publishedFileId 3765893901~3765896102,`legalPending=false`=该账号法律协议已接受;个别 item 首批失败、靠"下次启动重扫"设计在两次重启内收敛)。网页端 filedetails 匿名访问显示"已隐藏/无权限"= unlisted 预期行为,API 侧 resolve 正命中冒烟见 `steam_smoke::workshop_resolve_roundtrip`(04-testing)。

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
2. **图标托管**:icon_url 需公网直链——把 assets/steam-icons/ 推送到 GitHub(公开仓库)后 `--with-icons` 重传,或改用其他静态托管。推送公开仓库需用户执行/授权。
3. **一阶蛋价与 Steam 供给的关系**:蛋用本地金币购买、宠物由 Steam 限频发放,两套节奏并存;正式上线前是否要让"买蛋即保证可发放"(如购买前检查掉落可用性)待定。
4. **交易导入的等级重置**:交易得来的宠物按 1 级新实例导入(无服务器写不了跨端属性)。**外观/名字**面已由 Feature 2 工坊方案解决(按 petId 全局共享);**等级**面无解——动态属性**交易时会被清空**(已查证),扛不住跨交易带实例属性,故 serverless 下等级重置**接受为设计约束**,不再挂动态属性备选。
5. **正式发布前必办**(已列 05-release):掉落参数收紧 45/2/120;`bundle.resources` 带 dll(否则 GitHub 安装包启动缺 dll);debug 面确认剔除;WS4-D3 墓碑假设实证。

## 已查证的 Steamworks 事实(2026-07)

- 客户端可安全调用:`TriggerItemDrop` / `ExchangeItems`(配方支持两个不同指定物品 `"102,106"`)/ `ConsumeItem`;`GenerateItems` 仅开发期有效。
- **playtimegenerator 限量四字段**(2026-07-16 实证,[schema 文档](https://partner.steamgames.com/doc/features/inventory/schema)):`drop_interval`=首次掉落前需累计的**游戏时长**(分钟,阈值非每滴间隔);`drop_window`=冷却/重置窗口(分钟);`drop_max_per_window`=一个窗口内允许掉几个,默认 1、**Steam 封顶 10**;`drop_limit`=每用户**终身**上限(不重置,置 0=永久停掉)。→ **「按天封顶、可 burst、次日重置、不摊开」= `drop_interval:0` + `drop_window:1440` + `drop_max_per_window:N(≤10)`**(官方例子 `drop_window:1440`=每天一次)。`TriggerItemDrop` 客户端约 1 次/分钟节流。**每日上限方案(§7.5)据此定,全 ≤10。**
- **✅ 真机冒烟实证(2026-07-15,App 4956830 上传 6 条冒烟 90001-90006)**:① **6 元素并集 exchange 串 = 20854 bytes / 364 条,Steam `success:1` 接受**(回执完整回显 exchange)→ **P5-待决② 的「30KB 串长上限」不再是阻塞,5-6 元素并集 generator 方案成立、不用回退**。② **itemdef 上传是合并/追加(merge/upsert),不是整表替换**:上传 6 条后 75→81,旧目录全保留 → 增量上传安全,不会误清现有 def。③ 上传技术:页面内 `fetch`+`FormData` POST `/apps/inventoryserviceitemdefsupload/4956830/`(字段 `itemdefs` blob + `sessionid`),`window.g_sessionID` 可取。**待运行时验(WS4,需 Steam 客户端 + app)**:`drop_max_per_window` 窗口 burst 行为、`set:` 标签 ExchangeItems 匹配。⚠️ 冒烟 defs(90001-90007)留在 live 目录作 WS4 运行时测试夹具,验完清理(merge 语义不会被后续上传自动移除)。
- **✅ per-def 掉落字段实测(2026-07-16,对照实验 90002/90007)**:`drop_window` **非 per-def 字段**——写在 itemdef 里上传即被剥(非零值同样被剥)→ 窗口只能在合作伙伴网站**应用级**设置(`inventory/inventory_playtime_frequency`=游玩分钟/`_max_items_per_window`=窗口内数量/`_minimum`=冷却窗口分钟,三者共用 `ajaxsetappfield`,逐个保存);`drop_interval` **0 会被当默认剥掉、非零留存**;`drop_max_per_window` **per-def 留存**(存储态验证)。→ 每日上限方案落地形态 = 应用级窗口 1440 + per-def `drop_interval:1`+`drop_max_per_window:N`。
- **✅ 融合 2.0 全量目录已上架(2026-07-16)**:783 条(见「itemdefid 编号」表,新增 20000/21xxx 段)经浏览器内共享构建核心(`build_itemdefs_core.mjs` + seed,与 repo 同源零漂移)上传,"Modified 756/783"(27 条=旧孵化/掉落生成器逐字未变被跳过)+ 商店 gen 补传 24/24;live 现 789 条(783+6 冒烟)。存储态抽验:601 名称/标签/自升阶/图标 ✓、20056 exchange 20854B/364 条+加权 bundle ✓、21011 窗口参数 ✓、legacy 219 映射标签 ✓、AI 10001 ✓。应用级窗口已存 1440(**待发布页「准备发布→STEAMWORKS→完成发行」生效**——合成点击对该页无效,须用户手点)。
- itemdef 仅可经合作伙伴网站上传(https://partner.steamgames.com/apps/inventoryservice/),无上传 API。
- Rust `steamworks` crate v0.13.1 高层**无 Inventory 模块**;`steamworks-sys` 含全部 `SteamAPI_ISteamInventory_*` → 自写薄封装;运行时 `steam_api64.dll` 须在 exe 旁。
- marketable 实际生效以正式发售为前提(归 WS5);tradable 为 Steam 交易报价体系,用户账号资格(手机 Guard ≥15 天等)是玩家侧限制。
- 待冒烟确认(WS3/WS4 早期):ExchangeItems 目标为 generator 类型的随机开池行为(标准用法,但 480 测不了自定义 def,须在真 App ID 上首验)。
- **聚合全局 stat**(Feature 1 观测用):后台把 stat 标 "aggregated" → Steam 侧保存全体玩家该 stat 的总和;客户端 `RequestGlobalStats()`+`GetGlobalStat()`(int64/double)可读,**无需服务器/无需 Web API key**;历史查询上限 **60 天**;`max change` 限制每次上传对全局值的位移(限速防刷)。刷新周期官方未明示,社区理解为**小时级**、非实时。
- **动态属性**(Feature 2 已排除的备选):四类型(string/int/bool/float),**每件物品 ≤1024 字节 JSON**;客户端可写需在库存服务页**白名单**(官方明示「不可信客户端可伪造」);**交易时被清空**;社区/市场 UI 不展示。→ 放不下图、每实例非每 ID、且交易即丢,故 Feature 2 与「交易带等级」均不用它。
- **创意工坊/ISteamUGC**(Feature 2 采用):`CreateItem`/`StartItemUpdate`/`SetItemContent`/`SetItemTitle`/`SetItemTags`/`AddItemKeyValueTag`/`SubmitItemUpdate` 运行时客户端建内容;`CreateQueryAllUGCRequest`+`AddRequiredKeyValueTag` 按标签查询、按创建时间排序,`DownloadItem` 拉取;Valve 托管+CDN,**零自建服务器**。面向社区的公开可见性/工坊开启大概率需发售或 Valve 审核(归 WS5)。
- **exchange/bundle 语法**(2026-07-15 实证,[schema 文档](https://partner.steamgames.com/doc/features/inventory/schema)):`exchange: recipe { ";" recipe }`、`recipe: material { "," material }`、`material: itemdefid["x"数量] | tag_name":"tag_value["*"数量]`;`;` = 多条备选(服务器用第一条命中的),`,` = 一条内 AND(各消耗不同物品),`tag:val*N` = 消耗 N 件带该标签物品。`bundle` 同构,generator 里数量=权重。**无跨 material 联合约束、无否定、无"消耗剩余全部"**。串长/条数上限官方**未公布**。
- **每实例标签**(2026-07-15 实证,[itemtags 文档](https://partner.steamgames.com/doc/features/inventory/itemtags)):从 generator/playtimegenerator/bundle 铸造时赋予的标签**伴随物品终身、跨所有权转移保留**,且可被 exchange 匹配(`tag_generators` 可随机赋值)。→ 本可用"阶数当每实例标签"避免每阶开 def,但见「用户拍板(2026-07-15)」代价②:该路径逼出 3000+ def 且与待决 4 冗余,**放弃**。

## 用户拍板(2026-07-15):融合上架方案 —— 集合整体标签 + 并集枚举 + 全局加权池

> P5-待决② 解、待决① 定。承接安全不变量与决定 3「随机就绪接口」、Feature 1「热调 generator 权重」。本决定**修订** [FusionRecipeSlots.md](../../docs/gdd/FusionRecipeSlots.md) 的 per-user 阶梯为 Steam 权威下的全局加权池(见代价①)。**研究+决策,P5 前不实现。**

### 核心编码:每只宠一个"整体集合标签"

- 每个宠物 itemdef 带**恰好一个** `set:<元素集合键>` 静态标签(如 `set:fire+water`,键 = `element_set_key` 字典序 `+` 连接),**不拆逐元素**——逐元素会让 `set:fire,set:water` 误命中水火宠,破坏精确匹配。**整体标签 = 精确集合匹配**,是全案基石。
- 另带 `sp:<codename>` 标签(该物种唯一)用于同物种确定性升阶。
- tag 值含 `+`:exchange 分隔符是 `,;x*:`,`+` 非分隔符应安全;冒烟阶段确认,不行则改短码 `set:s<recipeOrdinal>`。

### 两条融合路径(客户端路由、Steam 校验)

| 路径 | 触发 | Steam 表达 | 产出 |
|---|---|---|---|
| **1 同物种确定升阶** | 双亲 codename 相同 | 宠 def 自带 `exchange:"sp:<codename>*2"` | 100% 同物种(确定性,承接 [FusionRecipeSlots §4.3](../../docs/gdd/FusionRecipeSlots.md)) |
| **2 并集加权池** | 异物种(codename 不同) | **每多元素配方一个 hidden generator**:`exchange` = 集合 S 的**全部并集对** `{set:A,set:B ∣ A∪B=S}`(含对角 `set:S*2`);`bundle` = 加权 11 槽池 | 服务器掷 0 号固定 / 1–10 号 AI 变种 |

- **精确并集 = 服务器强制稀有度**:玩家持集合 A、B 两只 → **有且仅有** `A∪B` 那个 generator 的配方接受它们(别的 S 配方要求的集合对不含这一对)→ **不能升维也不能降维**。这是本方案胜过纯"供给-only"路线的关键:物种稀有度服务器权威。
- **同物种误投池无害**:改客户端把同 codename 对投路径 2,只是把"确定升阶"换成"一次随机重 roll"(仍 −1 供给、仍烧真宠、池加权),非漏洞;§4.3 确定性由**诚实客户端路由**保证,不需服务器区分。
- **加权 = 稀有度曲线**:`bundle` 权重整数化 [FusionRecipeSlots §3.2](../../docs/gdd/FusionRecipeSlots.md) 分布——0 号 `1−A(e)`、AI 槽几何衰减、A(e) 按元素数 60/40/20/10/5% 缩放。**调稀有度 = 改 bundle 权重重传,零客户端改动**(承接 Feature 1 + 决定 3)。

### 阶数不登记到 Steam(待决① 定案)

- **阶数/等级永不上 Steam**,纯本地存档(承接待决 4「交易即重置、接受为约束」)。故 itemdef **不按阶数翻倍**。
- 曾考虑 `tier:T*2`(每实例阶数标签让服务器强制同阶):**放弃**——每实例标签要每阶一个 tag_generator + 每(物种,阶)一个出口 def,逼出 63×6 + AI 570×5 ≈ **3000+ def**,且既然阶数本已本地化(待决 4),服务器知道阶数是**冗余**。推论:Steam 只认物种(集合),**不校验同阶**;混阶融合是客户端建议性(同「客户端门槛对改客户端者建议性」不变量)。

### itemdef 数量与静态属性(提案;未上传前可改)

| 类别 | 数量 | 关键静态属性 |
|---|---|---|
| 可交易宠物(固定 63 + AI 570) | 633 | `tags:"set:<键>;sp:<codename>"`;`exchange:"sp:<codename>*2"`(一阶宠除外,它由掉落 generator 产);`type:"item"`;`tradable/marketable:true`;`icon_url`;**无 tier** |
| 并集加权 generator | 57(每多元素配方一个) | `type:"generator"`;`hidden:true`;`exchange`=并集对枚举;`bundle`=加权 11 槽 |
| 一阶掉落 generator | 6(现有 401-406) | 不变 |
| **新增合计** | **+57**(约 702→759) | |

- **提案编号**:并集 generator = `20000 + recipeOrdinal`(20000–20056,recipeOrdinal 同 `fusion_slots.rs`)。**未上传故未冻结**(承接「itemdefid 一经上传使用永不回改」——上传前可调)。FusionSystem §9 旧提案 701-757 蛋 / 901-957 孵化龙头链**作废**(本方案无每物种蛋,融合直接经 generator 产宠;孵化计时纯本地展示)。
- **同物种升阶不新增 itemdef**(挂在 633 宠 def 的 `exchange` 字段)。

### 代价与待办(须知情)

1. **① per-user 阶梯 → 全局加权池(用户已接受降级)**:静态 generator 读不到每用户收集状态,故 [FusionRecipeSlots](../../docs/gdd/FusionRecipeSlots.md) 的「0 号钥匙 / 2 号需先集齐 0 号 / 逐槽解锁前沿 m」在 **Steam 权威下失效**,11 槽从第一天全开为加权池。**保留**稀有度曲线(A(e)+几何衰减);**丢失** per-user 解锁门控。💡 全局池反与创意工坊 Feature 2(petId 全局共享)更契合(社区首个掷中者生成→全员复用)。
   - **与本地阶梯的关系(P5 实现期定,推荐 a)**:阶梯已在代码落地(`fusion_slots.rs` + 32 测试,Steam 默认关时驱动本地融合)。两候选——**(a)** Steam-on 时全局池权威、本地阶梯降为展示预测并对账收敛(承接接口约定「物种取 Steam 实发 def」),Steam-off 保留阶梯:改动最小,但两模型手感有别;**(b)** 本地也改为全局加权池(退 frontier 门控、留权重曲线)求体验一致:需改已落地的 PR-1。**推荐 (a)**(Steam 权威、本地装饰,divergence 由对账吸收)。
2. **② 高元素配方串体量 ✅ 已验证(2026-07-15)**:并集对数 = `(3^k−1)/2` → 2/3/4/5/6 元素 = 4/13/40/121/**364** 条;6 元素单 `exchange` 实测 **20854 bytes(20.4KB)**,真 App 4956830 上传 **Steam `success:1` 接受**(见「已查证事实」)→ **非阻塞,5-6 元素并集 generator 照做、不回退**。
3. **③ 稀有度获益**:相较此前"供给-only"设想,本方案**把物种稀有度也纳入服务器强制**(须真拥有并集到 S 的两只宠),为净增强。

## 铸造/collect 重接线已实装(2026-07-16,「用户拍板(2026-07-15)」的代码落地)

> 原语经 WS4 冒烟 A5-A7 真机验证后实装。门禁:cargo 99 绿 / tsc 0 / npm build ✓ / 三 verify ✓。

- **融合 Steam 路径(`fusion_gen::fuse_pets_ai`)**:目标 def = 同物种 → 自身 def 的 `sp:*2` 自升阶(AI 变种 → 其槽位 def;**legacy 物种 → 该集合 canonical def,物品经 sp:<canonical> 标签被接受,融合即收敛**);异物种多元素 → 并集生成器 `20000+ord`(服务器掷);异物种同单元素 → canonical def。**物种一律取实发 def**(`species_codename_for_def`:目录 → AI 段反解);掷中未注册 AI 槽 → `PendingFusionInfo.forced_codename` 锁槽挂起生成(工坊复用/CLI 生成落到 Steam 指定的槽)。**结果宠物物品直接绑在蛋上,收取纯本地绑定(离线可收)**——不再有 Steam 蛋物品/孵化生成器两段式。
- **商店蛋 collect(2 阶+)Steam-first**:`CollectPlan::NeedDrop` → `TriggerItemDrop(shop_gen_def(tier, 一阶def(shopElement)))` → 拆栈守卫 → 物种取实发 def 落宠绑定。窗口满/时长不足 → 蛋保留报错重试。**无写前意图**(drop 不消耗任何东西;崩溃窗口的孤儿物品走对账导入,窗口封顶防膨胀)。一阶蛋维持本地先行 + MintTier1 队列(经 tier1 商店 gen 21011-21016)。`EggInstance.shop_element` 新字段(购买时记录,serde default 兼容旧档)。
- **拆栈守卫(`steam::ensure_distinct_item`)**:发放 quantity>1(落在堆叠上,A5 实证)→ `TransferItemQuantity` 拆 1 个新实例再绑定;独立实例原样绑定。融合兑换与商店掉落两路共用。
- **乱序槽注册(`game::register_ai_slot`)**:新式 codename 落到自带槽号,中间空槽 `""` 占位(本地阶梯遍历空串不命中,前沿数学无损);旧随机 codename 按序追加。`recipe_ai_slots` 语义由"连续追加"升级为"位置数组"。
- **`apply_fusion_local` 全阶化**:费用按亲代阶(`fusion_fee_for`)、结果阶 = 亲代阶+1(clamp 2..6)、hatch_kind = `tier{n}`——旧硬编码 tier2/平坦费退役。
- **旧流兼容不破**:3XX 绑定蛋照走 CollectT2 兑换 5XX;重放意图按 def 分流(3XX → fusion_table 物种;20000 段 → {固定+AI×10} 期望集;其余 → 自身 def);旧存档 outbox 意图可直接重放。
- **测试**:`fuse_intent_replays_union_gen_fixed_and_unregistered_ai`(并集重放双分支)、`register_ai_slot_pads_forced_slots_and_appends_legacy`、原 97 测全绿(仅按阶费断言更新)。
- **待真机 E2E(WS4)**:app 全流程(`GULUGULU_STEAM=1` 开 UI 融合/买蛋收取)未跑——原语已验,业务编排待端到端;隔天观察窗口重置与 10/日封顶拒绝。

## 用户拍板(2026-07-15)· 商店蛋全局池 + 商店宠可交易

> 商店分阶蛋([EconomyScaling.md §7](../../docs/gdd/EconomyScaling.md),经济缩放工作流已实装)与 Steam 水龙头模型的对账。**本地池改动本次已实装**(`economy.rs`/`config.ts`,cargo test 92 绿 + verify_economy 绿);**Steam 侧(可交易/铸造)为设计,P5 前不实现**。

### 决定

1. **商店宠改为可交易 Steam 资产**(此前商店 tier-2+ 蛋孵"本地徽章宠"、不同步 Steam——见 `commands.rs` collect 的 `tier != 1 → tier1_def = None` 分支 + `migration_sweep` 只扫 tier-1)。
2. **商店蛋池改为全局固定池**(已实装):①**去 `dexObtained` 解锁门** → 可产**未解锁**固定物种(商店也成发现渠道);②**只出固定配方物种,不含 AI 自定义变种**(AI 只经融合获得);③**保留**元素数 ≤ 蛋阶、含该属性、`3^(6−c)` 稀有度权重。→ 池变成**静态、无 per-user、无 AI**,**天然可表达为 Steam 静态 generator**(这正是它能上架的前提;对比融合的 per-user 阶梯需绕开)。

### Steam 表达(P5 设计,未实现)

- **每(元素 E × 蛋阶 T)一个 hidden generator**:`bundle` = 全部「含 E 且 ≤T」固定物种按 `3^(6−c)` 加权(静态、可热调,承接 Feature 1)。数量 ≈ 6 元素 ×(2..商店封顶阶)= 18~30 条。tier-1 商店蛋沿用现有 401-406 掉落 generator(确定性基础种)。提案编号另辟 **21xxx 段**(与 20000 并集 generator、10000 AI 段不冲突即可,未上传未冻结)。
- **收取路径(Steam-on)**:商店 tier-2+ 蛋 collect 从"本地徽章宠"改为**经该 generator 铸造可交易宠**;物种以 **Steam 实发 def 为准**(本地 `roll_egg_species` 降为展示预测,与融合 CollectT2「物种取实发 def」同构)。`commands.rs` 那条 `tier1_def = None` 分支需加"商店蛋 → Steam 铸造"新臂。

### ⚠️ 水龙头对账(唯一硬点,须你拍板 + 冒烟)

- **金币是客户端量、Steam 看不见** → 若"花金币即铸可交易宠",改客户端刷金币 = 刷可交易宠 = **破「供给只由 Steam 水龙头控制」不变量**(第三条水龙头漏洞)。
- **✅ 已选(用户 2026-07-16):Steam「24 小时窗口封顶」服务器强制,且不摊开**——playtimegenerator 三旋钮 `drop_interval:0`(登录即可掉,不要求游戏时长)+ `drop_window:1440`(24h 窗口)+ `drop_max_per_window:N`(当天最多 N 个,满了进冷却、次日重置)。窗口内可**一口气领完 N 个再下线**(不逐个摊开),且**服务器强制、改客户端也超不过**。~~备选:客户端-only / 消耗低阶宠~~(未选)。
- **硬约束**:`drop_max_per_window` **Steam 封顶 10** → 所有每日上限设计为 **≤10**(故商店 1/2 阶由 50/20 降到 10/8);`TriggerItemDrop` 约 1 次/分节流,领 N 个≈N 分钟(非摊开)。**取向:宁可卡到极限手工玩家**(远低于孵化屋物理吞吐 384/192/96)。
- **客户端每日计数 = Steam 窗口的镜像**:本地先拦(达上限拒绝+提示),避免玩家孵了却被 Steam 窗口拒发。一阶被动掉落 faucet(401-406)另走自身限频,不受此窗口影响。

### 每日上限定案(2026-07-16,全 ≤10;数值与 generator 参数见 [EconomyScaling.md §7.5](../../docs/gdd/EconomyScaling.md))

> ⚠️ 2026-07-16 真机实证修正:`drop_window` **非 per-def 字段**(上传即剥,非零同)→ 窗口只能**应用级**;per-def 生效 = `drop_interval`(非零留存)+ `drop_max_per_window`(留存已验)。据此应用级 `inventory/inventory_playtime_minimum` 已改 **1440**(24h 窗口,对全部 playtimegenerator 生效;测试参数现为 5/10/1440,**待发布页发行生效**);商店 gen per-def = `drop_interval:1` + `drop_max_per_window:cap`。

- **商店蛋(每元素·每阶)= 1/2/3/4 阶 `10/8/6/3`**(config `eggDailyMintCaps`;由旧 50/20/8/3 降,因 >10 超 Steam 上限)。**目录已上架**(21011-21046,存储态验证 `drop_interval:1`+`drop_max_per_window` 留存)。**游戏内已实装**:`logic_buy_egg` + `DailyCounters.egg_mints`(键 `"{element}:{tier}"`,跨天随 `ensure_daily` 重置)达上限拒绝并 toast。
- **融合(每配方,按结果元素数)= 1/2/3/4/5/6 元素 `5/5/2/2/1/1`**。⚠️ 修正:并集 generator 是 **exchange 型,无 drop/窗口字段** → 融合上限**只在客户端强制**(pacing);供给安全性来自**材料真实消耗净 −1** + 上游水龙头窗口封顶(融合是转换器不是水龙头)。**游戏内已实装(2026-07-16)**:config `fusionDailyMintCaps` + `DailyCounters.fusion_mints`(键=结果配方集合键),检查在 `logic_validate_fusion_pair`、计数在 `consume_fusion_pair`/`apply_fusion_local`(全路径覆盖,Rust/TS 镜像+测试;cargo 97 绿)。
- **P5 冒烟(WS4,需 Steam 客户端)**:`drop_max_per_window`+应用级 1440 窗口的封顶/burst/重置行为;`set:` 标签 ExchangeItems 匹配(90006);item 型 def 自带 exchange 的同种升阶(90005);并集 generator 开池(20000 段)。

## 用户拍板(2026-07-18):皮肤系统 —— 工坊「首发者胜」松弛为「首发皮肤」+ 本地优先生成

> 全量设计与数据模型见 [docs/gdd/SkinWorkshop.md](../../docs/gdd/SkinWorkshop.md)。**已实装**(存档 v6;cargo 116 绿 / tsc ✓ / verify_skins·verify_pokedex ✓)。改写「用户拍板(2026-07-14)· Feature 2」的读取语义,上传/查询协议(petId KV 标签、species.gulupet.json、pick_earliest)不变。

1. **本地优先生成**:CLI 可用时一律本地生成自己的形象(工坊已有该槽形象不再跳过生成);工坊复用降级为 CLI 不可用/生成全败的**兜底**(兜底时首发形象连同上传者元数据记为「首发皮肤」)。Feature 2 的「首个胜=全局唯一形象」松弛为「首发=一款皮肤」。
2. **always-publish**:自家生成一律发布(即使他人已首发同槽)——同 petId 多条工坊物品都是合法皮肤,查询侧 `list_for_pet_id` 跨页全量列出(RankedByPublicationDate 新→旧,须翻到尾页才能正确标首发;此修正同时修掉旧 resolve 只查第 1 页的首发误判)。
3. **四源皮肤 + 按物种统一换肤**:默认(=配方 0 号固定物种形态,将来可换成专门生成的默认皮肤)/本地/首发/分享;`skin_selected` 一物种一选择,全场景生效。**先入库**:未获得物种也可导入皮肤(不注册物种、不动图鉴进度)。
4. **分享协议**:分享文本内嵌 `steamcommunity.com/sharedfiles/filedetails/?id=<fileId>`;导入为图鉴粘贴流(无 deep-link),物种归属以物品 petId 标签为准,内容过 validate_custom_visual + 256KB 上限。工坊 unlisted 下网页不可见但 API 可导入。
5. **出处防线(`CustomSpeciesEntry.origin`)**:local/workshop/None(v6 前存量不可知)。补传扫描只对 origin=local 直接上传;存量 None 维持 resolve 查重、命中记 `""`——**绝不把他人设计当自家作品重发布**。分享/补发布(publish_own_skin)同守此线。
6. **上传量影响**:always-publish 会使同 petId 条目数随玩家数增长(此前收敛为 1 条)——查询翻页封顶 4 页×50 条,发布仍是一次性 best-effort + backfill 重试,限流风险不变(单玩家上传频次未增)。

## 用户拍板(2026-07-18):放生本地先行 —— ConsumeItem 转后台限频重试

> 用户原话:「现在我放生一个宠物,Steam 那边同步很慢。可以让我本地先放生,然后再在后台缓慢同步 Steam。」**已实装**(cargo 123 绿)。

1. **语义翻转**:绑定宠物的放生从「写前意图 + 阻塞等 ConsumeItem 成功才落本地」改为「**本地先行**(立即删宠+返还)+ `Release{applied:true}` 排 outbox,由泵线程按 MintTier1 同款退避(1→2→5→10 分钟)单飞重试 ConsumeItem」;放生命令即时返回,附带 `kick_sync()`(fire-and-forget SyncNow)让空闲泵 ~秒级收敛。
2. **复制防线**:applied Release 的物品 id 计入 `steam_sync::bound_item_ids` —— 认领(attach_mints)/对账导入(reconcile)/手动导入(import_inventory_pets)/意图结果搜索一律跳过,物品在消耗前不会被回导成新宠(「删本地→物品回导=金币永动机」的旧口子仍封死;且放生返还率 0.05 本就防套利)。
3. **崩溃回放分叉**(`resolve_intents`):`applied=true` → 物品从快照消失即收 op(消耗已发生/被交易走),仍在则留给 outbox 重试,**绝不二次返还/复活**;`applied=false`(升级前落盘的旧写前意图,serde default)→ 维持旧语义(物品在=弃意图,物品没=补删+返还)。
4. **保留的守卫**:`#needSteamForRelease`(未连接不可放生绑定宠物)、`#lastPetCannotRelease`、op-lock 互斥不变;未同步 Steam 宠物(待发放撤 mint / 本地遗留)路径不变。
5. **状态面**:`SteamStatus.pendingReleases` 新字段,交易市场连接行显示「🕊️放生同步中 ×N(后台自动完成)」;预览 `?steam=on&pendrel=N` 可演示。
6. **接受的残余风险**:极端情况下(Steam 长期拒绝 Consume 且物品被玩家在 Steam 侧交易/上架卖掉)玩家得 5% 放生返还 + 物品另有去处——返还率 0.05 的防套利定价已覆盖该敞口;物品被交易走时 resolve_intents 按「已消失」收 op,状态自洽。

## 用户拍板(2026-07-21):Steam 云存档同步 —— Cloud API + 较新者胜 + 备份 + 清档夺权

设计详见 [../../docs/gdd/SteamCloudSync.md](../../docs/gdd/SteamCloudSync.md);进度见 [07-cloud-save.md](07-cloud-save.md)。

1. **机制 = Cloud API(`ISteamRemoteStorage`)**,非 Auto-Cloud。理由:常驻托盘 App 极少真正退出,只在启动/退出同步的 Auto-Cloud 几乎不触发;且 GitHub 非 Steam 启动覆盖不到;API 路径可运行中持续同步 + 自控冲突。`steamworks 0.13` 已内置高层 `RemoteStorage`,无需 `-sys`。
2. **同步范围 = 三件套**:`gulugulu-save.json`(权威)+ `gulugulu-progress.json`(账本)+ `gulugulu-quotes.json`(语录)。账本整份覆盖安全,因 watcher 首见 session 文件即从 `file_len` 播种、不重算历史。
3. **冲突 = 较新者胜 + 永久备份(不弹窗)**。存档加**加法字段** `cloud_revision`(每次 `with_save` +1,判新旧主键)/`cloud_force_push`,**不 bump `version`**(保持 8,旧二进制忽略未知字段 → 跨版本云同步安全)。墙钟 `last_seen_at` 仅平手兜底。**采纳云端前必备份**本地三件套为 `.pre-cloud-<秒>.json`。云端版本超前本机 → 跳过(仿本地 `TooNew`)。
4. **清档夺权(用户测试主诉求)**:`debug_clear_save` 后新档 `cloud_revision=prev+1` + `cloud_force_push=true` + 连线即 `cloud_push_now`,三路径兜底保证「清完档不再被高修订号的旧云档拉回」。推成功前先清标记 → 云端存档永不携带 `cloud_force_push=true`。
5. **线程红线沿用**(steam.rs:9):推路径读磁盘字节不碰存档锁;拉路径锁内只读元数据 + `*guard=None`(采纳全程持锁 = 对 `with_save` 原子);泵线程内直调 `steam_cloud::*` 不 `call_blocking`;云拉/推均 `!owner_mismatch` 才做(云 per-account,采纳的云档 owner 天然匹配)。
6. **前置(👤 用户,不可逆)**:partner 站 App Admin(4956830)→ Cloud 开 Enable + Byte quota(建议 100 MB)+ Files(建议 20)→ 发布。字节配额为 0 = 服务端禁用云。
