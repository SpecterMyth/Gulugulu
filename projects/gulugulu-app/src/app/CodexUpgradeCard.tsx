import { useT } from "../useT";

const CODEX_CLI_GUIDE_URL = "https://help.openai.com/en/articles/11096431";

type CodexUpgradeCardProps = {
  onClose: () => void;
};

export function CodexUpgradeCard({ onClose }: CodexUpgradeCardProps) {
  const { T } = useT();
  const copy = T.sh.codexUpgrade;

  const openGuide = () => {
    window.open(CODEX_CLI_GUIDE_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="welcome-overlay codex-upgrade-overlay" role="presentation">
      <section
        className="welcome-card codex-upgrade-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="codex-upgrade-title"
      >
        <div className="codex-upgrade-icon" aria-hidden="true">↻</div>
        <h2 id="codex-upgrade-title">{copy.title}</h2>
        <p>{copy.description}</p>
        <div className="codex-upgrade-commands">
          <div>
            <span>{copy.upgradeLabel}</span>
            <code>codex --upgrade</code>
          </div>
          <div>
            <span>{copy.installLabel}</span>
            <code>npm install -g @openai/codex</code>
          </div>
        </div>
        <div className="fusion-modal-actions codex-upgrade-actions">
          <button type="button" className="welcome-cta" onClick={openGuide}>
            {copy.openGuide}
          </button>
          <button type="button" className="welcome-skip" onClick={onClose}>
            {copy.close}
          </button>
        </div>
      </section>
    </div>
  );
}
