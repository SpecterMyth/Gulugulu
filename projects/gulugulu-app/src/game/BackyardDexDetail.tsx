import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CustomVisualSpec,
  GameConfig,
  GameSave,
  PetState,
  SteamStatus,
  WorkshopUploader,
} from "../types";
import type { SpeciesVisual } from "../sprites/rigTypes";
import { fmt, localizeGameMessage, speciesDisplayName, speciesDesc, elementName } from "../i18n";
import { useT } from "../useT";
import { SvgSprite } from "../sprites/SvgSprite";
import { getSpeciesVisual } from "../sprites/speciesTable";
import { buildVisualFromSpec } from "../sprites/customSpecies";
import { ElementIcon } from "./ElementIcon";
import { getGameBridge } from "./bridge";
import { dexSlotAt, formatDropChance, resolveDefaultCodename, type DexLocator, type PokedexModel } from "./pokedexData";

// ---------------------------------------------------------------------------
// 图鉴物种详情弹窗（SkinWorkshop.md）：左列活体预览 + 资料；右列（仅 AI 物种）
// 四源皮肤卡 + 创意工坊上传者列表 + 分享/导入入口。
// 持 locator 而非 slot 快照——save 更新后每次渲染从最新 model 解引用，永不过期。
// Esc 关闭由 BackyardScene 的捕获 handler 统一管理（弹窗栈次序）。
// ---------------------------------------------------------------------------

export type BackyardDexDetailProps = {
  locator: DexLocator;
  model: PokedexModel;
  config: GameConfig;
  save: GameSave;
  steamStatus: SteamStatus | null;
  onClose: () => void;
  /** 浮层内 toast（后院气泡被图鉴遮挡，图鉴内操作反馈走这里；文案已本地化）。 */
  onDexToast: (text: string) => void;
  /** 「导入皮肤」快捷入口（对话框由 BackyardScene 持有）。 */
  onOpenImport: () => void;
  /** 剪贴板复制失败的手动兜底（对话框由 BackyardScene 持有，保证 Esc 栈次序）。 */
  onShareFallback: (text: string) => void;
};

/** 预览台动画轮播：闲逛 → 打工 → 庆祝 → 进食，3s 一换（全是现成 CSS 态动画）。 */
const CYCLE_STATES: PetState[] = ["idle", "working", "success", "fed"];

function useCyclingPetState(active: boolean): PetState {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setIndex((v) => (v + 1) % CYCLE_STATES.length), 3000);
    return () => window.clearInterval(timer);
  }, [active]);
  return active ? CYCLE_STATES[index] : "idle";
}

/** 上传者列表拉取：会话级缓存（重开秒显），手动「刷新」强拉；卸载后不 setState。 */
const uploadersCache = new Map<string, WorkshopUploader[]>();

type UploadersState = { status: "idle" | "loading" | "done" | "error"; items: WorkshopUploader[] };

function useUploaders(codename: string | null, enabled: boolean): UploadersState & { reload: () => void } {
  const [state, setState] = useState<UploadersState>(() => {
    const cached = codename ? uploadersCache.get(codename) : undefined;
    return cached ? { status: "done", items: cached } : { status: "idle", items: [] };
  });
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);
  const load = useCallback(
    (force: boolean) => {
      if (!codename || !enabled) return;
      const cached = uploadersCache.get(codename);
      if (cached && !force) {
        setState({ status: "done", items: cached });
        return;
      }
      setState((prev) => ({ status: "loading", items: prev.items }));
      getGameBridge()
        .listSkinUploaders(codename)
        .then((items) => {
          uploadersCache.set(codename, items);
          if (aliveRef.current) setState({ status: "done", items });
        })
        .catch(() => {
          if (aliveRef.current) setState({ status: "error", items: [] });
        });
    },
    [codename, enabled],
  );
  useEffect(() => {
    load(false);
  }, [load]);
  return { ...state, reload: () => load(true) };
}

/** 皮肤卡数据（default/local/ws:* 三类统一形状）。 */
type SkinCardData = {
  id: string;
  title: string;
  sub: string;
  badge: "default" | "local" | "first" | "shared";
  visual?: SpeciesVisual;
};

function tryBuildVisual(spec: CustomVisualSpec): SpeciesVisual | undefined {
  try {
    return buildVisualFromSpec(spec);
  } catch {
    return undefined;
  }
}

export function BackyardDexDetail({
  locator,
  model,
  config,
  save,
  steamStatus,
  onClose,
  onDexToast,
  onOpenImport,
  onShareFallback,
}: BackyardDexDetailProps) {
  const { lang, T } = useT();
  const t = T.bk.dexDetail;
  const [busyId, setBusyId] = useState<string | null>(null);

  const deref = dexSlotAt(model, locator);
  // 槽位失效（防御：模型重建后配方消失等）→ 自动关闭。
  useEffect(() => {
    if (!deref) onClose();
  }, [deref, onClose]);

  const collected = deref?.slot.collected ?? false;
  const cycled = useCyclingPetState(collected);

  // —— 工坊身份与拉取（hook 必须无条件调用，参数为空时内部不动作） ——
  const slot = deref?.slot ?? null;
  const recipe = deref?.recipe ?? null;
  const codename = slot?.codename ?? null;
  const detCode = slot?.deterministicCodename ?? null;
  const isAiSlot = recipe != null && (slot?.index ?? 0) > 0;
  const entry = codename ? save.customSpecies?.[codename] : undefined;
  // 工坊身份：仅当本体 codename 就是确定性槽名（现代槽）才开放安装/列表；
  // 旧随机 hex 槽两套身份对不上，工坊区隐藏（防止皮肤装进"隐形"收藏）。
  const workshopCode = isAiSlot && codename != null && codename === detCode ? codename : null;
  const steamConnected = steamStatus?.mode === "connected";
  const uploaders = useUploaders(workshopCode, collected && !!entry && steamConnected);

  if (!deref || !slot) return null;

  const speciesName = (code: string, zhFallback = ""): string => {
    const nameZh = config.species[code]?.nameZh;
    const nameEn = config.species[code]?.nameEn;
    return lang === "zh" ? nameZh ?? zhFallback : speciesDisplayName(code, lang, nameZh, nameEn);
  };
  const msgOf = (error: unknown): string =>
    localizeGameMessage(error instanceof Error ? error.message : String(error), lang);
  const stopClick = (event: { stopPropagation: () => void }) => event.stopPropagation();

  // —— 头部槽位说明 + 元素图标 ——
  const slotLabel =
    recipe == null ? t.slotBase : slot.index === 0 ? t.slotFixed : fmt(t.slotAi, { index: slot.index });
  const headerElements = recipe?.elements ?? (codename ? config.species[codename]?.elements ?? [] : []);

  // —— 皮肤数据（仅 AI 物种） ——
  const skinsKey = codename ?? detCode;
  const skins = skinsKey ? save.speciesSkins?.[skinsKey] ?? [] : [];
  const rawSelected = codename ? save.skinSelected?.[codename] ?? "local" : "local";
  // 悬空选择（皮肤被移除）归一回 local——注册表侧同规则回落，两边显示一致。
  const selected =
    rawSelected !== "default" && rawSelected !== "local" && !skins.some((s) => s.id === rawSelected)
      ? "local"
      : rawSelected;

  const cards: SkinCardData[] = [];
  if (isAiSlot && collected && codename && entry) {
    const fixedCode = resolveDefaultCodename(codename, config, save.customSpecies);
    if (fixedCode) {
      cards.push({
        id: "default",
        title: speciesName(fixedCode),
        sub: t.skinDefaultSub,
        badge: "default",
        visual: getSpeciesVisual(fixedCode, config.species[fixedCode]),
      });
    }
    cards.push({
      id: "local",
      title: speciesName(codename),
      sub: t.skinLocalSub,
      badge: "local",
      visual: tryBuildVisual(entry.visual),
    });
    for (const skin of skins) {
      const visual = tryBuildVisual(skin.visual);
      if (!visual) continue; // 坏数据静默跳过
      cards.push({
        id: skin.id,
        title: skin.nameZh,
        sub: skin.authorPersona || skin.authorSteamId,
        badge: skin.source === "first" ? "first" : "shared",
        visual,
      });
    }
  }

  const applySkin = (card: SkinCardData) => {
    if (busyId || !codename) return;
    setBusyId(`use:${card.id}`);
    getGameBridge()
      .selectSpeciesSkin(codename, card.id)
      .then(() => onDexToast(fmt(t.skinApplied, { name: card.title })))
      .catch((error) => onDexToast(msgOf(error)))
      .finally(() => setBusyId(null));
  };

  const installFromRow = (row: WorkshopUploader) => {
    if (busyId || !workshopCode) return;
    setBusyId(`install:${row.publishedFileId}`);
    getGameBridge()
      .installWorkshopSkin(workshopCode, row.publishedFileId, row.isFirst ? "first" : "shared")
      .then(() => onDexToast(t.uploaderInstalledToast))
      .catch((error) => onDexToast(msgOf(error)))
      .finally(() => setBusyId(null));
  };

  // —— 分享我的宠物 ——
  // 可分享 = 本机能给出一个指向本物种工坊条目的 fileId。来源优先级：本机自己上传的
  // (workshopPublished) → 已安装工坊皮肤(species_skins，含工坊复用/导入时记的「首发」)
  // → 已加载的上传者列表(自己的/首发/任一)。任一命中即可复制分享链接。
  // 关键：**从自己创意工坊 / Steam 存档导入的宠物**(custom_species.origin="workshop"，
  // 但本机 species_skins 有该物种 fileId)也据此产生分享按钮——不再只认 origin==="local"。
  // 一个都没有但这是我原创(origin=local)且连着 Steam → 先发布再分享。
  const validId = (v?: string | null): v is string => typeof v === "string" && /^[1-9]\d*$/.test(v);
  const ownFileId = codename ? save.workshopPublished?.[codename] : undefined;
  const hasOwnUpload = validId(ownFileId);
  // 优先「首发」皮肤的 fileId（指向该物种的规范工坊条目），再退到任一已安装皮肤。
  const skinFileId =
    skins.find((s) => s.source === "first" && validId(s.publishedFileId))?.publishedFileId ??
    skins.map((s) => s.publishedFileId).find(validId);
  const uploaderFileId =
    uploaders.items.find((u) => u.isSelf && validId(u.publishedFileId))?.publishedFileId ??
    uploaders.items.find((u) => validId(u.publishedFileId) && u.isFirst)?.publishedFileId ??
    uploaders.items.map((u) => u.publishedFileId).find(validId);
  const shareFileId = [ownFileId, skinFileId, uploaderFileId].find(validId);
  const isMyPet = entry?.origin === "local";
  const showShare = !!shareFileId || isMyPet;
  const canShareNow = !!shareFileId || (steamConnected && isMyPet);

  const copyShareLink = (fileId: string) => {
    const url = `https://steamcommunity.com/sharedfiles/filedetails/?id=${fileId}`;
    const text = fmt(t.shareText, { name: codename ? speciesName(codename) : "", url });
    // WebView2 是 secure context，clipboard 通常放行；失败(预览/权限)降级到手动复制框。
    void navigator.clipboard
      .writeText(text)
      .then(() => onDexToast(t.shareCopied))
      .catch(() => onShareFallback(text));
  };

  const shareMyPet = () => {
    if (busyId || !codename) return;
    setBusyId("share");
    // 有现成 fileId → 直接生成链接复制；否则(我的原创未上传)先发布拿到 fileId 再复制。
    const flow: Promise<void> = shareFileId
      ? Promise.resolve(copyShareLink(shareFileId))
      : getGameBridge()
          .publishOwnSkin(codename)
          .then((newSave) => {
            const fid = newSave.workshopPublished?.[codename];
            if (!validId(fid)) throw new Error("#skinShareUnavailable");
            copyShareLink(fid);
          });
    flow.catch((error) => onDexToast(msgOf(error))).finally(() => setBusyId(null));
  };

  // —— 左列资料 ——
  const info = codename ? config.species[codename] : undefined;
  const ownedNow = codename ? save.pets.filter((pet) => pet.species === codename).length : 0;
  const dateOf = (secs: number) => new Date(secs * 1000).toLocaleDateString();
  const generatorLabel = (generator: string) =>
    generator === "claude" ? "Claude" : generator === "codex" ? "Codex" : "Mock";
  const installedIds = new Set(skins.map((s) => s.publishedFileId));

  // 右列（皮肤+工坊）只对已收集的 AI 变种渲染；否则弹窗是信息型单列（hero 撑满）。
  const hasSide = isAiSlot && collected && !!codename && !!entry;

  return (
    <div
      className="by-dex-detail-overlay"
      onClick={(event) => {
        event.stopPropagation();
        onClose();
      }}
    >
      <div className="by-dex-detail" onClick={stopClick}>
        <header className="by-dex-detail-head">
          <span className="by-dex-detail-elems">
            {headerElements.map((element) => {
              const einfo = config.elements[element];
              return (
                <ElementIcon
                  key={element}
                  badge={einfo?.badge ?? ""}
                  color={einfo?.color ?? "#888"}
                  title={elementName(element, lang)}
                />
              );
            })}
            <span className="by-dex-detail-slotlabel">{slotLabel}</span>
          </span>
          <span className="by-dex-detail-title">
            {collected && codename ? speciesName(codename) : t.unknownName}
          </span>
          <button
            type="button"
            className="by-dex-close"
            title={t.closeTitle}
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
          >
            ✕
          </button>
        </header>

        <div className={`by-dex-detail-body${hasSide ? "" : " is-single"}`}>
          {/* —— 左列：预览台 + 资料 —— */}
          <div className="by-dex-detail-hero">
            <div className={`by-dex-detail-stage${collected ? "" : " by-dex-silhouette"}`}>
              {codename ? (
                <SvgSprite species={codename} config={config} petState={collected ? cycled : "idle"} />
              ) : (
                <span className="by-dex-detail-mystery">?</span>
              )}
            </div>
            <div className="by-dex-detail-name">{collected && codename ? speciesName(codename) : t.unknownName}</div>
            <div className="by-dex-detail-desc">
              {collected && codename
                ? speciesDesc(
                    codename,
                    lang,
                    info?.desc ?? entry?.info.desc,
                    info?.descEn ?? entry?.info.descEn,
                  )
                : codename == null
                  ? t.mysteryLine
                  : t.unknownDesc}
            </div>
            {collected ? (
              <div className="by-dex-detail-stats">
                <span className="by-dex-detail-pill">{fmt(t.statEver, { count: slot.everCount })}</span>
                <span className="by-dex-detail-pill">{fmt(t.statOwned, { count: ownedNow })}</span>
                {entry ? (
                  <>
                    <span className="by-dex-detail-pill">{fmt(t.statBorn, { date: dateOf(entry.createdAt) })}</span>
                    <span className="by-dex-detail-pill">
                      {fmt(t.statParents, {
                        a: speciesName(entry.parents[0] ?? ""),
                        b: speciesName(entry.parents[1] ?? ""),
                      })}
                    </span>
                    <span className="by-dex-detail-pill">
                      {fmt(t.statGenerator, { provider: generatorLabel(entry.generator) })}
                    </span>
                  </>
                ) : null}
              </div>
            ) : (
              <div className="by-dex-detail-stats">
                {formatDropChance(slot.probability) ? (
                  <span className="by-dex-detail-pill is-note">
                    {fmt(t.probLine, { p: formatDropChance(slot.probability) })}
                  </span>
                ) : null}
              </div>
            )}
            {/* 神秘/未收集槽的「先入库」皮肤提示（只读缩略图行） */}
            {!collected && skins.length > 0 ? (
              <div className="by-dex-detail-preskins">
                <div className="by-dex-detail-preskins-note">{fmt(t.skinsImportedNote, { count: skins.length })}</div>
                <div className="by-dex-detail-preskins-row">
                  {skins.slice(0, 4).map((skin) => {
                    const visual = tryBuildVisual(skin.visual);
                    return visual ? (
                      <div key={skin.id} className="by-dex-detail-preskin" title={skin.nameZh}>
                        <SvgSprite species={skinsKey ?? "guluduck"} config={config} petState="idle" visual={visual} />
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            ) : null}
          </div>

          {/* —— 右列（仅已收集的 AI 变种）：皮肤 + 工坊 —— */}
          {hasSide ? (
            <div className="by-dex-detail-side">
              <div className="by-dex-skins-label">{t.skinsLabel}</div>
              <div className="by-dex-skins-grid">
                {cards.map((card) => {
                  const using = selected === card.id;
                  return (
                    <div key={card.id} className={`by-skin-card${using ? " is-selected" : ""}`} title={card.title}>
                      <span className={`by-skin-badge is-${card.badge}`}>
                        {card.badge === "default"
                          ? t.skinBadgeDefault
                          : card.badge === "local"
                            ? t.skinBadgeLocal
                            : card.badge === "first"
                              ? t.skinBadgeFirst
                              : t.skinBadgeShared}
                      </span>
                      <div className="by-skin-thumb">
                        <SvgSprite species={codename} config={config} petState="idle" visual={card.visual} />
                      </div>
                      <span className="by-skin-title">{card.title}</span>
                      <span className="by-skin-sub">{card.sub}</span>
                      {using ? (
                        <span className="by-skin-using">{t.skinUsing}</span>
                      ) : (
                        <button
                          type="button"
                          className="by-skin-use"
                          disabled={busyId != null}
                          onClick={() => applySkin(card)}
                        >
                          {t.skinUse}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="by-dex-uploaders-section">
              <div className="by-dex-uploaders-label">
                <span>{t.uploadersLabel}</span>
                {workshopCode && steamConnected && uploaders.status !== "loading" ? (
                  <button type="button" className="by-dex-uploaders-refresh" onClick={uploaders.reload}>
                    {t.uploadersRefresh}
                  </button>
                ) : null}
              </div>
              {!steamConnected || !workshopCode ? (
                <div className="by-dex-uploaders-note">{t.uploadersOffline}</div>
              ) : uploaders.status === "loading" ? (
                <div className="by-dex-uploaders-note">{t.uploadersLoading}</div>
              ) : uploaders.status === "error" ? (
                <div className="by-dex-uploaders-note">
                  {t.uploadersError}
                  <button type="button" className="by-dex-uploaders-refresh" onClick={uploaders.reload}>
                    {t.uploadersRetry}
                  </button>
                </div>
              ) : uploaders.items.length === 0 ? (
                <div className="by-dex-uploaders-note">{t.uploadersEmpty}</div>
              ) : (
                <div className="by-uploader-list">
                  {uploaders.items.map((row) => {
                    const persona = row.authorPersona || row.authorSteamId;
                    const skinId = `ws:${row.publishedFileId}`;
                    const installed = installedIds.has(row.publishedFileId);
                    const using = selected === skinId;
                    return (
                      <div key={row.publishedFileId} className="by-uploader-row">
                        <span className="by-uploader-ava">{persona.slice(0, 1)}</span>
                        <span className="by-uploader-main">
                          <span className="by-uploader-name">
                            {persona}
                            {row.isFirst ? <span className="by-uploader-first">{t.uploaderFirst}</span> : null}
                            {row.isSelf ? <span className="by-uploader-me">{t.uploaderMe}</span> : null}
                          </span>
                          <span className="by-uploader-date">{fmt(t.uploaderDate, { date: dateOf(row.timeCreated) })}</span>
                        </span>
                        {row.isSelf && !installed ? (
                          <span className="by-uploader-selfnote">{t.uploaderSelfNote}</span>
                        ) : using ? (
                          <span className="by-skin-using">{t.skinUsing}</span>
                        ) : installed ? (
                          <button
                            type="button"
                            className="by-skin-use"
                            disabled={busyId != null}
                            onClick={() =>
                              applySkin({ id: skinId, title: row.title || persona, sub: persona, badge: "shared" })
                            }
                          >
                            {t.skinUse}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="by-skin-use"
                            disabled={busyId != null}
                            onClick={() => installFromRow(row)}
                          >
                            {busyId === `install:${row.publishedFileId}` ? "…" : t.uploaderInstall}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              </div>

              <div className="by-dex-skins-actions">
                {showShare ? (
                  <button
                    type="button"
                    className="by-dex-import-btn is-share"
                    disabled={busyId != null || !canShareNow}
                    title={canShareNow ? undefined : t.importNeedSteam}
                    onClick={shareMyPet}
                  >
                    {busyId === "share" ? "…" : shareFileId ? t.shareBtn : t.shareMyPet}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="by-dex-import-btn"
                  disabled={!steamConnected}
                  title={steamConnected ? undefined : t.importNeedSteam}
                  onClick={onOpenImport}
                >
                  {t.importBtn}
                </button>
              </div>
              {steamStatus?.workshopLegalPending && hasOwnUpload ? (
                <div className="by-dex-uploaders-note by-dex-legal-note">{t.shareLegalNote}</div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
