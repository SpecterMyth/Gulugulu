// Steam 排行榜 details 里的物种编码表。只能在末尾追加，绝不能重排或复用编号。
export const LEADERBOARD_SPECIES = [
  "guluduck", "emberfox", "voltmouse", "bubblefrog", "sproutcap", "frostpeng",
  "guluswan", "infernofox", "thunderking", "tidefrog", "mycobeast", "glacierpeng",
  "blazeduck", "sparkduck", "rippleduck", "mossduck", "frostduck", "plasmatanuki",
  "steamander", "cinderleaf", "thermowolf", "stormeel", "vinevolt", "auroramink",
  "lotusturtle", "floeseal", "frostbunny", "weldbug", "voltquill", "aurowl",
  "zapbun", "voltmare", "chilizard", "onsenmonk", "waxlamb", "steamalotl",
  "pinefawn", "potturtle", "lilyfrog", "snowcub", "icejelly", "sudsotter",
  "pyrepeacock", "stormdrake", "rockrooster", "boilshrimp", "glowhum", "windmole",
  "glowfly", "waddleskate", "frostangler", "maildove", "seasonleon", "toastybara",
  "bobamingo", "lattegolem", "saunapuff", "ramencoon", "yarncat", "terrasnail",
  "scaresprout", "bowlrus", "lanternloong", "discobloom", "juicepitcher", "mochipop",
  "meteoropus", "grillgator", "chimebell", "frostclione", "mistyox", "subhermit",
  "teapir", "brewbat", "porkchef", "spadolphin", "snowbonsai", "liondance",
  "manacorn", "queenbuzz", "gargoylite", "crystalwing", "claypango", "prismkirin",
] as const;

const CODE_BY_SPECIES = new Map<string, number>(
  LEADERBOARD_SPECIES.map((species, index) => [species, index + 1]),
);

export function encodeLeaderboardLoadout(loadout: string[]): number[] {
  return loadout.slice(0, 10).map((species) => CODE_BY_SPECIES.get(species) ?? 0);
}

export function decodeLeaderboardSpecies(code: number): string | null {
  return LEADERBOARD_SPECIES[code - 1] ?? null;
}
