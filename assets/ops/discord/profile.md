# Discord 服务器 + Bot 资料包

用你现有的 Discord 个人账号创建即可（服务器所有权以后可转移），无需新注册。

> 品牌说明：账号层统一用 Mobi Studio，但**服务器是游戏社区，保留 `Gulugulu` 命名与鸭头图标**（玩家找的是游戏，不是工作室）。

## 服务器

| 字段 | 填写内容 |
|---|---|
| 服务器名 | `Gulugulu` |
| 图标 | `server-icon-512.png` |
| 服务器描述（开启社区功能后填） | `Desktop pet that reacts to your AI coding agent — hatch, fuse AI-designed species, trade on Steam. EN / 中文` |

创建后建议顺手开启：**社区功能**（Server Settings → Enable Community，选 #welcome-rules 为规则频道）——解锁公告频道与更好的反滥用默认值。

## 频道结构（创建服务器时选「From Scratch」，然后照此建）

```
📢 INFO
  #announcements   （公告频道类型，仅管理可发；话题：Release notes & events, mirrored to Steam）
  #welcome-rules   （规则见下）
  #faq             （置顶 FAQ，由我维护文案）
💬 COMMUNITY
  #general         （话题：Chat about Gulugulu & AI-assisted coding）
  #pet-showcase    （话题：Show your pets & fusion results 🐣）
  #fusion-lab      （话题：Recipes, element math, slot lore）
  #market-talk     （话题：Steam market chat. Not financial advice.）
  #bug-reports     （话题：One bug per message · attach your OS + app version）
  #suggestions
🇨🇳 中文区
  #闲聊
  #晒宠与配方
```

## 规则文案（#welcome-rules，双语直接贴）

```
1. Be kind. No harassment, hate, or drama farming.
2. No spam or unsolicited self-promo (ask a mod first).
3. Trading stays on the Steam market — no real-money or off-platform trades, no item begging.
4. Market chat is never financial advice. Nobody promises prices go up.
5. No cheat/exploit/save-editing talk that breaks the shared economy.
6. Mods = the dev (human) + Gulugulu Bot (Claude). Bot actions are always labeled.

1. 友善相处，禁止骚扰、引战。
2. 禁止刷屏与未经允许的自我推广（先问管理员）。
3. 交易只走 Steam 市场——禁止现金/场外交易，禁止乞讨物品。
4. 行情讨论不构成任何投资建议，没人保证物品价格走向。
5. 禁止讨论破坏共享经济的作弊/改档手段。
6. 管理 = 开发者（人类）+ Gulugulu Bot（Claude 运营，操作会标明身份）。
```

## 欢迎消息（#welcome-rules 顶部或欢迎屏幕）

```
Welcome to Gulugulu! 🐣 A free Steam desktop pet that levels up while your AI coding agent works.
Read the rules above, then show off your pets in #pet-showcase. 中文玩家请到 🇨🇳 中文区！
```

## Bot 应用（https://discord.com/developers/applications → New Application）

| 字段 | 填写内容 |
|---|---|
| 应用名 | `Gulugulu Bot` |
| 头像 | `bot-avatar-512.png` |
| 描述 | `Official Gulugulu helper — relays Steam announcements, greets hatchlings, answers FAQ. Operated by Claude, actions always labeled.` |

- 创建后在 Bot 页生成 token：**token 等同密码——自己存到本地（后续我给 `.env` 路径），绝不要贴进聊天或任何文件提交。**
- 先不用配权限细节；接入公告转发时我会给出最小权限清单（读消息/发消息/嵌入链接）。
