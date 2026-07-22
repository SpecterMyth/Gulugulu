// 物种/元素的跨语言显示:zh 真源在 config.json(nameZh/desc),en 目录名与
// Steam itemdefs 英文名同规则(TitleCase codename,见 scripts/steam/build_itemdefs_core.mjs)。
// SPECIES_EN_DESC 是 63+21 目录物种的英文图鉴文案表(内容与 zh 同调性,非直译)。
//
// AI 融合物种(isAiCodename)有专有名,不走 TitleCase:生成器产出 nameEn/descEn 并随
// 存档持久化(SpeciesInfo.nameEn/descEn,镜像 Rust game_config::SpeciesInfo)。存量条目
// (nameEn 空)由后端启动本地推导回填、CLI 可用时再升级(见 fusion_gen.rs 英文名回填)。
// 加语种时:元素/目录名在此文件补表;AI 专名只有 zh/en 两源(nameZh/nameEn),第三语种
// 需扩展生成器产出与本地兜底,或退回 en 名。

import type { Language } from "./core";

export const ELEMENT_NAMES: Record<Language, Record<string, string>> = {
  zh: { normal: "一般", fire: "火", electric: "电", water: "水", grass: "草", ice: "冰" },
  en: { normal: "Normal", fire: "Fire", electric: "Electric", water: "Water", grass: "Grass", ice: "Ice" },
};

export function elementName(element: string, lang: Language): string {
  return ELEMENT_NAMES[lang]?.[element] ?? element;
}

/** 配方键(如 "fire+water")→ 本地化元素连写("火+水" / "Fire + Water")。 */
export function recipeLabel(key: string, lang: Language): string {
  const parts = key.split("+").map((e) => elementName(e, lang));
  return lang === "zh" ? parts.join("+") : parts.join(" + ");
}

export function titleCaseCode(code: string): string {
  return code ? code.charAt(0).toUpperCase() + code.slice(1) : code;
}

/** AI 变种 codename(新式 aif0503 / 旧式 aif+6hex)。 */
export function isAiCodename(code: string): boolean {
  return /^aif[0-9a-f]{4,6}$/i.test(code);
}

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
  if (lang === "zh") return nameZh ?? titleCaseCode(code);
  if (isAiCodename(code)) {
    const en = nameEn?.trim();
    if (en) return en;
    return nameZh ?? titleCaseCode(code);
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
  if (lang === "zh") return descZh ?? "";
  const en = descEn?.trim();
  if (en) return en;
  return SPECIES_EN_DESC[code] ?? (descZh ? "A mysterious Gulugulu creature." : "");
}
