use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

// Both configs are compiled in; GULUGULU_TEST_CONFIG=1 selects the small-value
// test config at startup (same switch the web preview exposes as ?test=1).
const NORMAL_CONFIG_JSON: &str = include_str!("../../src/game/config.json");
const TEST_CONFIG_JSON: &str = include_str!("../../src/game/config.test.json");

/// Token 四分喂养权重。每 1 个对应 token 折算成的"喂养单位"数——喂养单位再
/// 按 `tokens_per_exp` 折成陪伴宠的经验点（2026-07-21 起 Token → 经验）。
/// 默认 = 用户规定的 cache_read/cache_create/output/input → 0.01/0.2/2/5。
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TokenFeedWeights {
    pub input: f64,
    pub cache_create: f64,
    pub cache_read: f64,
    pub output: f64,
}

impl Default for TokenFeedWeights {
    fn default() -> Self {
        Self { input: 5.0, cache_create: 0.2, cache_read: 0.01, output: 2.0 }
    }
}

impl TokenFeedWeights {
    /// 把一份四分明细折算成喂养单位（各项 ×权重求和，四舍五入取整）。
    /// 传入的是账本差分（本次真正新增的四分 token），值有界，f64 精度足够。
    pub fn feed_units(&self, breakdown: &crate::codex_adapter::TokenBreakdown) -> u64 {
        let units = breakdown.input as f64 * self.input
            + breakdown.cache_create as f64 * self.cache_create
            + breakdown.cache_read as f64 * self.cache_read
            + breakdown.output as f64 * self.output;
        units.round().max(0.0) as u64
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ElementInfo {
    pub name_zh: String,
    pub color: String,
    pub badge: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeciesInfo {
    pub name_zh: String,
    /// 英文名。目录物种留空（英文名由 codename TitleCase 求得，见 src/i18n/species.ts）；
    /// AI 融合物种由生成器填入专有英文名，缺失时前端本地兜底推导。
    #[serde(default)]
    pub name_en: String,
    /// 旧模型的物种自带阶数（1=一阶、2=旧二阶）。融合 2.0 起阶数只在实例上，
    /// 57 只新物种不带此字段（default 0 = 无自带阶数，华丽度用 `element_count()`）。
    #[serde(default)]
    pub tier: u8,
    pub elements: Vec<String>,
    pub colors: Vec<String>,
    pub body: String,
    pub desc: String,
    /// 英文图鉴文案。目录物种留空（英文文案在 SPECIES_EN_DESC 表）；
    /// AI 融合物种由生成器填入英文设定，缺失时前端回退。
    #[serde(default)]
    pub desc_en: String,
    /// Steam Inventory itemdefid（plans/steam_trade/00-decisions.md 编号规则，
    /// 一经上传不可回改）。0 = 未映射（AI 自定义物种走 0，Steam 侧按其配方
    /// 对应的目录物种记账）。
    #[serde(default)]
    pub steam_item_def: u32,
}

impl SpeciesInfo {
    /// 华丽度轴 = 元素数（与阶数解耦，FusionSystem.md §2.2）。
    pub fn element_count(&self) -> usize {
        self.elements.len()
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameConfig {
    pub initial_coins: u64,
    pub historical_exp_coin_cap: u64,
    pub egg_prices: BTreeMap<String, u64>,
    pub tier2_egg_price_bonus: u64,
    pub hatch_seconds: BTreeMap<String, u64>,
    /// 品阶成长系数：恢复需求与点击收益都按 factor^(tier−1) 缩放
    /// （InteractionEconomy.md §3/§4）。
    #[serde(default = "default_tier_growth_factor")]
    pub tier_growth_factor: u64,
    pub click_coins_base: u64,
    pub click_coins_per_level: u64,
    pub click_exp_base: u64,
    /// 账号级每日有效点击上限（唯一的经验/金币水龙头总闸）。
    pub daily_click_cap: u64,
    pub stamina_max: i64,
    pub stamina_per_click: i64,
    /// 1 阶每回复 1 点精力所需秒数（实际按阶 ×tier_factor）。
    pub stamina_regen_seconds_base: i64,
    pub wake_threshold: i64,
    pub tick_seconds: u64,
    /// 1 阶每 1 点精力需要的按键数（实际按阶 ×tier_factor）。
    pub keys_per_stamina_base: u64,
    /// 键盘充能的计数限速（次/秒，防宏）。
    pub key_rate_cap_per_sec: u64,
    /// 每 1 点经验需要的加权 Token 单位数，**按阶数组**（索引 = 阶−1，越界回退末项）。
    /// **按阶递减**（2026-07-21 调整）：`level_exp_factor` 是 ×10/阶暴涨，若用扁平率，
    /// 「吃 Token 满级」所需单位从 T1→T6 天然膨胀 ~11 万×——低阶几分钟满级、高阶几十天，
    /// 完全断层。递减率把该倍率压回约 1000×（T6 满级 ≈1 亿单位 ≈ 中度 1000 万/天 × 10 天），
    /// 满级绝对单位仍随阶单调递增。取率走 `tokens_per_exp_for`。
    pub tokens_per_exp: Vec<u64>,
    /// Token 四分喂养权重（用户 2026-07-20 决策）：每类 token 折算成喂养单位时
    /// 的乘率。四分先各自 ×权重求和，再按 `tokens_per_exp` 折成经验。
    /// serde default 保证旧 config.json 缺字段时仍取规定比例。
    #[serde(default)]
    pub token_feed_weights: TokenFeedWeights,
    pub level_exp_factor: Vec<u64>,
    pub max_level: Vec<u32>,
    pub fusion_fee: u64,
    /// 融合掷骰走 AI 生成的概率（0~1，全局默认）。
    #[serde(default = "default_ai_fusion_chance")]
    pub ai_fusion_chance: f64,
    /// 按配方（fusionTable 排序键）覆盖 AI 概率，将来逐配方调整用。
    #[serde(default)]
    pub ai_fusion_chance_by_recipe: BTreeMap<String, f64>,
    pub hatchery_slots: Vec<u8>,
    pub hatchery_upgrade_costs: Vec<u64>,
    pub yard_capacity: Vec<u8>,
    pub yard_upgrade_costs: Vec<u64>,
    pub release_refund_rate: f64,
    pub release_refund_per_level: u64,
    pub elements: BTreeMap<String, ElementInfo>,
    pub species: BTreeMap<String, SpeciesInfo>,
    pub fusion_table: BTreeMap<String, String>,
    // ---- 融合 2.0（FusionSystem.md / FusionRecipeSlots.md）----
    /// 配方键（元素集合并集，`element_set_key`）→ 0 号固定物种 codename。63 键全覆盖。
    #[serde(default)]
    pub species_by_recipe: BTreeMap<String, String>,
    /// 按亲代阶数的融合费（索引 = 亲代阶数 − 1，1~6 阶）。
    #[serde(default)]
    pub fusion_fees: Vec<u64>,
    /// 融合等效蛋价加成（放生返还用，取代旧 `tier2_egg_price_bonus`）。
    #[serde(default)]
    pub fusion_egg_price_bonus: u64,
    /// 触发 AI 变种的总概率（key = 元素数字符串 "2".."6" → 概率 0~1）。
    /// FusionRecipeSlots.md §3.2：2/3/4/5/6 元素 = 0.60/0.40/0.20/0.10/0.05。
    #[serde(default)]
    pub ai_total_chance_by_element_count: BTreeMap<String, f64>,
    // ---- 经济纵深（EconomyScaling.md）----
    /// 分阶蛋价乘数：T 阶蛋价 = 1 阶基价 × 此值^(阶−1)（默认 15）。
    #[serde(default = "default_egg_tier_price_multiplier")]
    pub egg_tier_price_multiplier: u64,
    /// 商店最高等级 = 可售最高蛋阶（默认 4；5~6 阶纯融合专属）。
    #[serde(default = "default_shop_max_level")]
    pub shop_max_level: u8,
    /// 商店升级费（索引 = 当前 shop_level − 1；Lv1→2 / 2→3 / 3→4）。
    #[serde(default)]
    pub shop_upgrade_costs: Vec<u64>,
    /// 蛋池元素数稀有度衰减分母：整数权重 w(c)=denom^(6−c)（denom=3 → falloff 1/3，
    /// c1..6 = 243/81/27/9/3/1）。定点权重避免浮点漂移（EconomyScaling.md §7.2）。
    #[serde(default = "default_egg_rarity_falloff_denom")]
    pub egg_rarity_falloff_denom: u64,
    /// 每日蛋产出上限：索引 = 蛋阶 − 1（生产值 1~4 阶 = [10,8,6,3]，全 ≤10 = Steam
    /// `drop_max_per_window` 硬上限）。达上限拒绝购买孵化 + Steam 24h 窗口封顶（EconomyScaling.md
    /// §7.5）。超出数组的阶 = 无上限。
    #[serde(default = "default_egg_daily_mint_caps")]
    pub egg_daily_mint_caps: Vec<u32>,
    /// 每日融合上限：索引 = 结果配方元素数 − 1（生产值 [5,5,2,2,1,1]）。按配方键计数、
    /// 达上限拒绝融合（EconomyScaling.md §7.5；客户端 pacing——exchange 无窗口机制，
    /// 服务器安全性来自材料真实消耗净 −1 + 上游水龙头窗口封顶）。超出数组 = 无上限。
    #[serde(default = "default_fusion_daily_mint_caps")]
    pub fusion_daily_mint_caps: Vec<u32>,
}

impl GameConfig {
    /// Exp needed to go from level n to n+1 for a pet of the given tier.
    pub fn exp_to_next(&self, tier: u8, level: u32) -> u64 {
        let factor = self
            .level_exp_factor
            .get((tier as usize).saturating_sub(1))
            .copied()
            .unwrap_or(10);
        factor * level as u64
    }

    pub fn max_level_for_tier(&self, tier: u8) -> u32 {
        self.max_level
            .get((tier as usize).saturating_sub(1))
            .copied()
            .unwrap_or(10)
    }

    /// 阶系数：tier_growth_factor^(tier−1)（tier 0/1 → 1）。
    pub fn tier_factor(&self, tier: u8) -> u64 {
        self.tier_growth_factor
            .max(1)
            .saturating_pow(u32::from(tier.saturating_sub(1)))
    }

    /// 每回复 1 点精力所需秒数（按阶放大；1 阶 3s → 10 分钟回满一管 200）。
    pub fn stamina_regen_seconds_for(&self, tier: u8) -> i64 {
        let factor = i64::try_from(self.tier_factor(tier)).unwrap_or(i64::MAX);
        self.stamina_regen_seconds_base.max(1).saturating_mul(factor)
    }

    /// 每 1 点精力需要的按键数（按阶放大；只喂陪伴宠，1 阶 1 键/点）。
    pub fn keys_per_stamina_for(&self, tier: u8) -> u64 {
        self.keys_per_stamina_base.max(1).saturating_mul(self.tier_factor(tier))
    }

    /// Exp for one work click: clickExpBase × 阶系数。
    pub fn click_exp_for(&self, tier: u8) -> u64 {
        self.click_exp_base.saturating_mul(self.tier_factor(tier))
    }

    /// 该阶每 1 点经验所需的加权 Token 单位（`tokens_per_exp` 按阶取值，索引 = 阶−1；
    /// 越界回退末项，空数组回退 40；下限钳 1）。按阶递减，见字段文档。
    pub fn tokens_per_exp_for(&self, tier: u8) -> u64 {
        self.tokens_per_exp
            .get((tier as usize).saturating_sub(1))
            .copied()
            .or_else(|| self.tokens_per_exp.last().copied())
            .unwrap_or(40)
            .max(1)
    }

    /// Coins for one work click: (base + perLevel × level) × 阶系数。
    /// v1.1 起金币只此一个水龙头，无软上限（额度闸在 daily_click_cap）。
    pub fn click_coins_for(&self, tier: u8, level: u32) -> u64 {
        (self.click_coins_base + self.click_coins_per_level.saturating_mul(level as u64))
            .saturating_mul(self.tier_factor(tier))
    }

    /// Base species for a tier-1 egg of an element.
    pub fn base_species_for_element(&self, element: &str) -> Option<String> {
        self.species
            .iter()
            .find(|(_, info)| info.tier == 1 && info.elements.first().map(String::as_str) == Some(element))
            .map(|(codename, _)| codename.clone())
    }

    /// Fusion result species for two primary elements (order-insensitive).
    /// 主链路现在走 fusion_recipe_key + fusion_table 直查；保留此便捷方法
    /// 与 TS 侧 config.ts::fusionResult 对称（配置一致性测试在用）。
    #[allow(dead_code)]
    pub fn fusion_result(&self, element_a: &str, element_b: &str) -> Option<String> {
        self.fusion_table.get(&fusion_recipe_key(element_a, element_b)).cloned()
    }

    /// 配方（元素集合）→ 0 号固定物种 codename（`speciesByRecipe`，63 键全覆盖）。
    /// 元素先经 `element_set_key` 去重排序，故双亲并集/单物种都能查。
    pub fn species_codename_for_set(&self, elements: &[String]) -> Option<&String> {
        self.species_by_recipe
            .get(&crate::fusion_slots::element_set_key(elements))
    }

    /// 按亲代阶数的融合费（索引 = 亲代阶数 − 1；越界回退末项，再回退旧 `fusion_fee`）。
    pub fn fusion_fee_for(&self, parent_tier: u8) -> u64 {
        self.fusion_fees
            .get((parent_tier as usize).saturating_sub(1))
            .copied()
            .or_else(|| self.fusion_fees.last().copied())
            .unwrap_or(self.fusion_fee)
    }

    /// 触发 AI 变种的总概率（百分数整数），按配方元素数查表（config 权威，
    /// 缺项回退 `fusion_slots` 硬编码表）。FusionRecipeSlots.md §3.2。
    pub fn ai_total_chance_percent_for_count(&self, element_count: usize) -> u64 {
        self.ai_total_chance_by_element_count
            .get(&element_count.to_string())
            .map(|p| (p.clamp(0.0, 1.0) * 100.0).round() as u64)
            .unwrap_or_else(|| crate::fusion_slots::ai_total_chance_percent(element_count))
    }

    /// 该配方掷骰走 AI 生成的概率（有按配方覆盖用覆盖，否则全局默认）。
    pub fn ai_fusion_chance_for(&self, recipe_key: &str) -> f64 {
        self.ai_fusion_chance_by_recipe
            .get(recipe_key)
            .copied()
            .unwrap_or(self.ai_fusion_chance)
            .clamp(0.0, 1.0)
    }

    /// 单颗「T 阶 · E 属性」蛋价 = 该属性 1 阶基价 × eggTierPriceMultiplier^(阶−1)
    /// （EconomyScaling.md §6.2；结果天然取整）。
    pub fn egg_price_for(&self, element: &str, tier: u8) -> u64 {
        let base = self.egg_prices.get(element).copied().unwrap_or(0);
        base.saturating_mul(
            self.egg_tier_price_multiplier
                .max(1)
                .saturating_pow(u32::from(tier.saturating_sub(1))),
        )
    }

    /// 放生返还用的等效蛋价（EconomyScaling.md §8，乘法口径）：
    /// (Σ 各元素 1 阶基价) × eggTierPriceMultiplier^(实例阶−1)。按**实例阶** `tier`
    /// 缩放（取代旧 tier2_egg_price_bonus 加法项），故新物种（species.tier==0）也精确。
    pub fn equivalent_egg_price(&self, species: &SpeciesInfo, tier: u8) -> u64 {
        self.equivalent_egg_price_for_elements(&species.elements, tier)
    }

    /// 元素集合直算版（同一口径）：物种资料缺失、只能从确定性 codename 反解出
    /// 配方元素时用（Steam 侧导入的未注册 AI 变种放生兜底）。
    pub fn equivalent_egg_price_for_elements(&self, elements: &[String], tier: u8) -> u64 {
        let base_sum: u64 = elements
            .iter()
            .map(|e| self.egg_prices.get(e).copied().unwrap_or(0))
            .sum();
        base_sum.saturating_mul(
            self.egg_tier_price_multiplier
                .max(1)
                .saturating_pow(u32::from(tier.max(1) - 1)),
        )
    }

    /// 商店最高等级（= 可售最高蛋阶，封顶）。
    pub fn shop_max_level(&self) -> u8 {
        self.shop_max_level.max(1)
    }

    /// 从 shop_level 升到 shop_level+1 的费用（索引 = shop_level − 1；已满级返回 None）。
    pub fn shop_upgrade_cost(&self, shop_level: u8) -> Option<u64> {
        if shop_level >= self.shop_max_level() {
            return None;
        }
        self.shop_upgrade_costs
            .get((shop_level as usize).saturating_sub(1))
            .copied()
    }

    /// 蛋池按元素数的整数权重 w(c)=falloffDenom^(6−c)（EconomyScaling.md §7.2）。
    /// 元素越多权重越小（denom=3 → c1..6 = 243/81/27/9/3/1，falloff=1/3）。
    pub fn egg_rarity_weight(&self, element_count: usize) -> u64 {
        let denom = self.egg_rarity_falloff_denom.max(1);
        let exp = 6u32.saturating_sub(element_count.min(6) as u32);
        denom.saturating_pow(exp)
    }

    /// 该阶蛋的每日产出上限（EconomyScaling.md §7.5）；超出配置数组的阶 = 无上限。
    pub fn egg_daily_mint_cap(&self, tier: u8) -> u32 {
        self.egg_daily_mint_caps
            .get((tier as usize).saturating_sub(1))
            .copied()
            .unwrap_or(u32::MAX)
    }

    /// 该配方（按结果元素数）的每日融合上限（EconomyScaling.md §7.5）；越界 = 无上限。
    pub fn fusion_daily_mint_cap(&self, element_count: usize) -> u32 {
        self.fusion_daily_mint_caps
            .get(element_count.saturating_sub(1))
            .copied()
            .unwrap_or(u32::MAX)
    }

    pub fn hatchery_slot_count(&self, hatchery_level: u8) -> u8 {
        self.hatchery_slots
            .get((hatchery_level as usize).saturating_sub(1))
            .copied()
            .unwrap_or(1)
    }

    pub fn yard_capacity_for(&self, yard_level: u8) -> u8 {
        self.yard_capacity
            .get((yard_level as usize).saturating_sub(1))
            .copied()
            .unwrap_or(3)
    }
}

fn default_ai_fusion_chance() -> f64 {
    0.5
}

fn default_tier_growth_factor() -> u64 {
    5
}

fn default_egg_tier_price_multiplier() -> u64 {
    15
}

fn default_shop_max_level() -> u8 {
    4
}

fn default_egg_rarity_falloff_denom() -> u64 {
    3
}

fn default_egg_daily_mint_caps() -> Vec<u32> {
    vec![10, 8, 6, 3]
}

fn default_fusion_daily_mint_caps() -> Vec<u32> {
    vec![5, 5, 2, 2, 1, 1]
}

// ---------------------------------------------------------------------------
// Steam itemdef 编号规则（详见 plans/steam_trade/00-decisions.md，不可回改）：
// 一阶宠物 = 101..106（固定元素序）；二阶宠物 = 201..221（fusionTable 键字典序）；
// 二阶蛋 = 宠物 + 100；二阶孵化生成器 = 蛋 + 200；一阶掉落生成器 = 宠物 + 300。
// ---------------------------------------------------------------------------

/// 二阶蛋 itemdefid（相对宠物 def 的偏移）。
pub const STEAM_EGG_DEF_OFFSET: u32 = 100;
/// 二阶孵化生成器 itemdefid（相对蛋 def 的偏移）。
pub const STEAM_HATCH_GEN_OFFSET: u32 = 200;
/// 一阶掉落生成器 itemdefid（相对宠物 def 的偏移）。
#[allow(dead_code)] // 编号规则文档化常量：生成脚本(JS)按同规则产 401..406。
pub const STEAM_DROP_GEN_OFFSET: u32 = 300;

impl GameConfig {
    /// 目录物种 → Steam 宠物 itemdefid（未映射/自定义物种返回 None）。
    pub fn steam_def_for_species(&self, species: &str) -> Option<u32> {
        self.species
            .get(species)
            .map(|s| s.steam_item_def)
            .filter(|def| *def > 0)
    }

    /// Steam 宠物 itemdefid → 目录物种（codename, info）。
    pub fn species_for_steam_def(&self, def: u32) -> Option<(&String, &SpeciesInfo)> {
        if def == 0 {
            return None;
        }
        self.species.iter().find(|(_, s)| s.steam_item_def == def)
    }
}

/// fusionTable 的排序键（无序对 → "a+b"）。
pub fn fusion_recipe_key(element_a: &str, element_b: &str) -> String {
    let mut pair = [element_a, element_b];
    pair.sort_unstable();
    format!("{}+{}", pair[0], pair[1])
}

pub fn is_test_mode() -> bool {
    std::env::var("GULUGULU_TEST_CONFIG")
        .map(|value| value == "1" || value.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
}

pub fn load_game_config() -> GameConfig {
    let raw = if is_test_mode() { TEST_CONFIG_JSON } else { NORMAL_CONFIG_JSON };
    serde_json::from_str(raw).expect("game config JSON is invalid")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn both_configs_parse() {
        let normal: GameConfig = serde_json::from_str(NORMAL_CONFIG_JSON).expect("normal config");
        let test: GameConfig = serde_json::from_str(TEST_CONFIG_JSON).expect("test config");
        for config in [&normal, &test] {
            // v1.1 交互经济不变量：满管必须能整点消耗、唤醒线在管内、额度为正。
            assert!(config.stamina_per_click >= 1);
            assert_eq!(config.stamina_max % config.stamina_per_click, 0);
            assert!(config.wake_threshold <= config.stamina_max);
            assert!(config.daily_click_cap > 0);
            assert!(config.tier_growth_factor >= 1);
            assert!(config.key_rate_cap_per_sec >= 1);
            assert!(!config.tokens_per_exp.is_empty() && config.tokens_per_exp.iter().all(|&r| r >= 1));
            assert_eq!(config.fusion_table.len(), 21, "legacy fusion table still 21 combos");
            assert_eq!(
                config.species.values().filter(|s| s.tier == 1).count(),
                6,
                "six base species"
            );
            assert_eq!(
                config.species.values().filter(|s| s.tier == 2).count(),
                21,
                "twenty-one legacy fused species (tier 2, kept for migration)"
            );

            // 融合 2.0：speciesByRecipe 63 键全覆盖，每值是已注册物种。
            assert_eq!(config.species_by_recipe.len(), 63, "speciesByRecipe must cover 63 recipes");
            for (recipe, codename) in &config.species_by_recipe {
                assert!(
                    config.species.contains_key(codename),
                    "speciesByRecipe[{recipe}] -> unknown species {codename}"
                );
                // 键就是其物种元素集合的规范键（自洽）。
                let info = &config.species[codename];
                assert_eq!(
                    crate::fusion_slots::element_set_key(&info.elements),
                    *recipe,
                    "recipe key must equal element_set_key of its species"
                );
            }
            // 6 单元素 + 57 多元素，元素数直方图 6/15/20/15/6/1。
            let mut hist = [0usize; 7];
            for recipe in config.species_by_recipe.keys() {
                let n = recipe.split('+').count();
                hist[n] += 1;
            }
            assert_eq!(&hist[1..=6], &[6, 15, 20, 15, 6, 1], "recipe element-count histogram");
            // fusionFees 6 项，aiTotalChance 覆盖 2..6 元素。
            assert_eq!(config.fusion_fees.len(), 6, "fusionFees 六阶");
            for n in 2..=6usize {
                assert!(config.ai_total_chance_by_element_count.contains_key(&n.to_string()));
            }
            assert_eq!(config.max_level.len(), 6, "maxLevel 扩到 6 阶");
            assert_eq!(config.level_exp_factor.len(), 6, "levelExpFactor 扩到 6 阶");
            for t in ["tier3", "tier4", "tier5", "tier6"] {
                assert!(config.hatch_seconds.contains_key(t), "hatchSeconds 缺 {t}");
            }
            // Every fusion result exists in the species table, and every element
            // pair (with repetition) resolves to a result.
            for result in config.fusion_table.values() {
                assert!(config.species.contains_key(result), "unknown fusion result {result}");
            }
            let elements: Vec<&String> = config.elements.keys().collect();
            for (i, a) in elements.iter().enumerate() {
                for b in elements.iter().skip(i) {
                    assert!(
                        config.fusion_result(a, b).is_some(),
                        "missing fusion combo {a}+{b}"
                    );
                }
            }
            for element in config.elements.keys() {
                assert!(
                    config.base_species_for_element(element).is_some(),
                    "missing base species for {element}"
                );
                assert!(config.egg_prices.contains_key(element));
                assert!(config.hatch_seconds.contains_key(element));
            }
        }
    }

    /// Steam itemdefid 编号规则（00-decisions.md，一经上传不可回改）：
    /// 一阶 = 固定元素序 101..106；二阶 = fusionTable 键字典序 201..221；全局唯一。
    #[test]
    fn steam_item_defs_follow_frozen_numbering() {
        let normal: GameConfig = serde_json::from_str(NORMAL_CONFIG_JSON).unwrap();
        let test: GameConfig = serde_json::from_str(TEST_CONFIG_JSON).unwrap();
        const ELEMENT_ORDER: [&str; 6] = ["normal", "fire", "electric", "water", "grass", "ice"];
        for config in [&normal, &test] {
            // 一阶：固定元素序 101..106。
            for (i, element) in ELEMENT_ORDER.iter().enumerate() {
                let species = config.base_species_for_element(element).unwrap();
                assert_eq!(
                    config.species[&species].steam_item_def,
                    101 + i as u32,
                    "tier-1 {species} ({element})"
                );
            }
            // 二阶：fusionTable 键字典序 201..221。
            let mut keys: Vec<&String> = config.fusion_table.keys().collect();
            keys.sort();
            for (i, key) in keys.iter().enumerate() {
                let species = &config.fusion_table[*key];
                assert_eq!(
                    config.species[species].steam_item_def,
                    201 + i as u32,
                    "tier-2 {species} ({key})"
                );
            }
            // 融合 2.0：57 新多元素固定物种 = 601 + recipeOrdinal（按 元素数升序,键字典序；
            // FusionSystem.md §9：2 元素 601-615 / 3 元素 616-635 / 4 元素 636-650 /
            // 5 元素 651-656 / 6 元素 657）。序号真源 = fusion_slots 身份函数。
            let recipe_keys: Vec<String> = config.species_by_recipe.keys().cloned().collect();
            let ordered = crate::fusion_slots::multi_element_recipes_ordered(&recipe_keys);
            assert_eq!(ordered.len(), 57, "57 个多元素配方");
            for (ord, recipe) in ordered.iter().enumerate() {
                let codename = &config.species_by_recipe[recipe];
                assert_eq!(
                    config.species[codename].steam_item_def,
                    crate::fusion_slots::fixed_item_def(ord),
                    "多元素固定物种 {codename}（{recipe}）应为 {}",
                    601 + ord
                );
            }

            // 全局唯一 + 双向查询一致（84 物种全部已同步 Steam，无 def==0）。
            let mut seen = std::collections::BTreeSet::new();
            for (codename, info) in &config.species {
                assert_ne!(info.steam_item_def, 0, "{codename} 应已映射 Steam itemdef");
                assert!(seen.insert(info.steam_item_def), "duplicate def {}", info.steam_item_def);
                assert_eq!(
                    config.steam_def_for_species(codename),
                    Some(info.steam_item_def)
                );
                assert_eq!(
                    config.species_for_steam_def(info.steam_item_def).map(|(c, _)| c.as_str()),
                    Some(codename.as_str())
                );
            }
        }
        // 两份配置映射必须完全一致。
        for (codename, info) in &normal.species {
            assert_eq!(
                info.steam_item_def, test.species[codename].steam_item_def,
                "config.json 与 config.test.json 的 {codename} 编号不一致"
            );
        }
    }

    #[test]
    fn tier_scaled_economy_matches_gdd_examples() {
        let config: GameConfig = serde_json::from_str(NORMAL_CONFIG_JSON).unwrap();
        // 阶系数 5^(tier−1)。
        assert_eq!(config.tier_factor(1), 1);
        assert_eq!(config.tier_factor(2), 5);
        assert_eq!(config.tier_factor(3), 25);
        // 金币 = (1 + 等级) × 阶系数（EconomyScaling v1.2 收益减半：1 阶满级 11/击，
        // 日产出 D1=2750 … D6=4766 万；100 点击/管精力不变）。
        assert_eq!(config.click_coins_for(1, 1), 2);
        assert_eq!(config.click_coins_for(1, 10), 11);
        assert_eq!(config.click_coins_for(2, 1), 10);
        assert_eq!(config.click_coins_for(2, 20), 105);
        // 经验 = 4 × 阶系数。
        assert_eq!(config.click_exp_for(1), 4);
        assert_eq!(config.click_exp_for(2), 20);
        // 恢复两途径（2026-07-21 起）：挂机全员 + 键盘只喂陪伴宠（1 阶回满：10 分钟 / 200 键；2 阶 ×5）。
        assert_eq!(config.stamina_regen_seconds_for(1), 3);
        assert_eq!(config.stamina_regen_seconds_for(2), 15);
        assert_eq!(config.keys_per_stamina_for(1), 1);
        assert_eq!(config.keys_per_stamina_for(2), 5);
        assert_eq!(config.stamina_regen_seconds_for(1) * config.stamina_max, 600);
        // Token → 经验：按阶递减率（2026-07-21 调整）。levelExpFactor ×10/阶 会让扁平率下
        // 「吃 Token 满级」单位从 T1→T6 天然膨胀 ~11 万×，递减率把它压回约 1000×。
        assert_eq!(config.tokens_per_exp, vec![555, 210, 80, 35, 15, 5]);
        assert_eq!(config.tokens_per_exp_for(1), 555);
        assert_eq!(config.tokens_per_exp_for(6), 5);
        assert_eq!(config.tokens_per_exp_for(7), 5, "越界阶回退末项");
        // 各阶满级所需加权 Token 单位 = 满级总经验 × 该阶率；验 T6/T1 倍率 ≈1000× 且单调递增。
        let units_to_max = |tier: u8| -> u64 {
            let level = u64::from(config.max_level_for_tier(tier));
            let total_exp = config.level_exp_factor[usize::from(tier) - 1] * (level - 1) * level / 2;
            total_exp * config.tokens_per_exp_for(tier)
        };
        let ladder: Vec<u64> = (1..=6).map(units_to_max).collect();
        // T6 ≈1 亿单位（中度 1000 万加权/天 ≈ 10 天满级；重度 1 亿/天 ≈ 1 天）。
        assert_eq!(ladder, vec![99_900, 399_000, 1_566_000, 6_825_000, 29_400_000, 99_562_500]);
        let ratio = ladder[5] as f64 / ladder[0] as f64;
        assert!((900.0..=1100.0).contains(&ratio), "T6/T1 满级单位倍率 {ratio:.0}× 应≈1000×");
        for w in ladder.windows(2) {
            assert!(w[1] > w[0], "满级单位应随阶单调递增：{ladder:?}");
        }
    }

    /// 升级曲线的**设计意图**锚点（EconomyScaling.md v1.3 §2.1）：把「Lv1 → 满级要点几下」
    /// 钉成一条 ×2 阶梯 45/95/196/390/784/1593（目标 50/100/200/400/800/1600）。
    /// `levelExpFactor` 是反解出来的从属量，不是设计输入——旧值 `[5,50,…]` 首步 ×10、其余 ×5，
    /// 造成 1→2 阶 8.3× 断层（二阶点满要 475 击 = 半天全额度），本测试防止再漂回去。
    #[test]
    fn level_curve_click_ladder_doubles_per_tier() {
        let config: GameConfig = serde_json::from_str(NORMAL_CONFIG_JSON).unwrap();
        // 点满一只 T 阶宠所需点击 = ⌈factor × (L−1)L/2 ÷ (clickExpBase × 5^(T−1))⌉。
        let clicks_to_max = |tier: u8| -> u64 {
            let level = u64::from(config.max_level_for_tier(tier));
            let total_exp = config.level_exp_factor[usize::from(tier) - 1] * (level - 1) * level / 2;
            total_exp.div_ceil(config.click_exp_for(tier))
        };
        let ladder: Vec<u64> = (1..=6).map(clicks_to_max).collect();
        assert_eq!(ladder, vec![45, 95, 196, 390, 784, 1593], "满级点击阶梯");
        // 每一阶都必须落在「上一阶 ×2」的 ±10% 内——断层是本次重调要根治的问题。
        for pair in ladder.windows(2) {
            let ratio = pair[1] as f64 / pair[0] as f64;
            assert!((1.8..=2.2).contains(&ratio), "阶梯断层：{pair:?} 比值 {ratio:.2}×");
        }
        // 逐击验证与 gain_exp 的实际行为一致（div_ceil 只是闭式，真源是循环）。
        for tier in 1..=6u8 {
            let mut pet = crate::game::PetInstance {
                id: "t".into(), species: "guluduck".into(), tier, level: 1, exp: 0,
                stamina: 0, stamina_updated_at: 0, exhausted: false,
                key_buffer: 0, token_buffer: 0, steam_item_id: None, steam_item_def: None,
            };
            let mut clicks = 0u64;
            while pet.level < config.max_level_for_tier(tier) {
                crate::game::gain_exp(&config, &mut pet, config.click_exp_for(tier));
                clicks += 1;
            }
            assert_eq!(clicks, ladder[usize::from(tier) - 1], "{tier} 阶逐击点满");
        }
    }

    #[test]
    fn fusion_two_zero_accessors() {
        let config: GameConfig = serde_json::from_str(NORMAL_CONFIG_JSON).unwrap();
        // 配方 → 0 号固定物种（并集/单物种/乱序都能查）。
        assert_eq!(
            config.species_codename_for_set(&["water".into(), "fire".into()]).map(String::as_str),
            Some("steamalotl")
        );
        assert_eq!(
            config.species_codename_for_set(&["fire".into()]).map(String::as_str),
            Some("emberfox")
        );
        assert_eq!(
            config
                .species_codename_for_set(&[
                    "water".into(), "normal".into(), "ice".into(), "grass".into(),
                    "fire".into(), "electric".into(),
                ])
                .map(String::as_str),
            Some("prismkirin")
        );
        // 按亲代阶数融合费（EconomyScaling.md v1.3 §5：×20 阶梯 base1500，末档 5→6 单独 ×10
        // 降到 1.2 亿 —— 升级曲线砍到 1/5 后升级期顺带收入同步缩水，2.4 亿会把登顶拖到 33 天）。
        assert_eq!(config.fusion_fee_for(1), 1000);
        assert_eq!(config.fusion_fee_for(5), 120_000_000);
        assert_eq!(config.fusion_fee_for(6), 2_400_000_000); // 越界钳到末项（守卫值，永不计费）
        // AI 总概率按元素数（FusionRecipeSlots §3.2）。
        assert_eq!(config.ai_total_chance_percent_for_count(2), 60);
        assert_eq!(config.ai_total_chance_percent_for_count(3), 40);
        assert_eq!(config.ai_total_chance_percent_for_count(6), 5);
        assert_eq!(config.ai_total_chance_percent_for_count(1), 0); // 单元素无 AI
        // 新物种无自带 tier、华丽度看元素数。
        assert_eq!(config.species["steamalotl"].tier, 0);
        assert_eq!(config.species["steamalotl"].element_count(), 2);
        assert_eq!(config.species["prismkirin"].element_count(), 6);
    }

    #[test]
    fn economy_scaling_config_and_accessors() {
        let normal: GameConfig = serde_json::from_str(NORMAL_CONFIG_JSON).unwrap();
        let test: GameConfig = serde_json::from_str(TEST_CONFIG_JSON).unwrap();
        for config in [&normal, &test] {
            // 孵化屋 8 槽（7 次升级）；后院 3 起、每级 +1。
            assert_eq!(config.hatchery_slots.len(), 8, "孵化屋 8 槽");
            assert_eq!(config.hatchery_slots, (1..=8).collect::<Vec<u8>>());
            assert_eq!(config.hatchery_upgrade_costs.len(), 7);
            assert_eq!(config.yard_capacity_for(1), 3, "后院初始 3 格");
            for (i, cap) in config.yard_capacity.iter().enumerate() {
                assert_eq!(*cap as usize, 3 + i, "后院容量每级 +1");
            }
            assert_eq!(config.yard_upgrade_costs.len(), config.yard_capacity.len() - 1);
            // 单调递增（指数水槽）。
            for w in config.hatchery_upgrade_costs.windows(2) {
                assert!(w[1] > w[0], "孵化屋升级费单调递增");
            }
            for w in config.yard_upgrade_costs.windows(2) {
                assert!(w[1] >= w[0], "后院升级费单调不减");
            }
            for w in config.fusion_fees.windows(2) {
                assert!(w[1] > w[0], "融合费单调递增");
            }
            // 商店分阶：升级费 + 封顶。
            assert_eq!(config.shop_max_level(), 4);
            assert_eq!(config.shop_upgrade_costs.len(), 3);
            assert!(config.shop_upgrade_cost(4).is_none(), "已满级无升级费");
            assert_eq!(config.shop_upgrade_cost(1), Some(config.shop_upgrade_costs[0]));
            // 分阶蛋价乘法：1 阶 = 基价；3 阶 = 基价 × mult²。
            let mult = config.egg_tier_price_multiplier;
            let base = *config.egg_prices.get("normal").unwrap();
            assert_eq!(config.egg_price_for("normal", 1), base);
            assert_eq!(config.egg_price_for("normal", 3), base * mult * mult);
            // 蛋池权重：元素越多越小，末档（6 元素）= 1。
            assert!(config.egg_rarity_weight(1) > config.egg_rarity_weight(2));
            assert!(config.egg_rarity_weight(2) > config.egg_rarity_weight(6));
            assert_eq!(config.egg_rarity_weight(6), 1);
        }
        // 正式 config 的 EconomyScaling.md 锚点。
        assert_eq!(normal.egg_price_for("fire", 4), 147_390_000, "4 阶火蛋 = 240×85³");
        assert_eq!(normal.hatchery_upgrade_costs[6], 100_000_000, "第 8 槽 = 1 亿 ≈ D6");
        assert_eq!(*normal.yard_capacity.last().unwrap(), 50, "后院上限 50");
        assert_eq!(normal.shop_upgrade_costs, vec![50_000, 750_000, 11_250_000]);
    }
}
