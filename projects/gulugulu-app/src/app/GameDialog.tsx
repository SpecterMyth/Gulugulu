import { useCallback, useEffect, useRef, useState } from "react";

export type GameConfirmOptions = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  tone?: "default" | "danger";
};

export type ConfirmGameDialog = (options: GameConfirmOptions) => Promise<boolean>;

type OpenGameDialog = GameConfirmOptions & { id: number };

/**
 * Promise-based replacement for browser/native confirmation boxes.
 * Keeping the resolver at the app root also ensures every caller shares one
 * modal lane, so two asynchronous prompts can never stack over each other.
 */
export function useGameDialog(): {
  dialog: OpenGameDialog | null;
  confirm: ConfirmGameDialog;
  settle: (accepted: boolean) => void;
} {
  const [dialog, setDialog] = useState<OpenGameDialog | null>(null);
  const dialogIdRef = useRef(0);
  const resolverRef = useRef<((accepted: boolean) => void) | null>(null);

  const settle = useCallback((accepted: boolean) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setDialog(null);
    resolve?.(accepted);
  }, []);

  const confirm = useCallback<ConfirmGameDialog>((options) => {
    // A new high-priority prompt replaces any stale one without approving it.
    resolverRef.current?.(false);
    dialogIdRef.current += 1;
    setDialog({ ...options, id: dialogIdRef.current });
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  useEffect(
    () => () => {
      resolverRef.current?.(false);
      resolverRef.current = null;
    },
    [],
  );

  return { dialog, confirm, settle };
}

export function GameDialog({
  dialog,
  onSettle,
}: {
  dialog: OpenGameDialog | null;
  onSettle: (accepted: boolean) => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!dialog) return;
    cancelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onSettle(false);
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [dialog, onSettle]);

  if (!dialog) return null;

  const titleId = `game-dialog-title-${dialog.id}`;
  const messageId = `game-dialog-message-${dialog.id}`;
  return (
    <div
      className="game-dialog-overlay"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onSettle(false);
      }}
    >
      <section
        className={`game-dialog-note${dialog.tone === "danger" ? " is-danger" : ""}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
      >
        <span className="game-dialog-tape" aria-hidden="true" />
        <strong id={titleId} className="game-dialog-title">
          {dialog.title}
        </strong>
        <p id={messageId} className="game-dialog-message">
          {dialog.message}
        </p>
        <div className="game-dialog-actions">
          <button
            ref={cancelRef}
            type="button"
            className="game-dialog-button is-cancel"
            onClick={() => onSettle(false)}
          >
            {dialog.cancelLabel}
          </button>
          <button
            type="button"
            className="game-dialog-button is-confirm"
            onClick={() => onSettle(true)}
          >
            {dialog.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
