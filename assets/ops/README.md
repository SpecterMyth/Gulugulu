# 账号矩阵注册指南（一期 A2）

> **品牌主体（2026-07-22 用户拍板）：全平台使用工作室号 Mobi Studio 进行宣传**，Gulugulu 是当前主打作品。
> 每个平台的头像/横幅/逐字段文案在同名子目录。工作室 Logo 源件在 [assets/studio/](../studio/)（深/浅/彩色/横版）；游戏横幅与鸭头图由 `projects/gulugulu-app` 下 `npx tsx scripts/render_ops_assets.tsx` 渲染。
> 执行计划见 [docs/ops/01-phase1-launch.md §A2](../../docs/ops/01-phase1-launch.md)。

## 统一品牌字段（速查）

| 字段 | 值 |
|---|---|
| 显示名 | `Mobi Studio` |
| Handle | **`mobistudiohd`**（X 已注册定案 2026-07-22；其余平台一律跟随，被占依次退 `mobistudiodev` → `mobistudio_hd`） |
| 账号头像 | 工作室彩色 Logo（各平台尺寸 `avatar-mobi-*.png` 已放各子目录；鸭头版留作游戏社区/活动用图） |
| 横幅 | Gulugulu 游戏横幅（工作室号展示主打作品） |
| 一句话简介 | Tiny studio, one human + a lot of Claude. Now raising Gulugulu — a free Steam desktop pet. |
| 网站链接 | 现阶段 `https://github.com/SpecterMyth/Gulugulu`；Coming Soon 上线后统一换 Steam 商店页 |
| **注册/恢复邮箱（内部）** | `mobistudiodev@gmail.com` —— 仅用于内部开发与发行操作，**不对外公示** |
| **对外客服邮箱** | `gulugulu@mobigames.cn` —— 玩家支持 + 达人/媒体外联统一走这个 |

## 各平台状态

| 平台 | 状态 |
|---|---|
| X | ✅ 已注册 `@mobistudiohd`（2026-07-22，已登录 Chrome「Claude」Profile）；资料完善 + 首帖由 Claude 执行 |
| ops 邮箱 | ✅ `mobistudiodev@gmail.com` 启用；对外客服箱 `gulugulu@mobigames.cn` 👤 待在 mobigames.cn 后台建立 |
| Reddit / YouTube / Discord / Product Hunt / HN | 👤 待注册（照下表） |

## 通用注意事项（先读再动手）

1. **全部用 `mobistudiodev@gmail.com` 注册**——恢复渠道集中；该邮箱不出现在任何对外页面（对外一律 `gulugulu@mobigames.cn`）。
2. 每站独立强密码入密码管理器；**全部开 2FA**，优先验证器 App 而非短信，恢复码离线保存。
3. 注册流程里所有「导入通讯录 / 寻找好友 / 个性化推荐」一律跳过。
4. 生日、地区如实填（品牌号也一样，虚填是封号理由）。
5. Handle 统一 `mobistudiohd`；被占按顺序退让并告诉我，我同步全套文案。
6. **注册完成后：在 Chrome「Claude」Profile 里把每个平台各登录一次**，然后告诉我——日常运营从那一刻起由我接管（对外发布仍走 `docs/ops/queue/` 审批）。
7. 红线：密码 / 2FA 码 / Bot token 永远不要发给我，也不要存进仓库。

## 逐平台清单（按此顺序做）

| # | 平台 | 注册入口 | 素材与文案 | 关键注意 |
|---|---|---|---|---|
| 1 | 对外客服邮箱 | mobigames.cn 域名后台（自家）建 `gulugulu@`（别名即可） | [email/signature.md](email/signature.md) | 确认能收外部件；网页版在「Claude」Profile 登录；贴好签名 |
| 2 | ~~X~~ | ✅ 已完成 `@mobistudiohd` | [x/profile.md](x/profile.md) | 资料完善 + 首帖由 Claude 执行（见该文件） |
| 3 | Reddit | https://www.reddit.com/register/ | [reddit/profile.md](reddit/profile.md) + avatar-mobi-256 + banner-1280x384 | ⚠️ **用户名永久不可改**（填 `mobistudiohd`）；当天订阅目标 sub；**头两周只评论不发帖** |
| 4 | YouTube | 用 gmail 账号 → youtube.com「创建频道」→ studio.youtube.com 完善 | [youtube/profile.md](youtube/profile.md) + avatar-mobi-800 + banner-2560x1440 | 频道名 `Mobi Studio`、handle `@mobistudiohd`；「面向儿童」选否 |
| 5 | Discord | 现有个人账号建服务器 +「+ New Application」https://discord.com/developers/applications | [discord/profile.md](discord/profile.md) + server-icon-512 + bot-avatar-512（频道结构/规则/欢迎语已备好） | 服务器保留 **Gulugulu** 命名（游戏社区）；开启社区功能；Bot token 自存本地**勿外发** |
| 6 | Product Hunt | https://www.producthunt.com/（右上 Sign up，可用 gmail 一键） | [producthunt/profile.md](producthunt/profile.md) + avatar-mobi-240 | 注册的是**你的个人 maker 号**；发售前少量点赞评论攒活跃；不拉票 |
| 7 | Hacker News | 优先用已有老号；没有才 https://news.ycombinator.com/login | [hackernews/profile.md](hackernews/profile.md)（无图） | 用户名别用产品名；发售前零推广，Show HN 留到 T+1 |

## 注册完成后（交接）

在会话里告诉我「某某平台注册好了、handle 是什么」，我随即：

1. 核对各资料页并出「完善包」（缺的字段、置顶帖草稿、首批关注名单）进 `docs/ops/queue/`；
2. 更新 [docs/ops/01-phase1-launch.md](../../docs/ops/01-phase1-launch.md) A2 状态与本页状态表；
3. 若某平台 handle 退让了，同步全套文案里的 @ 引用。
