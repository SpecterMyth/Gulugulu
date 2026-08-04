# Gulugulu Steam 宣传片(代码化舞台)

一支写成代码的 Steam 宣传片:复用游戏**真实的 SVG 精灵 + `sprites.css` 动画 + 物种目录**,
把 6 段分镜串成一条 1920×1080 时间线,在浏览器里真实播放 → 用 OBS 录一遍即成片。
预览专用,**不进 Tauri 产品包**(Tauri 只加载 `index.html`;这里是独立的 `trailer.html` 入口)。

- 时长 ~61s(中英各自按字幕自动算出);每行字幕**打完停留 1 秒**再走下一行
  (`ui.tsx` 的 `CAP_HOLD`,想更慢就调大)。英文口语化;v1 无配乐(录完后配 BGM)。
- 字幕/场景时长全部由 `layoutCaps()` 从打字时长派生 —— 改文案无需手调时间轴。
- 字幕**一行不换行**(`.cap-line/.cap-sub/.title-main` 有 `white-space:nowrap`);
  文案已控制在一行内的长度,改文案时别写太长(中文 ≤~16 字、英文 ≤~40 字)。
- 7 段顺序:冷开场 → 实时反应(USP)→ **键盘喂养** → 多样性收集 → **AI 创作(重头)**
  → 创意工坊+交易 → 尾卡(CTA「Search "Gulugulu" on Steam!」)。
- 生物 100% 是游戏真实渲染(`SvgSprite`),周围场景/字幕/特效为宣传片专用。
- 风格:打字机(**介绍字幕逐字** + 标题出字;代码窗为静态道具,不打字)、极客过场
  (RGB 裂像 + 数据mosh 条 + 密扫描线 + 终端解码字)、融合炫丽爆闪、全局扫描线+暗角。
  收尾**定格 CTA 不切黑**。字幕分段用 `S()`/`H()`(纯文本;**勿写 `&rsquo;` 等 HTML 实体**,
  打字机不解码,直接用 Unicode 字符 ’ — …)。
- ⚠️ 舞台 CSS 类一律 `tr-` 前缀(如 `.tr-speech`):`src/styles.css` 有同名 `.speech`
  等会串样式。新增舞台元素务必用独有类名或 `tr-` 前缀。

## 两个语言版本(分别录制)

同一套动画/时间线/特效,靠 `?lang=` 切文案与排版;英文为默认,两版都要各录一遍:

- **英文版**:`http://localhost:5173/trailer.html`
- **中文版**:`http://localhost:5173/trailer.html?lang=zh`

文案表在 `copy.ts`(`COPY.en` / `COPY.zh`);语言开关/打字速度在 `lang.ts`;中文排版走
`trailer.css` 的 `.lang-zh` 规则(重体黑体保冲击力,字标/气泡用 ZCOOL 圆润体,打字机放慢)。
代码窗内容永远英文(代码就是代码);中文标点用全角。

## 录屏(约 5 分钟出片,每个语言版各一遍)

1. `npm run dev`(Vite :5173)。
2. **真实 Chrome**(非 IDE 里的预览面板,面板对本项目会挂)打开
   `trailer.html`(英)或 `trailer.html?lang=zh`(中),`F11` 全屏。
3. **关掉系统「减少动态效果」**(设置 → 辅助功能 → 视觉效果 → 动画效果)。
   否则 `sprites.css` 的 `prefers-reduced-motion` 规则会隐藏精灵的元素粒子。
4. OBS / ShareX 录制 1920×1080 @60,约 61s 一条过;掐头去尾。
5. 后期配一条免版权 BGM(+可选音效),导出 MP4(H.264 High / 1080p / AAC)。
6. 经 Steamworks 上传到 App **4956830** 商店页的 trailer 位。
   ⚠️ Steam 强烈建议带音轨——**上架前务必先配 BGM**。

页面自带底部进度条 + `⟲ Replay` 按钮(录制时可加 `?clean=1` 隐藏控件)。

## URL 参数

| 参数 | 作用 |
|---|---|
| (无) | 从 0 实时播放到结尾,停在尾卡 |
| `?loop=1` | 循环播放 |
| `?clean=1` | 隐藏进度条/Replay/HUD(录制/截图用) |
| `?beat=<0..5>` | 从第 N 段起播(迭代单段用);段序见下 |
| `?t=<毫秒>` | 冻结在某时刻的静帧(截图验收用,不跑时钟) |

段序:`0` cold-open · `1` 实时反应 · `2` 融合 · `3` 收集 · `4` Steam/工坊 · `5` 桌面公民+尾卡。

## 分帧验收(绕开会挂的预览面板)

`scripts/capture_trailer.mjs`(仿 `capture_store_shots.mjs`,零依赖 headless Chrome):

```
node scripts/capture_trailer.mjs                       # 13 张关键静帧(?t 冻结)
node scripts/capture_trailer.mjs --only=b2_fusion_born  # 只截某帧
```

产物写 `.claude/scratchpad/trailer/`(不入库)。每帧校验为 1920×1080。

> 只出 `?t` 冻结静帧:**无头 Chrome 会把 rAF/定时器节流到近乎停止**,无法截到实时
> 播放。要看实时播放,在**真机可见的 Chrome 标签页**里打开(rAF 天然 60fps),也就是
> 录屏的环境。

## 结构

- `trailer.html` → `src/trailer/main.tsx` → `TrailerPlayer`。
- `TrailerPlayer.tsx` — 场景表 + 主时钟 + 1080p 舞台 letterbox 适配。
- `timeline.ts` — 时基锚在挂载时刻的 rAF 时钟(真机/虚拟时钟皆正确)。
- `scenes.tsx` — 6 段分镜(字幕文案取自 `plans/steam_trade/06-store-page.md`)。
- `MockIde.tsx` — 假 IDE 面板(cold-open / 实时反应 / 桌面公民段)。
- `ui.tsx` — 记忆化精灵、字幕层、标题卡、仿桌面、从真实目录派生的物种名单。
- `trailer.css` — 全部样式(木盒品牌色 + 英文重体圆润无衬线)。

## 后续 / 未做

- 配 BGM + 音效;中文字幕版。
- 可选:把「实时反应」段换成一段真机实拍(app 挂在真 IDE 上跑真 Claude Code 会话)以求最强真实感。
- 可选全自动出片:在 `capture_trailer.mjs` 的虚拟时钟上加逐帧扫描 + ffmpeg 编码。
