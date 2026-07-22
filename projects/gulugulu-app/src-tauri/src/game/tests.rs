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
        assert_eq!(save.version, 8);
        assert_eq!(save.coins, config.initial_coins + config.historical_exp_coin_cap);
        assert_eq!(save.eggs.len(), 1);
        assert_eq!(save.eggs[0].slot, Some(0));
        assert_eq!(save.eggs[0].hatch_at, Some(1000 + 15)); // 教学蛋硬编码 15s（OnboardingCoach.md §3.1）
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
        assert_eq!(save.daily.hatches, 1, "昨日战报：孵出即当日孵化 +1");

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
            shop_element: None,
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

        // 一整管 = 100 击（staminaPerClick=2，同一瞬间连点 → 无自然恢复）。一阶 levelExpFactor=4
        // （v1.3：Lv n→n+1 恰好 n 击，升满 45 击）→ 400 exp 远超满级所需 180，本管内即封顶 Lv10；
        // 封顶后仍计金币不计经验，故整管金币 935 = 升级期 330 + 满级 55 击 ×11。
        let mut total = 0;
        for _ in 0..100 {
            let outcome = logic_click_work(&config, &mut save, &pet, 1000, "2026-07-07").unwrap();
            assert!(!outcome.daily_capped);
            total += outcome.coins_gained;
        }
        assert_eq!(total, 935);
        assert_eq!(save.daily.clicks, 100);
        let pet_ref = save.pets.iter().find(|p| p.id == pet).unwrap();
        assert_eq!(pet_ref.level, config.max_level_for_tier(1)); // 本管内封顶（#6）
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
        // 2 阶 Lv1：金币 (1+1)×5 = 10，经验 4×5 = 20（InteractionEconomy §4.1，v1.2 收益减半）。
        assert_eq!(outcome.coins_gained, 10);
        assert_eq!(outcome.exp_gained, 20);
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
        settle_all(&config, &mut save, 2000, "2026-07-08");
        assert_eq!(save.daily.date, "2026-07-08");
        assert_eq!(save.daily.clicks, 0);
        // 昨日战报：翻日把旧计数归档进 last_day_digest（再清零 daily）。
        let digest = save.last_day_digest.as_ref().expect("翻日应归档昨日战报");
        assert_eq!(digest.date, "2026-07-07");
        assert_eq!(digest.clicks, 100);
        assert_eq!(digest.day_index, day_index_of("2026-07-07"));
    }

    #[test]
    fn daily_rollover_archives_full_digest_and_sums_maps() {
        let config = test_config();
        let mut save = fresh_save(&config); // daily.date = "2026-07-07"
        save.daily.clicks = 10;
        save.daily.keys = 200;
        save.daily.hatches = 3;
        save.daily.coins_earned = 50;
        save.daily.releases = 1;
        save.daily.night_owl = true;
        // map 类计数在归档时折算为标量总和。
        save.daily.fusion_mints.insert("fire+water".into(), 2);
        save.daily.fusion_mints.insert("earth+wind".into(), 1);
        save.daily.egg_mints.insert("ice:1".into(), 4);
        save.daily.egg_collects.insert("fire:1".into(), 5);

        settle_all(&config, &mut save, 2000, "2026-07-08");

        let d = save.last_day_digest.as_ref().expect("翻日应归档");
        assert_eq!(d.date, "2026-07-07");
        assert_eq!(d.day_index, day_index_of("2026-07-07"));
        assert_eq!(d.clicks, 10);
        assert_eq!(d.keys, 200);
        assert_eq!(d.hatches, 3);
        assert_eq!(d.fusions, 3); // 2 + 1
        assert_eq!(d.eggs_minted, 4);
        assert_eq!(d.eggs_collected, 5);
        assert_eq!(d.coins_earned, 50);
        assert_eq!(d.releases, 1);
        assert!(d.night_owl);
        // day_index 与 date 互逆一致。
        assert_eq!(date_string_of_day_index(d.day_index), "2026-07-07");
    }

    #[test]
    fn empty_daily_date_is_not_archived() {
        let config = test_config();
        let mut save = fresh_save(&config);
        save.daily.date = String::new(); // 模拟新档尚未记过日期
        save.daily.clicks = 7;
        settle_all(&config, &mut save, 2000, "2026-07-08");
        assert!(save.last_day_digest.is_none(), "空日期不应弹出全零假战报");
    }

    #[test]
    fn buy_egg_slot_then_inventory_and_money_check() {
        let config = test_config();
        let mut save = fresh_save(&config);
        save.eggs.clear(); // free the tutorial slot
        save.coins = 400;
        logic_buy_egg(&config, &mut save, "normal", 1, 1000, "2026-07-07").unwrap();
        assert_eq!(save.coins, 240); // 一般蛋基价 160（v1.2 基价 ×2）
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
            shop_element: None,
        });
        let err = logic_collect_hatched(&config, &mut save, "egg-full", 2000, "2026-07-07").unwrap_err();
        assert_eq!(err, "#yardFull");
        assert_eq!(save.eggs.len(), 1, "egg keeps occupying the slot");
    }

    #[test]
    fn fusion_rules_and_result() {
        let config = test_config();
        let mut save = fresh_save(&config);
        save.eggs.clear();
        save.coins = 10_000;
        let max1 = config.max_level_for_tier(1);
        let a = add_pet(&mut save, &config, "emberfox", max1);
        let b = add_pet(&mut save, &config, "frostpeng", max1);

        // Non-max partner rejected.
        let c = add_pet(&mut save, &config, "guluduck", 1);
        assert!(logic_fuse_pets(&config, &mut save, &a, &c, 1000, "2026-07-07").is_err());

        // 融合 2.0：fire+ice 异物种 → 固定物种 onsenmonk（同步路径确定性=固定），
        // 消耗双亲、产出 2 阶蛋入 slot 0。
        let egg_id = logic_fuse_pets(&config, &mut save, &a, &b, 1000, "2026-07-07").unwrap();
        assert_eq!(save.coins, 10_000 - config.fusion_fee_for(1));
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
        save.coins = 10_000;
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
        assert_eq!(err, "#fusionMaxTier", "6 阶阻断：{err}");
    }

    #[test]
    fn release_refund_matches_gdd_and_protects_last_pet() {
        let config = test_config();
        let mut save = fresh_save(&config);
        let only = add_pet(&mut save, &config, "guluduck", 5);
        assert!(logic_release_pet(&config, &mut save, &only, 1000, "2026-07-07").is_err());

        // 1 阶冰精灵满级：等效价 = 300 × 20^0 = 300 → ⌊300×0.05⌋ + 10×5 = 15 + 50 = 65
        // （EconomyScaling.md v1.2 §8：返还率 0.25→0.05，堵「融合→放生」套利）。
        let ice = add_pet(&mut save, &config, "frostpeng", 10);
        let coins_before = save.coins;
        let refund = logic_release_pet(&config, &mut save, &ice, 1000, "2026-07-07").unwrap();
        assert_eq!(refund, 65);
        assert_eq!(save.coins, coins_before + 65);

        // 2 阶精灵按**实例阶**乘法等效价（§8）：guluswan 元素 [normal]、实例阶 2 →
        // 160 × 85^1 = 13600 → ⌊13600×0.05⌋ + 20×5 = 680 + 100 = 780。
        let swan = add_pet(&mut save, &config, "guluswan", 20);
        let refund = logic_release_pet(&config, &mut save, &swan, 1000, "2026-07-07").unwrap();
        assert_eq!(refund, 680 + 20 * 5);
    }

    #[test]
    fn token_feed_gives_exp_to_active_pet_and_never_pays_coins_or_stamina() {
        let config = test_config();
        let mut save = fresh_save(&config);
        save.eggs.clear();
        let active = add_pet(&mut save, &config, "guluduck", 1);
        save.active_pet_id = Some(active.clone());
        {
            let pet = save.pets.iter_mut().find(|p| p.id == active).unwrap();
            pet.stamina = 50;
        }
        let coins_before = save.coins;

        // 一阶换算率 555 单位/经验：3340 单位 → +6 经验（用 3330），余 10 进缓冲。
        // 一阶 Lv1→2 只要 4 经验 → 升到 Lv2、级内余 2。
        let outcome = logic_feed_tokens(&config, &mut save, 3340, 1000, "2026-07-07");
        assert_eq!(outcome.pet_id.as_deref(), Some(active.as_str()));
        assert_eq!(outcome.exp_gained, 6);
        assert!(outcome.leveled_up);
        assert_eq!(outcome.level_after, 2);
        assert_eq!(outcome.exp_after, 2);
        assert_eq!(outcome.wasted, 0);
        let pet = save.pets.iter().find(|p| p.id == active).unwrap();
        assert_eq!(pet.level, 2);
        assert_eq!(pet.exp, 2);
        assert_eq!(pet.token_buffer, 10);
        assert_eq!(pet.stamina, 50, "Token 不再回精力");
        assert_eq!(save.coins, coins_before, "Token 永不折金币");
        assert_eq!(save.stats.total_tokens_fed, 3340);

        // 再补 1100 单位凑满 2 点经验（缓冲 10+1100=1110=2×555）；Lv2→3 要 8 经验，2+2=4 不够升。
        let outcome = logic_feed_tokens(&config, &mut save, 1100, 1000, "2026-07-07");
        assert_eq!(outcome.exp_gained, 2);
        assert!(!outcome.leveled_up);
        assert_eq!(outcome.level_after, 2);
        assert_eq!(outcome.exp_after, 4);
        let pet = save.pets.iter().find(|p| p.id == active).unwrap();
        assert_eq!(pet.token_buffer, 0);
    }

    #[test]
    fn token_feed_never_spills_to_other_pets() {
        let config = test_config();
        let mut save = fresh_save(&config);
        save.eggs.clear();
        let active = add_pet(&mut save, &config, "guluduck", 1);
        let buddy = add_pet(&mut save, &config, "emberfox", 1);
        save.active_pet_id = Some(active.clone());
        {
            let pet = save.pets.iter_mut().find(|p| p.id == active).unwrap();
            pet.level = config.max_level_for_tier(pet.tier); // 满级
            pet.exp = 0;
            pet.token_buffer = 7;
        }

        // 陪伴宠满级 → 整段浪费、缓冲清零；绝不溢给伙伴（用户 2026-07-21 决策）。
        let outcome = logic_feed_tokens(&config, &mut save, 500, 1000, "2026-07-07");
        assert_eq!(outcome.exp_gained, 0);
        assert_eq!(outcome.wasted, 500);
        assert_eq!(outcome.pet_id.as_deref(), Some(active.as_str()));
        assert_eq!(save.pets.iter().find(|p| p.id == active).unwrap().token_buffer, 0);
        let buddy_pet = save.pets.iter().find(|p| p.id == buddy).unwrap();
        assert_eq!(buddy_pet.exp, 0, "经验绝不溢给其他宠");
        assert_eq!(buddy_pet.level, 1);

        // 无陪伴宠 → 同样整段浪费。
        save.active_pet_id = None;
        let outcome = logic_feed_tokens(&config, &mut save, 42, 1000, "2026-07-07");
        assert_eq!(outcome.pet_id, None);
        assert_eq!(outcome.wasted, 42);

        // 撞满级墙只吃到墙内的部分：Lv9 差 36 经验满级，喂 55500 单位（=100 经验，一阶率 555）
        // → 吃进 36、浪费 64×555=35520。
        save.active_pet_id = Some(buddy.clone());
        {
            let pet = save.pets.iter_mut().find(|p| p.id == buddy).unwrap();
            pet.level = 9;
            pet.exp = 0;
        }
        let outcome = logic_feed_tokens(&config, &mut save, 55500, 1000, "2026-07-07");
        assert_eq!(outcome.exp_gained, 36);
        assert!(outcome.leveled_up);
        assert_eq!(outcome.level_after, 10);
        assert_eq!(outcome.wasted, (100 - 36) * 555);
        assert_eq!(save.pets.iter().find(|p| p.id == buddy).unwrap().token_buffer, 0);
        // 成就：Token 把陪伴宠喂到满级也置「首次满级」旗标（与点击路径一致）。
        assert!(save.stats.first_maxlevel_done, "token 喂满级也应置 first_maxlevel_done");
    }

    #[test]
    fn key_feed_only_charges_active_pet() {
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

        // 陪伴宠满管 → 全部浪费；绝不溢给最低精力的伙伴（2026-07-21 机制修订）。
        let outcome = logic_feed_keys(&config, &mut save, 500, 1000, "2026-07-07");
        assert_eq!(outcome.stamina_fed, 0);
        assert_eq!(outcome.wasted, 500);
        assert!(outcome.per_pet.is_empty());
        assert_eq!(save.pets.iter().find(|p| p.id == buddy).unwrap().stamina, 10, "键盘精力绝不溢给其他宠");

        // 陪伴宠打空趴下 → 键盘只喂它，喂到唤醒线（20）直接喂醒；伙伴仍不动。
        {
            let pet = save.pets.iter_mut().find(|p| p.id == active).unwrap();
            pet.stamina = 0;
            pet.exhausted = true;
            pet.stamina_updated_at = 1000;
        }
        let outcome = logic_feed_keys(&config, &mut save, 30, 1000, "2026-07-07");
        assert_eq!(outcome.stamina_fed, 30, "1 阶 1 键/点");
        assert_eq!(outcome.per_pet.len(), 1);
        assert_eq!(outcome.per_pet[0].pet_id, active);
        assert_eq!(outcome.woke_pet_ids, vec![active.clone()]);
        assert!(!save.pets.iter().find(|p| p.id == active).unwrap().exhausted);
        assert_eq!(save.pets.iter().find(|p| p.id == buddy).unwrap().stamina, 10);

        // 快满管时超出的键数按浪费记。
        {
            let pet = save.pets.iter_mut().find(|p| p.id == active).unwrap();
            pet.stamina = config.stamina_max - 10;
        }
        let outcome = logic_feed_keys(&config, &mut save, 50, 1000, "2026-07-07");
        assert_eq!(outcome.stamina_fed, 10);
        assert_eq!(outcome.wasted, 40);
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
        let outcome = logic_feed_keys(&config, &mut save, 3, 1000, "2026-07-07");
        assert_eq!(outcome.stamina_fed, 0);
        assert_eq!(save.pets[0].key_buffer, 3);
        let outcome = logic_feed_keys(&config, &mut save, 2, 1000, "2026-07-07");
        assert_eq!(outcome.stamina_fed, 1);
        assert_eq!(save.pets[0].stamina, 1);
        assert_eq!(save.pets[0].key_buffer, 0);
    }

    #[test]
    fn ledger_breakdown_diff_tracks_seeds_and_self_heals() {
        use crate::codex_adapter::TokenBreakdown as B;
        let bd = |i, cc, cr, o| B { input: i, cache_create: cc, cache_read: cr, output: o };
        let config = test_config();
        let mut save = fresh_save(&config);
        // 首见项目 → 播种当前值、本次增量归零（绝不喂历史累计）。
        assert_eq!(
            ledger_breakdown_diff(&mut save, "proj", bd(5_000, 2_000, 90_000, 400)),
            B::default(),
            "首见项目自播种、不喂养"
        );
        // 之后逐项差分。
        assert_eq!(
            ledger_breakdown_diff(&mut save, "proj", bd(5_100, 2_000, 92_000, 460)),
            bd(100, 0, 2_000, 60)
        );
        // progress 被删/重置（总数回退）→ 逐项饱和相减自愈：负增量记 0、换锚。
        assert_eq!(
            ledger_breakdown_diff(&mut save, "proj", bd(10, 10, 10, 10)),
            B::default(),
            "回退自愈：增量为 0"
        );
        assert_eq!(save.last_seen_project_breakdown.get("proj"), Some(&bd(10, 10, 10, 10)));
        assert_eq!(
            ledger_breakdown_diff(&mut save, "proj", bd(15, 10, 10, 60)),
            bd(5, 0, 0, 50)
        );
    }

    #[test]
    fn token_feed_weights_apply_four_part_ratio() {
        use crate::codex_adapter::TokenBreakdown as B;
        // 权重 input/cache_create/cache_read/output = 5/0.2/0.01/2。
        let w = test_config().token_feed_weights;
        // 1000*5 + 1000*0.2 + 10_000*0.01 + 200*2 = 5000+200+100+400 = 5700。
        assert_eq!(w.feed_units(&B { input: 1_000, cache_create: 1_000, cache_read: 10_000, output: 200 }), 5_700);
        // 纯 cache_read 按 0.01 折算（500 → 5.0 → 5）。
        assert_eq!(w.feed_units(&B { input: 0, cache_create: 0, cache_read: 500, output: 0 }), 5);
        assert_eq!(w.feed_units(&B::default()), 0);
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
        assert_eq!(reloaded.version, 8, "v2 链式迁移到 v8（v3 经济 + v4 融合 + v5 槽注册补写 + v6 皮肤 + v7 成就统计 + v8 昨日战报）");
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
        assert_eq!(save.version, 8);
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

    fn sample_skin(file_id: u64) -> SpeciesSkin {
        SpeciesSkin {
            id: format!("ws:{file_id}"),
            visual: sample_custom_entry(["emberfox", "frostpeng"]).visual,
            name_zh: "炎泡鲸·星夜".to_string(),
            author_steam_id: "76561199838336217".to_string(),
            author_persona: None,
            published_file_id: file_id.to_string(),
            time_created: 500,
            imported_at: 1000,
            source: "shared".to_string(),
        }
    }

    #[test]
    fn migrates_v5_to_v6_keeps_provenance_unknown() {
        let config = test_config();
        let mut save = fresh_save(&config);
        save.version = 5;
        save.custom_species
            .insert("aifx1".to_string(), sample_custom_entry(["emberfox", "frostpeng"]));
        // 他人已认领该槽的 "" 标记：迁移必须原样保留（不得触发重发布）。
        save.workshop_published.insert("aifx1".to_string(), String::new());

        // 模拟 v5 存档字段形态：无 speciesSkins / skinSelected / origin。
        let mut value = serde_json::to_value(&save).unwrap();
        let object = value.as_object_mut().unwrap();
        object.remove("speciesSkins");
        object.remove("skinSelected");
        object
            .get_mut("customSpecies")
            .and_then(|c| c.as_object_mut())
            .and_then(|c| c.get_mut("aifx1"))
            .and_then(|e| e.as_object_mut())
            .unwrap()
            .remove("origin");

        let mut reloaded: GameSave = serde_json::from_value(value).expect("v5 存档必须能加载");
        assert!(migrate_save(&config, &mut reloaded, &BTreeMap::new(), 2000, "2026-07-07"));
        assert_eq!(reloaded.version, 8);
        assert!(reloaded.species_skins.is_empty());
        assert!(reloaded.skin_selected.is_empty());
        assert_eq!(
            reloaded.custom_species.get("aifx1").unwrap().origin,
            None,
            "存量条目出处不可知：迁移禁止回填 origin"
        );
        assert_eq!(
            reloaded.workshop_published.get("aifx1"),
            Some(&String::new()),
            "他人认领标记原样保留"
        );
        assert!(
            !migrate_save(&config, &mut reloaded, &BTreeMap::new(), 2001, "2026-07-07"),
            "幂等：二次迁移无改动"
        );
    }

    #[test]
    fn skin_select_rules() {
        let config = test_config();
        let mut save = fresh_save(&config);
        save.custom_species
            .insert("aifx1".to_string(), sample_custom_entry(["emberfox", "frostpeng"]));

        // 目录固定物种不可换肤；未知物种拒绝。
        assert_eq!(
            logic_select_skin(&config, &mut save, "guluduck", "default"),
            Err("#skinNotAiSpecies".to_string())
        );
        assert_eq!(
            logic_select_skin(&config, &mut save, "aifnone", "default"),
            Err("#skinSpeciesUnknown".to_string())
        );
        // default：fire+ice 配方有 0 号固定物种 → 允许。
        logic_select_skin(&config, &mut save, "aifx1", "default").unwrap();
        assert_eq!(save.skin_selected.get("aifx1").map(String::as_str), Some("default"));
        // ws: 未导入拒绝；导入后可选。
        assert_eq!(
            logic_select_skin(&config, &mut save, "aifx1", "ws:9001"),
            Err("#skinNotInstalled".to_string())
        );
        logic_install_skin(&mut save, "aifx1", sample_skin(9001)).unwrap();
        logic_select_skin(&config, &mut save, "aifx1", "ws:9001").unwrap();
        // local = 删键（缺省即本机形象）。
        logic_select_skin(&config, &mut save, "aifx1", "local").unwrap();
        assert!(!save.skin_selected.contains_key("aifx1"));
        // 非法 id。
        assert_eq!(
            logic_select_skin(&config, &mut save, "aifx1", "fancy"),
            Err("#skinInvalidId".to_string())
        );
    }

    #[test]
    fn skin_install_dedupes_caps_and_remove_falls_back() {
        let config = test_config();
        let mut save = fresh_save(&config);
        save.custom_species
            .insert("aifx1".to_string(), sample_custom_entry(["emberfox", "frostpeng"]));

        assert!(logic_install_skin(&mut save, "aifx1", sample_skin(9001)).unwrap());
        // 同 fileId 再导入 = 刷新元数据/形象，不新增。
        let mut updated = sample_skin(9001);
        updated.author_persona = Some("咕噜大师".to_string());
        updated.name_zh = "炎泡鲸·改".to_string();
        assert!(!logic_install_skin(&mut save, "aifx1", updated).unwrap());
        let list = save.species_skins.get("aifx1").unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].author_persona.as_deref(), Some("咕噜大师"));
        assert_eq!(list[0].name_zh, "炎泡鲸·改");

        // 封顶 MAX_SKINS_PER_SPECIES。
        for i in 0..(MAX_SKINS_PER_SPECIES as u64 - 1) {
            logic_install_skin(&mut save, "aifx1", sample_skin(10_000 + i)).unwrap();
        }
        assert_eq!(save.species_skins.get("aifx1").unwrap().len(), MAX_SKINS_PER_SPECIES);
        assert_eq!(
            logic_install_skin(&mut save, "aifx1", sample_skin(99_999)),
            Err("#skinCapReached".to_string())
        );

        // 移除正在使用的皮肤 → 选择回落 local（删键）。
        logic_select_skin(&config, &mut save, "aifx1", "ws:9001").unwrap();
        logic_remove_skin(&mut save, "aifx1", "ws:9001").unwrap();
        assert!(!save.skin_selected.contains_key("aifx1"));
        assert!(save.species_skins.get("aifx1").unwrap().iter().all(|s| s.id != "ws:9001"));
    }

    #[test]
    fn skin_import_does_not_register_species() {
        // 先入库决策：给未拥有的物种导皮肤 → 只进 speciesSkins，不注册物种/槽位/图鉴。
        let config = test_config();
        let mut save = fresh_save(&config);
        assert!(logic_install_skin(&mut save, "aif0203", sample_skin(9100)).unwrap());
        assert!(save.species_skins.contains_key("aif0203"));
        assert!(!save.custom_species.contains_key("aif0203"));
        assert!(save.recipe_ai_slots.is_empty());
        assert!(save.dex_obtained.is_empty());
        // 但未获得（无本体 entry）就不可选用。
        assert_eq!(
            logic_select_skin(&config, &mut save, "aif0203", "ws:9100"),
            Err("#skinSpeciesUnknown".to_string())
        );
    }

    #[test]
    fn skin_serde_uses_camel_case_and_roundtrips() {
        let config = test_config();
        let mut save = fresh_save(&config);
        save.custom_species
            .insert("aifx1".to_string(), sample_custom_entry(["emberfox", "frostpeng"]));
        logic_install_skin(&mut save, "aifx1", sample_skin(9001)).unwrap();
        logic_select_skin(&config, &mut save, "aifx1", "ws:9001").unwrap();

        let json = serde_json::to_string(&save).unwrap();
        for key in [
            "speciesSkins",
            "skinSelected",
            "authorSteamId",
            "publishedFileId",
            "timeCreated",
            "importedAt",
            "origin",
        ] {
            assert!(json.contains(key), "{key} 应以 camelCase 序列化");
        }
        let back: GameSave = serde_json::from_str(&json).unwrap();
        assert_eq!(back.species_skins.get("aifx1").unwrap()[0].id, "ws:9001");
        assert_eq!(back.skin_selected.get("aifx1").map(String::as_str), Some("ws:9001"));
    }

    #[test]
    fn release_refund_falls_back_for_unregistered_ai_species() {
        // Steam 侧导入的未注册 AI 变种（本机无 custom_species 条目、名字显示裸
        // codename）：放生不得被 #unknownSpecies 卡死——按确定性 codename 反解
        // 配方元素直算等效价（用户实报 2026-07-18：放生 aif0702 提示未知物种）。
        let config = test_config();
        let mut save = fresh_save(&config);
        let id = add_pet_at_tier(&mut save, &config, "aif0702", 4, 5);
        let refund = release_refund_for(&config, &save, &id).expect("放生不应被未知物种卡死");

        // 与直算同口径：ordinal 07 的配方元素 × 实例阶乘子 × 返还率 + 按级返还。
        let keys: Vec<String> = config.species_by_recipe.keys().cloned().collect();
        let recipe = crate::fusion_slots::multi_element_recipes_ordered(&keys)[7].clone();
        let elements: Vec<String> = recipe.split('+').map(String::from).collect();
        let expected = (config.equivalent_egg_price_for_elements(&elements, 4) as f64
            * config.release_refund_rate)
            .floor() as u64
            + config.release_refund_per_level * 5;
        assert_eq!(refund, expected);
        assert!(
            refund > config.release_refund_per_level * 5,
            "元素兜底生效（等效价非零）"
        );

        // 连配方都反解不出的异常名：只按等级返还，仍然放行。
        let weird = add_pet_at_tier(&mut save, &config, "mysteryblob", 2, 3);
        let refund = release_refund_for(&config, &save, &weird).unwrap();
        assert_eq!(refund, config.release_refund_per_level * 3);
    }

    #[test]
    fn upgrades_cost_and_cap() {
        let config = test_config();
        let mut save = fresh_save(&config);
        save.coins = 2_000_000_000; // 覆盖孵化屋(1.11亿)+后院(3.42亿)全程
        // 孵化屋：前两次升级 = 500 / 2500（v1.2 前两档收紧，槽 4 起回 ×10 阶梯）。
        let before = save.coins;
        logic_upgrade_hatchery(&config, &mut save, 1000, "2026-07-07").unwrap();
        logic_upgrade_hatchery(&config, &mut save, 1000, "2026-07-07").unwrap();
        assert_eq!(save.coins, before - 500 - 2_500);
        assert_eq!(save.hatchery_level, 3);
        // 继续升到 8 槽封顶（共 7 次），第 8 次拒绝。
        for _ in 0..5 {
            logic_upgrade_hatchery(&config, &mut save, 1000, "2026-07-07").unwrap();
        }
        assert_eq!(save.hatchery_level, 8);
        assert!(logic_upgrade_hatchery(&config, &mut save, 1000, "2026-07-07").is_err());
        assert_eq!(config.hatchery_slot_count(8), 8);

        // 后院：前两次升级 = 750 / 1065（v1.2 前陡后缓曲线，首档 750 × ~1.42）。
        let ybefore = save.coins;
        logic_upgrade_yard(&config, &mut save, 1000, "2026-07-07").unwrap();
        logic_upgrade_yard(&config, &mut save, 1000, "2026-07-07").unwrap();
        assert_eq!(save.coins, ybefore - 750 - 1_065);
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
        // 2 阶火蛋价 = 240 × 85 = 20400；买入后 tier=2、hatchKind=tier2。
        let coins = save.coins;
        let egg_id = logic_buy_egg(&config, &mut save, "fire", 2, 1000, "d").unwrap();
        assert_eq!(save.coins, coins - 20_400);
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
    fn egg_pool_is_global_fixed_only() {
        let config = test_config();
        let mut save = fresh_save(&config);
        // 1 阶火蛋：只有基础种 emberfox（唯一含火的 1 元素固定种）。
        let t1 = egg_pool_candidates(&config, "fire", 1);
        assert_eq!(t1, vec![("emberfox".to_string(), config.egg_rarity_weight(1))]);
        // 2 阶火蛋 = **全局池，无需解锁**：含火的 1~2 元素固定种全在，含尚未解锁的
        // steamalotl(fire+water)——这是本次改动的核心（旧行为要 dexObtained≥1 才入池）。
        let t2 = egg_pool_candidates(&config, "fire", 2);
        let codes: Vec<&str> = t2.iter().map(|(c, _)| c.as_str()).collect();
        assert!(codes.contains(&"emberfox"), "基础种恒在");
        assert!(
            codes.contains(&"steamalotl"),
            "未解锁的固定双属种也应入池（全局池）"
        );
        // 稀有度权重仍按元素数：元素越多越稀有。
        let w_base = t2.iter().find(|(c, _)| c == "emberfox").unwrap().1;
        let w_two = t2.iter().find(|(c, _)| c == "steamalotl").unwrap().1;
        assert!(w_base > w_two, "元素越多权重越小");
        // 属性过滤仍在：steamalotl(fire+water) 不进 electric 池。
        let elec = egg_pool_candidates(&config, "electric", 2);
        assert!(!elec.iter().any(|(c, _)| c == "steamalotl"));
        // 元素数 ≤ 蛋阶仍在：3 元素 pyrepeacock 不进 2 阶池，进 3 阶池。
        assert!(!t2.iter().any(|(c, _)| c == "pyrepeacock"));
        let t3 = egg_pool_candidates(&config, "fire", 3);
        assert!(t3.iter().any(|(c, _)| c == "pyrepeacock"));
        // AI 自定义变种**永不入商店池**（只经融合获得）——即便存档里有含火的自定义种且已入册。
        save.custom_species
            .insert("aiffireice".to_string(), sample_custom_entry(["emberfox", "frostbunny"]));
        record_species_obtained(&mut save, "aiffireice");
        let t2c = egg_pool_candidates(&config, "fire", 2);
        assert!(
            !t2c.iter().any(|(c, _)| c == "aiffireice"),
            "商店池只出固定配方物种，不含 AI 自定义变种"
        );
        // roll 可复现（roll=0 → 池首元素 emberfox）。
        assert_eq!(roll_egg_species(&config, "fire", 1, 0).as_deref(), Some("emberfox"));
    }

    #[test]
    fn fusion_daily_mint_cap_blocks_per_recipe_and_resets() {
        // 生产 config：fusionDailyMintCaps = [5,5,2,2,1,1] → 2 元素配方（fire+water）cap 5。
        let config = test_config();
        let mut save = fresh_save(&config);
        save.coins = 30_000; // 覆盖 7 次一阶融合费（1500×7）
        let mut pairs = Vec::new();
        for _ in 0..6 {
            let a = add_pet(&mut save, &config, "emberfox", 10);
            let b = add_pet(&mut save, &config, "bubblefrog", 10);
            pairs.push((a, b));
        }
        for (a, b) in &pairs[..5] {
            logic_fuse_pets(&config, &mut save, a, b, 1000, "2026-07-07").unwrap();
        }
        assert_eq!(save.daily.fusion_mints.get("fire+water").copied(), Some(5));
        let err = logic_fuse_pets(&config, &mut save, &pairs[5].0, &pairs[5].1, 1000, "2026-07-07").unwrap_err();
        assert!(
            err.starts_with("#fusionDailyCap|recipe=fire+water|cap="),
            "达上限应拒绝（协议键 + 配方键参数）: {err}"
        );
        // 配方独立计数：同物种融合走单元素键，不占 fire+water 配额。
        let c = add_pet(&mut save, &config, "guluduck", 10);
        let d = add_pet(&mut save, &config, "guluduck", 10);
        logic_fuse_pets(&config, &mut save, &c, &d, 1000, "2026-07-07").unwrap();
        assert_eq!(save.daily.fusion_mints.get("normal").copied(), Some(1));
        // 跨天重置：同一对次日可融，计数归 1。
        logic_fuse_pets(&config, &mut save, &pairs[5].0, &pairs[5].1, 1000, "2026-07-08").unwrap();
        assert_eq!(save.daily.fusion_mints.get("fire+water").copied(), Some(1), "跨天计数应重置");
    }

    #[test]
    fn collect_tier_follows_egg_not_species() {
        // 2 阶蛋掷中目录一阶物种（emberfox）→ 宠阶 = 蛋阶 2（蛋阶=宠阶；
        // 2026-07-16 真机 E2E 回归：旧逻辑会取物种自带 tier=1）。
        let config = test_config();
        let mut save = fresh_save(&config);
        save.eggs.clear();
        save.eggs.push(EggInstance {
            id: "egg-t2".into(),
            species: "emberfox".into(),
            tier: 2,
            hatch_kind: "tier2".into(),
            slot: Some(0),
            hatch_at: Some(1000),
            pending_fusion: None,
            steam_item_id: None,
            steam_item_def: None,
            shop_element: Some("fire".into()),
        });
        let pet_id = apply_collect(&config, &mut save, 0, 2000, Some(("emberfox".into(), "item-x".into(), 102)));
        let pet = save.pets.iter().find(|p| p.id == pet_id).unwrap();
        assert_eq!(pet.tier, 2, "蛋阶=宠阶，不受物种自带 tier 影响");
        assert_eq!(pet.steam_item_def, Some(102));
    }

    #[test]
    fn register_ai_slot_pads_forced_slots_and_appends_legacy() {
        let config = test_config();
        let mut save = fresh_save(&config);
        // Steam 掷中槽 3（乱序）：1/2 号用 "" 占位。
        register_ai_slot(&mut save, "fire+water", "aif0803");
        assert_eq!(
            save.recipe_ai_slots.get("fire+water").unwrap(),
            &vec!["".to_string(), "".to_string(), "aif0803".to_string()]
        );
        // 再掷中槽 1：填进占位，不重排。
        register_ai_slot(&mut save, "fire+water", "aif0801");
        assert_eq!(
            save.recipe_ai_slots.get("fire+water").unwrap(),
            &vec!["aif0801".to_string(), "".to_string(), "aif0803".to_string()]
        );
        // 幂等：重复注册不变。
        register_ai_slot(&mut save, "fire+water", "aif0803");
        assert_eq!(save.recipe_ai_slots.get("fire+water").unwrap().len(), 3);
        // 旧随机 codename：按注册序追加（原行为）。
        register_ai_slot(&mut save, "electric+ice", "aifab12cd");
        assert_eq!(
            save.recipe_ai_slots.get("electric+ice").unwrap(),
            &vec!["aifab12cd".to_string()]
        );
    }

    #[test]
    fn egg_daily_mint_cap_blocks_and_resets_next_day() {
        // test_config() 载入生产 config.json：eggDailyMintCaps = [10,8,6,3] → 4 阶上限 3。
        let config = test_config();
        let mut save = fresh_save(&config);
        save.coins = 500_000_000; // 覆盖 4×一般 4 阶蛋（9826 万/颗）+ 1×3 阶蛋（v1.3 乘数 85）
        save.shop_level = 4; // 可买 4 阶蛋
        // 头 3 次成功，第 4 次拒绝。
        for _ in 0..3 {
            logic_buy_egg(&config, &mut save, "normal", 4, 1000, "2026-07-07").unwrap();
        }
        let err = logic_buy_egg(&config, &mut save, "normal", 4, 1000, "2026-07-07").unwrap_err();
        assert!(
            err.starts_with("#eggDailyCap|recipe=normal|tier=4|cap="),
            "达上限应拒绝（协议键 + 属性/阶参数）: {err}"
        );
        assert_eq!(save.daily.egg_mints.get("normal:4").copied(), Some(3));
        // 不同阶独立计数：normal 3 阶仍可买（上限 8）。
        logic_buy_egg(&config, &mut save, "normal", 3, 1000, "2026-07-07").unwrap();
        assert_eq!(save.daily.egg_mints.get("normal:3").copied(), Some(1));
        // 跨天重置：换一天后 normal 4 阶又能买、计数归 1。
        logic_buy_egg(&config, &mut save, "normal", 4, 1000, "2026-07-08").unwrap();
        assert_eq!(save.daily.egg_mints.get("normal:4").copied(), Some(1), "跨天计数应重置");
    }

    #[test]
    fn empty_drop_message_splits_three_causes() {
        // ① 今日领满：收取侧计数 ≥ cap → 「明日请早」（#dropWindowCapped，带 cap 参数）。
        let daily = empty_drop_message(8, 8, 0, 100_000);
        assert_eq!(daily, "#dropWindowCapped|cap=8", "领满档应带 cap 参数: {daily}");
        // ② 分钟级冷却：未满 + 距上次成功收取 < 90s → 「一会儿再来」。
        let cd = empty_drop_message(2, 8, 100_050, 100_100); // 距上次 50s
        assert_eq!(cd, "#dropCooldown", "冷却档: {cd}");
        assert_ne!(cd, daily, "冷却档应区别于领满档");
        // ③ 攒时长：未满 + 无近期成功（时间戳久远/为 0）→ 「再玩会儿」。
        let warmup = empty_drop_message(0, 8, 0, 100_000);
        assert_eq!(warmup, "#dropPlaytimeShort", "攒时长档: {warmup}");
        assert_ne!(warmup, cd, "攒时长档应区别于冷却档");
        // 边界：距上次 90s（含）不再算冷却，回落攒时长档。
        assert_eq!(empty_drop_message(2, 8, 100_000, 100_090), warmup);
        // cap=0（理论无上限）不误判为领满。
        assert_eq!(empty_drop_message(99, 0, 0, 100_000), warmup);
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
            shop_element: None,
        });
        let count = logic_hatch_now(&mut save, 9999);
        assert_eq!(count, 1, "only the incubating egg is completed");
        assert_eq!(save.eggs[0].hatch_at, Some(9999));
        let inventory = save.eggs.iter().find(|e| e.id == "egg-inv").unwrap();
        assert_eq!(inventory.hatch_at, None, "inventory egg is left alone");
    }

    #[test]
    fn recipe_key_for_ai_codename_maps_ordinal_and_rejects_non_ai() {
        let config = test_config();
        let keys: Vec<String> = config.species_by_recipe.keys().cloned().collect();
        let ordered = crate::fusion_slots::multi_element_recipes_ordered(&keys);
        // aif00XX → 序号 0（首个多元素配方）；aif01XX → 序号 1。
        assert_eq!(
            recipe_key_for_ai_codename(&config, "aif0001").as_deref(),
            ordered.first().map(String::as_str)
        );
        assert_eq!(
            recipe_key_for_ai_codename(&config, "aif0105").as_deref(),
            ordered.get(1).map(String::as_str)
        );
        // 非新式 AI codename → None。
        assert_eq!(recipe_key_for_ai_codename(&config, "guluduck"), None);
        assert_eq!(recipe_key_for_ai_codename(&config, "aifab12cd"), None);
    }

    #[test]
    fn logic_register_workshop_species_registers_appearance_slot_and_skin() {
        // Steam 资产导入补形象：注册后同 codename 的宠物即从兜底鸭切成真形象。
        let config = test_config();
        let mut save = fresh_save(&config);
        let codename = "aif0001";
        let entry = sample_custom_entry(["guluduck", "bubblefrog"]);
        let skin = SpeciesSkin {
            id: "ws:123".to_string(),
            visual: entry.visual.clone(),
            name_zh: entry.info.name_zh.clone(),
            author_steam_id: "7656119".to_string(),
            author_persona: Some("tester".to_string()),
            published_file_id: "123".to_string(),
            time_created: 0,
            imported_at: 0,
            source: "first".to_string(),
        };
        assert!(logic_register_workshop_species(&config, &mut save, codename, entry.clone(), skin.clone()).is_ok());
        // 形象注册 + origin 强制覆写为 workshop（下载所得 origin 不可信）。
        let registered = save.custom_species.get(codename).expect("已注册自定义物种");
        assert_eq!(registered.origin.as_deref(), Some("workshop"));
        // AI 槽注册到正确配方 + 槽号（aif0001 → 1 号槽 → 下标 0）。
        let recipe_key = recipe_key_for_ai_codename(&config, codename).unwrap();
        assert_eq!(
            save.recipe_ai_slots.get(&recipe_key).map(|v| v[0].as_str()),
            Some(codename)
        );
        // 首发皮肤入库 + 放弃本机重发布标记。
        assert_eq!(save.species_skins.get(codename).map(Vec::len), Some(1));
        assert_eq!(save.workshop_published.get(codename).map(String::as_str), Some(""));
        // 幂等：已注册再调 → Ok 且不重复入库。
        assert!(logic_register_workshop_species(&config, &mut save, codename, entry, skin).is_ok());
        assert_eq!(save.species_skins.get(codename).map(Vec::len), Some(1), "幂等不重复入库");
    }

    fn sample_custom_entry(parents: [&str; 2]) -> CustomSpeciesEntry {
        CustomSpeciesEntry {
            info: SpeciesInfo {
                name_zh: "炎泡鲸".to_string(),
                name_en: "Emberwhale".to_string(),
                tier: 2,
                elements: vec!["fire".to_string(), "ice".to_string()],
                colors: vec!["#E8734A".to_string(), "#9BDCFF".to_string()],
                body: "frog".to_string(),
                desc: "肚子里烧着小火炉的温泉鲸".to_string(),
                desc_en: "A hot-spring whale with a tiny furnace in its belly.".to_string(),
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
                custom_rig: None,
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
            origin: Some("local".to_string()),
        }
    }

    #[test]
    fn ai_fusion_start_consumes_and_creates_pending_egg() {
        let config = test_config();
        let mut save = fresh_save(&config);
        save.eggs.clear();
        save.coins = 10_000;
        let max1 = config.max_level_for_tier(1);
        let a = add_pet(&mut save, &config, "emberfox", max1);
        let b = add_pet(&mut save, &config, "frostpeng", max1);

        let egg_id = logic_start_ai_fusion(&config, &mut save, &a, &b, 1000, "2026-07-07").unwrap();
        assert_eq!(save.coins, 10_000 - config.fusion_fee_for(1));
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
        save.coins = 10_000;
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
        save.coins = 10_000;
        let max1 = config.max_level_for_tier(1);
        let a = add_pet(&mut save, &config, "emberfox", max1);
        let b = add_pet(&mut save, &config, "frostpeng", max1);
        let egg_id = logic_start_ai_fusion(&config, &mut save, &a, &b, 1000, "2026-07-07").unwrap();

        // 与静态目录撞名。
        let err = logic_resolve_fusion_egg(&config, &mut save, &egg_id, "guluduck", sample_custom_entry(["a", "b"]))
            .unwrap_err();
        assert!(err.starts_with("#codenameTaken|codename="), "撞名应拒绝: {err}");

        // 蛋被提前收走（debug_hatch_now 场景）后 resolve 报错，结果被丢弃。
        logic_hatch_now(&mut save, 1000);
        logic_collect_hatched(&config, &mut save, &egg_id, 2000, "2026-07-07").unwrap();
        let err = logic_resolve_fusion_egg(&config, &mut save, &egg_id, "aifembwhale", sample_custom_entry(["a", "b"]))
            .unwrap_err();
        assert_eq!(err, "#eggGone");
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
        // fire+ice 实例阶 2 等效价（乘法，EconomyScaling.md v1.3 §8）= (240+300) × 85^1 = 45900
        // → ⌊45900×0.05⌋ + 5×5 = 2295 + 25。
        let refund = logic_release_pet(&config, &mut save, &id, 1000, "2026-07-07").unwrap();
        assert_eq!(refund, 2295 + 25);
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
