# WS6-Store · 商店页素材与文案(App 4956830)

状态:🚧 草稿待用户审阅(2026-07-16)。素材已产出 `assets/steam-store/`;本文案审定后填入 Steamworks 后台。
执行方式:AI 在内置浏览器操作(用户已登录);**"提交审核"/"完成发行"类按钮由用户本人点击**(抗合成点击 + WS5 红线)。
本次拍板(2026-07-16,更新 00-decisions/05-release 相应条目):平台仅 Windows;定价 $0.99 / 国区 ¥6;英文截图为默认组 + 中文页覆盖;全局英语本地化随本工作流完成;**开启创意工坊**;支持邮箱 steamdev@mobigames.cn;对外一律 **Mobi Studio**(不出现公司全称)。

## A. 图形素材(已产出,审定后上传)

| 后台槽位 | 文件 | 尺寸 |
|---|---|---|
| 主胶囊 Main Capsule | assets/steam-store/main_capsule.png | 1232×706 |
| 头图胶囊 Header | assets/steam-store/header_capsule.png | 920×430 |
| 小胶囊 Small | assets/steam-store/small_capsule.png | 462×174 |
| 竖版胶囊 Vertical | assets/steam-store/vertical_capsule.png | 748×896 |
| 页面背景(可选) | assets/steam-store/page_background.png | 1438×810 |
| 库胶囊 Library Capsule | assets/steam-store/library_capsule.png | 600×900 |
| 库头图 Library Header | assets/steam-store/library_header.png | 920×430 |
| 库 Hero(无文字) | assets/steam-store/library_hero.png | 3840×1240 |
| 库 Logo(透明) | assets/steam-store/library_logo.png | 1280×720 |
| 应用图标(社区) | assets/steam-store/community_icon_184.jpg | 184×184 JPG |
| 快捷方式图标 | assets/steam-store/shortcut_256.png / shortcut_512.png / gulugulu.ico | 256/512/多尺寸 |
| 截图(默认组=EN) | assets/steam-store/screenshots/en/*.png | 10 镜头 1920×1080(见下) |
| 截图(简中覆盖) | assets/steam-store/screenshots/zh/*.png | 10 镜头 1920×1080(见下) |

截图镜头(v3,2026-07-17 用户审阅意见:仿桌面背景、游戏区 1/4 贴底、宠物窗 1.3×、多主角轮换):
**主力上传 8 张/语言,顺序**:pet_working(打工+金币飘字,鸭)→ backyard_home(后院全景)→ backyard_shop(商店,鲸)→ pet_sleeping(睡觉,雪兽)→ backyard_pits(孵化坑,电鼠)→ pet_thinking(思考,电鼠)→ backyard_notice(布告栏)→ pet_menu_closeup(菜单 1.6×)。
备选不传:backyard_dex(条带布局下面板截断感)、backyard_market(预览态含未连接横幅)。
图标 v2:无边框满幅鸭头(含完整鸭嘴),Steam 侧自行裁形。

生成管线:`scripts/gen_wordmark.tsx`(字标矢量化;ZCOOL KuaiLe,OFL/站酷免费商用 ✅ 许可确认记录)→ `scripts/render_store_assets.tsx`(全套构图)→ `scripts/capture_store_shots.mjs`(截图 rig)。改构图=改脚本重跑,禁止手改成品。

## B. 商店文案 —— 简体中文(主文案)

### B1. 名称与短简介

- 应用名:**Gulugulu**(后台已注册,不改)
- 短简介(zh,v2 2026-07-17:强调挂机玩 AI + 吐槽,去机制细节):

> AI 在替你写代码,你在干嘛?盯进度条。不如看鸭子。Gulugulu 是一只赖在屏幕角落的桌面宠物:Claude Code / Codex 每烧一批 token,它就啃一口——钱反正已经花了,总得有人吃。它还学了一嘴 AI 腔:"作为一个大语言模型,我建议你先喂我。"点它打工、孵蛋收集 63 种物种,再让你家 AI 亲自幻觉几只限量新品,挂上 Steam 跟人换。嘎?这合理吗?

### B2. 详细介绍(zh,BBCode,v2 2026-07-17)

```
[h2]一个挂机游戏:挂机的是你,干活的是 AI[/h2]
AI 编程时代最大的工伤:agent 在跑,你在旁边干瞪眼。Gulugulu 专治这段空虚——一只透明小宠物住进你桌面角落,实时围观你和 AI 结对编程:AI 思考,它跟着装深沉;AI 报错,它比你先叹气;AI 烧掉的每一批 token,都变成它的饭。烧都烧了,至少喂了鸭。
[list]
[*]实时感知本机 Claude Code / Codex 会话:思考、写码、翻车,全程演给你看
[*]键盘充能(Windows):敲键回精力;只数次数、不记内容,你的代码一个字都不看
[*]很懂事:自动躲开你正在用的窗口,绝不挡 IDE
[/list]

[h2]没有 AI，还能玩吗？能，而且它不会跟你说教[/h2]
能，一点问题都没有——而且没人会「作为一个大语言模型」地对你摆道理。Gulugulu 的正经玩法（点它打工、攒金币、买蛋孵蛋、收集 63 种物种、扩建后院）一行都不靠 AI：不联网、不掏 API key、不装任何 CLI，照样全套跑通。装了 Claude Code / Codex 只是加菜——它多几个反应，还能现场幻觉出限量新物种；不装，它就安安静静趴在你桌角当只普通的鸭，该睡睡、该要饭要饭。说白了，AI 是它的兼职，不是它的房东。

[h2]它把 AI 的坏毛病学了个遍[/h2]
过度自信、疯狂道歉、在错误的方向上勤奋——现代大模型的三大美德,它一样不落。你的 agent 第四次说"让我们一步步思考"的时候,不如低头看看鸭子:它至少诚实,饿了就说饿。精力见底它会当场趴下,嘴里念叨"让我稳稳地接住你——的金币",像极了写到一半开始输出免责声明的某些模型。

[h2]点它,是你最后一份正经工作[/h2]
AI 烧的 token 喂它涨经验,敲键盘、挂机帮它回精力,你只负责点它:点击打工,金币照攒、经验照涨,连击带金光,手感堪比戳泡泡膜。全程不用动脑——动脑的事,不是已经外包给 AI 了吗。金币拿去后院:买蛋、孵蛋(关掉应用照样孵)、扩建院子多养几只。

[h2]融合实验室:让幻觉变成生产力[/h2]
63 种手工设计的物种、6 系元素、6 个进化阶,慢慢收集。两只满级精灵可以融合出更高阶的新物种;走运的话,你本机的 Claude Code / Codex CLI 会被当场拉来设计一只前所未见的限量新品——起名、配色、造型全套现挂,不需要任何 API key。在别处,AI 幻觉一次害你 debug 三小时;在这儿,幻觉一次送你一只新宠物。哪个划算,你自己品。

[h2]创意工坊:你家 AI 的审美,全服的公共记忆[/h2]
每个 AI 物种,全球第一个掷出它的玩家,其形象经 Steam 创意工坊共享给所有人。从此别人图鉴里那只丑得清新脱俗的小东西,署名是你家 AI。好不好看?你说得对。

[h2]Steam 库存与交易[/h2]
养出来的精灵是货真价实的 Steam 库存物品:可交易、可上市场(正式发售后生效)。零自建服务器、零账号系统,你的存档就在你自己电脑上。

[h2]宠物语录(节选)[/h2]
[quote]"作为一个大语言模型,我不能替你上班,但我可以看着你上班。"[/quote]
[quote]"让我稳稳地接住你——的 token。"[/quote]
[quote]"你说得对!(说完睡着了)"[/quote]
[quote]"已深度思考(用时 8 秒):结论是,该吃饭了。"[/quote]
[quote]"检测到 bug。修复建议:先喂鸭,再 debug。"[/quote]

[h2]隐私:它只数键盘,不读代码[/h2]
键盘充能只统计每秒按键次数;字符本身变成 250ms 的飞行键帽动画后即焚——不记录、不保存、不上传。你的代码烂不烂,只有你的 AI 知道,而它嘴很严(也可能只是忘了)。
```

⚠️ 措辞开关:「Steam 库存与交易」整节以"发售时随附"为前提;**若发售时 `GULUGULU_STEAM` 集成仍关闭,提审前删除该节**(工坊节同理)。

## C. Store copy — English(默认语言)

### C1. Short description(≤300 chars,v2 2026-07-17)

> Your AI is coding. You? Watching a progress bar. Watch a duck instead. Gulugulu snacks on every token your Claude Code / Codex session burns — the money's spent anyway — and heckles in fluent AI: "You're absolutely right!" Hatch 63 species, let your AI hallucinate new ones, trade them on Steam.

### C2. About This Game(en,BBCode,v2 2026-07-17)

```
[h2]An idle game where the AI does the working and you do the idling[/h2]
The great occupational hazard of AI coding: your agent is busy, and you're just… supervising. Gulugulu fixes the supervising. A tiny transparent pet lives in the corner of your desktop and spectates your pair-programming: when the AI thinks, it poses dramatically; when the AI errors, it sighs before you do; every token your agent burns becomes duck food. The money was spent either way — at least now it feeds something.
[list]
[*]Reacts live to your local Claude Code / Codex sessions: thinking, coding, failing — full theater
[*]Keyboard charging (Windows): typing restores its stamina. It counts keystrokes only — never reads them
[*]Polite: it wanders away from your active window. Your IDE stays unblocked
[/list]

[h2]Can you play without any AI? Yes — and it won't lecture you[/h2]
Absolutely — and nothing will open with "As a large language model" to talk down to you. The actual game (click to work, stack coins, buy and hatch eggs, collect all 63 species, expand the backyard) needs zero AI: no internet, no API key, no CLI installed — the whole thing runs offline. Adding Claude Code / Codex is just extra seasoning: the duck reacts to your sessions and can hallucinate limited-edition species on the spot. Skip it, and it's a perfectly good ordinary duck in the corner of your screen — sleeping, begging for snacks, same as always. The AI is its side gig, not its landlord.

[h2]It learned everything wrong with AI, on purpose[/h2]
Unearned confidence. Compulsive apologizing. Working very hard in exactly the wrong direction. The duck has mastered all three virtues of the modern language model — except when it's hungry, it says so, which already makes it more honest than your agent. Run its stamina dry and it flops over mid-sentence: "You're absolutely right! …zzz" — like a model hitting its context limit.

[h2]Clicking: the last honest job[/h2]
The AI's tokens feed the duck XP; typing and idle time refill its stamina; you do the clicking. Click to work, earn coins, level up — combos pop, coins fly, zero thinking required. Thinking is the part you outsourced, remember? Spend it all in the backyard: buy eggs, hatch them (they keep incubating while the app is closed), expand the yard, hoard more little guys.

[h2]The Fusion Lab: hallucinations, but productive[/h2]
63 hand-designed species across 6 elements and 6 tiers, waiting to be collected. Fuse two max-level pets into something higher — and if you're lucky, your own local Claude Code / Codex CLI gets summoned to design a brand-new, one-of-a-kind creature on the spot. No API key, no cloud — just the CLI you're already logged into. Elsewhere, an AI hallucination costs you three hours of debugging. Here, it hands you a limited-edition pet. You do the math.

[h2]Workshop: your AI's taste, everyone's problem[/h2]
For every AI-designed species, the first player in the world to roll it shares that creature's look with everyone via Steam Workshop. That gloriously cursed little guy in someone else's Pokédex? Signed by your AI. Is it beautiful? You're absolutely right.

[h2]Steam Inventory & Trading[/h2]
Your creatures are real Steam inventory items: tradable and marketable (active once the game releases). No custom servers, no accounts — your save lives on your own machine.

[h2]Pet quotes (a sample)[/h2]
[quote]"As a large language model, I can't do your job. But I can watch you do it."[/quote]
[quote]"You're absolutely right! (falls asleep)"[/quote]
[quote]"I apologize for the confusion. The confusion was mine. The snacks are also mine."[/quote]
[quote]"Deep thought complete (8 seconds): it's lunchtime."[/quote]
[quote]"Bug detected. Suggested fix: feed duck, then debug."[/quote]

[h2]Privacy: it counts your keys, never reads them[/h2]
Keyboard charging counts keystrokes per second; the characters become a 250 ms keycap animation and are gone. Nothing logged, nothing stored, nothing uploaded. Whether your code is any good stays between you and your AI — and the AI's lips are sealed (or it just forgot).
```

⚠️ Same switch note as zh: remove the Inventory/Workshop sections if the Steam integration ships disabled.

## D. 基本信息表(后台"基本信息"tab)

| 字段 | 值 |
|---|---|
| 开发商 | **Mobi Studio** |
| 发行商 | **Mobi Studio** |
| 法律行(版权) | © 2026 Mobi Studio |
| 发行日期 | 占位 **2026 Q3**(提审前用户可改;最早发售 ≈ 2026-08-10 + Coming Soon ≥2 周) |
| 类型 | 休闲(主)+ 模拟 |
| 标签(向导,前 5 权重最高) | Creature Collector · Idler · Casual · Cute · Clicker · Life Sim · Simulation · Relaxing · 2D · Singleplayer · Colorful(以向导有效项为准) |
| 类别勾选 | 单人 Single-player + **Steam 创意工坊**(工坊配置见 G) |
| 支持语言 | 界面+完整支持:简体中文、英语;音频列全不勾(游戏无任何音频);其余语言不勾 |
| 支持邮箱 | **steamdev@mobigames.cn** |
| 支持 URL / 主页 | 暂空(GitHub 仓库转公开后可补——icon_url 待决项同源) |
| 成人内容 | 无 |

## E. 系统需求(仅 Windows)

| 项 | 最低 | 推荐 |
|---|---|---|
| OS | Windows 10 64 位 | Windows 11 |
| 处理器 | 双核 x64 | 四核 x64 |
| 内存 | 4 GB | 8 GB |
| 显卡 | 集成显卡 | 集成显卡 |
| DirectX | 11 | 11 |
| 存储 | 300 MB | 300 MB |

附注(zh):需要 Microsoft Edge WebView2 运行时(Windows 10/11 通常已内置,缺失时安装器自动安装)。"AI 融合"为可选玩法,需本机已安装并登录 Claude Code 或 Codex CLI。交易/市场功能需 Steam 客户端在线。
Notes (en): Requires the Microsoft Edge WebView2 runtime (preinstalled on most Windows 10/11 systems; the installer fetches it if missing). The optional "AI Fusion" feature requires a locally installed and logged-in Claude Code or Codex CLI. Trading/Market features require the Steam client online.

## F. 内容问卷 + AI 内容披露

问卷:无成人内容/无暴力/无赌博(蛋池为游戏内金币购买,金币仅由游玩产出,无真钱抽取)。

AI 披露(zh):
> 本游戏包含 AI 生成内容。(1) 预生成:部分物种美术、界面文案与宠物台词在开发中借助 AI 工具制作,均经开发者人工审核后收录。(2) 实时生成:"AI 融合"玩法调用玩家本机已安装并登录的 Claude Code 或 Codex CLI,在玩家发起融合时生成新物种的参数化形象(名称、配色、受限矢量部件)与幽默台词;所有输出经严格 JSON schema 校验(仅允许受限的矢量绘图参数,不允许自由图像或可执行内容),默认仅在玩家本机展示。启用创意工坊共享后,首个生成者的物种形象会对其他玩家可见;我们维护屏蔽清单并处理举报。游戏不内置任何在线 AI 服务,不需要 API key。

AI disclosure (en):
> This game contains AI-generated content. (1) Pre-generated: some creature art, UI text and pet quotes were created with AI assistance during development and reviewed by the developers. (2) Live-generated: the optional "AI Fusion" feature invokes the player's own locally installed Claude Code or Codex CLI to design new creatures (name, palette, restricted parametric vector parts) and humorous quotes when the player triggers a fusion. All output is validated against a strict JSON schema (restricted vector-drawing parameters only; no freeform images or executable content) and is shown only on the player's machine by default. With Workshop sharing enabled, the first generator's creature look becomes visible to other players; we maintain a blocklist and respond to reports. The game ships no online AI service and requires no API keys.

## G. 创意工坊配置(本次开启)

- Steamworks 设置 → Workshop → 启用**通用 ISteamUGC 工坊**(程序化 UGC:`steam_workshop.rs` 的 CreateItem/SubmitItemUpdate 流,petId KV 标签检索)。
- 工坊页标题/简介:
  - zh:「Gulugulu 创意工坊 —— AI 融合物种的全球图鉴。第一个掷出新物种的玩家,把它的形象留给全世界。」
  - en: "The global archive of AI-fused creatures — roll a new species first, and your AI's design becomes everyone's canon."
- 公开可见性随 Coming Soon/发售生效(用户点)。**发售前跟进(记入 05-release)**:内容审核义务——屏蔽清单托管 + 举报处理流程(00-decisions Feature 2 代价①);玩家首次上传需接受 Steam 工坊法律协议(UI 已有提示文案)。

## H. 截图清单(默认组=EN,简中组=ZH 覆盖;全部 1920×1080)✅ 已产出(2026-07-17)

| # | 镜头 | 内容 | 状态 |
|---|---|---|---|
| s1 | backyard_home | 后院全景:满员 10/10、孵化坑有蛋、融合提示气泡、金币 2.6m | ✅ en/zh |
| s2 | backyard_shop | 分阶商店弹窗(T4 蛋价 405k/506.3k、升级线) | ✅ en/zh |
| s3 | backyard_pits | 孵化坑特写(倒计时/待收光效/AI 生成态) | ✅ en/zh |
| s4 | backyard_dex | 图鉴全屏(27/63 进度、60% 概率徽章、Locked 槽) | ✅ en/zh |
| s5 | backyard_notice | 布告栏(Token 统计/每日爱心) | ✅ en/zh |
| s6 | pet_menu_closeup | 宠物+菜单 HUD 放大(桌宠形态,scale 2.6) | ✅ en/zh |
| s7 | desktop_hero | 真机透明宠趴在代码编辑器旁 | ⏳ 待真机(约时机+重编译) |

❌ **market 镜头弃用**:预览态显示"Steam 未连接"注记且行情价未走缩写格式——不上架(文件保留在 screenshots/ 供参考,上传时跳过)。上传时勾选"适合全年龄"。

抓图管线(可复现):`node scripts/capture_store_shots.mjs [--lang=] [--only=]` —— PORT=4189 自起 vite + Chrome `--headless=old`(new 模式 --window-size 含窗框,视口只剩 1904×984)+ `--virtual-time-budget`(dex 重视图 20000,其余 6000)+ 预热空拍(冷 vite 首镜头会超时)+ 单张 180s 超时。镜头参数由 `src/preview/shotParams.ts` 消化(`?ui/?panel/?lang/?seed/?shot`,仅预览模式生效)。

## I. 定价(后台"定价"页)

- 基础价 **USD 0.99**;中国区覆盖 **CNY 6**;其余区域接受 Valve 按美元的建议换算。
- 发售前复核一次区域价(汇率漂移)。

## J. 后台填写核对清单(执行时逐项打勾)

- [x] 基本信息 tab(D 表全部字段)+ 保存后回读 —— 2026-07-18 已填保存(URL 回 "Changes saved",回读校验:dev/pub=Mobi Studio、email、语言中英 supported、类型 4/28/23+primary 4、创意工坊 category_2+30、法律行、Win 系统需求全套)
- [x] 说明 tab:EN 默认(C1/C2)+ 简中本地化(B1/B2)—— 已随基本信息一起保存(shortEn 305 / aboutEn 3408 / aboutZh 1361 字符)
- [x] ⚠️ **2026-07-21 机制修订**:Token 改喂经验、不再回精力;B2/C2「点它 / Clicking」小节已按「AI 喂经验 · 敲键盘/挂机回精力 · 点击赚金币」重写 —— **2026-07-21 已同步进后台并保存**(zh「AI 负责回精力…」→「AI 烧的 token 喂它涨经验,敲键盘、挂机帮它回精力…」;en「The AI refills the duck's stamina…」→「The AI's tokens feed the duck XP; typing and idle time refill its stamina…」;回执 Changes saved,新旧稿冲突已清)。同批加入「没有 AI 能否玩 / Can you play without any AI?」新章节(置于「坏毛病 / everything wrong」章节前)
- [ ] 图形素材 tab:**用户手动拖入**(2026-07-18 决定;JS 注入机制已验证但 20+ 张 base64 逐张过对话不经济)。文件清单见下「L. 图片拖入清单」
- [ ] 截图 tab:同上,用户手动拖入 en/zh 两组
- [ ] 社区素材:184 JPG + 快捷方式图标(用户手动)
- [ ] 内容问卷 + AI 披露:框架已到位(无成人内容;生成式 AI=是),**AI 披露含版权侵权保证/内容审核策略等法律字段,宜用户本人确认**(参考文案见 F 节)
- [ ] 创意工坊页文案(G)保存 —— 待填(用户授权填草稿不发布)
- [ ] 定价(I)$0.99/¥6 保存 —— 待填(用户授权填草稿不发布)
- [ ] 商店页预览走查(zh/en)
- [ ] Checklist 全绿 → **停,交用户本人点提审**
- [ ] 全程不碰:「奇蛋生物」3950480、掉落参数(R8)、itemdefs

## K. 上传日志

- 2026-07-18 商店编辑器 `/admin/game/edit/1247252` POST `/admin/game/save/1247252`:基本信息+中英说明全量保存,回执 SuccessMsg "Changes saved",逐字段回读通过。
- 2026-07-18 图形素材上传技术勘察:合成 DragEvent/input.files 赋值/localhost 中转(fetch 与 `<img>`)全部被 Steam+浏览器安全策略封死;页面内部函数 `LoadImageFilesForUpload([File])` 是唯一注入通道(已验证:small_capsule 成功进预览、Steam 按尺寸自动锁类型 "Small Capsule")。但 20+ 张 base64 逐张过对话不经济 → 改用户手动拖入。

## L. 图片拖入清单(用户在「图像资产」tab 大拖放区拖入,Steam 按尺寸自动分类)

**商店资产(拖入即自动归类):**
- assets/steam-store/header_capsule.png(920×430 头图胶囊)
- assets/steam-store/small_capsule.png(462×174 小胶囊)
- assets/steam-store/main_capsule.png(1232×706 主胶囊)
- assets/steam-store/vertical_capsule.png(748×896 竖版)
- assets/steam-store/page_background.png(1438×810 页面背景,可选)

**库资产:**
- assets/steam-store/library_capsule.png(600×900)
- assets/steam-store/library_hero.png(3840×1240 无文字)
- assets/steam-store/library_logo.png(1280×720 透明)
- assets/steam-store/library_header.png(920×430)⚠️ 与头图胶囊同尺寸,拖后在类型下拉手动选「Library Header」区分

**截图(截图资产区;先传 en 默认组,再切简体中文语言传 zh 覆盖组):**
- screenshots/en/ 建议序:pet_working → backyard_home → backyard_shop → pet_sleeping → backyard_pits → pet_thinking → backyard_notice → pet_menu_closeup(8 张,≥5 即达标)
- screenshots/zh/ 同名 8 张(切到简体中文语言下上传)
- 备选不传:backyard_dex(面板截断感)、backyard_market(含未连接横幅)

**社区素材(社区素材页,非图像资产 tab):**
- assets/steam-store/community_icon_184.jpg(184×184 应用图标 JPG)
- assets/steam-store/shortcut_256.png / shortcut_512.png / gulugulu.ico(快捷方式图标)
