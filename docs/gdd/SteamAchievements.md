# Steam 成就系统（Steam Achievements）

> 版本 v2.0 · 2026-07-30 · 与当前实现对齐
>
> App ID：**4956830**
>
> 关联实现：`projects/gulugulu-app/src-tauri/src/game/achievements.rs`、`projects/gulugulu-app/src/game/achievements.ts`
>
> 关联设计：[InteractionEconomy.md](InteractionEconomy.md) · [FusionSystem.md](FusionSystem.md) · [PokedexSystem.md](PokedexSystem.md) · [SkinWorkshop.md](SkinWorkshop.md)

## 0. 当前结论

当前成就目录共 **48 枚**：

- 桌宠、养成与工坊主线：**24 枚**。
- 《危楼打工记》工厂模式：**24 枚**，其中 **17 枚沿用已经预留的旧 API ID，7 枚使用新增的 `ACH_FACTORY_*` ID**。
- 隐藏成就：**13 枚**，由原有 6 枚彩蛋、1 枚首次破产和 6 枚工厂高数值挑战组成。
- 图标：**48 对 / 96 张** 256×256 PNG，另有一张 `_contact_sheet.png` 供人工检查。
- 当前存档 schema 是 **v10**；成就所需的 `LifetimeStats` 最初在 v6→v7 迁移中加入，之后随工厂模式继续扩展。

> **重要：API Name 发布后不可改。** 工厂模式沿用的 17 个 ID，其字面名称仍带有旧系统痕迹；当前的中英显示名、描述和解锁条件以本文 §5、Rust 判定和 TypeScript 镜像为准，不能再按 API ID 字面推断。

本文只描述产品与代码的当前事实，不把 Steamworks 后台的“已保存 / 已发布 / 已审核”状态写死在设计文档里。每次发布前都应在后台逐行回读 48 个 ID、中英文本、hidden 标记和两态图标。

## 1. 权威来源与一致性规则

发生冲突时按以下顺序判断：

1. Rust 纯判定：`src-tauri/src/game/achievements.rs::satisfied_achievements`
2. TypeScript 镜像、目录、显示名与 hidden 集：`src/game/achievements.ts`
3. 自动校验：`scripts/verify_achievements.mjs`
4. 本文

Rust 与 TypeScript 必须逐项一致。改动任何 ID、阈值、显示名或 hidden 标记时，必须同时更新两端、图标映射、本文和 Steamworks 草稿，并运行：

```powershell
cd projects/gulugulu-app
node scripts/verify_achievements.mjs
```

## 2. 设计与安全原则

1. 成就是看得见的里程碑，不产金币、不发宠物、不铸造 itemdef，也不改变 Inventory 或交易经济。
2. 判定数据保存在本地存档；Steam 只负责接收解锁上报。
3. `GULUGULU_STEAM=0/false/off` 时，本地统计仍可累积，Steam 上报静默跳过。
4. 首次连上 Steam 时会按当前存档全量回填；`SetAchievement` 幂等，已解锁条目不会重复解锁。
5. 解锁同时触发应用内 `achievement://unlocked` 事件；首次回填不连续弹出历史 toast。
6. 当前实现只上报里程碑解锁，没有配置 Steam Stat 进度条。

## 3. 数据与判定架构

### 3.1 桌宠主线

桌宠主线主要读取：

- `dex_obtained`、`recipe_ai_slots`
- `tutorial_first_fusion_done`
- `workshop_published`、`species_skins`
- `LifetimeStats` 中的终身计数、高水位、连续登录和一次性事件旗标

当前仍参与成就判定的核心字段包括：

- `total_coins_earned`
- `total_fusions`
- `total_tokens_fed`
- `total_tokens_observed`
- `total_keys_charged`
- `highest_tier`
- `login_streak`
- `first_maxlevel_done`
- `first_release_done`
- `daily_cap_reached_ever`
- `night_owl`

`total_coins_earned` 现在既会累计正常打工收入，也会累计工厂结算实际发放的金币；它不是当前金币余额。

### 3.2 《危楼打工记》

工厂成就使用一组只增计数、高水位和一次性旗标：

- 局数：`factory_rogue_runs_started`、`factory_rogue_runs_finished`
- 高水位：`best_revenue`、`best_shift`、`best_pulse`、`best_combo`、`best_desks`
- 构筑：`max_upgrade_levels`、`max_loadout`
- 事件：首次 KPI、首次购买升级卡、首次破产、罢工后过班、同局通过全部四次检查、毕业、无贷毕业

前端提交的是绝对快照；Rust 只取 `max`，布尔值只允许 `false → true`，重复提交幂等。营收和脉冲通过十进制字符串传递，避免 JavaScript 大整数精度损失。

当前冻结阈值来自 2026-07-28 的 100,000 局模拟：

| 项目 | 阈值 |
|---|---:|
| Revenue I | 1,500 |
| Revenue II | 1,000,000 |
| Revenue III | 50,000,000 |
| Mega Pulse | 2,000,000 |
| Endless Shift | 30 班 |
| Factory Regular | 完成 50 局 |
| Master Builder | 单局升级卡总等级 20 |

### 3.3 Steam 上报

`steamworks::Client` 只存在于 Steam 泵线程。游戏逻辑先在存档线程中完成纯判定，再把新增 ID 通过 `SteamCall::UnlockAchievements` 发给泵线程；泵线程逐条 `set()`，最后调用 `store_stats()`。

这条路径不会直接调用 Inventory、Workshop 发布或任何经济水龙头。成就与可交易资产是完全独立的子系统。

## 4. 数量、图标与隐藏标记

| 项目 | 当前值 |
|---|---:|
| 总成就数 | 48 |
| 桌宠主线 | 24 |
| 工厂模式 | 24 |
| 工厂沿用旧 ID | 17 |
| 新增 `ACH_FACTORY_*` ID | 7 |
| 隐藏成就 | 13 |
| 解锁图标 | 48 |
| 未解锁图标 | 48 |

13 枚 hidden：

```text
ACH_STREAK_7
ACH_STREAK_30
ACH_NIGHT_OWL
ACH_FAREWELL
ACH_LOVED
ACH_TREASURY
ACH_WORKSHOP_PUBLISH_5
ACH_WORKSHOP_COLLECT_5
ACH_AI_LADDER_5
ACH_FUSE_50
ACH_FACTORY_ENDLESS_30
ACH_FACTORY_REVENUE_II
ACH_FACTORY_REVENUE_III
```

## 5. 成就完整清单（48 枚）

### 5.1 桌宠、养成与工坊主线（24 枚）

| API Name | 显示名（中 / EN） | 玩家可见描述（中 / EN） | 代码判定 | Hidden |
|---|---|---|---|:---:|
| `ACH_FIRST_HATCH` | 初次相遇 / First Friend | 孵化你的第一只精灵 / Hatch your first companion | `dex_obtained` 非空 |  |
| `ACH_FIRST_MAXLEVEL` | 亲手养大 / Hand-Raised | 把任意一只精灵培养到该品阶满级 / Raise a companion to its tier's max level | `first_maxlevel_done` |  |
| `ACH_FIRST_FUSION` | 初次融合 / First Fusion | 完成你的第一次融合 / Complete your first fusion | `tutorial_first_fusion_done` |  |
| `ACH_DEX_10` | 小有收藏 / Budding Collector | 发现 10 种固定物种 / Discover 10 fixed species | 固定图鉴数 ≥ 10 |  |
| `ACH_DEX_ALL63` | 图鉴全谱 / Gotta Fuse 'Em All | 集齐全部固定物种 / Discover every fixed species | 固定图鉴数 ≥ 当前固定物种总数 |  |
| `ACH_FLAGSHIP_KIRIN` | 晶麒麟 / The Prism Kirin | 发现六元素旗舰物种 / Discover the six-element flagship species | 拥有任意六元素固定物种 |  |
| `ACH_TIER3` | 三阶登场 / Ascendant III | 曾拥有一只 3 阶精灵 / Own a Tier III companion | `highest_tier ≥ 3` |  |
| `ACH_TIER6_APEX` | 巅峰 / Apex Predator | 曾拥有一只 6 阶精灵 / Own a Tier VI companion | `highest_tier ≥ 6` |  |
| `ACH_FUSE_10` | 融合学徒 / Fusion Apprentice | 累计完成 10 次融合 / Complete 10 fusions | `total_fusions ≥ 10` |  |
| `ACH_FUSE_200` | 融合宗师 / Fusion Grandmaster | 累计完成 200 次融合 / Complete 200 fusions | `total_fusions ≥ 200` |  |
| `ACH_AI_FIRST` | AI 造物 / AI's Own Design | 生成你的第一个 AI 变种 / Generate your first AI-designed variant | `recipe_ai_slots` 有非空槽 |  |
| `ACH_AI_COLLECT_20` | AI 图鉴 / Variant Curator | 收集 20 个不同的 AI 变种 / Collect 20 distinct AI variants | 非固定图鉴数 ≥ 20 |  |
| `ACH_TOKENS_1M` | 代码小食 / Code Snack | 累计喂食 100 万 Token / Feed 1M tokens | `total_tokens_fed ≥ 1,000,000` |  |
| `ACH_TOKENS_1B` | 代码盛宴 / Code Banquet | 累计使用 10 亿 Token / Use 1B tokens in total | `total_tokens_observed ≥ 1,000,000,000`（input / cache create / cache read / output 原始数量直接求和，不区分产出；旧档从四分账本回填） |  |
| `ACH_KEYS_100K` | 键盘伙伴 / Keystroke Companion | 累计记录 10 万次键盘充能 / Charge your companion with 100K keystrokes | `total_keys_charged ≥ 100,000` |  |
| `ACH_COINS_1M` | 小有积蓄 / Nest Egg | 累计赚取 100 万金币 / Earn 1M coins in total | `total_coins_earned ≥ 1,000,000` |  |
| `ACH_WORKSHOP_IMPORT` | 换装 / Dress Up | 导入你的第一款额外皮肤 / Import your first extra skin | `species_skins` 至少一项非空 |  |
| `ACH_WORKSHOP_PUBLISH` | 分享创作 / Share the Love | 向创意工坊发布一款皮肤 / Publish a skin to the Workshop | 有至少一个非空 PublishedFileId |  |
| `ACH_STREAK_7` | 常来看看 / Regular | 连续登录 7 天 / Log in seven days in a row | `login_streak ≥ 7` | 🔒 |
| `ACH_STREAK_30` | 月度陪伴 / Monthly Companion | 连续登录 30 天 / Log in thirty days in a row | `login_streak ≥ 30` | 🔒 |
| `ACH_NIGHT_OWL` | 夜猫子 / Night Owl | 在本地时间凌晨 0–4 点陪伴精灵 / Tend your companion between midnight and 4 AM | `night_owl` | 🔒 |
| `ACH_FAREWELL` | 挥手告别 / Bittersweet | 第一次放生精灵 / Release a companion for the first time | `first_release_done` | 🔒 |
| `ACH_LOVED` | 爱意满满 / Loved to the Brim | 第一次用完每日 1,000 次有效点击额度 / Use the full daily 1,000-click allowance | `daily_cap_reached_ever` | 🔒 |
| `ACH_TREASURY` | 富甲一方 / Tycoon | 累计赚取 1 亿金币 / Earn 100M coins in total | `total_coins_earned ≥ 100,000,000` | 🔒 |

### 5.2 《危楼打工记》工厂模式（24 枚）

下表前 17 个 API Name 是为保持 Steam ID 稳定而沿用的旧 ID；其当前显示名和判定已经切换为工厂语义。

| API Name | 显示名（中 / EN） | 玩家可见描述（中 / EN） | 代码判定 | Hidden |
|---|---|---|---|:---:|
| `ACH_DEX_25` | KPI 达标 / KPI Met | 第一次完成班次 KPI / Meet a shift KPI for the first time | `factory_rogue_first_kpi` |  |
| `ACH_AI_COLLECT_5` | 入职福利 / First Perk | 第一次购买升级卡 / Buy your first perk card | `factory_rogue_first_card` |  |
| `ACH_DEX_45` | 五班老员工 / Five Shifts In | 通过第 5 班 / Clear Shift 5 | `best_shift ≥ 5` |  |
| `ACH_TIER4` | 中层骨干 / Middle Management | 通过第 10 班 / Clear Shift 10 | `best_shift ≥ 10` |  |
| `ACH_TIER5` | 坚持到终面 / Final Interview | 通过第 15 班 / Clear Shift 15 | `best_shift ≥ 15` |  |
| `ACH_HATCHERY_MAX` | 光荣毕业 / Clocked Out | 通过第 20 班并毕业 / Clear Shift 20 and graduate | `graduated` 或 `graduated_without_loan` |  |
| `ACH_YARD_MAX` | 自愿加班 / Overtime Volunteer | 通过第 25 班 / Clear Shift 25 | `best_shift ≥ 25` |  |
| `ACH_TOKENS_50M` | 小有营收 / Revenue I | 单局总营收达到 1,500 / Reach 1,500 revenue in one run | `best_revenue ≥ 1,500` |  |
| `ACH_WORKSHOP_COLLECT_5` | 两百万大单 / Mega Pulse | 单次有效脉冲收入达到 200 万 / Earn 2M from a single pulse | `best_pulse ≥ 2,000,000` | 🔒 |
| `ACH_ALL_ELEMENTS` | 三线开工 / Triple Connection | 单次脉冲同时接通 3 张办公桌 / Connect three desks in one pulse | `best_desks ≥ 3` |  |
| `ACH_SHOP_MAX` | 六路通吃 / Full Circuit | 单次脉冲同时接通 6 张办公桌 / Connect six desks in one pulse | `best_desks ≥ 6` |  |
| `ACH_FULL_HOUSE` | 全员到岗 / Full Roster | 开局阵容达到 10 个物种 / Start with a 10-species roster | `max_loadout ≥ 10` |  |
| `ACH_AI_LADDER_5` | 构筑大成 / Master Builder | 单局升级卡总等级达到 20 / Reach 20 total perk levels in one run | `max_upgrade_levels ≥ 20` | 🔒 |
| `ACH_WORKSHOP_WEAR` | 劳资融洽 / Labor Relations | 同一班发生至少 3 次罢工后仍通过该班 / Clear a shift after at least three strikes | `factory_rogue_strike_clear` |  |
| `ACH_FUSE_50` | 工厂常客 / Factory Regular | 完成 50 局工厂挑战 / Finish 50 factory runs | `runs_finished ≥ 50` | 🔒 |
| `ACH_WORKSHOP_PUBLISH_5` | 现金流断裂 / Insolvent | 第一次破产结算 / Go bankrupt for the first time | `factory_rogue_first_bankruptcy` | 🔒 |
| `ACH_FIRST_PENTA` | 经得起检查 / Audit-Proof | 在同一局通过全部四次检查 / Pass all four inspections in one run | `inspection_mask == 0b1111` |  |
| `ACH_FACTORY_CLOCK_IN` | 打卡上班 / Clocked In | 开始第一局工厂挑战 / Start your first factory run | `runs_started ≥ 1` |  |
| `ACH_FACTORY_FIRST_PULSE` | 第一笔工资 / First Paycheck | 完成第一次产生收入的有效脉冲 / Complete your first revenue-producing pulse | `best_pulse ≥ 1` |  |
| `ACH_FACTORY_ENDLESS_30` | 永不下班 / No Clock-Out | 通过第 30 班 / Clear Shift 30 | `best_shift ≥ 30` | 🔒 |
| `ACH_FACTORY_REVENUE_II` | 百万财报 / Million-Revenue Report | 单局总营收达到 100 万 / Reach 1M revenue in one run | `best_revenue ≥ 1,000,000` | 🔒 |
| `ACH_FACTORY_REVENUE_III` | 五千万奇迹 / Fifty-Million Miracle | 单局总营收达到 5,000 万 / Reach 50M revenue in one run | `best_revenue ≥ 50,000,000` | 🔒 |
| `ACH_FACTORY_COMBO_10` | 连轴转 / Tenfold Combo | 单局连击达到 10 / Reach a 10x combo in one run | `best_combo ≥ 10` |  |
| `ACH_FACTORY_DEBT_FREE` | 无贷毕业 / Debt-Free Graduate | 不使用贷款完成第 20 班毕业 / Graduate after Shift 20 without taking a loan | `graduated_without_loan` |  |

## 6. 图标与后台核对

图标生成器：`projects/gulugulu-app/scripts/render_achievement_icons.mjs`

输出目录：`assets/steam-achievements/`

发布前核对：

- 48 个 API Name 无重复且顺序稳定。
- 每个 ID 都有英文与简体中文名称、描述。
- hidden 集合恰好 13 个。
- 每个 ID 都有 unlocked 与 locked 两张 256×256 PNG。
- 17 个沿用 ID 的后台显示名、描述和图标均已切换为 §5.2 的工厂语义。
- 7 个 `ACH_FACTORY_*` 新 ID 已完整建立。
- 不依据旧版的总数、hidden 数量或图标数量记录做发布判断。

## 7. 验证门禁

最低门禁：

1. `node scripts/verify_achievements.mjs` 通过，输出 `48 total / 24 factory`。
2. Rust 与 TypeScript 的工厂阈值一致。
3. 48 个 ID 全都有中英显示名。
4. 工厂阈值前一刻不提前解锁；最高档测试状态恰好解锁 24 个工厂成就。
5. 无 Steam 时统计照常累积；连上 Steam 后回填幂等。
6. 用非开发者测试账号至少真机验证一次新解锁、覆盖层通知和应用内 toast。

## 8. 变更记录

- **2026-07-19**：完成第一版桌宠、养成与工坊成就设计。
- **2026-07-28**：加入《危楼打工记》成就；17 个既有 ID 切换为工厂语义，新增 7 个 `ACH_FACTORY_*` ID；总数改为 48，hidden 改为 13。
- **2026-07-30**：本文按当前 Rust/TypeScript 判定、48 对图标、存档 v10 和工厂冻结阈值重新整理；移除旧版总数、旧图标数、旧 hidden 数量和“待实施”等过时表述。
