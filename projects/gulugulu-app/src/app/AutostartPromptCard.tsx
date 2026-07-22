import { useT } from "../useT";

// 「开机自启」引导弹窗（首融领新宠后弹出，最多三次）。复用 welcome 卡体系样式。
// 纯展示：是否弹出 / 计数由 App.tsx 依 AppSettings 决定，本组件只给两个回调。
export function AutostartPromptCard({
  onAccept,
  onDecline,
}: {
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { T } = useT();
  const A = T.sh.autostart;
  return (
    <div className="welcome-overlay" onClick={onDecline}>
      <div
        className="welcome-card"
        role="dialog"
        aria-label={A.aria}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="welcome-title">{A.title}</div>
        <div className="welcome-sub">{A.body}</div>
        <div className="fusion-modal-actions autostart-actions">
          <button type="button" className="welcome-cta is-secondary" onClick={onDecline}>
            {A.decline}
          </button>
          <button type="button" className="welcome-cta" onClick={onAccept}>
            {A.accept}
          </button>
        </div>
      </div>
    </div>
  );
}
