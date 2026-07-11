# Gulugulu 核心玩法 MVP 实现计划

> 依据：`docs/gdd/CoreGameplay.md`（GDD v1.0）
> 进度追踪：`plans/coregameplay-mvp-progress.md`（**恢复工作时先读它**，从第一个未完成项继续）
> 日期：2026-07-07

## 恢复指南（中断后如何继续）

1. 读本文件了解架构决策，再读 progress 文件看当前进度与"下一步"备注。
2. 每完成一个里程碑，必须更新 progress 文件（勾选 + 备注遇到的坑）。
3. 验证门禁：前端 `cd projects/gulugulu-app && npm run build`；后端 `cd projects/gulugulu-app/src-tauri && cargo build && cargo test`。
4. 浏览器视觉验证：`npm run dev`（Vite :1420，preview 模式走 Mock 引擎），URL 加 `?test=1` 启用小数值测试配置。

## 架构决策（与 GDD 的差异都记录在此）

### 配置单一来源
- `projects/gulugulu-app/src/game/config.json` — 正式数值（GDD §9）。
- `projects/gulugulu-app/src/game/config.test.json` — 小数值测试配置（孵化秒级、便宜蛋、低上限，方便手工/自动测试）。
- Rust 侧 `game_config.rs` 用 `include_str!` 同时编译进两份，运行时按环境变量 `GULUGULU_TEST_CONFIG=1` 选择；TS 侧直接 import 两份 JSON，浏览器按 URL `?test=1` 选择。
- 物种表（6 基础 + 21 融合）与融合表都在 config.json 里（名字、属性、颜色、体型基底）。

### 与 GDD 的实现偏差
- **preview 模式升级为"全流程可玩"**：GDD §13 第7条只要求界面可打开，但本次用户要求"模拟玩家视觉验证所有分支"，桌面透明窗无法被工具截屏，因此 TS 侧实现一份与 Rust 规则对齐的 `mockEngine.ts`（数值全部来自共享 config.json，规则逻辑双实现，Rust 为权威）。Mock 存档在 localStorage。
- **新增第 13 个 IPC 命令 `wander_pickup`**：漫游捡币由前端漫游结束时触发，GDD 漏了对应命令。
- 每日计数用 chrono 本地日期（新增 chrono 依赖）。

### Rust 侧（src-tauri/src/）
- 新文件 `game_config.rs`：`GameConfig` 结构（serde camelCase），include_str 加载。
- 新文件 `game.rs`：`GameSave`/`PetInstance`/`EggInstance`/`DailyCounters`（camelCase 序列化），`SharedGameState(Arc<Mutex<...>>)` 常驻内存，每个写命令成功后整写 `<app_data>/gulugulu-save.json`。含单元测试。
  - 惰性结算：精力按 `staminaUpdatedAt`；孵化按 `hatchAt`；每日计数按本地日期翻转。
  - 首建迁移：读一次 gulugulu-progress.json 全项目 experience 求和 → `min(总和,200)` 金币；送教学蛋入槽。
  - exhausted 存 `exhausted: bool`，结算时 stamina==0 置真、≥wakeThreshold 置假。
- `lib.rs`：注册 13 个命令 + `.manage(SharedGameState)` + 60s tick 线程（挂机经验/产金，emit `game://state`）+ `resize_game_window`（set_size + 宽度变化时 set_position x −= Δw/2 保持水平居中）。
- `codex_adapter.rs`：`apply_agent_token_event` 之后按 `project.experience − lastSeenProjectExperience[project]` 差值调 `game::feed_from_tokens`，事件负载新增 `pet_exp_delta` 字段。
- IPC 命令：get_game_state / get_game_config / click_work(petId)→ClickWorkResult / buy_egg(element) / place_egg(eggId,slot) / collect_hatched(eggId) / fuse_pets(idA,idB) / upgrade_hatchery / upgrade_yard / release_pet(petId) / set_active_pet(petId) / resize_game_window(w,h) / wander_pickup。
  - 写命令返回完整 GameSave（click_work 返回 `ClickWorkResult{save, coinsGained, expGained, leveledUp, becameExhausted}` 供飘字）。

### TS 侧（src/）
- `types.ts` 增补：GameSave 系列镜像、`PetState` 加 `laboring`/`exhausted`、GameConfig 类型。
- `petEvents.ts`：`stateAnimationMap` 加 laboring→pet_head、exhausted→sleep；`transientStateDurationMs.laboring=800`；新增 `user_work_click`/`pet_exhausted` 事件映射。
- `src/game/bridge.ts`：`GameBridge` 接口，Tauri 实现（invoke）+ Mock 实现自动切换。
- `src/game/mockEngine.ts`：全规则 TS 实现（preview 模式），localStorage 持久化，内置 tick。
- `src/game/` UI 组件：`MenuBar.tsx`（菜单条+精力/金币 HUD）、`HatcheryPanel.tsx`、`YardPanel.tsx`、`ShopPanel.tsx`、`FusionPanel.tsx`、`GamePanels.tsx`（状态页并入）。
- `src/sprites/SvgSprite.tsx`：按 species+petState 渲染；6 基础物种手绘参数化 SVG + 蛋模板 + 21 融合体程序化（基底体型放大1.15+双色渐变+双徽记）；CSS 动效（浮动/眨眼/弹跳/睡觉灰度）；非循环状态用 setTimeout 模拟 onComplete。
- `App.tsx` 集成：`uiMode` 7 态；点击消歧（pet 态点宠物=摸头+弹菜单，menu 态点宠物=打工）；Esc/空白返回；窗口尺寸表驱动 `resize_game_window`（右键菜单 resize 一并迁移）；exhausted 排除 transient 超时与 SLEEP_TIMEOUT 两个 effect；移除 avatar-gen 网页入口按钮。
- 主宠渲染：guluduck 走现有 AnimationPlayer（PNG），其余物种走 SvgSprite（同一套 pointer 手柄）。
- 窗口尺寸表（逻辑px）：pet 260×320 / menu 260×396 / hatchery 300×440 / yard 340×500 / shop 320×470 / fusion 340×440 / status 260×420。面板内部可滚动。

### 特效清单（P7）
金币金色飘字 + Exp 绿色飘字 + Lv UP 闪光（复用 .exp-pop-layer 扩展）；打工挤压弹跳；睡觉 Zzz + 灰度；孵化蛋摇晃 + 完成发光抖动 + 裂壳收取；买蛋飞行动画；融合双槽电弧连线 + 螺旋汇聚白闪；菜单滑出、面板切换过渡、窗口尺寸 120ms 过渡；软上限灰色飘字；四步新手引导气泡。

## 阶段划分

| 阶段 | 内容 | 验证 |
|---|---|---|
| P0 | 计划/进度文件 | 文件存在 |
| P1 | 共享配置（config.json ×2 + game_config.rs + TS 类型） | cargo build |
| P2 | Rust 游戏核心 game.rs + 单元测试 | cargo test |
| P3 | Rust 集成（lib.rs、tick、codex_adapter 钩子、resize） | cargo build + test |
| P4 | TS bridge + mockEngine | npm run build |
| P5 | SVG 精灵（27 物种 + 蛋） | npm run build + 预览目视 |
| P6 | UI 面板 + App 集成（uiMode/消歧/窗口尺寸） | npm run build |
| P7 | 特效/过渡/引导打磨 | npm run build |
| P8 | 双侧构建门禁全绿 | 两个 build + cargo test |
| P9 | 浏览器预览视觉验证（?test=1 小数值，走全部分支：打工/升级/睡眠/买蛋/孵化/收取/放生/满员/融合/无槽/升级设施/软上限/Token 喂养/最后一只保护） | 截图逐项核对 |
| P10 | 玩家视角可玩性评估与优化；确认正式配置回归 | 评估报告写入 progress |

## 风险与备注
- 沙盒可能阻塞固定端口监听（见 memory）：preview_start 工具是指定路径；若失败改用后台 PowerShell 起 dev server。
- `resizable:false` 下 Rust set_size 需实测（P3 完成后若有真机会话验证；浏览器无法验证该项，记入 progress 遗留项）。
- App.tsx 较大，集成时小步编辑 + 频繁 `npm run build`。
