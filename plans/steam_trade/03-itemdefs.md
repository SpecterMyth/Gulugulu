# WS3 · 物品目录固化、生成脚本与图标

状态:✅ 完成(2026-07-12,主会话;上传已生效)
编号方案与旗标以 [00-decisions.md](00-decisions.md) 为准(101-106/201-221/301-321/401-406/501-521,共 75 条)。

## 完成摘要

- A:两份 config 注入 `steamItemDef`(27 物种,完全一致);`game_config.rs`/`types.ts` 镜像;`steam_item_defs_follow_frozen_numbering` 测试冻结编号 ✅
- B:`scripts/steam/generate_itemdefs.mjs` → `scripts/steam/out/itemdefs.json`(75 条:48 item + 6 playtimegenerator + 21 generator;二阶蛋 exchange 配方、同元素 `x2`;生成器 hidden、无 drop 字段——节流走应用级设置)✅
- C:27 张 256×256 透明底 PNG 图标 → `assets/steam-icons/<species>.png`;渲染脚本 `projects/gulugulu-app/scripts/render_steam_icons.tsx`(复跑:`npm install --no-save @resvg/resvg-js && npx tsx scripts/render_steam_icons.tsx`)✅
- D:上传成功 "Modified 75/75, Flushed Econ caches: yes"(2026-07-12)。**本次上传未带 icon_url**(图标尚未推送到 GitHub,raw 直链会 404)——推送图标后跑 `node scripts/steam/generate_itemdefs.mjs --with-icons` 重传即可(见待决清单)

## A. 目录固化(config 单一事实源)

- [ ] A1. `src/game/config.json` + `config.test.json`:每个 species 加 `steamItemDef` 字段;一阶按 elements 顺序 101-106;二阶按 fusionTable 键名字典序 201-221(**排序一经采用不可变**,先跑脚本打印映射表存档到本文件底部)
- [ ] A2. `game_config.rs` `SpeciesInfo` += `steam_item_def: u32`;`types.ts` 镜像
- [ ] A3. 扩展 `game_config.rs` 既有 `both_configs_parse` 测试:断言 75 条完整性、唯一性、蛋=宠+100、一阶生成器=宠+300、二阶生成器=蛋+200、fusionTable 与 exchange 配方一致

## B. 生成脚本

- [ ] B1. 新建 `scripts/steam/generate_itemdefs.mjs`:读 config.json → 产 `scripts/steam/out/itemdefs.json`(合作伙伴网站格式 `{"appid":<id>,"items":[...]}`);内容:中英文 name(`name_zh` + 物种码)、description、`icon_url`(raw.githubusercontent.com 直链)、旗标(宠物 tradable+marketable;蛋双 false;生成器 hidden)、`exchange` 配方(蛋=两材料,同元素 `x2`;二阶生成器=对应蛋)、playtimegenerator 参数(`drop_interval:45`、`use_drop_window:true`、`drop_window:120`、`drop_max_per_window:2`、**无 drop_limit**)
- [ ] B2. App ID 从 00-decisions.md 读取或 CLI 参数传入;WS1 未完成时可先用占位生成校验结构
- [ ] B3. 脚本幂等可重跑(config 变更后重新生成),输出 diff 提示

## C. 图标(icon_url 需公网 HTTPS)

- [ ] C1. 用现有 `scripts/render_sprites.tsx` + resvg 离线渲染管线(见项目记忆:preview_screenshot 在本项目超时,用离线渲染验收)渲 27 张宠物 PNG(建议 256×256 透明底)
- [ ] C2. 产物提交仓库(建议 `assets/steam-icons/<species>.png`);仓库已确认公开,直链格式 `https://raw.githubusercontent.com/SpecterMyth/Gulugulu/main/assets/steam-icons/<species>.png`
- [ ] C3. 蛋/生成器图标:蛋可复用宠物图标加蛋壳框或统一蛋图;生成器 hidden 可复用蛋图(仍需字段合法)

## D. 上传(依赖 WS1 App ID;操作规程见 01-app-setup.md C 节)

- [ ] D1. 上传 itemdefs.json 到 partner.steamgames.com/apps/inventoryservice/<AppID>(保存前经用户确认)
- [ ] D2. 上传后把最终 JSON 快照存 `scripts/steam/out/itemdefs.uploaded.<date>.json` 入仓库(审计/回滚用)

## itemdefid 映射表(2026-07-12 已上传生效,不可变存档)

宠物 def(蛋=+100,孵化生成器=+300,一阶掉落生成器=+300 仅一阶):
101 guluduck · 102 emberfox · 103 voltmouse · 104 bubblefrog · 105 sproutcap · 106 frostpeng
201 thunderking · 202 plasmatanuki · 203 vinevolt · 204 auroramink · 205 sparkduck · 206 stormeel · 207 infernofox · 208 cinderleaf · 209 thermowolf · 210 blazeduck · 211 steamander · 212 mycobeast · 213 frostbunny · 214 mossduck · 215 lotusturtle · 216 glacierpeng · 217 frostduck · 218 floeseal · 219 guluswan · 220 rippleduck · 221 tidefrog

## 笔记 / 阻塞记录

(执行时追加)
