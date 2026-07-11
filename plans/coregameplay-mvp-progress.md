# Gulugulu 核心玩法 MVP — 进度追踪

> 计划见 `plans/coregameplay-mvp-plan.md`。恢复工作：从下面第一个未勾选项继续，先读"下一步"。

**当前状态**：✅ 全部完成（P0–P10）。2026-07-07。
**下一步**：无。真机（Tauri 窗口）冒烟属于遗留项，见文末。

## P0 计划文件
- [x] plans/coregameplay-mvp-plan.md
- [x] plans/coregameplay-mvp-progress.md

## P1 共享配置
- [x] src/game/config.json（正式数值，含 27 物种表 + 21 融合表）
- [x] src/game/config.test.json（小数值测试配置）
- [x] src-tauri/src/game_config.rs（结构体 + include_str + env 选择）
- [x] cargo build 通过

## P2 Rust 游戏核心（game.rs）
- [x] GameSave/PetInstance/EggInstance/DailyCounters 结构 + 存取
- [x] 惰性结算（精力/每日翻转）+ exhausted 状态机
- [x] 首建迁移（progress 求和折币 + 教学蛋）
- [x] 14 个命令的核心逻辑（含校验与软上限；比 GDD 多了 advance_tutorial 与 wander_pickup）
- [x] feed_from_tokens（日上限/满级转移/溢出折币）
- [x] 单元测试 16 个全绿
- [x] cargo test 通过

## P3 Rust 集成
- [x] lib.rs 注册命令 + manage 状态
- [x] tick 线程（挂机经验/产金 + game://state 事件）
- [x] resize_game_window（含水平居中补偿）
- [x] codex_adapter 钩子（enrich_with_game_feed；事件新增 petExpDelta/fedCoins 字段）
- [x] cargo build + cargo test 通过

## P4 TS bridge + mock
- [x] types.ts 增补（GameSave 镜像 + PetState 扩展 + GameConfig）
- [x] petEvents.ts 扩展（laboring/exhausted 映射）
- [x] src/game/bridge.ts（Tauri/Mock 自动切换；Mock 同步异常已包装为 rejected promise）
- [x] src/game/mockEngine.ts（全规则 + localStorage + tick）
- [x] npm run build 通过

## P5 SVG 精灵
- [x] src/sprites/SvgSprite.tsx（6 体型参数化 + 属性徽记 + 2阶渐变放大 + 蛋模板 + CSS 动效）
- [x] SVG onComplete 用 animationDefinitions 时长 setTimeout 模拟（App.tsx effect）
- [x] npm run build 通过

## P6 UI 面板 + App 集成
- [x] MenuBar（菜单条 + 精力/金币/等级 HUD + 红点徽章）
- [x] HatcheryPanel（槽位/倒计时/进度条/发光收取/升级/库存入槽）
- [x] YardPanel（网格/详情/跟随/卡片打工/两步确认放生/升级/长按拖拽融合入口）
- [x] ShopPanel（6 蛋卡/钱不够置灰/购买）
- [x] FusionPanel（双槽/仅满级候选/？？？预览/电弧/手续费确认）
- [x] 状态页（连接状态 + 每日计数 + 测试模式调试按钮：喂Token/重置存档）
- [x] App.tsx 重写：uiMode 7 态 + 点击消歧（pet=弹菜单，menu=打工）+ Esc/空白返回 + exhausted 排除两个定时器
- [x] 窗口尺寸表 + resize_game_window 接线（右键菜单 resize 一并迁移到 Rust 命令）
- [x] 移除 avatar-gen 网页入口（生成/安装/旧融合按钮全部移除，保留换肤与语言）
- [x] npm run build 通过

## P7 特效与打磨
- [x] 金币(金)/Exp(绿)/LvUP(橙闪)/软上限(灰) 四种飘字 + 后院卡片锚定飘字
- [x] 打工挤压弹跳/睡觉灰度+Zzz/孵化摇晃+完成发光抖动/眨眼/浮动
- [x] 融合电弧 + 白闪特效；菜单滑入/面板渐入过渡
- [x] 四步新手引导气泡 + 商店/孵化红点
- [x] npm run build 通过

## P8 构建门禁
- [x] npm run build 全绿
- [x] cargo build + cargo test（16 tests）全绿

## P9 视觉验证（浏览器 preview + ?test=1，Mock 引擎全流程实测）
- [x] 新手流：教学蛋 4s 孵化→点击收取→点宠物弹菜单→菜单态点击打工 +金币+经验
- [x] 精力耗尽入睡（state-exhausted + Zzz）→睡觉时点击被拒绝（金币 0 增长）→阈值自动醒
- [x] 商店：6 卡价格正确；买蛋入槽 toast / 槽满入库存 toast；金币不足置灰（电/冰蛋 locked）
- [x] 孵化：倒计时/进度条→完成发光→收取"破壳而出"；后院满员时收取被拒且蛋留槽
- [x] 后院：切换跟随（舞台切到 SVG 泡泡蛙/焰羽鸭）/放生两步确认+返还 22 金（公式核对）/最后一只禁放生（disabled+tooltip）
- [x] 融合：候选仅满级；鸭+狐 → 焰羽鸭 2 阶蛋（融合表正确）；扣 10 金；白闪→自动跳孵化屋；20s 后孵出 2 阶精灵（渐变体色）
- [x] 升级孵化屋（20金→2槽）/升级后院按钮与价格正确
- [x] 软上限：日点击 >60 触发"收益递减"toast，5金→2金减半核对
- [x] Token 喂养：喂5→5/15；喂50→顶到 15/15 + 溢出折币 10/10 封顶；再喂提示上限
- [x] 引导：步骤 0-3 文案随进度正确出现
- [x] 空白处/Esc 逐级返回（shop→menu→pet）
- [x] 窗口尺寸表 7 模式全部命中（260×320/260×396/300×440/340×500/320×470/340×440/260×420）
- [x] 漫游捡币自然触发（daily.pickupCoins 计数）
- ⚠️ 截图工具在此环境持续超时，视觉核验改用 a11y 快照 + 计算样式（动画名/尺寸/颜色）逐项确认

## P10 可玩性评估
- [x] 玩家视角完整循环通关（孵化→打工→买蛋→融合→2阶）
- [x] 发现并落地 3 项体验优化：
  1. 宠物模式下睡着无恢复提示 → 舞台底部加"Zzz…精力恢复中 x/100"标签
  2. 挂机/Token 升级完全无反馈 → 加等级观察者，主宠任何来源升级都飘"Lv UP!"（后院卡片打工保留锚定飘字）
  3. 菜单 HUD 看不到等级 → HUD 加 Lv 徽章
- [x] 正式配置回归：无 ?test=1 时初始 50 金、教学蛋 60s、价格 80/120/150、钱不够置灰，全部正确
- [x] 评估结论：核心循环手感成立——点击打工的"弹跳+双飘字"反馈爽快；精力节流的强制小睡有明确视觉语言；融合是清晰的里程碑时刻（电弧→白闪→高阶蛋）。后续可加分项（超出 MVP）：音效、买蛋飞行动画、裂壳逐帧动画、2 阶专属形象（接 avatar-gen）。

## 修复记录（验证期发现的 bug）
- MockBridge 把引擎同步 throw 直接抛给调用方（非 rejected promise），导致"睡觉中点击"的拒绝分支永不执行 → 已用 run() 包装修复。
- handlePointerDown 的 setPointerCapture 对合成指针会抛异常 → try/catch 保护。
- 2026-07-07 用户实测反馈：融合按钮随 .panel-body 滚动被卷出可视区，找不到操作入口 → `.panel-cta` 改为 `position: sticky; bottom: 0`（孵化屋/后院升级按钮同步受益），已在 6 候选溢出场景下验证：不滚动可见、滚动后仍可见、点击可正常融合。

## 遗留项 / 已知限制
- **`resizable:false` 下 Rust `set_size` 的真机验证**：浏览器无法验证真窗口行为，需要跑 `npm run tauri:dev` 确认 7 个 uiMode 的窗口伸缩与水平居中补偿（GDD §12.6 检查点）。若受限，后备方案：tauri.conf.json 改 `resizable: true`（无边框窗口用户依然无法手动缩放）。
- 桌面端（Tauri 真实存档 gulugulu-save.json、tick 线程、Token 喂养钩子）逻辑与 Mock 同源且有 16 个单元测试覆盖，但未做真机端到端冒烟。
- 测试配置激活方式：桌面端设环境变量 `GULUGULU_TEST_CONFIG=1` 后启动；浏览器加 `?test=1`。
- 验证时终止过一次用户的旧 `tauri dev` 进程树（旧代码实例，占 1420 端口）；avatar-gen 服务未动。

## 备注日志
- 2026-07-07 P0：GDD 定稿；代码通读完成（App.tsx/petEvents/types/AnimationPlayer/lib.rs/codex_adapter 关键段/styles/capabilities/Cargo.toml）。
- 2026-07-07 P1–P10 全部完成。手工测试入口：`npm run dev`（projects/gulugulu-app）后开 http://localhost:1420/?test=1（小数值）或不带参数（正式数值）；状态页有"喂 Token/重置存档"调试按钮（仅测试模式显示）。
