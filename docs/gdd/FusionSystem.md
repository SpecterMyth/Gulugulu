# 融合系统 2.0 —— 元素配方物种与阶数体系

> 状态：设计定稿，待实施（P1 引擎）。定稿日期 2026-07-14。
> 关联：[SpeciesMatrix.md](SpeciesMatrix.md)（63 物种全谱）· [SpeciesArtSpec.md](SpeciesArtSpec.md)（美术规范与生产管线）· [FusionRecipeSlots.md](FusionRecipeSlots.md)（**配方 11 槽位 AI 变种阶梯——取代本文 §3.2/§8 的单次掷骰模型**）· [PokedexSystem.md](PokedexSystem.md)（图鉴展示）· 执行进度 `plans/fusion_species/01-progress.md`。
> 本文档取代 [CoreGameplay.md](CoreGameplay.md) §7 的"21 组合表"体系。

> ⚠️ **2026-07-14 增补**：异物种 AI 融合已从"单次 `aiFusionChance` 掷骰 + 无上限唯一 AI 物种"升级为**每配方 0 号固定 + 1~10 号 AI 变种的渐进解锁阶梯**（可复现、可升阶、可满图鉴）。规则权威见 **[FusionRecipeSlots.md](FusionRecipeSlots.md)**；本文 §3.2 结果与 §8 AI 路径的掷骰措辞以该文为准，`aiFusionChance`/`aiFusionChanceByRecipe` 常量随之退役。

## 1. 设计目标与已拍板决策

以 6 个基础元素为基底重新设计融合：**物种身份 = 元素集合**，6 元素全部非空子集共 **63 个物种**（现有 6 只一阶保留 + 57 只新物种），彻底替换旧 21 只配方二阶物种。用户已拍板：

1. **阶数 = 融合次数**：仅同阶且双方满级可融合，结果 = 亲代阶数 +1，**不跳阶**，上限 6 阶。
2. **同物种融合同样升 1 阶**：形象不变（2 阶咕噜鸭、3 阶咕噜鸭……6 阶也存在咕噜鸭），阶数用**脚底扩散光圈**区分。
3. **物种与阶数解耦**：物种（元素集合）决定形象/工具/粒子；阶数决定数值。**同阶物种数值相似**，物种零数值差异。
4. **AI 融合保留双轨**：异物种配对走**配方槽位阶梯**（[FusionRecipeSlots.md](FusionRecipeSlots.md)）——触发 AI 总概率按元素数缩放（2/3/4/5/6 元素 = 60/40/20/10/5%），每配方 0 号固定 + 1~10 号可复现 AI 变种；同物种融合永远确定性；CLI 不可用时保留已解锁变种复用、仅停新变种生成（不再硬拒融合）。~~旧：CLI 可用时恒 50% 概率生成无上限唯一 AI 物种~~。
5. 57 只新物种全部逐只定制 rig；先出全部名字/设定/静态形象，用户确认后才做动画（见 SpeciesArtSpec.md）。

## 2. 双轴模型：物种 × 阶数

### 2.1 物种 = 元素集合

- 6 元素：`normal / fire / electric / water / grass / ice`（一般/火/电/水/草/冰）。
- **物种键（canonical set key）**：元素去重 → 按元素 id 字典序排序 → `"+"` 连接。单元素键即元素名（`"fire"`），多元素如 `"fire+ice"`、`"electric+fire+grass+ice+normal+water"`。是现有 `fusion_recipe_key`（`game_config.rs:198`）的 N 元推广，与现存二元键完全兼容。
- **`speciesByRecipe`**：config 中的 63 键映射表（物种键 → codename），取代 `fusionTable`（21 键）。**改名是故意的**——让所有旧读取点变成编译错而非静默 undefined。含 6 个单元素键（映射回 6 只一阶）。
- 物种数按元素数分布：1 元素 6 只（现有）、2 元素 15、3 元素 20、4 元素 15、5 元素 6、6 元素 1，合计 63。
- codename 是存档外键，**一经定稿永不改名**；全谱清单见 SpeciesMatrix.md。

### 2.2 阶数 = 融合次数（养成深度）

- `PetInstance.tier` / `EggInstance.tier`（已存在的字段）即该轴，范围 1~6。
- 阶数与元素数**解耦**：任意物种可存在于「最早可达阶 ~ 6 阶」的每一阶（见 §3.3 推演）。
- **数值原则**：所有经济/养成数值只索引 `(阶数, 等级)`——打工收益、精力、升级曲线、融合费、孵化时长均与物种无关。物种只影响形象、工具、粒子、图鉴。

### 2.3 阶数光圈（视觉标识）

pet.tier ≥ 2 时，精灵脚底（影子层旁）渲染一圈**向外扩散的彩色光圈**（循环扩散渐隐动画）：

| 阶数 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|
| 光圈色 | 青碧 `#6FD3A6` | 湛蓝 `#5AA9F0` | 绛紫 `#B07DE8` | 鎏金 `#F5C542` | 六色棱光（多色环） |

实现：`SvgSprite` 增 `tier` prop + `GradeHalo` 共享组件 + 一次性 CSS（`grade-ring-expand`），详见 SpeciesArtSpec.md §6。1 阶不显示，保持一阶清爽。

## 3. 融合规则

### 3.1 前置条件

两只精灵满足全部条件方可融合：

1. 两只不同个体（id 不同；物种可以相同）。
2. **同阶** T，且 1 ≤ T ≤ 5（两只 6 阶不可再融合，UI 提示"已达最高阶"）。
3. **双方满级**（`level ≥ maxLevel[T-1]`）。
4. 金币 ≥ 融合费 `fusionFees[T-1]`（按**亲代阶数**计费，见 §5）。

保留现有例外：允许消耗最后两只精灵（必得蛋，不构成死局）。

### 3.2 结果

- **结果物种** = `speciesByRecipe[setKey(SA ∪ SB)]`（双亲元素集合并集去重）。SA = SB（同物种）时并集即自身 → 同物种。
- **结果阶数** = T + 1（永不跳阶）。
- 产出一颗蛋：`species = 结果物种`，`tier = T+1`，`hatch_kind = "tier{T+1}"`，孵化时长按结果阶（§5）。
- **同物种融合**（SA = SB）：永远走确定性路径，**不掷 AI 骰子**——同形象升阶是玩家的确定性养成承诺。
- **异物种融合**（SA ≠ SB）：走**配方 11 槽位阶梯**掷骰（[FusionRecipeSlots.md](FusionRecipeSlots.md) §3）——触发 AI 总概率 `A(e)` 按元素数缩放（2/3/4/5/6 元素 = 60/40/20/10/5%），0 号固定物种 = `1−A(e)`，其余 `A(e)` 在已解锁 AI 变种 + 下一待解锁槽间几何衰减；掷中已注册槽复用（不调 CLI），掷中前沿新槽才 AI 生成；CLI 不可用则去掉前沿新槽、已解锁变种照常复用（不再"100% 固定"，也永不硬拒）。~~旧：按 `aiFusionChance`(0.5) 单次掷骰~~。
- **同一配方必得同一物种**：配方路径由 `speciesByRecipe` 保证确定性（同物种可有不同阶数）。

### 3.3 推演：元素数、最早可达阶与全谱可达性

阶数 T 的物种最多携带 `min(6, 2^(T-1))` 个元素（每融合一次元素数至多翻倍）：

| 阶数 T | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| 该阶元素数上限 | 1 | 2 | 4 | 6 | 6 | 6 |

由此得**每种元素数的最早可达阶**（之后每一阶都可由同物种融合续升）：

| 元素数 | 最早可达阶 | 最早配方示例 |
|---|---|---|
| 1 | 1 阶 | 商店蛋直出 |
| 2 | 2 阶 | t1 火 × t1 水 → t2 `{火,水}` |
| 3 | 3 阶 | t2 `{a,b}` × t2 `{a,c}` → t3 `{a,b,c}` |
| 4 | **3 阶** | t2 `{a,b}` × t2 `{c,d}`（不相交）→ t3 `{a,b,c,d}` |
| 5 | 4 阶 | t3 `{a,b,c,d}` × t3 `{a,d,e}` → t4 |
| 6 | 4 阶 | t3 `{a,b,c,d}` × t3 `{c,d,e,f}` → t4 |

推论：**63 个物种全部可达**；且存在"3 阶的 4 元素华丽物种"这类组合——华丽度（元素数）与光圈（阶数）是两个独立的炫耀维度。

### 3.4 边界与提示

- 两只 6 阶：禁止，提示"已达最高阶"。
- 融合预览（§10 PR-3 `preview_fusion`）在确认前展示：结果物种（同物种升阶 → "同种融合 → N 阶"；异物种 → 结果物种名或"？？？· 可能触发 AI 惊喜"）、结果阶数、费用、阻断原因（未满级/钱不够/双 6 阶）。
- 蛋 UI 保持"孵出前不剧透"的悬念（EggSvg 彩蛋色板按结果物种元素数取样，替换现有"21 种可能"的写死逻辑，`SvgSprite.tsx:209`）。

## 4. 与旧系统的差异一览

| 维度 | 旧（21 表） | 新（2.0） |
|---|---|---|
| 物种身份 | 配方表任意指定 | 元素集合，63 只全覆盖 |
| 配方键 | 双亲**首元素**有序对 | 双亲**全部元素**并集的集合键 |
| 可融合阶 | 仅 1 阶 | 1~5 阶（同阶） |
| 同元素融合 | 产出独立"王族"物种（infernofox 等） | 同物种升 1 阶（形象不变 + 光圈） |
| 结果阶数 | 固定 2 | 亲代 +1 |
| AI 双轨 | CLI 不可用则硬拒融合 | CLI 不可用时 100% 配方，永不硬拒 |
| SpeciesInfo.tier | 物种自带阶数 | **删除**——阶数只在实例上；华丽度用 `elements.length` |

## 5. 经济数值（默认值，全部可调）

> ⚠️ 与并行工作流 **[InteractionEconomy.md](InteractionEconomy.md) v2.0（交互经济重构）** 对齐：`(阶数, 等级)` 的收益/恢复数值权威在该文档 §8——点击收益与精力恢复统一走 `tierFactor(tier) = tierGrowthFactor^(tier−1)`（默认 5），`clickCoinsPerTier` 与点击软上限已被其移除。本文只做"扩到 6 阶"的数组延长与融合自有参数。

> ⚠️ **2026-07-21 机制修订**（交互经济）：**Token 不再回复精力**，改直接折算为**陪伴宠（主宠）经验**（`tokensPerExp`，全阶统一、不乘 `tierFactor`；权威见 [InteractionEconomy.md](InteractionEconomy.md)）。下表「精力恢复」行的 Token 腿已删，精力恢复仅剩**挂机 + 敲键盘**两途径；少一条恢复水龙头后，高阶（t4~t6）精力可行性警告随之**加剧**（详见该行）。

| 项 | 值 | 说明 |
|---|---|---|
| `fusionFees` | **`[1500, 30000, 600000, 12000000, 120000000, 2400000000]`** | 索引 = 亲代阶数 T−1；`fusionFee` 字段废弃改名。本行原写线性 `[100..600]`，已被 **[EconomyScaling.md](EconomyScaling.md) §5** 的 ×20 指数阶梯取代（末档 5→6 于 v1.3 单独 ×10 降到 1.2 亿；索引 5 = 永不计费的单调守卫值） |
| `hatchSeconds` | `tier2:1800 / tier3:3600 / tier4:7200 / tier5:14400 / tier6:28800` | 键 = 结果阶；`tier2` 与现状一致，兼容在途蛋 |
| `maxLevel` | `[10, 20, 30, 40, 50, 60]` | 索引 = 阶数−1（前两项与 InteractionEconomy 一致，后四项为新增延长） |
| `levelExpFactor` | **`[4, 10, 45, 250, 1600, 11250]`**（v1.3） | ⚠️ 本行原写 `[10,50,250,1250,6250,31250]`（"沿 ×5 阶梯延长"）——该口径把 1→2 阶的点击数拉出 8.3× 断层。**权威定义已移到 [EconomyScaling.md](EconomyScaling.md) §2.1**：设计输入是满级击数 ×2 阶梯 **45/95/196/390/784/1593**（每击经验 `4×5^(阶−1)`），factor 由它反解；`maxLevel` 不变 |
| 点击收益 | `(1 + 等级) × 5^(阶数−1)` 金 / `2 × 5^(阶数−1)` exp | InteractionEconomy §4.1 公式自然外推；防刷闸门 = 每日 2000 击全局额度 |
| 精力恢复 | 挂机/键盘 ×`tierFactor`（本行原含 Token 腿，2026-07-21 移出精力体系→改折算经验） | ⚠️ 恢复途径缩为两条后警告**加剧**：t4~t6 外推值极端（t6 挂机回满 ≈21.7 天、键盘 62.5 万键），且再无 Token 快充兜底——`tierGrowthFactor` 或改逐阶数组，**列为与交互经济工作流的联合调参项（Token 退出后优先级上调）**，P1 不动该机制 |
| 等效蛋价 | `Σ(物种各元素蛋价) + fusionEggPriceBonus × (阶数−1)` | `tier2EggPriceBonus`(100) 改名 `fusionEggPriceBonus`，放生返还公式沿用 |
| `aiFusionChance` | 0.5 | 仅作用于异物种配对；`aiFusionChanceByRecipe` 键改为并集物种键 |
| config.test.json | 同结构小数值 | `fusionFees:[10,20,30,40,50,60]`、`hatchSeconds tier2..6: 20/25/30/35/40`、`maxLevel`/`levelExpFactor` 沿 InteractionEconomy 测试值（`[4,6]`/`[2,3]`）延长为 6 项；species/speciesByRecipe 两份 config **必须逐字节一致**（测试强制） |

## 6. 数据模型与配置变更

### 6.1 config.json（`src/game/config.json` + `config.test.json`）

- `species`：63 条。保留 6 只一阶原样（steamItemDef 101–106）；删除 21 条旧二阶；新增 57 条，字段：`steamItemDef: 0`（P5 前恒 0）、`nameZh`、`elements`（**删除 `tier` 字段**）、`colors`（首色 = 主导元素色）、`body`（= codename，直连 species-pack 注册表；渲染兜底见 SpeciesArtSpec）、`desc`。
- `fusionTable` → **`speciesByRecipe`**（63 键）。
- `fusionFee` → `fusionFees`（数组）；`tier2EggPriceBonus` → `fusionEggPriceBonus`；`maxLevel`/`levelExpFactor` 扩到 6 项；`hatchSeconds` 增 tier3~tier6。

### 6.2 Rust（`src-tauri/src/`）

- `game_config.rs`：`element_set_key(&[String]) -> String`（N 元推广，替换 `fusion_recipe_key`）；`SpeciesInfo` 删 `tier` 字段、加 `fn element_count()`；`species_for_set()`；`fusion_fee_for(parent_tier)`；结构体字段随 config 改名；校验测试重写（63 键完备、元素数直方图 6/15/20/15/6/1、双 config 一致、species↔speciesByRecipe 双射、codename 不以 `aif` 开头）。
- `game.rs`：`plan_fusion()` 统一产出 `FusionPlan { result_species, result_tier, fee, same_species: bool }`；`logic_validate_fusion_pair` 重写（同阶 1~5、双满级、按亲代阶费用，删除"仅 1 阶"与"2 阶融合将在后续版本开放"分支）；`push_tier2_egg` → `push_fusion_egg(species, tier, …)`；`species_info().tier` 的所有调用点改为实例 `tier` 或 `element_count()`；存档 `version` 3 + 迁移（§7）。
- `fusion_gen.rs`：见 §8。
- `steam_sync.rs`：编译适配 + legacy 映射占位（§9），行为不变（集成默认关）。
- `lib.rs`：注册新只读命令 `preview_fusion`。

### 6.3 TS（镜像）

- `types.ts`：`SpeciesInfo` 删 `tier`；`GameConfig` 字段改名；新增 `FusionPreview` 类型。
- `config.ts`：`elementSetKey` / `speciesForSet` / `fusionFeeFor` / `planFusion`（与 Rust 同规）；等效蛋价新公式。
- `mockEngine.ts`：权威镜像全部规则（同物种不掷骰、并集升阶、费用/孵化按阶、迁移、`previewFusion`）。mock 存档历史版本混乱，迁移按"存在旧 codename"判定而非版本号。
- `bridge.ts`：`previewFusion(idA, idB)`。
- UI 触点：`FusionModal.tsx`（预览 + 阻断态 + "CLI 不可用则走经典配方"的信息条替代硬拒）、`BackyardScene.tsx`（融合提示/费用/图鉴分组改 `elements.length`）、`tutorial.ts`（`pokedexTotal` = 57 + 自定义）、`SvgSprite.tsx`（EggSvg 彩蛋色板、tier 光圈 prop）。

## 7. 存档迁移 → v4（v3 已被交互经济重构占用）

版本协调：**InteractionEconomy.md §9 占用 v2→v3**（精力/额度/Token 账本迁移）。融合改造的迁移为 **v3→v4**；若合入顺序对调则两工作流互换版本号（以先合入者为准，另一方 rebase）。`ensure_loaded` 按版本逐级链式迁移（v2 存档一次加载依次跑 v3、v4 两段）。

触发：`ensure_loaded` 读到 `version < 4` → 先把原文件备份为 `gulugulu-save.v3.bak.json`（若还是 v2 则先走 v3 迁移）→ 迁移 → `version = 4` → 持久化。mock 侧同规。

**21 只旧二阶映射表**（阶数保留为 2，等级不变；同元素 6 只回归基础种，跨元素 15 只映射到同集合新物种——新 codename 定稿见 SpeciesMatrix.md）：

| 旧 codename | → 物种键 | | 旧 codename | → 物种键 |
|---|---|---|---|---|
| guluswan | `normal` | | plasmatanuki | `electric+fire` |
| infernofox | `fire` | | steamander | `fire+water` |
| thunderking | `electric` | | cinderleaf | `fire+grass` |
| tidefrog | `water` | | thermowolf | `fire+ice` |
| mycobeast | `grass` | | stormeel | `electric+water` |
| glacierpeng | `ice` | | vinevolt | `electric+grass` |
| blazeduck | `fire+normal` | | auroramink | `electric+ice` |
| sparkduck | `electric+normal` | | lotusturtle | `grass+water` |
| rippleduck | `normal+water` | | floeseal | `ice+water` |
| mossduck | `grass+normal` | | frostbunny | `grass+ice` |

迁移步骤（顺序执行）：

1. **customSpecies 撞名清扫**：save.custom_species 中与新 63 名单撞名的条目改名为新 `aif…` 代号并改写引用（防 `species_info` 静默遮蔽）。
2. **宠物**：旧 codename → 新物种，tier 保持 2，等级不动（新 t2 上限仍 20）。
3. **蛋**：同映射；`hatch_kind:"tier2"` 与 `hatch_at` 不动。挂起融合蛋：`parents` 走映射、`recipe_key` 重算为并集键、占位 `species` 改指并集物种。
4. **custom_species[*].parents** 走映射（展示用）。
5. **steam_tombstones / steam_outbox**：物种与 `"x+x"` 型 recipe_key 走映射（`"x+x"` → `"x"`）；itemdef 不动（由 §9 legacy 表在导入时转译）。
6. `active_pet_id` 不变（id 不迁移）。

## 8. AI 融合路径适配（fusion_gen.rs）

> 掷骰与"生成 vs 复用 vs 固定"的分派逻辑权威在 **[FusionRecipeSlots.md](FusionRecipeSlots.md) §3/§5/§9**；本节余下措辞按其阶梯模型理解（`chance(并集键)` 单次掷骰 → 11 槽位阶梯分布；无上限唯一物种 → 每配方 ≤10 可复现变种槽）。AI 变种的**美术成品契约**（睡姿/侧视/专属工具/全屏粒子/夸张表情，与 57 手作同规）见该文 §6。

- **移除 CLI 硬门槛**（`fusion_gen.rs:1423`）：CLI 不可用 → 已解锁变种照常复用、去掉前沿新槽（不再一律"100% 固定"），融合永远可用。
- 掷骰仅发生在**异物种配对**：按 [FusionRecipeSlots.md](FusionRecipeSlots.md) §3.2 的槽位分布掷骰，掷中前沿未注册槽才 `fusion_gen`；同物种一律 `logic_fuse_pets`（确定性升阶，不掷骰）。
- `commit_design` 元素推导改为**双亲元素全集合并**（替换"各取首元素"，`fusion_gen.rs:1270`）；自定义物种 `elements` = 并集，蛋与孵出宠物 `tier = T+1`；`SpeciesInfo` 无 tier 后随之调整。
- 挂起蛋占位 `species` = 并集对应的图鉴物种（超时孵化孵出"正确配方"的宠物，不再兜底 guluduck）。
- prompt 中"二阶新物种"措辞泛化为"N 阶"；双亲描述已兼容任意阶/自定义物种。
- 掷骰抽成 `roll_ai(chance, rng)` 便于测试注入。

## 9. Steam 影响（P5 执行，本期只定案）

现状：App 4956830，75 条 itemdef 编号已上传冻结（101-106 一阶宠 / 201-221 旧二阶宠 / 301-321 旧二阶蛋 / 401-406 掉落生成器 / 501-521 孵化生成器）；集成开关 `GULUGULU_STEAM` 默认关。

**加法编号定案**（永不重编旧号）：

- 新物种宠物 **601–657**：按（元素数升序，物种键字典序）编号——2 元素 601-615、3 元素 616-635、4 元素 636-650、5 元素 651-656、6 元素 657。
- 新蛋 = 宠物 +100（**701–757**）；新孵化生成器 = 蛋 +200（**901–957**）；8xx 保留。与现有 4xx/5xx 无冲突。
- **legacy 导入映射**：`LEGACY_TIER2_DEFS`（21 行常量表，含 §7 的映射 + tier 2）供 `steam_sync` 的 reconcile/collect 在 `species_for_steam_def` 未命中时转译（201-221 → 新物种宠物；301-321 → def−100 同表）。本期仅落常量与接缝注释，不改行为。
- ~~**P5 待决**：阶数如何登记到 Steam；并集 exchange 多对多表达~~ → **已解（2026-07-15，见 [plans/steam_trade/00-decisions.md](../../plans/steam_trade/00-decisions.md)「用户拍板（2026-07-15）」）**：
  - **待决①（阶数）**：**不登记到 Steam**——阶数/等级纯本地存档（承接待决 4），itemdef 不按阶翻倍；Steam 只认物种（集合），不校验同阶。
  - **待决②（并集 exchange）**：每只宠一个 `set:<集合键>` **整体标签** + 每多元素配方一个 hidden generator，`exchange` 枚举该集合的**全部并集对** `{set:A,set:B ∣ A∪B=S}`、`bundle` 为加权 11 槽池 → **物种稀有度服务器精确强制**；同物种走宠 def 自带 `exchange:"sp:<codename>*2"` 确定升阶。
  - **代价（用户已接受）**：per-user 阶梯（[FusionRecipeSlots.md](FusionRecipeSlots.md)）在 Steam 权威下降级为**全局加权池**（稀有度曲线保留、解锁门控丢失）；6 元素配方 364 条 exchange 实测 **20.4KB、真机上传已验 Steam 接受（2026-07-15）**，方案成立。新增 57 条并集 generator（提案 20000–20056，未上传未冻结）。

## 10. 引擎实施拆分（P1，详细进度见 plans/fusion_species/01-progress.md）

| PR | 内容 | 门禁 |
|---|---|---|
| PR-1 规则核心（原子） | config 重构 + `element_set_key`/`speciesByRecipe` + `plan_fusion` + 阶数融合 + SpeciesInfo 去 tier + 迁移 v4 + Rust 测试重写 + TS 机械镜像 | `cargo test` + `npm run build` 全绿；mock 手测：同种升阶/跨种并集/费用孵化按阶/迁移 fixture |
| PR-2 AI 路径 | CLI-optional 掷骰、并集元素推导、占位物种、prompt 泛化、`roll_ai` 注入 | fusion_gen 单测 + `?fusionfail=1` 超时孵出并集物种 |
| PR-3 UX | `preview_fusion` 命令 + bridge/mock + FusionModal 重做 + 阶数光圈接线（SvgSprite `tier` prop 全调用点）+ EggSvg/图鉴计数 | mock 全流程手测 + 光圈五色可见 |
| PR-4 Steam 预备 | `LEGACY_TIER2_DEFS` + 导入转译接缝 + 冻结编号测试拆分（旧 21 断言 → legacy 表断言 + 新种 def==0 断言） | `cargo test`；行为零变化 |

**关键测试清单**：同物种品阶数学（t1×t1→t2、t5×t5→t6、双 t6 阻断）；跨物种并集（t2 交叠→t3 三元素、t2 不相交→t3 四元素）；费用/孵化按阶查表；迁移 fixture（含 guluswan 宠、thermowolf 在途蛋、挂起融合蛋、custom 撞名）；63 键双射与直方图；双 config 一致性。

## 11. 风险与边界备忘

0. **与 InteractionEconomy（交互经济重构）并行协调**：该工作流占用存档 v3、删除多个 config 常量（`clickCoinsPerTier`/软上限等）并改写点击与精力公式——融合 PR-1 必须 rebase 在其之上（或按实际合入顺序互换版本号）；`tierFactor` 高阶（t4~t6）外推数值为两工作流联合调参项。
1. 旧存档 mock 版本号混乱 → 迁移按旧 codename 存在性判定。
2. `aiFusionChanceByRecipe` 键语义变更（当前为空表，零数据迁移）。
3. 自定义物种与新 codename 撞名 → 迁移清扫 + `aif` 前缀保留测试。
4. 旧自定义物种 `elements` 与 tier 不再满足任何等式 → 数值一律走实例 tier，无影响。
5. `hatch_kind:"tier2"` 永久保留键，兼容在途蛋。
6. 放生返还忽略"融合成本递归累计"（等效蛋价只按元素+阶数线性），属故意简化，经济后续调参。
7. EggSvg/图鉴/教程计数从 21 改 57+，注意 `SvgSprite.tsx:209`、`tutorial.ts:49`、DebugPanel 分组。
8. 57 只新物种在美术完成前由 `getSpeciesVisual` 兜底渲染（元素色团子），P2 分批替换为正式形象。
