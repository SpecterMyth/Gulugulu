# 01 · 一期：发售引爆（★ 最高优先）

> 窗口：2026-07-21 → 发售后 4 周（≈09-15）。目标：免费发售一次性拉满势能，把安装转化为活跃与市场流动性。
> T = 发售日，建议 **2026-08-18（周二）北京 22:00**（= PT 07:00 / ET 10:00 / CEST 16:00，三大时区都醒着；30 天付费规则最早 ≈08-10，留 8 天缓冲）。
> 执行标记：🤖 = Claude 直接做；🟡 = Claude 做完进 `queue/` 等批；👤 = 用户本人。

## A. 就绪门（全部 ✅ 才进预热；目标 08-03 前清空）

### A1 Steam 发布链（承接 [05-release.md](../../plans/steam_trade/05-release.md) 冻结区，须用户解冻 WS5）

- [ ] 定价改 **Free to Play**（🤖 同步文档，👤 后台改价点保存）
- [ ] 后台商店页填写：素材/文案/系统需求/语言（界面：英/简中）/内容问卷 + AI 披露（🤖 注入填写，👤 在场确认；素材文案见 [06-store-page.md](../../plans/steam_trade/06-store-page.md)）
- [ ] 商店页描述多语言包挂载（见 A3；描述可多语，界面语言如实只标英/简中）
- [ ] R1 depot/steamcmd build 管线 + R2 WebView2 installscript（🤖 写脚本与 vdf，👤 steamcmd 首次登录）
- [ ] R8 掉落参数收紧（5→45 / 10→2，🤖 备好，👤 发布点击）
- [ ] R9 取消「仅开发者云」勾选（👤 发布点击；不做则玩家工坊皮肤预览图静默失败）
- [ ] A8 冒烟残留清理（90001-90007 defs + 101×2，🤖 `steam_smoke::a8_cleanup_residue`）
- [ ] **提审：商店页 + build**（👤 点提交；审核 2~5 工作日）→ **Coming Soon 上线，目标 ≤07-28**
- [ ] 成就页/创意工坊可见性随发售转公开（👤 点击，T 日）

### A2 账号矩阵（👤 注册——今天启动；🤖 出全部头像/横幅/简介文案）

> ✅ 注册包已产出（2026-07-21）：[assets/ops/](../../assets/ops/README.md)——逐平台注册链接、注意事项、头像/横幅、逐字段可粘贴文案。
> **品牌主体（2026-07-22 拍板）：全平台工作室号 Mobi Studio，handle 统一 `mobistudiohd`**；账号头像=工作室 Logo，横幅=Gulugulu 游戏画面；双邮箱制（内部注册 `mobistudiodev@gmail.com` / 对外客服 `gulugulu@mobigames.cn`）。

| 平台 | 用途 | 状态/备注 |
|---|---|---|
| X | 主广播阵地 | ✅ `@mobistudiohd` 已注册+登录 Chrome（2026-07-22）；资料完善+首帖 🤖 执行 |
| ops 邮箱 | 内部注册/恢复 | ✅ `mobistudiodev@gmail.com`；对外客服 `gulugulu@mobigames.cn` 👤 待建（mobigames.cn 后台别名） |
| Reddit | 发帖账号 | **越早越好**：账号年龄+karma 决定帖子存活；注册后 👤/🤖 以真身参与 AI 工具讨论自然攒 karma（不刷） |
| Discord | 官方服务器 + Bot 应用 | 服务器保留 Gulugulu 命名（游戏社区）；🤖 出频道结构/规则/欢迎语；👤 建服 + 生成 bot token |
| Product Hunt | 发售 T+2 上线 | 个人 maker 号，自 hunt 即可 |
| Hacker News | Show HN | 👤 已有账号则用旧号（新号发 Show HN 易沉） |
| YouTube | 挂预告片（商店页外链、外联引用） | 频道名 Mobi Studio；上传 74s 主片 + 30s 剪辑 |

注册后每个平台在 Claude 专用 Chrome Profile 登录一次，此后 🤖 在已登录会话内操作（🟡 批后发布）。

### A3 素材与阵地（🤖 为主）

- [ ] 预告片定稿：74s 主片配 BGM（👤 拍板来源）→ 导出 Steam 规格 + 30s/15s 竖版剪辑（Shorts/PH 用）
- [ ] press kit 页（GitHub Pages）：factsheet / 截图 / GIF / logo / 团队署名 Mobi Studio / 联系方式 / 隐私 FAQ —— 达人外联的标准附件
- [ ] 商店页描述多语言包 ×10：EN/简中/繁中/日/韩/德/法/西/葡巴/俄（🤖 全出，👤 抽查 1-2 语）
- [ ] 社媒素材首批：P1 反应梗 GIF ×6、P2 融合揭晓卡 ×4、P4 meta 图 ×2（新增 `scripts/render_marketing.tsx` 复用精灵渲染管线 + ffmpeg 出 GIF/mp4）
- [ ] `kb/faq.md`：隐私（键盘/日志）/ 受限账户 / 如何连 agent / 不用 agent 能玩吗 / 掉落封顶机制 / 工坊首发权 —— 中英双语
- [ ] 帖子模板库 `kb/templates/`：show-hn / ph-launch / reddit-claudeai / reddit-sideproject / reddit-incremental / x-launch-thread / steam-announcement-launch / outreach-youtuber / reply-negative-review

### A4 产品侧增长钩子（🤖 开发，小改动；T-5 代码冻结，之后只修 bug）

- [ ] 设置面板/公告板加「加入 Discord」「给个好评」入口（发售日随更新启用）
- [ ] Steam Rich Presence：好友列表显示「陪 agent 打工中 · Lv.x」——好友圈免费内生曝光
- [ ] 物种分享卡一键导出 PNG（图鉴/融合成功页），玩家自己变成 P2 素材生产者
- [ ] 好评请求时机：首次融合成功后弹一次、只弹一次（不激励，合规）
- [ ] 核查 Onboarding 首启文案：突出「连接 Claude Code/Codex」的 aha 时刻 + 纯点击也能玩的兜底

### A5 自动化演练（系统详见 [02-automation.md](02-automation.md)；发售前必须实跑）

- [ ] 三条定时管线建立（日巡检/周内容/周报，👤 同意创建）
- [ ] 日巡检空转 3 天：抓 Coming Soon 页 + Reddit/X 提及 → 摘要 → 空队列演练
- [ ] 公告发布链路 dry-run（partner 站存草稿不发布）
- [ ] 用 Coming Soon 数据生成第一份周报 `reports/`

## B. 预热（T-14 → T-1）

所有帖子：🤖 起草 → `queue/` → 👤 批 → 🤖 发；HN/PH 主帖 👤 亲发。

| 时点 | 动作 | 支柱 |
|---|---|---|
| T-14 | X 首发 thread「我做了个吃 token 的桌宠」+ 最强 GIF；r/ClaudeAI 首帖；愿望单开始引流 | P1 |
| T-12 | r/SideProject devlog 角度帖 | P4 |
| T-10 | 融合系统揭晓（AI 现场设计物种 + 工坊首发权规则）；30s 预告投 YouTube | P2 |
| T-7 | **达人外联第一波 30 封**（SOP 见 02 §5.4；免费游戏无需 key，给 press kit + 发售日期 + b-roll 包） | — |
| T-5 | r/incremental_games（放置/收集角度）、r/DesktopPets 各按 sub 规则发；**代码冻结** | P2 |
| T-3 | 「AI 运营」meta 帖（若 §9-8 拍板公开）：发行系统如何运转 | P4 |
| T-1 | 全渠道发售预告（倒计时图）；Discord 服务器软开，邀请预热期互动过的用户 | — |
| 持续 | 日巡检回复一切评论；素材数据好的角度加推，差的换钩子 | — |

**预热退出线**：愿望单 ≥800（保底）；X 首帖曝光 <3 万则钩子文案 A/B 重打一轮。

## C. 发售 48 小时（T 日运行手册）

| 时刻 | 动作 | 谁 |
|---|---|---|
| T-0（北京 22:00） | 点发行按钮；工坊/成就页转公开 | 👤 |
| +10 分钟 | 验证商店页 Free/成就/工坊/市场可见 → Steam 发售公告（双语）→ X 发售 thread → Discord @everyone | 🤖（公告与帖子当场批） |
| +30 分钟 | r/ClaudeAI + r/SideProject 发售帖（两套不同文案） | 🟡 |
| +1 小时起 | 首诉监控（杀软误报/WebView2/连不上 agent），bug 即修即出 hotfix；评测/讨论逐条回 | 🤖 |
| T+1 日（美东周三早 = 北京晚） | **Show HN**（标题备 3 案；技术+隐私叙事）；评论区黄金 4 小时 🤖 实时起草、👤 粘贴发布 | 👤+🤖 |
| T+2 日（PT 00:01） | **Product Hunt 上线**（gallery 5 图 + maker 首评已备好） | 👤 点发布，🤖 值守回复 |
| 持续 48h | 每 2h 数据快照（安装/CCU/评测/舆情）写 `reports/launch-live.md`；负面舆情按 [00 §8](00-strategy.md) 预案 | 🤖 |

**发售周硬指标：尽快突破 10 篇评测**（出「特别好评」标签的门槛）——公告末尾请求 + 游戏内首次融合后提示（A4）双管齐下。

## D. 承接（W1-W4，每周一个主题）

| 周 | 主题 | 关键动作 |
|---|---|---|
| W1 | 快响应 | 天级 bugfix ×2；每条评测/讨论必回；首个「玩家数据公告」（全球已融合出 N 个新物种/最稀有掉落）= P2 内容 |
| W2 | 角度轮换 | 达人外联第二波 50 封（带上首周数据背书）；首个社区活动「晒你的融合物种」+ 工坊精选；短视频角度试投 |
| W3 | 首个内容更新 | 限时「创世蛋」或新固定物种（回流 + 市场新供给）；行情周报第一期（P3，谨慎措辞） |
| W4 | 复盘 | 全漏斗数据 vs KPI（[00 §7](00-strategy.md)）；决定二期资源投向（CN？短视频矩阵？更新提速？）；「AI 运营月报」公开（P4，若拍板） |

## E. 渠道 playbook 精要（模板落 `kb/templates/`）

| 渠道 | 目标 | 红线 | 要点 |
|---|---|---|---|
| Reddit | 各 sub 首帖不死 + 评论区热度 | 逐 sub 读规则；自我推广限频；不跨 sub 复制同文 | 美区早晨发；标题讲故事不讲产品；评论区秒回、真人味 |
| Show HN | 首页 4 小时 | 不营销腔、不催票；一次机会 | 标题朴素（"Show HN: A Steam desktop pet that levels up while Claude Code works"式）；正文给技术细节+隐私设计；准备好「为什么读我日志」的回答 |
| X | A 人群渗透 | 日 1-2 帖上限；不买粉 | thread 首条必带 GIF；蹭 AI 编程话题 quote；@ 相关工具官号自然互动 |
| Product Hunt | 当日榜前列 | 不买量、不拉票团 | 00:01 PT 上线；maker 首评讲单人+AI 开发故事；全天答评论 |
| Steam 社区 | 好评率与算法信号 | 不激励评测；不删差评讨论 | 公告双语；讨论区 24h 内必回；置顶 FAQ + 已知问题贴 |
| Discord | 核心玩家留存 | 不 @everyone 滥用（周 ≤1） | 频道：公告/闲聊/晒宠/融合配方/市场行情/bug 反馈/中文区；bot 转发 Steam 公告 |
| 达人外联 | 3-5 个中型频道发片 | 只用公开商务邮箱；不虚构合作条件；不承诺报酬（一期无预算） | 3 句话个性化 + press kit + b-roll 包；T+7 跟进一次即止 |

## F. 应急预案

- **「间谍软件？」冲上热帖** → `kb/faq.md` 长文回应（代码公开 + 键盘只计数 + 日志只读本地）置顶/回帖；语气感谢质疑、给验证路径，绝不辩论。
- **发售日致命 bug** → A1 build 管线已演练，hotfix 直推；公告透明说明时间线。
- **市场零流动** → W3 内容更新造新供需；官方绝不下场做托交易（合规红线）；用行情内容与掉落科普引导。
- **曝光不及保底** → 48h 内不加帖硬洗（伤账号）；复盘钩子做 A/B，把二波渠道（Shorts/B站）提前。

## G. 一期完成判据

发售完成；KPI 达基线或完成复盘并明确二期调向；自动化系统无人值守稳定运行 ≥2 周；二期计划（社群深化 & CN）评审通过。
