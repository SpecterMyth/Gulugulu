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
    pub tier: u8,
    pub elements: Vec<String>,
    pub colors: Vec<String>,
    pub body: String,
    pub desc: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameConfig {
    pub initial_coins: u64,
    pub historical_exp_coin_cap: u64,
    pub egg_prices: BTreeMap<String, u64>,
    pub tier2_egg_price_bonus: u64,
    pub hatch_seconds: BTreeMap<String, u64>,
    pub click_coins_base: u64,
    pub click_coins_per_level: u64,
    pub click_coins_per_tier: u64,
    pub click_exp: u64,
    pub click_soft_cap1: u64,
    pub click_soft_cap2: u64,
    pub stamina_max: i64,
    pub stamina_per_click: i64,
    pub stamina_regen_seconds: i64,
    pub wake_threshold: i64,
    pub tick_seconds: u64,
    pub main_exp_per_tick: u64,
    pub yard_ticks_per_exp: u64,
    pub coin_ticks_per_coin: u64,
    pub idle_coin_daily_cap: u64,
    pub wander_coin_min: u64,
    pub wander_coin_max: u64,
    pub wander_coin_daily_cap: u64,
    pub token_exp_daily_cap: u64,
    pub overflow_coin_daily_cap: u64,
    pub level_exp_factor: Vec<u64>,
    pub max_level: Vec<u32>,
    pub fusion_fee: u64,
    pub hatchery_slots: Vec<u8>,
    pub hatchery_upgrade_costs: Vec<u64>,
    pub yard_capacity: Vec<u8>,
    pub yard_upgrade_costs: Vec<u64>,
    pub release_refund_rate: f64,
    pub release_refund_per_level: u64,
    pub elements: BTreeMap<String, ElementInfo>,
    pub species: BTreeMap<String, SpeciesInfo>,
    pub fusion_table: BTreeMap<String, String>,
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

    /// Coins for one work click: 1 + level + 10 × (tier − 1), before soft caps.
    pub fn click_coins(&self, tier: u8, level: u32) -> u64 {
        self.click_coins_base
            + self.click_coins_per_level * level as u64
            + self.click_coins_per_tier * (tier as u64).saturating_sub(1)
    }

    /// Base species for a tier-1 egg of an element.
    pub fn base_species_for_element(&self, element: &str) -> Option<String> {
        self.species
            .iter()
            .find(|(_, info)| info.tier == 1 && info.elements.first().map(String::as_str) == Some(element))
            .map(|(codename, _)| codename.clone())
    }

    /// Fusion result species for two primary elements (order-insensitive).
    pub fn fusion_result(&self, element_a: &str, element_b: &str) -> Option<String> {
        let mut pair = [element_a, element_b];
        pair.sort_unstable();
        self.fusion_table.get(&format!("{}+{}", pair[0], pair[1])).cloned()
    }

    /// Equivalent egg price used for release refunds. Tier-2 = both parent egg
    /// prices + fusion bonus; parents are the base eggs of the species' elements
    /// (single-element tier-2 counts its element twice).
    pub fn equivalent_egg_price(&self, species: &SpeciesInfo) -> u64 {
        if species.tier <= 1 {
            let element = species.elements.first().map(String::as_str).unwrap_or("normal");
            return self.egg_prices.get(element).copied().unwrap_or(0);
        }
        let first = species.elements.first().map(String::as_str).unwrap_or("normal");
        let second = species.elements.get(1).map(String::as_str).unwrap_or(first);
        let a = self.egg_prices.get(first).copied().unwrap_or(0);
        let b = self.egg_prices.get(second).copied().unwrap_or(0);
        a + b + self.tier2_egg_price_bonus
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
            assert_eq!(config.fusion_table.len(), 21, "fusion table must cover 21 combos");
            assert_eq!(
                config.species.values().filter(|s| s.tier == 1).count(),
                6,
                "six base species"
            );
            assert_eq!(
                config.species.values().filter(|s| s.tier == 2).count(),
                21,
                "twenty-one fused species"
            );
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

    #[test]
    fn click_coins_match_gdd_examples() {
        let config: GameConfig = serde_json::from_str(NORMAL_CONFIG_JSON).unwrap();
        assert_eq!(config.click_coins(1, 1), 2);
        assert_eq!(config.click_coins(1, 10), 11);
        assert_eq!(config.click_coins(2, 1), 12);
        assert_eq!(config.click_coins(2, 20), 31);
    }
}
