# 皮肤系统与创意工坊分享（Skin Workshop）

> 状态：已实施（2026-07-18，存档 v6）。
> 关联：[FusionRecipeSlots.md](FusionRecipeSlots.md)（AI 变种槽位阶梯，本文的「物种」即其 1~10 号槽）·
> [FusionSystem.md](FusionSystem.md)（融合 2.0 双轴模型）·
> [PokedexSystem.md](PokedexSystem.md)（图鉴展示，本文详情弹窗挂在其格子上）·
> [plans/steam_trade/00-decisions.md](../../plans/steam_trade/00-decisions.md)（Feature 2 工坊 UGC 决策，本文对其做「皮肤化」修订）。
>
> 本文取代「首个上传者胜 = 全局唯一形象」的旧模型：首发只是**一款皮肤**，本地生成优先。

## 1. 一句话与设计目标

> **每个 AI 融合物种都可以换装：默认配方形态、自己 AI 生成的形象、好友分享的皮肤、首发上传者的形象，图鉴里一键切换。**

旧模型里每个 `aif` 槽位全球只有一张脸（resolve 命中即跳过本地生成）——玩家的 AI 永远没机会给自己画一只。本次改版把「外观」从「物种身份」解耦：物种身份（codename/图鉴/Steam itemdef）不变，外观变成四源可切换的皮肤。

## 2. 四源皮肤

| 源 | skinSelected 取值 | 数据 | 获取 |
|---|---|---|---|
| 默认 | `"default"` | 虚拟源（不落表）：同元素组合的 0 号固定配方物种形态。将来换成专门生成的默认皮肤时只改一处解析（前端 `resolveDefaultCodename` / 覆盖表 redirect） | 恒可用（配方有固定物种即可） |
| 本地 | `"local"`（缺省值 = 删键） | `custom_species[codename].visual`（本体形象） | CLI 生成 |
| 工坊皮肤 | `"ws:<fileId>"` | `species_skins[codename][]`（含上传者元数据） | 分享文本导入 / 上传者列表安装 |
| 首发 | 同上（source=`"first"`） | 同上；工坊兜底复用时自动入库 | 上传者列表里最早者（pick_earliest 口径） |

**换肤粒度 = 按物种统一**（用户拍板 2026-07-18）：图鉴里给该物种选一个皮肤，该物种所有个体、所有场景（舞台/后院/图鉴/博物馆缩略图）统一生效。存档只存一张 `skin_selected: codename → 选择` 表。

**先入库**（用户拍板 2026-07-18）：收到好友分享但尚未融合出该物种 → 允许导入，皮肤先进 `species_skins`（图鉴神秘槽显示「皮肤×N」徽章），获得该物种后才可选用。**不解锁物种本体、不动图鉴进度**（无进度绕过）。

## 3. 生成顺序翻转（本地优先 + always-publish）

`fusion_gen::process_job` 的顺位改为：

1. **CLI 可用 → 一律本地生成**（工坊已有该槽形象也不跳过——他人首发只是可选皮肤）；成功后 `origin="local"` 入档并**一律发布**到工坊（即使不是首发，自家皮肤也要有自己的条目供分享/上传者列表）。
2. CLI 不可用 / 素材收集失败 / 生成全败 → **工坊兜底复用**：下载首发形象作为本体（`origin="workshop"`），顺带把它连同上传者元数据记为「首发皮肤」，并记 `workshop_published=""`（形象来自他人，本机放弃上传）。
3. 兜底也落空 → failed，蛋按原规则孵出兜底物种。

**出处防线**：`CustomSpeciesEntry.origin`（`"local"`/`"workshop"`/None=v6 前存量不可知）。补传扫描（backfill）只对 `origin="local"` 直接上传；存量 None 与工坊下载维持旧行为（resolve 查重、命中记 `""`）——**绝不把他人设计当自家作品重发布**。分享/补发布按钮同守此线。

## 4. 分享协议

- **分享文本**（`get_skin_share_text`，仅当 `workshop_published[codename]` 为真 fileId）：
  `【咕噜咕噜】皮肤分享：<名字> https://steamcommunity.com/sharedfiles/filedetails/?id=<fileId> （复制整段文本，在游戏图鉴点「导入皮肤」粘贴即可）`
- **导入**（`import_skin_from_text`）：无 deep-link，纯粘贴流。解析规则：steamcommunity URL 的 `id=` 数字优先；兜底全文**恰好一个** 6~20 位独立数字串（歧义拒收）。物种归属**以物品的 `petId` KV 标签为准**。
- **校验管线**（任何路径不写 `custom_species`）：大小 ≤256KB → petId 存在且形态合法 → schema 兼容（None/"1"）→ 反序列化 → `validate_custom_visual`（不可信 UGC 几何防线）→ 目录物种撞名拒收。重复导入幂等成功（`duplicate=true`，元数据刷新）。
- 工坊在 Partner 站为「unlisted」：分享 URL 的网页可能不可见，但 API 照常可导入——文案引导「复制到图鉴导入」而非「打开网页」。

## 5. 上传者列表（图鉴子界面）

`list_skin_uploaders`：按 `petId` 标签跨页查询（`RankedByPublicationDate` 新→旧，**必须翻到尾页**才能正确标首发；≤4 页×50 条）全部工坊条目，带回每条的 SteamID64、昵称（best-effort：好友/缓存直读 + `RequestUserInformation` 限时 5s 预算，拿不到回落显示 SteamID）、创建时间、标题、预览图 URL。最早者（`pick_earliest`：time_created 最小、并列 fileId 小者胜）标「首发」；已收藏标 installed；本机账号标「我」。任一条可「安装」入库（不自动选中）。

## 6. 数据模型（存档 v6）

```
GameSave（v5 → v6 迁移：纯版本推进，不回填 origin、不动 "" 认领标记）
├─ species_skins: codename → Vec<SpeciesSkin>     // 按 publishedFileId 去重，封顶 20/物种
│    SpeciesSkin { id:"ws:<fileId>", visual, nameZh, authorSteamId, authorPersona?,
│                  publishedFileId, timeCreated, importedAt, source:"first"|"shared" }
├─ skin_selected: codename → "default"|"local"|"ws:<fileId>"   // 缺省键 = local
└─ custom_species[*].origin: "local"|"workshop"|None(存量)
```

前端解析（`getSpeciesVisual` 链头插皮肤覆盖表，16 处渲染点零改动全局生效）：
`registerSkinState(save, config)` 构建 codename → 覆盖（default=redirect 到固定物种；ws=buildVisualFromSpec；坏数据/悬空选择一律回落 local）。`SvgSprite` 另有显式 `visual` prop 供皮肤卡并排预览；**工坊设定图离屏渲染强制走本体形象**（防止换肤后自己的工坊缩略图被盖成别人的画）。

## 7. 图鉴 UI

- 图鉴格子可点 → **物种详情弹窗**（z=21，Esc 栈：对话框→详情→图鉴）：左列活体预览台（idle→working→success→fed 轮播）+ 名称/描述/信息药丸（曾获/在养/诞生/亲代/生成器）；右列（仅已收集 AI 变种）四源皮肤卡（默认/本地/首发/分享徽章 + 「使用」）+ 工坊上传者列表（首发/我/安装/刷新，离线降级提示）+ 「复制分享文本 | 上传我的皮肤 | 导入皮肤」。
- 固定物种 = 信息型弹窗（无皮肤区）；未收集 = 黑影 + 概率/锁定文案；神秘槽有先入库皮肤时显示只读缩略图行。
- 图鉴头部常驻「导入皮肤」钮（未连 Steam disabled）；导入成功 toast + 自动跳转对应物种详情（神秘槽也能跳，按确定性 codename 定位）。
- 图鉴内操作反馈走浮层 toast（后院头顶气泡被图鉴浮层遮挡）。
- 旧随机 hex codename 槽位：与确定性 petId 身份对不上，工坊分区隐藏（防皮肤装进「隐形」收藏）。

## 8. 命令与错误键

`select_species_skin` / `list_skin_uploaders` / `install_species_skin` / `import_skin_from_text` / `get_skin_share_text` / `publish_own_skin`（守卫 `origin="local"`）。错误一律 `#skin*` 消息键（i18n/messages.ts zh+en）。

## 9. 验证

- `cargo test`：迁移 v6 / 选择规则 / 去重封顶 / 导入不注册物种 / serde 往返 / 分享文本解析矩阵 / 上传者排序标注 / 翻页边界 / backfill 出处分叉。
- `node scripts/verify_skins.mjs`：前端解析链（default/local/ws / 悬空回落 / visual 覆盖护栏）。
- `node scripts/verify_pokedex.mjs`：确定性 codename / 图鉴定位 / 默认皮肤解析。
- 预览：`/?ui=backyard&panel=dex&seed=rich&steam=on`（`?wsfail=1` 错误态、`?wsempty=1` 空态、去掉 `steam=on` 离线降级）。
- 真机：`steam_smoke::workshop_resolve_roundtrip`（详情带 petId 标签与 owner 断言已扩展）。
