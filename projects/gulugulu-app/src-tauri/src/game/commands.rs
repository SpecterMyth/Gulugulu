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

/// 「昨日战报」：上一个活跃日的当日总结（WelcomeBack 卡）。游戏统计取存档归档的
/// `last_day_digest`；Token 按同一 `day_index` 去 codex_adapter 每日桶取（raw + 四分，
/// 与公告板同口径）。无归档时口径落「今天的前一天」，游戏统计全 0（Token 可能仍非零）。
#[tauri::command]
pub fn get_yesterday_summary(
    app: AppHandle,
    state: tauri::State<'_, SharedGameState>,
) -> Result<DaySummary, String> {
    // 先结算：settle_all → ensure_daily 会在跨日时把昨天归档进 last_day_digest。
    let (_, save) = with_save(&app, state.inner(), |config, save| {
        settle_all(config, save, now_secs(), &today_string());
        Ok(())
    })?;
    let today_index = crate::codex_adapter::local_day_index();
    let mut summary = DaySummary::default();
    if let Some(digest) = save.last_day_digest.as_ref() {
        summary.date = digest.date.clone();
        summary.day_index = digest.day_index;
        summary.has_digest = true;
        summary.clicks = digest.clicks;
        summary.keys = digest.keys;
        summary.hatches = digest.hatches;
        summary.fusions = digest.fusions;
        summary.eggs_minted = digest.eggs_minted;
        summary.coins_earned = digest.coins_earned;
        summary.releases = digest.releases;
        summary.night_owl = digest.night_owl;
    } else {
        // 尚无归档：口径落「今天的前一天」，游戏统计全 0（可能仍有 Token 历史）。
        summary.day_index = today_index.saturating_sub(1);
        summary.date = date_string_of_day_index(summary.day_index);
    }
    summary.is_yesterday = summary.day_index + 1 == today_index;
    let window = crate::codex_adapter::day_token_window(&app, summary.day_index);
    summary.tokens_raw = window.total;
    summary.token_breakdown = window.breakdown;
    Ok(summary)
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

/// 催蛋：点击孵化中的蛋，孵化时间 −1s（OnboardingCoach.md #2）。
#[tauri::command]
pub fn poke_egg(
    app: AppHandle,
    state: tauri::State<'_, SharedGameState>,
    egg_id: String,
) -> Result<GameSave, String> {
    let (_, save) = with_save(&app, state.inner(), |_config, save| {
        logic_poke_egg(save, &egg_id, now_secs());
        Ok(())
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
    /// 本地路径已应用完毕（一阶本地先行 / 宠物物品绑定蛋 / 遗留本地蛋）。
    Done,
    /// 旧流 legacy 蛋物品（301-321）：意图已写入，待 Steam 兑换孵化生成器。
    NeedExchange { op_id: String, egg_item: String, egg_def: u32 },
    /// 商店蛋（2 阶+，2026-07-16 Steam-first）：待 TriggerItemDrop 商店生成器，
    /// 物种以实发 def 为准（本地 species 只是展示预测）。`element`/`tier` 供成功后累加
    /// 收取侧计数；`collects_today`/`cap`/`last_drop_at` 是阶段 1 快照，供空发放时归因
    /// （阶段 1 到空发放之间本颗蛋未成功收取，计数不变，故快照准确）。
    NeedDrop {
        gen_def: u32,
        element: String,
        tier: u8,
        collects_today: u32,
        cap: u32,
        last_drop_at: i64,
    },
}

/// 商店蛋 `TriggerItemDrop` 成功但零物品时，据收取侧本地信号区分三类幽默文案。
///
/// Valve 对「24h 窗口满」「per-def `drop_interval:1` 分钟级限频」「游玩时长不足」都统一
/// 回「成功 + 0 物品」，客户端**无法从 API 分辨**（steam_inventory::collect_items 只见空集）。
/// 于是用本地收取侧计数 / 时间戳**近似归因**——不追求精确（Valve 是 24h 滚动窗口、本地按
/// 日历日计数，跨午夜会有偏差），三类落点都是「稍后再收」，只为把提示说人话。
pub(crate) fn empty_drop_message(collects_today: u32, cap: u32, last_drop_at: i64, now: i64) -> String {
    // per-def `drop_interval:1`（1 分钟游玩时长）+ 服务器侧时长聚合滞后 → 冷却从宽判 90s。
    const DROP_COOLDOWN_SECS: i64 = 90;
    if cap > 0 && collects_today >= cap {
        format!("#dropWindowCapped|cap={cap}")
    } else if last_drop_at > 0 && now - last_drop_at < DROP_COOLDOWN_SECS {
        "#dropCooldown".to_string()
    } else {
        "#dropPlaytimeShort".to_string()
    }
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
    // 重新开启后，未同步 Steam 宠物由 migration_sweep 补入发放队列。
    if !crate::steam::integration_enabled() {
        let (_, save) = with_save(&app, &game_state, |config, save| {
            logic_collect_hatched(config, save, &egg_id, now, &today).map(|_| ())
        })?;
        return Ok(save);
    }

    // 阶段 1（存档锁内，无 Steam 调用）：校验 + 分流；本地路径直接应用。
    let (plan, save) = with_save(&app, &game_state, |config, save| {
        settle_all(config, save, now, &today);
        // 本地先行融合的**未绑定结果蛋**、且物种已知（非神秘/AI 生成中）→ 允许**早收**（不阻挡新手引导）：
        // 本地把蛋转成宠，并把该 Fuse op 的回绑目标从蛋改到这只宠（泵铸出结果后绑到宠）。无 Steam 调用。
        // 教学首融即此类（确定性 canonical 物种）；神秘蛋（union-gen 待生成）仍走下方 op-lock，等 sync+生成保 AI 身份。
        if let Some(op_idx) = save.steam_outbox.iter().position(|op| {
            matches!(op, SteamOp::Fuse { applied: true, egg_id: Some(e), .. } if e == &egg_id)
        }) {
            let known = save
                .eggs
                .iter()
                .find(|e| e.id == egg_id)
                .map(|e| e.pending_fusion.is_none())
                .unwrap_or(false);
            if known {
                let egg_index = validate_collect(config, save, &egg_id, now)?;
                let pet_id = apply_collect(config, save, egg_index, now, None);
                if let SteamOp::Fuse { egg_id: e, pet_id: p, .. } = &mut save.steam_outbox[op_idx] {
                    *e = None;
                    *p = Some(pet_id);
                }
                return Ok(CollectPlan::Done);
            }
        }
        if crate::steam_sync::op_locked_ids(save).contains(&egg_id) {
            return Err("#eggOpInProgress".to_string());
        }
        let egg_index = validate_collect(config, save, &egg_id, now)?;
        let egg = &save.eggs[egg_index];
        if let (Some(item), Some(def)) = (egg.steam_item_id.clone(), egg.steam_item_def) {
            // 融合 2.0 同步流：蛋绑的是**结果宠物物品**（融合时已兑换到手）
            // → 收取纯本地绑定，无 Steam 调用（离线也能收）。
            if crate::steam_sync::species_codename_for_def(config, def).is_some() {
                let species = crate::steam_sync::collect_species_for(config, save, egg_index, def);
                apply_collect(config, save, egg_index, now, Some((species, item, def)));
                return Ok(CollectPlan::Done);
            }
            // 旧流 legacy 蛋物品（301-321）→ Steam 先行兑换孵化生成器。
            if !steam_state.is_connected() {
                return Err("#needSteamForTier2Hatch".to_string());
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
        // 商店蛋 2 阶+（随机池）→ Steam 先行 TriggerItemDrop 商店生成器
        //（EconomyScaling §7.5：窗口封顶在 Valve 侧，物种以实发 def 为准）。
        if egg.tier >= 2 && egg.pending_fusion.is_none() {
            if let Some(element) = egg.shop_element.clone() {
                if !steam_state.is_connected() {
                    return Err("#needSteamForShopEgg".to_string());
                }
                let tier = egg.tier;
                let tier1_def = config
                    .base_species_for_element(&element)
                    .and_then(|s| config.steam_def_for_species(&s))
                    .ok_or_else(|| "#missingTier1Mapping".to_string())?;
                let collect_key = format!("{element}:{tier}");
                return Ok(CollectPlan::NeedDrop {
                    gen_def: crate::fusion_slots::shop_gen_def(tier, tier1_def),
                    collects_today: save.daily.egg_collects.get(&collect_key).copied().unwrap_or(0),
                    cap: config.egg_daily_mint_cap(tier),
                    last_drop_at: save.last_shop_drop_at,
                    element,
                    tier,
                });
            }
        }
        // 一阶（含教程蛋）本地先行：玩家已花金币+等待，体验不回退；
        // Steam 侧入 MintTier1 队列，哪怕当前无 Steam 也照队（数年后仍可发）。
        let species = egg.species.clone();
        let tier1_def = if egg.tier == 1 {
            config.steam_def_for_species(&species)
        } else {
            None // 遗留二阶本地蛋（无 shop_element 的 Steam-off 融合蛋等）：本地徽章宠。
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

    // ---- 商店蛋 Steam-first：TriggerItemDrop → 拆栈 → 按实发 def 落宠 ----
    if let CollectPlan::NeedDrop { gen_def, element, tier, collects_today, cap, last_drop_at } = plan {
        // 阶段 2（锁外）：打商店生成器。无写前意图——drop 不消耗任何东西；
        // 崩在“已发未落”窗口的物品会被对账导入，蛋保留可重收（窗口封顶防膨胀）。
        let outcome = steam_state.call_blocking(crate::steam::SteamCall::TriggerDrop { def: gen_def });
        let granted = match &outcome {
            crate::steam_inventory::OpOutcome::Granted(items) if !items.is_empty() => items[0].clone(),
            // 成功但零物品：Valve 对窗口满/分钟级限频/时长不足统一如此回 → 本地归因分档。
            crate::steam_inventory::OpOutcome::Granted(_) => {
                return Err(empty_drop_message(collects_today, cap, last_drop_at, now))
            }
            crate::steam_inventory::OpOutcome::Failed(error) => {
                return Err(format!("#steamDropFailed|err={error}"))
            }
            crate::steam_inventory::OpOutcome::Uncertain => {
                return Err("#steamDropTimeout".to_string())
            }
        };
        // 阶段 2.5（锁外）：落在堆叠上则拆 1 个出来绑定（A5 实证掉落会堆叠）。
        let (item_id, item_def) = crate::steam::ensure_distinct_item(&steam_state, &granted)?;
        // 阶段 3（锁内）：物种取实发 def，落宠 + 绑定；累加收取侧计数 + 记冷却时间戳。
        let (_, save) = with_save(&app, &game_state, |config, save| {
            let egg_index = save
                .eggs
                .iter()
                .position(|e| e.id == egg_id)
                .ok_or_else(|| "#eggGone".to_string())?;
            let species = crate::steam_sync::collect_species_for(config, save, egg_index, item_def);
            apply_collect(config, save, egg_index, now, Some((species, item_id.clone(), item_def)));
            *save.daily.egg_collects.entry(format!("{element}:{tier}")).or_insert(0) += 1;
            save.last_shop_drop_at = now;
            Ok(())
        })?;
        return Ok(save);
    }

    let CollectPlan::NeedExchange { op_id, egg_item, egg_def } = plan else {
        return Ok(save);
    };

    // 阶段 2（锁外）：兑换孵化生成器（蛋 → Valve 掷骰出宠物）。
    let destroy = egg_item
        .parse::<u64>()
        .map_err(|_| "#steamItemIdCorrupt".to_string())?;
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
                    .ok_or_else(|| "#eggGone".to_string())?;
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
                Err("#steamExchangeNoItem".to_string())
            }
            crate::steam_inventory::OpOutcome::Failed(error) => {
                if let Some(index) = index {
                    save.steam_outbox.remove(index);
                }
                Err(format!("#steamExchangeFailed|err={error}"))
            }
            crate::steam_inventory::OpOutcome::Uncertain => {
                Err("#steamTimeoutWillVerify".to_string())
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
        // 已同步 Steam 素材必须走 fuse_pets_ai 的三段式（Steam 先行烧材料）；
        // 本命令只保留给未同步 Steam的遗留本地宠物。集成关闭时不设限（本地调试模式）。
        let bound = crate::steam::integration_enabled()
            && save.pets.iter().any(|p| {
                (p.id == id_a || p.id == id_b) && p.steam_item_id.is_some()
            });
        if bound {
            return Err("#fuseBoundPetsUseAi".to_string());
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

    let ((refund, queued_consume), save) = with_save(&app, &game_state, |config, save| {
        settle_all(config, save, now, &today);
        if save.pets.len() <= 1 {
            return Err("#lastPetCannotRelease".to_string());
        }
        if crate::steam_sync::op_locked_ids(save).contains(&pet_id) {
            return Err("#petOpInProgress".to_string());
        }
        let pet = save
            .pets
            .iter()
            .find(|p| p.id == pet_id)
            .ok_or_else(|| "#petNotFound".to_string())?;
        match pet.steam_item_id.clone() {
            Some(item_id) => {
                // 已同步 Steam → **本地先行**（2026-07-18 用户拍板：Steam 慢就后台等，放生
                // 即时生效）：立即删宠+返还，ConsumeItem 排进 outbox 由泵线程限频重试
                // 收敛（镜像 MintTier1）。复制防线：applied Release 的物品 id 计入
                // steam_sync::bound_item_ids —— 对账/认领/手动导入在消耗前一律跳过
                // 该物品，不会被回导成新宠（金币永动机的旧口子仍然封死）。
                if !steam_state.is_connected() {
                    return Err("#needSteamForRelease".to_string());
                }
                let refund = release_refund_for(config, save, &pet_id)?;
                apply_release(save, &pet_id, refund);
                save.steam_outbox.push(SteamOp::Release {
                    op_id: new_id("op"),
                    pet_id: pet_id.clone(),
                    item_id,
                    applied: true,
                    attempts: 0,
                    next_retry_at: 0,
                });
                Ok((refund, true))
            }
            None => {
                // 待发放 → 撤销 mint（物品从未发出，供给守恒）；本地遗留 → 纯本地。
                if let Some(mint_index) = crate::steam_sync::pending_mint_for(save, &pet_id) {
                    save.steam_outbox.remove(mint_index);
                }
                let refund = release_refund_for(config, save, &pet_id)?;
                apply_release(save, &pet_id, refund);
                Ok((refund, false))
            }
        }
    })?;

    // 排了消耗 op → 非阻塞踢一轮同步让后台尽快收敛（踢不动无妨，60s 巡检兜底）。
    if queued_consume {
        steam_state.kick_sync();
    }
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

