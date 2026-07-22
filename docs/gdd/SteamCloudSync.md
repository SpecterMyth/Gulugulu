# Steam 云存档同步（Steam Cloud Save Sync）

> 目标：把本地存档同步到 Steam Cloud，让同一 Steam 账号在任意机器上打开都能续上进度。
> 机制取向：**Cloud API（`ISteamRemoteStorage`）**，非 Auto-Cloud。落地 2026-07-21。

## 1. 为什么用 Cloud API 而非 Auto-Cloud

| | Cloud API（选用） | Auto-Cloud |
|---|---|---|
| 同步时机 | 运行中持续（30s 周期 + 事件） | 仅进程启动/退出 |
| 常驻托盘 App | ✅ 极少真正退出，仍能持续同步 | ❌ 几乎不触发 |
| GitHub 非 Steam 启动 | 不涉及（无 Steam 时纯本地） | ❌ 覆盖不到 |
| 冲突控制 | ✅ 自控（较新者胜 + 备份 + 清档夺权） | Steam 内置对话框，不可定制 |
| 代码量 | 一个模块 + 一个泵 pass + 一条命令 | 近零（仅 partner 站配路径） |

`steamworks 0.13` 已内置高层 `RemoteStorage`（`client.remote_storage()`），无需 `-sys` FFI。

## 2. 同步范围（三件套）

Steam Cloud 是 **per Steam account** 的扁平命名空间。同步：

| 文件 | 角色 |
|---|---|
| `gulugulu-save.json` | **权威存档**（冲突判定锚）。宠物/金币/图鉴/设施/Steam 绑定/墓碑/outbox。 |
| `gulugulu-progress.json` | Token 账本（随存档漫游）。 |
| `gulugulu-quotes.json` | AI 语录缓存（可再生，随三件套一并漫游）。 |

> **账本整份覆盖为何安全**：watcher 首见某 session 文件时把 offset 播种到 `file_len`
> （`codex_adapter.rs` 的 `.or_insert(file_len)`）——采纳外机 `progress.json` 后，本机自己的
> session 文件不在其 offset 表里 → 首见即从当前 EOF 起算，**不重算历史、不翻倍**；可移植的累计
> `total_tokens`/`experience` 正确带过来；外机残留的 offset 条目对本机惰性无害。喂养又已由存档内
> `last_seen_project_breakdown` 驱动（非 `progress.json`），故 progress 正确性不影响成长完整性。

## 3. 冲突判定：较新者胜 + 永久备份

存档新增两个**加法字段**（`#[serde(default)]`，**不 bump `version`**，旧二进制忽略未知字段 →
跨版本云同步安全，`CURRENT_SAVE_VERSION` 保持 8）：

- `cloud_revision: u64` — 每次 `with_save` 落盘 +1（`persist.rs`）。同谱系单调，判新旧主键。
- `cloud_force_push: bool` — 清档夺权标记（见 §5）。

纯判定（`steam_cloud::decide_cloud_action`，单测覆盖）：

```
local_force_push            → PushLocal   （夺权最高优先，压过更高云修订号）
cloud 缺失 / 解析失败        → PushLocal   （播种 / 修复）
cloud.rev > local.rev       → AdoptCloud  （平手比 last_seen_at；仍平留本地）
其余（本地更新 / 全相等）    → PushLocal
```

- 主键 `cloud_revision`；墙钟 `last_seen_at` 仅作平手兜底（可作弊/漂移，不作主键）。
- **云端版本超前本机**（`cloud.version > CURRENT_SAVE_VERSION`）→ 跳过同步（不降级、不覆盖，
  仿本地 `TooNew`），日志告警。
- **采纳云端前必备份**本地三件套 → `<name>.pre-cloud-<秒>.json`；数据永不真丢。

## 4. 运行时时序

```
[本地 with_save 落盘] --cloud_revision +1--> gulugulu-save.json (磁盘)
Steam 泵线程（steam.rs，串行、低频）：
  · 连接后一次性：cloud_pull_reconcile()  <--读云--  Steam Cloud
  · pump_loop 周期 30s：cloud_push_pass()  --写云-->  三件套（内容哈希判变化，未变不推）
  · 命令 CloudPush：手动同步 / 关闭前 flush / 清档夺权（拨快周期计时器）
```

- **拉（连线一次性，`!owner_mismatch`）**：读云字节 → 锁内复读本地元数据 → `decide_cloud_action`：
  - AdoptCloud：备份 → 原子写云字节到本地主档 → `*guard=None` 失效内存档（全程持锁 = 对
    `with_save` 原子）→ 锁外拉账本/语录覆盖 → emit `game://state`/`quotes://ready`。
  - PushLocal：（夺权则先清标记）→ 推三件套到云。
- **推（周期）**：读三个本地文件字节、按内容哈希判变化，变了才 `file(name).write()` 流式写云。
  **读磁盘落盘结果，绝不碰存档锁**。`owner_mismatch` 时跳过。
- **可用性**：以 `is_cloud_enabled_for_account()`（用户 Steam 全局云开关）为准才推/拉；否则纯本地
  （`SteamStatus.cloudEnabled=false`）。连线时 `set_cloud_enabled_for_app(true)` best-effort opt-in。
  **⚠️ 不硬门 `is_cloud_enabled_for_app()`**：真机实证（2026-07-21，App 4956830）——未发行 / 开发者云
  配置下它恒返 false（`SetCloudEnabledForApp(true)` 也翻不动），但配额已配、`FileWrite`/`FileRead`/
  `FilePersisted` 全成功、文件真上云；当硬门会让整套云同步在开发期静默失效（早期版本的 bug，已修）。

### 线程红线（同 steam.rs:9）

- 任何线程不得持存档锁等 channel：推路径不碰锁；拉路径锁内只读元数据 + `*guard=None`。
- 泵线程内绝不 `call_blocking`：周期 pass 直调 `steam_cloud::*`（仿 `outbox_pass` 直调 `perform`）。
- 云 per-account，采纳的云档 owner 天然 = 当前账号，不新增 `ownerMismatch`。

## 5. 清档 → 云覆盖（`debug_clear_save`，测试主诉求）

清档后本地是全新档（低修订号），默认会在下次连线被高修订号的旧云档"较新者胜"拉回 → 清档白清。
`debug_clear_save`（debug-only）显式让本地夺权：

1. 新档 `cloud_revision = prev + 1`（单调压过上次本地，单机场景也压过云端）。
2. 置 `cloud_force_push = true`（连线拉阶段 `decide_cloud_action` 据此强制 PushLocal、跳过采纳，
   多机也不被旧云覆盖）；推成功前先清标记，故云端存档永不携带 true。
3. 已连线则立即 `cloud_push_now()` 用清空档覆盖云端三件套；未连线由标记 + 抬高的修订号在下次连线兜底。

三条路径全备（连线中 kick / 下次连线 force / 修订号单调），任一生效即「清完不再被拉回」。
release 里 `cloud_force_push` 恒 false、reconcile 分支惰性。

## 6. 前端

- `SteamStatus` 新增 `cloudEnabled` / `lastCloudSyncAt` / `cloudBytes`（`types.ts` 镜像）。
- 交易市场面板连接行追加 `☁️云存档已开/已关` 轻量指示（`BackyardMarketPanel`）。
- 窗口隐藏 / 卸载前 best-effort `steam_cloud_sync_now()`（`useSteamStatus`），兜住最后 <30s。

## 7. 前置（partner 站）—— ✅ 已配置（2026-07-21 核实）

partner.steamgames.com → App Admin（4956830）→ **Cloud** 现状（核实生效）：
`ufsQuota=100000000`（100 MB）· `ufsFiles=1000` · `ufsHideInClient=☑`（「仅为开发人员启用云支持」）·
`ufsAllowSyncOnSuspend=☐`。配额早于 2026-07-18 皮肤工坊已配，Remote Storage 真机往返 + 上云已实证。
**无需再动后台**。

- **发行前须做（05-release R9）**：取消勾选 `ufsHideInClient`（仅开发者）→ 正式玩家才享云存档；
  否则玩家云同步静默失效。此为不可逆发布动作，用户本人在发布流程里点。

## 8. 关键文件

- 新建 `src-tauri/src/steam_cloud.rs`（RemoteStorage 封装 + 纯判定 + 单测）。
- `steam.rs`（`init` 拉、`pump_loop` 推、`SteamCall::CloudPush`、`SteamStatus`、`cloud_push_now`、
  `steam_cloud_sync_now`）· `game/model.rs`+`persist.rs`（字段 + 修订号自增）·
  `game/debug.rs`（清档夺权）· `codex_adapter.rs`（`replace_progress_store_bytes`）· `lib.rs`（注册）。
- 前端 `types.ts`/`bridge.ts`/`useSteamStatus.ts`/`BackyardMarketPanel.tsx`/`i18n/backyard.ts`。

## 9. 范围外 / 已知取舍

- **无向量钟**：两机同时离线分叉时"较新者胜"是启发式，可能选中修订号更高但实际进度更少的一方；
  **备份文件保证不真丢**。
- **退出前最后 <30s**：靠 `steam_cloud_sync_now`（隐藏/卸载）兜底；一旦 `FileWrite`，Steam 负责其退出时上传。
