import { useEffect } from "react";
import type { GameBridge } from "../../game/bridge";
import type { GameConfig, GameSave } from "../../types";
import { isTauri } from "../../tauri";
import { renderSpeciesPreviewPng } from "../speciesPreview";

/** 单个物种渲染缓存的尝试次数与重试间隔（webview 首帧瞬时失败的兜底）。 */
const PREVIEW_RENDER_ATTEMPTS = 3;
const PREVIEW_RETRY_DELAY_MS = 400;

/** 自定义物种设定图离屏渲染：启动后（以及每次有新 AI 物种落地时）把还没有 PNG
 *  缓存的物种渲染出来交给后端 —— 后端落盘 species-previews/ 并给已上传的创意工坊
 *  物品补挂缩略图（SetItemPreview）。Tauri 专属，best-effort，逐个串行防卡渲染。 */
export function useSpeciesPreviews(
  bridge: GameBridge,
  config: GameConfig | null,
  save: GameSave | null,
) {
  // 只以"物种集合"为依赖：等级/金币等高频存档变化不重扫。
  const speciesKey = Object.keys(save?.customSpecies ?? {})
    .sort()
    .join(",");

  useEffect(() => {
    if (!isTauri() || !config || !speciesKey) return;
    let cancelled = false;
    void (async () => {
      let missing: string[] = [];
      try {
        missing = await bridge.missingSpeciesPreviews();
      } catch {
        return; // 旧后端无此命令等场景：静默跳过。
      }
      for (const codename of missing) {
        if (cancelled) return;
        // 渲染→缓存是「带图整体上传」的前置：缓存成功后端才拿得到 PNG 去发布/补挂。
        // 失败重试若干次（webview 首帧字体/布局未就绪等瞬时因素），仍失败留给后端
        // 兜底（无图发布 + 下次启动补挂扫描），绝不永久漏图。
        for (let attempt = 1; attempt <= PREVIEW_RENDER_ATTEMPTS; attempt += 1) {
          if (cancelled) return;
          try {
            const png = await renderSpeciesPreviewPng(codename, config);
            await bridge.cacheSpeciesPreview(codename, png);
            break;
          } catch (error) {
            if (attempt === PREVIEW_RENDER_ATTEMPTS) {
              console.warn(`[workshop] 渲染 ${codename} 设定图失败（已重试 ${attempt} 次）`, error);
            } else {
              await new Promise((r) => setTimeout(r, PREVIEW_RETRY_DELAY_MS));
            }
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bridge, config, speciesKey]);
}
