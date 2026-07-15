# 物种美术规范 v2 与两段式生产管线（57 只定制 rig）

> 状态：P0 定稿。定稿日期 2026-07-14。
> 关联：[FusionSystem.md](FusionSystem.md)（规则）· [SpeciesMatrix.md](SpeciesMatrix.md)（全谱设定）· 进度 `plans/fusion_species/01-progress.md`。
> 生产顺序（用户拍板）：**先全部静态形象 → 用户逐只确认 → 才开始动画**。

## 1. 通用规格（与 6 只一阶同规，逐条为硬约束）

| 项 | 规范 |
|---|---|
| 画布 | `viewBox="0 0 256 256"`，地面线 y=233，水平中心 x=128，底部中心锚点 (128,233) |
| 部件契约 | 所有会动的组包 `<Part name=...>`（`parts/common.tsx`）；**Part 元素自身绝不带 `transform` 属性**（CSS transform 会覆盖），摆位放外层 `<g transform>` |
| 必备部件（正面） | `body`（根）·`tail`（再小也要有，4 个状态会动它）·`headtop`·`armL/armR`（肩部枢轴）·`legL/legR`（髋部枢轴；漂浮种可免，改 `floating`）·`<g class="part-face">` 包住脸·工具锚 `<Part name="tool">` |
| 状态动画 | 14 个 PetState 全由 `sprites.css` 现有关键帧按部件名驱动，**每只物种零新增 CSS**；物种微调只走 `cssVars`（`--stride-dur/--stride-deg/--hop-h/--bob-px`） |
| 表情 | 眼/嘴统一走 `ExpFace`/`ExpSideFace`（`parts/faces.tsx`，9 表情按状态自动切换=每个动作自动换夸张表情）；有喙/长嘴物种用 `withMouth={false}` 自绘表情联动嘴（参考 duck `billMode`） |
| 移动 | **右向侧视构图**（左移由 CSS `scaleX(-1)` 镜像，`styles.css:270`）；侧视禁止文字/可读字形；不对称礼装需镜像后仍成立 |
| 睡眠 | **专属趴卧构图**（蜷/摊/窝/卷…见矩阵"睡姿"列），禁止压扁站姿；CSS 只叠呼吸起伏+Zzz |
| 风格 | 可爱优先；扁平填充+描边 `#3B2B1D`（身体 6 / 中件 4.5~5 / 细节 2~3.5）；**禁用渐变**（多精灵同屏 SVG id 泄漏，旧 `auroramink-band` 即反例）；`defs` id 必须 `codename-` 前缀 |
| 脸部净空 | 任何装饰不得遮挡眼/嘴盒——礼装只"框脸"不"盖脸" |
| 缩放 | 按最终尺寸直接绘制，`scale` 只留 ±10% 微调；高帽/长角别顶出画布（Steam 图标裁切不留情面） |

## 2. Species Pack 架构（一物种一文件）

```
src/sprites/species2/
  types.ts            # SpeciesPack 契约
  index.ts            # 57 个 import + 派生注册表（唯一的全批次共同触点，append-only）
  e2/<codename>.tsx   # 15 只（二元素）
  e3/<codename>.tsx   # 20 只
  e4/<codename>.tsx   # 15 只
  e5/<codename>.tsx   # 6 只
  e6/prismkirin.tsx   # 1 只
```

- `SpeciesPack = { rig, visual, tool, workFx, meta }`：rig 组件、视觉行（palette/eyes/foodAnchor/shadowRx/floating/cssVars）、工具渲染器（toolId = codename）、粒子 spec、QA 元数据（toolAnchor/nodeBudget）。
- `index.ts` 派生 `RIGS2 / TOOLS2 / WORK_FX2 / VISUALS2`，四处各一行 merge：`SvgSprite.tsx` RIGS、`speciesTable.tsx` getSpeciesVisual 查找链（SPECIES_VISUALS→VISUALS2→custom→config 兜底）、`parts/tools.tsx` TOOLS、`parts/workFx.tsx` WORK_FX（fx 全屏窗口同 bundle，零额外接线）。
- `SpeciesVisual.rig` 由 `RigKind` 放宽为 `string`；`BODY_TO_RIG` 仅旧路径保留；新物种 config `body` = codename。
- **新 rig 单比例**：不再有 baby/kid 分支（一 rig 一物种）；`stage` 固定 `"kid"` 并忽略。三构图调度：`view==="side"→Side`、`pose==="lie"→Lie`、否则 `Front`。
- 行数预算/只：e2 ≈320-400 · e3 ≈360-450 · e4 ≈420-520 · e5 ≈480-580 · e6 ≈650-750；节点预算（QA 强制）：e2 130 / e3 170 / e4 220 / e5 270 / e6 340 标签。
- 打包体量评估：57 × ~400 行 ≈ 2.2~2.6 万行 TSX（约 150-200KB gzip），桌面端本地加载一次性解析 <100ms，**不做懒加载**（后院全员同屏 + fx 窗口共用注册表）。

## 3. 共享底件（Batch 0 先行，全部新文件在 `src/sprites/parts/`）

1. `limbs.tsx`——NubArm/LongArm/WingArm/FlipperArm（枢轴=肩）、PawLeg/StubLeg/TallLeg/HoofLeg（枢轴=髋）、`SideLegPair`（侧视双腿样板，最易出错的枢轴一次写对）。
2. `bodies.tsx`——EggHead（推广 duck 头样条）、BeanBody（正/侧豆身+肚皮补丁）、ProneMound（趴卧土丘参数件）。
3. `ornaments.tsx`——华丽度阶梯词汇：Horn/AntlerPair/CrestPlume/NeckRuff/CrownTier/GemInlay/OrbitOrbs（配 `.part-orbit`）/AuraRing/RegaliaArc/ElementPips（元素徽排）。
4. `anchors.ts`——GROUND_Y/CX/SHADOW_CY/DEFAULT_TOOL_ANCHOR + `place(x,y,rot?,scale?)`。

元素签名件继续复用现有 kits（FlameTail/IceSpikes/BoltTail/Spout 等）——bespoke 成本花在剪影上，元素识别度靠 kits。

## 4. 华丽度阶梯（元素数驱动，与阶数无关）

| 元素数 | 装饰预算 |
|---|---|
| 2 | 本体 + 2~3 个元素点缀（斑纹/颊饰/尾饰） |
| 3 | + 1 件背饰或平台件（backpack/尾屏/浮冰…） |
| 4 | + 环绕件（OrbitOrbs 轨道珠 / AuraRing 光环） |
| 5 | + 多层礼装（RegaliaArc/流苏/冠冕） |
| 6 | 全要素盛装（prismkirin：棱镜角+六色鬃+云纹蹄环+背光带+六徽） |

## 5. 两段式生产（对应 P2 / P3）

**Stage-Image（P2，静态形象）**：每只先只做 `Front` 构图——完整 Part 包裹、槽位锚、工具几何、palette、foodAnchor；`Side`/`Lie` 暂以 `Front` 兜底占位（app 全程可运行）。产出物 = 契合矩阵设定的静态正面形象 + 工具，进入评审。

**P2-Gate（用户确认）**：contact sheet（普通 + 纯剪影两版）输出到 `assets/species_review/`，用户逐只确认或打回；结论记录进 `plans/fusion_species/01-progress.md` 的"用户确认"列。**确认后 codename/形象冻结**。

**Stage-Anim（P3，动画）**：补 `Side`（右向）与 `Lie`（矩阵睡姿列的专属构图），落 `WORK_FX` 粒子 spec，DebugPanel 全状态联调。

## 6. 一次性 CSS（仅 Batch 0 触碰 `sprites.css`）

- **阶数光圈**：`SvgSprite` 增 `tier?: number` prop；`GradeHalo` 组件（`parts/common.tsx`）在影子层旁渲染双椭圆描边环，`tier>=2` 显示；`grade-ring-expand` 关键帧循环扩散渐隐（双环相位差半拍）；色表 2 青碧 `#6FD3A6` / 3 湛蓝 `#5AA9F0` / 4 绛紫 `#B07DE8` / 5 鎏金 `#F5C542` / 6 六色棱光；`prefers-reduced-motion` 降级为静态单环。离线渲染脚本不传 tier → Steam 图标不受影响。
- **通用装饰类**（状态无关循环，`orn-` 前缀关键帧）：`.part-orbit`（360° 慢旋 ~9s）、`.part-aura`（透明度+微缩放脉动）、`.part-crest`（±4° 摇摆）、`.part-banner`（旗帜波动）；睡眠/力竭时 orbit 减速。装饰类独占自己的 `<g>`，不与状态 `part-*` 同元素（一元素一动画）。

## 7. 工具与粒子 authoring 清单（每只必查）

- 工具：局部坐标，枢轴 (0,0)=握点/触地点，向上绘制，40~64px 高，≤12 节点，30% 缩放下仍可读；只在 working/laboring/success 显示（现有 CSS 免费）。
- WorkFx：`emitter` = 正面视图工具尖端（与 `meta.toolAnchor` 距离 ≤40px，QA 校验）；`baseAngle` 背离身体（典型 −π/2 ± π/6）；`cone` 0.4~0.8；**恰好 2~3 个形状渲染器**，每个 ≤6 节点，**必须描边**（fx 全屏窗口透明铺在用户桌面上，浅色壁纸下无描边即隐形）；文字字形须加底框（codeChip 先例）。
- **粒子 = 工具产物（硬规则）**：2~3 个粒子里 **≥2 个必须是「手中工具的直接产物」**（笔电→代码符号、焊枪→焊花+螺母、打印机→纸片+墨点、显微镜→细胞+镜片反光…），**≤1 个**才可作元素点缀（雪花/火星/电花）；产物用**工具/材料固有色**（非宠物体色）。跨物种共享的元素点缀（boltBit/dropBit/snowBit…）飞满屏易读成"千篇一律、与工具无关"——这正是本规则要防的。
- 目录 27 件工具（一阶 6 + legacy 21 的工具全集）的产物规格集中在 `parts/workFx.tsx` 的 **`TOOL_FX`**（一阶 6 只、legacy、AI 融合都从它派生）；手作 57 只在各自 pack 内 co-author `workFx`，同守上条规则。三处（`App.tsx`/`FxOverlay.tsx`/`WorkBurst`）统一走 **`resolveWorkFx(species, toolId, customFx)`** 解析，顺序：物种自带 → `TOOL_FX[toolId]` → AI 自绘。
- **AI 融合物种**：`toolId` **必填**（`fusion_gen.rs` 校验拒绝无工具的设计），提示词按 `fusionParts.json` 的 `toolFxHints` 注入每件工具的产物提示，硬约束"粒子=所选工具的产物"；AI 缺/空粒子时 `getCustomWorkFx` 退回 `TOOL_FX[toolId]` 的工具产物（不再是通用星/泡/心）。
- 全屏路径零接线：`App.tsx` 与 `FxOverlay.tsx` 查同一张合并后的 `WORK_FX` 表 + `TOOL_FX`；屏幕模式粒子上限 30、射程 ~4.2×，靠形状多样性而非数量堆华丽。

## 8. QA 管线

1. `scripts/render_contact_sheet.tsx`（新）——遍历 PACKS ∪ 一阶，按元素数分行嵌 128px 格 + codename 标签，resvg 出 PNG；`--silhouette` 把所有填充刷成 `#3B2B1D` 出纯剪影版（两两区分度评审的关键物料）；默认状态 `idle,working`（P3 后加 `moving,sleeping`）。
2. `scripts/check_species_assets.ts`（新，exit 1 门禁）——注册闭包（PACKS ↔ config 双向、无键冲突）；Part 名 lint（必备部件齐、Part 无 transform 属性、id 前缀唯一）；几何（emitter/foodAnchor 在合理区、节点预算）；tool/workFx/visual 齐备。
3. 渲染冒烟：全物种 × 全状态 renderToStaticMarkup 非空非抛错（沿用 `render_steam_icons.tsx` 的失败计数模式）。
4. 动画离线验收：静态渲染无 CSS——"Part 名 lint 通过"即"14 态动画全绑定"的证明；动效抽查走 DebugPanel（物种×状态网格）+ computed style（`animationName`）读取，**不用截图**（本项目 preview 截图会超时，见既往经验）。
5. `package.json` 增 `qa:sprites` / `qa:sheet` 脚本。

## 9. 批次与 DoD（批次分配与状态见 `plans/fusion_species/01-progress.md`）

- **Batch 0（基建，阻塞一切）**：species2 骨架 + 共享底件 + 一次性 CSS + QA 脚本 + `species2/STYLE.md` 风格契约 + **2 只试点**（1 只 e2 + 1 只 e4）端到端走通模板定标。
- 生产批次按"主导元素聚类、元素数混编"分组（配色相近的物种同批画，区分度压力最大化）：B1 电系 → B2 火系 → B3 水系 → B4 草系 → B5 冰系 → B6/B7 跨系混编 → B8 五元素 6 只 → B9 六元素旗舰 + 全谱终审。P2 与 P3 复用同一分组。
- **每批 DoD**：`npm run build` 绿；`check_species_assets` 绿；渲染冒烟绿；**累计** contact sheet（普通+剪影）人审两两区分度；工具在 working 渲染可见；节点预算达标；零新增 CSS。
- 旧 21 物种行/工具的删除与图鉴计数收尾放 P4（等引擎 config 切换后一并清理）。

## 10. 风险备忘

1. 10+ 会话风格漂移 → Batch 0 试点定标 + STYLE.md 契约 + 共享底件 + 每批累计 contact sheet。
2. 兜底遮蔽错误 → `getSpeciesVisual` 的 config 兜底会把漏注册渲染成元素色团子，check 脚本双向闭包必须常绿。
3. 同屏性能 → 后院最多 8 只 + 主宠 + 缩略图；变换走 `transform-box: fill-box` 合成层，预算内无虞；如未来吃紧再上 `.sprite-still`（缩略图停动画）。
4. fx 窗口预算 → 粒子数/节点上限不放宽，e6 的华丽靠形状与 boom 环。
5. 侧视镜像 → 不对称礼装（如 gargoylite 导游旗）镜像后语义仍需成立，评审时专查。
