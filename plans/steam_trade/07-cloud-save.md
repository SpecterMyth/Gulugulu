# WS7 · Steam 云存档同步

> 目标：本地三件套（存档 + Token 账本 + 语录）同步到 Steam Cloud，同账号跨机续进度。
> 设计详见 [../../docs/gdd/SteamCloudSync.md](../../docs/gdd/SteamCloudSync.md)；决策见 [00-decisions.md](00-decisions.md)「云存档定案」。
> 机制：**Cloud API（`ISteamRemoteStorage`）**，较新者胜 + 备份 + 清档夺权。

## 状态

**代码完成 + 真机验证通过（2026-07-21）**。后台云配额早已配好（皮肤工坊留存，无需再动）；
4 条真机冒烟全绿；运行中的 app 已把三件套推上云（persisted）。剩：发行前取消「仅开发者云」勾选（05-release R9，👤）。

## 任务

### A. 后端（✅ 代码完成 2026-07-21，cargo test 167 绿）

- [x] 存档加 `cloud_revision`/`cloud_force_push`（加法字段，不 bump v8）；`with_save` 每次落盘 +1。（model.rs/persist.rs）
- [x] 新模块 `steam_cloud.rs`：`cloud_available`/`read_file`/`write_file`/`total_bytes` + 纯判定 `decide_cloud_action`/`parse_meta` + 8 单测。
- [x] `codex_adapter::replace_progress_store_bytes`（持 `lock_progress` 原子换账本）。
- [x] `steam.rs`：`SteamCall::CloudPush` + 泵循环特判；`cloud_pull_reconcile`（init 连线一次性拉）；`cloud_push_pass`（pump_loop 30s 周期推，哈希判变化）；`SteamStatus` 加 `cloudEnabled`/`lastCloudSyncAt`/`cloudBytes`；`cloud_push_now` kick + `steam_cloud_sync_now` 命令。
- [x] `debug_clear_save` 夺权：`cloud_revision=prev+1` + `cloud_force_push=true` + 连线即 `cloud_push_now`。
- [x] `lib.rs` 注册 `mod steam_cloud` + `steam_cloud_sync_now`。

### B. 前端（✅ 代码完成 2026-07-21，npm build 绿）

- [x] `types.ts` 镜像 `SteamStatus` 云字段 + `GameSave.cloudRevision/cloudForcePush`。
- [x] `bridge.ts` `steamCloudSyncNow()`（接口 + Tauri + Mock 三处）。
- [x] `useSteamStatus` 窗口隐藏/卸载 best-effort flush。
- [x] 市场面板连接行 `☁️云存档已开/已关` 指示（`BackyardMarketPanel` + `i18n/backyard` 双语）。

### C. partner 站前置（✅ 已配置 2026-07-21）

- [x] App Admin（4956830）→ Cloud 核实生效：`ufsQuota=100000000`（100MB）/`ufsFiles=1000`/`ufsHideInClient=☑`（仅开发者云）。皮肤工坊留存，**无需再动**。(2026-07-21，浏览器核实 + 真机往返实证)
- [ ] **发行前**取消勾选 `ufsHideInClient`（仅开发者）→ 正式玩家才享云（05-release R9，👤 发布流程内）。

### D. 真机验收（✅ 冒烟全绿 2026-07-21）

- [x] `steam_cloud_roundtrip`：账号级云开 + `write→read` 往返一致 + `is_persisted` = 真上云（63B），`parse_meta` 正确。(2026-07-21 绿)
- [x] `cloud_enable_probe`（诊断）：实证 `is_cloud_enabled_for_app=false` 但写读/persist 全成功 → **定位并修复 `cloud_available` 过严 bug**（改账号级 gate + `opt_in_app_cloud`）。(2026-07-21)
- [x] `cloud_clear_save_dominance`（**测试主诉求**）：旧档 rev500 在云 → 清档本地 rev501+force_push → 判定 `PushLocal`（不采纳旧云）→ 云被清空档覆盖、复读确认不回滚。(2026-07-21 绿)
- [x] `cloud_list`（只读）：运行中的 app 已把 `gulugulu-save/progress/quotes.json` 全推上云、`persisted=true`（278805B）。= **真机 app 端到端推送已实证**。(2026-07-21)
- [ ] 可选补充：两实例采纳 + `.pre-cloud-*` 备份（需第二台机 / 第二存档目录）；GUI 内点 `debug_clear_save` 走一遍（逻辑已由 dominance 冒烟覆盖）。

跑法：`PATH="$PWD/target/debug:$PATH" cargo test --lib steam_smoke::cloud_ -- --ignored --nocapture`。

## 验证门（每次合入）

`npm run build`（gulugulu-app）+ `cargo build && cargo test`（src-tauri）。已全绿（cargo 167 / npm build ✓）。
