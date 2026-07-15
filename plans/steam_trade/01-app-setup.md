# WS1 · 创建应用与合作伙伴网站配置

状态:✅ 完成(2026-07-12;C13/C14 冒烟项移交 WS4)
执行方式:AI 在浏览器操作(用户已登录 partner.steamgames.com);👤 标记的步骤**必须用户本人**;所有"保存/发布/提交"类不可逆点击先经用户确认。

## 红线

- 支付、签署协议、输入密码/验证码:用户本人。
- 不创建任何 Web API key(本架构不需要)。
- 不做任何商店发布/可见性公开动作(WS5 冻结)。

## A. 创建应用(Steam Direct)

- [x] 1. 用户在浏览器登录 partner.steamgames.com(2026-07-11,账号 mobistudio / Shanghai Mobi Information Technology Co., Ltd,PartnerID 342361)
- [x] 2. 确认合作伙伴账号状态(2026-07-11):**入驻全部完成**——SDA 已签、税务/银行已填(newpartner 向导显示"您现已成为一名 Steamworks 合作伙伴");Dashboard 仅提示可选项(通讯地址/手机号)。发现已有未发布应用「奇蛋生物」App ID 3950480(免费包 1387457,商店清单已完成,原定 2025-11-03 未发布)——**用户决定不复用,为 Gulugulu 新建应用**(2026-07-11)
- [x] 3. 启动 Steam Direct 付费链路(2026-07-11,已到 store.steampowered.com 登录页,redirect=cart/payappsubmissionfee)
- [x] 4. 👤 用户完成 $100 支付(2026-07-11,应用额度 1 → 到账)
- [x] 5. 👤 签署 Steam 分发协议 —— 已签,无需再做(见步骤 2)
- [x] 6. 创建应用完成(2026-07-11):**App ID 4956830**,名称 Gulugulu,类型游戏,未勾免费;程序包 1720179/1720180/1720181,store item 1247252;已回填 00-decisions.md。技术备注:创建模态框因预览环境 rAF 挂起不渲染(display:none),打 rAF 垫片后用 `jQuery(btn).trigger('click')` 提交成功(后续会话遇到 Valve 模态框照此办理)

## B. 应用基础设置(App Admin,拿到 App ID 后)

- [x] 7. App Admin → 基本信息核对(2026-07-11:未发布/开发者可见,商店可见性未动)
- [x] 8. **启用 Inventory Service**(2026-07-11,`ajaxenableinventoryservice` 200);应用级掉落参数已设**测试值 5/10/5**(5 分钟游玩掉 1 个/窗口内最多 10 个/最小间隔 5 分钟,用户批准)。⚠️ 发布前必须收紧为生产值 45/2/120 —— 已列入 05-release.md 解冻清单。技术备注:三个字段共用 `ajaxsetappfield` 端点,**并发保存会互相覆盖(读-改-写竞态),必须逐个保存、间隔 ≥1 秒**
- [x] 8b. 发布 "policies" 配置节(2026-07-12,"Publishing successful!";Steam 确认未发布应用的变更仅应用所有者可见)。用户已给标准授权:未上线前的配置发布/上传免逐次确认(见 00-decisions.md 授权边界)。技术备注:发布流程=「准备发布」→ 确认码输入 `STEAMWORKS`(`input#confirmation` 有**重复 id 两处都要填**)+ 改动说明 →「完成发行」(jQuery trigger)
- [x] 9. 相关页面直达 URL(2026-07-11):库存服务 https://partner.steamgames.com/apps/inventoryservice/4956830 · 发布页 https://partner.steamgames.com/apps/publishing/4956830 · itemdefs 上传表单 POST /apps/inventoryserviceitemdefsupload/4956830/(file 字段名 `itemdefs`)· 应用落地页 /apps/landing/4956830
- [x] 10. 开发者账号许可确认(2026-07-11:创建时 "Added auto-grant to publisher",合作伙伴自动拥有)

## C. itemdefs 上传(依赖 WS3 产物,可由任意后续会话执行)

- [x] 11. 打开 https://partner.steamgames.com/apps/inventoryservice/4956830(2026-07-12)
- [x] 12. 上传 itemdefs.json 成功(2026-07-12):**"Modified 75/75 item definitions. Flushed Econ caches: yes"**——itemdefs 不走发布管线,上传即生效;发布页差异确认 "No uncommitted app data"。技术备注:页面表单 POST `/apps/inventoryserviceitemdefsupload/<appid>/`(multipart,file 字段 `itemdefs`,带隐藏 `sessionid`),可用页面内 fetch+FormData 自动化
- [ ] 13. 冒烟:`debug_steam_generate_items` 验证 def 可见、GetAllItems 正常(→ WS4-A1;需 Steam 客户端以拥有 4956830 的账号运行)
- [ ] 14. 早验 generator 行为:ExchangeItems(501-521 任一)确认开池按预期(→ WS4-A2)。⚠️ 观察项:上传回执里英文视图 `name` 显示为 name_english 值,中文名是否在中文区正确显示待 13 验证

## 笔记 / 阻塞记录

- 2026-07-11 环境事实:本会话内置浏览器截图超时(与项目记忆一致),操作全部走 read_page/get_page_text/javascript_tool 文本工具;Claude-in-Chrome 扩展未连接(如需用用户真实 Chrome 的已登录会话,需先安装并登录扩展:https://chromewebstore.google.com/detail/fcoeoabgfenejglbffodgkkbkcdhcgfn)。
- 2026-07-11 步骤 1 等待用户在内置浏览器窗格完成 partner.steamgames.com 登录(账号/密码/Steam Guard 均用户本人输入)。
