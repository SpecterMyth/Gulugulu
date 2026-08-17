use crate::game::*;

const BASE_ELEMENTS: [&str; 6] = ["normal", "fire", "water", "grass", "electric", "ice"];
pub(crate) const TUTORIAL_FUSION_RECIPES: [&str; 4] =
    ["fire+normal", "electric+water", "grass+normal", "fire+ice"];

const ONBOARDING_STEPS: [&str; 64] = [
    "A01", "A02", "A03", "A04", "A05", "A06", "A07", "A08", "A09", "A10", "A11", "A12", "A13",
    "A14", "A15", "A16", "A17", "A18", "A19", "B01", "B02", "B03", "B04", "B05", "B06", "B07",
    "C01", "C02", "C03", "C04", "C05", "C06", "C07", "C08", "C09", "C10", "C11", "C12", "D01",
    "D02", "D03", "D04", "D05", "D06", "D07", "D08", "D09", "D10", "D11", "E01", "E02", "E03",
    "F01", "F02", "F03a", "F04", "G01", "G02", "G03", "G04", "G05", "G06", "G07", "DONE",
];

pub(crate) fn occupied_pet_count(save: &GameSave) -> usize {
    save.pets
        .iter()
        .filter(|pet| !save.capacity_exempt_pet_ids.contains(&pet.id))
        .count()
}

pub(crate) fn expected_tutorial_fusion_recipe(save: &GameSave) -> Option<&'static str> {
    if save.onboarding.status != "active" {
        return None;
    }
    let index = usize::from(save.onboarding.tutorial_fusions);
    let at_guided_confirmation = matches!(
        (index, save.onboarding.step.as_str()),
        (0, "B02" | "B03") | (1, "D05" | "D06") | (2 | 3, "D10")
    );
    at_guided_confirmation
        .then(|| TUTORIAL_FUSION_RECIPES.get(index).copied())
        .flatten()
}

fn step_index(step: &str) -> Option<usize> {
    ONBOARDING_STEPS
        .iter()
        .position(|candidate| *candidate == step)
}

/// Steam 库存只能在第一次融合结果已经收取后进入本地后院。
/// 云存档同步与本地铸造照常运行；这里只延后“库存里已有但本档未绑定”的物品导入。
pub(crate) fn steam_inventory_import_unlocked(save: &GameSave) -> bool {
    if save.onboarding.status != "active" {
        return true;
    }
    let Some(current) = step_index(&save.onboarding.step) else {
        return false;
    };
    let first_fusion_collected = step_index("B05").expect("B05 is an onboarding step");
    current > first_fusion_collected
}

fn grant_pet(
    config: &GameConfig,
    save: &mut GameSave,
    species: String,
    tier: u8,
    now: i64,
    capacity_exempt: bool,
    start_maxed: bool,
) -> Result<String, String> {
    if !config.species.contains_key(&species) {
        return Err(format!("#unknownSpeciesNamed|species={species}"));
    }
    let id = new_id("pet");
    let level = if start_maxed {
        config.max_level_for_tier(tier)
    } else {
        1
    };
    save.pets.push(PetInstance {
        id: id.clone(),
        species: species.clone(),
        tier,
        level,
        exp: 0,
        stamina: config.stamina_max,
        stamina_updated_at: now,
        exhausted: false,
        pending_fusion: None,
        key_buffer: 0,
        token_buffer: 0,
        steam_item_id: None,
        steam_item_def: None,
    });
    if capacity_exempt {
        save.capacity_exempt_pet_ids.insert(id.clone());
    }
    record_species_obtained(save, &species);
    if start_maxed {
        save.stats.first_maxlevel_done = true;
    }
    save.stats.highest_tier = save.stats.highest_tier.max(tier);
    if save.active_pet_id.is_none() {
        save.active_pet_id = Some(id.clone());
    }
    Ok(id)
}

fn grant_elements(
    config: &GameConfig,
    save: &mut GameSave,
    elements: &[&str],
    now: i64,
    capacity_exempt: bool,
) -> Result<(), String> {
    let species: Result<Vec<String>, String> = elements
        .iter()
        .map(|element| {
            config
                .species_by_recipe
                .get(*element)
                .cloned()
                .ok_or_else(|| format!("#missingRecipe|recipe={element}"))
        })
        .collect();
    // Resolve every species before mutating so the transaction cannot partially grant.
    for codename in species? {
        grant_pet(config, save, codename, 1, now, capacity_exempt, true)?;
    }
    Ok(())
}

/// Skipping the route replaces the four hands-on tutorial fusions with their
/// canonical level-one results. `tutorial_fusions` is also the durable receipt:
/// a player who already performed part of the route receives only the missing
/// results, and retrying the skip cannot duplicate any reward.
pub(crate) fn logic_grant_skipped_onboarding_fusions(
    config: &GameConfig,
    save: &mut GameSave,
    now: i64,
) -> Result<(), String> {
    if save.onboarding.status != "active" {
        return Ok(());
    }
    let completed = usize::from(save.onboarding.tutorial_fusions.min(4));
    let grants: Result<Vec<(String, String, [String; 2], [u32; 2], u32)>, String> =
        TUTORIAL_FUSION_RECIPES[completed..]
            .iter()
            .map(|recipe| {
                let species = config
                    .species_by_recipe
                    .get(*recipe)
                    .cloned()
                    .ok_or_else(|| format!("#missingRecipe|recipe={recipe}"))?;
                let mut elements = recipe.split('+');
                let element_a = elements
                    .next()
                    .ok_or_else(|| format!("#missingRecipe|recipe={recipe}"))?;
                let element_b = elements
                    .next()
                    .ok_or_else(|| format!("#missingRecipe|recipe={recipe}"))?;
                let parent_a = config
                    .species_by_recipe
                    .get(element_a)
                    .cloned()
                    .ok_or_else(|| format!("#missingRecipe|recipe={element_a}"))?;
                let parent_b = config
                    .species_by_recipe
                    .get(element_b)
                    .cloned()
                    .ok_or_else(|| format!("#missingRecipe|recipe={element_b}"))?;
                let def_a = config
                    .steam_def_for_species(&parent_a)
                    .ok_or_else(|| "#missingSteamMapping".to_string())?;
                let def_b = config
                    .steam_def_for_species(&parent_b)
                    .ok_or_else(|| "#missingSteamMapping".to_string())?;
                let target_def = crate::steam_sync::exchange_target_def(config, recipe)
                    .ok_or_else(|| format!("#missingSteamMapping|recipe={recipe}"))?;
                Ok((
                    (*recipe).to_string(),
                    species,
                    [parent_a, parent_b],
                    [def_a, def_b],
                    target_def,
                ))
            })
            .collect();

    for (recipe, codename, parents, material_defs, target_def) in grants? {
        let pet_id = grant_pet(config, save, codename, 2, now, true, false)?;
        save.steam_outbox.push(SteamOp::Fuse {
            op_id: new_id("op"),
            pet_a: String::new(),
            pet_b: String::new(),
            item_a: String::new(),
            item_b: String::new(),
            egg_def: target_def,
            recipe_key: recipe,
            applied: true,
            awaiting_result: false,
            mat_def_a: material_defs[0],
            mat_def_b: material_defs[1],
            egg_id: None,
            pet_id: Some(pet_id),
            parents: Some(parents),
            attempts: 0,
            next_retry_at: 0,
        });
    }
    save.onboarding.tutorial_fusions = 4;
    save.tutorial_first_fusion_done = true;
    Ok(())
}

pub(crate) fn grant_first_fusion_roster(
    config: &GameConfig,
    save: &mut GameSave,
    now: i64,
) -> Result<(), String> {
    // Receipts are not enough to prove that a usable parent still exists: an older
    // three-pet grant could be consumed by the first two guided fusions before this
    // six-pet route was installed, and a partial Steam snapshot can temporarily prune
    // an unbound reward. Ensure one actual max-level tier-1 pet for every base element.
    let missing: Vec<&str> = BASE_ELEMENTS
        .iter()
        .copied()
        .filter(|element| !has_max_base_pet(config, save, element))
        .collect();
    grant_elements(config, save, &missing, now, true)?;
    save.onboarding.starter_trio_claimed = true;
    save.onboarding.post_practice_roster_claimed = true;
    Ok(())
}

fn has_max_base_pet(config: &GameConfig, save: &GameSave, element: &str) -> bool {
    save.pets.iter().any(|pet| {
        pet.tier == 1
            && pet.level >= config.max_level_for_tier(1)
            && species_info(config, save, &pet.species)
                .map(|info| info.elements.as_slice() == [element])
                .unwrap_or(false)
    })
}

/// The second yard upgrade immediately grants a fresh, independent six-pet set.
/// This receipt must not reuse the first-fusion roster flag: even if older parents
/// survived, the player is entitled to six new max-level tier-1 fusion materials.
fn grant_post_yard_roster(
    config: &GameConfig,
    save: &mut GameSave,
    now: i64,
) -> Result<bool, String> {
    if save.onboarding.post_yard_roster_claimed {
        return Ok(false);
    }
    grant_elements(config, save, &BASE_ELEMENTS, now, true)?;
    save.onboarding.post_yard_roster_claimed = true;
    Ok(true)
}

/// Recover B05 when a collected Steam AI-slot result has already replaced its egg.
/// The tier on the owned pet is authoritative: optional local AI species metadata may
/// still be absent even though Steam has granted and bound the result successfully.
pub(crate) fn repair_collected_first_fusion(
    config: &GameConfig,
    save: &mut GameSave,
    now: i64,
) -> Result<bool, String> {
    let collected = save.onboarding.status == "active"
        && save.onboarding.step == "B05"
        && save.onboarding.tutorial_fusions >= 1
        && save.pets.iter().any(|pet| pet.tier >= 2);
    if !collected {
        return Ok(false);
    }
    logic_advance_onboarding(config, save, "B05", now)?;
    Ok(true)
}

/// Backfill the D10 collection gate for saves created before guided egg ids were
/// persisted. Only the two frozen classic recipes are considered; unrelated eggs
/// never rewind the route. D11/E01/E02 are returned to D10 while either result waits.
pub(crate) fn repair_guided_fusion_collection(config: &GameConfig, save: &mut GameSave) -> bool {
    if save.onboarding.status != "active" || save.onboarding.tutorial_fusions < 4 {
        return false;
    }
    let eligible_step = matches!(save.onboarding.step.as_str(), "D10" | "D11" | "E01" | "E02");
    if !eligible_step {
        return false;
    }
    let expected: std::collections::BTreeSet<&str> = TUTORIAL_FUSION_RECIPES[2..]
        .iter()
        .filter_map(|recipe| config.species_by_recipe.get(*recipe).map(String::as_str))
        .collect();
    let live_egg_ids: std::collections::BTreeSet<&str> =
        save.eggs.iter().map(|egg| egg.id.as_str()).collect();
    let mut changed = false;
    let receipt_count = save.onboarding.guided_fusion_egg_ids.len();
    save.onboarding
        .guided_fusion_egg_ids
        .retain(|egg_id| live_egg_ids.contains(egg_id.as_str()));
    changed |= save.onboarding.guided_fusion_egg_ids.len() != receipt_count;
    let pending: Vec<String> = save
        .eggs
        .iter()
        .filter(|egg| egg.tier == 2 && expected.contains(egg.species.as_str()))
        .map(|egg| egg.id.clone())
        .collect();
    for egg_id in pending {
        changed |= save.onboarding.guided_fusion_egg_ids.insert(egg_id);
    }
    if !save.onboarding.guided_fusion_egg_ids.is_empty() && save.onboarding.step != "D10" {
        save.onboarding.step = "D10".to_string();
        save.onboarding.factory_formal_entered = false;
        changed = true;
    }
    changed
}

/// Repair the durable D10 checkpoint from actual inventory facts. Legacy saves
/// first receive the complete post-yard six-pet set; a later partial Steam snapshot
/// can still recreate only the parents required by the unfinished recipes.
pub(crate) fn repair_guided_fusion_parents(
    config: &GameConfig,
    save: &mut GameSave,
    now: i64,
) -> Result<bool, String> {
    if save.onboarding.status != "active"
        || save.onboarding.step != "D10"
        || !(2..4).contains(&save.onboarding.tutorial_fusions)
    {
        return Ok(false);
    }

    let mut changed = grant_post_yard_roster(config, save, now)?;

    let mut required = std::collections::BTreeSet::new();
    for recipe in &TUTORIAL_FUSION_RECIPES[usize::from(save.onboarding.tutorial_fusions)..] {
        required.extend(recipe.split('+'));
    }
    let missing: Vec<&str> = required
        .into_iter()
        .filter(|element| !has_max_base_pet(config, save, element))
        .collect();
    if missing.is_empty() {
        return Ok(changed);
    }
    grant_elements(config, save, &missing, now, true)?;
    changed = true;
    Ok(changed)
}

pub(crate) fn logic_advance_onboarding(
    config: &GameConfig,
    save: &mut GameSave,
    completed_step: &str,
    now: i64,
) -> Result<(), String> {
    if save.onboarding.status == "completed" {
        return Ok(());
    }
    let current_index = step_index(save.onboarding.step.as_str())
        .ok_or_else(|| format!("#unknownOnboardingStep|step={}", save.onboarding.step))?;
    let completed_index = step_index(completed_step)
        .ok_or_else(|| format!("#unknownOnboardingStep|step={completed_step}"))?;

    // Duplicate/stale UI receipts are idempotent. A future receipt is rejected so two guides
    // cannot race the cursor forward.
    if completed_index < current_index {
        return Ok(());
    }
    // C01～C12 是旧独立演习的兼容游标。现在唯一权威事实是“真实第一班已结算”，
    // 因而允许 C12 回执从任意 C 段位置一次性收束；其他未来回执仍严格拒绝。
    let completes_real_first_shift =
        completed_step == "C12" && ONBOARDING_STEPS[current_index].starts_with('C');
    if completed_index > current_index && !completes_real_first_shift {
        return Err(format!(
            "#onboardingOutOfOrder|expected={}|got={completed_step}",
            save.onboarding.step
        ));
    }

    match completed_step {
        "A03" => {
            if let Some(active_id) = save.active_pet_id.clone() {
                if let Some(pet) = save.pets.iter_mut().find(|pet| pet.id == active_id) {
                    pet.level = config.max_level_for_tier(pet.tier);
                    pet.exp = 0;
                    pet.stamina = config.stamina_max;
                    pet.exhausted = false;
                    save.stats.first_maxlevel_done = true;
                }
            }
        }
        // The newly hatched fire pet starts at Lv1 and remains in the yard. Its own
        // twenty-click lesson begins only after the player deliberately chooses it.
        "A15" => save.onboarding.tutorial_work_clicks = 0,
        "B05" => grant_first_fusion_roster(config, save, now)?,
        "C12" => {
            save.factory_tutorial.version = 2;
            save.factory_tutorial.status = "completed".to_string();
            save.factory_tutorial.step = "C12".to_string();
            // Migration fallback for saves that already passed B05 under the old three-pet reward.
            grant_first_fusion_roster(config, save, now)?;
        }
        "E02" => save.onboarding.factory_formal_entered = true,
        "D09" => {
            grant_post_yard_roster(config, save, now)?;
        }
        "D10" if !save.onboarding.guided_fusion_egg_ids.is_empty() => {
            return Err("#onboardingFusionEggsPending".to_string());
        }
        "G03" => save.onboarding.steam_market_open_attempted = true,
        "G07" => {
            save.onboarding.status = "completed".to_string();
            save.onboarding.step = "DONE".to_string();
            save.tutorial_step = save.tutorial_step.max(11);
            return Ok(());
        }
        _ => {}
    }

    let next_index = if completes_real_first_shift {
        step_index("C12").expect("C12 is an onboarding step") + 1
    } else {
        current_index + 1
    };
    save.onboarding.step = ONBOARDING_STEPS[next_index].to_string();
    Ok(())
}

pub(crate) fn logic_set_factory_tutorial_step(
    save: &mut GameSave,
    completed_step: &str,
) -> Result<(), String> {
    if save.factory_tutorial.status == "completed" {
        return Ok(());
    }
    let current = save.factory_tutorial.step.clone();
    let current_index = step_index(&current)
        .filter(|index| ONBOARDING_STEPS[*index].starts_with('C'))
        .ok_or_else(|| format!("#unknownFactoryTutorialStep|step={current}"))?;
    let completed_index = step_index(completed_step)
        .filter(|index| ONBOARDING_STEPS[*index].starts_with('C'))
        .ok_or_else(|| format!("#unknownFactoryTutorialStep|step={completed_step}"))?;
    if completed_index < current_index {
        return Ok(());
    }
    // 真实第一班结算是一条整体回执；C02～C11 只为旧存档保留，不再要求伪造逐步点击。
    let completes_real_first_shift = completed_step == "C12";
    if completed_index > current_index && !completes_real_first_shift {
        return Err(format!(
            "#factoryTutorialOutOfOrder|expected={current}|got={completed_step}"
        ));
    }
    if completed_step == "C12" {
        save.factory_tutorial.status = "completed".to_string();
        save.factory_tutorial.step = "C12".to_string();
        return Ok(());
    }
    save.factory_tutorial.step = ONBOARDING_STEPS[current_index + 1].to_string();
    Ok(())
}

pub(crate) fn logic_skip_agent_prompt(save: &mut GameSave) {
    save.onboarding.agent_prompt_skipped = true;
}

pub(crate) fn logic_claim_stamina_tutorial_rescue(
    config: &GameConfig,
    save: &mut GameSave,
) -> Result<(), String> {
    if save.stamina_tutorial_rescue_claimed {
        return Ok(());
    }
    let active_id = save
        .active_pet_id
        .clone()
        .ok_or_else(|| "#petNotFound".to_string())?;
    let pet = save
        .pets
        .iter_mut()
        .find(|pet| pet.id == active_id)
        .ok_or_else(|| "#petNotFound".to_string())?;
    if !pet.exhausted {
        return Err("#staminaTutorialNotExhausted".to_string());
    }
    pet.stamina = pet
        .stamina
        .max(config.wake_threshold)
        .min(config.stamina_max);
    pet.exhausted = false;
    save.stamina_tutorial_rescue_claimed = true;
    Ok(())
}
