# 02 · 全自动发行系统（AI 运营台）

> 原则：**AI 产出并执行一切可自动化的发行运营工作；人只做三类事——账号级操作、不可逆点击、拍板。**
> 红线继承 [steam_trade 会话约定 #6](../../plans/steam_trade/README.md) 并扩展到所有对外平台（见 §3）。

## 1. 架构（五层 + 审批队列）

```
[素材工厂] 渲染脚本/文案/多语言 ────┐
[外联] 名单研究/个性化草稿/跟进 ────┼─► [审批队列 queue/] ─► [发布] Steam公告 · X · Reddit · Discord · 邮件
[倾听] 评测/讨论/社媒提及/舆情 ─────┘                          │
[数据] Steamworks/steamdb/社群指标 ◄──── 发布后回收效果 ────────┘ ─► reports/ 快照与周报
```

- 素材工厂与数据层纯 🟢（入库即完成）；发布与外联的「发出去」动作一律 🟡 过队列；倾听层抓取 🟢、回复 🟡。

## 2. 工具栈

| 能力 | 载体 | 状态 |
|---|---|---|
| 定时会话 | Claude Code 定时任务 ×3（日巡检 / 周内容 / 周报） | ⬜ 待建（一期 A5，👤 同意创建） |
| 浏览器执行 | Claude-in-Chrome 专用 Profile「Claude」（已登 Steam partner；待登 X/Reddit/Discord/PH/邮箱） | 🚧 |
| Steamworks 页面自动化 | 注入 fetch/FormData 已实证（itemdefs 上传、成就后台；技巧存档见 [SteamAchievements.md §7](../gdd/SteamAchievements.md)：uploadachievement 端点 / 每语言隐藏 input / MessageChannel 抗后台节流） | ✅ |
| 渲染管线 | `render_store_assets` / `capture_store_shots` / `render_sprites` / `render_eggs` / trailer 舞台 + 新增 `render_marketing.tsx`；ffmpeg 出 GIF/mp4 | 🚧（ffmpeg 待装） |
| 公开数据 | appreviews JSON（`store.steampowered.com/appreviews/4956830?json=1`）、steamdb、Reddit `.json`、成就全局解锁率 | ✅ 无需登录 |
| Discord | 官方服 + Bot（webhook 转发公告；巡检经 bot API 读消息） | ⬜（👤 建服/token） |
| 邮件 | ops 邮箱在浏览器会话内收发（密码不经 🤖 手） | ⬜ |

## 3. 权限分级（核心制度）

| 级 | 定义 | 例 | 流程 |
|---|---|---|---|
| 🟢 直接做 | 无对外副作用 | 仓库内素材/文案/代码/报表/翻译；公开数据抓取；草稿；已登录页面**只读**浏览 | 🤖 执行并入库 |
| 🟡 批后做 | 一切对外发布与后台**可逆**写操作 | Steam 公告、社媒帖、评论/评测回复、外联邮件、工坊精选、后台保存类 | 🤖 备好 → `queue/` → 👤 批（「发」/逐条勾）→ 🤖 执行 → 记录 `assets/published/` |
| 🔴 用户本人 | 账号级与不可逆 | 注册/密码/2FA/支付/协议实名；发行·提审·删除类点击；HN 发帖（社区文化敏感） | 🤖 只备材料 |

### 3.1 常设授权清单（👤 签字后某类 🟡 → 🟢）

> 初始为空。建议满月评估后放开低风险类：Steam 讨论区 FAQ 类标准回复、好评感谢回复。每条授权写明：范围、模板约束、单日上限、生效日期。

（暂无）

## 4. 定时任务（拟建）

| 任务 | 频率 | 输入 → 输出 | 审批点 |
|---|---|---|---|
| 日巡检 | 每日 09:30 | 抓评测/Steam 讨论/Reddit·X 提及/Discord/GitHub issues → 分类（bug/提问/好评/舆情）→ 按 `kb/` 起草回复 → `queue/YYYY-MM-DD-replies.md` + 当日快讯 | 全部回复 🟡 |
| 周内容 | 周一 14:00 | 支柱轮换 × 上周数据选角度 → 渲染素材 + 多语言文案 → `queue/YYYY-WNN-posts.md` 排期表 | 发布 🟡 |
| 周报 | 周五 18:00 | 全指标 + 渠道归因 + 舆情 Top3 + 下周行动项 → `reports/YYYY-WNN.md` | 🟢 入库即完成 |
| 版本节拍 | 双周（随开发手动触发） | 更新说明起草 → Steam 公告 + 社媒联动包 | 🟡 |
| 发售期加频 | T-1 → T+7 | 巡检 2 次/日；48h 内快照每 2h 写 `reports/launch-live.md` | 快照 🟢 |

## 5. SOP

### 5.1 巡检与回复

- 数据源清单与抓法维护在 `kb/sources.md`（URL、是否需登录、频率）。
- 分类：`bug`（→ 直接开 repo issue + 排期回复）/ `提问`（→ FAQ 匹配）/ `好评`（→ 感谢）/ `差评`（→ 先致谢再给方案，**绝不辩论**）/ `舆情`（→ 按 [00 §8](00-strategy.md) 预案升级）。
- 回复三原则：24h 内；具体到对方内容不套模板腔；中文帖中文回、英文帖英文回。
- 队列行格式：`渠道 | 原文链接 | 摘要 | 建议回复 | 风险标注`。

### 5.2 内容生产

选角度（P1-P4 轮换 + 上周最佳）→ 渲染（脚本直出 + ffmpeg，GIF ≤15MB）→ 文案多语言 → 平台适配（尺寸/话题标签/时区）→ 排期 → 发布（🟡）→ 48h 后回收数据入周报。发布过的素材与最终文案归档 `assets/published/YYYY-MM/`。

### 5.3 数据与周报

指标×来源对照表维护在 `kb/metrics.md`（partner 销售/流量/愿望单/在线/经济成交、appreviews、成就漏斗、社媒后台、Discord）。周报模板：TL;DR → 漏斗全链数字 → 渠道归因 → 舆情 Top3 → 市场行情（供给/价格异常）→ 下周行动项。

### 5.4 外联（达人/媒体/社区）

1. 研究：每批 50 目标（YouTube/Twitch AI 工具与休闲频道、newsletter、二期 B站），只收集**公开**商务邮箱/合作表单，入 `crm/outreach.csv`（`name,channel,contact,audience,angle,status,last_contact,notes`）。
2. 草稿：3 句话个性化（点名对方近期内容）+ press kit 链接 + b-roll 包；模板 `kb/templates/outreach-*.md`。
3. 🟡 批量审批 → ops 邮箱发送 → 状态机 `draft→approved→sent→replied→covered`。
4. T+7 未回自动生成跟进草稿（再批一次），之后不再打扰。**绝不群发轰炸、绝不虚构合作条件、一期不承诺报酬。**

### 5.5 Steamworks 后台操作

- 可自动（🟡）：公告/活动的撰写与存草稿、素材上传、itemdefs、成就文案维护。
- 必 👤：提审、发行、可见性变更等不可逆点击（steam_trade 红线）。
- 每次后台操作前后截屏归档 `assets/published/steamworks/`，防争议可回溯。

## 6. 目录约定

```
docs/ops/
  assets/       # 素材源与成品；published/ 已发布归档（按月）
  queue/        # 待审批（按日期命名：2026-08-18-replies.md）
  reports/      # 快照与周报（2026-W34.md / launch-live.md）
  crm/          # outreach.csv + 沟通记录
  kb/           # faq.md · sources.md · metrics.md · tone.md（品牌语气）· templates/
```

## 7. 人类一次性搭建清单（全部完成 = 系统可全速运转）

1. 账号矩阵注册（[01 §A2](01-phase1-launch.md)）并在 Claude Profile 逐个登录一次
2. Discord 服务器创建 + Bot 应用与 token（🤖 出频道结构/权限/文案）
3. ops 邮箱开通并保持浏览器登录
4. 同意创建 3 条定时任务（§4）
5. 同意安装 ffmpeg（winget，🤖 执行）
6. 常设授权清单 §3.1 初版确认（可为空）

## 8. 边界与故障

- **平台反自动化**：操作保持人类节奏（随机间隔、日限额、单账号单浏览器）；被平台质询立即停用该渠道并报告，🤖 出申诉草稿。
- **审批超时**：默认不发、顺延下一班次；发售 48h 提前对齐 👤 在线时段表。
- **账号异常**：🔴 交 👤 处理；期间该渠道内容转草稿积压。
- **成本**：三条定时管线的会话开销记入周报，月度复盘调频。
- **灾备**：本目录（含 kb/）即完整运营手册，任何新会话按 [README 会话约定](README.md) 可无缝接手；已发布内容有 `assets/published/` 存档兜底。
