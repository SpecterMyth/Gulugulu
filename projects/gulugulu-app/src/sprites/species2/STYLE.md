# species2 风格契约（每批开工前重读；违者返工）

> 设定事实源：`docs/gdd/SpeciesMatrix.md`。规范全文：`docs/gdd/SpeciesArtSpec.md`。本文是作画时的速查卡。

## 画布与构图
- viewBox 256×256；**地面 y=233**、中心 x=128（用 `parts/anchors.ts` 常量与 `place()`）。
- 站姿脚底/底缘压在 233；漂浮物种底缘 ≈208~216 并设 `visual.floating: true` + `shadowRx` 调小。
- **头身占比参考婴儿比例**（分头身的物种头占高度 ≥50%，宽度接近或略小于身体——参考 guluduck/emberfox；团状/低趴/构装等特殊形态除外）。
- **画面利用率**：内容包围盒长边 ≥170（硬线 150，栅格实测门禁）；构图为主，`scale` 允许 1.0~1.3 做提档（围绕 (128,233) 缩放，工具/发射点随缩放，check 按缩放后锚点校验）。
- 高帽/长角顶点 y ≥ 14（Steam 图标裁切安全区）；缩放后仍不得触边（栅格边缘检测）。

## 部件契约（14 态动画免费的前提）
- 根：`<Part name="body" origin="50% 100%">` 包住一切。
- 必备 Part：`tail`（再小也要有）、`headtop`、`armL`+`armR`（origin 肩部 ≈"50% 8%"）、`legL`+`legR`（origin 髋上 ≈"50% -30%"；floating 可免）、`<g className="part-face">` 包脸、工具 `<Part name="tool" origin="50% 100%">`（外层 g 定位到 meta.toolAnchor）。
- **Part 元素自身绝不带 transform**；放置一律外层 `<g transform={place(...)}>`。
- 层序习惯：tail/back → 后腿/后饰 → 身体 → 腿/手 → 头 → 脸 → headtop → tool。
- 装饰环绕件包 `part-orbit`/`part-aura`/`part-crest`/`part-banner`（自己的 g，不与状态 part 同元素）。

## 脸
- 眼嘴一律 `ExpFace`（默认 round 眼；happy/sleepy 按性格）；长嘴/喙物种 `withMouth={false}` 自绘嘴并按 expression 联动（张嘴表情：happy/star/surprised 开，munch 咀嚼）。
- 脸部净空：装饰不遮眼嘴盒；腮红 `Blush` 或元素颊（SparkCheeks 等）。

## 颜色与描边
- 扁平填充；描边统一 `OUTLINE #3B2B1D`：身体 6 / 中件 4~5 / 细节 2~3.5。
- **禁 `<defs>`/渐变/filter**；同一形状避免超过 3 层叠色。
- 元素色：一般 #6E6E78 · 火 #E85D3A · 电 #FFD93B · 水 #2E7BD6 · 草 #57B84C · 冰 #8FD8E8（辅助浅色参考 kits）。
- palette 五槽都要填（body/deep/belly/accent/accent2），工具可用 palette 取色。

## 华丽度阶梯（元素数）
- e2：本体 + 2~3 元素点缀；e3：+1 件背饰/平台；e4：+环绕件（OrbitOrbs/AuraRing）；e5：+多层礼装（RegaliaArc/冠冕/流苏）；e6：全要素盛装。
- 节点预算（QA 强制，含装配器共享开销≈35）：e2 165 / e3 205 / e4 255 / e5 305 / e6 380 个标签（rig 本体请按 130/170/220/270/340 自控）。

## 工具与粒子
- 工具：pivot=(0,0)=握点/落地点，向上作画，高 40~64px，≤12 个节点，30% 缩放可读。
- workFx.emitter = 工具尖端（距 meta.toolAnchor ≤48px）；baseAngle 背离身体；cone 0.4~0.8；**恰好 2~3 个形状**、每个 ≤6 节点、必须有描边（透明桌面上无描边即隐形）。

## Stage-Image（当前阶段）
- 只做 Front；rig 调度器里 side/lie 分支直接返回 Front（P3 再补）。
- 每只收工自检：渲染无报错、剪影与全谱已完成者拉得开、表情清晰、工具在 working 可见。
