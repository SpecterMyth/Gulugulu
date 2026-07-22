// Steam itemdefs 构建核心 —— 纯函数、零依赖、浏览器可 eval(不引 node API)。
//
// 同一份代码既被 generate_itemdefs.mjs 用来写 out/itemdefs.json,也被注入
// partner 站页面在浏览器内重建同一目录后 POST 上传 —— 以此保证「repo 目录 ↔
// live 目录」零漂移(2026-07-16 冒烟已证上传是 merge/upsert 语义)。
//
// 编号规则(plans/steam_trade/00-decisions.md + FusionSystem.md §9,一经上传不可回改):
//   一阶宠物 101..106 · 旧二阶宠物 201..221 · 旧二阶蛋 +100 · 旧孵化生成器 蛋+200
//   一阶掉落生成器 宠+300 · 新多元素固定宠 601..657(601+recipeOrdinal)
//   AI 变种占位 10000+ord*100+slot · **并集融合生成器 20000+ord(2026-07-16 新增)**
//   **商店蛋生成器 21000+tier*10+(一阶宠def−100)(2026-07-16 新增,24 条)**
//
// 2026-07-16 起目录承载完整融合/商店上架语义(00-decisions「用户拍板(2026-07-15/16)」):
//   · 每只宠(canonical 633)带 `set:<集合键>;sp:<codename>` 标签 +
//     `exchange:"sp:<codename>*2"` 同物种确定升阶(消耗 2 → 铸 1,净 −1)。
//   · legacy 201-221 带映射标签(set=其元素集合键、sp=该键的 canonical codename),
//     无 exchange —— 旧物品可作融合材料并经同种升阶收敛为 canonical 物品。
//   · 并集生成器:exchange 枚举「A∪B = S」全部无序对(set:A,set:B;对角 set:S*2),
//     bundle = 0 号固定 + 10 AI 槽的加权池(全局池,P0=1−A(e)、槽内几何衰减)。
//     6 元素 364 条 ≈ 20.4KB,真机上传已验收(2026-07-16)。
//   · 商店生成器:playtimegenerator + drop_interval:0/drop_window:1440/
//     drop_max_per_window:<eggDailyMintCaps[tier-1]> —— 24h 窗口服务器强制每日上限、
//     窗口内可 burst;bundle = 「含该元素 ∧ 元素数≤阶」canonical 物种按 denom^(6−c) 加权。
//   · 一阶掉落生成器 401-406 不带 per-def drop 字段(沿用应用级设置,与商店窗口独立)。
export function buildItemdefs(seed) {
  const {
    withIcons,
    iconBase,
    elementOrder,
    elementsZh,
    species, // [{codename, def, tier, elements[], nameZh, desc}]
    speciesByRecipe,
    fusionTable,
    eggDailyMintCaps,
    aiTotalChanceByElementCount,
    eggRarityFalloffDenom,
  } = seed;

  // ---- 槽位身份(与 fusionSlots.ts / fusion_slots.rs 镜像) ----
  const AI_ITEM_DEF_BASE = 10000;
  const UNION_GEN_BASE = 20000;
  const SHOP_GEN_BASE = 21000;
  const MAX_AI_SLOTS = 10;
  const recipeElementCount = (r) => r.split("+").length;
  const multiElementRecipesOrdered = (keys) =>
    keys
      .filter((k) => recipeElementCount(k) >= 2)
      .sort((a, b) => {
        const ca = recipeElementCount(a);
        const cb = recipeElementCount(b);
        return ca !== cb ? ca - cb : a < b ? -1 : a > b ? 1 : 0;
      });
  const fixedItemDef = (ord) => 601 + ord;
  const aiItemDef = (ord, slot) => AI_ITEM_DEF_BASE + ord * 100 + slot;
  const unionGenDef = (ord) => UNION_GEN_BASE + ord;
  const slotCodename = (ord, slot) => `aif${String(ord).padStart(2, "0")}${String(slot).padStart(2, "0")}`;
  const setKey = (elements) => Array.from(new Set(elements)).sort().join("+");

  const byDef = new Map();
  for (const s of species) {
    if (!s.def) throw new Error(`species ${s.codename} missing def`);
    if (byDef.has(s.def)) throw new Error(`duplicate def ${s.def}`);
    byDef.set(s.def, s);
  }
  const tier1DefForElement = (element) => {
    const hit = species.find((s) => s.tier === 1 && s.elements[0] === element);
    if (!hit) throw new Error(`no tier-1 species for element ${element}`);
    return hit.def;
  };

  const items = [];
  const push = (item) => items.push(item);
  const canonical = new Set(Object.values(speciesByRecipe));
  const icon = (codename) =>
    withIcons && canonical.has(codename)
      ? { icon_url: `${iconBase}/${codename}.png`, icon_url_large: `${iconBase}/${codename}.png` }
      : {};

  // ---- 本地化:英语=默认(基础字段);中文=schinese ----
  const titleCase = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const loc = (field, english, locals = {}) => {
    const out = { [field]: english };
    for (const [lang, value] of Object.entries(locals)) {
      if (value != null && value !== "") out[`${field}_${lang}`] = value;
    }
    return out;
  };
  const zhRecipe = (recipe) => recipe.split("+").map((e) => elementsZh[e] ?? e).join("+");
  const petDisplayEn = (s) => (s.tier === 1 ? "Base Pet" : s.tier === 2 ? "Fused Pet" : `${s.elements.length}-Element Pet`);
  const petDisplayZh = (s) => (s.tier === 1 ? "一阶精灵" : s.tier === 2 ? "二阶精灵" : `${s.elements.length}元素精灵`);

  // ---- 宠物标签/自升阶(00-decisions「用户拍板(2026-07-15)」) ----
  // canonical(tier 1 或新 57):set=自身集合键、sp=自身 codename、exchange=sp:*2。
  // legacy(tier 2):set=元素集合键、sp=该键 canonical codename(收敛式材料),无 exchange。
  const petTagsAndExchange = (s) => {
    const key = setKey(s.elements);
    if (s.tier === 2) {
      const mapped = speciesByRecipe[key];
      if (!mapped) throw new Error(`legacy ${s.codename}: no canonical for ${key}`);
      return { tags: `set:${key};sp:${mapped}` };
    }
    return { tags: `set:${key};sp:${s.codename}`, exchange: `sp:${s.codename}*2` };
  };

  // --- 宠物(101-106 + 201-221 + 601-657):可交易 + 可上市场 ---
  for (const s of [...byDef.values()].sort((a, b) => a.def - b.def)) {
    push({
      itemdefid: s.def,
      type: "item",
      ...loc("display_type", petDisplayEn(s), { schinese: petDisplayZh(s) }),
      ...loc("name", titleCase(s.codename), { schinese: s.nameZh }),
      ...loc("description", `Gulugulu creature · elements: ${s.elements.join(", ")}.`, { schinese: s.desc }),
      ...icon(s.codename),
      tradable: true,
      marketable: true,
      ...petTagsAndExchange(s),
    });
  }

  // --- 旧二阶蛋(绑定)+ 旧孵化生成器(21 legacy 配方,冻结) ---
  const fusionKeys = Object.keys(fusionTable).sort();
  for (const key of fusionKeys) {
    const codename = fusionTable[key];
    const s = species.find((x) => x.codename === codename);
    const petDef = s.def;
    const eggDef = petDef + 100;
    const genDef = eggDef + 200;
    const [ea, eb] = key.split("+");
    const [da, db] = [tier1DefForElement(ea), tier1DefForElement(eb)].sort((x, y) => x - y);
    const exchange = da === db ? `${da}x2` : `${da},${db}`;
    push({
      itemdefid: eggDef,
      type: "item",
      ...loc("display_type", "Fusion Egg", { schinese: "融合蛋" }),
      ...loc("name", `${titleCase(codename)} Egg`, { schinese: `${s.nameZh}蛋` }),
      ...loc("description", `Fusion egg (${key}). Account-bound.`, {
        schinese: `由 ${key} 融合而来的蛋（绑定，不可交易）。`,
      }),
      ...icon(codename),
      tradable: false,
      marketable: false,
      exchange,
    });
    push({
      itemdefid: genDef,
      type: "generator",
      name: `${codename} hatch generator`,
      bundle: `${petDef}`,
      exchange: `${eggDef}`,
      hidden: true,
    });
  }

  // --- 一阶掉落生成器(playtimegenerator;应用级掉落参数,与商店窗口独立) ---
  for (const element of elementOrder) {
    const petDef = tier1DefForElement(element);
    const s = byDef.get(petDef);
    push({
      itemdefid: petDef + 300,
      type: "playtimegenerator",
      name: `${s.codename} drop generator`,
      bundle: `${petDef}`,
      hidden: true,
    });
  }

  // --- AI 融合变种占位(570):可交易 + 可上市场 + set:/sp: 标签 + 自升阶 ---
  // 每个 AI 槽用带序号的占位图(_aislot_<recipe>_<slot>.png),让 Steam 库存里同一
  // 配方的 10 个槽肉眼可辨(render_steam_icons.tsx 出这 570 张)。
  const aiIcon = (recipe, slot) => {
    if (!withIcons) return {};
    const url = `${iconBase}/_aislot_${recipe.replaceAll("+", "-")}_${slot}.png`;
    return { icon_url: url, icon_url_large: url };
  };
  const orderedRecipes = multiElementRecipesOrdered(Object.keys(speciesByRecipe));
  for (let ord = 0; ord < orderedRecipes.length; ord += 1) {
    const recipe = orderedRecipes[ord];
    for (let slot = 1; slot <= MAX_AI_SLOTS; slot += 1) {
      const code = slotCodename(ord, slot);
      push({
        itemdefid: aiItemDef(ord, slot),
        type: "item",
        ...loc("display_type", "AI Fusion Variant", { schinese: "AI 融合变种" }),
        ...loc("name", `AI Variant ${slot} · ${recipe}`, { schinese: `AI 变种${slot} · ${zhRecipe(recipe)}` }),
        ...loc(
          "description",
          `AI fusion variant, slot ${slot} of recipe ${recipe}. Appearance is contributed via Steam Workshop (earliest publisher wins).`,
          { schinese: `${recipe} 配方的第 ${slot} 号 AI 变种槽（形象/名字由首个生成者经创意工坊上传认领）。` },
        ),
        ...aiIcon(recipe, slot),
        tradable: true,
        marketable: true,
        tags: `set:${recipe};sp:${code}`,
        exchange: `sp:${code}*2`,
      });
    }
  }

  // --- 并集融合生成器(57,20000+ord):exchange 枚举全部并集对,bundle 加权 11 槽 ---
  const gcd2 = (a, b) => (b === 0 ? a : gcd2(b, a % b));
  const subsetsOf = (elements) => {
    const out = [];
    const n = elements.length;
    for (let m = 1; m < 1 << n; m += 1) {
      const sub = [];
      for (let i = 0; i < n; i += 1) if (m & (1 << i)) sub.push(elements[i]);
      out.push(setKey(sub));
    }
    return [...new Set(out)].sort();
  };
  for (let ord = 0; ord < orderedRecipes.length; ord += 1) {
    const recipe = orderedRecipes[ord];
    const elements = recipe.split("+");
    const count = elements.length;
    // exchange:所有无序对 {A,B}(A,B ⊆ S 非空、A∪B = S);对角 = set:S*2。
    // 顺序:子集键字典序双循环 i≤j —— 确定性,verify 逐位复算。
    const subs = subsetsOf(elements);
    const recipes = [];
    for (let i = 0; i < subs.length; i += 1) {
      for (let j = i; j < subs.length; j += 1) {
        if (setKey([...subs[i].split("+"), ...subs[j].split("+")]) !== recipe) continue;
        recipes.push(i === j ? `set:${subs[i]}*2` : `set:${subs[i]},set:${subs[j]}`);
      }
    }
    // bundle:P(0)=1−A(e)、槽 i=A/2^i(i=1..9)、槽 10=A/2^9(尾部合并);
    // 通分 ×512 → w0=(100−a)*512、w_i=a*2^(9−i)、w10=a,再除 GCD。
    const a = Math.round((aiTotalChanceByElementCount[String(count)] ?? 0) * 100);
    const weights = [(100 - a) * 512];
    for (let i = 1; i <= 9; i += 1) weights.push(a * (1 << (9 - i)));
    weights.push(a);
    const g = weights.reduce((x, y) => gcd2(x, y));
    const fixedDef = fixedItemDef(ord);
    const bundle = [
      `${fixedDef}x${weights[0] / g}`,
      ...Array.from({ length: MAX_AI_SLOTS }, (_, i) => `${aiItemDef(ord, i + 1)}x${weights[i + 1] / g}`),
    ].join(";");
    push({
      itemdefid: unionGenDef(ord),
      type: "generator",
      name: `union generator ${recipe}`,
      bundle,
      exchange: recipes.join(";"),
      hidden: true,
    });
  }

  // --- 商店蛋生成器(24 = 6 元素 × 1..4 阶,21000+tier*10+(一阶def−100)) ---
  // 24h 窗口服务器强制每日上限(EconomyScaling.md §7.5)。⚠️ 2026-07-16 真机实证:
  // `drop_window` **不是 per-def 字段**(上传即被剥,非零也一样)→ 窗口在合作伙伴网站
  // **应用级**设置(最大授予频率 = 1440);per-def 只写 `drop_interval:1`(1 分钟游玩
  // ≈即领,与 TriggerItemDrop ~1次/分节流对齐;0 会被当默认剥掉回退应用级)+
  // `drop_max_per_window` = eggDailyMintCaps[tier−1](全 ≤10 Steam 硬上限,已验存留)。
  const denom = Math.max(1, eggRarityFalloffDenom ?? 3);
  for (let tier = 1; tier <= eggDailyMintCaps.length; tier += 1) {
    for (const element of elementOrder) {
      const t1def = tier1DefForElement(element);
      const pool = [...byDef.values()]
        .filter((s) => s.tier !== 2 && s.elements.includes(element) && s.elements.length <= tier)
        .sort((a, b) => a.def - b.def);
      const bundle =
        pool.length === 1
          ? `${pool[0].def}`
          : pool.map((s) => `${s.def}x${denom ** (6 - s.elements.length)}`).join(";");
      push({
        itemdefid: SHOP_GEN_BASE + tier * 10 + (t1def - 100),
        type: "playtimegenerator",
        name: `shop generator t${tier} ${element}`,
        bundle,
        drop_interval: 1,
        drop_max_per_window: eggDailyMintCaps[tier - 1],
        hidden: true,
      });
    }
  }

  items.sort((a, b) => a.itemdefid - b.itemdefid);
  return items;
}
