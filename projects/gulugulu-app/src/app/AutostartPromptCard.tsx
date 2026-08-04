import { useT } from "../useT";

// 「开机自启」引导弹窗（首班教学完成、第二次融合完成后触发）。复用 welcome 卡体系样式。
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
        className="welcome-card autostart-prompt-card"
        role="dialog"
        aria-label={A.aria}
        onClick={(event) => event.stopPropagation()}
      >
        <span className="guide-sticker-sprinkles" aria-hidden="true" />
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
