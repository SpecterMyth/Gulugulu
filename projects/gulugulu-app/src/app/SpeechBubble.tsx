import type { CSSProperties, RefObject } from "react";
import { ElementIcon } from "../game/ElementIcon";

type SpeechBubbleProps = {
  speechRef: RefObject<HTMLElement | null>;
  bubbleText: string | null;
  bubbleIsHint: boolean;
  speechDrop: number;
  stageElements: Array<{ id: string; badge: string; color: string; nameZh: string }>;
  lastBubbleTextRef: RefObject<string>;
};

export function SpeechBubble({
  speechRef,
  bubbleText,
  bubbleIsHint,
  speechDrop,
  stageElements,
  lastBubbleTextRef,
}: SpeechBubbleProps) {
  return (
    <section
      ref={speechRef}
      className={`speech ${bubbleText != null ? "is-visible" : "is-hidden"}${bubbleIsHint ? " is-hint" : ""}`}
      style={{ "--speech-drop": `${speechDrop}px` } as CSSProperties}
      data-tauri-drag-region
    >
      {stageElements.length > 0 && (
        <span className="speech-elements" aria-hidden="true">
          {stageElements.map((element) => (
            <ElementIcon
              key={element.id}
              badge={element.badge}
              color={element.color}
              title={element.nameZh}
              size={15}
            />
          ))}
        </span>
      )}
      <span>{bubbleText ?? lastBubbleTextRef.current}</span>
    </section>
  );
}
