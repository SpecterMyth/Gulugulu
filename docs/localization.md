# Gulugulu 多语种工作流

## 当前语言范围

应用语言注册表位于 `projects/gulugulu-app/src/i18n/core.ts`，目前提供 21 个设置选项：英语、简体中文、繁体中文、日语、韩语、法语、德语、西班牙语（西班牙）、西班牙语（拉丁美洲）、葡萄牙语（巴西）、葡萄牙语（葡萄牙）、俄语、意大利语、波兰语、土耳其语、乌克兰语、阿拉伯语、泰语、越南语、印度尼西亚语和荷兰语。

语言 ID 使用 BCP-47。旧版 `zh` 设置会自动迁移为 `zh-Hans`；系统语言只在用户从未明确选择语言时参与首次探测。阿拉伯语使用 RTL 布局。

翻译原则是按地区重写语气和游戏梗，而不是逐句直译。例如西班牙与拉美西语、巴西与葡萄牙葡语分别使用当地常见的口语、称谓、节奏和标点。品牌名、产品名、占位符、技术要求和隐私承诺必须保持语义稳定。

## 完整性与验证

- 语言下拉列表、设置与状态 UI、托盘菜单、数字和日期格式覆盖 21 种语言。
- 工坊核心词表覆盖 21 种语言。
- `npm run verify:i18n` 检查语言注册表、键、占位符、Steam 草稿和物品定义。
- `npm run verify:i18n:strict` 把英语/近似英语兜底、目标文字系统缺失、占位符或专名损坏、替代方框和异常重复膨胀视为发布阻断项。
- 只有严格校验通过并完成人工母语审校后，才能把对应语言对外宣称为完整界面支持。

## Steamworks 映射

应用提供 21 种语言，其中 20 种映射到当前 Steam Inventory/商店本地化语言代码；阿拉伯语目前仅作为应用内语言维护。完整语种映射见 `scripts/steam/localization/language-support.json`。

Steam 的语言声明与商店文案是两套独立状态。当前经典商店文案编辑器和“所有语言”JSON 导入仍没有阿拉伯语文本字段，因此：

- 阿拉伯语可以勾选为游戏界面语言；
- 阿拉伯语商店长文案、短简介、系统需求和抢先体验问答暂时无法在该经典编辑器中单独提交；
- 不应伪造一个经典商店文案字段来替代平台尚未提供的字段。

相关文件：

- `scripts/steam/localization/language-support.json`：21 种界面语言声明与 Steam 代码。
- `scripts/steam/localization/store-copy.json`：18 种新增经典商店语言的本地化文案；英语和简体中文沿用既有内容。
- `scripts/steam/localization/store-details.json`：系统需求与抢先体验问答的地区化文本。
- `scripts/steam/localization/itemdefs.json`：Steam 库存可见物品的本地化名称、类型与说明。
- `scripts/steam/build_store_localization_upload.mjs`：生成受白名单保护的商店文案上传包。
- `scripts/steam/build_store_details_upload.mjs`：生成系统需求与抢先体验问答候选上传包。Steam 经典导入器不会接收其中所有动态本地化字段，上传后必须逐项回读。

## Steam 当前后台状态

- 商店页必需清单：已完成。
- 游戏构建必需清单：已完成，已进入审核队列。
- 21 种应用内界面语言；其中 20 种有 Steam 平台语言映射，均不声明完整音频或字幕。
- 商店长文案、短简介和法律/关于文本：经典编辑器支持的目标语言已上传。
- Windows 最低配置：目标经典商店语言已上传。
- Windows 推荐配置、抢先体验问答：英语、简体中文已有内容；法语抢先体验六项已逐项保存。其余动态多语言字段不被经典 JSON 导入器接收，不能只凭上传文件判定完成。
- 商店页和应用更改：保持未公开发布；不得在本地化流程中触发“公开发布”“准备发布”或提交新的审核操作。
- 截图：本轮按要求暂不上传。

## 发布前检查

```powershell
cd projects/gulugulu-app
npm run verify:i18n
npm run verify:i18n:strict
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
```

更新 Steam 商店草稿时，先从 Steamworks 导出最新的“所有语言”JSON，再构建上传包：

```powershell
node scripts/steam/build_store_localization_upload.mjs --base "C:\path\to\storepage_1247252_all.json"
node scripts/steam/build_store_details_upload.mjs --base "C:\path\to\storepage_1247252_all.json"
```

上传后必须重新导出或逐字段回读：目标语言应与生成文件一致，英语和简体中文必须与上传前逐字段一致。最后由母语审校人员在 Steam 商店测试模式检查换行、标点、截断、RTL 和文化语境，再进入发布流程。
