//! Steam 成就纯判定层（SteamAchievements.md §4.2）。
//!
//! `satisfied_achievements` 是**无副作用、无 Steam 依赖**的纯函数：吃
//! `&GameConfig` + `&GameSave`，返回当前已达成的成就 API Name 全集。上报侧
//! （steam.rs 泵线程）算 `satisfied(after) − 已上报集` 的增量分派解锁，连上 Steam
//! 时用整个集合做一次回填 —— 全靠 `set()` 幂等保证不重复弹窗。判定口径逐条对齐
//! docs/gdd/SteamAchievements.md §8（41 枚）。

use crate::game::*;
use std::collections::BTreeSet;
use tauri::Emitter;

/// 六基础元素的固定物种 codename（config.speciesByRecipe 的单元素键值）。
fn base_element_codenames(config: &GameConfig) -> Vec<&str> {
    ["normal", "fire", "electric", "water", "grass", "ice"]
        .iter()
        .filter_map(|e| config.species_by_recipe.get(*e).map(|c| c.as_str()))
        .collect()
}

/// dex 是否含"元素数 == n 的固定配方物种"（配方键的 '+' 段数即元素数）。
fn dex_has_fixed_with_element_count(config: &GameConfig, save: &GameSave, n: usize) -> bool {
    config.species_by_recipe.iter().any(|(key, codename)| {
        key.split('+').count() == n && save.dex_obtained.contains_key(codename)
    })
}

/// 返回当前存档已达成的成就 ID 全集（幂等）。
pub fn satisfied_achievements(config: &GameConfig, save: &GameSave) -> BTreeSet<&'static str> {
    let mut out: BTreeSet<&'static str> = BTreeSet::new();
    let st = &save.stats;

    // 固定配方物种（63）codename 集合；dexObtained 命中其中 = 图鉴收集，命中之外 = AI 变种。
    let fixed: BTreeSet<&str> = config
        .species_by_recipe
        .values()
        .map(|c| c.as_str())
        .collect();
    let dex_fixed = save
        .dex_obtained
        .keys()
        .filter(|k| fixed.contains(k.as_str()))
        .count();
    let ai_collected = save
        .dex_obtained
        .keys()
        .filter(|k| !fixed.contains(k.as_str()))
        .count();

    // —— A. 起步 ——
    if !save.dex_obtained.is_empty() {
        out.insert("ACH_FIRST_HATCH");
    }
    if st.first_maxlevel_done {
        out.insert("ACH_FIRST_MAXLEVEL");
    }
    if save.tutorial_first_fusion_done {
        out.insert("ACH_FIRST_FUSION");
    }

    // —— B. 图鉴 ——
    if dex_fixed >= 10 {
        out.insert("ACH_DEX_10");
    }
    if dex_fixed >= 25 {
        out.insert("ACH_DEX_25");
    }
    if dex_fixed >= 45 {
        out.insert("ACH_DEX_45");
    }
    if !fixed.is_empty() && dex_fixed >= fixed.len() {
        out.insert("ACH_DEX_ALL63");
    }
    let bases = base_element_codenames(config);
    if bases.len() == 6 && bases.iter().all(|c| save.dex_obtained.contains_key(*c)) {
        out.insert("ACH_ALL_ELEMENTS");
    }
    if dex_has_fixed_with_element_count(config, save, 5) {
        out.insert("ACH_FIRST_PENTA");
    }
    if dex_has_fixed_with_element_count(config, save, 6) {
        out.insert("ACH_FLAGSHIP_KIRIN");
    }

    // —— C. 品阶 ——
    if st.highest_tier >= 3 {
        out.insert("ACH_TIER3");
    }
    if st.highest_tier >= 4 {
        out.insert("ACH_TIER4");
    }
    if st.highest_tier >= 5 {
        out.insert("ACH_TIER5");
    }
    if st.highest_tier >= 6 {
        out.insert("ACH_TIER6_APEX");
    }

    // —— D. 融合 ——
    if st.total_fusions >= 10 {
        out.insert("ACH_FUSE_10");
    }
    if st.total_fusions >= 50 {
        out.insert("ACH_FUSE_50");
    }
    if st.total_fusions >= 200 {
        out.insert("ACH_FUSE_200");
    }

    // —— E. AI 造物 ——
    let ai_generated = save
        .recipe_ai_slots
        .values()
        .any(|v| v.iter().any(|c| !c.is_empty()));
    if ai_generated {
        out.insert("ACH_AI_FIRST");
    }
    if ai_collected >= 5 {
        out.insert("ACH_AI_COLLECT_5");
    }
    if ai_collected >= 20 {
        out.insert("ACH_AI_COLLECT_20");
    }
    let deepest_ladder = save
        .recipe_ai_slots
        .values()
        .map(|v| v.iter().filter(|c| !c.is_empty()).count())
        .max()
        .unwrap_or(0);
    if deepest_ladder >= 5 {
        out.insert("ACH_AI_LADDER_5");
    }

    // —— F. 编码伴侣 ——
    if st.total_tokens_fed >= 1_000_000 {
        out.insert("ACH_TOKENS_1M");
    }
    if st.total_tokens_fed >= 50_000_000 {
        out.insert("ACH_TOKENS_50M");
    }
    if st.total_tokens_fed >= 1_000_000_000 {
        out.insert("ACH_TOKENS_1B");
    }
    if st.total_keys_charged >= 100_000 {
        out.insert("ACH_KEYS_100K");
    }

    // —— G. 经济 · 建设 ——
    if st.total_coins_earned >= 1_000_000 {
        out.insert("ACH_COINS_1M");
    }
    if save.hatchery_level >= config.hatchery_slots.len() as u8 {
        out.insert("ACH_HATCHERY_MAX");
    }
    let yard_cap_max = config.yard_capacity.last().copied().unwrap_or(50);
    if config.yard_capacity_for(save.yard_level) >= yard_cap_max {
        out.insert("ACH_YARD_MAX");
    }
    if save.shop_level >= config.shop_max_level() {
        out.insert("ACH_SHOP_MAX");
    }
    if save.pets.len() >= 20 {
        out.insert("ACH_FULL_HOUSE");
    }

    // —— H. 社区 · 创意工坊 ——
    if save.species_skins.values().any(|v| !v.is_empty()) {
        out.insert("ACH_WORKSHOP_IMPORT");
    }
    if save.skin_selected.values().any(|sel| sel.starts_with("ws:")) {
        out.insert("ACH_WORKSHOP_WEAR");
    }
    let published = save
        .workshop_published
        .values()
        .filter(|f| !f.is_empty())
        .count();
    if published >= 1 {
        out.insert("ACH_WORKSHOP_PUBLISH");
    }
    if published >= 5 {
        out.insert("ACH_WORKSHOP_PUBLISH_5");
    }
    let skins_total: usize = save.species_skins.values().map(|v| v.len()).sum();
    if skins_total >= 5 {
        out.insert("ACH_WORKSHOP_COLLECT_5");
    }

    // —— I. 彩蛋（隐藏）——
    if st.login_streak >= 7 {
        out.insert("ACH_STREAK_7");
    }
    if st.login_streak >= 30 {
        out.insert("ACH_STREAK_30");
    }
    if st.night_owl {
        out.insert("ACH_NIGHT_OWL");
    }
    if st.first_release_done {
        out.insert("ACH_FAREWELL");
    }
    if st.daily_cap_reached_ever {
        out.insert("ACH_LOVED");
    }
    if st.total_coins_earned >= 100_000_000 {
        out.insert("ACH_TREASURY");
    }

    out
}

/// `achievement://unlocked` 事件载荷（前端庆祝：宠物欢呼 + 🏆 toast）。id→显示名的
/// 映射在前端（game/achievements.ts / i18n），Rust 只发 id。
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AchievementUnlock {
    pub id: String,
}

/// 成就上报总入口（每次 with_save 尾部调用；持存档锁下安全——只 emit + fire-and-forget，
/// 不阻塞等 channel）。① 前端庆祝：只弹**新**达成（首个调用播种、不弹；本地/Steam 都弹）；
/// ② Steam：连上后首次全量回填（幂等、不弹），之后仅增量。SteamAchievements.md §4.2/§4.3。
pub(crate) fn report_achievements(app: &AppHandle, config: &GameConfig, save: &GameSave) {
    let Some(steam) = app.try_state::<crate::steam::SharedSteamState>() else {
        return;
    };
    let satisfied = satisfied_achievements(config, save);
    // ① 前端庆祝（新达成才弹；播种批返回空）。
    let new_ids = steam.diff_new_achievements(&satisfied);
    for id in &new_ids {
        let _ = app.emit("achievement://unlocked", AchievementUnlock { id: id.clone() });
    }
    // ② Steam 上报：连上首次全量回填（幂等、不弹）；否则仅增量。
    if let Some(all) = steam.take_achievement_backfill(&satisfied) {
        steam.report_unlocks(all);
    } else if !new_ids.is_empty() {
        steam.report_unlocks(new_ids);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_config() -> GameConfig {
        serde_json::from_str(include_str!("../../../src/game/config.json")).unwrap()
    }

    fn fresh(config: &GameConfig) -> GameSave {
        create_initial_save(config, 0, BTreeMap::new(), 1000, "2026-07-07")
    }

    #[test]
    fn fresh_save_has_no_achievements() {
        let config = test_config();
        let save = fresh(&config);
        // 教学蛋尚未孵化 → dex 空、无统计 → 零成就。
        assert!(satisfied_achievements(&config, &save).is_empty());
    }

    #[test]
    fn first_hatch_and_maxlevel_and_fusion() {
        let config = test_config();
        let mut save = fresh(&config);
        save.dex_obtained.insert("guluduck".into(), 1);
        let got = satisfied_achievements(&config, &save);
        assert!(got.contains("ACH_FIRST_HATCH"));
        assert!(!got.contains("ACH_FIRST_MAXLEVEL"));
        save.stats.first_maxlevel_done = true;
        save.tutorial_first_fusion_done = true;
        let got = satisfied_achievements(&config, &save);
        assert!(got.contains("ACH_FIRST_MAXLEVEL"));
        assert!(got.contains("ACH_FIRST_FUSION"));
    }

    #[test]
    fn dex_tiers_and_full_and_elements() {
        let config = test_config();
        let mut save = fresh(&config);
        let fixed: Vec<String> = config.species_by_recipe.values().cloned().collect();
        // 收集前 10 个固定物种。
        for c in fixed.iter().take(10) {
            save.dex_obtained.insert(c.clone(), 1);
        }
        let got = satisfied_achievements(&config, &save);
        assert!(got.contains("ACH_DEX_10"));
        assert!(!got.contains("ACH_DEX_25"));
        assert!(!got.contains("ACH_DEX_ALL63"));
        // 六基础元素齐。
        for e in ["normal", "fire", "electric", "water", "grass", "ice"] {
            let c = config.species_by_recipe.get(e).unwrap().clone();
            save.dex_obtained.insert(c, 1);
        }
        assert!(satisfied_achievements(&config, &save).contains("ACH_ALL_ELEMENTS"));
        // 全收集 → ALL63 + 五元素 + 旗舰。
        for c in &fixed {
            save.dex_obtained.insert(c.clone(), 1);
        }
        let got = satisfied_achievements(&config, &save);
        assert!(got.contains("ACH_DEX_ALL63"));
        assert!(got.contains("ACH_DEX_45"));
        assert!(got.contains("ACH_FIRST_PENTA"));
        assert!(got.contains("ACH_FLAGSHIP_KIRIN"));
    }

    #[test]
    fn ai_variants_collect_and_ladder() {
        let config = test_config();
        let mut save = fresh(&config);
        // 5 个 AI 变种（非固定键）入 dex + 一条配方 5 槽。
        for i in 0..5 {
            save.dex_obtained.insert(format!("aif99{i:02}"), 1);
        }
        save.recipe_ai_slots.insert(
            "fire+water".into(),
            (0..5).map(|i| format!("aiffw{i}")).collect(),
        );
        let got = satisfied_achievements(&config, &save);
        assert!(got.contains("ACH_AI_FIRST"));
        assert!(got.contains("ACH_AI_COLLECT_5"));
        assert!(!got.contains("ACH_AI_COLLECT_20"));
        assert!(got.contains("ACH_AI_LADDER_5"));
    }

    #[test]
    fn tier_fusion_economy_thresholds() {
        let config = test_config();
        let mut save = fresh(&config);
        save.stats.highest_tier = 5;
        save.stats.total_fusions = 50;
        save.stats.total_coins_earned = 1_000_000;
        save.hatchery_level = config.hatchery_slots.len() as u8;
        save.shop_level = config.shop_max_level();
        save.yard_level = (config.yard_capacity.len() as u8).max(1);
        let got = satisfied_achievements(&config, &save);
        assert!(got.contains("ACH_TIER3"));
        assert!(got.contains("ACH_TIER5"));
        assert!(!got.contains("ACH_TIER6_APEX"));
        assert!(got.contains("ACH_FUSE_10") && got.contains("ACH_FUSE_50"));
        assert!(!got.contains("ACH_FUSE_200"));
        assert!(got.contains("ACH_COINS_1M"));
        assert!(!got.contains("ACH_TREASURY"));
        assert!(got.contains("ACH_HATCHERY_MAX"));
        assert!(got.contains("ACH_SHOP_MAX"));
        assert!(got.contains("ACH_YARD_MAX"));
    }

    #[test]
    fn workshop_and_hidden_flags() {
        let config = test_config();
        let mut save = fresh(&config);
        // 工坊：发布 5 款 + 换上 + 收藏 5 款。
        for i in 0..5 {
            save.workshop_published
                .insert(format!("aif00{i:02}"), format!("111{i}"));
        }
        save.skin_selected.insert("aif0101".into(), "ws:222".into());
        let got = satisfied_achievements(&config, &save);
        assert!(got.contains("ACH_WORKSHOP_PUBLISH"));
        assert!(got.contains("ACH_WORKSHOP_PUBLISH_5"));
        assert!(got.contains("ACH_WORKSHOP_WEAR"));
        // 隐藏组。
        save.stats.login_streak = 7;
        save.stats.night_owl = true;
        save.stats.first_release_done = true;
        save.stats.daily_cap_reached_ever = true;
        let got = satisfied_achievements(&config, &save);
        assert!(got.contains("ACH_STREAK_7"));
        assert!(!got.contains("ACH_STREAK_30"));
        assert!(got.contains("ACH_NIGHT_OWL"));
        assert!(got.contains("ACH_FAREWELL"));
        assert!(got.contains("ACH_LOVED"));
    }

    fn push_pet(save: &mut GameSave, config: &GameConfig, id: &str, tier: u8, level: u32) {
        save.pets.push(PetInstance {
            id: id.into(),
            species: "guluduck".into(),
            tier,
            level,
            exp: 0,
            stamina: config.stamina_max,
            stamina_updated_at: 1000,
            exhausted: false,
            key_buffer: 0,
            token_buffer: 0,
            steam_item_id: None,
            steam_item_def: None,
        });
        if save.active_pet_id.is_none() {
            save.active_pet_id = Some(id.into());
        }
    }

    #[test]
    fn login_stats_accumulate_and_reset_on_gap() {
        let config = test_config();
        let mut save = fresh(&config);
        settle_all(&config, &mut save, 1000, "2026-07-07");
        assert_eq!(save.stats.days_played, 1);
        assert_eq!(save.stats.login_streak, 1);
        settle_all(&config, &mut save, 2000, "2026-07-07"); // 同日：不重复计
        assert_eq!(save.stats.days_played, 1);
        settle_all(&config, &mut save, 90_000, "2026-07-08"); // 次日：streak +1
        assert_eq!(save.stats.login_streak, 2);
        settle_all(&config, &mut save, 300_000, "2026-07-10"); // 断档：归 1
        assert_eq!(save.stats.days_played, 3);
        assert_eq!(save.stats.login_streak, 1);
    }

    #[test]
    fn click_work_accumulates_lifetime_stats() {
        let config = test_config();
        let mut save = fresh(&config);
        push_pet(&mut save, &config, "p1", 1, 1);
        logic_click_work(&config, &mut save, "p1", 1000, "2026-07-07").unwrap();
        assert_eq!(save.stats.total_clicks, 1);
        assert!(save.stats.total_coins_earned > 0);
    }

    #[test]
    fn migrate_v6_to_v7_seeds_high_water_from_pets() {
        let config = test_config();
        let mut save = fresh(&config);
        save.version = 6;
        save.stats = LifetimeStats::default();
        push_pet(&mut save, &config, "p", 4, config.max_level_for_tier(4));
        assert!(migrate_save(&config, &mut save, &BTreeMap::new(), 2000, "2026-07-07"));
        assert_eq!(save.version, 8);
        assert_eq!(save.stats.highest_tier, 4);
        assert!(save.stats.first_maxlevel_done, "满级宠播种 first_maxlevel");
    }
}
