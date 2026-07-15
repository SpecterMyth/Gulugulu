import { useCallback, useEffect, useRef, useState } from "react";
import type { FusionStartResult, GameConfig, PetInstance } from "../types";
import type { GameBridge } from "./bridge";
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
  | { kind: "result"; result: FusionStartResult }
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
          if (disposedRef.current) return;
          onCommitted(result);
          setStage({ kind: "result", result });
        })
        .catch((error) => {
          if (!disposedRef.current) setStage({ kind: "error", message: errorText(error) });
        });
    },
    [bridge, onCommitted, pair.a.id, pair.b.id],
  );

  const busy = stage.kind === "starting";
  const nameOf = (pet: PetInstance) => config.species[pet.species]?.nameZh ?? pet.species;

  return (
    <div className="welcome-overlay" onClick={busy ? undefined : onClose}>
      <div
        className="welcome-card fusion-modal"
        role="dialog"
        aria-label="融合仪式"
        onClick={(event) => event.stopPropagation()}
      >
        {stage.kind === "checking" && (
          <>
            <div className="welcome-title">🔮 融合仪式</div>
            <div className="welcome-sub">正在检测本地 Claude Code / Codex…</div>
            <div className="fusion-modal-spinner" aria-hidden="true">
              ✨
            </div>
          </>
        )}

        {stage.kind === "unavailable" && (
          <>
            <div className="welcome-title">⛔ 无法融合</div>
            <div className="welcome-sub">融合仪式需要连接本地 Claude Code 或 Codex CLI</div>
            <p className="fusion-modal-note">
              没有检测到可用的 CLI。请安装并在终端登录 Claude Code（优先）或 Codex 后再试。
            </p>
            {stage.error && <div className="fusion-modal-detail">{stage.error}</div>}
            <div className="fusion-modal-actions">
              <button type="button" className="welcome-cta is-secondary" onClick={onClose}>
                关闭
              </button>
              <button type="button" className="welcome-cta" onClick={() => runCheck(true)}>
                重新检测
              </button>
            </div>
          </>
        )}

        {(stage.kind === "confirm" || stage.kind === "starting") && (
          <>
            <div className="welcome-title">🔮 融合仪式</div>
            <div className="welcome-sub">由本地 {providerLabel(stage.provider)} 现场生成</div>
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
              两只精灵将被<b>消耗</b>，花费 {formatCount(fusionFeeFor(config, pair.a.tier))} 🪙。
              <br />
              结果可能触发经典配方，也可能由 AI 创造一只独一无二的新物种！
            </p>
            <div className="fusion-modal-actions">
              <button type="button" className="welcome-cta is-secondary" disabled={busy} onClick={onClose}>
                取消
              </button>
              <button
                type="button"
                className="welcome-cta"
                disabled={busy}
                onClick={() => startFusion(stage.provider)}
              >
                {busy ? "仪式进行中…" : "✨ 开始融合"}
              </button>
            </div>
          </>
        )}

        {stage.kind === "result" && (
          <>
            <div className="welcome-title">
              {stage.result.mode === "recipe" ? "📜 触发经典配方！" : "✨ 新生命正在酝酿"}
            </div>
            <div className="welcome-sub">
              {stage.result.mode === "recipe"
                ? `「${
                    (stage.result.species && config.species[stage.result.species]?.nameZh) ??
                    stage.result.species ??
                    "？？？"
                  }」的蛋已进入孵化区`
                : "AI 正在设计全新物种，神秘蛋已进入孵化区"}
            </div>
            <p className="fusion-modal-note">
              {stage.result.mode === "recipe"
                ? "30 分钟后回来收蛋吧！"
                : "设计完成会立刻通知你；即使关掉应用，孵化和生成也会在下次启动时继续。"}
            </p>
            <div className="fusion-modal-actions">
              <button type="button" className="welcome-cta" onClick={onClose}>
                好耶！
              </button>
            </div>
          </>
        )}

        {stage.kind === "error" && (
          <>
            <div className="welcome-title">😥 融合没有开始</div>
            <div className="fusion-modal-detail">{stage.message}</div>
            <p className="fusion-modal-note">两只精灵和金币都没有被消耗。</p>
            <div className="fusion-modal-actions">
              <button type="button" className="welcome-cta" onClick={onClose}>
                知道了
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
