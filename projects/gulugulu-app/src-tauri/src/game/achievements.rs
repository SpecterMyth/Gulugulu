//! Steam 成就纯判定层（SteamAchievements.md §4.2）。
//!
//! `satisfied_achievements` 是**无副作用、无 Steam 依赖**的纯函数：吃
//! `&GameConfig` + `&GameSave`，返回当前已达成的成就 API Name 全集。上报侧
//! （steam.rs 泵线程）算 `satisfied(after) − 已上报集` 的增量分派解锁，连上 Steam
//! 时用整个集合做一次回填 —— 全靠 `set()` 幂等保证不重复弹窗。判定口径逐条对齐
//! docs/gdd/SteamAchievements.md §8（48 枚，其中工厂 24 枚）。

use crate::game::*;
use std::collections::BTreeSet;
use tauri::Emitter;

/// 基于 2026-07-28 当前 rogueConfig 的 100,000 局“有限叠加”生存条件模拟冻结。
/// Revenue I/II/III 分别锚定约第 5/20/30 班；Mega Pulse 锚定第 30 班。
pub const FACTORY_REVENUE_I: u64 = 1_500;
pub const FACTORY_REVENUE_II: u64 = 1_000_000;
pub const FACTORY_REVENUE_III: u64 = 50_000_000;
pub const FACTORY_BIG_PULSE: u64 = 2_000_000;
pub const FACTORY_ENDLESS_SHIFT: u16 = 30;
pub const FACTORY_REPEAT_RUNS: u32 = 50;
pub const FACTORY_UPGRADE_LEVELS: u16 = 20;
const FACTORY_ALL_INSPECTIONS_MASK: u8 = 0b1111;
pub const FACTORY_ACHIEVEMENT_IDS: [&str; 24] = [
    "ACH_DEX_25",
    "ACH_AI_COLLECT_5",
    "ACH_DEX_45",
    "ACH_TIER4",
    "ACH_TIER5",
    "ACH_HATCHERY_MAX",
    "ACH_YARD_MAX",
    "ACH_TOKENS_50M",
    "ACH_WORKSHOP_COLLECT_5",
    "ACH_ALL_ELEMENTS",
    "ACH_SHOP_MAX",
    "ACH_FULL_HOUSE",
    "ACH_AI_LADDER_5",
    "ACH_WORKSHOP_WEAR",
    "ACH_FUSE_50",
    "ACH_WORKSHOP_PUBLISH_5",
    "ACH_FIRST_PENTA",
    "ACH_FACTORY_CLOCK_IN",
    "ACH_FACTORY_FIRST_PULSE",
    "ACH_FACTORY_ENDLESS_30",
    "ACH_FACTORY_REVENUE_II",
    "ACH_FACTORY_REVENUE_III",
    "ACH_FACTORY_COMBO_10",
    "ACH_FACTORY_DEBT_FREE",
];

const FACTORY_STATS_MAX_RUNS: u32 = 1_000_000;
const FACTORY_STATS_MAX_REVENUE: u64 = 9_007_199_254_740_991;
const FACTORY_STATS_MAX_SHIFT: u16 = 10_000;
const FACTORY_STATS_MAX_COMBO: u32 = 1_000_000;
const FACTORY_STATS_MAX_UPGRADE_LEVELS: u16 = 10_000;
const FACTORY_STATS_MAX_DESKS: u8 = 6;
const FACTORY_STATS_MAX_LOADOUT: u8 = 10;

/// 前端提交的工厂成就绝对快照。所有字段可省略；数值字段是终身绝对计数或单局
/// 历史高水位，后端只取 `max`，重复提交幂等。营收/脉冲使用十进制字符串，避免
/// JavaScript Number 在大数时丢精度。
#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct FactoryRogueAchievementSnapshot {
    pub runs_started: Option<u32>,
    pub runs_finished: Option<u32>,
    pub best_revenue: Option<String>,
    pub best_shift: Option<u16>,
    pub best_pulse: Option<String>,
    pub best_combo: Option<u32>,
    pub best_desks: Option<u8>,
    pub max_upgrade_levels: Option<u16>,
    pub max_loadout: Option<u8>,
    pub first_kpi: Option<bool>,
    pub first_card: Option<bool>,
    pub first_bankruptcy: Option<bool>,
    pub strike_clear: Option<bool>,
    /// 只接受“本局确实通过全部四次检查”的最终事实；不接收部分 mask。
    pub all_inspections_in_one_run: Option<bool>,
    pub graduated: Option<bool>,
    pub graduated_without_loan: Option<bool>,
    /// 仅在局终提交；runs_finished 首次前进时发进通用金币余额。
    pub reward_coins: Option<String>,
}

fn parse_factory_stat_score(field: &str, raw: Option<&str>) -> Result<Option<u64>, String> {
    let Some(raw) = raw else {
        return Ok(None);
    };
    if raw.is_empty() || !raw.bytes().all(|byte| byte.is_ascii_digit()) {
        return Err(format!(
            "#factoryAchievementInvalid|field={field}|reason=integer"
        ));
    }
    let value = raw
        .parse::<u64>()
        .map_err(|_| format!("#factoryAchievementInvalid|field={field}|reason=overflow"))?;
    if value > FACTORY_STATS_MAX_REVENUE {
        return Err(format!(
            "#factoryAchievementInvalid|field={field}|reason=hardCap"
        ));
    }
    Ok(Some(value))
}

/// 把一份绝对快照合并进主存档。数值只升不降、旗标只从 false → true。
/// 返回是否真的改变了统计；命令层仍统一走 `with_save` 做持久化与成就上报。
pub(crate) fn logic_record_factory_rogue_achievement_snapshot(
    save: &mut GameSave,
    snapshot: &FactoryRogueAchievementSnapshot,
) -> Result<bool, String> {
    let best_revenue = parse_factory_stat_score("bestRevenue", snapshot.best_revenue.as_deref())?;
    let best_pulse = parse_factory_stat_score("bestPulse", snapshot.best_pulse.as_deref())?;
    let reward_coins =
        parse_factory_stat_score("rewardCoins", snapshot.reward_coins.as_deref())?.unwrap_or(0);

    if snapshot
        .runs_started
        .is_some_and(|value| value > FACTORY_STATS_MAX_RUNS)
    {
        return Err("#factoryAchievementInvalid|field=runsStarted|reason=hardCap".to_string());
    }
    if snapshot
        .runs_finished
        .is_some_and(|value| value > FACTORY_STATS_MAX_RUNS)
    {
        return Err("#factoryAchievementInvalid|field=runsFinished|reason=hardCap".to_string());
    }
    if snapshot
        .best_shift
        .is_some_and(|value| value > FACTORY_STATS_MAX_SHIFT)
    {
        return Err("#factoryAchievementInvalid|field=bestShift|reason=hardCap".to_string());
    }
    if snapshot
        .best_combo
        .is_some_and(|value| value > FACTORY_STATS_MAX_COMBO)
    {
        return Err("#factoryAchievementInvalid|field=bestCombo|reason=hardCap".to_string());
    }
    if snapshot
        .best_desks
        .is_some_and(|value| value > FACTORY_STATS_MAX_DESKS)
    {
        return Err("#factoryAchievementInvalid|field=bestDesks|reason=hardCap".to_string());
    }
    if snapshot
        .max_upgrade_levels
        .is_some_and(|value| value > FACTORY_STATS_MAX_UPGRADE_LEVELS)
    {
        return Err("#factoryAchievementInvalid|field=maxUpgradeLevels|reason=hardCap".to_string());
    }
    if snapshot
        .max_loadout
        .is_some_and(|value| value > FACTORY_STATS_MAX_LOADOUT)
    {
        return Err("#factoryAchievementInvalid|field=maxLoadout|reason=hardCap".to_string());
    }

    let st = &mut save.stats;
    let next_started = st
        .factory_rogue_runs_started
        .max(snapshot.runs_started.unwrap_or(0));
    let next_finished = st
        .factory_rogue_runs_finished
        .max(snapshot.runs_finished.unwrap_or(0));
    if next_finished > next_started {
        return Err(
            "#factoryAchievementInvalid|field=runsFinished|reason=exceedsStarted".to_string(),
        );
    }

    let debt_free = snapshot.graduated_without_loan.unwrap_or(false);
    let graduated = snapshot.graduated.unwrap_or(false) || debt_free;
    let all_inspections = snapshot.all_inspections_in_one_run.unwrap_or(false);
    let first_kpi = snapshot.first_kpi.unwrap_or(false);
    let first_card = snapshot.first_card.unwrap_or(false);
    let inferred_shift = if graduated || all_inspections {
        20
    } else if first_kpi || first_card {
        1
    } else {
        0
    };
    let next_shift = st
        .factory_rogue_best_shift
        .max(snapshot.best_shift.unwrap_or(0))
        .max(inferred_shift);

    let mut changed = false;
    macro_rules! merge_max {
        ($field:ident, $value:expr) => {{
            let value = $value;
            if value > st.$field {
                st.$field = value;
                changed = true;
            }
        }};
    }
    macro_rules! merge_true {
        ($field:ident, $value:expr) => {
            if $value && !st.$field {
                st.$field = true;
                changed = true;
            }
        };
    }

    merge_max!(factory_rogue_runs_started, next_started);
    merge_max!(factory_rogue_runs_finished, next_finished);
    merge_max!(factory_rogue_best_revenue, best_revenue.unwrap_or_default());
    merge_max!(factory_rogue_best_shift, next_shift);
    merge_max!(factory_rogue_best_pulse, best_pulse.unwrap_or_default());
    merge_max!(
        factory_rogue_best_combo,
        snapshot.best_combo.unwrap_or_default()
    );
    merge_max!(
        factory_rogue_best_desks,
        snapshot.best_desks.unwrap_or_default()
    );
    merge_max!(
        factory_rogue_max_upgrade_levels,
        snapshot.max_upgrade_levels.unwrap_or_default()
    );
    merge_max!(
        factory_rogue_max_loadout,
        snapshot.max_loadout.unwrap_or_default()
    );
    merge_true!(factory_rogue_first_kpi, first_kpi);
    merge_true!(factory_rogue_first_card, first_card);
    merge_true!(
        factory_rogue_first_bankruptcy,
        snapshot.first_bankruptcy.unwrap_or(false)
    );
    merge_true!(
        factory_rogue_strike_clear,
        snapshot.strike_clear.unwrap_or(false)
    );
    if all_inspections && st.factory_rogue_inspection_mask != FACTORY_ALL_INSPECTIONS_MASK {
        st.factory_rogue_inspection_mask = FACTORY_ALL_INSPECTIONS_MASK;
        changed = true;
    }
    merge_true!(factory_rogue_graduated, graduated);
    merge_true!(factory_rogue_graduated_without_loan, debt_free);
    let coin_grant = if reward_coins == 0 {
        0
    } else if next_finished > st.factory_rogue_rewarded_run {
        st.factory_rogue_rewarded_run = next_finished;
        st.factory_rogue_rewarded_revenue = reward_coins;
        reward_coins
    } else if next_finished == st.factory_rogue_rewarded_run
        && reward_coins > st.factory_rogue_rewarded_revenue
    {
        let delta = reward_coins - st.factory_rogue_rewarded_revenue;
        st.factory_rogue_rewarded_revenue = reward_coins;
        delta
    } else {
        0
    };
    if coin_grant > 0 {
        save.coins = save.coins.saturating_add(coin_grant);
        save.daily.coins_earned = save.daily.coins_earned.saturating_add(coin_grant);
        save.stats.total_coins_earned = save.stats.total_coins_earned.saturating_add(coin_grant);
        changed = true;
    }

    Ok(changed)
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
    if !fixed.is_empty() && dex_fixed >= fixed.len() {
        out.insert("ACH_DEX_ALL63");
    }
    if dex_has_fixed_with_element_count(config, save, 6) {
        out.insert("ACH_FLAGSHIP_KIRIN");
    }

    // —— C. 品阶 ——
    if st.highest_tier >= 3 {
        out.insert("ACH_TIER3");
    }
    if st.highest_tier >= 6 {
        out.insert("ACH_TIER6_APEX");
    }

    // —— D. 融合 ——
    if st.total_fusions >= 10 {
        out.insert("ACH_FUSE_10");
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
    if ai_collected >= 20 {
        out.insert("ACH_AI_COLLECT_20");
    }

    // —— F. 编码伴侣 ——
    if st.total_tokens_fed >= 1_000_000 {
        out.insert("ACH_TOKENS_1M");
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
    // —— H. 社区 · 创意工坊 ——
    if save.species_skins.values().any(|v| !v.is_empty()) {
        out.insert("ACH_WORKSHOP_IMPORT");
    }
    let published = save
        .workshop_published
        .values()
        .filter(|f| !f.is_empty())
        .count();
    if published >= 1 {
        out.insert("ACH_WORKSHOP_PUBLISH");
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

    // —— J. 《危楼打工记》（17 枚复用 ID + 7 枚新 ID）——
    if st.factory_rogue_first_kpi {
        out.insert("ACH_DEX_25");
    }
    if st.factory_rogue_first_card {
        out.insert("ACH_AI_COLLECT_5");
    }
    if st.factory_rogue_best_shift >= 5 {
        out.insert("ACH_DEX_45");
    }
    if st.factory_rogue_best_shift >= 10 {
        out.insert("ACH_TIER4");
    }
    if st.factory_rogue_best_shift >= 15 {
        out.insert("ACH_TIER5");
    }
    if st.factory_rogue_graduated || st.factory_rogue_graduated_without_loan {
        out.insert("ACH_HATCHERY_MAX");
    }
    if st.factory_rogue_best_shift >= 25 {
        out.insert("ACH_YARD_MAX");
    }
    if st.factory_rogue_best_revenue >= FACTORY_REVENUE_I {
        out.insert("ACH_TOKENS_50M");
    }
    if st.factory_rogue_best_pulse >= FACTORY_BIG_PULSE {
        out.insert("ACH_WORKSHOP_COLLECT_5");
    }
    if st.factory_rogue_best_desks >= 3 {
        out.insert("ACH_ALL_ELEMENTS");
    }
    if st.factory_rogue_best_desks >= 6 {
        out.insert("ACH_SHOP_MAX");
    }
    if st.factory_rogue_max_loadout >= 10 {
        out.insert("ACH_FULL_HOUSE");
    }
    if st.factory_rogue_max_upgrade_levels >= FACTORY_UPGRADE_LEVELS {
        out.insert("ACH_AI_LADDER_5");
    }
    if st.factory_rogue_strike_clear {
        out.insert("ACH_WORKSHOP_WEAR");
    }
    if st.factory_rogue_runs_finished >= FACTORY_REPEAT_RUNS {
        out.insert("ACH_FUSE_50");
    }
    if st.factory_rogue_first_bankruptcy {
        out.insert("ACH_WORKSHOP_PUBLISH_5");
    }
    if st.factory_rogue_inspection_mask & FACTORY_ALL_INSPECTIONS_MASK
        == FACTORY_ALL_INSPECTIONS_MASK
    {
        out.insert("ACH_FIRST_PENTA");
    }
    if st.factory_rogue_runs_started >= 1 {
        out.insert("ACH_FACTORY_CLOCK_IN");
    }
    if st.factory_rogue_best_pulse >= 1 {
        out.insert("ACH_FACTORY_FIRST_PULSE");
    }
    if st.factory_rogue_best_shift >= FACTORY_ENDLESS_SHIFT {
        out.insert("ACH_FACTORY_ENDLESS_30");
    }
    if st.factory_rogue_best_revenue >= FACTORY_REVENUE_II {
        out.insert("ACH_FACTORY_REVENUE_II");
    }
    if st.factory_rogue_best_revenue >= FACTORY_REVENUE_III {
        out.insert("ACH_FACTORY_REVENUE_III");
    }
    if st.factory_rogue_best_combo >= 10 {
        out.insert("ACH_FACTORY_COMBO_10");
    }
    if st.factory_rogue_graduated_without_loan {
        out.insert("ACH_FACTORY_DEBT_FREE");
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
        let _ = app.emit(
            "achievement://unlocked",
            AchievementUnlock { id: id.clone() },
        );
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
    fn retained_dex_achievements_do_not_unlock_repurposed_ids() {
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
        // 六基础元素齐不再解锁已复用为工厂条件的 ACH_ALL_ELEMENTS。
        for e in ["normal", "fire", "electric", "water", "grass", "ice"] {
            let c = config.species_by_recipe.get(e).unwrap().clone();
            save.dex_obtained.insert(c, 1);
        }
        assert!(!satisfied_achievements(&config, &save).contains("ACH_ALL_ELEMENTS"));
        // 全收集只解锁保留的 ALL63 + 旗舰；25/45/五元素 ID 已复用。
        for c in &fixed {
            save.dex_obtained.insert(c.clone(), 1);
        }
        let got = satisfied_achievements(&config, &save);
        assert!(got.contains("ACH_DEX_ALL63"));
        assert!(got.contains("ACH_FLAGSHIP_KIRIN"));
        assert!(!got.contains("ACH_DEX_25"));
        assert!(!got.contains("ACH_DEX_45"));
        assert!(!got.contains("ACH_FIRST_PENTA"));
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
        assert!(!got.contains("ACH_AI_COLLECT_5"));
        assert!(!got.contains("ACH_AI_COLLECT_20"));
        assert!(!got.contains("ACH_AI_LADDER_5"));
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
        assert!(!got.contains("ACH_TIER4"));
        assert!(!got.contains("ACH_TIER5"));
        assert!(!got.contains("ACH_TIER6_APEX"));
        assert!(got.contains("ACH_FUSE_10"));
        assert!(!got.contains("ACH_FUSE_50"));
        assert!(!got.contains("ACH_FUSE_200"));
        assert!(got.contains("ACH_COINS_1M"));
        assert!(!got.contains("ACH_TREASURY"));
        assert!(!got.contains("ACH_HATCHERY_MAX"));
        assert!(!got.contains("ACH_SHOP_MAX"));
        assert!(!got.contains("ACH_YARD_MAX"));
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
        assert!(!got.contains("ACH_WORKSHOP_PUBLISH_5"));
        assert!(!got.contains("ACH_WORKSHOP_WEAR"));
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

    #[test]
    fn factory_achievements_are_exactly_half_of_catalog() {
        assert_eq!(FACTORY_ACHIEVEMENT_IDS.len(), 24);
        let unique: BTreeSet<_> = FACTORY_ACHIEVEMENT_IDS.into_iter().collect();
        assert_eq!(unique.len(), 24);
    }

    #[test]
    fn factory_snapshot_merges_absolute_high_waters_and_is_idempotent() {
        let config = test_config();
        let mut save = fresh(&config);
        let coins_before = save.coins;
        let snapshot = FactoryRogueAchievementSnapshot {
            runs_started: Some(2),
            runs_finished: Some(1),
            best_revenue: Some("5000000".into()),
            best_shift: Some(12),
            best_pulse: Some("500000".into()),
            best_combo: Some(10),
            best_desks: Some(4),
            max_upgrade_levels: Some(11),
            max_loadout: Some(10),
            first_kpi: Some(true),
            first_card: Some(true),
            first_bankruptcy: Some(true),
            strike_clear: Some(true),
            all_inspections_in_one_run: Some(true),
            graduated: Some(false),
            graduated_without_loan: Some(true),
            reward_coins: Some("5000000".into()),
        };
        assert!(logic_record_factory_rogue_achievement_snapshot(&mut save, &snapshot).unwrap());
        let st = &save.stats;
        assert_eq!(st.factory_rogue_runs_started, 2);
        assert_eq!(st.factory_rogue_runs_finished, 1);
        assert_eq!(st.factory_rogue_best_revenue, 5_000_000);
        assert_eq!(
            st.factory_rogue_best_shift, 20,
            "毕业/全检查推导至少通过 20 班"
        );
        assert_eq!(st.factory_rogue_best_pulse, 500_000);
        assert_eq!(st.factory_rogue_best_combo, 10);
        assert_eq!(st.factory_rogue_best_desks, 4);
        assert_eq!(st.factory_rogue_max_upgrade_levels, 11);
        assert_eq!(st.factory_rogue_max_loadout, 10);
        assert!(st.factory_rogue_first_kpi);
        assert!(st.factory_rogue_first_card);
        assert!(st.factory_rogue_first_bankruptcy);
        assert!(st.factory_rogue_strike_clear);
        assert_eq!(
            st.factory_rogue_inspection_mask,
            FACTORY_ALL_INSPECTIONS_MASK
        );
        assert!(st.factory_rogue_graduated, "无贷毕业必然蕴含普通毕业");
        assert!(st.factory_rogue_graduated_without_loan);
        assert_eq!(
            save.coins,
            coins_before + 5_000_000,
            "局终营收应进入通用金币余额"
        );

        assert!(
            !logic_record_factory_rogue_achievement_snapshot(&mut save, &snapshot).unwrap(),
            "重复提交同一绝对快照必须幂等"
        );
        let mut endless = snapshot.clone();
        endless.reward_coins = Some("6000000".into());
        assert!(logic_record_factory_rogue_achievement_snapshot(&mut save, &endless).unwrap());
        assert_eq!(
            save.coins,
            coins_before + 6_000_000,
            "毕业后继续无限应只补发新增营收"
        );
        let lower = FactoryRogueAchievementSnapshot {
            runs_started: Some(1),
            best_revenue: Some("1".into()),
            best_shift: Some(1),
            best_pulse: Some("1".into()),
            best_combo: Some(1),
            first_kpi: Some(false),
            ..FactoryRogueAchievementSnapshot::default()
        };
        assert!(
            !logic_record_factory_rogue_achievement_snapshot(&mut save, &lower).unwrap(),
            "较低数值和 false 旗标不得回退统计"
        );
    }

    #[test]
    fn factory_snapshot_rejects_invalid_values_before_mutation() {
        let config = test_config();
        let mut save = fresh(&config);
        let invalid_revenue = FactoryRogueAchievementSnapshot {
            best_revenue: Some("-1".into()),
            ..FactoryRogueAchievementSnapshot::default()
        };
        assert!(
            logic_record_factory_rogue_achievement_snapshot(&mut save, &invalid_revenue).is_err()
        );
        assert_eq!(save.stats.factory_rogue_best_revenue, 0);

        let invalid_desks = FactoryRogueAchievementSnapshot {
            best_desks: Some(7),
            ..FactoryRogueAchievementSnapshot::default()
        };
        assert!(
            logic_record_factory_rogue_achievement_snapshot(&mut save, &invalid_desks).is_err()
        );
        assert_eq!(save.stats.factory_rogue_best_desks, 0);

        let impossible_counts = FactoryRogueAchievementSnapshot {
            runs_started: Some(2),
            runs_finished: Some(3),
            ..FactoryRogueAchievementSnapshot::default()
        };
        assert!(
            logic_record_factory_rogue_achievement_snapshot(&mut save, &impossible_counts).is_err()
        );
        assert_eq!(save.stats.factory_rogue_runs_started, 0);
        assert_eq!(save.stats.factory_rogue_runs_finished, 0);
    }

    #[test]
    fn factory_snapshot_never_combines_partial_inspection_masks() {
        let config = test_config();
        let mut save = fresh(&config);
        save.stats.factory_rogue_inspection_mask = 0b0101;
        let partial_or_omitted = FactoryRogueAchievementSnapshot {
            all_inspections_in_one_run: Some(false),
            ..FactoryRogueAchievementSnapshot::default()
        };
        assert!(
            !logic_record_factory_rogue_achievement_snapshot(&mut save, &partial_or_omitted)
                .unwrap()
        );
        assert_eq!(save.stats.factory_rogue_inspection_mask, 0b0101);

        let complete = FactoryRogueAchievementSnapshot {
            all_inspections_in_one_run: Some(true),
            ..FactoryRogueAchievementSnapshot::default()
        };
        assert!(logic_record_factory_rogue_achievement_snapshot(&mut save, &complete).unwrap());
        assert_eq!(save.stats.factory_rogue_inspection_mask, 0b1111);
    }

    #[test]
    fn factory_threshold_matrix_and_all_24() {
        let config = test_config();
        let mut save = fresh(&config);

        // 刚好未达成：所有数值阈值均低一档，且只缺最后一个检查 bit。
        save.stats.factory_rogue_runs_started = 0;
        save.stats.factory_rogue_runs_finished = FACTORY_REPEAT_RUNS - 1;
        save.stats.factory_rogue_best_revenue = FACTORY_REVENUE_I - 1;
        save.stats.factory_rogue_best_shift = 4;
        save.stats.factory_rogue_best_pulse = 0;
        save.stats.factory_rogue_best_combo = 9;
        save.stats.factory_rogue_best_desks = 2;
        save.stats.factory_rogue_max_upgrade_levels = FACTORY_UPGRADE_LEVELS - 1;
        save.stats.factory_rogue_max_loadout = 9;
        save.stats.factory_rogue_inspection_mask = 0b0111;
        let got = satisfied_achievements(&config, &save);
        assert!(
            FACTORY_ACHIEVEMENT_IDS.iter().all(|id| !got.contains(id)),
            "阈值前一刻不得提前解锁：{got:?}"
        );
        save.stats.factory_rogue_best_pulse = FACTORY_BIG_PULSE - 1;
        let got = satisfied_achievements(&config, &save);
        assert!(got.contains("ACH_FACTORY_FIRST_PULSE"));
        assert!(!got.contains("ACH_WORKSHOP_COLLECT_5"));
        save.stats.factory_rogue_graduated_without_loan = true;
        let got = satisfied_achievements(&config, &save);
        assert!(got.contains("ACH_FACTORY_DEBT_FREE"));
        assert!(got.contains("ACH_HATCHERY_MAX"), "无贷毕业必然也算普通毕业");

        // 刚好达成最高档状态：应该覆盖全部 24 枚工厂成就。
        save.stats.factory_rogue_runs_started = 1;
        save.stats.factory_rogue_runs_finished = FACTORY_REPEAT_RUNS;
        save.stats.factory_rogue_best_revenue = FACTORY_REVENUE_III;
        save.stats.factory_rogue_best_shift = FACTORY_ENDLESS_SHIFT;
        save.stats.factory_rogue_best_pulse = FACTORY_BIG_PULSE;
        save.stats.factory_rogue_best_combo = 10;
        save.stats.factory_rogue_best_desks = 6;
        save.stats.factory_rogue_max_upgrade_levels = FACTORY_UPGRADE_LEVELS;
        save.stats.factory_rogue_max_loadout = 10;
        save.stats.factory_rogue_first_kpi = true;
        save.stats.factory_rogue_first_card = true;
        save.stats.factory_rogue_first_bankruptcy = true;
        save.stats.factory_rogue_strike_clear = true;
        save.stats.factory_rogue_inspection_mask = FACTORY_ALL_INSPECTIONS_MASK;
        save.stats.factory_rogue_graduated = true;
        save.stats.factory_rogue_graduated_without_loan = true;
        let got = satisfied_achievements(&config, &save);
        let factory_got: BTreeSet<_> = got
            .intersection(&FACTORY_ACHIEVEMENT_IDS.into_iter().collect())
            .copied()
            .collect();
        assert_eq!(factory_got.len(), 24, "应解锁全部工厂成就：{factory_got:?}");
    }

    #[test]
    fn old_save_without_factory_stats_defaults_to_locked() {
        let config = test_config();
        let save = fresh(&config);
        let mut json = serde_json::to_value(&save).unwrap();
        let stats = json
            .get_mut("stats")
            .and_then(serde_json::Value::as_object_mut)
            .unwrap();
        stats.retain(|key, _| !key.starts_with("factoryRogue"));
        let old: GameSave = serde_json::from_value(json).unwrap();
        assert_eq!(old.stats.factory_rogue_best_revenue, 0);
        assert_eq!(old.stats.factory_rogue_inspection_mask, 0);
        let got = satisfied_achievements(&config, &old);
        assert!(FACTORY_ACHIEVEMENT_IDS.iter().all(|id| !got.contains(id)));
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
            pending_fusion: None,
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
        assert!(migrate_save(
            &config,
            &mut save,
            &BTreeMap::new(),
            2000,
            "2026-07-07"
        ));
        assert_eq!(save.version, 10);
        assert_eq!(save.stats.highest_tier, 4);
        assert!(save.stats.first_maxlevel_done, "满级宠播种 first_maxlevel");
    }
}
