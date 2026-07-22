import { useCallback, useEffect, useRef, useState } from "react";
import type { FusionStartResult, GameConfig, PetInstance } from "../types";
import type { GameBridge } from "./bridge";
import { fmt, localizeGameMessage, speciesDisplayName } from "../i18n";
import { useT } from "../useT";
import { SvgSprite } from "../sprites/SvgSprite";
import { fusionFeeFor } from "./config";
import { formatCount } from "./format";

// ---------------------------------------------------------------------------
// AI 融合弹窗（计划：AI 融合机制 §UI）
// 状态机：checking（CLI 预检）→ unavailable（拒绝弹窗——融合必须连接本地
// Claude Code / Codex）| confirm（双亲并排 + 费用确认）→ starting →
// result（配方命中 / AI 挂起蛋已入孵化区，秒级返回不阻塞等生成）| error。
// 复用 .welcome-overlay/.welcome-card 视觉体系（styles.css .fusion-modal-*）。
// ---------------------------------------------------------------------------

type Stage =
  | { kind: "checking" }
  | { kind: "unavailable"; error?: string | null }
  | { kind: "confirm"; provider: string }
  | { kind: "starting"; provider: string }
  | { kind: "error"; message: string };

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function providerLabel(provider: string | null | undefined): string {
  return provider === "codex" ? "Codex" : "Claude Code";
}

export function FusionModal({
  pair,
  config,
  bridge,
  onClose,
  onCommitted,
}: {
  pair: { a: PetInstance; b: PetInstance };
  config: GameConfig;
  bridge: GameBridge;
  onClose: () => void;
  onCommitted: (result: FusionStartResult) => void;
}) {
  const { lang, T } = useT();
  const bk = T.bk.fusion;
  const [stage, setStage] = useState<Stage>({ kind: "checking" });
  const disposedRef = useRef(false);
  useEffect(() => {
    // StrictMode 会 mount→cleanup→mount 双调用：进入时必须复位，否则永久 disposed
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
    };
  }, []);

  const runCheck = useCallback(
    (force?: boolean) => {
      setStage({ kind: "checking" });
      bridge
        .checkFusionCli(force)
        .then((status) => {
          if (disposedRef.current) return;
          setStage(
            status.available
              ? { kind: "confirm", provider: status.provider ?? "claude" }
              : { kind: "unavailable", error: status.error },
          );
        })
        .catch((error) => {
          if (!disposedRef.current) setStage({ kind: "unavailable", error: errorText(error) });
        });
    },
    [bridge],
  );

  useEffect(() => {
    runCheck();
  }, [runCheck]);

  const startFusion = useCallback(
    (provider: string) => {
      setStage({ kind: "starting", provider });
      bridge
        .fuseGenerate(pair.a.id, pair.b.id)
        .then((result) => {
          // 融合已是后端既成事实（金币已扣、蛋已生成，不可逆）：无论本弹窗此刻是否仍挂载，
          // 都必须把结果交给常驻的 App —— 由它同步存档、播放后院庆祝演出（顶部横幅 / 坑口光效 /
          // 就地融合仪式）、登记入账并关闭本弹窗（setFusionPair(null)）。onCommitted 作用于 App，
          // 与本组件生命周期无关，故这里绝不能用 disposedRef 拦截。
          // ⚠️ 此处曾有一道 `if (disposedRef.current) return`，是给「弹窗内结果卡」的 setStage 服务的；
          // 那张 result 卡在「就地仪式」重构中已删除，结果交付独剩 onCommitted 这一条路。若沿用守卫，
          // 一旦弹窗在 fuseGenerate 返回前被 StrictMode 重挂 / 存档推送重渲染等时机判为 disposed，就会
          // 把整场演出连同 toast、入账一起吞掉——蛋照常由 useGame 轮询兜底出现，但庆祝与提示全无
          // （正是「融合动画没有了」的症状）。
          onCommitted(result);
        })
        .catch((error) => {
          if (!disposedRef.current) setStage({ kind: "error", message: errorText(error) });
        });
    },
    [bridge, onCommitted, pair.a.id, pair.b.id],
  );

  const busy = stage.kind === "starting";
  const nameOf = (pet: PetInstance) =>
    speciesDisplayName(pet.species, lang, config.species[pet.species]?.nameZh, config.species[pet.species]?.nameEn);

  return (
    <div className="welcome-overlay" onClick={busy ? undefined : onClose}>
      <div
        className="welcome-card fusion-modal"
        role="dialog"
        aria-label={bk.ritual}
        onClick={(event) => event.stopPropagation()}
      >
        {stage.kind === "checking" && (
          <>
            <div className="welcome-title">🔮 {bk.ritual}</div>
            <div className="welcome-sub">{bk.checking}</div>
            <div className="fusion-modal-spinner" aria-hidden="true">
              ✨
            </div>
          </>
        )}

        {stage.kind === "unavailable" && (
          <>
            <div className="welcome-title">{bk.unavailableTitle}</div>
            <div className="welcome-sub">{bk.unavailableSub}</div>
            <p className="fusion-modal-note">{bk.unavailableNote}</p>
            {stage.error && (
              <div className="fusion-modal-detail">{localizeGameMessage(stage.error, lang)}</div>
            )}
            <div className="fusion-modal-actions">
              <button type="button" className="welcome-cta is-secondary" onClick={onClose}>
                {bk.close}
              </button>
              <button type="button" className="welcome-cta" onClick={() => runCheck(true)}>
                {bk.recheck}
              </button>
            </div>
          </>
        )}

        {(stage.kind === "confirm" || stage.kind === "starting") && (
          <>
            <div className="welcome-title">🔮 {bk.ritual}</div>
            <div className="welcome-sub">{fmt(bk.bySub, { provider: providerLabel(stage.provider) })}</div>
            <div className="fusion-modal-parents">
              <div className="fusion-modal-parent">
                <SvgSprite species={pair.a.species} config={config} petState="idle" />
                <span>{nameOf(pair.a)}</span>
              </div>
              <span className="fusion-modal-plus">＋</span>
              <div className="fusion-modal-parent">
                <SvgSprite species={pair.b.species} config={config} petState="idle" />
                <span>{nameOf(pair.b)}</span>
              </div>
            </div>
            <p className="fusion-modal-note">
              {bk.consumePrefix}
              <b>{bk.consumeBold}</b>
              {fmt(bk.consumeSuffix, { fee: formatCount(fusionFeeFor(config, pair.a.tier)) })}
              <br />
              {bk.resultNote}
            </p>
            <div className="fusion-modal-actions">
              <button type="button" className="welcome-cta is-secondary" disabled={busy} onClick={onClose}>
                {bk.cancel}
              </button>
              <button
                type="button"
                className="welcome-cta"
                data-coach="fuseConfirm"
                disabled={busy}
                onClick={() => startFusion(stage.provider)}
              >
                {busy ? bk.starting : bk.start}
              </button>
            </div>
          </>
        )}

        {stage.kind === "error" && (
          <>
            <div className="welcome-title">{bk.errorTitle}</div>
            <div className="fusion-modal-detail">{localizeGameMessage(stage.message, lang)}</div>
            <p className="fusion-modal-note">{bk.errorNote}</p>
            <div className="fusion-modal-actions">
              <button type="button" className="welcome-cta" onClick={onClose}>
                {bk.gotIt}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
