use super::*;

// ---------------------------------------------------------------------------
// IPC commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_game_state(app: AppHandle, state: tauri::State<'_, SharedGameState>) -> Result<GameSave, String> {
    let (_, save) = with_save(&app, state.inner(), |config, save| {
        settle_all(config, save, now_secs(), &today_string());
        Ok(())
    })?;
    Ok(save)
}

#[tauri::command]
pub fn get_game_config(state: tauri::State<'_, SharedGameState>) -> GameConfigPayload {
    GameConfigPayload {
        test_mode: is_test_mode(),
        config: state.config.clone(),
    }
}

#[tauri::command]
pub fn click_work(
    app: AppHandle,
    state: tauri::State<'_, SharedGameState>,
    pet_id: String,
) -> Result<ClickWorkResult, String> {
    let (outcome, save) = with_save(&app, state.inner(), |config, save| {
        logic_click_work(config, save, &pet_id, now_secs(), &today_string())
    })?;
    Ok(ClickWorkResult {
        save,
        coins_gained: outcome.coins_gained,
        exp_gained: outcome.exp_gained,
        leveled_up: outcome.leveled_up,
        became_exhausted: outcome.became_exhausted,
        daily_capped: outcome.daily_capped,
    })
}

#[tauri::command]
pub fn buy_egg(
    app: AppHandle,
    state: tauri::State<'_, SharedGameState>,
    element: String,
    tier: u8,
) -> Result<GameSave, String> {
    let (_, save) = with_save(&app, state.inner(), |config, save| {
        logic_buy_egg(config, save, &element, tier, now_secs(), &today_string())
    })?;
    Ok(save)
}

#[tauri::command]
pub fn place_egg(
    app: AppHandle,
    state: tauri::State<'_, SharedGameState>,
    egg_id: String,
    slot: u8,
) -> Result<GameSave, String> {
    let (_, save) = with_save(&app, state.inner(), |config, save| {
        logic_place_egg(config, save, &egg_id, slot, now_secs(), &today_string())
    })?;
    Ok(save)
}

/// 收取的三段式分流结果（阶段 1 产物）。
pub(crate) enum CollectPlan {
    /// 本地路径已应用完毕（一阶本地先行 / 遗留本地蛋）。
    Done,
    /// 二阶绑定蛋：意图已写入，待 Steam 兑换。
    NeedExchange { op_id: String, egg_item: String, egg_def: u32 },
}

pub(crate) fn collect_hatched_blocking(
    app: AppHandle,
    game_state: SharedGameState,
    steam_state: crate::steam::SharedSteamState,
    egg_id: String,
) -> Result<GameSave, String> {
    use crate::game_config::STEAM_HATCH_GEN_OFFSET;
    let now = now_secs();
    let today = today_string();

    // Steam 集成关闭（本地调试模式）：一律走纯本地收取，不入队、不兑换。
    // 重新开启后，未上链宠物由 migration_sweep 补入发放队列。
    if !crate::steam::integration_enabled() {
        let (_, save) = with_save(&app, &game_state, |config, save| {
            logic_collect_hatched(config, save, &egg_id, now, &today).map(|_| ())
        })?;
        return Ok(save);
    }

    // 阶段 1（存档锁内，无 Steam 调用）：校验 + 分流；本地路径直接应用。
    let (plan, save) = with_save(&app, &game_state, |config, save| {
        settle_all(config, save, now, &today);
        if crate::steam_sync::op_locked_ids(save).contains(&egg_id) {
            return Err("这颗蛋的 Steam 操作进行中，请稍候".to_string());
        }
        let egg_index = validate_collect(config, save, &egg_id, now)?;
        let egg = &save.eggs[egg_index];
        if let (Some(item), Some(def)) = (egg.steam_item_id.clone(), egg.steam_item_def) {
            // 二阶绑定蛋 → Steam 先行（掷骰在 Valve 侧，物种以发放 def 为准）。
            if !steam_state.is_connected() {
                return Err("需要连接 Steam 才能孵化 2 阶精灵".to_string());
            }
            let op_id = new_id("op");
            save.steam_outbox.push(SteamOp::CollectT2 {
                op_id: op_id.clone(),
                egg_id: egg_id.clone(),
                egg_item: item.clone(),
                egg_def: def,
            });
            return Ok(CollectPlan::NeedExchange {
                op_id,
                egg_item: item,
                egg_def: def,
            });
        }
        // 一阶（含教程蛋）本地先行：玩家已花金币+等待，体验不回退；
        // Steam 侧入 MintTier1 队列，哪怕当前无 Steam 也照队（数年后仍可发）。
        let species = egg.species.clone();
        let tier1_def = if egg.tier == 1 {
            config.steam_def_for_species(&species)
        } else {
            None // 遗留二阶本地蛋：孵出"本地"徽章宠物，不上 Steam。
        };
        let pet_id = apply_collect(config, save, egg_index, now, None);
        if let Some(def) = tier1_def {
            save.steam_outbox.push(SteamOp::MintTier1 {
                op_id: new_id("op"),
                pet_id,
                species,
                def,
                attempts: 0,
                next_retry_at: 0,
            });
        }
        Ok(CollectPlan::Done)
    })?;

    let CollectPlan::NeedExchange { op_id, egg_item, egg_def } = plan else {
        return Ok(save);
    };

    // 阶段 2（锁外）：兑换孵化生成器（蛋 → Valve 掷骰出宠物）。
    let destroy = egg_item
        .parse::<u64>()
        .map_err(|_| "Steam 物品 id 损坏，请先同步".to_string())?;
    let outcome = steam_state.call_blocking(crate::steam::SteamCall::Exchange {
        generate_def: egg_def + STEAM_HATCH_GEN_OFFSET,
        destroy: vec![destroy],
    });

    // 阶段 3（存档锁内）：应用 / 回滚。Uncertain 保留意图交给探测。
    let (_, save) = with_save(&app, &game_state, |config, save| {
        let index = save
            .steam_outbox
            .iter()
            .position(|op| matches!(op, SteamOp::CollectT2 { op_id: id, .. } if *id == op_id));
        match &outcome {
            crate::steam_inventory::OpOutcome::Granted(items) if !items.is_empty() => {
                if let Some(index) = index {
                    save.steam_outbox.remove(index);
                }
                let egg_index = save
                    .eggs
                    .iter()
                    .position(|e| e.id == egg_id)
                    .ok_or_else(|| "蛋已不存在".to_string())?;
                let granted = &items[0];
                let species =
                    crate::steam_sync::collect_species_for(config, save, egg_index, granted.def);
                apply_collect(
                    config,
                    save,
                    egg_index,
                    now,
                    Some((species, granted.item_id.clone(), granted.def)),
                );
                Ok(())
            }
            crate::steam_inventory::OpOutcome::Granted(_) => {
                if let Some(index) = index {
                    save.steam_outbox.remove(index);
                }
                Err("Steam 兑换未发放物品，已取消本次孵化".to_string())
            }
            crate::steam_inventory::OpOutcome::Failed(error) => {
                if let Some(index) = index {
                    save.steam_outbox.remove(index);
                }
                Err(format!("Steam 兑换失败：{error}"))
            }
            crate::steam_inventory::OpOutcome::Uncertain => {
                Err("Steam 响应超时，稍后自动核对".to_string())
            }
        }
    })?;
    Ok(save)
}

#[tauri::command]
pub async fn collect_hatched(
    app: AppHandle,
    state: tauri::State<'_, SharedGameState>,
    steam: tauri::State<'_, crate::steam::SharedSteamState>,
    egg_id: String,
) -> Result<GameSave, String> {
    let game_state = state.inner().clone();
    let steam_state = steam.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        collect_hatched_blocking(app, game_state, steam_state, egg_id)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub fn fuse_pets(
    app: AppHandle,
    state: tauri::State<'_, SharedGameState>,
    id_a: String,
    id_b: String,
) -> Result<GameSave, String> {
    let (_, save) = with_save(&app, state.inner(), |config, save| {
        // 已上链素材必须走 fuse_pets_ai 的三段式（Steam 先行烧材料）；
        // 本命令只保留给未上链的遗留本地宠物。集成关闭时不设限（本地调试模式）。
        let bound = crate::steam::integration_enabled()
            && save.pets.iter().any(|p| {
                (p.id == id_a || p.id == id_b) && p.steam_item_id.is_some()
            });
        if bound {
            return Err("已上链的精灵请在融合台操作（需要 Steam 兑换）".to_string());
        }
        logic_fuse_pets(config, save, &id_a, &id_b, now_secs(), &today_string())
    })?;
    Ok(save)
}

#[tauri::command]
pub fn upgrade_hatchery(app: AppHandle, state: tauri::State<'_, SharedGameState>) -> Result<GameSave, String> {
    let (_, save) = with_save(&app, state.inner(), |config, save| {
        logic_upgrade_hatchery(config, save, now_secs(), &today_string())
    })?;
    Ok(save)
}

#[tauri::command]
pub fn upgrade_yard(app: AppHandle, state: tauri::State<'_, SharedGameState>) -> Result<GameSave, String> {
    let (_, save) = with_save(&app, state.inner(), |config, save| {
        logic_upgrade_yard(config, save, now_secs(), &today_string())
    })?;
    Ok(save)
}

#[tauri::command]
pub fn upgrade_shop(app: AppHandle, state: tauri::State<'_, SharedGameState>) -> Result<GameSave, String> {
    let (_, save) = with_save(&app, state.inner(), |config, save| {
        logic_upgrade_shop(config, save, now_secs(), &today_string())
    })?;
    Ok(save)
}

/// 放生三段式分流（阶段 1 产物）。
pub(crate) enum ReleasePlan {
    /// 本地路径已应用（待发放宠物撤 op / 本地遗留宠物）。
    Done(u64),
    /// 绑定宠物：意图已写入，待 ConsumeItem。
    NeedConsume { op_id: String, item_id: String },
}

pub(crate) fn release_pet_blocking(
    app: AppHandle,
    game_state: SharedGameState,
    steam_state: crate::steam::SharedSteamState,
    pet_id: String,
) -> Result<ReleasePetResult, String> {
    let now = now_secs();
    let today = today_string();

    // Steam 集成关闭（本地调试模式）：一律纯本地放生，不做 ConsumeItem。
    if !crate::steam::integration_enabled() {
        let (refund, save) = with_save(&app, &game_state, |config, save| {
            logic_release_pet(config, save, &pet_id, now, &today)
        })?;
        return Ok(ReleasePetResult { save, refund });
    }

    let (plan, save) = with_save(&app, &game_state, |config, save| {
        settle_all(config, save, now, &today);
        if save.pets.len() <= 1 {
            return Err("最后一只伙伴不能放生".to_string());
        }
        if crate::steam_sync::op_locked_ids(save).contains(&pet_id) {
            return Err("这只精灵的 Steam 操作进行中，请稍候".to_string());
        }
        let pet = save
            .pets
            .iter()
            .find(|p| p.id == pet_id)
            .ok_or_else(|| "找不到这只精灵".to_string())?;
        match pet.steam_item_id.clone() {
            Some(item_id) => {
                // 已上链 → Steam 先行 ConsumeItem（否则删本地→物品回导=金币永动机）。
                if !steam_state.is_connected() {
                    return Err("需要连接 Steam 才能放生此精灵".to_string());
                }
                let op_id = new_id("op");
                save.steam_outbox.push(SteamOp::Release {
                    op_id: op_id.clone(),
                    pet_id: pet_id.clone(),
                    item_id: item_id.clone(),
                });
                Ok(ReleasePlan::NeedConsume { op_id, item_id })
            }
            None => {
                // 待发放 → 撤销 mint（物品从未发出，供给守恒）；本地遗留 → 纯本地。
                if let Some(mint_index) = crate::steam_sync::pending_mint_for(save, &pet_id) {
                    save.steam_outbox.remove(mint_index);
                }
                let refund = release_refund_for(config, save, &pet_id)?;
                apply_release(save, &pet_id, refund);
                Ok(ReleasePlan::Done(refund))
            }
        }
    })?;

    let (op_id, item_id) = match plan {
        ReleasePlan::Done(refund) => return Ok(ReleasePetResult { save, refund }),
        ReleasePlan::NeedConsume { op_id, item_id } => (op_id, item_id),
    };

    let item = item_id
        .parse::<u64>()
        .map_err(|_| "Steam 物品 id 损坏，请先同步".to_string())?;
    let outcome = steam_state.call_blocking(crate::steam::SteamCall::Consume { item_id: item });

    let (refund, save) = with_save(&app, &game_state, |config, save| {
        let index = save
            .steam_outbox
            .iter()
            .position(|op| matches!(op, SteamOp::Release { op_id: id, .. } if *id == op_id));
        match &outcome {
            // Consume 的结果集只含被消耗条目（quantity 0，被过滤）→ 空 Granted 即成功。
            crate::steam_inventory::OpOutcome::Granted(_) => {
                if let Some(index) = index {
                    save.steam_outbox.remove(index);
                }
                let refund = release_refund_for(config, save, &pet_id)?;
                apply_release(save, &pet_id, refund);
                Ok(refund)
            }
            crate::steam_inventory::OpOutcome::Failed(error) => {
                if let Some(index) = index {
                    save.steam_outbox.remove(index);
                }
                Err(format!("Steam 消耗物品失败：{error}"))
            }
            crate::steam_inventory::OpOutcome::Uncertain => {
                Err("Steam 响应超时，稍后自动核对".to_string())
            }
        }
    })?;
    Ok(ReleasePetResult { save, refund })
}

#[tauri::command]
pub async fn release_pet(
    app: AppHandle,
    state: tauri::State<'_, SharedGameState>,
    steam: tauri::State<'_, crate::steam::SharedSteamState>,
    pet_id: String,
) -> Result<ReleasePetResult, String> {
    let game_state = state.inner().clone();
    let steam_state = steam.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        release_pet_blocking(app, game_state, steam_state, pet_id)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub fn set_active_pet(
    app: AppHandle,
    state: tauri::State<'_, SharedGameState>,
    pet_id: String,
) -> Result<GameSave, String> {
    let (_, save) = with_save(&app, state.inner(), |_config, save| {
        logic_set_active_pet(save, &pet_id)
    })?;
    Ok(save)
}

#[tauri::command]
pub fn advance_tutorial(
    app: AppHandle,
    state: tauri::State<'_, SharedGameState>,
    step: u8,
) -> Result<GameSave, String> {
    let (_, save) = with_save(&app, state.inner(), |_config, save| {
        if step > save.tutorial_step {
            save.tutorial_step = step;
        }
        Ok(())
    })?;
    Ok(save)
}

#[tauri::command]
pub fn wander_snack(app: AppHandle, state: tauri::State<'_, SharedGameState>) -> Result<WanderSnackResult, String> {
    let (stamina_gained, save) = with_save(&app, state.inner(), |config, save| {
        Ok(logic_wander_snack(config, save, now_secs(), &today_string()))
    })?;
    Ok(WanderSnackResult { save, stamina_gained })
}

