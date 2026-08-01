export const TRAINING_MATERIAL_ICONS: Record<string, string> = {
  ironBadge: "🔩",
  copperGoggles: "🥽",
  silverHelmet: "⛑️",
  goldWrench: "🔧",
  platinumVest: "🦺",
  goldenBadge: "🎫",
};

export function trainingMaterialIcon(materialId: string): string {
  return TRAINING_MATERIAL_ICONS[materialId] ?? "📦";
}

export function trainingMaterialText(localizedLabel: string): string {
  const separator = localizedLabel.indexOf(" ");
  return separator < 0 ? localizedLabel : localizedLabel.slice(separator + 1);
}
