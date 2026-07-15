import type { RigComponent, SpeciesVisual } from "../rigTypes";
import type { ToolRenderer } from "../parts/tools";
import type { WorkFxSpec } from "../parts/workFx";
import type { SpeciesPack } from "./types";

// -----------------------------------------------------------------------------
// species2 汇总点（融合 2.0 · SpeciesArtSpec §2）——全批次唯一共同触点。
// 每完成一只物种：在此 append 一行 import + 一行 PACKS 条目，别的不动。
// 派生注册表由 SvgSprite / speciesTable / tools / workFx 各 merge 一次。
// -----------------------------------------------------------------------------

import { PACK as weldbug } from "./e2/weldbug";
import { PACK as voltquill } from "./e2/voltquill";
import { PACK as zapbun } from "./e2/zapbun";
import { PACK as voltmare } from "./e2/voltmare";
import { PACK as chilizard } from "./e2/chilizard";
import { PACK as waxlamb } from "./e2/waxlamb";
import { PACK as onsenmonk } from "./e2/onsenmonk";
import { PACK as steamalotl } from "./e2/steamalotl";
import { PACK as sudsotter } from "./e2/sudsotter";
import { PACK as lilyfrog } from "./e2/lilyfrog";
import { PACK as potturtle } from "./e2/potturtle";
import { PACK as pinefawn } from "./e2/pinefawn";
import { PACK as aurowl } from "./e2/aurowl";
import { PACK as snowcub } from "./e2/snowcub";
import { PACK as icejelly } from "./e2/icejelly";
import { PACK as windmole } from "./e3/windmole";
import { PACK as glowfly } from "./e3/glowfly";
import { PACK as maildove } from "./e3/maildove";
import { PACK as rockrooster } from "./e3/rockrooster";
import { PACK as boilshrimp } from "./e3/boilshrimp";
import { PACK as toastybara } from "./e3/toastybara";
import { PACK as saunapuff } from "./e3/saunapuff";
import { PACK as bowlrus } from "./e3/bowlrus";
import { PACK as scaresprout } from "./e3/scaresprout";
import { PACK as terrasnail } from "./e3/terrasnail";
import { PACK as waddleskate } from "./e3/waddleskate";
import { PACK as frostangler } from "./e3/frostangler";
import { PACK as yarncat } from "./e3/yarncat";
import { PACK as pyrepeacock } from "./e3/pyrepeacock";
import { PACK as stormdrake } from "./e3/stormdrake";
import { PACK as glowhum } from "./e3/glowhum";
import { PACK as seasonleon } from "./e3/seasonleon";
import { PACK as bobamingo } from "./e3/bobamingo";
import { PACK as lattegolem } from "./e3/lattegolem";
import { PACK as ramencoon } from "./e3/ramencoon";
import { PACK as teapir } from "./e4/teapir";
import { PACK as grillgator } from "./e4/grillgator";
import { PACK as spadolphin } from "./e4/spadolphin";
import { PACK as meteoropus } from "./e4/meteoropus";
import { PACK as juicepitcher } from "./e4/juicepitcher";
import { PACK as discobloom } from "./e4/discobloom";
import { PACK as snowbonsai } from "./e4/snowbonsai";
import { PACK as frostclione } from "./e4/frostclione";
import { PACK as lanternloong } from "./e4/lanternloong";
import { PACK as mochipop } from "./e4/mochipop";
import { PACK as chimebell } from "./e4/chimebell";
import { PACK as mistyox } from "./e4/mistyox";
import { PACK as subhermit } from "./e4/subhermit";
import { PACK as brewbat } from "./e4/brewbat";
import { PACK as porkchef } from "./e4/porkchef";
import { PACK as liondance } from "./e5/liondance";
import { PACK as manacorn } from "./e5/manacorn";
import { PACK as queenbuzz } from "./e5/queenbuzz";
import { PACK as gargoylite } from "./e5/gargoylite";
import { PACK as crystalwing } from "./e5/crystalwing";
import { PACK as claypango } from "./e5/claypango";
import { PACK as prismkirin } from "./e6/prismkirin";

export const PACKS: Record<string, SpeciesPack> = {
  weldbug,
  voltquill,
  zapbun,
  voltmare,
  chilizard,
  waxlamb,
  onsenmonk,
  windmole,
  glowfly,
  maildove,
  rockrooster,
  boilshrimp,
  toastybara,
  saunapuff,
  bowlrus,
  steamalotl,
  sudsotter,
  lilyfrog,
  potturtle,
  pinefawn,
  aurowl,
  snowcub,
  icejelly,
  scaresprout,
  terrasnail,
  waddleskate,
  frostangler,
  yarncat,
  pyrepeacock,
  stormdrake,
  glowhum,
  seasonleon,
  bobamingo,
  lattegolem,
  ramencoon,
  teapir,
  grillgator,
  spadolphin,
  meteoropus,
  juicepitcher,
  discobloom,
  snowbonsai,
  frostclione,
  lanternloong,
  mochipop,
  chimebell,
  mistyox,
  subhermit,
  brewbat,
  porkchef,
  liondance,
  manacorn,
  queenbuzz,
  gargoylite,
  crystalwing,
  claypango,
  prismkirin,
};

export const RIGS2: Record<string, RigComponent> = {};
export const TOOLS2: Record<string, ToolRenderer> = {};
export const WORK_FX2: Record<string, WorkFxSpec> = {};
export const VISUALS2: Record<string, SpeciesVisual> = {};

for (const [codename, pack] of Object.entries(PACKS)) {
  RIGS2[codename] = pack.rig;
  TOOLS2[codename] = pack.tool;
  WORK_FX2[codename] = pack.workFx;
  VISUALS2[codename] = { rig: codename, stage: "kid", toolId: codename, ...pack.visual };
}
