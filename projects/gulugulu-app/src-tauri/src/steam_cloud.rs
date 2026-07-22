//! Steam 云存档（ISteamRemoteStorage）读写封装 + 冲突纯判定（SteamCloudSync.md）。
//!
//! 机制：Cloud API（非 Auto-Cloud）——常驻托盘 App 极少真正退出，只在退出同步的
//! Auto-Cloud 几乎不触发。`steamworks 0.13` 已内置高层 `RemoteStorage`，无需 `-sys`。
//!
//! - 所有 IO 函数（`cloud_available`/`read_file`/`write_file`/`list`）**只在泵线程内、
//!   持 `&steamworks::Client` 调用**（`client.remote_storage()` 现取）。死锁红线同
//!   `steam.rs`：这些函数不碰存档锁、不走 channel。
//! - `decide_cloud_action` / `parse_meta` 为**纯逻辑**（无 Steam/Tauri 类型），单测覆盖。

use std::io::{Read, Write};
use steamworks::Client;

// ---------------------------------------------------------------------------
// 云文件命名（Steam Cloud 扁平命名空间，per Steam account）
// ---------------------------------------------------------------------------

/// 权威游戏存档。冲突判定的锚（携带 `cloudRevision` / `lastSeenAt` / `version`）。
pub const SAVE_FILE: &str = "gulugulu-save.json";
/// Token 账本（随存档漫游；整份覆盖安全性见 SteamCloudSync.md）。
pub const PROGRESS_FILE: &str = "gulugulu-progress.json";
/// AI 语录缓存（可再生，随三件套一并漫游）。
pub const QUOTES_FILE: &str = "gulugulu-quotes.json";

/// 同步三件套；顺序 = 推送顺序（存档权威在先）。
pub const SYNCED_FILES: [&str; 3] = [SAVE_FILE, PROGRESS_FILE, QUOTES_FILE];

// ---------------------------------------------------------------------------
// RemoteStorage IO（仅泵线程调用）
// ---------------------------------------------------------------------------

/// 云是否可用：以**账号级** Steam 云开关（Steam 设置→云「启用 Steam 云同步」）为准——
/// 这是用户的真实同意闸。**不**硬门应用级 `IsCloudEnabledForApp`：它在未发行 / 开发者云
/// 配置下会误报 false（真机实证：配额已配、`FileWrite`/`FileRead`/`FilePersisted` 全成功
/// 却返 false，且 `SetCloudEnabledForApp(true)` 也翻不动它），当硬门会让整套云同步在开发期
/// 静默失效。应用级由连线路径 `set_cloud_enabled_for_app(true)` best-effort opt-in（幂等）。
/// SteamCloudSync.md。
pub fn cloud_available(client: &Client) -> bool {
    client.remote_storage().is_cloud_enabled_for_account()
}

/// 应用级云 opt-in（幂等 best-effort）：某些开发者云配置下 `IsCloudEnabledForApp` 默认 false，
/// 显式打开以鼓励本 App 云文件随账号级开关上传/下载同步。连线时调一次即可。
pub fn opt_in_app_cloud(client: &Client) {
    client.remote_storage().set_cloud_enabled_for_app(true);
}

/// 读云文件全量字节。文件不存在 / 空 / 读失败 → `None`（reconcile 当作「云无此档」）。
pub fn read_file(client: &Client, name: &str) -> Option<Vec<u8>> {
    let rs = client.remote_storage();
    let handle = rs.file(name);
    if !handle.exists() {
        return None;
    }
    let mut buf = Vec::new();
    match handle.read().read_to_end(&mut buf) {
        Ok(_) if !buf.is_empty() => Some(buf),
        Ok(_) => None, // 空文件视为无
        Err(error) => {
            eprintln!("[steam_cloud] read {name} failed: {error}");
            None
        }
    }
}

/// 写云文件。`SteamFileWriter`（`impl io::Write`）在 Drop 时 `FileWriteStreamClose`
/// 提交到 Steam 本地云目录，Steam 后台 / 退出时异步上传。`write_all` 以整块单 chunk
/// 落，成功即完整、失败（超配额等）即 `Err`（无半截提交）。
pub fn write_file(client: &Client, name: &str, bytes: &[u8]) -> Result<(), String> {
    let rs = client.remote_storage();
    let mut writer = rs.file(name).write();
    writer
        .write_all(bytes)
        .map_err(|error| format!("write {name}: {error}"))?;
    drop(writer); // 显式关流提交（点明意图；作用域结束亦会 Drop）。
    Ok(())
}

/// 云文件总字节数（状态展示用）。
pub fn total_bytes(client: &Client) -> u64 {
    client.remote_storage().files().iter().map(|f| f.size).sum()
}

// ---------------------------------------------------------------------------
// 冲突纯判定（无 Steam/Tauri 依赖，单测主战场）
// ---------------------------------------------------------------------------

/// 存档冲突判定元数据（从存档字节抽出的最小集）。
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SaveMeta {
    /// schema 版本；云端高于本机支持版本时 reconcile 跳过（不降级、不覆盖，仿本地 TooNew）。
    pub version: u32,
    /// 单调修订号（`cloud_revision`）：同谱系比大小判新旧。
    pub revision: u64,
    /// 墙钟兜底（`last_seen_at`）：修订号相等时比最近活跃，仍平则保守留本地。
    pub last_seen_at: i64,
}

/// 连线时的同步方向。
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CloudAction {
    /// 采纳云端（云更新）：备份本地后用云覆盖本地。
    AdoptCloud,
    /// 推送本地（本地更新 / 相等 / 云缺失 / 云损坏 / 清档夺权）：用本地覆盖云。
    PushLocal,
}

/// 决定同步方向。**纯函数**（云可用性、版本超前由调用方先行处理）。
/// - `local_force_push`（清档夺权）最高优先 → 一律 `PushLocal`（压过更高云修订号）。
/// - `cloud=None`（云缺失 / 损坏）→ `PushLocal`（播种 / 修复）。
/// - 云修订号 > 本地 → `AdoptCloud`；相等且云 `last_seen_at` 更新 → `AdoptCloud`。
/// - 其余（本地更新 / 全相等）→ `PushLocal`（保守留本地）。
pub fn decide_cloud_action(
    local: SaveMeta,
    cloud: Option<SaveMeta>,
    local_force_push: bool,
) -> CloudAction {
    if local_force_push {
        return CloudAction::PushLocal;
    }
    match cloud {
        None => CloudAction::PushLocal,
        Some(cloud) => {
            let cloud_newer = cloud.revision > local.revision
                || (cloud.revision == local.revision && cloud.last_seen_at > local.last_seen_at);
            if cloud_newer {
                CloudAction::AdoptCloud
            } else {
                CloudAction::PushLocal
            }
        }
    }
}

/// 从存档字节抽取冲突元数据。只挑三个字段、忽略其余，**与存档版本解耦**（云端来自
/// 更高版本时也能读出 version 做超前判定）。解析失败（损坏 / 非 JSON）→ `None`。
pub fn parse_meta(bytes: &[u8]) -> Option<SaveMeta> {
    #[derive(serde::Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Probe {
        #[serde(default)]
        version: u32,
        #[serde(default)]
        cloud_revision: u64,
        #[serde(default)]
        last_seen_at: i64,
    }
    let probe: Probe = serde_json::from_slice(bytes).ok()?;
    Some(SaveMeta {
        version: probe.version,
        revision: probe.cloud_revision,
        last_seen_at: probe.last_seen_at,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn meta(rev: u64, seen: i64) -> SaveMeta {
        SaveMeta { version: 8, revision: rev, last_seen_at: seen }
    }

    #[test]
    fn force_push_beats_higher_cloud_revision() {
        // 清档夺权：即便云修订号高得多也推本地，杜绝「清完档又被云拉回」。
        assert_eq!(
            decide_cloud_action(meta(1, 0), Some(meta(999, 999)), true),
            CloudAction::PushLocal
        );
    }

    #[test]
    fn cloud_absent_pushes_local() {
        assert_eq!(decide_cloud_action(meta(5, 100), None, false), CloudAction::PushLocal);
    }

    #[test]
    fn newer_cloud_is_adopted() {
        assert_eq!(
            decide_cloud_action(meta(5, 100), Some(meta(6, 50)), false),
            CloudAction::AdoptCloud
        );
    }

    #[test]
    fn newer_local_is_pushed() {
        assert_eq!(
            decide_cloud_action(meta(7, 100), Some(meta(6, 200)), false),
            CloudAction::PushLocal
        );
    }

    #[test]
    fn equal_revision_breaks_tie_on_last_seen() {
        // 修订相等：云更近 → 采纳；本地更近或全等 → 留本地。
        assert_eq!(
            decide_cloud_action(meta(6, 100), Some(meta(6, 200)), false),
            CloudAction::AdoptCloud
        );
        assert_eq!(
            decide_cloud_action(meta(6, 200), Some(meta(6, 100)), false),
            CloudAction::PushLocal
        );
        assert_eq!(
            decide_cloud_action(meta(6, 100), Some(meta(6, 100)), false),
            CloudAction::PushLocal
        );
    }

    #[test]
    fn parse_meta_plucks_fields_from_full_save() {
        let bytes = br#"{"version":8,"coins":9,"cloudRevision":42,"lastSeenAt":1234}"#;
        assert_eq!(
            parse_meta(bytes),
            Some(SaveMeta { version: 8, revision: 42, last_seen_at: 1234 })
        );
    }

    #[test]
    fn parse_meta_missing_cloud_fields_default_zero() {
        let bytes = br#"{"version":8,"coins":9}"#;
        assert_eq!(
            parse_meta(bytes),
            Some(SaveMeta { version: 8, revision: 0, last_seen_at: 0 })
        );
    }

    #[test]
    fn parse_meta_garbage_is_none() {
        assert_eq!(parse_meta(b"not json at all"), None);
    }
}
