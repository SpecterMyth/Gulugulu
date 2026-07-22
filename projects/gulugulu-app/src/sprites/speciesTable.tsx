import type { SpeciesInfo } from "../types";
import {
  OUTLINE,
  type RigKind,
  type RigPalette,
  type SpeciesVisual,
} from "./rigTypes";
import { FlameTail, PointedEars, SideEar as FoxSideEar, SmallFlame } from "./kits/fireKit";
import { BoltTail, SparkCheeks, RoundEars, SideEar as MouseSideEar } from "./kits/electricKit";
import { BellyWave, Fluke, Spout } from "./kits/waterKit";
import { CapSpots, MiniShroom, MushroomCap, Sprout } from "./kits/grassKit";
import { FurRidge, IceSpikes } from "./kits/iceKit";
import {
  BunnyEarTufts,
  IceFloe,
  IcicleCrown,
  LilyPadHat,
  RedCape,
  SilverCrown,
  StaticCrown,
  StormCloud,
  WaveCrest,
} from "./kits/specials";
import { FluffTuft } from "./kits/duckKit";
import { getCustomVisual, getSkinOverride } from "./customSpecies";
import { VISUALS2 } from "./species2";

// -----------------------------------------------------------------------------
// 27 只宠物的视觉声明表（计划 §1.2/§1.3）。
// config.json 只保留游戏数据；所有纯视觉数据（rig/比例/调色板/工具/槽位组合）
// 都在这里，Rust 侧零改动。codename 是存档外键，永不改名。
// body 字段是 rig 的不透明 ID：frog→whale、penguin→yeti。
// 二阶 = 底座 rig 的 kid 幼童形态 + 双亲签名件的槽位组合（部件分色对应双亲）。
// -----------------------------------------------------------------------------

/** config.body → rig 的映射（body 值是历史不透明 ID） */
export const BODY_TO_RIG: Record<string, RigKind> = {
  duck: "duck",
  fox: "fox",
  mouse: "mouse",
  frog: "whale",
  mushroom: "mushroom",
  penguin: "yeti",
  chimera: "chimera",
};

// 共享调色板底稿
const DUCK_BW: RigPalette = { body: "#FFFFFF", deep: "#2E2E36", belly: "#D9DAE0", accent: "#F5A83B" };
const FOX: RigPalette = { body: "#E85D3A", deep: "#C23B1F", belly: "#FFE8D6", accent: "#FFB03A" };
const MOUSE: RigPalette = { body: "#FFD93B", deep: "#E39B00", belly: "#FFF6CE", accent: "#FF9B3D" };
const WHALE: RigPalette = { body: "#2E7BD6", deep: "#1B5FB0", belly: "#EAF7FF", accent: "#9BDCFF" };
const SHROOM: RigPalette = { body: "#57B84C", deep: "#3B8F33", belly: "#FFF4DC", accent: "#8CD97B" };
const YETI: RigPalette = { body: "#CFEFF6", deep: "#8FD8E8", belly: "#F7FCFD", accent: "#B0E5F0" };

export const SPECIES_VISUALS: Record<string, SpeciesVisual> = {
  // ======================= 一阶（新生儿比例 baby） =======================
  guluduck: { rig: "duck", stage: "baby", scale: 1, palette: DUCK_BW, toolId: "laptop", foodAnchor: { x: 130, y: 176 } },
  emberfox: { rig: "fox", stage: "baby", scale: 1, palette: FOX, toolId: "torch", foodAnchor: { x: 130, y: 177 } },
  voltmouse: { rig: "mouse", stage: "baby", scale: 1, palette: MOUSE, toolId: "keyboard", foodAnchor: { x: 130, y: 192 } },
  bubblefrog: { rig: "whale", stage: "baby", scale: 1, palette: WHALE, floating: true, shadowRx: 46, eyes: "happy", toolId: "mop", foodAnchor: { x: 132, y: 170 } },
  sproutcap: { rig: "mushroom", stage: "baby", scale: 1, palette: SHROOM, toolId: "sproutWand", foodAnchor: { x: 130, y: 198 } },
  frostpeng: { rig: "yeti", stage: "baby", scale: 1, palette: YETI, eyes: "sleepy", toolId: "snowGlobe", foodAnchor: { x: 130, y: 132 } },

  // =============== 二阶（幼童比例 kid）：同元素 = 王族进化 ===============
  guluswan: {
    rig: "duck", stage: "kid", scale: 1.2, toolId: "fountainPen",
    palette: { ...DUCK_BW, belly: "#E8E9EF" },
    buildSlots: (_palette, view) => ({
      // 呆毛变一撮高绒羽 + 银灰小王冠
      headTop: (
        <g>
          <g transform="translate(-12 2) rotate(-24)"><FluffTuft color="#FFFFFF" h={20} /></g>
          <g transform="translate(8 2)">
            <SilverCrown />
          </g>
        </g>
      ),
      // 疣鼻天鹅式黑楔纹：从眼角斜向嘴根，不遮挡表情眼（侧视只画近侧一条）
      marking:
        view === "side" ? (
          <path d="M152 104 Q166 110 176 122 L170 127 Q159 117 148 111 Z" fill="#2E2E36" />
        ) : (
          <g fill="#2E2E36">
            <path d="M100 108 Q112 112 120 122 L110 126 Q101 118 96 112 Z" />
            <path d="M156 108 Q144 112 136 122 L146 126 Q155 118 160 112 Z" />
          </g>
        ),
    }),
  },
  infernofox: {
    rig: "fox", stage: "kid", scale: 1.2, palette: { ...FOX }, toolId: "wok",
    buildSlots: (palette, view) => ({
      // 三条火焰尾
      tail: (
        <g>
          <g transform="rotate(-26) scale(0.72)"><FlameTail layers={2} /></g>
          <g transform="rotate(24) scale(0.72)"><FlameTail layers={2} /></g>
          <FlameTail scale={0.98} />
        </g>
      ),
      // 耳间眉心火苗冠
      headTop: (
        <g>
          {view === "front" ? <PointedEars color={palette.body} /> : <FoxSideEar color={palette.body} />}
          <g transform={view === "front" ? "translate(0 2)" : "translate(-14 6)"}>
            <SmallFlame scale={0.85} />
          </g>
        </g>
      ),
    }),
  },
  thunderking: {
    rig: "mouse", stage: "kid", scale: 1.25, palette: { ...MOUSE, accent2: "#E2432E" }, toolId: "mjolnir",
    buildSlots: () => ({
      tail: <BoltTail double scale={1.1} />,
      headTop: <StaticCrown />,
      back: <RedCape width={72} length={56} />,
    }),
  },
  tidefrog: {
    rig: "whale", stage: "kid", scale: 1.2, palette: { ...WHALE }, floating: true, shadowRx: 50, eyes: "happy", toolId: "lifebuoy",
    buildSlots: (palette) => ({
      headTop: <Spout double nozzle={palette.deep} />,
      back: <WaveCrest scale={1.1} />,
    }),
  },
  mycobeast: {
    rig: "mushroom", stage: "kid", scale: 1.25, palette: { ...SHROOM }, toolId: "cauldron",
    buildSlots: () => ({
      // 帽顶迷你蘑菇林
      headTop: (
        <g>
          <g transform="translate(-30 8) rotate(-10)"><MiniShroom color="#FFF4DC" deep="#8CD97B" /></g>
          <g transform="translate(26 6) rotate(8)"><MiniShroom color="#8CD97B" /></g>
          <g transform="translate(-3 0) scale(1.3)"><MiniShroom color="#57B84C" deep="#3B8F33" /></g>
        </g>
      ),
    }),
  },
  glacierpeng: {
    rig: "yeti", stage: "kid", scale: 1.2, palette: { ...YETI, accent2: "#4FA6C9" }, eyes: "sleepy", toolId: "iceScepter",
    buildSlots: (palette) => ({
      headTop: <IcicleCrown />,
      back: <IceSpikes count={5} scale={1.1} color={palette.accent} highlight={palette.belly} />,
    }),
  },

  // ============== 二阶：元素鸭家族（白鸭底座 + 元素签名件） ==============
  blazeduck: {
    rig: "duck", stage: "kid", scale: 1.12, palette: { ...DUCK_BW, accent: "#E85D3A", accent2: "#FFB03A" }, toolId: "skewer",
    buildSlots: () => ({
      // 尾巴是一撮狐火
      tail: <g transform="rotate(6) scale(0.52)"><FlameTail /></g>,
      // 三根呆毛燃成三簇小火苗
      headTop: (
        <g>
          <g transform="translate(-14 3) rotate(-18)"><SmallFlame scale={0.75} /></g>
          <SmallFlame />
          <g transform="translate(14 3) rotate(16)"><SmallFlame scale={0.7} /></g>
        </g>
      ),
    }),
  },
  sparkduck: {
    rig: "duck", stage: "kid", scale: 1.12, palette: { ...DUCK_BW, accent: "#FFD93B", accent2: "#E39B00" }, toolId: "printer",
    buildSlots: () => ({
      tail: <g transform="rotate(-14)"><BoltTail scale={0.85} /></g>,
      cheeks: <SparkCheeks spread={26} r={6} />,
      // 胸口黄锯齿电纹
      marking: (
        <path d="M108 184 l8 -8 8 8 8 -8 8 8 8 -8" fill="none" stroke="#FFD93B" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
      ),
    }),
  },
  rippleduck: {
    rig: "duck", stage: "kid", scale: 1.12, palette: { ...DUCK_BW, accent: "#2E7BD6", accent2: "#9BDCFF" }, toolId: "waterCooler",
    buildSlots: () => ({
      // 尾巴变小尾鳍
      tail: <g transform="scale(0.85)"><Fluke color="#2E7BD6" deep="#1B5FB0" /></g>,
      // 中间呆毛变小喷水柱，两侧留绒羽
      headTop: (
        <g>
          <g transform="translate(-13 3) rotate(-30)"><FluffTuft color="#FFFFFF" h={15} /></g>
          <g transform="translate(13 3) rotate(28)"><FluffTuft color="#FFFFFF" h={14} /></g>
          <Spout scale={0.5} nozzle="#1B5FB0" />
        </g>
      ),
      // 蓝波浪肚纹
      marking: <g transform="translate(128 202) scale(0.5)"><BellyWave /></g>,
    }),
  },
  mossduck: {
    rig: "duck", stage: "kid", scale: 1.12, palette: { ...DUCK_BW, accent: "#57B84C", accent2: "#8CD97B" }, toolId: "wateringCan",
    buildSlots: () => ({
      // 头戴迷你菇帽 + 帽顶嫩芽
      headTop: (
        <g>
          <g transform="translate(0 5)">
            <MushroomCap scale={0.36} color="#57B84C" deep="#3B8F33" outlineWidth={14}>
              <CapSpots />
            </MushroomCap>
          </g>
          <g transform="translate(5 -28)"><Sprout scale={0.72} /></g>
        </g>
      ),
      // 背部苔藓斑
      marking: (
        <g fill="#57B84C" opacity={0.85}>
          <ellipse cx={96} cy={190} rx={10} ry={6} transform="rotate(-18 96 190)" />
          <ellipse cx={162} cy={184} rx={8} ry={5} transform="rotate(14 162 184)" />
          <circle cx={148} cy={204} r={4.5} fill="#8CD97B" />
        </g>
      ),
    }),
  },
  frostduck: {
    rig: "duck", stage: "kid", scale: 1.12, palette: { ...DUCK_BW, accent: "#8FD8E8", accent2: "#B0E5F0" }, toolId: "shavedIce",
    buildSlots: (_palette, view) => ({
      // 冰凌小尾
      tail: <g transform="scale(0.72)"><IceSpikes count={3} /></g>,
      // 蓬蓬霜毛围脖（正面从身侧探出；侧面倒扣在后颈，毛尖朝外）
      back:
        view === "side" ? (
          <g transform="translate(-6 -2) rotate(150)"><FurRidge width={60} teeth={6} depth={11} /></g>
        ) : (
          <FurRidge width={112} teeth={9} depth={12} />
        ),
      // 青蓝霜斑
      marking: (
        <g fill="#8FD8E8" opacity={0.8}>
          <circle cx={104} cy={180} r={4} />
          <circle cx={154} cy={176} r={3.4} />
          <circle cx={132} cy={196} r={3} fill="#B0E5F0" />
        </g>
      ),
    }),
  },

  // ====================== 二阶：跨元素组合 ======================
  plasmatanuki: {
    rig: "fox", stage: "kid", scale: 1.12, palette: { ...FOX, accent: "#FFD93B", accent2: "#FFF6CE" }, toolId: "laserPointer",
    buildSlots: (palette, view) => ({
      // 鼠系大圆耳替换尖耳
      headTop:
        view === "front" ? (
          <RoundEars body={palette.body} inner="#FFF6CE" r={18} spread={28} />
        ) : (
          <MouseSideEar body={palette.body} inner="#FFF6CE" r={17} />
        ),
      // 火焰尾嵌闪电黄芯
      tail: (
        <g>
          <FlameTail scale={0.9} layers={2} />
          <g transform="translate(4 -34) rotate(10) scale(0.8)"><BoltTail /></g>
        </g>
      ),
      cheeks: <SparkCheeks spread={26} r={6} />,
    }),
  },
  steamander: {
    rig: "whale", stage: "kid", scale: 1.12, palette: { ...WHALE, accent: "#E85D3A", accent2: "#FFB03A" }, floating: true, shadowRx: 48, toolId: "flatIron",
    buildSlots: (palette, view) => ({
      // 喷水柱变白色蒸汽团
      headTop: (
        <g>
          <circle cx={0} cy={-10} r={9} fill="#F7FCFD" stroke={OUTLINE} strokeWidth={3} opacity={0.95} />
          <circle cx={-9} cy={-22} r={6.5} fill="#F7FCFD" opacity={0.8} />
          <circle cx={9} cy={-27} r={5} fill="#F7FCFD" opacity={0.65} />
        </g>
      ),
      // 狐尖耳（从头顶后方探出）
      back:
        view === "front" ? (
          <g transform="translate(0 -8)"><PointedEars color={palette.body} inner="#FFE8D6" scale={1.05} /></g>
        ) : (
          <g transform="translate(-6 -8)"><FoxSideEar color={palette.body} inner="#FFE8D6" scale={1.0} /></g>
        ),
      // 尾鳍尖端点火
      tail: (
        <g>
          <Fluke color={palette.body} deep={palette.deep} />
          <g transform="translate(-23 -33) rotate(-16)"><SmallFlame scale={0.65} /></g>
        </g>
      ),
    }),
  },
  cinderleaf: {
    rig: "mushroom", stage: "kid", scale: 1.12, palette: { body: "#E85D3A", deep: "#C23B1F", belly: "#8CD97B", accent: "#FFB03A", accent2: "#57B84C" }, toolId: "emberLantern",
    buildSlots: () => ({
      // 帽面焦黑点 + 帽檐一线火星
      marking: (
        <g>
          <g fill="#7A3B24" opacity={0.85}>
            <circle cx={100} cy={104} r={8} />
            <circle cx={150} cy={92} r={6} />
            <circle cx={166} cy={118} r={6.5} />
          </g>
          <g transform="translate(88 148) rotate(-14)"><SmallFlame scale={0.5} /></g>
          <g transform="translate(128 154)"><SmallFlame scale={0.45} /></g>
          <g transform="translate(166 146) rotate(12)"><SmallFlame scale={0.5} /></g>
        </g>
      ),
      // 菌柄后探出小火焰尾
      tail: <g transform="scale(0.55)"><FlameTail layers={2} /></g>,
    }),
  },
  thermowolf: {
    rig: "yeti", stage: "kid", scale: 1.12, palette: { ...YETI, accent: "#E85D3A", accent2: "#8FD8E8" }, toolId: "acRemote",
    buildSlots: (palette, view) => ({
      // 狐尖耳
      headTop:
        view === "front" ? (
          <PointedEars color={palette.body} inner="#FFE8D6" scale={0.7} />
        ) : (
          <FoxSideEar color={palette.body} inner="#FFE8D6" scale={0.7} />
        ),
      // 小火焰尾
      tail: <g transform="scale(0.5)"><FlameTail layers={2} /></g>,
      // 左半火纹右半冰纹
      marking: (
        <g strokeLinecap="round" fill="none">
          <g stroke="#E85D3A" strokeWidth={4} opacity={0.75}>
            <path d="M94 148 q6 10 0 20" />
            <path d="M108 166 q5 8 0 16" />
            <path d="M98 192 q5 8 0 14" />
          </g>
          <g stroke="#8FD8E8" strokeWidth={4} opacity={0.85}>
            <path d="M160 148 q-6 10 0 20" />
            <path d="M148 166 q-5 8 0 16" />
            <path d="M158 192 q-5 8 0 14" />
          </g>
        </g>
      ),
    }),
  },
  stormeel: {
    rig: "whale", stage: "kid", scale: 1.12, palette: { body: "#FFD93B", deep: "#E39B00", belly: "#9BDCFF", accent: "#FFD93B", accent2: "#2E7BD6" }, floating: true, shadowRx: 48, toolId: "stormStaff",
    buildSlots: () => ({
      // 头顶悬浮小乌云
      headTop: <g transform="translate(0 -8)"><StormCloud /></g>,
      // 闪电形尾鳍
      tail: <g transform="rotate(-8)"><BoltTail scale={1.2} /></g>,
      cheeks: <SparkCheeks spread={42} r={8} />,
    }),
  },
  vinevolt: {
    rig: "mouse", stage: "kid", scale: 1.12, palette: { ...MOUSE, accent: "#57B84C", accent2: "#8CD97B" }, toolId: "headset",
    buildSlots: () => ({
      // 头顶嫩芽
      headTop: <Sprout scale={0.9} />,
      // 闪电尾缠藤蔓叶
      tail: (
        <g>
          <BoltTail scale={1.05} />
          <g transform="translate(-7 -15) rotate(-30)"><Sprout scale={0.5} /></g>
          <g transform="translate(-1 -28) rotate(26)"><Sprout scale={0.4} /></g>
        </g>
      ),
      // 绿叶斑颊（带电花）
      cheeks: <SparkCheeks color="#8CD97B" spread={23.5} r={6} />,
    }),
  },
  auroramink: {
    rig: "mouse", stage: "kid", scale: 1.12, palette: { ...MOUSE, accent: "#8FD8E8", accent2: "#B0E5F0" }, toolId: "tabletPen",
    buildSlots: () => ({
      // 雪怪蓬毛围脖
      back: <FurRidge width={90} teeth={9} depth={11} color="#FFF6CE" />,
      // 绒球尾 + 冰晶尾尖
      tail: (
        <g>
          <circle cx={-4} cy={-10} r={13} fill="#FFF6CE" stroke={OUTLINE} strokeWidth={4.5} />
          <g transform="translate(-9 -19) rotate(-18) scale(0.55)"><IceSpikes count={1} /></g>
        </g>
      ),
      // 皮毛上的极光带（全案唯一渐变）
      marking: (
        <g>
          <defs>
            <linearGradient id="auroramink-band" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#FFD93B" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#8CD97B" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#8FD8E8" stopOpacity="0.8" />
            </linearGradient>
          </defs>
          <path d="M96 178 Q116 166 128 176 Q140 186 160 174 L160 184 Q140 196 128 186 Q116 176 96 188 Z" fill="url(#auroramink-band)" />
          <ellipse cx={128} cy={207} rx={22} ry={13} fill="#FFF6CE" opacity={0.85} />
        </g>
      ),
    }),
  },
  lotusturtle: {
    rig: "whale", stage: "kid", scale: 1.12, palette: { ...WHALE, accent: "#57B84C", accent2: "#8CD97B" }, floating: true, shadowRx: 50, eyes: "happy", toolId: "pondNet",
    buildSlots: () => ({
      // 莲叶圆帽 + 喷水口长出嫩芽
      headTop: (
        <g>
          <LilyPadHat scale={0.8} />
          <g transform="translate(8 -3)"><Sprout scale={0.7} /></g>
        </g>
      ),
      // 荷纹肚 + 浮萍斑
      marking: (
        <g>
          <circle cx={92} cy={148} r={7} fill="#8CD97B" opacity={0.7} />
          <circle cx={170} cy={142} r={5.5} fill="#8CD97B" opacity={0.7} />
          <path d="M104 194 q10 -8 20 0 M140 198 q10 -8 20 0" stroke="#57B84C" strokeWidth={3.5} strokeLinecap="round" fill="none" opacity={0.75} />
        </g>
      ),
    }),
  },
  floeseal: {
    rig: "yeti", stage: "kid", scale: 1.12, palette: { ...YETI, accent: "#2E7BD6", accent2: "#9BDCFF" }, eyes: "happy", toolId: "crystalBall",
    buildSlots: () => ({
      // 随身小浮冰
      platform: <IceFloe width={132} />,
      // 鲸尾鳍
      tail: <g transform="scale(0.85)"><Fluke color="#8FD8E8" deep="#2E7BD6" /></g>,
      // 波浪肚纹
      marking: <g transform="translate(128 194) scale(0.55)"><BellyWave color="#F7FCFD" wave="#9BDCFF" /></g>,
    }),
  },
  frostbunny: {
    rig: "mushroom", stage: "kid", scale: 1.12, palette: { body: "#57B84C", deep: "#3B8F33", belly: "#FFF4DC", accent: "#B0E5F0", accent2: "#CFEFF6" }, toolId: "yarnBall",
    buildSlots: () => ({
      // 帽顶两撮兔耳形雪绒
      headTop: <BunnyEarTufts />,
      // 帽面霜斑 + 帽檐冰凌垂檐
      marking: (
        <g>
          <g fill="#CFEFF6" opacity={0.9}>
            <circle cx={104} cy={104} r={9} />
            <circle cx={152} cy={92} r={7} />
            <circle cx={164} cy={120} r={6} />
            <circle cx={118} cy={128} r={5} fill="#F7FCFD" />
          </g>
          <g transform="translate(104 150) rotate(180)"><IceSpikes count={2} scale={0.45} /></g>
          <g transform="translate(152 148) rotate(180)"><IceSpikes count={2} scale={0.4} /></g>
        </g>
      ),
    }),
  },
};

/** 查找链：**皮肤选择覆盖**（SkinWorkshop.md，仅 AI 物种会命中）→ 本表（6 一阶+
 *  旧二阶）→ species2 包（融合 2.0 新物种）→ AI 自定义注册表 → config 数据兜底。 */
export function getSpeciesVisual(species: string, info: SpeciesInfo | undefined): SpeciesVisual {
  const skin = getSkinOverride(species);
  if (skin) {
    if (skin.visual) return skin.visual;
    if (skin.redirectTo) {
      // 默认皮肤 = 配方固定物种形态（固定物种只在这两张表里，且自身永无覆盖）。
      const redirected = SPECIES_VISUALS[skin.redirectTo] ?? VISUALS2[skin.redirectTo];
      if (redirected) return redirected;
    }
    // 覆盖失效（目标缺失）→ 走本体链，等效回落 "local"。
  }
  const known = SPECIES_VISUALS[species];
  if (known) return known;
  const pack = VISUALS2[species];
  if (pack) return pack;
  const custom = getCustomVisual(species);
  if (custom) return custom;
  const colors = info?.colors ?? ["#F5C542"];
  return {
    rig: BODY_TO_RIG[info?.body ?? "duck"] ?? "duck",
    stage: (info?.tier ?? 1) >= 2 ? "kid" : "baby",
    scale: (info?.tier ?? 1) >= 2 ? 1.15 : 1,
    palette: {
      body: colors[0],
      deep: colors[1] ?? colors[0],
      belly: "#FFFFFF",
      accent: colors[1] ?? colors[0],
    },
  };
}
