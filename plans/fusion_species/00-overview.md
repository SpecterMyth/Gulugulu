# 融合系统 2.0 与 63 物种全谱 —— 工作流总览（多会话共享）

> 创建 2026-07-14。本文件是任何新会话进入本工作流的**唯一入口**；活进度在 [01-progress.md](01-progress.md)。

## 一、目标一句话

物种身份改为**元素集合**（63 物种 = 6 只一阶 + 57 只新物种），阶数改为**融合次数**（1~6，同阶满级才可融、每次 +1 阶、同物种融合同形象升阶 + 脚底光圈），57 只新物种**逐只定制 SVG rig**；生产顺序：**先全部名字/设定/静态形象 → 用户确认 → 才做动画**。

## 二、权威文档（设计已定稿，先读再动手）

| 文档 | 内容 |
|---|---|
| `docs/gdd/FusionSystem.md` | 规则/双轴模型/经济数值/数据模型变更/存档迁移 v4/AI 路径/Steam 编号/引擎 PR 拆分 |
| `docs/gdd/FusionRecipeSlots.md` | **配方 11 槽位 AI 变种阶梯**：0 号固定+1~10 号 AI 渐进解锁/概率公式/复用 vs 生成/CLI 降级/`recipeAiSlots`+`dexObtained`/AI 美术契约（取代 FusionSystem 单次 aiFusionChance 掷骰） |
| `docs/gdd/PokedexSystem.md` | **图鉴**：曾获入册/博物馆速览(高阶→低阶+"+x")/配方详情(黑影叠概率+曾获只数)/dexNo/完成度口径 |
| `docs/gdd/SpeciesMatrix.md` | 63 物种全谱：codename/中文名/设定/家族/工具/粒子/睡姿（**codename 一经用户确认永不改名**） |
| `docs/gdd/SpeciesArtSpec.md` | 美术规范 v2：species-pack 架构/单比例 rig 模板/共享底件/阶数光圈 CSS/QA 管线/批次 DoD |
| `docs/gdd/InteractionEconomy.md` | ⚠️ **并行工作流**（交互经济重构）：tierFactor 收益/精力体系权威；已占用存档 v3 |

## 三、阶段 DAG（当前状态见 01-progress.md §1）

```
P0 设计定稿（GDD 四文档 + 本工作流落地）
 └─→ P1 引擎（PR-1 规则核心 → PR-2 AI 路径 → PR-3 预览+光圈 UX → PR-4 Steam 预备）
 └─→ P2 静态形象（B0 基建+试点 → B1~B9 全部 57 只 Front 构图）   ※ P1/P2 可并行，P2 不依赖 P1
       └─→ P2-Gate 用户逐只确认形象（评审图 assets/species_review/）
             └─→ P3 动画（按 B1~B9 分组补 Side/Lie/WORK_FX/联调）
                   └─→ P4 收尾（删 21 旧物种行+旧工具/图鉴计数/全谱终审/真机验证）
                         └─→ P5 Steam（延后：itemdef 601-657 上传、legacy 映射、阶数登记 Steam 决策）
```

进入条件与每批 DoD：见 `SpeciesArtSpec.md` §9 与 `FusionSystem.md` §10；**P3 严禁在 P2-Gate 之前开工**（用户明确要求先确认形象）。

## 四、任何新会话如何恢复（冷启动三步）

1. 读本文件 + `01-progress.md`：§1 阶段总览找到当前阶段，§2/§3 找到下一个未完成条目。
2. 干活前置检查：
   - 改 `docs/gdd/CoreGameplay.md` 或 config/game.rs 前**先重读文件最新状态**——本仓库常有并行会话（交互经济重构工作流在同时改这些文件，存档版本号 v3 归它、v4 归本工作流，谁后合入谁 rebase）。
   - P2/P3 美术批次：开工前读 `SpeciesArtSpec.md` + `src/sprites/species2/STYLE.md`（B0 产出）+ 最新累计 contact sheet。
   - 引擎 PR：跑 `cargo test`（`projects/gulugulu-app/src-tauri`）与 `npm run build`（`projects/gulugulu-app`）确认基线是绿的。
3. 收工时**必须**更新 `01-progress.md`：勾选完成项 + 在 §4 会话日志追加一行（日期/做了什么/下一步/遗留问题）。没写日志 = 没干完。

## 五、硬约定（违者返工）

1. **codename 冻结**：`SpeciesMatrix.md` 中的 codename 在 P2-Gate 用户确认后永不改名（存档外键）；确认前如需改名，同步改矩阵 + 进度表两处。
2. **零新增 CSS**：物种 rig 只用现有 14 态部件动画词汇；新 CSS 只允许 B0 一次性落（阶数光圈 + orn-装饰类）。
3. **一物种一文件**：`src/sprites/species2/e{2..6}/<codename>.tsx`，只有 `species2/index.ts` 是共同触点（append-only）。
4. **QA 门禁**：每批结束 `npm run build` + `check_species_assets` + 渲染冒烟 + 累计 contact sheet 人审，全绿才算完成。
5. **验收走离线渲染**（resvg/contact sheet + DebugPanel computed-style），**不要用 preview 截图**（本项目会超时）。
6. 存档迁移编号：交互经济 = v3，融合 = v4；`ensure_loaded` 链式迁移，先合入者先占号，后合入者 rebase。

## 六、范围外（别顺手做）

Steam itemdef 上传与 `generate_itemdefs.mjs` 改造（P5）；商店物价调价 pass（交互经济工作流旗标）；avatar-gen 相关；音效。
