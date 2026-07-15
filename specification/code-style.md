# 代码规范（Code Style）

面向 Gulugulu 桌宠应用（Tauri 2 + React 19 + TypeScript / Rust）。目标是**可读、可改、职责清晰**，而不是追求形式。约定优先于强制——与既有代码风格保持一致永远第一优先。

## 通用原则

- **一致性 > 个人偏好。** 新代码读起来要像周围的代码：命名、缩进、注释密度、惯用法都对齐。
- **单一职责。** 一个文件 / 函数只做一件事。超过 ~500 行的文件视为"需要拆分"的信号，而非目标。
- **不留死代码。** 删掉就好，别注释掉;版本历史在 git 里。
- **注释解释"为什么",不解释"是什么"。** 代码本身说明做了什么;注释留给不显然的取舍、边界条件、历史原因。
- **无 lint / formatter**(现状),前端也**无** test。门禁:前端 `npm run build`(= `tsc && vite build`);后端 `cargo build` + `cargo test`(纯游戏逻辑、CLI 输出校验、融合调度都有单测)。提交前必须全绿。

## 文件规模上限（软性参考）

| 类型 | 建议上限 | 超出时 |
|---|---|---|
| React 组件 / hook | ~400 行 | 抽子组件或 hook |
| Rust 模块 | ~800 行 | 按关注点拆子模块 |
| CSS | ~800 行 | 按功能区拆文件 |

单个自包含的 SVG 物种 rig（`sprites/species2/**`）属于"数据即代码",不受此限。

## TypeScript / React

- **组件**用 `PascalCase`,**hook**用 `useXxx`,**变量/函数**用 `camelCase`,**常量表**用 `SCREAMING_SNAKE` 或具名对象。
- **优先函数组件 + hooks**;避免把无关状态塞进同一组件。巨型组件按关注点抽自定义 hook / 子组件——参考 `App.tsx`(状态机进 `app/hooks/usePetStateMachine.ts`、纯助手进 `app/`)与 `game/BackyardScene.tsx`(布景/面板/运动循环各成文件)的拆法。抽 hook 时:跨关注点共享的 ref/回调**作为参数显式传入**(不各持副本);移动 effect 时**保持调用顺序与依赖数组一字不差**——本项目无前端测试,行为回归全靠这条纪律兜底。
- **状态机 / 事件映射走表驱动**(见 `petEvents.ts`),不要散在 `if/else` 里。
- **副作用集中在 `useEffect`**,并写清依赖数组;清理函数不能漏。
- 类型定义集中在 `types.ts`,与 Rust 结构体一一对应。
- 只从 `data:` / self 加载图片(CSP 限制),不引入外部资源。

## Rust（src-tauri）

- **IPC 命令**用 `#[tauri::command]`,函数名 `snake_case`;跨模块复用的项显式标 `pub(crate)`。
- **serde 结构体**统一 `#[serde(rename_all = "camelCase")]`,与 `types.ts` 对齐。
- **后台工作放独立线程 / worker**,不阻塞 UI 线程;共享状态用 `SharedState` 封装。
- **纯逻辑与 IPC/持久化分离**:可测的规则写成纯函数(`&GameConfig` + `&mut GameSave`,不碰锁),IPC 命令与落盘在外层薄封装——见 `game/logic/*` 与 `game/persist.rs` 的 `with_save`(所有可变状态经它这一把锁)。这样纯逻辑能直接 `cargo test`。
- **Windows CLI 调用**复用 `cli_spawn.rs` 的 spawn 工具集(`where`/`which` 解析、`.cmd` 包装、`CREATE_NO_WINDOW`、`taskkill /T`),不要各写一套。

## 跨语言契约（最重要的一条）

**Rust ↔ TS 类型必须成对修改。** 改了 Rust serde 结构体,就同步改 `types.ts`,反之亦然。字段命名以 `camelCase` 为准。

## 新增一个宠物动画（SVG-only 流程）

1. 在 `types.ts` 加 `PetState`;
2. 在 `petEvents.ts` 的 `stateForPetEvent` 映射事件;
3. 在 `sprites/sprites.css` 加 `.svg-sprite-state-<state>` 规则(循环 vs 一次性 = CSS `animation-iteration-count`);
4. 一次性动画在 `transientStateDurationMs` / `svgStateDurationMs` 补时长。

## 提交约定

- 提交前跑通 `npm run build` 与 `cargo test`(后者含 `cargo build`)。
- commit message 说清"改了什么、为什么",一次提交聚焦一件事。
- 生成产物(`node_modules` / `dist` / `src-tauri/target`)不入库。
