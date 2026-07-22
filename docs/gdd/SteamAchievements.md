# Steam 成就系统设计（Steam Achievements）

> 版本 v1.0 · 2026-07-19 · 设计定稿（待实施）
> 关联：[InteractionEconomy.md](InteractionEconomy.md)（点击赚金币 · Token 喂经验 · 键盘/挂机回精力）· [FusionSystem.md](FusionSystem.md) + [FusionRecipeSlots.md](FusionRecipeSlots.md)（融合 2.0 · 63 物种 · AI 变种槽位）· [PokedexSystem.md](PokedexSystem.md)（图鉴收集口径 `dexObtained`）· [EconomyScaling.md](EconomyScaling.md)（指数经济 · 孵化屋 8 槽 / 后院 50 格 / 商店 Lv4）· [SkinWorkshop.md](SkinWorkshop.md)（工坊皮肤四源）· `plans/steam_trade/`（Steam 接入 · App ID **4956830** · 集成开关 `GULUGULU_STEAM`）。
>
> **状态**：本文是成就系统的**权威设计**。成就走 Steam **User Stats / Achievements** 子系统（与 Inventory Service 库存/交易**完全独立**），不发放任何可交易资产、不铸造 itemdef——因此**不触及** `plans/steam_trade/00-decisions.md` 的「供给只由 Valve 水龙头强制」安全不变量（§6）。
>
> ⚠️ **成就 API Name 一经在合作伙伴后台发布即冻结**（同 itemdefid 编号不可回改）。本文 §8 的 ID 清单在首次发布前可改，发布后只能新增、不能改名/删除。
>
> ⚠️ **2026-07-21 机制修订**：Token 不再回精力，改按 `tokensPerExp`（=40，全阶统一、不乘 tierFactor）直接折算**陪伴宠（主宠）经验**，主宠满级/缺席即整段浪费；精力恢复只剩挂机 + 敲键盘（键盘只喂陪伴宠），漫游零食移除。**成就阈值与文案冻结不变**（`total_tokens_fed` 仍按加权喂养单位累计，F 组 1M/50M/1B 与已上线的 Steam 后台文案照旧）——本文仅同步 §2 主脊叙述与 §3.2/§3.3 的写入点/口径注释（`logic_feed_energy` 已拆为 `logic_feed_keys` / `logic_feed_tokens`）。

---

## 0. 设计原则

1. **成就 = 看得见的里程碑**：每条成就对应游戏里一个既有的高光时刻（首次满级的 ★、首次融合的金蛋、图鉴翻满、6 阶巅峰），不为凑数造无感成就。
2. **正向框架**：只奖励、不惩罚；没有"失败/损失"类成就（放生类成就走温情叙事，见 §8-H）。
3. **覆盖全曲线**：从开局 5 分钟（首次孵化）到 30 天终局（造出第一只 6 阶），每个成长阶段都有可追的目标；新手密、终局稀。
4. **安全无副作用**：成就是纯荣誉（Steam Stats），**不产金币、不发宠物、不动经济**——改客户端最多刷到假成就，无经济风险（§6）。
5. **Steam-gated + 本地可积累**：成就的**判定数据全部存本地存档**，随时可算；只有"解锁上报"这一步依赖 Steam。集成关闭（`GULUGULU_STEAM=0` / 无 Steam 的 GitHub 分发版）时，数据照常累积，上报静默跳过；**首次连上 Steam 时一次性回填**所有已达成成就（§4.3）。
6. **题材招牌优先**："编码伴侣"是本作的独特卖点——Token 喂食与键盘充能各有专属成就线（§8-E），这是别的养成游戏没有的成就。

---

## 1. 一句话与成就骨架

> **每喂一顿代码、每点满一只、每融出一阶、每翻满一页图鉴，都值得一枚勋章。**

游戏主脊是：**AI 的 Token 喂陪伴宠涨经验、键盘/挂机回精力 → 你点击赚金币 → 买蛋 → 孵化 → 融合 → 收集**。成就沿这条脊柱铺一条"里程碑链"，再叠三根招牌支柱（编码伴侣 / 图鉴收集 / 融合纵深）：

```
起步(A) ── 图鉴(B) ── 品阶(C) ── 融合(D) ── AI造物(E)
   │          │          │         │           │
   └── 编码伴侣(F) ── 经济建设(G) ── 工坊(H) ── 彩蛋(I · 隐藏)
```

九组共 **41 枚成就**（清单见 §8）：起步 3 · 图鉴 7 · 品阶 4 · 融合 3 · AI 造物 4 · 编码伴侣 4 · 经济建设 5 · 工坊 5 · 彩蛋 6。密度参照 Steam 独立游戏惯例（30~50 枚），终局成就（图鉴全谱 / 6 阶巅峰 / 代码盛宴 / 融合宗师）作为长期炫耀锚点。

---

## 2. 成就类型与数据来源总览

每条成就的判定来自存档字段。按"现有字段直接可判"与"需新增终身计数器"分两类——这是实现成本的分水岭（详见 §3）。

| 类型 | 判定方式 | 例 |
|---|---|---|
| **状态阈值型** | 读当前存档某值 ≥ 阈值 | 孵化屋 Lv8、商店 Lv4、图鉴 N 种 |
| **终身计数型** | 只增计数器 ≥ 阈值 | 累计融合数、累计喂 Token、累计赚金 |
| **高水位型** | 曾达到过的最大值（放生/融合消耗后不回退） | 曾拥有过 6 阶、曾满级 |
| **一次性事件型** | 布尔旗标 | 首次融合、首次放生、首次点满每日额度 |

- **状态阈值型**：图鉴、设施等级、当前持有数——**已有字段**，最省。
- **终身/高水位/事件型**：`daily.*` 每日清零、`coins` 是可花余额、`pets[].tier` 会随放生消失——**现有存档没有这些终身量**（Explore 实测：全仓无 lifetime/streak/total_ 计数器）。需新增一个 `stats` 子结构（§3）。

---

## 3. 存档新增：`LifetimeStats`（v6 → v7）

### 3.1 为什么必须新增

现存 `GameSave`（v6）能**直接判**的成就（读现有字段，零新增）：

| 成就族 | 依据字段（现有） |
|---|---|
| 图鉴 N 种 / 全谱 63 / 六元素齐 / 收集旗舰 | `dex_obtained`（曾获账本，`≥1` 即收集，放生不减；[PokedexSystem.md](PokedexSystem.md) §2） |
| **AI 造物组**（首次生成 / 收集 5·20 / 单配方阶梯 5） | `recipe_ai_slots`（生成/阶梯槽数）+ `dex_obtained` 非固定键（收集数）+ `custom_species` |
| 孵化屋满 / 后院满 / 商店满 | `hatchery_level`(≤8) / `yard_level`(容量≤50) / `shop_level`(≤4) |
| 首次融合 | `tutorial_first_fusion_done`（`tutorial_first_egg_bought`/`tutorial_step` 亦可用，未设成就） |
| **工坊组**（导入 / 换上 / 发布 1·5 / 收藏 5） | `species_skins`（导入/收藏数）+ `skin_selected` 含 `ws:`（换上）+ `workshop_published` 真 fileId（发布数） |
| 当前同时持有 N 只 | `pets.len()` |

**必须新增字段**才能判的成就（现存无对应终身量）：

| 想要的量 | 为何现在没有 |
|---|---|
| 累计点击 | 仅 `daily.clicks`，每日本地零点清零 |
| 累计**赚取**金币 | `coins` 是可花余额，买东西即减，无累加器 |
| 累计融合次数 | 仅 `daily.fusion_mints`，每日清零 |
| 累计喂食 Token | `last_seen_project_tokens` 是按项目的增量锚点（会自愈重置），非单调总和 |
| 累计键盘充能 | 无（键盘只即时喂精力，不留总量） |
| 累计放生数 | 无（`apply_release` 只删宠 + 返金） |
| 曾达最高阶 / 最高等级 | 只能从**当前**宠物推，放生掉最高阶就丢了记录 |
| 连续登录天数 / 累计游玩天数 | 仅 `last_seen_at` 单时间戳；日翻转直接丢弃旧日，无 streak 记账 |

### 3.2 结构定义

新增一个子结构挂在 `GameSave` 上。**全部 `#[serde(default)]` → 旧档零成本迁移**（缺字段即默认 0/空，无破坏性数据变换）；按惯例把 `version` 推进到 **7**（也可不推进，靠 serde default 兼容——但推版号让迁移显式、便于日后审计）。

```rust
// game/model.rs
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LifetimeStats {
    // —— 终身计数（只增）——
    pub total_clicks: u64,          // 有效点击总数
    pub total_coins_earned: u64,    // 累计赚取金币（只计点击收入，不含退款/返还）
    pub total_fusions: u64,         // 融合成功总次数（含同种升阶与异种并集）
    pub total_releases: u64,        // 放生总数
    pub total_tokens_fed: u64,      // 累计喂食的加权 Token 单位（四分加权口径，来源 logic_feed_tokens，与经验换算同源）
    pub total_keys_charged: u64,    // 累计入账的键盘充能键数
    // —— 高水位（曾达到过的最大值）——
    pub highest_tier: u8,           // 曾拥有过的最高阶
    pub highest_level: u32,         // 曾达到过的最高等级
    // —— 登录节律 ——
    pub days_played: u32,           // 累计游玩天数（去重按本地日期）
    pub login_streak: u32,          // 当前连续登录天数
    #[serde(default)]
    pub last_login_date: String,    // 上次结算日期（YYYY-MM-DD），streak 判定用
    // —— 一次性事件旗标（无自然高水位可依）——
    pub first_release_done: bool,
    pub daily_cap_reached_ever: bool, // 曾点满每日额度（dailyClickCap=1000，进入纯抚摸模式）
    pub night_owl: bool,              // 曾在深夜 0–4 点打工/喂食（本地时区）
}

// GameSave 增字段：
//   #[serde(default)]
//   pub stats: LifetimeStats,
```

TS 镜像 `types.ts`（camelCase，逐字段对等，仓库硬规则）：`LifetimeStats` type + `GameSave.stats`。

### 3.3 写入点（hook 清单）

所有写入都在既有的纯逻辑函数里加一行，**不触碰 Steam、不触碰锁**（沿用"`logic_*` 只吃 `&GameConfig`+`&mut GameSave`"的可测设计）。所有增量都经 `settle`/`with_save` 已持有的可变借用完成，无新并发面。

| 字段 | 写入点（Rust） |
|---|---|
| `total_clicks` `+1`、`total_coins_earned += 金币`、`highest_level = max(..)` | `logic_click_work`（`logic/progression.rs`，唯一金币水龙头、经验水龙头之一） |
| `daily_cap_reached_ever = true` | `logic_click_work` 中 `daily.clicks` 触顶 `dailyClickCap`（=1000，EconomyScaling v1.2）时 |
| `night_owl = true` | `logic_click_work` / `logic_feed_keys` / `logic_feed_tokens` 中，取**本机本地时区**当前小时（`chrono::Local::now().hour()`，**非 UTC**——与 `ensure_daily` 取本地日期同源，跨时区/夏令时随系统），`hour ∈ [0,4)` 时置真 |
| `total_tokens_fed += 加权增量` | `feed_from_project_tokens` / `logic_feed_tokens`（`logic/energy.rs`，加权 Token 口径） |
| `total_keys_charged += 键数` | 键盘充能入账处（`logic/energy.rs` 的 key 分支 / `key_watcher` 结算） |
| `total_fusions += 1` | `consume_fusion_pair` / `apply_fusion_local`（`logic/fusion.rs`，覆盖本地与 Steam 两条路径，与 `record_fusion_mint` 同点） |
| `highest_tier = max(.., pet.tier)` | `apply_collect`（`logic/economy.rs`，孵出即知阶；与 `record_species_obtained` 同点） |
| `total_releases += 1`、`first_release_done = true` | `apply_release`（`logic/facility.rs`） |
| `days_played` / `login_streak` / `last_login_date` | `ensure_daily`（`logic/progression.rs`，日期翻转处——**在旧 `daily.date` 被覆盖前**结算：`today == last_login_date+1天` → streak+1，否则 streak=1；`days_played += 1`；写 `last_login_date=today`） |

> 单测：每个写入点各一条（累加正确、放生不减 dex 但 `total_releases` 增、streak 连续/断裂/同日不重复计、highest 水位不回退）。沿用 `game/tests.rs` 既有风格。

---

## 4. Steam 接线（成就上报）

### 4.1 合作伙伴后台（我驱动填写 · 用户仅发布）

成就必须先在 Steamworks 后台 **App 4956830 → Stats & Achievements** 里逐条定义：

- 每条成就一个 **API Name**（= §8 的 ID，如 `ACH_DEX_ALL63`）+ 中英文显示名/描述（= §8「名称/描述」列）+ 锁定/解锁两张图标 + 隐藏旗标（I 组 6 枚）。
- **进度型成就**（图鉴 N 种、累计融合/Token 等）可挂一个 **Stat**（`INT` 类型），配 `min_progress`/`max_progress` 让 Steam 覆盖层显示"37/63"进度条。可选：先做纯里程碑（只 `SetAchievement`），进度条留 P2（见 §9）。
- **填写分工（用户定 2026-07-19）**：**我驱动逐条填入**——用户登录 partner 站后，我用浏览器自动化 / 页面内 `fetch`+`FormData`（仿 steam_trade 既有 itemdef 上传法，见 `plans/steam_trade/01-app-setup.md`）把 41 条的 **API Name / 中英文案（§8 描述列）/ 隐藏旗标 / 关联 Stat / 图标 URL** 全部填好；**用户只做最后一步「发布」点击**（安全红线：不可逆的发布/提审由用户本人）。前置：本文 §8 已锁 + 我产出 41 对图标 PNG（§7 PR-3）+ 用户登录 partner 站。完整"待填内容表"直接读 §8（每行即一条成就的全部后台字段）。

### 4.2 客户端上报架构（关键：跨线程分派）

**架构事实**（`steam.rs`）：`steamworks::Client` 只存在于 **泵线程**（`init` 里 `Client::init_app(4956830)` 后 `thread::spawn`，循环 `client.run_callbacks()` 并串行消费 `SteamRequest`/`WorkshopRequest` channel）。游戏逻辑跑在命令线程/watcher 线程（持存档锁），**不能直接调 Steam**——必须把"要解锁的成就"发到泵线程。

因此接线分三段，把 Steam 彻底挡在纯逻辑之外：

1. **纯判定（无 Steam 依赖，可单测）**：
   ```rust
   // game/achievements.rs（新）
   pub fn satisfied_achievements(cfg: &GameConfig, save: &GameSave) -> BTreeSet<&'static str>;
   ```
   遍历 §8 每条谓词，返回**当前已达成的全集**（幂等）。纯函数，吃 `&GameConfig`+`&GameSave`，零副作用——单测直接喂构造存档断言 ID 集。
2. **增量分派（在 `with_save` 尾部）**：每个改存档的命令成功后，算 `new = satisfied(after) − 已上报集`，把新增 ID **fire-and-forget** 发到泵线程（仿 `steam.rs` 既有 `kick_sync`，不阻塞命令返回）。已上报集缓存在 `SteamStateInner`（加一个 `Mutex<BTreeSet<String>>`），避免每次命令重发全量。
3. **泵线程执行**（在 `SteamCall` 枚举 `steam.rs:50-62` 加一个变体，`perform()` `steam.rs:439` 里 `match` 处理）：
   ```rust
   // SteamCall::UnlockAchievements { ids: Vec<String> }  →  perform() 分支：
   let us = client.user_stats();
   for id in ids {
       let _ = us.achievement(&id).set();   // 幂等：Steam 忽略重复解锁
   }
   let _ = us.store_stats();                 // 提交（进度型同时 us.set_stat_i32(stat, v) 再 store）
   // store_stats 触发的 UserStatsStored/UserAchievementStored 由下一轮 run_callbacks() 刷新 + 弹覆盖层
   ```
   低频、串行——与既有 MintTier1/工坊操作同线程同风格，无新并发窗口。

> **crate 事实（steamworks 0.13.1，已在用）**：`Client::user_stats()` → `UserStats`；`.achievement(name).set()/.get()/.clear()`、`.store_stats()`、`.set_stat_i32/f32` 全部就位（`user_stats.rs` / `user_stats/stats.rs`）。⚠️ **无 `request_current_stats()` 方法**——`Client::init_app` 连上后会自动加载当前用户 stats，`set()/store_stats()` 即可用；但在 stats 到达前所有 setter 返回 `Err(())`。若要显式保证时序，泵线程 `init` 后 `request_user_stats(client.user().steam_id().raw())` 或注册 `UserStatsReceived` 回调（对单机荣誉非必需，`set()` 幂等 + §4.3 回填已兜底）。
>
> **durable 备选**：若担心"游戏事件成功但 `store_stats` 前崩溃"，可改把解锁意图作为新 `SteamOp` 压 `save.steam_outbox`（`game/model.rs`），由 60s `outbox_pass` 重试——跨重启不丢。但 §4.3 的连上回填已覆盖同一失效场景，**默认走 fire-and-forget + 回填**即可，outbox 仅在需要"解锁即刻持久"时上。

### 4.3 门控与回填（幂等收敛）

- **集成关闭 / Steam 不可用**：`integration_enabled()` 假 或 `Client::init_app` 失败 → 泵线程根本不起，channel 缺席。分派侧 `tx` 为 `None` 时**静默丢弃**（不阻塞、不报错）。`stats` 与判定数据照常在本地累积。
- **首次连上 Steam 回填**（重要）：泵线程 `init` 成功后，向自身发一次"全量回填"——`satisfied(current_save)` 的**整个集合**全部 `set()` 再 `store_stats()`。这一步收敛三种情况：
  1. 成就系统给**老存档**加装（玩家早已达成图鉴/满级/融合，补发）；
  2. 集成从关到开（本地调试期 Steam 一直关，`STEAM_DEFAULT_ENABLED` 后来才 true）；
  3. 存档拷到已登录的机器。
- **幂等**：`set()` 对已解锁成就是 no-op，回填与增量分派叠加也不会重复弹窗（Steam 端去重）。已上报集缓存只是省 IPC，不影响正确性。

---

## 5. 触发与呈现（应用内）

- **Steam 覆盖层原生弹窗**：覆盖层可用时，解锁自动弹 Steam 官方成就 toast——零额外工作，首选路径。
- **应用内庆祝（首版必做 · 用户定 2026-07-19）**：本作是无边框置顶小窗，玩家可能关了覆盖层，故不依赖 Steam 覆盖层作唯一反馈。复用现有气泡/juice 系统：解锁瞬间宠物欢呼 + 头顶「🏆 成就解锁：<名字>」toast，走 [OnboardingGuidance.md](OnboardingGuidance.md) 的**展示预算**思路（一次性、不复读）。前端从新事件 `achievement://unlocked {id, nameZh, nameEn}`（泵线程 `set()` 成功后 emit）驱动。**回填批次不弹**（老玩家不该开机被十几条 toast 淹没）——回填只 `set()` 不 emit 前端事件。
- **无需应用内成就浏览器**：Steam 客户端自带成就页。若要，P3 可在设置面板加一个只读列表（读 `satisfied()` + 本地 stats 显示进度）。

---

## 6. 安全与不变量

- **成就 ≠ 资产**：Steam User Stats/Achievements 与 Inventory Service 是**两个独立子系统**。成就不 `GenerateItems`、不 `TriggerItemDrop`、不碰任何 itemdef——**「可交易宠物供给只由 Valve 水龙头（playtime 掉落 + 融合 exchange）强制」不变量原封不动**（`plans/steam_trade/00-decisions.md` §安全不变量）。
- **可刷但无害**：Stats 客户端可写、故可被改客户端伪造。这**可接受**——成就是荣誉炫耀，不换任何经济利益（无金币、无宠物、无交易额度）。与既有"客户端每日上限对作弊者建议性"同立场：荣誉层不设服务器强制。
- **账号级、非存档级**：成就绑 Steam 账号（非某个存档）。存档拷到另一账号会在那边重新判定并解锁——符合预期，无副作用。
- **隐私**：键盘充能成就只用**累计键数**（`total_keys_charged`），不涉字符内容（沿用 [InteractionEconomy.md](InteractionEconomy.md) §5.2 隐私承诺）；Token 成就只用加权 token 计数。两者都不上传原始内容。

---

## 7. 实施拆分

> ✅ **落地状态（2026-07-19）**：**PR-1 数据层 + PR-2 Steam 上报 + PR-4 应用内庆祝已实现**。
> - Rust：`LifetimeStats`（model.rs）+ v6→v7 迁移（persist.rs 从当前宠物播种 highestTier/firstMaxlevel）+ 全部写入点（progression/economy/fusion/facility/energy）+ 纯判定 `game/achievements.rs::satisfied_achievements` + `report_achievements` 挂进 `with_save` 尾 + `SteamCall::UnlockAchievements`（steam.rs perform + 泵线程）+ `diff_new_achievements`/`take_achievement_backfill`/`report_unlocks` + `achievement://unlocked` 事件。**`cargo test --lib` 140 passed / 0 failed**（含 9 条新成就测试）。
> - TS：`types.ts`（LifetimeStats/AchievementUnlock）+ `game/achievements.ts`（判定镜像 + 41 名录 + 显示名）+ `bridge.ts onAchievementUnlocked` + `useAchievementUnlocks`（🏆 toast + 宠物欢呼）挂进 App.tsx + mockEngine v7。**`npm run build`（tsc+vite）绿 + `node scripts/verify_achievements.mjs` 绿**（41 枚 + 阈值 + Rust↔TS 判定一致）。
> - **PR-3 图标**：`scripts/render_achievement_icons.mjs` 离线渲染 **41×2 = 82 张 PNG**（解锁彩色 + 未解锁灰锁，分组配色 + 矢量字形，无字体依赖）→ `assets/steam-achievements/`；**同系列高档位用更华丽的 emblem 递进**（图鉴：书→书签→光芒宝石→王冠桂冠大典；品阶：环→翼→宝石环→王冠巅峰；融合：并球→轨道核→曼陀罗；喂养：饭团→筷食→盛宴；发布/连登→绶带/月度奖章），非叠点数。接触表 `_contact_sheet.png` 已人工复核。
> - **PR-3 后台（2026-07-20 已全部落地并逐条核对）**：41 条成就的 API 名称 / 英文名 / 英文描述 + **中文名 / 中文描述（schinese）** + **6 个隐藏旗标** + **82 张图标**全部填好存草稿；商店页「支持功能 → Steam 成就」（`category_22`）已勾选并保存。核对证据：41 行 × 2 图标齐全；隐藏列恰为 I 组 6 条；完整刷新后重开编辑框仍读到中文（服务器已持久化），另抽查 TIER6/COINS_1M/WORKSHOP_WEAR/WORKSHOP_PUBLISH/TREASURY 五条均与本表一致。
>   - **后台自动化要点（复用）**：图标上传端点 `POST /images/uploadachievement`，参数 `appID/statID/bit/requestType`（`achievement`=彩色、`achievement_gray`=灰锁）；行 id `a{statID}_{bit}` 即定位（**一个 stat 装 32 个成就位**，故 41 条 = a1_0..a1_31 + a2_0..a2_8）。本地文件传不进页面（`file_upload` 限共享目录、页面 CSP 拦本地 fetch/img）→ **把 SVG 图标生成器注入页面，用 `data:` URL → canvas → `toBlob` 现场产图再 POST**，零文件传输。编辑行内**每种语言都有隐藏 input**（含 `schinese`，第 1 个=名、第 2 个=描述），保存是 AJAX；隐藏标签页超 5 分钟会被 Chrome intensive throttling 把定时器压到 1/分钟 → 用 **MessageChannel 重写长延时 `setTimeout`** 绕过。
> - **剩余（纯用户操作）**：① 复核后在成就页「发布」；② 商店页也需发布；③ 若要中文成就对玩家可见，确认应用「支持的语言」含简体中文（后台 all 视图当前只列 token/english，但 schinese 数据已存）。

| PR | 内容 | 门禁 |
|---|---|---|
| **PR-1 数据层（无 Steam）** | `LifetimeStats` 结构 + `GameSave.stats` + v7 迁移；§3.3 全部写入点；纯判定 `game/achievements.rs::satisfied_achievements`（§8 谓词）；Rust 单测（写入点 + 判定矩阵）+ TS 镜像（`types.ts` + `mockEngine.ts` 计数镜像）+ `game/tests.rs` | `cargo test` + `npm run build` 绿；mock 手测计数累积 |
| **PR-2 Steam 上报** | `SteamCall::UnlockAchievements`（`steam.rs:50` 枚举 + `:439` `perform()` handler：`user_stats().achievement().set()` + `store_stats()`）；`with_save` 尾部增量分派（fire-and-forget，仿 `kick_sync`）+ `SteamStateInner` 已上报集缓存；`init` 成功后全量回填；门控静默降级；`achievement://unlocked` 事件。可选新增只读命令 `get_achievements`（TauriBridge `invoke` + MockBridge stub + `types.ts` 类型，`?steam=on` 预览假数据） | `cargo test`（`satisfied_achievements` 纯函数判定矩阵可测，Steam FFI gated）；真机冒烟（用户，`GULUGULU_STEAM=1`）：解锁弹覆盖层 + 回填批不 emit 前端事件（不刷屏） |
| **PR-3 后台 + 图标** | **我驱动** partner 站逐条填入 41 成就（API Name / 中英文案（§8 描述列）/ 隐藏旗标 / 进度 Stat / 图标 URL，仿 itemdef 页面内 `fetch` 上传法）；我产出 **41 对锁定/解锁图标 PNG**（复用 species/element 矢量管线，离线渲染）；**用户只点最终「发布」** | 图标齐 + 后台填完；用户发布后覆盖层弹窗实测（`GULUGULU_STEAM=1`） |
| **PR-4 应用内庆祝**（首版必做） | 前端 `achievement://unlocked` → 宠物欢呼 + 🏆 toast（展示预算一次性，走 [OnboardingGuidance.md](OnboardingGuidance.md) 预算思路）；回填批不弹 | 预览可触发（`?steam=on` mock 假解锁）；不与回填冲突 |

**关键测试清单**：判定谓词矩阵（每条成就构造刚好达成/刚好不达成的存档）；写入点累加/水位/streak；回填幂等（连发两次不重复 emit）；门控关闭时静默；v6→v7 迁移（老档默认 0、既有 dex 立即满足对应成就）。

---

## 8. 成就完整清单（41 枚）

> 图例：**数据源** ✅=现有字段直接判 · 🆕=依赖 §3 新增 `stats` · **🔒隐藏**=Steam 后台设为隐藏（解锁前只显"隐藏成就"）。ID = Steam API Name（发布后冻结）。**「描述」列即 Steam 后台的解锁描述（中 · EN）、「名称」列即显示标题**——本表每行即一条成就的全部后台字段，直接作 §4.1 后台填写依据。阈值可调（首要调参在此表）。
>
> **相对 v1.0（34 枚）的调整（用户定 2026-07-19）**：起步组精简 5→3；新增 **E. AI 造物**组（4，去掉过难的"填满 10 槽"）；工坊组 2→5；彩蛋组 3→6；每日额度文案 2000→**1000**（EconomyScaling v1.2）；总数 **41**。

### A. 起步（核心循环三动作 · 3）

| ID | 名称 中 / EN | 描述 中 · EN | 数据源 |
|---|---|---|---|
| `ACH_FIRST_HATCH` | 初次相遇 / First Friend | 孵化出你的第一只精灵 · Hatch your very first companion | ✅ `sum(dex_obtained)≥1` |
| `ACH_FIRST_MAXLEVEL` | 亲手养大 / Hand-Raised | 首次把一只精灵点到满级 · Click a companion all the way to max level | 🆕 `highest_level ≥ maxLevel[0]`(=10) |
| `ACH_FIRST_FUSION` | 初次融合 / First Fusion | 完成你的第一次融合 · Perform your first fusion | ✅ `tutorial_first_fusion_done` |

### B. 收藏 · 图鉴（7）

| ID | 名称 中 / EN | 描述 中 · EN | 数据源 |
|---|---|---|---|
| `ACH_DEX_10` | 小有收藏 / Budding Collector | 图鉴收集 10 种固定物种 · Discover 10 fixed species | ✅ dex∩recipe ≥10 |
| `ACH_DEX_25` | 图鉴达人 / Seasoned Collector | 图鉴收集 25 种 · Discover 25 species | ✅ ≥25 |
| `ACH_DEX_45` | 图鉴大师 / Master Collector | 图鉴收集 45 种 · Discover 45 species | ✅ ≥45 |
| `ACH_DEX_ALL63` | 图鉴全谱 / Gotta Fuse 'Em All | 集齐全部 63 种固定物种（终局炫耀） · Complete the 63-species Pokédex | ✅ =63 |
| `ACH_ALL_ELEMENTS` | 五行俱全 / Six of a Kind | 集齐 6 只基础元素物种 · Collect all six starter-element species | ✅ dex ⊇ 6 基础 |
| `ACH_FIRST_PENTA` | 五元素 / Pentad | 收集任一五元素物种 · Collect any five-element species | ✅ dex 含某 5-elem |
| `ACH_FLAGSHIP_KIRIN` | 晶麒麟 / The Prism Kirin | 收集六元素旗舰晶麒麟 · Collect the six-element flagship, the Prism Kirin | ✅ `dex["prismkirin"]≥1` |

### C. 品阶 · 养成纵深（4）

| ID | 名称 中 / EN | 描述 中 · EN | 数据源 |
|---|---|---|---|
| `ACH_TIER3` | 三阶登场 / Ascendant III | 拥有过一只 3 阶精灵 · Own a Tier III companion | 🆕 `highest_tier ≥ 3` |
| `ACH_TIER4` | 四阶登场 / Ascendant IV | 拥有过一只 4 阶精灵 · Own a Tier IV companion | 🆕 ≥4 |
| `ACH_TIER5` | 五阶登场 / Ascendant V | 拥有过一只 5 阶精灵 · Own a Tier V companion | 🆕 ≥5 |
| `ACH_TIER6_APEX` | 巅峰 / Apex Predator | 拥有过一只 6 阶精灵（约 30 天登顶的终局） · Own a Tier VI companion — the endgame | 🆕 `highest_tier ≥ 6` |

### D. 融合纵深（3）

| ID | 名称 中 / EN | 描述 中 · EN | 数据源 |
|---|---|---|---|
| `ACH_FUSE_10` | 融合学徒 / Fusion Apprentice | 累计融合 10 次 · Fuse 10 times | 🆕 `total_fusions ≥ 10` |
| `ACH_FUSE_50` | 融合工匠 / Fusion Artisan | 累计融合 50 次 · Fuse 50 times | 🆕 ≥50 |
| `ACH_FUSE_200` | 融合宗师 / Fusion Grandmaster | 累计融合 200 次 · Fuse 200 times | 🆕 ≥200 |

### E. AI 造物（本地 CLI 现场生成的变种 · 4）

> 依 [FusionRecipeSlots.md](FusionRecipeSlots.md)：异物种融合掷中前沿新槽时，本地编码 CLI 现场设计一个 AI 变种（`aif` 前缀，可复现 / 可升阶 / 入图鉴）。本组奖励"亲手造出并养大自己的 AI 物种"这条独特长线——别的养成游戏没有。

| ID | 名称 中 / EN | 描述 中 · EN | 数据源 |
|---|---|---|---|
| `ACH_AI_FIRST` | AI 造物 / AI's Own Design | 首次由本地 CLI 生成一个 AI 变种 · Generate your first AI-designed variant | ✅ `recipe_ai_slots` 非空 |
| `ACH_AI_COLLECT_5` | AI 收藏家 / Variant Collector | 收集 5 个不同的 AI 变种 · Collect 5 distinct AI variants | ✅ dex 非固定键 ≥5 |
| `ACH_AI_COLLECT_20` | AI 图鉴 / Variant Curator | 收集 20 个不同的 AI 变种 · Collect 20 distinct AI variants | ✅ ≥20 |
| `ACH_AI_LADDER_5` | 深挖一脉 / Deep Vein | 在单条配方里解锁 5 个 AI 变种 · Unlock 5 AI variants within one recipe | ✅ 某配方 slots ≥5 |

### F. 编码伴侣（题材招牌 · 4）

| ID | 名称 中 / EN | 描述 中 · EN | 数据源 |
|---|---|---|---|
| `ACH_TOKENS_1M` | 代码小食 / Code Snack | 累计喂食 100 万产出 Token · Feed 1M output tokens | 🆕 `total_tokens_fed ≥ 1e6` |
| `ACH_TOKENS_50M` | 代码正餐 / Code Feast | 累计喂食 5000 万 Token（≈ 重度编码一天） · Feed 50M tokens — about one heavy coding day | 🆕 ≥5e7 |
| `ACH_TOKENS_1B` | 代码盛宴 / Code Banquet | 累计喂食 10 亿 Token · Feed 1B tokens | 🆕 ≥1e9 |
| `ACH_KEYS_100K` | 键盘伙伴 / Keystroke Companion | 累计键盘充能 10 万键 · Charge your pet with 100K keystrokes | 🆕 `total_keys_charged ≥ 1e5` |

### G. 经济 · 建设（5）

| ID | 名称 中 / EN | 描述 中 · EN | 数据源 |
|---|---|---|---|
| `ACH_COINS_1M` | 小有积蓄 / Nest Egg | 累计赚取 100 万金币 · Earn 1M coins in total | 🆕 `total_coins_earned ≥ 1e6` |
| `ACH_HATCHERY_MAX` | 孵化满级 / Full Hatchery | 孵化屋升到 8 槽 · Upgrade the hatchery to all 8 slots | ✅ `hatchery_level ≥ 8` |
| `ACH_YARD_MAX` | 后院满员 / Grand Backyard | 后院扩到 50 格 · Expand the backyard to 50 spots | ✅ 容量≥50 |
| `ACH_SHOP_MAX` | 商店满级 / Deluxe Shop | 商店升到 Lv4 · Upgrade the shop to Lv4 | ✅ `shop_level ≥ 4` |
| `ACH_FULL_HOUSE` | 高朋满座 / Full House | 同时拥有 20 只精灵 · Own 20 companions at once | ✅ `pets.len() ≥ 20` |

### H. 社区 · 创意工坊（gated · 5）

> 仅集成开启时可能达成；关闭时数据不产生，回填也不会误触。

| ID | 名称 中 / EN | 描述 中 · EN | 数据源 |
|---|---|---|---|
| `ACH_WORKSHOP_IMPORT` | 换装 / Dress Up | 导入一款好友/首发工坊皮肤到图鉴 · Import a Workshop skin | ✅ `species_skins` 非空 |
| `ACH_WORKSHOP_WEAR` | 焕新一面 / New Look | 首次给一只精灵换上工坊皮肤 · Equip a Workshop skin on a companion | ✅ `skin_selected` 含 `ws:` |
| `ACH_WORKSHOP_PUBLISH` | 分享创作 / Share the Love | 把自己的一款皮肤发布到创意工坊 · Publish one of your skins to the Workshop | ✅ `workshop_published` 含真 fileId |
| `ACH_WORKSHOP_PUBLISH_5` | 创作达人 / Prolific Creator | 累计发布 5 款皮肤到工坊 · Publish 5 skins to the Workshop | ✅ 真 fileId 计数 ≥5 |
| `ACH_WORKSHOP_COLLECT_5` | 衣柜收藏 / Wardrobe | 收藏 5 款他人的工坊皮肤 · Collect 5 Workshop skins from others | ✅ `Σ species_skins` ≥5 |

### I. 彩蛋 · 温情（🔒隐藏 · 6）

| ID | 名称 中 / EN | 描述 中 · EN | 数据源 |
|---|---|---|---|
| `ACH_STREAK_7` | 常来看看 / Regular | 连续 7 天登录 · Log in seven days in a row | 🆕 `login_streak ≥ 7` |
| `ACH_STREAK_30` | 月度陪伴 / Monthly Companion | 连续 30 天登录 · Log in thirty days in a row | 🆕 `login_streak ≥ 30` |
| `ACH_NIGHT_OWL` | 夜猫子 / Night Owl | 深夜 0–4 点还在陪它打工/喂它 · Tend your pet between midnight and 4 AM | 🆕 `night_owl`（本机本地时区） |
| `ACH_FAREWELL` | 挥手告别 / Bittersweet | 首次放生一只精灵（"去更大的世界吧"） · Release a companion for the first time | 🆕 `first_release_done` |
| `ACH_LOVED` | 爱意满满 / Loved to the Brim | 首次点满当日 1000 点击额度，进入纯抚摸模式 · Spend the full daily 1,000-click allowance | 🆕 `daily_cap_reached_ever` |
| `ACH_TREASURY` | 富甲一方 / Tycoon | 累计赚取 1 亿金币 · Earn 100M coins in total | 🆕 `total_coins_earned ≥ 1e8` |

---

## 9. 决策记录（提请用户确认）

| 项 | 默认（推荐） | 备选 / 说明 |
|---|---|---|
| **图鉴分母** | **63 固定配方物种**（`species_by_recipe` 值集） | 不用 84（含 21 legacy 不可获得副本）也不用 63+AI（无上限）；63 与 [PokedexSystem.md](PokedexSystem.md) §4.3 完成度口径一致 |
| **成就总数** | ✅ **41 枚**（§8，用户定 2026-07-19：起步精简 5→3、加 AI 造物组 4、工坊 2→5、彩蛋 3→6） | Steam 独立游戏常见 30~50；后续如需仍可增（发布后 ID 只增不改） |
| **Steam 后台填写** | ✅ **我驱动逐条填入 + 用户仅点最终发布**（用户定 2026-07-19，§4.1/PR-3） | 仿 steam_trade itemdef 页面内 `fetch` 上传法；不可逆发布由用户本人（安全红线） |
| **进度型 vs 纯里程碑** | 图鉴/融合/Token/AI 收集族挂 Stat 显进度条，其余纯里程碑 | 全纯里程碑更省（后台不配 Stat），但覆盖层无"37/63"进度感 |
| **应用内庆祝** | ✅ **P1 首版必做**：宠物欢呼 + 🏆 toast（用户定 2026-07-19） | 无边框窗 + 覆盖层可能被关 → 应用内反馈更稳、更贴合桌宠体验（§5/PR-4） |
| **隐藏成就** | I 组 6 枚设隐藏 | 其余全公开（成就列表本身是购买前的卖点） |
| **`highest_tier`/`highest_level` 高水位** | 新增字段记录曾达峰值 | 备选：改成"当前存在即判"（放生最高阶会丢成就，体验差，不推荐） |
| **存档版本** | 推进到 **v7**（显式迁移） | 也可不推、纯靠 serde default（省一次迁移，但审计性差） |
| **阈值** | §8 表内值 | 全部 config/常量可调；`ACH_TOKENS_50M` 锚"一天重度用量"、`ACH_TIER6` 锚"约 30 天登顶"、`daily_cap` 锚 **1000**（EconomyScaling v1.2），改动前留意与经济曲线的对齐 |
| **成就图标** | 我产出 **41 对**锁定/解锁 PNG（复用 species/element 矢量管线） | 或用户另找美术 |

---

> **状态（2026-07-19）**：已由用户拍板 —— 成就规模 **41 枚**（起步精简、加 AI 造物/工坊/隐藏组）、应用内庆祝 **P1 首版必做**、Steam 后台**我驱动填写 + 用户仅发布**。用户正在审阅本文（§8 清单细节 + §9 其余待确认项）。
>
> **下一步**：待审阅确认后按 §7 开发 —— **PR-1 数据层**（`LifetimeStats` + 写入点 + 纯判定，纯本地可先落地积累数据）→ **PR-2 Steam 上报**（`SteamCall::UnlockAchievements` 分派 + 连上回填）→ **PR-3 后台 + 图标**（我产 41 对图标 + 驱动 partner 站填写，用户仅点发布）→ **PR-4 应用内庆祝**（宠物欢呼 + 🏆 toast）。
