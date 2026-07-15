//! Steam 创意工坊（ISteamUGC）—— AI 融合变种形象/名字的全局 UGC 载体。
//!
//! 机制（00-decisions.md「用户拍板(2026-07-14) · Feature 2」+ FusionRecipeSlots.md）：
//! 每个 AI 变种槽有全局确定性 `petId`（= `fusion_slots::slot_codename`）。首个生成该
//! 槽位的玩家把 `CustomSpeciesEntry`（紧凑参数化 JSON，几 KB）作为一条创意工坊物品
//! 上传（tag `petId`）——**最早发布者胜 = 抢占资源位**；其余玩家按 `petId` 查询、取
//! 最早创建者、下载复用，形象因此全局一致且跨交易保留。
//!
//! 走高层 `Client::ugc()`（无需 FFI）；回调经 `run_callbacks()` 驱动。**只在 steam.rs
//! 泵线程内串行调用**（与库存同一线程 → 无并发 run_callbacks）。集成开关关闭时整条
//! 路径不触达（调用点在 steam.rs 已 gate）。
//!
//! 纯逻辑（`pick_earliest` / 内容目录读写）抽出并单测；真机 UGC 调用（create/submit/
//! query/download）无法在 CI（无 Steam 客户端）验证，归 WS4/阶段 4 真机联调。

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::time::{Duration, Instant};
use steamworks::{AppIDs, AppId, Client, FileType, PublishedFileId, UGCQueryType, UGCType};

/// 单步 UGC 调用（create/submit/query/download）的回调等待上限。
const UGC_TIMEOUT: Duration = Duration::from_secs(30);
/// 创意工坊 KV 标签键：AI 变种槽全局身份（= slot_codename）。
const PET_ID_TAG: &str = "petId";
/// 内容 schema 版本标签（未来变更 CustomSpeciesEntry 结构时用于兼容判定）。
const SCHEMA_TAG: &str = "gulupetSchema";
const SCHEMA_VERSION: &str = "1";
/// 上传/下载内容目录里的定名文件。
const CONTENT_FILENAME: &str = "species.gulupet.json";

/// 从一批 (time_created, published_file_id) 里取**最早发布**者：`time_created` 最小，
/// 并列时 `published_file_id` 小者胜（收敛、与发布顺序一致）。纯函数，便于单测。
pub fn pick_earliest(candidates: &[(u32, u64)]) -> Option<u64> {
    candidates
        .iter()
        .copied()
        .min_by_key(|(time_created, id)| (*time_created, *id))
        .map(|(_, id)| id)
}

/// 内容暂存目录：`<temp>/gulugulu-ugc/<codename>`。写入 `species.gulupet.json`，
/// 返回**已存在且可 canonicalize** 的目录（`SetItemContent` 内部会 canonicalize，
/// 先自证一遍避免其 unwrap panic 掀翻泵线程）。
fn write_content_dir(codename: &str, entry_json: &str) -> Result<PathBuf, String> {
    let dir = std::env::temp_dir().join("gulugulu-ugc").join(codename);
    fs::create_dir_all(&dir).map_err(|e| format!("建内容目录失败：{e}"))?;
    fs::write(dir.join(CONTENT_FILENAME), entry_json).map_err(|e| format!("写内容文件失败：{e}"))?;
    dir.canonicalize().map_err(|e| format!("内容目录 canonicalize 失败：{e}"))
}

/// 从下载好的安装目录读回 `CustomSpeciesEntry` JSON。先取定名文件，退而求其次扫描
/// 任一 `*.json`（容错不同上传者的文件名）。
fn read_content_dir(folder: &str) -> Result<String, String> {
    let named = Path::new(folder).join(CONTENT_FILENAME);
    if named.is_file() {
        return fs::read_to_string(&named).map_err(|e| format!("读内容文件失败：{e}"));
    }
    let entries = fs::read_dir(folder).map_err(|e| format!("读安装目录失败：{e}"))?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            return fs::read_to_string(&path).map_err(|e| format!("读内容文件失败：{e}"));
        }
    }
    Err(format!("安装目录 {folder} 内未找到 JSON 内容"))
}

/// 泵 `run_callbacks()` 直到回调把结果送进 channel 或超时。**必须在持有 client 的
/// 泵线程调用**（与 inv::wait_result 同构）。
fn pump_until<T>(client: &Client, rx: &mpsc::Receiver<T>, timeout: Duration) -> Option<T> {
    let start = Instant::now();
    loop {
        client.run_callbacks();
        match rx.try_recv() {
            Ok(value) => return Some(value),
            Err(mpsc::TryRecvError::Empty) => {}
            Err(mpsc::TryRecvError::Disconnected) => return None,
        }
        if start.elapsed() > timeout {
            return None;
        }
        std::thread::sleep(Duration::from_millis(50));
    }
}

/// 发布（或抢占）某槽位的 AI 变种形象：CreateItem → StartItemUpdate（title +
/// content + `petId` tag）→ SubmitItemUpdate。成功返回 publishedFileId。
///
/// 「首个上传者胜」是收敛而非原子锁：并发首发可能产生多条同 `petId`，查询侧按最早
/// 创建者收敛（见 `resolve`），多余副本无害。
pub fn publish(
    client: &Client,
    app_id: u32,
    codename: &str,
    name_zh: &str,
    entry_json: &str,
) -> Result<u64, String> {
    let dir = write_content_dir(codename, entry_json)?;

    // 1) CreateItem
    let (tx, rx) = mpsc::channel();
    client.ugc().create_item(AppId(app_id), FileType::Community, move |res| {
        let _ = tx.send(res);
    });
    let (published_id, needs_legal) = match pump_until(client, &rx, UGC_TIMEOUT) {
        Some(Ok(v)) => v,
        Some(Err(e)) => return Err(format!("CreateItem 失败：{e:?}")),
        None => return Err("CreateItem 超时".to_string()),
    };

    // 2) StartItemUpdate + 元数据 + 内容 + petId 标签 → SubmitItemUpdate
    let update = client
        .ugc()
        .start_item_update(AppId(app_id), published_id)
        .title(name_zh)
        .content_path(&dir)
        .add_key_value_tag(PET_ID_TAG, codename)
        .add_key_value_tag(SCHEMA_TAG, SCHEMA_VERSION);
    let (tx2, rx2) = mpsc::channel();
    update.submit(Some("gulugulu ai species"), move |res| {
        let _ = tx2.send(res);
    });
    match pump_until(client, &rx2, UGC_TIMEOUT) {
        Some(Ok((id, _legal))) => Ok(id.0),
        Some(Err(e)) => {
            if needs_legal {
                Err(format!("SubmitItemUpdate 失败（需先在 Steam 接受创意工坊法律协议）：{e:?}"))
            } else {
                Err(format!("SubmitItemUpdate 失败：{e:?}"))
            }
        }
        None => Err("SubmitItemUpdate 超时".to_string()),
    }
}

/// 查询某 `petId` 的全局形象：CreateQueryAll + RequiredKeyValueTag(petId) → 取最早
/// 创建者 → DownloadItem → 读安装目录内容。无人认领返回 `Ok(None)`。
pub fn resolve(client: &Client, app_id: u32, codename: &str) -> Result<Option<String>, String> {
    // 1) 建查询（按发布日期，附 petId 必需标签），fetch 回调里挑最早创建者。
    let query = client
        .ugc()
        .query_all(
            UGCQueryType::RankedByPublicationDate,
            UGCType::Items,
            AppIDs::Both { creator: AppId(app_id), consumer: AppId(app_id) },
            1,
        )
        .map_err(|_| "CreateQueryAll 失败".to_string())?
        .set_return_key_value_tags(true)
        .add_required_key_value_tag(PET_ID_TAG, codename);

    let (tx, rx) = mpsc::channel();
    query.fetch(move |res| {
        let picked = res.map(|results| {
            let mut candidates: Vec<(u32, u64)> = Vec::new();
            for i in 0..results.returned_results() {
                if let Some(r) = results.get(i) {
                    candidates.push((r.time_created, r.published_file_id.0));
                }
            }
            pick_earliest(&candidates)
        });
        let _ = tx.send(picked);
    });
    let file_id = match pump_until(client, &rx, UGC_TIMEOUT) {
        Some(Ok(Some(id))) => id,
        Some(Ok(None)) => return Ok(None), // 无人认领
        Some(Err(e)) => return Err(format!("查询失败：{e:?}")),
        None => return Err("查询超时".to_string()),
    };

    // 2) 下载并等待安装到本地，读回内容。
    let pfid = PublishedFileId(file_id);
    if !client.ugc().download_item(pfid, true) {
        return Err("DownloadItem 未启动（物品无效或未订阅工坊）".to_string());
    }
    let folder = match wait_installed(client, pfid, UGC_TIMEOUT) {
        Some(folder) => folder,
        None => return Err("下载超时".to_string()),
    };
    read_content_dir(&folder).map(Some)
}

/// 轮询 `item_install_info`（返回 Some 即已安装到磁盘），泵 run_callbacks 推进下载。
fn wait_installed(client: &Client, item: PublishedFileId, timeout: Duration) -> Option<String> {
    let start = Instant::now();
    loop {
        client.run_callbacks();
        if let Some(info) = client.ugc().item_install_info(item) {
            if !info.folder.is_empty() {
                return Some(info.folder);
            }
        }
        if start.elapsed() > timeout {
            return None;
        }
        std::thread::sleep(Duration::from_millis(100));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pick_earliest_by_time_then_id() {
        // 单个。
        assert_eq!(pick_earliest(&[(100, 9)]), Some(9));
        // 时间更早者胜（与 id 无关）。
        assert_eq!(pick_earliest(&[(200, 1), (100, 9), (150, 2)]), Some(9));
        // 时间并列 → id 小者胜。
        assert_eq!(pick_earliest(&[(100, 8), (100, 3), (100, 5)]), Some(3));
        // 空 → None（= 无人认领）。
        assert_eq!(pick_earliest(&[]), None);
    }

    #[test]
    fn content_dir_write_then_read_roundtrips() {
        let codename = "aif9901"; // 测试专用；不与真实序号冲突（序号≤56）。
        let json = r#"{"info":{"nameZh":"测试"},"parents":["a","b"]}"#;
        let dir = write_content_dir(codename, json).expect("write");
        assert!(dir.join(CONTENT_FILENAME).is_file());
        let read = read_content_dir(dir.to_str().unwrap()).expect("read");
        assert_eq!(read, json);
        let _ = fs::remove_dir_all(dir); // 清理
    }

    #[test]
    fn read_content_dir_falls_back_to_any_json() {
        let dir = std::env::temp_dir().join("gulugulu-ugc-test-fallback");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("whatever.json"), "{\"k\":1}").unwrap();
        let read = read_content_dir(dir.to_str().unwrap()).expect("read fallback");
        assert_eq!(read, "{\"k\":1}");
        let _ = fs::remove_dir_all(&dir);
    }
}
