import type { GameConfig } from "../types";
import { elementName, fmt, recipeLabel, speciesDisplayName } from "../i18n";
import { useT } from "../useT";
import { SvgSprite } from "../sprites/SvgSprite";
import { ElementIcon } from "./ElementIcon";
import { formatDropChance, type DexRecipe, type DexSlot } from "./pokedexData";

// ---------------------------------------------------------------------------
// 图鉴详情单元格 / 配方行（PokedexSystem.md §4 + SkinWorkshop.md 详情弹窗）
// 纯展示叶子组件，从 BackyardScene 抽出（图鉴全屏浮层复用）。
// onOpen 存在时格子可点（打开物种详情弹窗）；skinCount>0 时右上角挂皮肤徽章
// （神秘槽靠 deterministicCodename 也能显示——「先入库」的皮肤提示）。
// ---------------------------------------------------------------------------

export function DexCell({
  slot,
  config,
  onOpen,
  skinCount = 0,
}: {
  slot: DexSlot;
  config: GameConfig;
  onOpen?: () => void;
  skinCount?: number;
}) {
  const { lang, T } = useT();
  const bk = T.bk.dex;
  const clickable = onOpen != null;
  const skinBadge =
    skinCount > 0 ? (
      <span className="by-dex-cell-skinbadge">{fmt(T.bk.dexDetail.skinCellBadge, { count: skinCount })}</span>
    ) : null;
  if (slot.collected && slot.codename) {
    const name = speciesDisplayName(slot.codename, lang, config.species[slot.codename]?.nameZh, config.species[slot.codename]?.nameEn);
    return (
      <button
        type="button"
        className={`by-dex-cell is-collected${clickable ? " is-clickable" : ""}`}
        title={name}
        onClick={onOpen}
        disabled={!clickable}
      >
        <div className="by-dex-cell-sprite">
          <SvgSprite species={slot.codename} config={config} petState="idle" />
        </div>
        {skinBadge}
        <span className="by-dex-cell-name">{name}</span>
        <span className="by-dex-cell-count">{fmt(bk.ownedCount, { count: slot.everCount })}</span>
      </button>
    );
  }
  // 未收集：固定槽/已注册槽显真实剪影（黑影），未生成 AI 槽显通用神秘剪影。
  const realShadow = !slot.mystery && slot.codename != null;
  const odds = formatDropChance(slot.probability);
  return (
    <button
      type="button"
      className={`by-dex-cell is-unknown${clickable ? " is-clickable" : ""}`}
      onClick={onOpen}
      disabled={!clickable}
    >
      <div className="by-dex-cell-sprite by-dex-silhouette">
        {realShadow ? (
          <SvgSprite species={slot.codename as string} config={config} petState="idle" />
        ) : (
          <span className="by-dex-mystery">?</span>
        )}
        {odds ? (
          <span className="by-dex-prob" title={bk.probTitle}>{odds}</span>
        ) : null}
      </div>
      {skinBadge}
      <span className="by-dex-cell-name">{bk.unknownName}</span>
    </button>
  );
}

export function DexRecipeRow({
  recipe,
  config,
  onOpenSlot,
  skinCountFor,
}: {
  recipe: DexRecipe;
  config: GameConfig;
  /** 点击某槽（参数 = slots 下标 0..10）。缺省整行不可点。 */
  onOpenSlot?: (slotIndex: number) => void;
  /** 该槽名下已导入皮肤数（详情弹窗数据同源；缺省不显徽章）。 */
  skinCountFor?: (slot: DexSlot) => number;
}) {
  const { lang, T } = useT();
  return (
    <div className="by-dex-reciperow">
      <div className="by-dex-recipe-label" title={recipeLabel(recipe.key, lang)}>
        {recipe.elements.map((element) => {
          const info = config.elements[element];
          return (
            <ElementIcon
              key={element}
              badge={info?.badge ?? ""}
              color={info?.color ?? "#888"}
              title={elementName(element, lang)}
            />
          );
        })}
        <span className="by-dex-recipe-count">{fmt(T.bk.dex.elementCount, { count: recipe.elementCount })}</span>
      </div>
      <div className="by-dex-recipe-slots">
        <DexCell
          slot={recipe.slots[0]}
          config={config}
          onOpen={onOpenSlot ? () => onOpenSlot(0) : undefined}
          skinCount={skinCountFor?.(recipe.slots[0]) ?? 0}
        />
        <span className="by-dex-sep" />
        {recipe.slots.slice(1).map((slot) => (
          <DexCell
            key={slot.index}
            slot={slot}
            config={config}
            onOpen={onOpenSlot ? () => onOpenSlot(slot.index) : undefined}
            skinCount={skinCountFor?.(slot) ?? 0}
          />
        ))}
      </div>
    </div>
  );
}
