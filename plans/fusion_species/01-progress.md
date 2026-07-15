# 融合 2.0 工作流 —— 活进度（每次会话收工必更新）

> 入口说明见 [00-overview.md](00-overview.md)。标记：✅ 完成 · 🔶 进行中 · ☐ 未开始 · ⛔ 被阻塞。

## 1. 阶段总览

| 阶段 | 状态 | 备注 |
|---|---|---|
| P0 设计定稿 | ✅ 2026-07-14 | GDD 四文档 + 本工作流落地；CoreGameplay §7/§11 已改指针 |
| P0.5 融合槽位+图鉴 | ✅ 2026-07-14 | 新增 `FusionRecipeSlots.md`（配方 11 槽位 AI 变种阶梯，取代单次 aiFusionChance 掷骰）+ `PokedexSystem.md`（曾获入册/博物馆速览/配方详情+概率）；FusionSystem §3.2/§8、CoreGameplay §7/§7.1 已改指针 |
| P1 引擎 | 🔶 PR-1✅ PR-3✅ | **PR-1 全量落地**（config 63 物种+speciesByRecipe、fuse_pets 真正驱动槽位阶梯、v4 迁移、TS 全镜像）+ **PR-3 图鉴 UI 重做**（pokedexData 模型 + BackyardScene 速览/详情），我的 32 融合测试+node 对拍全绿；PR-2 chimera、PR-4 Steam 未开工，见 §2 |
| P2 静态形象 | ✅ 2026-07-14 | B0 基建 + 57 只 Front 全部完成；build/检查/冒烟全绿 |
| P2-Gate 用户确认 | ✅ 2026-07-14 | 用户拍板"形象设计没有问题了"，57 只全数通过（修订轮后） |
| P3 动画 | ✅ 2026-07-15 | **57/57 全部完成**：每只 Side（右向侧视）+ Lie（专属睡姿）逐只定制；`check_species_assets --strict-anim` 全绿 + moving/sleeping 全谱渲染逐只人工复核 + `npm run build` 绿 |
| P4 收尾 | ✅ 2026-07-15（终审+验证）· 删旧物种→**不执行**（引擎"加法式保留"，见下） | **全谱终审✅**（63 只 × idle/working/moving/sleeping 全渲染人工复核，零回归）+ **真机验证✅**（cargo test 84 passed/0 failed、npm build 绿、preview 冒烟无 console 错误、蛋→孵化→活体精灵经 SvgSprite 渲染 OK）+ **商店整合✅**（shop 走 speciesByRecipe 蛋 + eggPoolCandidates 跳过 legacy + 博物馆走我的 SvgSprite；build 已类型校验整合面）。**删 21 旧物种：不执行**——引擎 PR-1 已定"加法式而非删 21"，21 legacy 是设计保留的兼容层（① 旧存档不 remap 保留 legacy 精灵；② steam 201-221 冻结编号；③ fusion_gen `has_recipe` 门 + `game_config.rs` 3 个测试断言 `fusion_table.len()==21`）。删除会破坏 3 个绿测试 + 旧存档渲染/物种查找。资产删除清单封存，须待 PR-4 Steam（编号迁移 601-657 + `LEGACY_TIER2_DEFS`）+ 旧存档 remap 迁移落地后方可执行 → 归 P5/引擎域 |
| P5 Steam（延后） | ☐ | itemdef 601-657、legacy 映射接线、阶数上链决策（见 FusionSystem.md §9） |

## 2. P1 引擎子任务（详规见 `docs/gdd/FusionSystem.md` §6/§7/§10）

- ✅ **PR-1 规则核心（2026-07-15 落地，加法式而非删 21）**：config.json/.test.json 重构（63 species + speciesByRecipe + fusionFees/maxLevel/levelExpFactor/hatchSeconds 扩展）；`element_set_key`；`SpeciesInfo` 去 `tier`；`plan_fusion` + `logic_validate_fusion_pair` 重写（同阶 1~5 + 双满级 + 按亲代阶费用）；`push_fusion_egg`；存档迁移 v4（21 旧种映射 + custom 撞名清扫 + 备份）；Rust 测试重写；TS 全镜像（types/config/mockEngine/bridge）。⚠️ rebase 在交互经济重构（v3）之上。**+ 槽位阶梯（FusionRecipeSlots.md §5/§9）**：✅ `fusion_slots.rs` 纯逻辑（`element_set_key`/`frontier_m`/`slot_weights`/`roll_slot`/`effective_frontier`/`classify_slot`/`recipe_slot_weights`）+ 15 穷举测试；✅ `recipeAiSlots`/`dexObtained` 字段（serde default，未改 version）+ `record_species_obtained` 接入 `apply_collect`；✅ TS 对拍 `fusionSlots.ts` + `verify_fusion_slots.mjs`。☐ **未做**：接入 `plan_fusion`/`fuse_pets`（异物种走 `recipe_slot_weights`）、v4 迁移（customSpecies→槽封顶 10、pets→dexObtained 播种）、退役 `aiFusionChance*`（等 config 2.0）。
- ☐ **PR-2 AI 路径**：CLI-optional（不可用→**去前沿新槽、已解锁变种复用**）；同物种不掷骰；掷中前沿未注册槽才生成、已注册槽复用；并集元素/阶数推导；挂起蛋兜底=并集物种；`roll_ai`/`roll_slot` 注入。**+ AI 美术契约（FusionRecipeSlots.md §6）**：`chimeraRig` 补 Side/Lie 参数化分支 + 工具/粒子生成器；AI 输出 schema 扩 form/tool/particle/lie/side；prompt 写入睡姿/侧视/专属工具/全屏粒子/夸张表情硬约束；生成物种过 `check_species_assets`。
- 🔶 **PR-3 UX（图鉴✅，融合台/光圈余项）**：✅ **图鉴重做**（`pokedexData.ts` 纯模型 + BackyardScene 速览 dexNo 降序/"+x" 溢出 + 详情按配方铺 6 基础+57 行 DexCell/DexRecipeRow 黑影叠概率+曾获只数+🔒+神秘剪影，`collectedSpecies`→dexObtained，`FIXED_DEX_TOTAL`=63；`verify_pokedex.mjs` 冒烟绿）。☐ 余项：`preview_fusion` 命令 + FusionModal 预览/阻断态重做、`SvgSprite` `tier` 阶数光圈全调用点、EggSvg 彩蛋按元素数、tutorial `pokedexTotal`=63。
- ☐ **PR-4 Steam 预备**：`LEGACY_TIER2_DEFS` 常量 + steam_sync 导入转译接缝 + 冻结编号测试拆分（行为零变化）。**⚠️ P4 删 21 旧物种的前置**：当前 steam 二阶编号 201-221 由 `fusion_table` 键字典序推导（`game_config.rs:465-473` 测试锁定），删 legacy 前必须先把编号迁到 601-657 并落 `LEGACY_TIER2_DEFS` 映射，否则破坏冻结编号 + steam 导入。

## 3. P2/P3 物种生产追踪（57 只，按批次排列）

> 列义：设定=名字+设定定稿（P0 已全谱完成）；形象=Front 静态构图完成；确认=用户 P2-Gate 通过；动画=Side/Lie/状态联调；工具粒子=tool+WORK_FX 落地。B0 未完成前 B1~B9 不得开工。

**B0 基建**（✅ 2026-07-14）：✅ species2 骨架(types/index) · ✅ 共享底件(limbs/bodies/ornaments/anchors) · ✅ 阶数光圈+orn CSS（sprites.css 尾部）· ✅ QA 脚本(render_contact_sheet/check_species_assets) · ✅ STYLE.md · ✅ 试点 2 只（weldbug e2 + teapir e4）端到端

| 批 | codename | 中文名 | 元素数 | 设定 | 形象 | 确认 | 动画 | 工具粒子 | QA |
|---|---|---|---|---|---|---|---|---|---|
| B1 电系 | weldbug | 焊花虫 | 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B1 电系 | voltquill | 电叶猬 | 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B1 电系 | zapbun | 静电兔 | 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B1 电系 | voltmare | 雷海马 | 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B1 电系 | windmole | 风车鼹 | 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B1 电系 | glowfly | 流萤虫 | 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B1 电系 | maildove | 信使鸽 | 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B2 火系 | chilizard | 火辣蜥 | 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B2 火系 | waxlamb | 烛焰羊 | 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B2 火系 | onsenmonk | 温泉猴 | 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B2 火系 | rockrooster | 摇滚鸡 | 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B2 火系 | boilshrimp | 沸腾虾 | 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B2 火系 | toastybara | 暖包豚 | 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B2 火系 | grillgator | 烧烤鳄 | 4 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B3 水系 | steamalotl | 汽雾螈 | 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B3 水系 | sudsotter | 泡澡獭 | 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B3 水系 | lilyfrog | 荷叶蛙 | 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B3 水系 | saunapuff | 桑拿豚 | 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B3 水系 | bowlrus | 冰海象 | 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B3 水系 | spadolphin | 泡汤豚 | 4 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B3 水系 | meteoropus | 云章鱼 | 4 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B4 草系 | potturtle | 花盆龟 | 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B4 草系 | pinefawn | 雪松鹿 | 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B4 草系 | scaresprout | 稻草人 | 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B4 草系 | terrasnail | 苔壳蜗 | 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B4 草系 | juicepitcher | 蜜壶草 | 4 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B4 草系 | discobloom | 摇摆葵 | 4 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B4 草系 | snowbonsai | 雪盆栽 | 4 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B5 冰系 | aurowl | 极光鸮 | 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B5 冰系 | snowcub | 雪球熊 | 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B5 冰系 | icejelly | 冰晶水母 | 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B5 冰系 | waddleskate | 滑冰鹅 | 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B5 冰系 | frostangler | 霜灯鱼 | 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B5 冰系 | yarncat | 毛线猫 | 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B5 冰系 | frostclione | 海天使 | 4 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B6 混编 | pyrepeacock | 烟花雀 | 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B6 混编 | stormdrake | 风暴龙 | 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B6 混编 | glowhum | 光蜂鸟 | 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B6 混编 | seasonleon | 四季龙 | 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B6 混编 | lanternloong | 舞龙灯 | 4 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B6 混编 | mochipop | 爆浆糬 | 4 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B6 混编 | chimebell | 风铃草 | 4 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B7 混编 | bobamingo | 啵茶鸟 | 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B7 混编 | lattegolem | 拿铁雪人 | 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B7 混编 | ramencoon | 拉面熊 | 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B7 混编 | mistyox | 谷雨牛 | 4 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B7 混编 | subhermit | 潜艇蟹 | 4 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B7 混编 | teapir | 抹茶貘 | 4 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B7 混编 | brewbat | 炼药蝠 | 4 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B7 混编 | porkchef | 掌勺猪 | 4 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B8 五元素 | liondance | 醒狮 | 5 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B8 五元素 | manacorn | 灵角兽 | 5 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B8 五元素 | queenbuzz | 女王蜂 | 5 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B8 五元素 | gargoylite | 石像咕 | 5 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B8 五元素 | crystalwing | 琉璃蜓 | 5 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B8 五元素 | claypango | 赤陶甲 | 5 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |
| B9 旗舰 | prismkirin | 晶麒麟 | 6 | ✅ | ✅ | ✅ | ✅ | ✅ | ☐ |

**批次完成度速览**（形象列）：B0 ✅ · B1 7/7 · B2 7/7 · B3 7/7 · B4 7/7 · B5 7/7 · B6 7/7 · B7 8/8 · B8 6/6 · B9 1/1 —— **57/57 静态形象完成**；P3 起看"动画"列

## 4. 会话日志（追加式，最新在上）

| 日期 | 会话内容 | 下一步 | 遗留/风险 |
|---|---|---|---|
| 2026-07-15 | **PR-1 融合引擎全量落地 + PR-3 图鉴 UI（fuse_pets 真正驱动 63 物种槽位阶梯）**。①config.json/.test.json 加法式重构（`scripts/gen_species_config.mjs` 解析 SpeciesMatrix → 57 新物种 + speciesByRecipe 63 键 + fusionFees/aiTotalChanceByElementCount，保留 21 legacy 与旧字段）；②game_config.rs：SpeciesInfo.tier→`#[serde(default)]`+element_count()，GameConfig 加 species_by_recipe/fusion_fees/ai_total_chance_by_element_count + 访问器（species_codename_for_set/fusion_fee_for/ai_total_chance_percent_for_count），both_configs_parse/steam 测试更新（63 键/直方图/新种 def0）；③game.rs：`plan_fusion`（同物种确定性升阶/异物种掷 recipe_slot_weights→Fixed/Reuse/Generate，splitmix64 无 rand 掷点）+ logic_validate 放开阶 1-5 按亲代阶费 + push_fusion_egg(tier) + apply_collect 取 egg.tier + **v3→v4 迁移**（dexObtained 从在册宠物播种）；重写 5 融合测试（onsenmonk/guluduck 升阶/多阶/6阶阻断/复用）；④TS 全镜像：config.ts(speciesForSet/fusionFeeFor) + mockEngine(planFusion/fuseGenerate 走阶梯 + AI 变种并集元素注册槽) + types；⑤**图鉴重做**：新建纯模型 `pokedexData.ts`（dexObtained 收集口径/配方槽位/概率与掷骰同源/dexNo 降序/+x 溢出）+ BackyardScene 接线（速览 museumThumbs、详情按配方铺 6 基础+57 行 DexCell/DexRecipeRow 黑影叠概率+曾获只数+🔒+神秘剪影）+ backyard.css 新类。**门禁：我的 32 融合 Rust 测试全绿 + node 对拍(fusionSlots/pokedex 模型)绿**；`scripts/verify_pokedex.mjs` 冒烟(63配方/阶梯概率/溢出) | PR-2 chimera（AI 路径接槽位阶梯 + chimeraRig 补 Side/Lie/工具/全屏粒子 + AI schema/prompt 硬约束）；旧 21 物种/工具清理(P4) | ⚠️**与并行 EconomyScaling 会话在 config/game.rs/config.ts/mockEngine 重度重叠**：他们把 fusionFees 改陡峭曲线、equivalentEggPrice/clickWork 改签名——当前共享 cargo test 有 2 个**他们的**测试红(energy_feed/releasing_custom_species=物价重算)、tsc 有 4 个**他们的**错(bridge.clickWork/equivalentEggPrice 三参)，**均非本次改动、我未触碰他们代码**；我的部分全绿。图鉴 UI 预览验收被其构建破坏暂阻塞（模型已 node 验证） |
| 2026-07-15 | **P4 终审+验证完成；"删旧物种"判定为不执行**。①**全谱终审**：渲染 63 只 × idle/working/moving/sleeping 四态全谱 sheet 逐张人工复核——P3 三路 dispatcher（side→Side / lie→Lie / else→Front）对 Front/idle/working 零回归，四态全部正确。②**真机验证**：`cargo test` 84 passed/0 failed（引擎绿，且断言 `fusion_table.len()==21`）；`npm run build`（tsc+vite）绿——整合面（species2 精灵 + 商店 BackyardScene + 引擎 config/mockEngine/pokedexData）全类型校验通过；vite preview 冒烟：挂载零 console 错误、蛋孵化→活体咕噜鸭经 SvgSprite 渲染 OK（headless 截图超时=本项目已知 rAF 挂起，非缺陷）。③**商店整合复核**：shop 卖分阶元素蛋，预览 `EggSvg species=speciesByRecipe[element]`、产出 `eggPoolCandidates`（跳过 tier==2 legacy）、博物馆走 `SvgSprite`→我的 rig；与精灵在 EggSvg/SvgSprite 边界干净整合、无文件冲突、build 已验证类型兼容。④**删 21 旧物种：不执行**——Explore 全量测绘 + 引擎 PR-1"加法式而非删 21"共同确认 21 legacy 是设计保留兼容层（旧存档不 remap / steam 201-221 冻结编号 / `fusion_gen.rs:1440 has_recipe` 门 / `game_config.rs` 3 测试断言 len==21）；删除会破坏 3 绿测试 + 旧存档渲染与 Rust 物种查找。 | 删 legacy 归 PR-4 前置（编号迁 601-657 + `LEGACY_TIER2_DEFS` + 旧存档 remap）→ P5/引擎域；PR-2 chimera 待引擎会话；本工作流我方（美术 P2/P3 + 终审验证）收尾 | ① headless 截图/交互在 rAF 挂起时超时，验证用离线 resvg + build + cargo test + console；② 商店在 BackyardScene.tsx 属经济/引擎域，我全程未改；③ 删 legacy 前置链长（steam 编号+旧存档 remap），勿单独删 speciesTable/tools/config 旧行 |
| 2026-07-15 | **P3 动画全部完成（57/57 ✅）**：继 B1+B2 后同会话连做 B3 水系 7（steamalotl 鳃枕/sudsotter 仰泳浮水/lilyfrog 荷叶被/saunapuff 泄气饼/bowlrus 冰砖床獠牙搭肚/spadolphin 歇业木牌/meteoropus 云枕落地）、B4 草系 7（potturtle 缩盆只剩芽/pinefawn 鹿卧鼻埋尾/scaresprout 下架草帽盖脸/terrasnail 玻璃房透睡脸+雪夜灯/juicepitcher 盖笼盖藤圈垫底/discobloom 花瓣睡帽/snowbonsai 垂枝雪被）、B5 冰系 7（aurowl 羽毛球/snowcub 抱保温箱瘫坐/icejelly 半融甜品盘/waddleskate 肚皮滑行定格/frostangler 咬灯泡当夜灯/yarncat 卷死+尾巴封口结/frostclione 合翅祈祷）、B6 混编 7（pyrepeacock 尾屏睡袋/stormdrake 云上盘圈头枕尾焰/glowhum 叶摇篮喙插背羽/seasonleon 尾枕+单眼先睡/lanternloong 灯身叠摞头枕灯架/mochipop 完美方年糕/chimebell 花铃罩身）、B7 混编 8（bobamingo 长脖绕背/lattegolem 头球滚落靠身睡/ramencoon 抱碗尾盖脸/mistyox 牛卧心算/subhermit 缩艇舷窗透灯/teapir 抱壶专业睡/brewbat 翅膜卷饼/porkchef 侧躺呼噜蒸汽圈）、B8 五元素 6（liondance 面具搁一旁真身抱绣球=反差萌/manacorn 马卧角挂打烊牌/queenbuzz 趴蜂巢鼓冠冕歪/gargoylite 石翅被+尾绕空台座/crystalwing 四翅标本平铺叶垫/claypango 卷成陶罐球）、B9 prismkirin（侧视六色鬃拖光带；卧姿鬃毯+棱镜角夜灯柔光）。渲染复核修正 8 处（lilyfrog 帽遮眼/spadolphin 毛巾浮空/bowlrus 獠牙形/pinefawn 颈头合并/scaresprout 帽位/glowhum 吊床改叶摇篮/liondance 面具落地/liondance Blush 缺 import）。门禁：`check_species_assets --strict-anim` 57/57 全绿、moving+sleeping 全谱 sheet+单图逐只人工复核、`npm run build` 绿 | P4 收尾：**删 21 旧物种行/旧工具被阻塞**——config.json 仍保留 `fusionTable`+旧 tier2 物种（config.ts 标注"保留兼容"，引擎会话有意保留作迁移/兼容），需等引擎会话退役 fusionTable 后再删 speciesTable/tools/kits 旧行；EggSvg/图鉴计数已随 PR-3 落地；P5 Steam 延后 | ① render_contact_sheet 第一参数是输出目录；② moving=happy 表情（侧眼弧线属预期）；③ 旧 foxRig/fireKit 等 legacy 资产删除清单已就绪但勿在 fusionTable 退役前动手 |
| 2026-07-15 | **P3 动画 B1+B2 完成（14/57）**：B1 电系 7 只（weldbug/voltquill/zapbun/voltmare/windmole/glowfly/maildove）+ B2 火系 7 只（chilizard/waxlamb/onsenmonk/rockrooster/boilshrimp/toastybara/grillgator）全部补齐 Side（右向侧视，ExpSideFace 单眼+迈步腿）与 Lie（按 SpeciesMatrix 睡姿列逐只定制：焊虫 A 字帐篷、泉猴泡桶头顶毛巾、摇滚鸡抱吉他瘫坐、沸虾卷圈、暖包豚长面包、烤鳄大字趴叼签等）。`check_species_assets` 新增 P3 完成度输出（渲染比对 Front 兜底检测）+ `--strict-anim`。离线渲染复核后修 8 处：泉猴侧脸五官放大/蒸汽改冰蓝、泉猴卧姿浮空耳块+扒沿手、吉他琴颈转向可见、虾圈圈眼露出、面包蒸汽暖色化、鳄爪外撇、鸽尾羽贴身、雷海马雷云挪到下巴当枕。门禁：check 全绿 14/57、moving/sleeping sheet + each 单图人工复核通过 | P3 继续 B3 水系 7 只（steamalotl/sudsotter/lilyfrog/saunapuff/bowlrus/spadolphin/meteoropus）→ B4~B9；每批照例 check + moving/sleeping 渲染复核 | ① render_contact_sheet 第一个位置参数是**输出目录**不是物种过滤器（传串会建立奇怪目录，已清理）；② moving 状态表情=happy（侧视眼是弧线不是圆点，属预期）；③ 工具粒子列在 P2 已全 ✅（tool+WORK_FX 与 Front 同批落地），P3 只补 Side/Lie |
| 2026-07-14 | **P1 起步：槽位阶梯引擎核心 + 图鉴数据模型落地并全测**（不含 config 全量重构/UI）。①新建 `src-tauri/src/fusion_slots.rs`（纯逻辑：`element_set_key`/`ai_total_chance_percent`(A(e))/`obtained_prefix`/`frontier_m`/`slot_weights`(整数权重)/`roll_slot`/`effective_frontier`(CLI 降级)/`classify_slot`/`recipe_slot_weights`）+ **15 个穷举单测逐位核对 FusionRecipeSlots §3.2 概率表**（e=2/3/6×m 权重、和=100·2^(m−1)、AI 池=a%、遍历掷点频率=权重、前缀 u/不跳号/封顶 10/CLI 降级/§3.5 端到端），lib.rs 注册模块。②`GameSave` 加 `dex_obtained`/`recipe_ai_slots`（`#[serde(default)]` 加法式、不改 version 3、旧档降级为空表）；`record_species_obtained` 接入 `apply_collect`（孵出即 +1，放生/融合不减）；Rust 测试覆盖累加/放生不减/JSON 回环/旧档兼容。③TS 对拍 `src/game/fusionSlots.ts` + types/mockEngine 镜像字段与 collectHatched 记账；`scripts/verify_fusion_slots.mjs`（esbuild 转译后 node 跑同批向量）证明 Rust↔TS 一致。**门禁：cargo test 77 passed/0 failed、node 对拍绿、npm run build 绿** | PR-1 余下：config 63 species+speciesByRecipe 重构、`plan_fusion`/`fuse_pets` 真正接入 `recipe_slot_weights`（异物种掷骰）、v4 迁移（dexObtained 播种/customSpecies→槽）、退役 ai_fusion_chance；PR-3 图鉴 UI | ①当前 `fusion_slots` 已全测但**尚未接入 fuse_pets**（fuse 仍走旧 21 表 ai_fusion_chance）——纯逻辑就绪、等 config 2.0 落地即可接线；②模块级 `allow(dead_code)`（分阶段消费）；③BackyardScene.tsx 正被并行会话改名重构，其间 tsc 一度红过，与本次改动无关 |
| 2026-07-14 | **P2 修订轮（用户 P2-Gate 首轮反馈）**：①check_species_assets 新增**栅格实测门禁**（resvg 渲染 idle 帧剥影子/工具/粒子后测内容包围盒：边缘触边即裁切 FAIL、长边 <150 FAIL、`--bbox` 出全谱尺寸表）；②19 只"分头身"物种**大头手术**（mistyox/pinefawn/manacorn/prismkirin/waxlamb/sudsotter/teapir/potturtle/lattegolem/snowcub/ramencoon/claypango/terrasnail/rockrooster/pyrepeacock/queenbuzz/scaresprout/stormdrake/bobamingo——头放大至婴儿比例、五官/耳/头饰随动、身体略缩）；③约 34 只 `scale` 提档 1.03~1.28（规则从"恒 1"放宽为 1.0~1.3，check 按缩放后工具锚校验，STYLE.md 已同步）。修订后全谱长边 171~218、零裁切；build/检查/渲染全绿，评审图已重出 | **P2-Gate 第二轮：用户复审**（sheet_idle/sheet_working + each/ 单图） | 特殊形态（crystalwing/低趴/团状等）只做 scale 不改头身比（用户豁免）；chilizard left 边距 12px 偏紧但未触边 |
| 2026-07-14 | **P0.5 融合槽位+图鉴设计定稿**：新建 `docs/gdd/FusionRecipeSlots.md`（配方 = 0 号固定 + 1~10 号 AI 变种；obtained-prefix 阶梯解锁：1 号免费首解、2 号+ 需先集齐 0 号、不跳号；**触发 AI 总概率 A(e) 按元素数缩放 2/3/4/5/6=60/40/20/10/5%**，P0=1−A(e)、内部 A/2^i、前沿 A/2^(m−1)（池内衰减/阶梯规则不变，A 替换旧的 1/2）；掷中已解锁槽复用不调 CLI、掷前沿新槽才生成；CLI 不可用去前沿新槽；`recipeAiSlots`+`dexObtained` 数据模型与迁移；AI 变种美术契约 8 条=与 57 手作同规）+ `docs/gdd/PokedexSystem.md`（曾获即入册/放生仍在；博物馆速览 dexNo 降序=高阶→低阶+序号大→小、"+x" 溢出不滚动；详情按配方铺行、未收集黑影叠当前生成概率、曾获只数；完成度=固定 63 主线+AI 计数）。FusionSystem §3.2/§8、CoreGameplay §7/§7.1、本进度 §1/§2 已改指针 | 用户确认设计决策（同物种不掷骰、高阶=元素数）→ 归入 P1 PR-1/2/3 实施；本批 P2 的 57 只即各配方 0 号固定物种，与本设计一致 | ① 同物种是否掷槽位、"高阶"指元素数 vs 阶数 已在文档决策记录旗标待用户拍板；② AI 美术契约要求 chimeraRig 补 Side/Lie/工具/粒子（复用 P2 已定的侧视/趴卧规范），是 PR-2 实打实增量；③ 图鉴详情 633 格需懒挂渲染 |
| 2026-07-14 | **P2 完成（B0~B9 一次跑完）**：species2 基建落地（`src/sprites/species2/` 一物种一文件、`parts/{anchors,limbs,bodies,ornaments}` 共享底件、阶数光圈+orn 装饰 CSS、`scripts/render_contact_sheet.tsx` + `scripts/check_species_assets.ts` 硬门禁）；**57/57 只新物种 Front 静态形象 + 专属工具 + WORK_FX 粒子全部完成**（Side/Lie 以 Front 兜底占位，P3 补）。四处 merge 接线（SvgSprite/speciesTable/tools/workFx），`SpeciesVisual.rig` 放宽为 string，`SvgSprite` 新增 `tier` 光圈 prop。全程 `npm run build` + 检查脚本 + 渲染冒烟绿；评审图在 `assets/species_review/`（普通/剪影 sheet + each/ 单图） | **P2-Gate：用户逐只评审形象**（确认/打回），确认后开 P3 动画；P1 引擎可并行开工 | ① 中途设计已演进：FusionRecipeSlots.md（11 槽位 AI 变种阶梯，aiFusionChance 退役）+ PokedexSystem.md 新增——本批 57 只即各配方"0 号固定物种"，不受影响，P1 实现时按新文档走；② 节点预算含装配器共享开销（≈35），阈值已调为 e2 165/e3 205/e4 255/e5 305/e6 380；③ 新物种 config.json 条目尚未添加（P1 PR-1），当前仅 species2 注册表内可渲染 |
| 2026-07-14 | **P0 完成**：新建 FusionSystem.md / SpeciesMatrix.md（63 物种全谱设定定稿）/ SpeciesArtSpec.md；CoreGameplay.md §4/§6/§7/§8/§9/§10.3/§11/§12.8/§13 改为融合 2.0 指针与新规则；本工作流两文件落地。已与并行的交互经济重构（InteractionEconomy.md v2.0）对齐：tierFactor 收益/恢复公式、levelExpFactor ×5 阶梯延长、存档版本 v3(经济)/v4(融合) 链式迁移 | P1 PR-1（等交互经济代码合入后 rebase）或 P2 B0 基建（不依赖 P1，可先行） | ① tierFactor 在 t4~t6 的外推数值极端，与经济工作流联合调参（FusionSystem.md §5 已旗标）；② P2 静态形象需用户 P2-Gate 逐只确认后才能开 P3；③ CoreGameplay.md 仍被并行会话频繁编辑，改前必重读 |
