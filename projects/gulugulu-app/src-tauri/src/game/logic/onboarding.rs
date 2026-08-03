use crate::game::*;

const BASE_ELEMENTS: [&str; 6] = ["normal", "fire", "water", "grass", "electric", "ice"];
const STARTER_TRIO: [&str; 3] = ["normal", "fire", "electric"];
const TUTORIAL_FUSION_RECIPES: [&str; 2] = ["fire+normal", "electric+water"];

const ONBOARDING_STEPS: [&str; 61] = [
    "A01", "A02", "A03", "A04", "A05", "A06", "A07", "A08", "A09", "A10", "A11", "A12", "A13",
    "A14", "A15", "A16", "A17", "A18", "A19", "B01", "B02", "B03", "B04", "B05", "B06", "B07",
    "C01", "C02", "C03", "C04", "C05", "C06", "C07", "C08", "C09", "C10", "C11", "C12", "D01",
    "D02", "D03", "D04", "D05", "D06", "D07", "D08", "E01", "E02", "E03", "F01", "F02", "F03a",
    "F04", "G01", "G02", "G03", "G04", "G05", "G06", "G07", "DONE",
];

pub(crate) fn occupied_pet_count(save: &GameSave) -> usize {
    save.pets
        .iter()
        .filter(|pet| !save.capacity_exempt_pet_ids.contains(&pet.id))
        .count()
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

fn grant_max_pet(
    config: &GameConfig,
    save: &mut GameSave,
    species: String,
    tier: u8,
    now: i64,
    capacity_exempt: bool,
) -> Result<String, String> {
    if !config.species.contains_key(&species) {
        return Err(format!("#unknownSpeciesNamed|species={species}"));
    }
    let id = new_id("pet");
    let level = config.max_level_for_tier(tier);
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
    save.stats.first_maxlevel_done = true;
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
        grant_max_pet(config, save, codename, 1, now, capacity_exempt)?;
    }
    Ok(())
}

/// Skipping the route replaces the two hands-on tutorial fusions with their
/// canonical, max-level results. `tutorial_fusions` is also the durable receipt:
/// a player who already performed one or both fusions only receives the missing
/// result, and retrying the skip cannot duplicate either reward.
pub(crate) fn logic_grant_skipped_onboarding_fusions(
    config: &GameConfig,
    save: &mut GameSave,
    now: i64,
) -> Result<(), String> {
    if save.onboarding.status != "active" {
        return Ok(());
    }
    let completed = usize::from(save.onboarding.tutorial_fusions.min(2));
    let species: Result<Vec<String>, String> = TUTORIAL_FUSION_RECIPES[completed..]
        .iter()
        .map(|recipe| {
            config
                .species_by_recipe
                .get(*recipe)
                .cloned()
                .ok_or_else(|| format!("#missingRecipe|recipe={recipe}"))
        })
        .collect();

    for codename in species? {
        grant_max_pet(config, save, codename, 2, now, true)?;
    }
    save.onboarding.tutorial_fusions = 2;
    save.tutorial_first_fusion_done = true;
    Ok(())
}

pub(crate) fn grant_starter_trio(
    config: &GameConfig,
    save: &mut GameSave,
    now: i64,
) -> Result<(), String> {
    if save.onboarding.starter_trio_claimed {
        return Ok(());
    }
    grant_elements(config, save, &STARTER_TRIO, now, false)?;
    save.onboarding.starter_trio_claimed = true;
    Ok(())
}

pub(crate) fn grant_post_practice_roster(
    config: &GameConfig,
    save: &mut GameSave,
    now: i64,
) -> Result<(), String> {
    if save.onboarding.post_practice_roster_claimed {
        return Ok(());
    }
    // This is an explicit reward, not a "fill missing species" operation: grant all six even
    // when the player already owns one. Every granted id is excluded from backyard occupancy.
    grant_elements(config, save, &BASE_ELEMENTS, now, true)?;
    save.onboarding.post_practice_roster_claimed = true;
    Ok(())
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
        "B05" => grant_starter_trio(config, save, now)?,
        "C12" => {
            save.factory_tutorial.version = 2;
            save.factory_tutorial.status = "completed".to_string();
            save.factory_tutorial.step = "C12".to_string();
            grant_post_practice_roster(config, save, now)?;
        }
        "E02" => save.onboarding.factory_formal_entered = true,
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
