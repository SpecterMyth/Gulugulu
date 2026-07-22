use super::*;
use std::io::Write;
use std::path::Path;

/// 当前存档 schema 版本（create_initial_save 写入、migrate_save 迁移到此）。
/// 加载时高于此版本的存档拒绝加载（降级会静默丢字段，见 ensure_loaded）。
pub(crate) const CURRENT_SAVE_VERSION: u32 = 8;

pub fn create_initial_save(
    config: &GameConfig,
    historical_experience: u64,
    token_baseline: BTreeMap<String, u64>,
    now: i64,
    today: &str,
) -> GameSave {
    let bonus = historical_experience.min(config.historical_exp_coin_cap);
    let tutorial_seconds = *config.hatch_seconds.get("tutorial").unwrap_or(&60) as i64;
    GameSave {
        version: 8,
        coins: config.initial_coins + bonus,
        pets: Vec::new(),
        eggs: vec![EggInstance {
            id: new_id("egg"),
            species: "guluduck".to_string(),
            tier: 1,
            hatch_kind: "tutorial".to_string(),
            slot: Some(0),
            hatch_at: Some(now + tutorial_seconds),
            pending_fusion: None,
            steam_item_id: None,
            steam_item_def: None,
            shop_element: None,
        }],
        hatchery_level: 1,
        yard_level: 1,
        shop_level: 1,
        active_pet_id: None,
        last_seen_project_tokens: token_baseline,
        last_seen_project_breakdown: BTreeMap::new(),
        last_seen_project_experience: BTreeMap::new(),
        daily: DailyCounters {
            date: today.to_string(),
            ..DailyCounters::default()
        },
        tutorial_step: 0,
        tutorial_first_egg_bought: false,
        tutorial_first_fusion_done: false,
        last_seen_at: now,
        custom_species: BTreeMap::new(),
        dex_obtained: BTreeMap::new(),
        recipe_ai_slots: BTreeMap::new(),
        steam_owner_id: None,
        steam_outbox: Vec::new(),
        steam_tombstones: Vec::new(),
        workshop_published: BTreeMap::new(),
        workshop_preview_done: std::collections::BTreeSet::new(),
        last_shop_drop_at: 0,
        species_skins: BTreeMap::new(),
        skin_selected: BTreeMap::new(),
        stats: LifetimeStats::default(),
        last_day_digest: None,
        cloud_revision: 0,
        cloud_force_push: false,
    }
}

/// 从 `customSpecies` 补写 `recipeAiSlots`（FusionRecipeSlots §5）：按元素集配方键聚合，
/// 组内按 `createdAt`（并列按 codename）稳定排序 = 生成序，逐个补入尚未注册的槽，每配方
/// 封顶 `MAX_AI_SLOTS`。**只追加不重排**——已注册槽的既有顺序（可能已被 obtained 前缀依赖）
/// 保持不动。单元素/无元素 entry 不入 AI 槽（0 号固定物种由 config `speciesByRecipe` 已知）。
pub(crate) fn backfill_recipe_ai_slots(
    custom: &BTreeMap<String, CustomSpeciesEntry>,
    registry: &mut BTreeMap<String, Vec<String>>,
) {
    let mut by_recipe: BTreeMap<String, Vec<(i64, &str)>> = BTreeMap::new();
    for (codename, entry) in custom {
        let key = crate::fusion_slots::element_set_key(&entry.info.elements);
        if key.split('+').count() < 2 {
            continue; // 单元素/空集不占 AI 阶梯槽
        }
        by_recipe
            .entry(key)
            .or_default()
            .push((entry.created_at, codename.as_str()));
    }
    for (key, mut list) in by_recipe {
        list.sort_by(|a, b| a.0.cmp(&b.0).then_with(|| a.1.cmp(b.1)));
        let slots = registry.entry(key).or_default();
        for (_, codename) in list {
            if !slots.iter().any(|c| c == codename)
                && slots.len() < crate::fusion_slots::MAX_AI_SLOTS
            {
                slots.push(codename.to_string());
            }
        }
    }
}

/// v2 → v3 迁移（InteractionEconomy §9，2026-07-14 交互经济重构）：
/// 精力刻度从 100 换到 200 且无法从存档判断原配置，一次性回满补偿；
/// Token 账本从 experience 单位换成原始 token 口径，用 progress 快照重播种
/// （不追溯、不重复计数）。返回是否有改动（有则调用方立即落盘）。
pub(crate) fn migrate_save(
    config: &GameConfig,
    save: &mut GameSave,
    token_baseline: &BTreeMap<String, u64>,
    now: i64,
    today: &str,
) -> bool {
    let mut changed = false;
    if save.version < 3 {
        for pet in &mut save.pets {
            pet.stamina = config.stamina_max;
            pet.stamina_updated_at = now;
            pet.exhausted = false;
            pet.key_buffer = 0;
            pet.token_buffer = 0;
        }
        save.daily = DailyCounters {
            date: today.to_string(),
            ..DailyCounters::default()
        };
        save.last_seen_project_tokens = token_baseline.clone();
        save.last_seen_project_experience = BTreeMap::new();
        save.version = 3;
        changed = true;
    }
    // v3 → v4（融合 2.0，FusionRecipeSlots.md §5）：图鉴曾获账本从当前在册宠物
    // 播种（曾获下界，无法追溯已放生历史）。仅在 dex 为空时播种，避免与增量记账
    // 重复计数（幂等）。
    if save.version < 4 {
        if save.dex_obtained.is_empty() {
            for pet in &save.pets {
                *save.dex_obtained.entry(pet.species.clone()).or_insert(0) += 1;
            }
        }
        save.version = 4;
        changed = true;
    }
    // v4 → v5（FusionRecipeSlots §5 补写）：早期 logic_resolve_fusion_egg 漏写 recipeAiSlots，
    // 已生成的 AI 变种既不进图鉴对应格、也不推进前沿。从 customSpecies 按 (配方键, createdAt)
    // 补注册缺失槽（每配方封顶 10）。幂等，不重排已注册槽。
    if save.version < 5 {
        backfill_recipe_ai_slots(&save.custom_species, &mut save.recipe_ai_slots);
        save.version = 5;
        changed = true;
    }
    // v5 → v6（皮肤系统，SkinWorkshop.md）：新增 speciesSkins / skinSelected（serde
    // default 已给空表）与 CustomSpeciesEntry.origin。存量 custom_species 无法可靠
    // 区分本地生成/工坊下载 → origin 一律保持 None（禁止 blanket 标 "local"，防把
    // 他人设计当自家作品重发布）；workshop_published 的 "" 认领标记原样保留。
    // 纯版本号推进，幂等。
    if save.version < 6 {
        save.version = 6;
        changed = true;
    }
    // v6 → v7（Steam 成就，SteamAchievements.md §3.2）：新增 `stats: LifetimeStats`
    // （serde default 已给全零）。终身计数无法追溯历史，但**高水位可从当前宠物播种**——
    // 让老档一连上 Steam 就能回填已达成的品阶/满级成就（satisfied_achievements 会据此判定）。
    // days_played/login_streak 从 0 起，之后由 ensure_daily 累加。幂等（只取 max / 置真）。
    if save.version < 7 {
        for pet in &save.pets {
            if pet.tier > save.stats.highest_tier {
                save.stats.highest_tier = pet.tier;
            }
            if pet.level >= config.max_level_for_tier(pet.tier) {
                save.stats.first_maxlevel_done = true;
            }
        }
        save.version = 7;
        changed = true;
    }
    // v7 → v8（昨日战报，WelcomeBack 昨日总结）：新增 `last_day_digest`（Option，
    // serde default=None）与 DailyCounters 的 keys/hatches/coins_earned/releases/
    // night_owl（serde default=0/false）。无法追溯历史每日数据——首个归档在下一次
    // 本地日翻转时由 ensure_daily 产生。纯版本号推进，幂等。
    if save.version < 8 {
        save.version = 8;
        changed = true;
    }
    // 所有版本：时钟回拨防呆（settle_pet 也有同款钳制，这里让存档尽快自愈）。
    for pet in &mut save.pets {
        if pet.stamina_updated_at > now {
            pet.stamina_updated_at = now;
            changed = true;
        }
    }
    changed
}

// ---------------------------------------------------------------------------
// Persistence + command plumbing
// ---------------------------------------------------------------------------

pub(crate) fn save_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join("gulugulu-save.json"))
        .map_err(|error| error.to_string())
}

pub(crate) fn persist(app: &AppHandle, save: &GameSave) -> Result<(), String> {
    let path = save_path(app)?;
    persist_to(&path, save)
}

/// 原子写（临时文件 + fsync + rename），并把上一份好档轮转到 `.bak`：
/// - 撕裂存档会毁掉 Steam 绑定/墓碑，代价远超普通进度丢失（00-decisions.md）。
/// - 断电/BSOD 窗口里 rename 的元数据可能先于数据块落盘，事后主档会变成 0 字节
///   或半截 JSON；先 `sync_all` 临时文件再改名，保证改名后指向完整数据。
/// - 每次覆盖前把现有主档复制到 `.bak`（= 上一份成功落盘的快照），主档一旦损坏，
///   加载侧仍有一代可回退（见 `load_or_init_save`）。
pub(crate) fn persist_to(path: &Path, save: &GameSave) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|error| error.to_string())?;
    }
    let contents = serde_json::to_string_pretty(save).map_err(|error| error.to_string())?;
    let tmp = path.with_extension("json.tmp");
    {
        let mut file = fs::File::create(&tmp).map_err(|error| error.to_string())?;
        file.write_all(contents.as_bytes()).map_err(|error| error.to_string())?;
        file.sync_all().map_err(|error| error.to_string())?;
    }
    // 轮转 .bak：用 copy 而非 rename，避免出现主档短暂缺失的窗口。
    // 尽力而为——轮转失败不阻断本次保存（主档写入才是硬要求）。
    if path.exists() {
        let bak = path.with_extension("json.bak");
        let _ = fs::copy(path, &bak);
    }
    fs::rename(&tmp, path).map_err(|error| error.to_string())
}

pub(crate) fn ensure_loaded<'a>(
    app: &AppHandle,
    config: &GameConfig,
    guard: &'a mut Option<GameSave>,
) -> Result<&'a mut GameSave, String> {
    if guard.is_none() {
        let path = save_path(app)?;
        let save = load_or_init_save(app, config, &path)?;
        *guard = Some(save);
    }
    Ok(guard.as_mut().unwrap())
}

/// 单份存档文件的读取失败原因，决定该「隔离后新建」还是「拒绝加载」。
enum LoadError {
    /// 读不出（文件被占用/权限）或解析失败（撕裂/损坏）：可隔离后从 .bak/首启恢复。
    Unreadable(String),
    /// 版本高于当前二进制：降级会静默剥离新字段（甚至因缺必填字段整档失败）。
    /// **绝不覆写**——直接上抛，让调用链失败关闭而非毁掉更新过的存档。
    TooNew(u32),
}

/// 读一份存档文件：IO/解析失败 → `Unreadable`；版本超前 → `TooNew`。
fn read_save_file(path: &Path) -> Result<GameSave, LoadError> {
    let contents =
        fs::read_to_string(path).map_err(|error| LoadError::Unreadable(format!("read: {error}")))?;
    let save: GameSave = serde_json::from_str(&contents)
        .map_err(|error| LoadError::Unreadable(format!("parse: {error}")))?;
    if save.version > CURRENT_SAVE_VERSION {
        return Err(LoadError::TooNew(save.version));
    }
    Ok(save)
}

/// 迁移 + 旧档 token 账本播种；有改动立即落盘。
fn finalize_loaded(
    app: &AppHandle,
    config: &GameConfig,
    mut save: GameSave,
) -> Result<GameSave, String> {
    // 旧版存档只在需要时读一次 progress 快照做账本播种。
    let token_baseline = if save.version < 3 {
        crate::codex_adapter::progress_snapshot(app).1
    } else {
        BTreeMap::new()
    };
    if migrate_save(config, &mut save, &token_baseline, now_secs(), &today_string()) {
        persist(app, &save)?;
    }
    Ok(save)
}

/// 把无法加载的主档改名隔离（`.corrupt-<秒>.json`），避免下次启动再被当首启覆写，
/// 同时给人工恢复留一份。改名失败仅记录，不阻断启动。
fn quarantine(path: &Path) {
    let dest = path.with_extension(format!("corrupt-{}.json", now_secs()));
    match fs::rename(path, &dest) {
        Ok(()) => eprintln!("Gulugulu save: corrupt save quarantined to {}", dest.display()),
        Err(error) => eprintln!("Gulugulu save: failed to quarantine corrupt save: {error}"),
    }
}

/// 加载存档，严格区分三种情形，杜绝「损坏/占用 = 首启」的静默重置（丢全部进度 +
/// Steam 绑定）：
/// 1. 主档不存在 → 真首启（或用 `.bak` 恢复改名中途崩溃的窗口），正常新建。
/// 2. 主档在但读不出/解析失败 → 优先回退 `.bak`（上一代好档）；都救不回才隔离坏档后新建。
/// 3. 主档版本高于当前二进制（降级）→ 直接上抛，**决不覆写**。
fn load_or_init_save(
    app: &AppHandle,
    config: &GameConfig,
    path: &Path,
) -> Result<GameSave, String> {
    let bak = path.with_extension("json.bak");

    if path.exists() {
        match read_save_file(path) {
            Ok(save) => return finalize_loaded(app, config, save),
            Err(LoadError::TooNew(version)) => {
                return Err(format!(
                    "存档由更新版本（v{version}）写入，当前程序仅支持到 v{CURRENT_SAVE_VERSION}；\
                     请升级 Gulugulu 后再打开（存档未改动）。"
                ));
            }
            Err(LoadError::Unreadable(reason)) => {
                eprintln!("Gulugulu save: primary save unreadable ({reason}); trying .bak");
                // .bak 回退：上一代好档。TooNew 的 .bak 同样不能覆写主档，故此处仅接受可读的 .bak。
                if let Ok(save) = read_save_file(&bak) {
                    quarantine(path); // 隔离坏主档供人工排查
                    let save = finalize_loaded(app, config, save)?;
                    persist(app, &save)?; // 用 .bak 内容重建主档
                    return Ok(save);
                }
                // 主档与 .bak 都救不回：隔离坏主档后才允许新建（保留人工恢复的机会）。
                quarantine(path);
            }
        }
    } else if let Ok(save) = read_save_file(&bak) {
        // 主档缺失但 .bak 可用（改名中途崩溃的窗口）：用 .bak 恢复并重建主档。
        let save = finalize_loaded(app, config, save)?;
        persist(app, &save)?;
        return Ok(save);
    }

    // 真全新开局，或确认无可恢复数据。
    let (historical, token_baseline) = crate::codex_adapter::progress_snapshot(app);
    let save =
        create_initial_save(config, historical, token_baseline, now_secs(), &today_string());
    persist(app, &save)?;
    Ok(save)
}

pub(crate) fn with_save<T>(
    app: &AppHandle,
    state: &SharedGameState,
    mutate: impl FnOnce(&GameConfig, &mut GameSave) -> Result<T, String>,
) -> Result<(T, GameSave), String> {
    // 锁投毒恢复：某线程持锁 panic 后，默认每个后续 with_save 都会永久 Err
    // （买/点/融合/tick 全部静默失败，宠物假死到重启，用户无从知晓）。这里取回 guard，
    // 但**丢弃可能被 panic 半改写的内存档**（置 None），强制 ensure_loaded 从磁盘最近一次
    // 一致快照重载，避免把撕裂状态落盘（毁 Steam 绑定）。与 codex_adapter::lock_progress
    // 的解毒同理，但此处额外清缓存，因这把锁护的是可变内存档而非纯文件访问顺序。
    let mut guard = match state.save.lock() {
        Ok(guard) => guard,
        Err(poisoned) => {
            let mut guard = poisoned.into_inner();
            *guard = None;
            guard
        }
    };
    let save = ensure_loaded(app, &state.config, &mut guard)?;
    let result = mutate(&state.config, save)?;
    // 云同步修订号自增：任何本地落盘都抬高本机修订号，Steam 连线时「较新者胜」据此
    // 判定（SteamCloudSync.md）。置于 persist 前，使写盘字节即带新修订号。
    save.cloud_revision = save.cloud_revision.saturating_add(1);
    persist(app, save)?;
    // 成就：每次存档变更后判定并上报（前端庆祝 + Steam 幂等 set；SteamAchievements.md §4）。
    // 持存档锁下安全——report_achievements 只 emit 事件 + fire-and-forget 发泵线程，不等 channel。
    report_achievements(app, &state.config, save);
    Ok((result, save.clone()))
}

/// Token 四分账本差分（纯逻辑，供 feed_from_project_tokens 与单测共用）：
/// 逐项返回本次新增的四分 token（v1.3 四分喂养）。首见项目自播种当前值、
/// 视为无增量（不喂历史）；任一项 store < 基线（progress 被删/重置）时逐项
/// 饱和相减自愈——负增量记 0 并静默换锚，不会出现历史巨餐。
pub(crate) fn ledger_breakdown_diff(
    save: &mut GameSave,
    project_path: &str,
    project_breakdown: crate::codex_adapter::TokenBreakdown,
) -> crate::codex_adapter::TokenBreakdown {
    let last = save
        .last_seen_project_breakdown
        .get(project_path)
        .copied()
        .unwrap_or(project_breakdown); // 首见 → 播种当前值，本次 diff 归零
    save.last_seen_project_breakdown
        .insert(project_path.to_string(), project_breakdown);
    project_breakdown.saturating_sub(&last)
}

/// Token feed entry point called from the codex adapter watcher threads.
/// 四分账本差分 → 加权折算喂养单位 → **陪伴宠经验**（2026-07-21 机制修订；
/// 权重 cache_read/cache_create/output/input = 0.1/1/5/1 不变）。返回的
/// `fed_breakdown` 为本次真正吃进的原始四分 token，供气泡文案报明细。
/// Returns None when nothing was fed（无增量）。
pub fn feed_from_project_tokens(
    app: &AppHandle,
    state: &SharedGameState,
    project_path: &str,
    project_breakdown: crate::codex_adapter::TokenBreakdown,
) -> Option<TokenFeedOutcome> {
    let result = with_save(app, state, |config, save| {
        let diff = ledger_breakdown_diff(save, project_path, project_breakdown);
        let units = config.token_feed_weights.feed_units(&diff);
        if units == 0 {
            return Ok(TokenFeedOutcome::default());
        }
        let mut outcome = logic_feed_tokens(config, save, units, now_secs(), &today_string());
        outcome.fed_breakdown = diff;
        Ok(outcome)
    });
    match result {
        // 即便颗粒无经验入账（满级/缓冲未满一点）也返回，让前端凭 fed_breakdown 报"吃到…"。
        Ok((outcome, _)) if outcome.exp_gained > 0 || !outcome.fed_breakdown.is_zero() => {
            Some(outcome)
        }
        _ => None,
    }
}

/// 键盘充能入账（key_watcher 的 1s 节拍调用）。count 为已限速去重的按键数。
/// 只喂陪伴宠。Returns None when nothing was fed（缓冲未满一点或陪伴宠满管
/// ——缓冲照常入档）。
pub fn feed_keys(app: &AppHandle, state: &SharedGameState, count: u64) -> Option<EnergyFeedOutcome> {
    if count == 0 {
        return None;
    }
    let result = with_save(app, state, |config, save| {
        Ok(logic_feed_keys(config, save, count, now_secs(), &today_string()))
    });
    match result {
        Ok((outcome, _)) if outcome.stamina_fed > 0 => Some(outcome),
        _ => None,
    }
}

pub fn run_tick(app: &AppHandle, state: &SharedGameState) -> Option<GameSave> {
    let result = with_save(app, state, |config, save| {
        logic_tick(config, save, now_secs(), &today_string());
        Ok(())
    });
    result.ok().map(|(_, save)| save)
}

#[cfg(test)]
mod persist_tests {
    use super::*;
    use crate::game_config::GameConfig;

    fn test_config() -> GameConfig {
        serde_json::from_str(include_str!("../../../src/game/config.json")).unwrap()
    }

    fn temp_save_path() -> PathBuf {
        std::env::temp_dir()
            .join(new_id("gulugulu-persist-test"))
            .join("gulugulu-save.json")
    }

    fn cleanup(path: &Path) {
        if let Some(dir) = path.parent() {
            let _ = fs::remove_dir_all(dir);
        }
    }

    #[test]
    fn persist_to_roundtrips_and_rotates_bak() {
        let config = test_config();
        let path = temp_save_path();
        let bak = path.with_extension("json.bak");

        let mut save = create_initial_save(&config, 0, BTreeMap::new(), 1000, "2026-07-07");
        save.coins = 111;
        persist_to(&path, &save).unwrap();
        // 首写后主档在、.bak 尚不存在（无旧档可轮转）。
        assert!(path.exists());
        assert!(!bak.exists());

        // 二次写：.bak 应保存上一份（coins=111），主档为新值（coins=222）。
        save.coins = 222;
        persist_to(&path, &save).unwrap();
        let main = read_save_file(&path).unwrap_or_else(|_| panic!("main should parse"));
        assert_eq!(main.coins, 222);
        let prev = read_save_file(&bak).unwrap_or_else(|_| panic!("bak should parse"));
        assert_eq!(prev.coins, 111, ".bak 必须是上一代快照");

        cleanup(&path);
    }

    #[test]
    fn read_save_file_rejects_newer_version() {
        let config = test_config();
        let path = temp_save_path();
        let mut save = create_initial_save(&config, 0, BTreeMap::new(), 1000, "2026-07-07");
        save.version = CURRENT_SAVE_VERSION + 1;
        persist_to(&path, &save).unwrap();
        match read_save_file(&path) {
            Err(LoadError::TooNew(v)) => assert_eq!(v, CURRENT_SAVE_VERSION + 1),
            _ => panic!("超前版本必须被拒绝，绝不静默降级覆写"),
        }
        cleanup(&path);
    }

    #[test]
    fn read_save_file_flags_corrupt_as_unreadable_not_fresh() {
        let path = temp_save_path();
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, b"{ this is not valid json").unwrap();
        // 关键：损坏档必须报 Unreadable（→ 隔离/回退），绝不能被当成「文件不存在=首启」而静默重置。
        assert!(matches!(read_save_file(&path), Err(LoadError::Unreadable(_))));
        cleanup(&path);
    }

    #[test]
    fn current_save_version_matches_initial() {
        let config = test_config();
        let save = create_initial_save(&config, 0, BTreeMap::new(), 1000, "2026-07-07");
        assert_eq!(save.version, CURRENT_SAVE_VERSION);
    }
}
