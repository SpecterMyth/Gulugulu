import type { GameConfig } from "../types";
import { SvgSprite } from "../sprites/SvgSprite";
import { ElementIcon } from "./ElementIcon";
import type { DexRecipe, DexSlot } from "./pokedexData";

// ---------------------------------------------------------------------------
// 图鉴详情单元格 / 配方行（PokedexSystem.md §4）
// 纯展示叶子组件，从 BackyardScene 抽出（图鉴全屏浮层复用）。
// ---------------------------------------------------------------------------

export function DexCell({ slot, config }: { slot: DexSlot; config: GameConfig }) {
  if (slot.collected && slot.codename) {
    const info = config.species[slot.codename];
    return (
      <div className="by-dex-cell is-collected" title={info?.nameZh ?? slot.codename}>
        <div className="by-dex-cell-sprite">
          <SvgSprite species={slot.codename} config={config} petState="idle" />
        </div>
        <span className="by-dex-cell-name">{info?.nameZh ?? slot.codename}</span>
        <span className="by-dex-cell-count">曾获 ×{slot.everCount}</span>
      </div>
    );
  }
  // 未收集：固定槽/已注册槽显真实剪影（黑影），未生成 AI 槽显通用神秘剪影。
  const realShadow = !slot.mystery && slot.codename != null;
  return (
    <div className={`by-dex-cell is-unknown ${slot.locked ? "is-locked" : ""}`}>
      <div className="by-dex-cell-sprite by-dex-silhouette">
        {realShadow ? (
          <SvgSprite species={slot.codename as string} config={config} petState="idle" />
        ) : (
          <span className="by-dex-mystery">?</span>
        )}
        {slot.locked ? (
          <span className="by-dex-lock" title="需先解锁前置变种">🔒</span>
        ) : slot.probability > 0 ? (
          <span className="by-dex-prob" title="当前融合生成概率">{slot.probability}%</span>
        ) : null}
      </div>
      <span className="by-dex-cell-name">{slot.locked ? "未解锁" : "？？？"}</span>
    </div>
  );
}

export function DexRecipeRow({ recipe, config }: { recipe: DexRecipe; config: GameConfig }) {
  return (
    <div className="by-dex-reciperow">
      <div className="by-dex-recipe-label" title={recipe.key}>
        {recipe.elements.map((element) => {
          const info = config.elements[element];
          return (
            <ElementIcon
              key={element}
              badge={info?.badge ?? ""}
              color={info?.color ?? "#888"}
              title={info?.nameZh ?? element}
            />
          );
        })}
        <span className="by-dex-recipe-count">{recipe.elementCount}元素</span>
      </div>
      <div className="by-dex-recipe-slots">
        <DexCell slot={recipe.slots[0]} config={config} />
        <span className="by-dex-sep" />
        {recipe.slots.slice(1).map((slot) => (
          <DexCell key={slot.index} slot={slot} config={config} />
        ))}
      </div>
    </div>
  );
}
