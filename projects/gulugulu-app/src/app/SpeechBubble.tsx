import type { CSSProperties, RefObject } from "react";
import { ElementIcon } from "../game/ElementIcon";
import { elementName } from "../i18n";
import { useT } from "../useT";

type SpeechBubbleProps = {
  speechRef: RefObject<HTMLElement | null>;
  bubbleText: string | null;
  bubbleIsHint: boolean;
  speechDrop: number;
  speechTailX: number;
  stageElements: Array<{ id: string; badge: string; color: string; nameZh: string }>;
  lastBubbleTextRef: RefObject<string>;
};

export function SpeechBubble({
  speechRef,
  bubbleText,
  bubbleIsHint,
  speechDrop,
  speechTailX,
  stageElements,
  lastBubbleTextRef,
}: SpeechBubbleProps) {
  const { lang } = useT();
  return (
    <section
      ref={speechRef}
      className={`speech ${bubbleText != null ? "is-visible" : "is-hidden"}${bubbleIsHint ? " is-hint" : ""}`}
      style={{
        "--speech-drop": `${speechDrop}px`,
        "--speech-tail-x": `${speechTailX}px`,
      } as CSSProperties}
      data-tauri-drag-region
    >
      {stageElements.length > 0 && (
        <span className="speech-elements" aria-hidden="true">
          {stageElements.map((element) => (
            <ElementIcon
              key={element.id}
              badge={element.badge}
              color={element.color}
              title={elementName(element.id, lang)}
              size={15}
            />
          ))}
        </span>
      )}
      {bubbleIsHint && <span className="guide-sticker-sprinkles" aria-hidden="true" />}
      <span>{bubbleText ?? lastBubbleTextRef.current}</span>
    </section>
  );
}
