    use super::*;
    use crate::game_config::GameConfig;

    fn test_config() -> GameConfig {
        serde_json::from_str(include_str!("../../../src/game/config.json")).unwrap()
    }

    fn fresh_save(config: &GameConfig) -> GameSave {
        create_initial_save(config, 0, BTreeMap::new(), 1000, "2026-07-07")
    }

    fn add_pet(save: &mut GameSave, config: &GameConfig, species: &str, level: u32) -> String {
        // 新物种无自带 tier（0）→ 默认按一阶；旧 legacy 物种沿用自带 tier。
        let tier = config.species.get(species).map(|s| s.tier).filter(|t| *t > 0).unwrap_or(1);
        add_pet_at_tier(save, config, species, tier, level)
    }

    /// 显式指定阶数造宠（多阶融合测试用）。
    fn add_pet_at_tier(save: &mut GameSave, config: &GameConfig, species: &str, tier: u8, level: u32) -> String {
        let id = new_id("pet");
        save.pets.push(PetInstance {
            id: id.clone(),
            species: species.to_string(),
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
            save.active_pet_id = Some(id.clone());
        }
        id
    }

    #[test]
    fn initial_save_has_tutorial_egg_and_bonus_coins() {
        let config = test_config();
        let save = create_initial_save(&config, 500, BTreeMap::new(), 1000, "2026-07-07");
        assert_eq!(save.version, 5);
        assert_eq!(save.coins, config.initial_coins + config.historical_exp_coin_cap);
        assert_eq!(save.eggs.len(), 1);
        assert_eq!(save.eggs[0].slot, Some(0));
        assert_eq!(save.eggs[0].hatch_at, Some(1000 + 60));
    }

    #[test]
    fn hatching_records_dex_obtained_permanently() {
        let config = test_config();
        let mut save = create_initial_save(&config, 0, BTreeMap::new(), 1000, "2026-07-07");
        let tutorial_egg = save.eggs[0].id.clone();
        assert!(save.dex_obtained.is_empty(), "建档时图鉴为空");

        // 孵出教学蛋（60s 后）→ 曾获入册 ×1。
        logic_collect_hatched(&config, &mut save, &tutorial_egg, 2000, "2026-07-07").unwrap();
        assert_eq!(save.dex_obtained.get("guluduck"), Some(&1), "孵出即入册 ×1");

        // 再孵一只同物种 → 曾获累加到 2。
        save.eggs.push(EggInstance {
            id: "egg2".into(),
            species: "guluduck".into(),
            tier: 1,
            hatch_kind: "normal".into(),
            slot: Some(0),
            hatch_at: Some(2000),
            pending_fusion: None,
            steam_item_id: None,
            steam_item_def: None,
        });
        logic_collect_hatched(&config, &mut save, "egg2", 3000, "2026-07-07").unwrap();
        assert_eq!(save.dex_obtained.get("guluduck"), Some(&2), "同物种累加曾获只数");

        // 放生一只（此时 2 只，非最后一只）→ 图鉴曾获**不减**（永久入册）。
        let victim = save.pets[0].id.clone();
        logic_release_pet(&config, &mut save, &victim, 4000, "2026-07-07").unwrap();
        assert_eq!(save.pets.len(), 1);
        assert_eq!(save.dex_obtained.get("guluduck"), Some(&2), "放生不减曾获只数");

        // JSON 回环：dex_obtained / recipe_ai_slots 随存档持久化。
        save.recipe_ai_slots
            .insert("fire+water".into(), vec!["aiffirewater1".into()]);
        let json = serde_json::to_string(&save).unwrap();
        let reloaded: GameSave = serde_json::from_str(&json).unwrap();
        assert_eq!(reloaded.dex_obtained.get("guluduck"), Some(&2));
        assert_eq!(
            reloaded.recipe_ai_slots.get("fire+water"),
            Some(&vec!["aiffirewater1".to_string()])
        );

        // 旧存档（无这两个字段）仍能加载为空表（serde default，向后兼容不炸档）。
        let mut obj: serde_json::Value = serde_json::from_str(&json).unwrap();
        let map = obj.as_object_mut().unwrap();
        map.remove("dexObtained");
        map.remove("recipeAiSlots");
        let downgraded: GameSave = serde_json::from_value(obj).unwrap();
        assert!(downgraded.dex_obtained.is_empty());
        assert!(downgraded.recipe_ai_slots.is_empty());
    }

    #[test]
    fn click_work_pays_and_levels_and_exhausts() {
        let config = test_config();
        let mut save = fresh_save(&config);
        let pet = add_pet(&mut save, &config, "guluduck", 1);

        // 一整管 = 200 击（同一瞬间连点 → 无自然恢复）。金币 (1+等级)×1 随
        // 升级爬坡：10+30+60+100+150+210+280+360+200 = 1400；经验 400 → Lv9。
        let mut total = 0;
        for _ in 0..200 {
            let outcome = logic_click_work(&config, &mut save, &pet, 1000, "2026-07-07").unwrap();
            assert!(!outcome.daily_capped);
            total += outcome.coins_gained;
        }
        assert_eq!(total, 1400);
        assert_eq!(save.daily.clicks, 200);
        let pet_ref = save.pets.iter().find(|p| p.id == pet).unwrap();
        assert_eq!(pet_ref.level, 9);
        assert_eq!(pet_ref.stamina, 0);
        assert!(pet_ref.exhausted);

        // Exhausted pets reject work.
        let err = logic_click_work(&config, &mut save, &pet, 1002, "2026-07-07").unwrap_err();
        assert_eq!(err, "exhausted");
    }

    #[test]
    fn tier2_click_gains_are_five_times_tier1() {
        let config = test_config();
        let mut save = fresh_save(&config);
        save.eggs.clear();
        let swan = add_pet(&mut save, &config, "guluswan", 1);
        let outcome = logic_click_work(&config, &mut save, &swan, 1000, "2026-07-07").unwrap();
        // 2 阶 Lv1：金币 (1+1)×5 = 10，经验 2×5 = 10（InteractionEconomy §4.1）。
        assert_eq!(outcome.coins_gained, 10);
        assert_eq!(outcome.exp_gained, 10);
    }

    #[test]
    fn stamina_regen_and_wake_threshold() {
        let config = test_config();
        let mut save = fresh_save(&config);
        let pet_id = add_pet(&mut save, &config, "guluduck", 1);
        {
            let pet = save.pets.iter_mut().find(|p| p.id == pet_id).unwrap();
            pet.stamina = 0;
            pet.exhausted = true;
            pet.stamina_updated_at = 1000;
        }
        // 19 points × 3s：仍在恢复期（唤醒线 = 20 = 10%）。
        settle_all(&config, &mut save, 1000 + 19 * 3, "2026-07-07");
        assert!(save.pets[0].exhausted);
        assert_eq!(save.pets[0].stamina, 19);
        // One more regen point crosses the threshold.
        settle_all(&config, &mut save, 1000 + 20 * 3, "2026-07-07");
        assert!(!save.pets[0].exhausted);
    }

    #[test]
    fn tier2_regen_is_five_times_slower_and_keeps_remainder() {
        let config = test_config();
        let mut save = fresh_save(&config);
        save.eggs.clear();
        let swan = add_pet(&mut save, &config, "guluswan", 1);
        {
            let pet = save.pets.iter_mut().find(|p| p.id == swan).unwrap();
            pet.stamina = 0;
            pet.stamina_updated_at = 1000;
        }
        // 2 阶 15s/点：29 秒只回 1 点，余数 14s 保留在锚点里。
        settle_all(&config, &mut save, 1029, "2026-07-07");
        assert_eq!(save.pets[0].stamina, 1);
        assert_eq!(save.pets[0].stamina_updated_at, 1015);
        // 再过 1 秒补足第二个 15s 周期。
        settle_all(&config, &mut save, 1030, "2026-07-07");
        assert_eq!(save.pets[0].stamina, 2);
    }

    #[test]
    fn clock_rollback_clamps_future_anchor() {
        let config = test_config();
        let mut save = fresh_save(&config);
        let pet_id = add_pet(&mut save, &config, "guluduck", 1);
        {
            let pet = save.pets.iter_mut().find(|p| p.id == pet_id).unwrap();
            pet.stamina = 0;
            pet.stamina_updated_at = 999_999; // 未来锚点（时钟回拨场景）
        }
        settle_all(&config, &mut save, 2000, "2026-07-07");
        assert_eq!(save.pets[0].stamina_updated_at, 2000, "锚点被钳回当前时刻");
        settle_all(&config, &mut save, 2000 + 30, "2026-07-07");
        assert_eq!(save.pets[0].stamina, 10, "恢复立即重新走动");
    }

    #[test]
    fn daily_click_cap_switches_to_petting_mode() {
        let config = test_config();
        let mut save = fresh_save(&config);
        let pet_id = add_pet(&mut save, &config, "guluduck", 1);
        save.daily.date = "2026-07-07".into();
        save.daily.clicks = config.daily_click_cap - 1;

        // 额度内最后一击照常结算。
        let outcome = logic_click_work(&config, &mut save, &pet_id, 1001, "2026-07-07").unwrap();
        assert!(!outcome.daily_capped);
        assert!(outcome.coins_gained > 0);
        assert_eq!(save.daily.clicks, config.daily_click_cap);

        // 额度用尽 → 纯抚摸：零消耗零产出，计数冻结。
        let stamina_before = save.pets[0].stamina;
        let coins_before = save.coins;
        let outcome = logic_click_work(&config, &mut save, &pet_id, 1002, "2026-07-07").unwrap();
        assert!(outcome.daily_capped);
        assert_eq!(outcome.coins_gained, 0);
        assert_eq!(outcome.exp_gained, 0);
        assert_eq!(save.pets[0].stamina, stamina_before);
        assert_eq!(save.coins, coins_before);
        assert_eq!(save.daily.clicks, config.daily_click_cap);

        // 次日翻转后恢复正常结算。
        let outcome = logic_click_work(&config, &mut save, &pet_id, 90_000, "2026-07-08").unwrap();
        assert!(!outcome.daily_capped);
        assert_eq!(save.daily.clicks, 1);
    }

    #[test]
    fn daily_rollover_resets_counters() {
        let config = test_config();
        let mut save = fresh_save(&config);
        save.daily.clicks = 100;
        save.daily.snack_stamina = 5;
        settle_all(&config, &mut save, 2000, "2026-07-08");
        assert_eq!(save.daily.date, "2026-07-08");
        assert_eq!(save.daily.clicks, 0);
        assert_eq!(save.daily.snack_stamina, 0);
    }

    #[test]
    fn buy_egg_slot_then_inventory_and_money_check() {
        let config = test_config();
        let mut save = fresh_save(&config);
        save.eggs.clear(); // free the tutorial slot
        save.coins = 200;
        logic_buy_egg(&config, &mut save, "normal", 1, 1000, "2026-07-07").unwrap();
        assert_eq!(save.coins, 120);
        assert_eq!(save.eggs[0].slot, Some(0));
        // Second egg: hatchery Lv1 has one slot → inventory.
        logic_buy_egg(&config, &mut save, "normal", 1, 1000, "2026-07-07").unwrap();
        assert_eq!(save.eggs[1].slot, None);
        assert_eq!(save.eggs[1].hatch_at, None);
        // Not enough money.
        save.coins = 10;
        assert!(logic_buy_egg(&config, &mut save, "normal", 1, 1000, "2026-07-07").is_err());
    }

    #[test]
    fn collect_hatched_respects_time_and_capacity() {
        let config = test_config();
        let mut save = fresh_save(&config);
        let egg_id = save.eggs[0].id.clone();
        // Too early.
        assert!(logic_collect_hatched(&config, &mut save, &egg_id, 1001, "2026-07-07").is_err());
        // Ready.
        let pet_id = logic_collect_hatched(&config, &mut save, &egg_id, 1100, "2026-07-07").unwrap();
        assert_eq!(save.pets.len(), 1);
        assert_eq!(save.active_pet_id, Some(pet_id));
        assert!(save.eggs.is_empty());

        // Fill the yard to capacity, then a hatched egg must stay in its slot.
        while save.pets.len() < config.yard_capacity_for(save.yard_level) as usize {
            add_pet(&mut save, &config, "emberfox", 1);
        }
        save.eggs.push(EggInstance {
            id: "egg-full".into(),
            species: "guluduck".into(),
            tier: 1,
            hatch_kind: "normal".into(),
            slot: Some(0),
            hatch_at: Some(1000),
            pending_fusion: None,
            steam_item_id: None,
            steam_item_def: None,
        });
        let err = logic_collect_hatched(&config, &mut save, "egg-full", 2000, "2026-07-07").unwrap_err();
        assert!(err.contains("后院已满"));
        assert_eq!(save.eggs.len(), 1, "egg keeps occupying the slot");
    }

    #[test]
    fn fusion_rules_and_result() {
        let config = test_config();
        let mut save = fresh_save(&config);
        save.eggs.clear();
        save.coins = 1000;
        let max1 = config.max_level_for_tier(1);
        let a = add_pet(&mut save, &config, "emberfox", max1);
        let b = add_pet(&mut save, &config, "frostpeng", max1);

        // Non-max partner rejected.
        let c = add_pet(&mut save, &config, "guluduck", 1);
        assert!(logic_fuse_pets(&config, &mut save, &a, &c, 1000, "2026-07-07").is_err());

        // 融合 2.0：fire+ice 异物种 → 固定物种 onsenmonk（同步路径确定性=固定），
        // 消耗双亲、产出 2 阶蛋入 slot 0。
        let egg_id = logic_fuse_pets(&config, &mut save, &a, &b, 1000, "2026-07-07").unwrap();
        assert_eq!(save.coins, 1000 - config.fusion_fee_for(1));
        assert_eq!(save.pets.len(), 1);
        let egg = save.eggs.iter().find(|e| e.id == egg_id).unwrap();
        assert_eq!(egg.species, "onsenmonk", "fire+ice 的 0 号固定物种");
        assert_eq!(egg.tier, 2);
        assert_eq!(egg.slot, Some(0));
        // Active pet was consumed → falls back to the remaining pet.
        assert_eq!(save.active_pet_id.as_deref(), Some(c.as_str()));
    }

    #[test]
    fn fusing_last_two_pets_is_allowed() {
        let config = test_config();
        let mut save = fresh_save(&config);
        save.eggs.clear();
        save.coins = 1000;
        let max1 = config.max_level_for_tier(1);
        let a = add_pet(&mut save, &config, "guluduck", max1);
        let b = add_pet(&mut save, &config, "guluduck", max1);
        logic_fuse_pets(&config, &mut save, &a, &b, 1000, "2026-07-07").unwrap();
        assert!(save.pets.is_empty());
        assert_eq!(save.active_pet_id, None);
        // 融合 2.0：同物种融合 = 同形象升阶（guluduck→2 阶 guluduck），不再产旧"王族"。
        assert_eq!(save.eggs[0].species, "guluduck");
        assert_eq!(save.eggs[0].tier, 2);
    }

    #[test]
    fn plan_fusion_same_species_upgrades_deterministically() {
        let config = test_config();
        let mut save = fresh_save(&config);
        save.eggs.clear();
        save.coins = 10_000_000;
        let max2 = config.max_level_for_tier(2);
        let a = add_pet_at_tier(&mut save, &config, "steamalotl", 2, max2);
        let b = add_pet_at_tier(&mut save, &config, "steamalotl", 2, max2);
        let (pa, pb) = logic_validate_fusion_pair(&config, &save, &a, &b).unwrap();
        let plan = plan_fusion(&config, &save, &pa, &pb, 12345, true).unwrap();
        assert_eq!(plan.kind, FusionResultKind::SameSpecies);
        assert_eq!(plan.result_species, "steamalotl", "同物种升阶保持物种（不掷骰）");
        assert_eq!(plan.result_tier, 3);
        assert_eq!(plan.fee, config.fusion_fee_for(2));
    }

    #[test]
    fn plan_fusion_cross_species_rolls_slot_ladder() {
        let config = test_config();
        let mut save = fresh_save(&config);
        save.eggs.clear();
        save.coins = 10_000_000;
        // 双亲 fire × water（2 阶），并集 fire+water，0 号固定 = steamalotl。
        let max2 = config.max_level_for_tier(2);
        let a = add_pet_at_tier(&mut save, &config, "emberfox", 2, max2);
        let b = add_pet_at_tier(&mut save, &config, "bubblefrog", 2, max2);
        let (pa, pb) = logic_validate_fusion_pair(&config, &save, &a, &b).unwrap();

        // 全新配方 e=2 m=1 权重 [40,60]（roll%100）。
        let plan0 = plan_fusion(&config, &save, &pa, &pb, 0, true).unwrap();
        assert_eq!(plan0.recipe_key, "fire+water");
        assert_eq!(plan0.result_tier, 3);
        assert_eq!(plan0.kind, FusionResultKind::Fixed);
        assert_eq!(plan0.result_species, "steamalotl");
        // roll=50 落 AI 区 → Generate（同步路径回退固定物种）。
        let plang = plan_fusion(&config, &save, &pa, &pb, 50, true).unwrap();
        assert_eq!(plang.kind, FusionResultKind::Generate(1));
        assert_eq!(plang.result_species, "steamalotl", "同步 Generate 回退固定");

        // 注册 1 号 AI 变种并置 0/1 号已获得 → m=2，权重 [80,60,60]。
        save.recipe_ai_slots.insert("fire+water".into(), vec!["aiffw1".into()]);
        save.dex_obtained.insert("steamalotl".into(), 1);
        save.dex_obtained.insert("aiffw1".into(), 1);
        let planr = plan_fusion(&config, &save, &pa, &pb, 100, true).unwrap(); // 100 → slot1
        assert_eq!(planr.kind, FusionResultKind::Reuse(1));
        assert_eq!(planr.result_species, "aiffw1", "掷中已解锁槽 = 复用同一 AI 变种");
        let planf = plan_fusion(&config, &save, &pa, &pb, 0, true).unwrap(); // 0 → slot0
        assert_eq!(planf.kind, FusionResultKind::Fixed);
    }

    #[test]
    fn fusion_multi_tier_and_tier6_block_and_fee_by_tier() {
        let config = test_config();
        // 3 阶同物种融合 → 4 阶蛋，费用按 3 阶。coins 相对费用设定（对物价调整鲁棒）。
        let mut save = fresh_save(&config);
        save.eggs.clear();
        let fee3 = config.fusion_fee_for(3);
        save.coins = fee3 + 500;
        let max3 = config.max_level_for_tier(3);
        let c = add_pet_at_tier(&mut save, &config, "steamalotl", 3, max3);
        let d = add_pet_at_tier(&mut save, &config, "steamalotl", 3, max3);
        logic_fuse_pets(&config, &mut save, &c, &d, 1000, "2026-07-07").unwrap();
        assert_eq!(save.coins, 500);
        assert_eq!(save.eggs[0].tier, 4, "亲代 3 阶 → 结果 4 阶");
        assert_eq!(save.eggs[0].species, "steamalotl");

        // 两只 6 阶不可再融合。
        let mut top = fresh_save(&config);
        top.eggs.clear();
        top.coins = 10_000;
        let max6 = config.max_level_for_tier(6);
        let e = add_pet_at_tier(&mut top, &config, "prismkirin", 6, max6);
        let f = add_pet_at_tier(&mut top, &config, "prismkirin", 6, max6);
        let err = logic_fuse_pets(&config, &mut top, &e, &f, 1000, "2026-07-07").unwrap_err();
        assert!(err.contains("最高阶"), "6 阶阻断：{err}");
    }

    #[test]
    fn release_refund_matches_gdd_and_protects_last_pet() {
        let config = test_config();
        let mut save = fresh_save(&config);
        let only = add_pet(&mut save, &config, "guluduck", 5);
        assert!(logic_release_pet(&config, &mut save, &only, 1000, "2026-07-07").is_err());

        // 1 阶冰精灵满级：等效价 = 150 × 15^0 = 150 → ⌊150×0.25⌋ + 10×5 = 37 + 50 = 87
        // （EconomyScaling.md §8；1 阶乘数=1，与旧值一致）。
        let ice = add_pet(&mut save, &config, "frostpeng", 10);
        let coins_before = save.coins;
        let refund = logic_release_pet(&config, &mut save, &ice, 1000, "2026-07-07").unwrap();
        assert_eq!(refund, 87);
        assert_eq!(save.coins, coins_before + 87);

        // 2 阶精灵按**实例阶**乘法等效价（§8）：guluswan 元素 [normal]、实例阶 2 →
        // 80 × 15^1 = 1200 → ⌊1200×0.25⌋ + 20×5 = 300 + 100 = 400。
        let swan = add_pet(&mut save, &config, "guluswan", 20);
        let refund = logic_release_pet(&config, &mut save, &swan, 1000, "2026-07-07").unwrap();
        assert_eq!(refund, 300 + 20 * 5);
    }

    #[test]
    fn token_energy_feed_uses_rate_buffer_and_never_pays() {
        let config = test_config();
        let mut save = fresh_save(&config);
        save.eggs.clear();
        let active = add_pet(&mut save, &config, "guluduck", 1);
        save.active_pet_id = Some(active.clone());
        {
            let pet = save.pets.iter_mut().find(|p| p.id == active).unwrap();
            pet.stamina = 0;
            pet.exhausted = true;
        }
        let coins_before = save.coins;

        // 1 阶换算率 8 tokens/点（EconomyScaling.md §9）：25 tokens → +3 点（用 24），
        // 余 1 进缓冲；未到唤醒线 20。
        let outcome = logic_feed_energy(&config, &mut save, EnergySource::Tokens, 25, 1000, "2026-07-07");
        assert_eq!(outcome.stamina_fed, 3);
        assert_eq!(outcome.wasted, 0);
        assert!(outcome.woke_pet_ids.is_empty());
        let pet = save.pets.iter().find(|p| p.id == active).unwrap();
        assert_eq!(pet.stamina, 3);
        assert_eq!(pet.token_buffer, 1);
        assert!(pet.exhausted);

        // 再补 7 tokens 凑满一点（缓冲 1+7=8）；经验/金币全程不动（经济不变量）。
        let outcome = logic_feed_energy(&config, &mut save, EnergySource::Tokens, 7, 1000, "2026-07-07");
        assert_eq!(outcome.stamina_fed, 1);
        let pet = save.pets.iter().find(|p| p.id == active).unwrap();
        assert_eq!(pet.stamina, 4);
        assert_eq!(pet.token_buffer, 0);
        assert_eq!(pet.exp, 0);
        assert_eq!(save.coins, coins_before);

        // 大额喂养直接喂醒（≥ 唤醒线 20）。
        let outcome = logic_feed_energy(&config, &mut save, EnergySource::Tokens, 200, 1000, "2026-07-07");
        assert_eq!(outcome.woke_pet_ids, vec![active.clone()]);
        assert!(!save.pets[0].exhausted);
    }

    #[test]
    fn energy_feed_spills_to_lowest_then_wastes() {
        let config = test_config();
        let mut save = fresh_save(&config);
        save.eggs.clear();
        let active = add_pet(&mut save, &config, "guluduck", 1);
        let buddy = add_pet(&mut save, &config, "emberfox", 1);
        save.active_pet_id = Some(active.clone());
        {
            let pet = save.pets.iter_mut().find(|p| p.id == buddy).unwrap();
            pet.stamina = 10;
        }

        // 主宠满管 → 溢出直接流向精力最低的伙伴（1 阶 8 tokens/点：50→6 点）。
        let outcome = logic_feed_energy(&config, &mut save, EnergySource::Tokens, 50, 1000, "2026-07-07");
        assert_eq!(outcome.stamina_fed, 6);
        assert_eq!(outcome.per_pet.len(), 1);
        assert_eq!(outcome.per_pet[0].pet_id, buddy);
        assert_eq!(save.pets.iter().find(|p| p.id == buddy).unwrap().stamina, 16);

        // 全员满管 → 剩余量丢弃（不折金币）。
        for pet in &mut save.pets {
            pet.stamina = config.stamina_max;
        }
        let coins_before = save.coins;
        let outcome = logic_feed_energy(&config, &mut save, EnergySource::Tokens, 42, 1000, "2026-07-07");
        assert_eq!(outcome.stamina_fed, 0);
        assert_eq!(outcome.wasted, 42);
        assert_eq!(save.coins, coins_before);
    }

    #[test]
    fn key_energy_feed_respects_tier_rate() {
        let config = test_config();
        let mut save = fresh_save(&config);
        save.eggs.clear();
        let swan = add_pet(&mut save, &config, "guluswan", 1);
        save.active_pet_id = Some(swan.clone());
        {
            let pet = save.pets.iter_mut().find(|p| p.id == swan).unwrap();
            pet.stamina = 0;
        }

        // 2 阶键盘换算率 5 键/点：3 键只进缓冲，再 2 键凑满 1 点。
        let outcome = logic_feed_energy(&config, &mut save, EnergySource::Keys, 3, 1000, "2026-07-07");
        assert_eq!(outcome.stamina_fed, 0);
        assert_eq!(save.pets[0].key_buffer, 3);
        let outcome = logic_feed_energy(&config, &mut save, EnergySource::Keys, 2, 1000, "2026-07-07");
        assert_eq!(outcome.stamina_fed, 1);
        assert_eq!(save.pets[0].stamina, 1);
        assert_eq!(save.pets[0].key_buffer, 0);
    }

    #[test]
    fn ledger_token_diff_tracks_and_self_heals() {
        let config = test_config();
        let mut save = fresh_save(&config);
        assert_eq!(ledger_token_diff(&mut save, "proj", 5000), 5000, "首见项目全量入账");
        assert_eq!(ledger_token_diff(&mut save, "proj", 5600), 600);
        // progress 被删除/重置（总数回退）→ 自愈：重置基线、增量为 0。
        assert_eq!(ledger_token_diff(&mut save, "proj", 100), 0);
        assert_eq!(save.last_seen_project_tokens.get("proj"), Some(&100));
        assert_eq!(ledger_token_diff(&mut save, "proj", 150), 50);
    }

    #[test]
    fn tick_only_settles_no_idle_income() {
        let config = test_config();
        let mut save = fresh_save(&config);
        save.eggs.clear();
        let active = add_pet(&mut save, &config, "guluduck", 1);
        let buddy = add_pet(&mut save, &config, "emberfox", 1);
        save.active_pet_id = Some(active.clone());
        let coins_before = save.coins;

        for tick in 1..=10u64 {
            logic_tick(&config, &mut save, 1000 + tick as i64 * 60, "2026-07-07");
        }
        // v1.1 经济不变量：挂机不再产任何经验/金币。
        for pet in &save.pets {
            assert_eq!(pet.level, 1);
            assert_eq!(pet.exp, 0);
        }
        assert_eq!(save.coins, coins_before);
        let _ = buddy;
    }

    #[test]
    fn wander_snack_restores_stamina_under_daily_cap() {
        let config = test_config();
        let mut save = fresh_save(&config);
        save.eggs.clear();
        let active = add_pet(&mut save, &config, "guluduck", 1);
        save.active_pet_id = Some(active.clone());
        {
            let pet = save.pets.iter_mut().find(|p| p.id == active).unwrap();
            pet.stamina = 0;
            pet.stamina_updated_at = 1000;
        }
        save.daily.date = "2026-07-07".into();
        save.daily.snack_stamina = config.wander_snack_daily_cap - 1;
        let coins_before = save.coins;

        let gained = logic_wander_snack(&config, &mut save, 1000, "2026-07-07");
        assert_eq!(gained, 1, "clamped to the remaining daily room");
        assert_eq!(save.pets[0].stamina, 1);
        assert_eq!(save.coins, coins_before, "零食只回精力不给金币");
        let gained = logic_wander_snack(&config, &mut save, 1000, "2026-07-07");
        assert_eq!(gained, 0);
    }

    #[test]
    fn migrates_v2_save_to_v3() {
        let config = test_config();
        let mut save = fresh_save(&config);
        let pet_id = add_pet(&mut save, &config, "guluduck", 5);
        {
            let pet = save.pets.iter_mut().find(|p| p.id == pet_id).unwrap();
            pet.stamina = 40;
            pet.exhausted = true;
            pet.stamina_updated_at = 999_999_999; // 未来锚点一并修复
        }
        save.version = 2;

        // 模拟 v2 存档字段形态：老 daily 计数器 + experience 账本、无新字段。
        let mut value = serde_json::to_value(&save).unwrap();
        let object = value.as_object_mut().unwrap();
        object.insert(
            "lastSeenProjectExperience".into(),
            serde_json::json!({ "D:/proj": 7 }),
        );
        object.remove("lastSeenProjectTokens");
        object.insert(
            "daily".into(),
            serde_json::json!({
                "date": "2026-07-01",
                "tokenExp": 10,
                "overflowCoins": 5,
                "pickupCoins": 1,
                "idleCoins": 2,
                "clickCoins": 300
            }),
        );
        for pet in object.get_mut("pets").unwrap().as_array_mut().unwrap() {
            let pet = pet.as_object_mut().unwrap();
            pet.remove("keyBuffer");
            pet.remove("tokenBuffer");
        }

        let mut reloaded: GameSave = serde_json::from_value(value).expect("v2 存档必须能加载");
        assert_eq!(reloaded.daily.clicks, 0, "旧 daily 字段被忽略、新字段取默认");
        assert_eq!(reloaded.pets[0].key_buffer, 0);

        let baseline = BTreeMap::from([("D:/proj".to_string(), 7000u64)]);
        assert!(migrate_save(&config, &mut reloaded, &baseline, 2000, "2026-07-07"));
        assert_eq!(reloaded.version, 5, "v2 链式迁移到 v5（v3 经济 + v4 融合 + v5 槽注册补写）");
        // v4：图鉴曾获从在册宠物播种。
        assert_eq!(reloaded.dex_obtained.get("guluduck"), Some(&1), "曾获账本播种");
        let pet = &reloaded.pets[0];
        assert_eq!(pet.stamina, config.stamina_max, "迁移补偿：一次性回满");
        assert!(!pet.exhausted);
        assert!(pet.stamina_updated_at <= 2000);
        assert_eq!(pet.level, 5, "等级/经验原样保留");
        assert_eq!(reloaded.daily.date, "2026-07-07");
        assert_eq!(reloaded.last_seen_project_tokens.get("D:/proj"), Some(&7000));
        assert!(reloaded.last_seen_project_experience.is_empty());

        // 降级保险：deprecated 字段仍随 v3 存档序列化（旧二进制必填）。
        let json = serde_json::to_string(&reloaded).unwrap();
        assert!(json.contains("lastSeenProjectExperience"));

        // 幂等：再跑一次不再变动（除非又出现未来锚点）。
        assert!(!migrate_save(&config, &mut reloaded, &baseline, 2001, "2026-07-07"));
    }

    #[test]
    fn migrates_v4_backfills_recipe_ai_slots_from_custom_species() {
        // 回归：早期 resolve 漏写 recipeAiSlots，已生成的 AI 变种不进图鉴槽、前沿不推进。
        // v4→v5 补写应从 customSpecies 按 createdAt 生成序补注册。
        let config = test_config();
        let mut save = fresh_save(&config);
        save.version = 4;
        save.custom_species.clear();
        save.recipe_ai_slots.clear();

        // 两只同配方（fire+ice）变种：createdAt 决定槽序，与 codename 字典序解耦。
        // "zebra"(createdAt 1000) 应落 1 号槽、"alpha"(createdAt 2000) 落 2 号槽。
        let mut first = sample_custom_entry(["emberfox", "frostpeng"]);
        first.created_at = 1000;
        let mut second = sample_custom_entry(["emberfox", "frostpeng"]);
        second.created_at = 2000;
        save.custom_species.insert("zebra".to_string(), first);
        save.custom_species.insert("alpha".to_string(), second);
        // 单元素自定义物种不占 AI 阶梯槽（0 号固定物种由 config 已知）。
        let mut solo = sample_custom_entry(["emberfox", "emberfox"]);
        solo.info.elements = vec!["fire".to_string()];
        save.custom_species.insert("soloember".to_string(), solo);

        assert!(migrate_save(&config, &mut save, &BTreeMap::new(), 3000, "2026-07-07"));
        assert_eq!(save.version, 5);
        assert_eq!(
            save.recipe_ai_slots.get("fire+ice").map(Vec::as_slice),
            Some(["zebra".to_string(), "alpha".to_string()].as_slice()),
            "按 createdAt 生成序补注册（zebra→1号、alpha→2号），与 codename 字典序无关"
        );
        assert!(!save.recipe_ai_slots.contains_key("fire"), "单元素不入 AI 槽");

        // 幂等：再迁移不重复占槽、不重排。
        let before = save.recipe_ai_slots.clone();
        assert!(!migrate_save(&config, &mut save, &BTreeMap::new(), 3001, "2026-07-07"));
        assert_eq!(save.recipe_ai_slots, before);
    }

    #[test]
    fn upgrades_cost_and_cap() {
        let config = test_config();
        let mut save = fresh_save(&config);
        save.coins = 2_000_000_000; // 覆盖孵化屋(1.11亿)+后院(1.9亿)全程
        // 孵化屋：前两次升级 = ×10 阶梯 100 / 1000。
        let before = save.coins;
        logic_upgrade_hatchery(&config, &mut save, 1000, "2026-07-07").unwrap();
        logic_upgrade_hatchery(&config, &mut save, 1000, "2026-07-07").unwrap();
        assert_eq!(save.coins, before - 100 - 1_000);
        assert_eq!(save.hatchery_level, 3);
        // 继续升到 8 槽封顶（共 7 次），第 8 次拒绝。
        for _ in 0..5 {
            logic_upgrade_hatchery(&config, &mut save, 1000, "2026-07-07").unwrap();
        }
        assert_eq!(save.hatchery_level, 8);
        assert!(logic_upgrade_hatchery(&config, &mut save, 1000, "2026-07-07").is_err());
        assert_eq!(config.hatchery_slot_count(8), 8);

        // 后院：前两次升级 = 50 / 78（递减倍率曲线，首档 50 × ~1.55）。
        let ybefore = save.coins;
        logic_upgrade_yard(&config, &mut save, 1000, "2026-07-07").unwrap();
        logic_upgrade_yard(&config, &mut save, 1000, "2026-07-07").unwrap();
        assert_eq!(save.coins, ybefore - 50 - 78);
        // 一路升到 50 格封顶（共 47 次）。
        let mut yups = 2u32;
        while logic_upgrade_yard(&config, &mut save, 1000, "2026-07-07").is_ok() {
            yups += 1;
        }
        assert_eq!(yups, 47);
        assert_eq!(save.yard_level, 48);
        assert_eq!(config.yard_capacity_for(48), 50);
    }

    #[test]
    fn shop_upgrade_and_tiered_egg_pricing() {
        let config = test_config();
        let mut save = fresh_save(&config);
        save.eggs.clear();
        save.coins = 20_000_000; // 覆盖商店升级 50k+750k+11.25M
        assert_eq!(save.shop_level, 1);
        // Lv1 只能买 1 阶蛋：2 阶被拒。
        assert!(logic_buy_egg(&config, &mut save, "fire", 2, 1000, "d").is_err());
        // 升级商店 Lv1→2（费 50000）→ 可买 2 阶蛋。
        let before = save.coins;
        logic_upgrade_shop(&config, &mut save, 1000, "d").unwrap();
        assert_eq!(save.shop_level, 2);
        assert_eq!(save.coins, before - 50_000);
        // 2 阶火蛋价 = 120 × 15 = 1800；买入后 tier=2、hatchKind=tier2。
        let coins = save.coins;
        let egg_id = logic_buy_egg(&config, &mut save, "fire", 2, 1000, "d").unwrap();
        assert_eq!(save.coins, coins - 1_800);
        let egg = save.eggs.iter().find(|e| e.id == egg_id).unwrap();
        assert_eq!(egg.tier, 2);
        assert_eq!(egg.hatch_kind, "tier2");
        // 升到 Lv4 封顶后不能再升（shopMaxLevel=4）。
        logic_upgrade_shop(&config, &mut save, 1000, "d").unwrap(); // →3
        logic_upgrade_shop(&config, &mut save, 1000, "d").unwrap(); // →4
        assert_eq!(save.shop_level, 4);
        assert!(logic_upgrade_shop(&config, &mut save, 1000, "d").is_err());
        // 商店封顶 4 阶：5 阶蛋永不可买（纯融合专属）。
        assert!(logic_buy_egg(&config, &mut save, "fire", 5, 1000, "d").is_err());
    }

    #[test]
    fn egg_pool_filters_by_unlock_element_and_count() {
        let config = test_config();
        let mut save = fresh_save(&config);
        // 1 阶火蛋：只有基础种 emberfox（恒可售，无需解锁）。
        let t1 = egg_pool_candidates(&config, &save, "fire", 1);
        assert_eq!(t1, vec![("emberfox".to_string(), config.egg_rarity_weight(1))]);
        // 2 阶火蛋（未解锁任何双属火种）：仍只有 emberfox（保底，池永不空）。
        let t2 = egg_pool_candidates(&config, &save, "fire", 2);
        assert_eq!(t2.len(), 1);
        assert_eq!(t2[0].0, "emberfox");
        // 解锁一只含火双属种（steamalotl = fire+water）→ 进入 2 阶火蛋池，且权重更低。
        record_species_obtained(&mut save, "steamalotl");
        let t2b = egg_pool_candidates(&config, &save, "fire", 2);
        let codes: Vec<&str> = t2b.iter().map(|(c, _)| c.as_str()).collect();
        assert!(codes.contains(&"emberfox") && codes.contains(&"steamalotl"));
        let w_base = t2b.iter().find(|(c, _)| c == "emberfox").unwrap().1;
        let w_two = t2b.iter().find(|(c, _)| c == "steamalotl").unwrap().1;
        assert!(w_base > w_two, "元素越多权重越小");
        // steamalotl 是 fire+water：不出现在 electric 蛋池。
        let elec = egg_pool_candidates(&config, &save, "electric", 2);
        assert!(!elec.iter().any(|(c, _)| c == "steamalotl"));
        // 元素数 > 蛋阶：3 元素种即便解锁也不进 2 阶池。
        record_species_obtained(&mut save, "pyrepeacock"); // electric+fire+grass
        let t2c = egg_pool_candidates(&config, &save, "fire", 2);
        assert!(!t2c.iter().any(|(c, _)| c == "pyrepeacock"));
        let t3 = egg_pool_candidates(&config, &save, "fire", 3);
        assert!(t3.iter().any(|(c, _)| c == "pyrepeacock"));
        // roll 落在权重区间内可复现（roll=0 → 池首元素 emberfox）。
        assert_eq!(roll_egg_species(&config, &save, "fire", 1, 0).as_deref(), Some("emberfox"));
    }

    #[test]
    fn debug_add_coins_grants_and_saturates() {
        let config = test_config();
        let mut save = fresh_save(&config);
        let before = save.coins;
        logic_add_coins(&mut save, 10_000);
        assert_eq!(save.coins, before + 10_000);
        // Never overflows.
        save.coins = u64::MAX - 5;
        logic_add_coins(&mut save, 10_000);
        assert_eq!(save.coins, u64::MAX);
    }

    #[test]
    fn debug_hatch_now_completes_incubating_eggs_only() {
        let config = test_config();
        let mut save = fresh_save(&config);
        // fresh_save seeds one incubating tutorial egg (slot 0, hatch_at 1000+60)…
        assert_eq!(save.eggs[0].slot, Some(0));
        // …plus one inventory egg (no slot) that must stay untouched.
        save.eggs.push(EggInstance {
            id: "egg-inv".into(),
            species: "guluduck".into(),
            tier: 1,
            hatch_kind: "normal".into(),
            slot: None,
            hatch_at: None,
            pending_fusion: None,
            steam_item_id: None,
            steam_item_def: None,
        });
        let count = logic_hatch_now(&mut save, 9999);
        assert_eq!(count, 1, "only the incubating egg is completed");
        assert_eq!(save.eggs[0].hatch_at, Some(9999));
        let inventory = save.eggs.iter().find(|e| e.id == "egg-inv").unwrap();
        assert_eq!(inventory.hatch_at, None, "inventory egg is left alone");
    }

    fn sample_custom_entry(parents: [&str; 2]) -> CustomSpeciesEntry {
        CustomSpeciesEntry {
            info: SpeciesInfo {
                name_zh: "炎泡鲸".to_string(),
                tier: 2,
                elements: vec!["fire".to_string(), "ice".to_string()],
                colors: vec!["#E8734A".to_string(), "#9BDCFF".to_string()],
                body: "frog".to_string(),
                desc: "肚子里烧着小火炉的温泉鲸".to_string(),
                steam_item_def: 0,
            },
            visual: CustomVisualSpec {
                rig: "whale".to_string(),
                scale: 1.15,
                palette: CustomPalette {
                    body: "#E8734A".to_string(),
                    deep: "#C2492B".to_string(),
                    belly: "#FFE8D6".to_string(),
                    accent: "#9BDCFF".to_string(),
                    accent2: Some("#FFB03A".to_string()),
                },
                eyes: Some("happy".to_string()),
                tool_id: Some("flatIron".to_string()),
                floating: true,
                form: None,
                work_fx: None,
                slots: BTreeMap::from([
                    ("tail".to_string(), SlotSpec::PartId("fluke".to_string())),
                    (
                        "headTop".to_string(),
                        SlotSpec::Custom(CustomPart {
                            kind: "custom".to_string(),
                            nodes: vec![ShapeNode {
                                node_type: "circle".to_string(),
                                fill: Some("$accent".to_string()),
                                stroke: Some("$outline".to_string()),
                                stroke_width: Some(4.0),
                                stroke_linecap: None,
                                stroke_linejoin: None,
                                fill_rule: None,
                                opacity: None,
                                transform: None,
                                d: None,
                                cx: Some(0.0),
                                cy: Some(-12.0),
                                r: Some(10.0),
                                rx: None,
                                ry: None,
                                x: None,
                                y: None,
                                width: None,
                                height: None,
                                points: None,
                                x1: None,
                                y1: None,
                                x2: None,
                                y2: None,
                            }],
                        }),
                    ),
                ]),
            },
            parents: [parents[0].to_string(), parents[1].to_string()],
            created_at: 1000,
            generator: "mock".to_string(),
        }
    }

    #[test]
    fn ai_fusion_start_consumes_and_creates_pending_egg() {
        let config = test_config();
        let mut save = fresh_save(&config);
        save.eggs.clear();
        save.coins = 1000;
        let max1 = config.max_level_for_tier(1);
        let a = add_pet(&mut save, &config, "emberfox", max1);
        let b = add_pet(&mut save, &config, "frostpeng", max1);

        let egg_id = logic_start_ai_fusion(&config, &mut save, &a, &b, 1000, "2026-07-07").unwrap();
        assert_eq!(save.coins, 1000 - config.fusion_fee_for(1));
        assert!(save.pets.is_empty());
        let egg = save.eggs.iter().find(|e| e.id == egg_id).unwrap();
        // 融合 2.0：挂起蛋兜底 = 并集配方的固定物种（fire+ice → onsenmonk），不再 guluduck。
        assert_eq!(egg.species, "onsenmonk", "兜底=并集固定物种");
        assert_eq!(egg.tier, 2);
        assert_eq!(egg.slot, Some(0));
        let pending = egg.pending_fusion.as_ref().unwrap();
        assert_eq!(pending.recipe_key, "fire+ice");
        assert_eq!(pending.parents, ["emberfox".to_string(), "frostpeng".to_string()]);
        assert_eq!(pending.status, "pending");
    }

    #[test]
    fn ai_fusion_resolve_registers_species_and_rewrites_egg() {
        let config = test_config();
        let mut save = fresh_save(&config);
        save.eggs.clear();
        save.coins = 1000;
        let max1 = config.max_level_for_tier(1);
        let a = add_pet(&mut save, &config, "emberfox", max1);
        let b = add_pet(&mut save, &config, "frostpeng", max1);
        let egg_id = logic_start_ai_fusion(&config, &mut save, &a, &b, 1000, "2026-07-07").unwrap();

        logic_resolve_fusion_egg(&config, &mut save, &egg_id, "aifembwhale", sample_custom_entry(["emberfox", "frostpeng"]))
            .unwrap();
        let egg = save.eggs.iter().find(|e| e.id == egg_id).unwrap();
        assert_eq!(egg.species, "aifembwhale");
        assert_eq!(egg.pending_fusion.as_ref().unwrap().status, "resolved");
        assert!(save.custom_species.contains_key("aifembwhale"));
        // FusionRecipeSlots §5：生成即注册槽位（emberfox=fire + frostpeng=ice → "fire+ice" 1 号槽），
        // 否则图鉴不显示该 AI 变种、前沿也不推进。
        assert_eq!(
            save.recipe_ai_slots.get("fire+ice").map(Vec::as_slice),
            Some(["aifembwhale".to_string()].as_slice()),
            "AI 生成即写 recipeAiSlots 1 号槽"
        );

        // 收取后孵出自定义物种，tier 来自 entry.info。
        let pet_id = logic_collect_hatched(&config, &mut save, &egg_id, 999_999, "2026-07-07").unwrap();
        let pet = save.pets.iter().find(|p| p.id == pet_id).unwrap();
        assert_eq!(pet.species, "aifembwhale");
        assert_eq!(pet.tier, 2);
    }

    #[test]
    fn ai_fusion_resolve_rejects_taken_codename_and_missing_egg() {
        let config = test_config();
        let mut save = fresh_save(&config);
        save.eggs.clear();
        save.coins = 1000;
        let max1 = config.max_level_for_tier(1);
        let a = add_pet(&mut save, &config, "emberfox", max1);
        let b = add_pet(&mut save, &config, "frostpeng", max1);
        let egg_id = logic_start_ai_fusion(&config, &mut save, &a, &b, 1000, "2026-07-07").unwrap();

        // 与静态目录撞名。
        let err = logic_resolve_fusion_egg(&config, &mut save, &egg_id, "guluduck", sample_custom_entry(["a", "b"]))
            .unwrap_err();
        assert!(err.contains("已被占用"));

        // 蛋被提前收走（debug_hatch_now 场景）后 resolve 报错，结果被丢弃。
        logic_hatch_now(&mut save, 1000);
        logic_collect_hatched(&config, &mut save, &egg_id, 2000, "2026-07-07").unwrap();
        let err = logic_resolve_fusion_egg(&config, &mut save, &egg_id, "aifembwhale", sample_custom_entry(["a", "b"]))
            .unwrap_err();
        assert!(err.contains("蛋已不存在"));
        // 融合 2.0：兜底孵出并集固定物种 onsenmonk，阶数取蛋阶（fire+ice → 2 阶）。
        let hatched = save.pets.last().unwrap();
        assert_eq!(hatched.species, "onsenmonk");
        assert_eq!(hatched.tier, 2);
    }

    #[test]
    fn releasing_custom_species_pet_refunds_by_entry_info() {
        let config = test_config();
        let mut save = fresh_save(&config);
        add_pet(&mut save, &config, "guluduck", 1);
        save.custom_species
            .insert("aifembwhale".to_string(), sample_custom_entry(["emberfox", "frostpeng"]));
        let id = new_id("pet");
        save.pets.push(PetInstance {
            id: id.clone(),
            species: "aifembwhale".to_string(),
            tier: 2,
            level: 5,
            exp: 0,
            stamina: config.stamina_max,
            stamina_updated_at: 1000,
            exhausted: false,
            key_buffer: 0,
            token_buffer: 0,
            steam_item_id: None,
            steam_item_def: None,
        });
        // fire+ice 实例阶 2 等效价（乘法，EconomyScaling.md §8）= (120+150) × 15^1 = 4050
        // → ⌊4050×0.25⌋ + 5×5 = 1012 + 25。
        let refund = logic_release_pet(&config, &mut save, &id, 1000, "2026-07-07").unwrap();
        assert_eq!(refund, 1012 + 25);
    }

    #[test]
    fn old_save_json_without_new_fields_still_loads() {
        let config = test_config();
        let save = fresh_save(&config);
        let mut value = serde_json::to_value(&save).unwrap();
        let object = value.as_object_mut().unwrap();
        object.remove("customSpecies");
        for egg in object.get_mut("eggs").unwrap().as_array_mut().unwrap() {
            egg.as_object_mut().unwrap().remove("pendingFusion");
        }
        let reloaded: GameSave = serde_json::from_value(value).expect("老存档必须能加载");
        assert!(reloaded.custom_species.is_empty());
        assert!(reloaded.eggs.iter().all(|e| e.pending_fusion.is_none()));
    }

    #[test]
    fn custom_entry_json_roundtrip_keeps_slot_shapes() {
        let entry = sample_custom_entry(["emberfox", "frostpeng"]);
        let json = serde_json::to_string(&entry).unwrap();
        assert!(json.contains("\"kind\":\"custom\""));
        assert!(json.contains("\"toolId\""), "camelCase 序列化");
        let back: CustomSpeciesEntry = serde_json::from_str(&json).unwrap();
        match back.visual.slots.get("tail").unwrap() {
            SlotSpec::PartId(id) => assert_eq!(id, "fluke"),
            other => panic!("tail 应是部件 id，得到 {other:?}"),
        }
        match back.visual.slots.get("headTop").unwrap() {
            SlotSpec::Custom(part) => assert_eq!(part.nodes.len(), 1),
            other => panic!("headTop 应是自定义部件，得到 {other:?}"),
        }
    }

    #[test]
    fn debug_max_pets_levels_and_restores_everyone() {
        let config = test_config();
        let mut save = fresh_save(&config);
        let a = add_pet(&mut save, &config, "guluduck", 1);
        let b = add_pet(&mut save, &config, "emberfox", 3);
        // Drain and exhaust one pet to prove it gets restored.
        {
            let pet = save.pets.iter_mut().find(|p| p.id == a).unwrap();
            pet.stamina = 0;
            pet.exhausted = true;
        }
        let count = logic_max_all_pets(&config, &mut save);
        assert_eq!(count, 2);
        for id in [&a, &b] {
            let pet = save.pets.iter().find(|p| &p.id == id).unwrap();
            assert_eq!(pet.level, config.max_level_for_tier(pet.tier));
            assert_eq!(pet.exp, 0);
            assert_eq!(pet.stamina, config.stamina_max);
            assert!(!pet.exhausted);
        }
    }
