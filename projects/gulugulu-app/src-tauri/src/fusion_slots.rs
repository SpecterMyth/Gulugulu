//! 融合配方槽位阶梯 —— `docs/gdd/FusionRecipeSlots.md` 的引擎实现。
//!
//! 纯逻辑、零 IO，与 TS 侧 `src/game/fusionSlots.ts` **逐函数对拍**（改一侧必改另
//! 一侧，见仓库 Rust↔TS 类型/规则对等硬规则）。掷骰全部走**整数权重**（分母
//! `100·2^(m−1)`）避免浮点漂移；测试向量即 FusionRecipeSlots.md §3.2 的概率表。
//!
//! 术语（与 GDD 同）：
//! - **配方 recipe**：双亲元素集合并集去重排序键（`element_set_key`）。
//! - **槽位 slot**：0 号 = 固定物种（`speciesByRecipe`）；1..=10 号 = 本存档 AI 变种。
//! - **前缀 u**：从 0 号连续已获得的最大槽号（0 号未获得 → −1）。
//! - **前沿 m**：本次可触发的最大槽号 = `min(10, max(1, u+1))`。
//!
//! 本模块是分阶段消费的纯 API（PR-1 落逻辑、PR-2/3 接入 fuse_pets 与图鉴）；
//! 非测试构建下部分函数暂未被主链路调用，故整模块 allow(dead_code)。

#![allow(dead_code)]

use std::collections::BTreeSet;

/// 每配方最多 10 个 AI 变种槽（外加 0 号固定槽）。
pub const MAX_AI_SLOTS: usize = 10;

/// 配方键（canonical set key）：元素去重 → 字典序 → `"+"` 连接。
/// `fusion_recipe_key`（二元）的 N 元推广；单元素即元素名自身。
pub fn element_set_key(elements: &[String]) -> String {
    let set: BTreeSet<&str> = elements.iter().map(String::as_str).collect();
    set.into_iter().collect::<Vec<_>>().join("+")
}

/// 触发 AI 的总概率 `A(e)`（百分数整数），按配方元素数缩放。
/// 2→60 · 3→40 · 4→20 · 5→10 · 6→5；其余（含单元素、0 元素）→ 0（无 AI 槽）。
/// 值为查表而非公式（60→40 不是减半）。见 FusionRecipeSlots.md §3.2。
pub fn ai_total_chance_percent(element_count: usize) -> u64 {
    match element_count {
        2 => 60,
        3 => 40,
        4 => 20,
        5 => 10,
        6 => 5,
        _ => 0,
    }
}

/// 从 0 号起**连续已获得**的最大槽号（前缀 u）。0 号未获得 → −1。
/// `obtained_slots` = 该配方下已获得的槽号集合（0 = 固定物种，1.. = AI 变种）。
pub fn obtained_prefix(obtained_slots: &BTreeSet<usize>) -> i64 {
    if !obtained_slots.contains(&0) {
        return -1;
    }
    let mut u: i64 = 0;
    while obtained_slots.contains(&((u + 1) as usize)) {
        u += 1;
    }
    u
}

/// 阶梯前沿 `m = min(MAX_AI_SLOTS, max(1, u+1))`。
/// u=−1 或 0 → 1（初始态 {0,1}）；u=1 → 2；…；u≥9 → 10（封顶）。
pub fn frontier_m(obtained_prefix_u: i64) -> usize {
    let raw = (obtained_prefix_u + 1).max(1);
    (raw as usize).min(MAX_AI_SLOTS)
}

/// CLI 降级后的**有效前沿**（决定可触发集合 {0..=eff}）。
/// - CLI 可用 → `m`（含可能触发生成的前沿新槽）。
/// - CLI 不可用且前沿槽已注册（`m ≤ registered_ai_slots`，纯复用）→ `m`（CLI 无关）。
/// - CLI 不可用且前沿槽需生成 → 回退 `m−1`（`m==1` 时得 0 = 只剩固定物种）。
pub fn effective_frontier(m: usize, registered_ai_slots: usize, cli_available: bool) -> usize {
    if cli_available || m <= registered_ai_slots {
        return m;
    }
    m.saturating_sub(1)
}

/// 可触发集合 `{0..=m}` 的**整数权重**（下标即槽号）。
///
/// 概率（FusionRecipeSlots.md §3.2）：`P(0)=1−A`，内部槽 `P(i)=A/2^i`（1≤i<m），
/// 前沿槽 `P(m)=A/2^(m−1)`。通分到 `100·2^(m−1)`：
/// `w0=(100−a)·2^(m−1)`、`w_i=a·2^(m−1−i)`、`w_m=a`，和恒 `100·2^(m−1)`。
///
/// `m==0`（CLI 降级到只剩固定物种）→ `[1]`（0 号 100%）。
/// `a_percent==0`（非 AI 配方）→ 0 号独占，其余权重 0。
pub fn slot_weights(a_percent: u64, m: usize) -> Vec<u64> {
    if m == 0 {
        return vec![1];
    }
    let scale = 1u64 << (m - 1); // 2^(m−1)
    let mut weights = Vec::with_capacity(m + 1);
    weights.push((100 - a_percent) * scale); // 0 号固定槽
    for i in 1..m {
        weights.push(a_percent * (1u64 << (m - 1 - i))); // 内部槽 = a·2^(m−1−i)
    }
    weights.push(a_percent); // 前沿槽 = a（吸收尾部余量）
    weights
}

/// 权重之和（= `100·2^(m−1)`，或 m==0 时 1）。
pub fn weights_sum(weights: &[u64]) -> u64 {
    weights.iter().sum()
}

/// 按累积权重与掷点 `roll ∈ [0, sum)` 选槽（越界兜底到末槽）。
pub fn roll_slot(weights: &[u64], roll: u64) -> usize {
    let mut acc = 0u64;
    for (index, &weight) in weights.iter().enumerate() {
        acc += weight;
        if roll < acc {
            return index;
        }
    }
    weights.len().saturating_sub(1)
}

/// 掷中槽 `s` 的处置（`registered_ai_slots` = 该配方已注册 AI 变种数）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SlotOutcome {
    /// 0 号：固定物种 `speciesByRecipe[recipe]`。
    Fixed,
    /// 已注册 AI 槽：复用第 `slot` 号变种（1-indexed），不调 CLI。
    Reuse { slot: usize },
    /// 前沿新槽：AI 生成第 `slot` 号变种（1-indexed）。
    Generate { slot: usize },
}

/// 极简 splitmix64（无 rand 依赖）：种子 → 一个伪随机 u64。融合掷点用
/// `splitmix64(now ^ id_hash) % weights_sum` 取，掷点非安全敏感（无 rand 时的替代）。
pub fn splitmix64(seed: u64) -> u64 {
    let mut z = seed.wrapping_add(0x9E37_79B9_7F4A_7C15);
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    z ^ (z >> 31)
}

/// 分派掷中槽号 → 固定 / 复用 / 生成。
pub fn classify_slot(rolled: usize, registered_ai_slots: usize) -> SlotOutcome {
    if rolled == 0 {
        SlotOutcome::Fixed
    } else if rolled <= registered_ai_slots {
        SlotOutcome::Reuse { slot: rolled }
    } else {
        SlotOutcome::Generate { slot: rolled }
    }
}

/// 便捷：给定配方元素数、已获得槽集合、已注册 AI 变种数、CLI 可用性，返回本次
/// 可触发集合的整数权重（掷骰与图鉴概率显示共用同一真源）。镜像 TS
/// `recipeSlotWeights`。
pub fn recipe_slot_weights(
    element_count: usize,
    obtained_slots: &BTreeSet<usize>,
    registered_ai_slots: usize,
    cli_available: bool,
) -> Vec<u64> {
    let m = frontier_m(obtained_prefix(obtained_slots));
    let eff = effective_frontier(m, registered_ai_slots, cli_available);
    slot_weights(ai_total_chance_percent(element_count), eff)
}

// ---------------------------------------------------------------------------
// 全局确定性槽位身份 —— Steam itemdef 与创意工坊 petId 的共同主键。
//
// 多元素配方（元素数≥2）按 (元素数升序, 键字典序) 排出**冻结序号** `recipe_ordinal`，
// 由它派生三样全局一致的身份：
//   · 多元素固定物种 itemdef = `FIXED_MULTI_DEF_BASE + ord`（FusionSystem.md §9：601..=657）
//   · AI 变种槽 itemdef       = `AI_ITEM_DEF_BASE + ord*100 + slot`（10001..=15610）
//   · AI 变种槽 codename      = `aif` + 2 位 ord + 2 位 slot（替换旧的随机 `aif{6hex}`）
// 号段一经使用即冻结（同旧 1xx–5xx 规则）。与 TS 侧 `fusionSlots.ts` 逐函数镜像，
// 向量见 `scripts/verify_fusion_slots.mjs`，并由 `game_config.rs` 冻结编号测试锚到真配置。
// ---------------------------------------------------------------------------

/// AI 变种槽 itemdef 号段基址（加法编号，永不与既有 1xx–9xx 冲突）。
pub const AI_ITEM_DEF_BASE: u32 = 10_000;
/// 多元素固定物种 itemdef 起始号（§9：601..=657 = 601 + recipe_ordinal）。
pub const FIXED_MULTI_DEF_BASE: u32 = 601;

/// 配方元素数（"+" 分段数）；单元素 → 1。
pub fn recipe_element_count(recipe: &str) -> usize {
    recipe.split('+').count()
}

/// 多元素配方（元素数≥2）按 (元素数升序, 键字典序) 排序 —— 冻结序号真源。
/// 入参为全部配方键（如 `speciesByRecipe` 的键）。
pub fn multi_element_recipes_ordered(recipe_keys: &[String]) -> Vec<String> {
    let mut multi: Vec<String> = recipe_keys
        .iter()
        .filter(|k| recipe_element_count(k) >= 2)
        .cloned()
        .collect();
    multi.sort_by(|a, b| {
        recipe_element_count(a)
            .cmp(&recipe_element_count(b))
            .then_with(|| a.cmp(b))
    });
    multi
}

/// 配方在多元素有序表里的 0-based 序号；单元素/未知 → None。
pub fn recipe_ordinal(ordered: &[String], recipe: &str) -> Option<usize> {
    ordered.iter().position(|r| r == recipe)
}

/// 多元素固定物种 itemdefid = 601 + 序号。
pub fn fixed_item_def(recipe_ordinal: usize) -> u32 {
    FIXED_MULTI_DEF_BASE + recipe_ordinal as u32
}

/// AI 变种槽 itemdefid = 10000 + 序号*100 + slot（slot 1..=MAX_AI_SLOTS）。
pub fn ai_item_def(recipe_ordinal: usize, slot: usize) -> u32 {
    AI_ITEM_DEF_BASE + recipe_ordinal as u32 * 100 + slot as u32
}

/// 并集融合生成器 itemdef 号段基址（2026-07-16 上架定案，00-decisions）。
pub const UNION_GEN_BASE: u32 = 20_000;

/// 并集融合生成器 itemdefid = 20000 + 序号（每多元素配方一条，exchange 枚举全部并集对）。
pub fn union_gen_def(recipe_ordinal: usize) -> u32 {
    UNION_GEN_BASE + recipe_ordinal as u32
}

/// 是否并集融合生成器 def（20000..=20056，最多 57 条多元素配方）。服务器兑换时才掷 0 号
/// 固定 / AI 槽，兑换前无法预知结果 def → 融合结果需先挂 pending 等实发 def 精化。
pub fn is_union_gen_def(def: u32) -> bool {
    (UNION_GEN_BASE..=UNION_GEN_BASE + 56).contains(&def)
}

/// 商店蛋生成器 itemdef 号段基址（2026-07-16 上架定案）。
pub const SHOP_GEN_BASE: u32 = 21_000;

/// 商店蛋生成器 itemdefid = 21000 + 阶*10 + (一阶宠 def − 100)
/// （阶 1..=4 × 一阶 def 101..=106 → 21011..=21046；playtimegenerator，
/// `drop_interval:1` + `drop_max_per_window:eggDailyMintCaps[阶−1]`，窗口=应用级 1440）。
pub fn shop_gen_def(tier: u8, tier1_pet_def: u32) -> u32 {
    SHOP_GEN_BASE + tier as u32 * 10 + (tier1_pet_def - 100)
}

/// codename → AI 槽 itemdef 反解（仅新式 `aif`+2位序+2位槽；旧随机 `aif{6hex}` → None）。
/// Steam 融合重接线用：同物种 AI 变种升阶的兑换目标 def。
pub fn ai_def_for_codename(codename: &str) -> Option<u32> {
    let digits = codename.strip_prefix("aif")?;
    if digits.len() != 4 || !digits.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    let ordinal: usize = digits[..2].parse().ok()?;
    let slot: usize = digits[2..].parse().ok()?;
    if ordinal > 56 || !(1..=MAX_AI_SLOTS).contains(&slot) {
        return None;
    }
    Some(ai_item_def(ordinal, slot))
}

/// AI 槽 itemdef → codename 反解（10001..=15610 且槽号 1..=10；其余 None）。
/// Steam 掷出 AI 槽 def 时定物种身份用。
pub fn codename_for_ai_def(def: u32) -> Option<String> {
    if !(AI_ITEM_DEF_BASE + 1..=AI_ITEM_DEF_BASE + 5610).contains(&def) {
        return None;
    }
    let rest = (def - AI_ITEM_DEF_BASE) as usize;
    let (ordinal, slot) = (rest / 100, rest % 100);
    if ordinal > 56 || !(1..=MAX_AI_SLOTS).contains(&slot) {
        return None;
    }
    Some(slot_codename(ordinal, slot))
}

/// AI 变种槽全局确定性 codename = `aif` + 2 位序号 + 2 位 slot（如 `aif0001`/`aif5610`）。
/// 满足 `fusion_gen::is_valid_codename`（长 7、首字母、余小写数字），与随机 `aif{6hex}`（长 9）不同长不撞。
pub fn slot_codename(recipe_ordinal: usize, slot: usize) -> String {
    format!("aif{:02}{:02}", recipe_ordinal, slot)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn set(indices: &[usize]) -> BTreeSet<usize> {
        indices.iter().copied().collect()
    }

    // ---- element_set_key ------------------------------------------------

    #[test]
    fn element_set_key_dedups_sorts_joins() {
        assert_eq!(element_set_key(&["fire".into()]), "fire");
        assert_eq!(element_set_key(&["water".into(), "fire".into()]), "fire+water");
        // 去重 + 字典序：同物种融合的并集即自身。
        assert_eq!(element_set_key(&["fire".into(), "fire".into()]), "fire");
        assert_eq!(
            element_set_key(&["water".into(), "fire".into(), "grass".into(), "fire".into()]),
            "fire+grass+water"
        );
        // 与二元 fusion_recipe_key 兼容（无序）。
        assert_eq!(
            element_set_key(&["electric".into(), "fire".into()]),
            crate::game_config::fusion_recipe_key("fire", "electric")
        );
    }

    // ---- A(e) -----------------------------------------------------------

    #[test]
    fn ai_total_chance_matches_gdd_table() {
        assert_eq!(ai_total_chance_percent(2), 60);
        assert_eq!(ai_total_chance_percent(3), 40);
        assert_eq!(ai_total_chance_percent(4), 20);
        assert_eq!(ai_total_chance_percent(5), 10);
        assert_eq!(ai_total_chance_percent(6), 5);
        // 单元素/越界 → 0（无 AI 槽）。
        assert_eq!(ai_total_chance_percent(1), 0);
        assert_eq!(ai_total_chance_percent(0), 0);
        assert_eq!(ai_total_chance_percent(7), 0);
    }

    // ---- obtained_prefix + frontier_m ----------------------------------

    #[test]
    fn obtained_prefix_and_frontier_progression() {
        // 全新配方（0 号都没拿）→ u=−1, m=1（可触发 {0,1}）。
        assert_eq!(obtained_prefix(&set(&[])), -1);
        assert_eq!(frontier_m(-1), 1);
        // 只拿 1 号没拿 0 号 → u=−1, m=1（卡在 {0,1}，2 号需先补 0 号）。
        assert_eq!(obtained_prefix(&set(&[1])), -1);
        assert_eq!(frontier_m(obtained_prefix(&set(&[1]))), 1);
        // 只拿 0 号 → u=0, m=1。
        assert_eq!(obtained_prefix(&set(&[0])), 0);
        assert_eq!(frontier_m(0), 1);
        // 拿 0、1 → u=1, m=2。
        assert_eq!(obtained_prefix(&set(&[0, 1])), 1);
        assert_eq!(frontier_m(1), 2);
        // 拿 0、1、2 → u=2, m=3。
        assert_eq!(obtained_prefix(&set(&[0, 1, 2])), 2);
        assert_eq!(frontier_m(2), 3);
        // 有缺口不算连续：拿 0、1、3（缺 2）→ u=1, m=2（3 号还不可触发）。
        assert_eq!(obtained_prefix(&set(&[0, 1, 3])), 1);
        assert_eq!(frontier_m(obtained_prefix(&set(&[0, 1, 3]))), 2);
        // 封顶 10：u=9 → m=10；u=10 → m=10。
        assert_eq!(frontier_m(9), 10);
        assert_eq!(frontier_m(10), 10);
    }

    // ---- slot_weights：逐位核对 GDD §3.2 分布表 -------------------------

    /// 断言 (a, m) 的权重恰为期望，且和 = 100·2^(m−1)，AI 总占比 = a%。
    fn assert_weights(a: u64, m: usize, expected: &[u64]) {
        let w = slot_weights(a, m);
        assert_eq!(w, expected, "a={a} m={m}");
        assert_eq!(weights_sum(&w), 100 * (1u64 << (m - 1)), "sum a={a} m={m}");
        // AI 池（1..）占比恒等于 A(e)。
        let ai: u64 = w[1..].iter().sum();
        assert_eq!(ai * 100, a * weights_sum(&w), "AI 总占比应 = {a}% (a={a} m={m})");
    }

    #[test]
    fn slot_weights_two_elements() {
        // e=2, A=60%：40 · 60 / 40 · 30 · 30 / 40 · 30 · 15 · 15
        assert_weights(60, 1, &[40, 60]);
        assert_weights(60, 2, &[80, 60, 60]); // ÷200 = 40/30/30
        assert_weights(60, 3, &[160, 120, 60, 60]); // ÷400 = 40/30/15/15
    }

    #[test]
    fn slot_weights_three_elements() {
        // e=3, A=40%：60 · 40 / 60 · 20 · 20 / 60 · 20 · 10 · 10
        assert_weights(40, 1, &[60, 40]);
        assert_weights(40, 2, &[120, 40, 40]); // ÷200 = 60/20/20
        assert_weights(40, 3, &[240, 80, 40, 40]); // ÷400 = 60/20/10/10
    }

    #[test]
    fn slot_weights_six_elements() {
        // e=6, A=5%：95 · 5 / 95 · 2.5 · 2.5 / 95 · 2.5 · 1.25 · 1.25
        assert_weights(5, 1, &[95, 5]);
        assert_weights(5, 2, &[190, 5, 5]); // ÷200 = 95/2.5/2.5
        assert_weights(5, 3, &[380, 10, 5, 5]); // ÷400 = 95/2.5/1.25/1.25
    }

    #[test]
    fn slot_weights_full_ladder_sums_and_ai_ratio_hold_for_all_e_and_m() {
        for e in 2..=6usize {
            let a = ai_total_chance_percent(e);
            for m in 1..=MAX_AI_SLOTS {
                let w = slot_weights(a, m);
                assert_eq!(w.len(), m + 1, "槽数 = m+1");
                assert_eq!(weights_sum(&w), 100 * (1u64 << (m - 1)));
                // 0 号占 (100−a)%。
                assert_eq!(w[0] * 100, (100 - a) * weights_sum(&w));
                // AI 池占 a%。
                let ai: u64 = w[1..].iter().sum();
                assert_eq!(ai * 100, a * weights_sum(&w));
                // 前沿槽 = 内部同号的 2 倍（尾部合并）：w[m] == 2·(a·2^(m−1−m))…
                // 直接验证前沿 = a，且 m≥2 时前沿 == 前一内部槽权重。
                assert_eq!(*w.last().unwrap(), a);
                if m >= 2 {
                    assert_eq!(w[m], w[m - 1]);
                }
            }
        }
    }

    #[test]
    fn slot_weights_edge_cases() {
        // m=0（CLI 降级到只剩固定物种）→ 0 号 100%。
        assert_eq!(slot_weights(60, 0), vec![1]);
        // 非 AI 配方（a=0，如单元素）→ 0 号独占。
        assert_eq!(slot_weights(0, 1), vec![100, 0]);
        assert_eq!(slot_weights(0, 3), vec![400, 0, 0, 0]);
    }

    // ---- roll_slot ------------------------------------------------------

    #[test]
    fn roll_slot_partitions_by_cumulative_weight() {
        // e=2, m=2 → [80,60,60]，累积边界 80 / 140 / 200。
        let w = slot_weights(60, 2);
        assert_eq!(roll_slot(&w, 0), 0);
        assert_eq!(roll_slot(&w, 79), 0);
        assert_eq!(roll_slot(&w, 80), 1);
        assert_eq!(roll_slot(&w, 139), 1);
        assert_eq!(roll_slot(&w, 140), 2);
        assert_eq!(roll_slot(&w, 199), 2);
        // 越界兜底末槽。
        assert_eq!(roll_slot(&w, 200), 2);
        assert_eq!(roll_slot(&w, u64::MAX), 2);
    }

    #[test]
    fn roll_slot_empirical_frequencies_match_probabilities() {
        // 遍历全体掷点 [0,sum)，统计每槽命中数应恰等于其权重。
        for e in 2..=6usize {
            let a = ai_total_chance_percent(e);
            for m in 1..=4usize {
                let w = slot_weights(a, m);
                let total = weights_sum(&w);
                let mut hits = vec![0u64; w.len()];
                for roll in 0..total {
                    hits[roll_slot(&w, roll)] += 1;
                }
                assert_eq!(hits, w, "频率应逐槽等于权重 e={e} m={m}");
            }
        }
    }

    // ---- effective_frontier（CLI 降级）---------------------------------

    #[test]
    fn effective_frontier_cli_rules() {
        // CLI 可用：恒 = m。
        assert_eq!(effective_frontier(3, 2, true), 3);
        // CLI 不可用 + 前沿需生成（m > registered）→ m−1。
        assert_eq!(effective_frontier(3, 2, false), 2);
        // CLI 不可用 + 前沿已注册（纯复用，m ≤ registered）→ m。
        assert_eq!(effective_frontier(2, 2, false), 2);
        assert_eq!(effective_frontier(2, 3, false), 2);
        // CLI 不可用 + 还没解锁任何 AI（m=1, registered=0）→ 0（只剩固定物种）。
        assert_eq!(effective_frontier(1, 0, false), 0);
    }

    #[test]
    fn cli_unavailable_falls_back_to_fixed_only_when_no_variants() {
        // 全新配方 CLI 不可用：eff=0 → 权重 [1] → 100% 固定（与旧行为一致）。
        let eff = effective_frontier(frontier_m(-1), 0, false);
        assert_eq!(eff, 0);
        assert_eq!(slot_weights(60, eff), vec![1]);
    }

    // ---- classify_slot --------------------------------------------------

    #[test]
    fn classify_slot_dispatches_fixed_reuse_generate() {
        // 已注册 2 个 AI 变种时：0=固定，1/2=复用，3=生成。
        assert_eq!(classify_slot(0, 2), SlotOutcome::Fixed);
        assert_eq!(classify_slot(1, 2), SlotOutcome::Reuse { slot: 1 });
        assert_eq!(classify_slot(2, 2), SlotOutcome::Reuse { slot: 2 });
        assert_eq!(classify_slot(3, 2), SlotOutcome::Generate { slot: 3 });
        // 还没注册任何 AI：1 号 = 生成（免费首解）。
        assert_eq!(classify_slot(1, 0), SlotOutcome::Generate { slot: 1 });
    }

    // ---- recipe_slot_weights（组合便捷 + CLI 降级端到端）---------------

    #[test]
    fn recipe_slot_weights_composes_and_degrades() {
        // fire+water(e=2), 已获得 {0,1}, 已注册 1 个 AI 变种, CLI 可用：
        // u=1 → m=2；前沿 2 号需生成（m>registered）→ eff=2 → [80,60,60]。
        assert_eq!(recipe_slot_weights(2, &set(&[0, 1]), 1, true), vec![80, 60, 60]);
        // 同上但 CLI 不可用：前沿新槽去掉 → eff=1 → [40,60]（AI 总仍 60%）。
        assert_eq!(recipe_slot_weights(2, &set(&[0, 1]), 1, false), vec![40, 60]);
        // 全新配方 CLI 不可用：eff=0 → [1]（100% 固定，与旧行为一致）。
        assert_eq!(recipe_slot_weights(2, &set(&[]), 0, false), vec![1]);
        // 单元素配方：a=0 → 0 号独占（不该掷 AI）。
        assert_eq!(recipe_slot_weights(1, &set(&[]), 0, true), vec![100, 0]);
    }

    // ---- 端到端小场景：GDD §3.5 fire+water 示例逐步 --------------------

    #[test]
    fn scenario_firewater_ladder_walkthrough() {
        let a = ai_total_chance_percent(2); // fire+water 是 2 元素 → 60
        assert_eq!(a, 60);

        // 1) 全新：obtained={}, u=-1, m=1 → 40% 固定 / 60% 生成 1 号。
        let mut obtained = set(&[]);
        let mut registered = 0usize;
        let m = frontier_m(obtained_prefix(&obtained));
        assert_eq!(slot_weights(a, m), vec![40, 60]);
        // 掷点落在 AI 区间 → 生成 1 号。
        let s = roll_slot(&slot_weights(a, m), 40);
        assert_eq!(s, 1);
        assert_eq!(classify_slot(s, registered), SlotOutcome::Generate { slot: 1 });
        registered = 1;
        obtained.insert(1); // 孵出 → 1 号已获得（0 号仍缺）。

        // 2) obtained={1}, u=-1, m=1 → 仍 {0,1}，掷 1 号=复用。
        let m = frontier_m(obtained_prefix(&obtained));
        assert_eq!(m, 1);
        assert_eq!(classify_slot(roll_slot(&slot_weights(a, m), 40), registered),
                   SlotOutcome::Reuse { slot: 1 });

        // 3) 掷中 0 号 → 拿到固定物种；obtained={0,1}, u=1, m=2 → 40/30/30。
        obtained.insert(0);
        let m = frontier_m(obtained_prefix(&obtained));
        assert_eq!(m, 2);
        assert_eq!(slot_weights(a, m), vec![80, 60, 60]);
        // 掷中 2 号（前沿新槽）→ 生成。
        let s = roll_slot(&slot_weights(a, m), 140);
        assert_eq!(s, 2);
        assert_eq!(classify_slot(s, registered), SlotOutcome::Generate { slot: 2 });
        registered = 2;
        obtained.insert(2);

        // 4) obtained={0,1,2}, u=2, m=3 → 40/30/15/15。
        let m = frontier_m(obtained_prefix(&obtained));
        assert_eq!(m, 3);
        assert_eq!(slot_weights(a, m), vec![160, 120, 60, 60]);
        let _ = registered;
    }

    // ---- 槽位身份（Steam itemdef / 创意工坊 petId 主键）-----------------

    #[test]
    fn slot_identity_ordering_and_derivations() {
        // 合成配方表（含单元素、乱序、跨元素数）——验证过滤 + (元素数,键) 排序 + 派生。
        let keys: Vec<String> = [
            "fire",                                 // 单元素（应被过滤）
            "normal",                               // 单元素
            "normal+water",                         // 2 元素
            "electric+fire",                        // 2 元素
            "electric+fire+grass",                  // 3 元素
            "electric+fire+grass+ice+normal+water", // 6 元素
        ]
        .iter()
        .map(|s| s.to_string())
        .collect();
        let ordered = multi_element_recipes_ordered(&keys);
        assert_eq!(
            ordered,
            vec![
                "electric+fire".to_string(),
                "normal+water".to_string(),
                "electric+fire+grass".to_string(),
                "electric+fire+grass+ice+normal+water".to_string(),
            ]
        );
        assert_eq!(recipe_ordinal(&ordered, "electric+fire"), Some(0));
        assert_eq!(recipe_ordinal(&ordered, "normal+water"), Some(1));
        assert_eq!(recipe_ordinal(&ordered, "fire"), None); // 单元素无 AI 槽序号
        assert_eq!(recipe_ordinal(&ordered, "unknown+key"), None);
        // 派生（与 §9 号段一致）。
        assert_eq!(fixed_item_def(0), 601);
        assert_eq!(fixed_item_def(56), 657);
        assert_eq!(ai_item_def(0, 1), 10_001);
        assert_eq!(ai_item_def(56, 10), 15_610);
        assert_eq!(slot_codename(0, 1), "aif0001");
        assert_eq!(slot_codename(56, 10), "aif5610");
        assert_eq!(slot_codename(5, 3), "aif0503");
        // 并集融合生成器（2026-07-16 上架定案）：20000..=20056，不撞 AI 段（≤15610）。
        assert_eq!(union_gen_def(0), 20_000);
        assert_eq!(union_gen_def(56), 20_056);
        assert!(union_gen_def(0) > ai_item_def(56, 10));
        // 商店蛋生成器：21011..=21046（阶 1..4 × 一阶 101..106），不撞并集段。
        assert_eq!(shop_gen_def(1, 101), 21_011);
        assert_eq!(shop_gen_def(1, 106), 21_016);
        assert_eq!(shop_gen_def(4, 106), 21_046);
        assert!(shop_gen_def(1, 101) > union_gen_def(56));
        // codename ↔ AI def 双向反解（新式 4 位数字；旧随机 6hex 与越界 → None）。
        assert_eq!(ai_def_for_codename("aif0503"), Some(10_503));
        assert_eq!(ai_def_for_codename("aif0001"), Some(10_001));
        assert_eq!(ai_def_for_codename("aif5610"), Some(15_610));
        assert_eq!(ai_def_for_codename("aif5711"), None); // ord 57 / slot 11 越界
        assert_eq!(ai_def_for_codename("aifab12cd"), None); // 旧随机 hex
        assert_eq!(codename_for_ai_def(10_503).as_deref(), Some("aif0503"));
        assert_eq!(codename_for_ai_def(15_610).as_deref(), Some("aif5610"));
        assert_eq!(codename_for_ai_def(10_000), None); // slot 0 非法
        assert_eq!(codename_for_ai_def(601), None);
        for ord in 0..57usize {
            for slot in 1..=MAX_AI_SLOTS {
                assert_eq!(
                    ai_def_for_codename(&slot_codename(ord, slot)),
                    Some(ai_item_def(ord, slot)),
                    "roundtrip ord={ord} slot={slot}"
                );
            }
        }
    }

    #[test]
    fn slot_identity_570_slots_unique_and_disjoint() {
        // 57 配方 × 10 槽：def 全唯一、落 [10001,15610]、不撞固定 601..=657；codename 全唯一且合法。
        let mut defs = BTreeSet::new();
        let mut names = BTreeSet::new();
        for ord in 0..57usize {
            for slot in 1..=MAX_AI_SLOTS {
                let def = ai_item_def(ord, slot);
                assert!((10_001..=15_610).contains(&def), "AI def 越界 {def}");
                assert!(def > 657, "AI def 撞固定/旧号段 {def}");
                assert!(defs.insert(def), "AI def 重复 {def}");
                let name = slot_codename(ord, slot);
                assert_eq!(name.len(), 7, "codename 长度 {name}");
                assert!(name.starts_with("aif"), "codename 前缀 {name}");
                assert!(name[3..].chars().all(|c| c.is_ascii_digit()), "codename 尾数 {name}");
                assert!(names.insert(name.clone()), "codename 重复 {name}");
            }
        }
        assert_eq!(defs.len(), 570);
        assert_eq!(names.len(), 570);
    }
}
