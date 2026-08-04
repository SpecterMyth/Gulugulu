import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useT } from "../useT";

// ---------------------------------------------------------------------------
// 皮肤分享/导入对话框（SkinWorkshop.md）：复用 welcome 卡体系（z=80，与
// FusionModal 同层）。一个组件两模式：
//   import —— 粘贴好友分享文本 → onSubmit；错误内联显示（不关框让用户改）。
//   share  —— 剪贴板自动复制失败的手动兜底（只读全选文本）。
// Esc 关闭由 BackyardScene 的捕获 handler 统一管理（弹窗栈次序）。
// ---------------------------------------------------------------------------

export type BackyardDexSkinDialogProps =
  | {
      mode: "import";
      busy: boolean;
      error: string | null;
      onSubmit: (text: string) => void;
      onClose: () => void;
    }
  | { mode: "share"; text: string; onClose: () => void };

export function BackyardDexSkinDialog(props: BackyardDexSkinDialogProps) {
  const { T } = useT();
  const t = T.bk.dexDetail;
  const [draft, setDraft] = useState("");
  const areaRef = useRef<HTMLTextAreaElement | null>(null);

  // share 模式：进场即全选，方便 Ctrl+C；import 模式：直接聚焦输入。
  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    area.focus();
    if (props.mode === "share") area.select();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopClick = (event: ReactMouseEvent) => event.stopPropagation();
  const busy = props.mode === "import" && props.busy;

  return (
    <div
      className="welcome-overlay"
      onClick={(event) => {
        event.stopPropagation();
        if (!busy) props.onClose();
      }}
    >
      <div className="welcome-card by-skin-dialog" onClick={stopClick}>
        <div className="welcome-title">{props.mode === "import" ? t.importTitle : t.shareManualTitle}</div>
        {props.mode === "share" ? <div className="by-skin-dialog-note">{t.shareManualNote}</div> : null}
        <textarea
          ref={areaRef}
          className="by-skin-dialog-text"
          value={props.mode === "share" ? props.text : draft}
          readOnly={props.mode === "share"}
          placeholder={props.mode === "import" ? t.importPlaceholder : undefined}
          onChange={(event) => setDraft(event.target.value)}
          onClick={(event) => {
            event.stopPropagation();
            if (props.mode === "share") (event.target as HTMLTextAreaElement).select();
          }}
        />
        {props.mode === "import" && props.error ? (
          <div className="by-skin-dialog-error">{props.error}</div>
        ) : null}
        <div className="by-skin-dialog-actions">
          {props.mode === "import" ? (
            <>
              <button type="button" className="welcome-cta is-secondary" disabled={busy} onClick={props.onClose}>
                {t.importCancel}
              </button>
              <button
                type="button"
                className="welcome-cta"
                disabled={busy || draft.trim().length === 0}
                onClick={() => props.onSubmit(draft)}
              >
                {busy ? t.importBusy : t.importGo}
              </button>
            </>
          ) : (
            <button type="button" className="welcome-cta" onClick={props.onClose}>
              {t.dialogClose}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
