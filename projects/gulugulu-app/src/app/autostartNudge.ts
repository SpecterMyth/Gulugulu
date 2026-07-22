// ---------------------------------------------------------------------------
// 「开机自启」引导弹窗的融合来源判定（前端本地状态，Rust 侧零改动）。
//
// 需求：融合成功领取到新宠、且流程处理结束后弹一次引导。难点是「这颗蛋来自融合」
// 无法只看蛋字段可靠判定——首融被硬编码为经典配方蛋（无 pendingFusion），且与商店
// 蛋同为 tier{N}/hatchKind。但所有融合（配方 / AI / Steam 路径）都经
// handleFusionCommitted 拿到 result.eggId，收取又都经 collectEgg(eggId)。于是在提交
// 时记下融合蛋 id、收取时核销——跨重启（AI 蛋隔会话孵化）用 localStorage 兜住。
//
// 计数与「是否已加入自启」的真源仍在 Rust AppSettings（settings://changed 广播）；
// 这里只负责识别「本次收取是不是融合蛋」。
// ---------------------------------------------------------------------------

const FUSION_EGG_KEY = "gulugulu.fusionEggIds";
/** 防 localStorage 无限增长（未收取的融合蛋 id 上限，超出丢最旧）。 */
const MAX_TRACKED = 64;

/** 引导弹窗最多展示次数（镜像 Rust settings::AUTOSTART_PROMPT_MAX）。 */
export const AUTOSTART_PROMPT_MAX = 3;

/** 融合领新宠后是否该弹「开机自启」引导：未加入自启、且展示次数未到上限才弹。
 *  加入自启（autostart=true）→ 永不弹；到上限（count>=MAX）→ 永不弹。设置未加载 → 不弹。 */
export function shouldPromptAutostart(
  settings: { autostart: boolean; autostartPromptCount: number } | null | undefined,
): boolean {
  if (!settings) return false;
  return !settings.autostart && settings.autostartPromptCount < AUTOSTART_PROMPT_MAX;
}

function readSet(): string[] {
  try {
    const raw = window.localStorage.getItem(FUSION_EGG_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeSet(ids: string[]): void {
  try {
    window.localStorage.setItem(FUSION_EGG_KEY, JSON.stringify(ids.slice(-MAX_TRACKED)));
  } catch {
    // localStorage 不可用：引导弹窗是加分项，静默跳过不阻塞融合流程。
  }
}

/** 融合提交时登记结果蛋 id（配方 / AI / Steam 路径统一入口）。 */
export function rememberFusionEgg(eggId: string): void {
  if (!eggId) return;
  const ids = readSet();
  if (ids.includes(eggId)) return;
  ids.push(eggId);
  writeSet(ids);
}

/** 收取某蛋时核销：曾登记过（= 来自融合）则移除并返回 true，否则 false。 */
export function takeFusionEgg(eggId: string): boolean {
  if (!eggId) return false;
  const ids = readSet();
  const index = ids.indexOf(eggId);
  if (index < 0) return false;
  ids.splice(index, 1);
  writeSet(ids);
  return true;
}
