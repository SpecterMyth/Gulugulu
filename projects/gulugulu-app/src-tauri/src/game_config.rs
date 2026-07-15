use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

// Both configs are compiled in; GULUGULU_TEST_CONFIG=1 selects the small-value
// test config at startup (same switch the web preview exposes as ?test=1).
const NORMAL_CONFIG_JSON: &str = include_str!("../../src/game/config.json");
const TEST_CONFIG_JSON: &str = include_str!("../../src/game/config.test.json");

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
    /// 旧模型的物种自带阶数（1=一阶、2=旧二阶）。融合 2.0 起阶数只在实例上，
    /// 57 只新物种不带此字段（default 0 = 无自带阶数，华丽度用 `element_count()`）。
    #[serde(default)]
    pub tier: u8,
    pub elements: Vec<String>,
    pub colors: Vec<String>,
    pub body: String,
    pub desc: String,
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
    /// 1 阶每 1 点精力需要的 token 数（实际按阶 ×tier_factor）。
    pub tokens_per_stamina_base: u64,
    pub wander_snack_stamina_min: i64,
    pub wander_snack_stamina_max: i64,
    pub wander_snack_daily_cap: u64,
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

    /// 每 1 点精力需要的按键数（按阶放大；1 阶 1 键 → 200 键回满）。
    pub fn keys_per_stamina_for(&self, tier: u8) -> u64 {
        self.keys_per_stamina_base.max(1).saturating_mul(self.tier_factor(tier))
    }

    /// 每 1 点精力需要的 token 数（按阶放大；1 阶 10 → 2000 tokens 回满）。
    pub fn tokens_per_stamina_for(&self, tier: u8) -> u64 {
        self.tokens_per_stamina_base.max(1).saturating_mul(self.tier_factor(tier))
    }

    /// Exp for one work click: clickExpBase × 阶系数。
    pub fn click_exp_for(&self, tier: u8) -> u64 {
        self.click_exp_base.saturating_mul(self.tier_factor(tier))
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
        let base_sum: u64 = species
            .elements
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
            assert!(config.wander_snack_stamina_min <= config.wander_snack_stamina_max);
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

            // 全局唯一 + 双向查询一致（84 物种全部已上链，无 def==0）。
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
        // 金币 = (1 + 等级) × 阶系数（InteractionEconomy §4.1）。
        assert_eq!(config.click_coins_for(1, 1), 2);
        assert_eq!(config.click_coins_for(1, 10), 11);
        assert_eq!(config.click_coins_for(2, 1), 10);
        assert_eq!(config.click_coins_for(2, 20), 105);
        // 经验 = 2 × 阶系数。
        assert_eq!(config.click_exp_for(1), 2);
        assert_eq!(config.click_exp_for(2), 10);
        // 恢复三途径（1 阶回满：10 分钟 / 200 键 / 2000 tokens；2 阶 ×5）。
        assert_eq!(config.stamina_regen_seconds_for(1), 3);
        assert_eq!(config.stamina_regen_seconds_for(2), 15);
        assert_eq!(config.keys_per_stamina_for(1), 1);
        assert_eq!(config.keys_per_stamina_for(2), 5);
        // EconomyScaling.md §9：tokensPerStaminaBase 10→8（5000 万 Token/天 = 点满 4 只 ×500 击）。
        assert_eq!(config.tokens_per_stamina_for(1), 8);
        assert_eq!(config.tokens_per_stamina_for(2), 40);
        assert_eq!(config.stamina_regen_seconds_for(1) * config.stamina_max, 600);
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
        // 按亲代阶数融合费（EconomyScaling.md §5：×40 阶梯 base75；5→6 = 1.92 亿 ≈ 2×D6）。
        assert_eq!(config.fusion_fee_for(1), 75);
        assert_eq!(config.fusion_fee_for(5), 192_000_000);
        assert_eq!(config.fusion_fee_for(6), 7_680_000_000); // 越界钳到末项（守卫值，永不计费）
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
        assert_eq!(normal.egg_price_for("fire", 4), 405_000, "4 阶火蛋 = 120×15³");
        assert_eq!(normal.hatchery_upgrade_costs[6], 100_000_000, "第 8 槽 = 1 亿 ≈ D6");
        assert_eq!(*normal.yard_capacity.last().unwrap(), 50, "后院上限 50");
        assert_eq!(normal.shop_upgrade_costs, vec![50_000, 750_000, 11_250_000]);
    }
}
