// 物种/元素的跨语言显示:zh 真源在 config.json(nameZh/desc),en 目录名与
// Steam itemdefs 英文名同规则(TitleCase codename,见 scripts/steam/build_itemdefs_core.mjs)。
// SPECIES_EN_DESC 是 63+21 目录物种的英文图鉴文案表(内容与 zh 同调性,非直译)。
//
// AI 融合物种(isAiCodename)有专有名,不走 TitleCase:生成器产出 nameEn/descEn 并随
// 存档持久化(SpeciesInfo.nameEn/descEn,镜像 Rust game_config::SpeciesInfo)。存量条目
// (nameEn 空)由后端启动本地推导回填、CLI 可用时再升级(见 fusion_gen.rs 英文名回填)。
// 加语种时:元素/目录名在此文件补表;AI 专名只有 zh/en 两源(nameZh/nameEn),第三语种
// 需扩展生成器产出与本地兜底,或退回 en 名。

import { isChineseLanguage, migrateLegacyLanguageMap, type Language } from "./core";
import { GENERATED_RUNTIME_LOCALES } from "./generatedLocales";
import { CURATED_SPECIES_NAMES } from "./speciesNames";

export const ELEMENT_NAMES: Record<Language, Record<string, string>> = migrateLegacyLanguageMap({
  zh: { normal: "一般", fire: "火", electric: "电", water: "水", grass: "草", ice: "冰" },
  en: { normal: "Normal", fire: "Fire", electric: "Electric", water: "Water", grass: "Grass", ice: "Ice" },
  "zh-Hant": { normal: "一般", fire: "火", electric: "電", water: "水", grass: "草", ice: "冰" },
  ja: { normal: "ノーマル", fire: "ほのお", electric: "でんき", water: "みず", grass: "くさ", ice: "こおり" },
  ko: { normal: "노말", fire: "불꽃", electric: "전기", water: "물", grass: "풀", ice: "얼음" },
  fr: { normal: "Normal", fire: "Feu", electric: "Électrik", water: "Eau", grass: "Plante", ice: "Glace" },
  de: { normal: "Normal", fire: "Feuer", electric: "Elektro", water: "Wasser", grass: "Pflanze", ice: "Eis" },
  "es-ES": { normal: "Normal", fire: "Fuego", electric: "Eléctrico", water: "Agua", grass: "Planta", ice: "Hielo" },
  "es-419": { normal: "Normal", fire: "Fuego", electric: "Eléctrico", water: "Agua", grass: "Planta", ice: "Hielo" },
  "pt-BR": { normal: "Normal", fire: "Fogo", electric: "Elétrico", water: "Água", grass: "Planta", ice: "Gelo" },
  "pt-PT": { normal: "Normal", fire: "Fogo", electric: "Elétrico", water: "Água", grass: "Planta", ice: "Gelo" },
  ru: { normal: "Обычный", fire: "Огонь", electric: "Электричество", water: "Вода", grass: "Растение", ice: "Лёд" },
  it: { normal: "Normale", fire: "Fuoco", electric: "Elettro", water: "Acqua", grass: "Erba", ice: "Ghiaccio" },
  pl: { normal: "Zwykły", fire: "Ogień", electric: "Prąd", water: "Woda", grass: "Roślina", ice: "Lód" },
  tr: { normal: "Normal", fire: "Ateş", electric: "Elektrik", water: "Su", grass: "Bitki", ice: "Buz" },
  uk: { normal: "Звичайний", fire: "Вогонь", electric: "Електрика", water: "Вода", grass: "Рослина", ice: "Лід" },
  ar: { normal: "عادي", fire: "نار", electric: "كهرباء", water: "ماء", grass: "نبات", ice: "جليد" },
  th: { normal: "ธรรมดา", fire: "ไฟ", electric: "ไฟฟ้า", water: "น้ำ", grass: "พืช", ice: "น้ำแข็ง" },
  vi: { normal: "Thường", fire: "Lửa", electric: "Điện", water: "Nước", grass: "Cỏ", ice: "Băng" },
  id: { normal: "Normal", fire: "Api", electric: "Listrik", water: "Air", grass: "Tumbuhan", ice: "Es" },
  nl: { normal: "Normaal", fire: "Vuur", electric: "Elektrisch", water: "Water", grass: "Plant", ice: "IJs" },
});

export function elementName(element: string, lang: Language): string {
  return ELEMENT_NAMES[lang]?.[element] ?? element;
}

/** 配方键(如 "fire+water")→ 本地化元素连写("火+水" / "Fire + Water")。 */
export function recipeLabel(key: string, lang: Language): string {
  const parts = key.split("+").map((e) => elementName(e, lang));
  return lang.startsWith("zh") ? parts.join("+") : parts.join(" + ");
}

export function titleCaseCode(code: string): string {
  return code ? code.charAt(0).toUpperCase() + code.slice(1) : code;
}

/** AI 变种 codename(新式 aif0503 / 旧式 aif+6hex)。 */
export function isAiCodename(code: string): boolean {
  return /^aif[0-9a-f]{4,6}$/i.test(code);
}

/**
 * Translation-friendly source names for every authored species in config.json.
 * English keeps the established codename branding; the locale generator uses
 * these semantic names so other languages receive real names instead of an
 * unchanged portmanteau such as `Bubblefrog` or `Prismkirin`.
 */
export const SPECIES_EN_NAMES: Record<string, string> = {
  guluduck: "Gulu Duck",
  emberfox: "Ember Fox",
  voltmouse: "Thunder Mouse",
  bubblefrog: "Bubble Whale",
  sproutcap: "Sprout Mushroom",
  frostpeng: "Frost Beast",
  guluswan: "Gulu Swan",
  infernofox: "Inferno Fox",
  thunderking: "Thunder Mouse King",
  tidefrog: "Tidal Whale",
  mycobeast: "Mushroom Forest Beast",
  glacierpeng: "Glacier Beast King",
  blazeduck: "Blazing Feather Duck",
  sparkduck: "Spark Duck",
  rippleduck: "Ripple Duck",
  mossduck: "Moss Feather Duck",
  frostduck: "Frost Feather Duck",
  plasmatanuki: "Plasma Fox",
  steamander: "Steam Whale",
  cinderleaf: "Cinder Mushroom",
  thermowolf: "Thermal Frost Wolf",
  stormeel: "Storm Whale",
  vinevolt: "Electric Vine Mouse",
  auroramink: "Aurora Mink",
  lotusturtle: "Lotus Whale",
  floeseal: "Ice Floe Beast",
  frostbunny: "Frost Bunny Mushroom",
  weldbug: "Welding Bug",
  voltquill: "Electric Leaf Hedgehog",
  aurowl: "Aurora Owl",
  zapbun: "Static Bunny",
  voltmare: "Thunder Seahorse",
  chilizard: "Chili Lizard",
  onsenmonk: "Hot Spring Monkey",
  waxlamb: "Candle Flame Lamb",
  steamalotl: "Steam Axolotl",
  pinefawn: "Snow Pine Deer",
  potturtle: "Flowerpot Turtle",
  lilyfrog: "Lotus Leaf Frog",
  snowcub: "Snowball Bear",
  icejelly: "Ice Crystal Jellyfish",
  sudsotter: "Bubble Bath Otter",
  pyrepeacock: "Firework Peacock",
  stormdrake: "Storm Dragon",
  rockrooster: "Rock Music Rooster",
  boilshrimp: "Boiling Shrimp",
  glowhum: "Glowing Hummingbird",
  windmole: "Windmill Mole",
  glowfly: "Glowing Firefly",
  waddleskate: "Ice Skating Penguin",
  frostangler: "Frost Lantern Fish",
  maildove: "Messenger Dove",
  seasonleon: "Four Seasons Dragon",
  toastybara: "Warm Capybara",
  bobamingo: "Bubble Tea Flamingo",
  lattegolem: "Latte Snowman",
  saunapuff: "Sauna Pufferfish",
  ramencoon: "Ramen Raccoon",
  yarncat: "Yarn Cat",
  terrasnail: "Moss Shell Snail",
  scaresprout: "Little Scarecrow",
  bowlrus: "Ice Walrus",
  lanternloong: "Lantern Parade Dragon",
  discobloom: "Dancing Sunflower",
  juicepitcher: "Honey Pitcher Plant",
  mochipop: "Bursting Mochi",
  meteoropus: "Cloud Octopus",
  grillgator: "Barbecue Alligator",
  chimebell: "Wind Chime Flower",
  frostclione: "Sea Angel",
  mistyox: "Grain Rain Ox",
  subhermit: "Submarine Hermit Crab",
  teapir: "Matcha Tapir",
  brewbat: "Potion Bat",
  porkchef: "Chef Pig",
  spadolphin: "Hot Spring Dolphin",
  snowbonsai: "Snow Bonsai",
  liondance: "Lion Dance",
  manacorn: "Spirit Unicorn",
  queenbuzz: "Queen Bee",
  gargoylite: "Little Gargoyle",
  crystalwing: "Crystal Dragonfly",
  claypango: "Terracotta Pangolin",
  prismkirin: "Crystal Kirin",
};

/** Reviewed short-name overrides where sentence translation models are weak. */
export const SPECIES_NAME_OVERRIDES: Partial<Record<Language, Record<string, string>>> = {
  "zh-Hant": {
    rippleduck: "漣漪鴨",
    saunapuff: "桑拿河豚",
    frostclione: "海天使",
  },
  ja: {
    guluduck: "グルダック", emberfox: "エンバーフォックス", voltmouse: "サンダーマウス", bubblefrog: "バブルクジラ",
    sproutcap: "芽吹きキノコ", frostpeng: "霜雪獣", guluswan: "グルスワン", infernofox: "インフェルノフォックス",
    thunderking: "サンダーマウスキング", tidefrog: "タイドクジラ", mycobeast: "キノコ森獣", glacierpeng: "氷河獣王",
    blazeduck: "炎羽ダック", sparkduck: "スパークダック", rippleduck: "さざ波ダック", mossduck: "苔羽ダック",
    frostduck: "霜羽ダック", plasmatanuki: "プラズマフォックス", steamander: "蒸気クジラ", cinderleaf: "残り火キノコ",
    thermowolf: "熱霜オオカミ", stormeel: "嵐クジラ", vinevolt: "電気ツルネズミ", auroramink: "オーロラミンク",
    lotusturtle: "蓮葉クジラ", floeseal: "浮氷獣", frostbunny: "霜ウサギキノコ", weldbug: "溶接ムシ",
    voltquill: "電気葉ハリネズミ", aurowl: "オーロラフクロウ", zapbun: "静電ウサギ", voltmare: "サンダータツノオトシゴ",
    chilizard: "トウガラシトカゲ", onsenmonk: "温泉ザル", waxlamb: "ろうそく羊", steamalotl: "蒸気ウーパールーパー",
    pinefawn: "雪松ジカ", potturtle: "植木鉢ガメ", lilyfrog: "蓮葉ガエル", snowcub: "雪玉グマ",
    icejelly: "氷晶クラゲ", sudsotter: "泡風呂カワウソ", pyrepeacock: "花火クジャク", stormdrake: "嵐ドラゴン",
    rockrooster: "ロックオンドリ", boilshrimp: "沸騰エビ", glowhum: "光ハチドリ", windmole: "風車モグラ",
    glowfly: "光ホタル", waddleskate: "スケートペンギン", frostangler: "霜灯魚", maildove: "伝書バト",
    seasonleon: "四季ドラゴン", toastybara: "ぽかぽかカピバラ", bobamingo: "タピオカフラミンゴ", lattegolem: "ラテ雪だるま",
    saunapuff: "サウナフグ", ramencoon: "ラーメンアライグマ", yarncat: "毛糸ネコ", terrasnail: "苔殻カタツムリ",
    scaresprout: "ちびカカシ", bowlrus: "氷セイウチ", lanternloong: "灯籠パレードドラゴン", discobloom: "ダンスヒマワリ",
    juicepitcher: "ハニーツボ草", mochipop: "はじけモチ", meteoropus: "雲ダコ", grillgator: "バーベキューワニ",
    chimebell: "風鈴花", frostclione: "海天使", mistyox: "穀雨ウシ", subhermit: "潜水艦ヤドカリ",
    teapir: "抹茶バク", brewbat: "ポーションコウモリ", porkchef: "シェフブタ", spadolphin: "温泉イルカ",
    snowbonsai: "雪盆栽", liondance: "獅子舞", manacorn: "精霊ユニコーン", queenbuzz: "女王バチ",
    gargoylite: "ちびガーゴイル", crystalwing: "水晶トンボ", claypango: "赤陶センザンコウ", prismkirin: "水晶キリン",
  },
  ko: {
    guluduck: "굴루오리", emberfox: "불씨여우", voltmouse: "천둥쥐", bubblefrog: "거품고래", sproutcap: "새싹버섯", frostpeng: "서리괴수",
    guluswan: "굴루백조", infernofox: "지옥불여우", thunderking: "천둥쥐황제", tidefrog: "파도고래", mycobeast: "버섯숲괴수", glacierpeng: "빙하괴수왕",
    blazeduck: "불꽃깃오리", sparkduck: "불꽃오리", rippleduck: "물결오리", mossduck: "이끼깃오리", frostduck: "서리깃오리", plasmatanuki: "플라즈마여우",
    steamander: "증기고래", cinderleaf: "잉걸불버섯", thermowolf: "열서리늑대", stormeel: "폭풍고래", vinevolt: "전기덩굴쥐", auroramink: "오로라밍크",
    lotusturtle: "연잎고래", floeseal: "유빙괴수", frostbunny: "서리토끼버섯", weldbug: "용접벌레", voltquill: "전기잎고슴도치", aurowl: "오로라부엉이",
    zapbun: "정전기토끼", voltmare: "천둥해마", chilizard: "고추도마뱀", onsenmonk: "온천원숭이", waxlamb: "촛불양", steamalotl: "증기우파루파",
    pinefawn: "눈소나무사슴", potturtle: "화분거북", lilyfrog: "연잎개구리", snowcub: "눈덩이곰", icejelly: "얼음수정해파리", sudsotter: "거품목욕수달",
    pyrepeacock: "불꽃놀이공작", stormdrake: "폭풍용", rockrooster: "록수탉", boilshrimp: "끓는새우", glowhum: "빛벌새", windmole: "풍차두더지",
    glowfly: "빛반딧불이", waddleskate: "스케이트펭귄", frostangler: "서리등불물고기", maildove: "전서구", seasonleon: "사계절용", toastybara: "따뜻한카피바라",
    bobamingo: "버블티플라밍고", lattegolem: "라떼눈사람", saunapuff: "사우나복어", ramencoon: "라면너구리", yarncat: "털실고양이", terrasnail: "이끼껍질달팽이",
    scaresprout: "꼬마허수아비", bowlrus: "얼음바다코끼리", lanternloong: "등불행렬용", discobloom: "춤추는해바라기", juicepitcher: "꿀항아리풀", mochipop: "터지는모치",
    meteoropus: "구름문어", grillgator: "바비큐악어", chimebell: "풍경꽃", frostclione: "바다천사", mistyox: "곡우소", subhermit: "잠수함소라게",
    teapir: "말차맥", brewbat: "물약박쥐", porkchef: "요리사돼지", spadolphin: "온천돌고래", snowbonsai: "눈분재", liondance: "사자춤",
    manacorn: "정령유니콘", queenbuzz: "여왕벌", gargoylite: "꼬마가고일", crystalwing: "수정잠자리", claypango: "테라코타천산갑", prismkirin: "수정기린",
  },
  ru: { saunapuff: "саунный иглобрюх" },
  uk: {
    tidefrog: "припливний кит", glacierpeng: "король льодовикових звірів", rippleduck: "качка-брижинка", mossduck: "мохокрила качка",
    cinderleaf: "жарогриб", vinevolt: "електрична лозяна миша", aurowl: "сяйна сова", rockrooster: "рок-півень",
    chimebell: "квітка-дзвіночок", manacorn: "духоріг", prismkirin: "кришталевий кірін",
  },
  ar: {
    steamalotl: "سمندر البخار", lilyfrog: "ضفدع ورقة اللوتس", bobamingo: "نحام شاي الفقاعات", windmole: "خلد طاحونة الهواء",
  },
  th: { prismkirin: "กิเลนคริสตัล" },
  vi: {
    guluduck: "Vịt Gulu", emberfox: "Cáo than hồng", guluswan: "Thiên nga Gulu", infernofox: "Cáo địa ngục", tidefrog: "Cá voi thủy triều",
    voltquill: "Nhím lá điện", aurowl: "Cú cực quang", chilizard: "Thằn lằn ớt", windmole: "Chuột chũi cối xay gió",
    ramencoon: "Gấu mèo ramen", terrasnail: "Ốc sên vỏ rêu", juicepitcher: "Cây nắp ấm mật ong", subhermit: "Cua ẩn sĩ tàu ngầm",
    teapir: "Lợn vòi matcha", brewbat: "Dơi dược liệu", crystalwing: "Chuồn chuồn pha lê", prismkirin: "Kỳ lân pha lê",
  },
  // Complete hand-authored locale tables supersede the older spot fixes.
  ...CURATED_SPECIES_NAMES,
};

/**
 * 物种显示名。
 * - zh:nameZh(调用方从 config/customSpecies 取到后传入),兜底 TitleCase。
 * - en:目录物种 = TitleCase codename(与 Steam 物品英文名一致);
 *   AI 变种 = 生成器给的专有英文名 nameEn;缺失(存量条目未回填)才退回 nameZh。
 *   注:后端启动会为存量 AI 物种本地回填 nameEn,故英文界面基本不会再露中文名。
 */
export function speciesDisplayName(
  code: string,
  lang: Language,
  nameZh?: string,
  nameEn?: string,
): string {
  if (lang === "zh-Hans") return nameZh ?? titleCaseCode(code);
  if (isAiCodename(code)) {
    if (lang === "zh-Hant") return nameZh ?? titleCaseCode(code);
    const en = nameEn?.trim();
    if (en) return en;
    // A legacy/custom entry may predate multilingual generated names. Never
    // leak its Chinese-only proper name into another language's interface.
    return titleCaseCode(code);
  }
  if (lang !== "en") {
    const localized = SPECIES_NAME_OVERRIDES[lang]?.[code]?.trim()
      ?? GENERATED_RUNTIME_LOCALES[lang]?.speciesNames?.[code]?.trim();
    if (localized) return localized.charAt(0).toLocaleUpperCase(lang) + localized.slice(1);
  }
  return titleCaseCode(code);
}

/** 英文图鉴文案表(由本地化内容 pass 填充;缺项走 speciesDesc 的兜底)。 */
export const SPECIES_EN_DESC: Record<string, string> = {
  // tier-1 — six starters
  guluduck: "A tuxedoed duckling that talks tough and never backs down. Catchphrase: 'Quack? Is this even reasonable?'",
  emberfox: "A leggy, impatient fox whose flame tail stands taller than its head — and flares or fizzles with every mood.",
  voltmouse: "A palm-sized thunder mouse. When it gets excited, everyone nearby gets a share of the static. Everyone.",
  bubblefrog: "A round little whale bobbing in midair. Slow-living optimist — today's mood is posted on its water spout.",
  sproutcap: "Wears a mushroom cap three sizes bigger than its body. In sunlight it starts swaying and honestly can't stop.",
  frostpeng: "A fluffy little snow beast. Acts cold, says little, and is secretly terrified of being left on read.",

  // legacy tier-2 — single-element evolutions + first-gen fusions (201-221)
  guluswan: "An elegant swan in black-and-white formalwear — until excitement hits and the honk cracks back into a quack.",
  infernofox: "A grand fox with three blazing tails. Everywhere it goes, it autographs the floor with tiny scorch prints.",
  thunderking: "A plump mouse emperor wearing a crown of static. Even its yawns come with a thunderclap.",
  tidefrog: "A great whale carrying a wave that never breaks. Swims past and leaves the whole yard lightly misted.",
  mycobeast: "A gentle giant mushroom growing a whole miniature mushroom forest on its cap. The tenants live rent-free.",
  glacierpeng: "The snow-beast emperor, cloaked in ice crystal. Every royal breath condenses into fresh snowflakes.",
  blazeduck: "A white duck whose cowlick burned into three tiny flames. The tail is a tuft of foxfire. Don't ask whose.",
  sparkduck: "A white duck with feathers that pop and crackle. Head pats are welcome, and lightly electrifying.",
  rippleduck: "Its tail quietly upgraded into a fin, so every step now ships with a complimentary ripple halo.",
  mossduck: "An unhurried duck with a tiny mushroom beret and moss across its back. The moss is winning. It doesn't mind.",
  frostduck: "A cool-guy duck in a fluffy frost scarf, feathers permanently rimmed with ice. That's just the aesthetic.",
  plasmatanuki: "A round-eared fox whose flame tail wraps a crackling electric core. Warm outside, high voltage inside.",
  steamander: "A hot-spring whale that vents steam instead of water, kept at temperature by the little flame on its tail fin.",
  cinderleaf: "A mushroom whose cap brim smolders at the edge, forever. Comes pre-seasoned with a hint of charcoal smoke.",
  thermowolf: "Half its fur runs hot, half runs cold, and both halves insist they're right. Thermostat talks are ongoing.",
  stormeel: "A glowing electric whale with a personal thundercloud installed overhead. Local forecast: always dramatic.",
  vinevolt: "A little mouse with glowing vines coiled around its lightning tail. Sunbathing legally counts as charging.",
  auroramink: "A fluffy mink whose fur streams with living auroras. The northern lights, now available in pocket size.",
  lotusturtle: "The pond's resident gardener: lotus-leaf hat on top and an actual sprout growing out of its spout.",
  floeseal: "A round snow beast whose tail became a fluke. Sits on a personal ice floe — why walk when you can drift?",
  frostbunny: "A frozen mushroom with two snow-fluff bunny ears. It knits scarves; the waitlist is currently two winters.",

  // e2 — two-element canon (601-615)
  weldbug: "A roly-poly beetle whose wing cases flip down as welding visors. Old-school site foreman: every spark inspected.",
  voltquill: "A hedgehog with charged leaf blades for spines — timid, endlessly curious, one startle from full pincushion glow.",
  aurowl: "A round snowy owl with two small auroras for eyebrows. Stays up all night 'for science', meaning stargazing.",
  zapbun: "Antenna ears, a wind-up key in the back, sparks on every hop. Battery at 100% — and so is the small talk.",
  voltmare: "A floating seahorse with a thundercloud caught in its tail and an equalizer for a fin. Has never dropped the beat.",
  chilizard: "A low-slung lizard with a curly red chili for a tail. Fierce temper, serious spice tolerance, extremely small.",
  onsenmonk: "A snow monkey mid-soak: one cheek toasty orange, one frosty blue, steam rising on schedule. Retirement, achieved.",
  waxlamb: "A waxy little lamb whose cowlick is a lit candle. Mood is measured in flame height. Current reading: cozy.",
  steamalotl: "A pink axolotl whose six gills are steam pipes puffing on a fixed schedule. Smiles like it's in the manual.",
  pinefawn: "A slender fawn with snow-laden pine sprigs for antlers. Radiates the calm of a village postman in deep winter.",
  potturtle: "Its shell is a terracotta pot with a live sprout inside. Water the turtle, receive a flower. Zen gardening.",
  lilyfrog: "A squat frog under a lotus-leaf hat, throat puffing up like a flower bud. Rain is its entire love language.",
  snowcub: "A snowball-round cub in a starry scarf with a soft powder belly. Cold-chain delivery intern; morale at 110%.",
  icejelly: "Its bell is a soft-serve swirl and its tentacles are piped cream. A drifting dessert chef, legally not a snack.",
  sudsotter: "A sleek otter with permanent bubble-bath bangs. Squeaky clean and extremely social — knows everyone at the tub.",

  // e3 — three-element canon (616-635)
  pyrepeacock: "Its tail fan is a full fireworks display: spark eyespots, live-wire barbs, leafy trim. A show-off that delivers.",
  stormdrake: "A noodle-shaped dragonet, one horn on fire and one iced over. Files its weather reports from inside the cloud.",
  rockrooster: "A rock-and-roll rooster with a flaming comb and three lightning tail feathers. Volume: stadium. Heart: marshmallow.",
  boilshrimp: "A shrimp curled like the letter C, shell patterned after spicy hotpot, whiskers live-wired. Loudest stall around.",
  glowhum: "A thumb-sized hummingbird whose wingbeats smear tiny auroras. The lab's fastest observer; blinking is optional.",
  windmole: "A round mole with a little windmill backpack and goggles it never pulls down. Chief of the countryside power grid.",
  glowfly: "A firefly with a proper light-bulb taillight and dew-hung leaf wings. Works the library night shift. Shh.",
  waddleskate: "A round penguin whose feet come factory-fitted with skate blades. Wears a race number; enters everything on ice.",
  frostangler: "A deep-sea angler dangling a lightning bulb for a lure. The icy fangs look fierce and feel like marshmallow.",
  maildove: "A courier pigeon with a cloud mailbag and sparking goggles — so impatient it lands before you finish the address.",
  seasonleon: "A chameleon wearing three seasons at once, all swirling with its mood. Tail: color wheel. Temperament: artist.",
  toastybara: "A capybara shaped like a warm brick loaf, toast hat included. Nothing in this bakery has ever ruffled it. Nothing.",
  bobamingo: "A milk-tea flamingo on one leg, neck curved like a straw, boba anklet on. Official ambassador of 3 p.m.",
  lattegolem: "A two-scoop snowman with a warm espresso heart and a milk-foam beret. Cold outside, warm inside — literally.",
  saunapuff: "A pufferfish that vents steam on the puff and sheds snow on the deflate. Its spikes are soft sauna wood. Breathe.",
  ramencoon: "A raccoon under a steaming ramen-bowl hat, tail striped like rolled chashu. Head chef of the midnight diner.",
  yarncat: "A cat wound into a two-tone ball of yarn; only the ears and tail poke out. The mending shop's laziest employee.",
  terrasnail: "A snail whose shell is a tiny glass conservatory — indoor snowfall, one well-loved houseplant. Greenhouse to go.",
  scaresprout: "A pocket scarecrow god with rice ears on its hat and sprouts escaping both sleeves. Far too kind to scare crows.",
  bowlrus: "A stocky walrus with bowling-pin tusks and a lane-striped belly. Runs the ice alley; strikes are house policy.",

  // e4 — four-element canon (636-650)
  lanternloong: "A paper lantern dragon glowing a different element from each segment. Headlines every festival parade. Twice.",
  discobloom: "A strutting sunflower with a mirror-disc face and stage-light petals. Lead vocals for the entire night shift.",
  juicepitcher: "A pitcher plant that is, functionally, a juice cup: vine straw, straw-hat lid. The freshest stand in town.",
  mochipop: "A snow-white mochi that grills itself until it pops, sparkler pre-lit. Books one gig a year: New Year's Eve.",
  meteoropus: "An octopus commuting on its own cloud, a different weather in each tentacle. Reporting live from the sky.",
  grillgator: "A low-slung gator whose back scales are glowing grill grates, tail strung with lights. The night market's BBQ boss.",
  chimebell: "An upside-down bellflower with ice-crystal clappers. Every breeze becomes a chime; every chime, a tiny spa session.",
  frostclione: "A see-through sea angel with a leaf-green heart, fanning auroras with every wingbeat. The deep sea's quiet poet.",
  mistyox: "A little buffalo with an abacus strung between its horns and a drizzling rice cloud on its back. Audits in seconds.",
  subhermit: "A hermit crab that moved into a yellow submarine, periscope up. Personally runs the deep-sea delivery routes.",
  teapir: "A dream-eating tapir with a teapot spout for a snout; its exhaled dreams smell of fresh tea. Sleeping is the job.",
  brewbat: "A little bat with potion-gradient wing linings, forever upside down shaking a bottle. Alchemy's night-shift intern.",
  porkchef: "A perfectly round pig in a permanently tilted chef's hat, apron stained in four sauces. Tastes more than it cooks.",
  spadolphin: "A milky dolphin flying the hot-spring inn's curtain from its fin, towel on brow. Bows at a flawless 45 degrees.",
  snowbonsai: "A strolling snow-pine bonsai, branches forever dusted, pot rimmed with icicle lace. Claims to be 100. No ID shown.",

  // e5 — five-element canon (651-656)
  liondance: "A festival lion in five element tassels; its mirrored brow rings a bell when it blinks. Openings book it first.",
  manacorn: "A tiny unicorn whose horn is a crystal tarot stick. Its fortunes are never wrong — it only tells the good ones.",
  queenbuzz: "Her Majesty: five-petal crown, five-color rings, wings humming in clean waveform. The orchestra follows her buzz.",
  gargoylite: "A chubby gargoyle whose stone wings hide four-color element linings. Brings its own pedestal; gives rooftop tours.",
  crystalwing: "A dragonfly with stained-glass wings in four colors and a single starlight taillight. The wetland's gentle observer.",
  claypango: "A pangolin armored in hand-glazed ceramic tiles, five colors deep. Old-kiln lineage: slow work, flawless finish.",

  // e6 — full-spectrum flagship (657)
  prismkirin: "The full-spectrum flagship: crystal horn, six-color mane, cloud-halo hooves. Comes with its own BGM — it hums it.",
};

/**
 * 物种图鉴文案。
 * - zh:直接用 config 的 desc。
 * - en:目录物种查 SPECIES_EN_DESC;AI 变种用生成器给的 descEn(缺失才通用兜底)。
 */
export function speciesDesc(
  code: string,
  lang: Language,
  descZh?: string,
  descEn?: string,
): string {
  if (isChineseLanguage(lang)) return descZh ?? "";
  if (lang !== "en") {
    const localized = GENERATED_RUNTIME_LOCALES[lang]?.speciesDescriptions[code];
    if (localized) return localized;
    return GENERATED_RUNTIME_LOCALES[lang]?.speciesGenericDescription ?? "";
  }
  const en = descEn?.trim();
  if (en) return en;
  return SPECIES_EN_DESC[code] ?? (descZh ? "A mysterious Gulugulu creature." : "");
}
