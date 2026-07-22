//! WS4 真机冒烟（plans/steam_trade/04-testing.md A5-A7）—— 手动运行、默认 #[ignore]。
//!
//! 前置：Steam 客户端运行中 + 登录拥有 App 4956830 的账号；debug 构建
//! （GenerateItems 仅开发期有效）；`steam_api64.dll` 在 DLL 搜索路径
//! （PATH 里加 target/debug 或复制到 deps/）。
//!
//! 跑法（src-tauri 下）：
//!   快速兑换冒烟（A6/A7，约 1 分钟）：
//!     PATH="$PWD/target/debug:$PATH" cargo test --lib steam_smoke::a6_a7 -- --ignored --nocapture
//!   窗口封顶冒烟（A5，约 13 分钟，建议后台）：
//!     PATH="$PWD/target/debug:$PATH" cargo test --lib steam_smoke::a5 -- --ignored --nocapture
//!
//! 结论回填 04-testing.md 对应条目。测试自带清理（Consume 本次生成/开出的物品），
//! 兑换消耗的材料由 Steam 服务器原子销毁、无需清理。
#![cfg(test)]

use crate::steam_inventory::{self as inv, GrantedItem, OpOutcome};
use std::time::Duration;

const OP: Duration = Duration::from_secs(15);
const APP_ID: u32 = crate::steam::STEAM_APP_ID;

struct Smoke {
    client: steamworks::Client,
    /// 本次会话生成/开出且仍在库存的物品（清理时逐个 Consume）。
    cleanup: Vec<u64>,
}

impl Smoke {
    fn init() -> Self {
        let client = steamworks::Client::init_app(APP_ID).unwrap_or_else(|e| {
            panic!("SteamAPI init_app({APP_ID}) 失败：{e}。前置：Steam 客户端运行 + 拥有该 App 的账号登录")
        });
        eprintln!("[smoke] steam 连接 OK，steam_id={}", client.user().steam_id().raw());
        Smoke { client, cleanup: Vec::new() }
    }

    fn wait(&self, handle: steamworks_sys::SteamInventoryResult_t) -> OpOutcome {
        inv::wait_result(handle, OP, || self.client.run_callbacks())
    }

    fn generate(&mut self, defs: &[u32]) -> Vec<GrantedItem> {
        let outcome = self.wait(inv::start_generate(defs).expect("start_generate"));
        match outcome {
            OpOutcome::Granted(items) => {
                for it in &items {
                    self.cleanup.push(it.item_id.parse().unwrap());
                }
                eprintln!("[smoke] generate {defs:?} → {items:?}");
                items
            }
            other => panic!("generate {defs:?} 失败：{other:?}"),
        }
    }

    /// 兑换；成功时把产出登记进清理表并返回，失败原样返回。
    fn exchange(&mut self, target: u32, destroy: &[u64]) -> OpOutcome {
        let outcome = self.wait(inv::start_exchange(target, destroy).expect("start_exchange"));
        if let OpOutcome::Granted(items) = &outcome {
            for it in items {
                self.cleanup.push(it.item_id.parse().unwrap());
            }
            // 材料已被服务器销毁 → 从清理表移除。
            self.cleanup.retain(|id| !destroy.contains(id));
        }
        eprintln!("[smoke] exchange target={target} destroy={destroy:?} → {outcome:?}");
        outcome
    }

    fn trigger(&mut self, def: u32) -> OpOutcome {
        let outcome = self.wait(inv::start_trigger_drop(def).expect("start_trigger_drop"));
        if let OpOutcome::Granted(items) = &outcome {
            for it in items {
                self.cleanup.push(it.item_id.parse().unwrap());
            }
        }
        outcome
    }

    fn consume_cleanup(&mut self) {
        let ids = std::mem::take(&mut self.cleanup);
        for id in ids {
            let outcome = self.wait(match inv::start_consume(id) {
                Ok(h) => h,
                Err(e) => {
                    eprintln!("[smoke] cleanup consume {id} 发起失败：{e}");
                    continue;
                }
            });
            eprintln!("[smoke] cleanup consume {id} → {outcome:?}");
        }
    }
}

fn ids_by_def(items: &[GrantedItem], def: u32) -> Vec<u64> {
    items.iter().filter(|i| i.def == def).map(|i| i.item_id.parse().unwrap()).collect()
}

/// A6 + A7：set: 标签兑换 / item 型 def 自升阶 / 并集 generator 开池 + 负例。
/// 这是 Rust 铸造重接线（fuse→并集 gen）的前置验证。
#[test]
#[ignore = "真机冒烟：需 Steam 客户端 + 拥有 4956830 的账号（04-testing A6/A7）"]
fn a6_a7_exchange_primitives() {
    let mut s = Smoke::init();

    // ---- A6.1 set: 标签配对兑换（90006: set:fire,set:water;…）----
    let mats = s.generate(&[90003, 90004]);
    let fire = ids_by_def(&mats, 90003);
    let water = ids_by_def(&mats, 90004);
    assert!(!fire.is_empty() && !water.is_empty(), "缺 90003/90004 材料：{mats:?}");
    let out = s.exchange(90006, &[fire[0], water[0]]);
    match &out {
        OpOutcome::Granted(items) => {
            assert!(items.iter().any(|i| i.def == 90005), "A6.1 期望开出 90005，实得 {items:?}");
            eprintln!("[smoke] ✅ A6.1 set: 标签配对兑换 OK");
        }
        other => panic!("A6.1 set: 标签兑换失败：{other:?}"),
    }

    // ---- A6.2 item 型 def 自带 exchange 的同种升阶（101: sp:guluduck*2）----
    let d1 = s.generate(&[101]);
    let d2 = s.generate(&[101]);
    let mut ducks: Vec<u64> = [ids_by_def(&d1, 101), ids_by_def(&d2, 101)].concat();
    ducks.dedup();
    let destroy: Vec<u64> = if ducks.len() >= 2 {
        ducks[..2].to_vec()
    } else {
        // 同 def 堆叠成单实例 → 同 id 传两次（各扣 1）。
        vec![ducks[0], ducks[0]]
    };
    let out = s.exchange(101, &destroy);
    match &out {
        OpOutcome::Granted(items) => {
            assert!(items.iter().any(|i| i.def == 101), "A6.2 期望铸出新 101，实得 {items:?}");
            eprintln!("[smoke] ✅ A6.2 item 型 def 自升阶兑换 OK（净 −1）");
        }
        other => panic!("A6.2 自升阶兑换失败：{other:?}"),
    }

    // ---- A7.1 并集 generator 开池（normal+water → 20014；期望 615 或 11401..11410）----
    let mats = [s.generate(&[101]), s.generate(&[104])].concat();
    let duck = ids_by_def(&mats, 101);
    let frog = ids_by_def(&mats, 104);
    let out = s.exchange(20014, &[duck[0], frog[0]]);
    match &out {
        OpOutcome::Granted(items) => {
            let ok = items.iter().any(|i| i.def == 615 || (11401..=11410).contains(&i.def));
            assert!(ok, "A7.1 期望 615/11401..11410，实得 {items:?}");
            eprintln!("[smoke] ✅ A7.1 并集 generator 开池 OK → {items:?}");
        }
        other => panic!("A7.1 并集 generator 兑换失败：{other:?}"),
    }

    // ---- A7.2 负例：集合不满足并集（normal+water 材料 打 electric+fire 的 20000）----
    let mats = [s.generate(&[101]), s.generate(&[104])].concat();
    let duck = ids_by_def(&mats, 101);
    let frog = ids_by_def(&mats, 104);
    let out = s.exchange(20000, &[duck[0], frog[0]]);
    match &out {
        OpOutcome::Failed(e) => eprintln!("[smoke] ✅ A7.2 错误集合对被服务器拒绝：{e}"),
        OpOutcome::Granted(items) => panic!("A7.2 不该成功却开出 {items:?} —— set: 标签匹配失效！"),
        OpOutcome::Uncertain => panic!("A7.2 超时（Uncertain），无法判定"),
    }

    s.consume_cleanup();
    eprintln!("[smoke] === A6/A7 全部通过 ===");
}

/// 多元素 tag 值匹配试验：`set:fire+water*2`（对角配方，tag 值含 '+'）。
/// 真机 E2E 发现 t2 融合(需匹配多元素 set: 值)一律 k_EResultFail,而单元素值全通过
/// —— 怀疑 '+' 在 Steam 运行时 tag 匹配中失效。生成两只 90005(set:fire+water)
/// 打 90006 的对角配方验证。
#[test]
#[ignore = "真机试验：多元素 tag 值(含+)的 exchange 匹配"]
fn plus_in_tag_value_matching() {
    let mut s = Smoke::init();
    let m1 = s.generate(&[90005]);
    let m2 = s.generate(&[90005]);
    let mut ids: Vec<u64> = [ids_by_def(&m1, 90005), ids_by_def(&m2, 90005)].concat();
    ids.dedup();
    let destroy: Vec<u64> = if ids.len() >= 2 { ids[..2].to_vec() } else { vec![ids[0], ids[0]] };
    let out = s.exchange(90006, &destroy);
    eprintln!("[smoke] 对角(set:fire+water*2)结果: {out:?}");
    match &out {
        OpOutcome::Granted(items) if !items.is_empty() => {
            eprintln!("[smoke] ✅ '+' 值匹配正常——t2 失败另有原因");
        }
        other => {
            eprintln!("[smoke] ❌ '+' 值匹配失败({other:?})——确认 tag 值分隔符须改（如 '-'）");
        }
    }
    s.consume_cleanup();
}

/// t2 融合失败复现：与真机 E2E 完全同参——材料 10401(set:electric+water) +
/// 610(set:grass+ice) 打 20042(union electric+grass+ice+water)。
#[test]
#[ignore = "真机复现:t2 并集融合 k_EResultFail"]
fn repro_t2_union_exchange() {
    let mut s = Smoke::init();
    let m1 = s.generate(&[10_401]);
    let m2 = s.generate(&[610]);
    let a = ids_by_def(&m1, 10_401)[0];
    let b = ids_by_def(&m2, 610)[0];
    let out = s.exchange(20_042, &[a, b]);
    eprintln!("[smoke] t2 复现(10401+610→20042): {out:?}");
    s.consume_cleanup();
}

/// 只读快照：列出当前 Steam 库存全部物品（E2E 对账用，不动任何东西）。
#[test]
#[ignore = "真机只读:库存快照"]
fn inventory_snapshot() {
    let s = Smoke::init();
    match s.wait(inv::start_get_all().expect("start_get_all")) {
        OpOutcome::Granted(items) => {
            for it in &items {
                eprintln!("[snap] def={} item={} q={}", it.def, it.item_id, it.quantity);
            }
            eprintln!("[snap] 共 {} 条", items.len());
        }
        other => panic!("GetAll 失败：{other:?}"),
    }
}

/// A8 残留清理：消耗库存里全部 101 冒烟残留（逐 quantity 消；只动 101，
/// 不碰其它 def）。A5 尾测的 ConsumeItem 每次只消 1，堆叠会留残。
#[test]
#[ignore = "真机清理：消耗冒烟残留的 101（04-testing A8）"]
fn a8_cleanup_residue() {
    let s = Smoke::init();
    let items = match s.wait(inv::start_get_all().expect("start_get_all")) {
        OpOutcome::Granted(items) => items,
        other => panic!("GetAll 失败：{other:?}"),
    };
    eprintln!("[smoke] A8 库存快照：{items:?}");
    for it in items.iter().filter(|i| i.def == 101) {
        let id: u64 = it.item_id.parse().unwrap();
        for n in 0..it.quantity {
            let outcome = s.wait(inv::start_consume(id).expect("start_consume"));
            eprintln!("[smoke] consume {id} ({}/{}) → {outcome:?}", n + 1, it.quantity);
        }
    }
    eprintln!("[smoke] === A8 清理完成 ===");
}

/// A5 尾测：主测被超时截断时的补测 —— 先 GetAll 盘点库存里未绑定的 101 存量
/// （≈ 前轮已掉数，主测被杀时清理没跑），再 4 轮 × 61s 触发观察是否已封顶，
/// 最后 Consume 全部 101（两轮测试共同清理）。
#[test]
#[ignore = "真机冒烟：A5 补测（约 4 分钟）"]
fn a5_tail_check() {
    let mut s = Smoke::init();
    let count_101 = |s: &Smoke| -> Vec<u64> {
        match s.wait(inv::start_get_all().expect("start_get_all")) {
            OpOutcome::Granted(items) => ids_by_def(&items, 101),
            other => panic!("GetAll 失败：{other:?}"),
        }
    };
    let before = count_101(&s);
    eprintln!("[smoke] A5-tail 起始库存 101 × {}（≈主测已掉数）", before.len());
    let mut got = 0usize;
    for round in 1..=4 {
        let out = s.trigger(21011);
        if let OpOutcome::Granted(items) = &out {
            got += items.len();
        }
        eprintln!("[smoke] A5-tail round {round}: {out:?}（本测累计 {got}）");
        if round < 4 {
            let until = std::time::Instant::now() + Duration::from_secs(61);
            while std::time::Instant::now() < until {
                s.client.run_callbacks();
                std::thread::sleep(Duration::from_millis(200));
            }
        }
    }
    let after = count_101(&s);
    eprintln!(
        "[smoke] A5 汇总：窗口内总掉落 = {}（起始 {} + 本测 {}），上限 10 → {}",
        after.len(),
        before.len(),
        got,
        if after.len() <= 10 { "✅ 未超" } else { "❌ 超限" }
    );
    assert!(after.len() <= 10, "窗口累计 {} 超过 drop_max_per_window=10", after.len());
    for id in after {
        let outcome = s.wait(inv::start_consume(id).expect("start_consume"));
        eprintln!("[smoke] cleanup consume {id} → {outcome:?}");
    }
    s.cleanup.clear();
    eprintln!("[smoke] === A5-tail 完成 ===");
}

/// A5：24h 窗口封顶 + burst。打商店 gen 21011（drop_interval:1 → 每分钟游玩掉 1，
/// drop_max_per_window:10 + 应用级窗口 1440 → 每日至多 10）。
/// 每 61s 一发 × 13 次 ≈ 13 分钟：期望累计 ≈10 个 101 后转空（封顶生效）。
/// 次日窗口重置属隔天观察项，不在本测试内。
#[test]
#[ignore = "真机冒烟：约 13 分钟（04-testing A5），建议后台运行"]
fn a5_window_cap() {
    let mut s = Smoke::init();
    let mut granted_total = 0usize;
    let mut results = Vec::new();
    for round in 1..=13 {
        let out = s.trigger(21011);
        let got = match &out {
            OpOutcome::Granted(items) => {
                granted_total += items.len();
                items.len()
            }
            OpOutcome::Failed(e) => {
                eprintln!("[smoke] round {round}: Failed({e})");
                0
            }
            OpOutcome::Uncertain => 0,
        };
        results.push(got);
        eprintln!("[smoke] A5 round {round}: +{got}（累计 {granted_total}）");
        if round < 13 {
            // 等下一分钟游玩时长；期间持续跑回调。
            let until = std::time::Instant::now() + Duration::from_secs(61);
            while std::time::Instant::now() < until {
                s.client.run_callbacks();
                std::thread::sleep(Duration::from_millis(200));
            }
        }
    }
    eprintln!("[smoke] A5 结果序列 {results:?}，累计 {granted_total}（期望 ≈10 后转空=封顶生效）");
    assert!(granted_total >= 1, "13 分钟内一个都没掉——drop_interval/窗口配置或发布未生效");
    assert!(granted_total <= 10, "累计 {granted_total} 超过 drop_max_per_window=10——封顶未生效！");
    s.consume_cleanup();
    eprintln!("[smoke] === A5 完成：累计 {granted_total}/10 ===");
}

/// 2026-07-17/18 首发上传期产生的重复物品（索引延迟 + 双实例互踩重传）审计口径：
/// 已知曾上传过的全部槽位。皮肤系统（SkinWorkshop.md）下多物品/槽位合法（多款皮肤），
/// 只有「同账号 + 内容逐字节相同」才算垃圾重复。
const AUDIT_SLOTS: &[&str] = &[
    "aif0401", "aif0601", "aif0602", "aif0801", "aif1001", "aif1101", "aif1201", "aif2301",
    "aif3701", "aif4201", "aif4301",
];

#[test]
#[ignore = "真机只读：审计各槽位工坊物品（重复/预览图/内容指纹），不做任何修改"]
fn workshop_audit_slots() {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let s = Smoke::init();
    let mut total = 0usize;
    for codename in AUDIT_SLOTS {
        let metas =
            match crate::steam_workshop::list_for_pet_id(&s.client, APP_ID, codename, Duration::ZERO) {
                Ok(m) => m,
                Err(e) => {
                    eprintln!("[audit] {codename}: 查询失败 {e}");
                    continue;
                }
            };
        total += metas.len();
        let first = crate::steam_workshop::first_file_id(&metas);
        for m in &metas {
            let content = crate::steam_workshop::fetch_item(&s.client, m.published_file_id)
                .map(|(_, json)| json)
                .unwrap_or_else(|e| format!("<下载失败:{e}>"));
            let mut h = DefaultHasher::new();
            content.hash(&mut h);
            eprintln!(
                "[audit] {codename} id={} t={} owner={} title={:?} preview={} len={} hash={:016x}{}",
                m.published_file_id,
                m.time_created,
                m.owner_steam_id,
                m.title,
                m.preview_url.as_deref().map_or("无", |u| if u.is_empty() { "空" } else { "有" }),
                content.len(),
                h.finish(),
                if Some(m.published_file_id) == first { "  <-- 首发" } else { "" },
            );
        }
    }
    eprintln!("[audit] 合计 {total} 条物品");
}

#[test]
#[ignore = "真机探针：给 aif0401 挂预览图并立即回查服务器侧 preview_url（验证预览是否真正入库）"]
fn workshop_preview_probe() {
    let s = Smoke::init();
    let target: u64 = 3765893901; // aif0401 汐跃侯（首发条目）
    let (_, json) = crate::steam_workshop::fetch_item(&s.client, target).expect("下载 aif0401 内容");
    let png = std::path::PathBuf::from(std::env::var("APPDATA").expect("APPDATA"))
        .join("com.gulugulu.pet")
        .join("species-previews")
        .join("aif0401.png");
    assert!(png.is_file(), "预览 PNG 缓存缺失：{}", png.display());
    match crate::steam_workshop::update_preview(&s.client, APP_ID, target, "aif0401", "汐跃侯", &json, &png)
    {
        Ok(()) => eprintln!("[probe] SubmitItemUpdate Ok"),
        Err(e) => {
            eprintln!("[probe] SubmitItemUpdate 失败：{e}");
            return; // 拒绝也算结论（配额/权限），下面的回查照做
        }
    }
    // 立即回查服务器侧状态（不依赖网页缓存）。
    std::thread::sleep(Duration::from_secs(5));
    let details = crate::steam_workshop::item_details(&s.client, target).expect("item_details");
    eprintln!(
        "[probe] 服务器侧 preview_url = {:?}",
        details.meta.preview_url.as_deref().unwrap_or("<无>")
    );
}

#[test]
#[ignore = "真机维护：云配额发布后——探针验证预览可入库 → 全量挂设定图（回查 preview_url）→ 删同内容重复件"]
fn workshop_repair_previews() {
    let s = Smoke::init();
    let png_dir = std::path::PathBuf::from(std::env::var("APPDATA").expect("APPDATA"))
        .join("com.gulugulu.pet")
        .join("species-previews");
    // 探针放最前：aif0601 今天没消耗过更新配额。失败即中止，不烧其余物品的当日配额。
    let ordered: Vec<&str> = {
        let mut v: Vec<&str> = AUDIT_SLOTS.to_vec();
        v.retain(|c| *c != "aif0601");
        let mut o = vec!["aif0601"];
        o.extend(v);
        o
    };
    let mut done = 0usize;
    for (index, codename) in ordered.iter().enumerate() {
        let png = png_dir.join(format!("{codename}.png"));
        if !png.is_file() {
            eprintln!("[repair] {codename}: 无 PNG 缓存，跳过");
            continue;
        }
        let metas =
            match crate::steam_workshop::list_for_pet_id(&s.client, APP_ID, codename, Duration::ZERO) {
                Ok(m) if !m.is_empty() => m,
                Ok(_) => {
                    eprintln!("[repair] {codename}: 无物品，跳过");
                    continue;
                }
                Err(e) => {
                    eprintln!("[repair] {codename}: 查询失败 {e}");
                    continue;
                }
            };
        let Some(keeper) = crate::steam_workshop::first_file_id(&metas) else { continue };
        // 预览已入库的不再动（省单物品每日更新配额）。用单物品查询取最新态——
        // 批量列表查询的 preview_url 有缓存延迟，会误判成"无预览"导致重复更新。
        let fresh_preview = crate::steam_workshop::item_details(&s.client, keeper)
            .ok()
            .and_then(|d| d.meta.preview_url)
            .map_or(false, |u| !u.is_empty());
        if fresh_preview {
            eprintln!("[repair] {codename}: id={keeper} 预览已在库，跳过");
            done += 1;
            continue;
        }
        let (details, json) = match crate::steam_workshop::fetch_item(&s.client, keeper) {
            Ok(v) => v,
            Err(e) => {
                eprintln!("[repair] {codename}: 内容下载失败（{e}），跳过");
                continue;
            }
        };
        match crate::steam_workshop::update_preview(
            &s.client,
            APP_ID,
            keeper,
            codename,
            &details.meta.title,
            &json,
            &png,
        ) {
            Ok(()) => {}
            Err(e) => {
                eprintln!("[repair] {codename}: 更新失败（{e}）");
                if index == 0 {
                    eprintln!("[repair] 探针失败，中止（不烧其余物品配额）");
                    return;
                }
                continue;
            }
        }
        std::thread::sleep(Duration::from_secs(4));
        let verified = crate::steam_workshop::item_details(&s.client, keeper)
            .ok()
            .and_then(|d| d.meta.preview_url)
            .map_or(false, |u| !u.is_empty());
        eprintln!(
            "[repair] {codename}: id={keeper} 预览已入库={}",
            if verified { "✅是" } else { "❌否" }
        );
        if index == 0 && !verified {
            eprintln!("[repair] 探针预览未入库，中止（云配额可能未生效，稍后再试）");
            return;
        }
        if verified {
            done += 1;
        } else {
            // 失败/未入库：拉开间隔避开洪水节流，下轮重跑收敛。
            std::thread::sleep(Duration::from_secs(30));
        }
        // 删除同账号 + 同内容的重复件（保最早）。皮肤模型下不同内容=不同皮肤，不动。
        for m in &metas {
            if m.published_file_id == keeper {
                continue;
            }
            let dup_same = crate::steam_workshop::fetch_item(&s.client, m.published_file_id)
                .map(|(d, dj)| d.meta.owner_steam_id == details.meta.owner_steam_id && dj == json)
                .unwrap_or(false);
            if dup_same {
                let (tx, rx) = std::sync::mpsc::channel();
                s.client
                    .ugc()
                    .delete_item(steamworks::PublishedFileId(m.published_file_id), move |r| {
                        let _ = tx.send(r);
                    });
                let started = std::time::Instant::now();
                loop {
                    s.client.run_callbacks();
                    match rx.try_recv() {
                        Ok(Ok(())) => {
                            eprintln!("[repair] {codename}: 已删除重复件 {}", m.published_file_id);
                            break;
                        }
                        Ok(Err(e)) => {
                            eprintln!("[repair] {codename}: 删除 {} 失败 {e:?}", m.published_file_id);
                            break;
                        }
                        Err(_) if started.elapsed() > Duration::from_secs(20) => {
                            eprintln!("[repair] {codename}: 删除 {} 超时", m.published_file_id);
                            break;
                        }
                        Err(_) => std::thread::sleep(Duration::from_millis(50)),
                    }
                }
            }
        }
        std::thread::sleep(Duration::from_secs(3));
    }
    eprintln!("[repair] === 完成：{done} 个物品预览已确认入库 ===");
}

#[test]
#[ignore = "真机只读：无标签过滤枚举本 App 全部工坊物品（找审计名单外的孤儿条目）"]
fn workshop_list_all_items() {
    use steamworks::{AppIDs, AppId, UGCQueryType, UGCType};
    let s = Smoke::init();
    let query = s
        .client
        .ugc()
        .query_all(
            UGCQueryType::RankedByPublicationDate,
            UGCType::Items,
            AppIDs::Both { creator: AppId(APP_ID), consumer: AppId(APP_ID) },
            1,
        )
        .expect("query_all")
        .set_return_key_value_tags(true);
    let (tx, rx) = std::sync::mpsc::channel();
    query.fetch(move |res| {
        let mapped = res.map(|results| {
            let mut rows = Vec::new();
            for i in 0..results.returned_results() {
                if let Some(r) = results.get(i) {
                    let mut pet_id = None;
                    for k in 0..results.key_value_tags(i) {
                        if let Some((key, value)) = results.get_key_value_tag(i, k) {
                            if key == "petId" {
                                pet_id = Some(value);
                                break;
                            }
                        }
                    }
                    rows.push((r.published_file_id.0, r.time_created, r.title.clone(), pet_id));
                }
            }
            rows
        });
        let _ = tx.send(mapped);
    });
    let started = std::time::Instant::now();
    loop {
        s.client.run_callbacks();
        match rx.try_recv() {
            Ok(Ok(rows)) => {
                for (id, t, title, pet_id) in &rows {
                    let known = pet_id.as_deref().map_or(false, |p| AUDIT_SLOTS.contains(&p));
                    eprintln!(
                        "[all] id={id} t={t} petId={:?} title={title:?}{}",
                        pet_id,
                        if known { "" } else { "  <-- 名单外" }
                    );
                }
                eprintln!("[all] 合计 {} 条", rows.len());
                break;
            }
            Ok(Err(e)) => panic!("查询失败 {e:?}"),
            Err(_) if started.elapsed() > Duration::from_secs(30) => panic!("查询超时"),
            Err(_) => std::thread::sleep(Duration::from_millis(50)),
        }
    }
}

#[test]
#[ignore = "真机终极修复：aif4201 更新持续 Generic → 删除重发（同内容+预览一步到位）"]
fn workshop_republish_4201() {
    let s = Smoke::init();
    let old_id: u64 = 3765894508; // aif4201 霁壳灵（该槽唯一条目，本机所有）
    let (details, json) = crate::steam_workshop::fetch_item(&s.client, old_id).expect("下载 4201 内容");
    assert!(json.len() > 1000, "内容异常短（{}），不删", json.len());
    let title = details.meta.title.clone();
    eprintln!("[republish] 内容 {} bytes，标题 {title}", json.len());
    let png = std::path::PathBuf::from(std::env::var("APPDATA").expect("APPDATA"))
        .join("com.gulugulu.pet")
        .join("species-previews")
        .join("aif4201.png");
    assert!(png.is_file(), "PNG 缺失");
    // 删旧。
    let (tx, rx) = std::sync::mpsc::channel();
    s.client.ugc().delete_item(steamworks::PublishedFileId(old_id), move |r| {
        let _ = tx.send(r);
    });
    let started = std::time::Instant::now();
    loop {
        s.client.run_callbacks();
        match rx.try_recv() {
            Ok(Ok(())) => {
                eprintln!("[republish] 旧条目 {old_id} 已删除");
                break;
            }
            Ok(Err(e)) => panic!("删除失败：{e:?}"),
            Err(_) if started.elapsed() > Duration::from_secs(30) => panic!("删除超时"),
            Err(_) => std::thread::sleep(Duration::from_millis(50)),
        }
    }
    std::thread::sleep(Duration::from_secs(3));
    // 重发（带预览）。
    let (new_id, legal) =
        crate::steam_workshop::publish(&s.client, APP_ID, "aif4201", &title, &json, Some(&png))
            .expect("重发失败");
    eprintln!("[republish] 新条目 {new_id} legal={legal}");
    std::thread::sleep(Duration::from_secs(5));
    let verified = crate::steam_workshop::item_details(&s.client, new_id)
        .ok()
        .and_then(|d| d.meta.preview_url)
        .map_or(false, |u| !u.is_empty());
    eprintln!("[republish] 新条目预览已入库={}", if verified { "✅是" } else { "❌否" });
}

#[test]
#[ignore = "真机对照探针：同一物品做「无预览」完整更新，隔离预览上传是否是失败源"]
fn workshop_update_probe_no_preview() {
    let s = Smoke::init();
    let target: u64 = 3765893901; // aif0401 汐跃侯
    let (_, json) = crate::steam_workshop::fetch_item(&s.client, target).expect("下载内容");
    let dir = std::env::temp_dir().join("gulugulu-ugc-probe").join("aif0401");
    std::fs::create_dir_all(&dir).expect("mkdir");
    std::fs::write(dir.join("species.gulupet.json"), &json).expect("write");
    let dir = dir.canonicalize().expect("canonicalize");
    let update = s
        .client
        .ugc()
        .start_item_update(steamworks::AppId(APP_ID), steamworks::PublishedFileId(target))
        .title("汐跃侯")
        .content_path(&dir);
    let (tx, rx) = std::sync::mpsc::channel();
    update.submit(Some("no-preview probe"), move |res| {
        let _ = tx.send(res);
    });
    let started = std::time::Instant::now();
    loop {
        s.client.run_callbacks();
        match rx.try_recv() {
            Ok(Ok((id, legal))) => {
                eprintln!("[probe2] 无预览更新 Ok id={} legal={legal}", id.0);
                break;
            }
            Ok(Err(e)) => {
                eprintln!("[probe2] 无预览更新失败：{e:?}");
                break;
            }
            Err(_) if started.elapsed() > Duration::from_secs(30) => {
                eprintln!("[probe2] 超时");
                break;
            }
            Err(_) => std::thread::sleep(Duration::from_millis(50)),
        }
    }
}

#[test]
#[ignore = "真机只读：创意工坊 resolve 正命中（需先有已上传的 AI 形象，2026-07-16 起 9 条在库）"]
fn workshop_resolve_roundtrip() {
    // 验证「最早发布者胜」复用路径的正命中一半：query_all(petId 标签) 在
    // 「非公开(unlisted)」曝光下能找到已上传物品，并能下载读回合法的
    // CustomSpeciesEntry JSON。负命中（无人认领 → Ok(None)）已由补传首跑实证。
    let s = Smoke::init();
    let (details, json) = crate::steam_workshop::resolve(&s.client, APP_ID, "aif0401")
        .expect("resolve 调用失败")
        .expect("aif0401 应已有全局形象（2026-07-16 补传 publishedFileId=3765893901）");
    let entry: serde_json::Value = serde_json::from_str(&json).expect("下载内容应为合法 JSON");
    assert!(entry.get("info").and_then(|i| i.get("nameZh")).is_some(), "内容缺 info.nameZh");
    assert_eq!(
        entry.get("parents").map(|p| p.is_array()),
        Some(true),
        "内容缺 parents 数组"
    );
    // 皮肤系统扩展面：详情应带回 petId 标签与上传者 SteamID（首发皮肤入库依据）。
    assert_eq!(details.pet_id.as_deref(), Some("aif0401"), "详情缺 petId 标签");
    assert!(details.meta.owner_steam_id > 0, "详情缺上传者 SteamID");
    eprintln!(
        "[smoke] workshop resolve aif0401 → {} bytes，nameZh={:?}，owner={}，persona={:?}",
        json.len(),
        entry["info"]["nameZh"],
        details.meta.owner_steam_id,
        details.meta.owner_persona,
    );
    // 未认领槽位仍应返回 None（用一个不可能的测试专用槽名）。
    let none = crate::steam_workshop::resolve(&s.client, APP_ID, "aif9901").expect("resolve 调用失败");
    assert!(none.is_none(), "aif9901 不应有人认领");
    eprintln!("[smoke] === workshop resolve 冒烟完成 ===");
}

/// 探活极性验证（steam.rs 重连守卫的前提）：Steam 客户端开着时
/// `SteamAPI_IsSteamRunning` 必须回 true —— 假阴性会让泵线程误判掉线、
/// 反复摘连接重连。init 前/后各测一次（守卫在连上后调用，但该函数本身不应依赖 init）。
///
/// 跑法：PATH="$PWD/target/debug:$PATH" cargo test --lib steam_smoke::steam_running_probe -- --ignored --nocapture
#[test]
#[ignore]
fn steam_running_probe() {
    let before = unsafe { steamworks_sys::SteamAPI_IsSteamRunning() };
    eprintln!("[smoke] init 前 IsSteamRunning = {before}");
    let s = Smoke::init();
    let after = unsafe { steamworks_sys::SteamAPI_IsSteamRunning() };
    eprintln!("[smoke] init 后 IsSteamRunning = {after}");
    s.client.run_callbacks();
    assert!(after, "Steam 开着却探活 false —— 重连守卫会误判掉线");
    assert!(before, "init 前探活 false —— 该函数依赖 init，守卫实现需改");
}

/// WS7 云存档往返冒烟（SteamCloudSync.md §验证）：验证 partner 站云配额已配置生效
/// （`is_cloud_enabled_for_app`）+ `ISteamRemoteStorage` 读/写/删往返正确 + `parse_meta`。
/// 前置同上（Steam 客户端 + 拥有 4956830 的账号登录）；跑法：
///   PATH="$PWD/target/debug:$PATH" cargo test --lib steam_smoke::cloud_save_roundtrip -- --ignored --nocapture
#[test]
#[ignore = "真机冒烟：需 Steam 客户端 + 拥有 4956830 的账号 + partner 站已开云配额（WS7 云存档）"]
fn cloud_save_roundtrip() {
    use crate::steam_cloud;
    let client = steamworks::Client::init_app(APP_ID)
        .unwrap_or_else(|e| panic!("SteamAPI init_app({APP_ID}) 失败：{e}"));
    let rs = client.remote_storage();
    eprintln!("[cloud] steam 连接 OK，steam_id={}", client.user().steam_id().raw());

    // 1. 账号级云开关 = 用户真实同意闸（partner 站配额 + Steam 全局云开）。应用级 flag 在
    //    开发者云配置下不可靠（可能 false 却照样能写读），不作硬门；见 steam_cloud::cloud_available。
    let acct_on = rs.is_cloud_enabled_for_account();
    eprintln!("[cloud] is_cloud_enabled_for_app={}（开发期可能误报）· account={acct_on}", rs.is_cloud_enabled_for_app());
    assert!(
        acct_on,
        "❌ 账号级云未启用 —— Steam 客户端『设置→云』全局云被关，请在 Steam 打开。"
    );
    steam_cloud::opt_in_app_cloud(&client); // best-effort 打开应用级开关

    // 2. 写→读往返 + persisted = 真正的功能判据（应用级 flag 不可靠，往返成功才算后台配好）。
    let name = "gulugulu-cloud-smoke.json";
    let payload = br#"{"smoke":true,"version":8,"cloudRevision":42,"lastSeenAt":1234}"#;
    steam_cloud::write_file(&client, name, payload).expect("write_file 失败 —— 后台云配额未生效");
    for _ in 0..5 {
        client.run_callbacks();
        std::thread::sleep(Duration::from_millis(50));
    }
    let got = steam_cloud::read_file(&client, name).expect("read_file 应返回刚写入内容");
    assert_eq!(got, payload, "❌ 云往返内容不一致");
    assert!(rs.file(name).is_persisted(), "❌ 文件未持久化到 Steam 云（不会跨机漫游）");
    eprintln!("[cloud] ✅ 写读往返一致且已持久化到云（{} bytes）", got.len());

    // 3. parse_meta 抽冲突判定字段。
    let meta = steam_cloud::parse_meta(&got).expect("parse_meta 应成功");
    assert_eq!((meta.version, meta.revision, meta.last_seen_at), (8, 42, 1234), "parse_meta 字段错");
    eprintln!("[cloud] ✅ parse_meta v={} rev={} seen={}", meta.version, meta.revision, meta.last_seen_at);

    // 4. 列表字节数（状态展示口径）。
    let total = steam_cloud::total_bytes(&client);
    eprintln!("[cloud] 云端文件总字节={total}");
    assert!(total >= payload.len() as u64, "总字节应 ≥ 刚写入量");

    // 5. 清理：删测试文件（本地 + 远端）。
    let deleted = rs.file(name).delete();
    eprintln!("[cloud] cleanup delete {name} → {deleted}");
    assert!(!rs.file(name).exists(), "❌ 删除后文件仍存在");
    eprintln!("[cloud] ✅ WS7 云往返冒烟全绿");
}

/// 诊断探针（不硬断言）：app-cloud 为何 false —— 试 `set_cloud_enabled_for_app(true)` 后
/// 能否写读，判断后台配额是否已生效（真需发布 vs 仅 per-app 开关默认关）。
#[test]
#[ignore]
fn cloud_enable_probe() {
    use crate::steam_cloud;
    let client = steamworks::Client::init_app(APP_ID).unwrap();
    let rs = client.remote_storage();
    eprintln!(
        "[probe] 初始 app={} account={}",
        rs.is_cloud_enabled_for_app(),
        rs.is_cloud_enabled_for_account()
    );
    rs.set_cloud_enabled_for_app(true);
    for _ in 0..6 {
        client.run_callbacks();
        std::thread::sleep(Duration::from_millis(60));
    }
    eprintln!("[probe] set_cloud_enabled_for_app(true) 后 app={}", rs.is_cloud_enabled_for_app());

    let name = "gulugulu-cloud-probe.json";
    let payload = br#"{"probe":true}"#;
    match steam_cloud::write_file(&client, name, payload) {
        Ok(()) => eprintln!("[probe] write_file OK"),
        Err(e) => eprintln!("[probe] write_file ERR: {e}"),
    }
    for _ in 0..6 {
        client.run_callbacks();
        std::thread::sleep(Duration::from_millis(60));
    }
    match steam_cloud::read_file(&client, name) {
        Some(b) => eprintln!("[probe] read_file OK: {} bytes = {}", b.len(), String::from_utf8_lossy(&b)),
        None => eprintln!("[probe] read_file None（未落云/未持久化）"),
    }
    let f = client.remote_storage().file(name);
    eprintln!("[probe] exists={} persisted={} timestamp={}", f.exists(), f.is_persisted(), f.timestamp());
    eprintln!("[probe] 云端文件列表={:?}", client.remote_storage().files());
    let del = client.remote_storage().file(name).delete();
    eprintln!("[probe] cleanup delete → {del}");
}

/// WS7 清档夺权 · 云级验证（用户测试主诉求「清完档别又被云拉回」）：模拟旧存档已在云 →
/// 清档后本地（`cloud_force_push` + `rev=prev+1`）→ 连线判定必 `PushLocal`（不采纳旧云）→
/// 推清空档覆盖云 → 复读确认云端已是清空档、不回滚。用独立文件名，不碰真实存档。
#[test]
#[ignore = "真机冒烟：需 Steam 客户端 + 拥有 4956830 的账号 + 云已配额（WS7 清档夺权）"]
fn cloud_clear_save_dominance() {
    use crate::steam_cloud::{self, CloudAction, SaveMeta};
    let client = steamworks::Client::init_app(APP_ID).unwrap();
    assert!(client.remote_storage().is_cloud_enabled_for_account(), "账号级云需开");
    steam_cloud::opt_in_app_cloud(&client);

    let name = "gulugulu-save-domtest.json";
    let put = |bytes: &[u8]| {
        steam_cloud::write_file(&client, name, bytes).unwrap();
        for _ in 0..5 {
            client.run_callbacks();
            std::thread::sleep(Duration::from_millis(50));
        }
    };

    // 1. 旧存档在云：高修订号 500、coins 9999。
    put(br#"{"version":8,"cloudRevision":500,"lastSeenAt":100,"coins":9999}"#);
    let cloud_meta = steam_cloud::parse_meta(&steam_cloud::read_file(&client, name).unwrap()).unwrap();
    assert_eq!(cloud_meta.revision, 500);
    eprintln!("[dom] 云端旧档 rev={}", cloud_meta.revision);

    // 2. 清档后本地：rev=prev+1、force_push=true。即便云修订号更高，判定也必 PushLocal（夺权）。
    let local = SaveMeta { version: 8, revision: 501, last_seen_at: 50 };
    let action = steam_cloud::decide_cloud_action(local, Some(cloud_meta), true);
    assert_eq!(action, CloudAction::PushLocal, "清档夺权应 PushLocal（不采纳旧云）");
    eprintln!("[dom] decide_cloud_action(force_push) → {action:?}（不被旧云拉回）");

    // 3. 执行 PushLocal：推清空档到云（rev 501、coins 0）。
    put(br#"{"version":8,"cloudRevision":501,"lastSeenAt":50,"coins":0}"#);

    // 4. 复读云：确认是清空档，旧档已被覆盖 —— 重启不会回滚。
    let after = steam_cloud::read_file(&client, name).unwrap();
    let after_meta = steam_cloud::parse_meta(&after).unwrap();
    assert_eq!(after_meta.revision, 501, "云端应为清空档修订号");
    assert!(String::from_utf8_lossy(&after).contains("\"coins\":0"), "云端应为清空档内容");
    eprintln!("[dom] ✅ 云端已是清空档 rev={} coins=0 —— 清档夺权成立", after_meta.revision);

    let _ = client.remote_storage().file(name).delete();
    eprintln!("[dom] ✅ WS7 清档夺权云级验证全绿");
}

/// 只读：列出本账号在本 App 云端的全部文件（诊断运行中的 app 是否已推存档到云）。
#[test]
#[ignore]
fn cloud_list() {
    use crate::steam_cloud;
    let client = steamworks::Client::init_app(APP_ID).unwrap();
    let rs = client.remote_storage();
    eprintln!(
        "[list] account={} app={}",
        rs.is_cloud_enabled_for_account(),
        rs.is_cloud_enabled_for_app()
    );
    let mut files = rs.files();
    files.sort_by(|a, b| a.name.cmp(&b.name));
    for f in &files {
        let file = rs.file(&f.name);
        eprintln!(
            "[list] {} — {} bytes · persisted={} · ts={}",
            f.name,
            f.size,
            file.is_persisted(),
            file.timestamp()
        );
    }
    eprintln!("[list] 共 {} 个文件，{} bytes", files.len(), steam_cloud::total_bytes(&client));
}
