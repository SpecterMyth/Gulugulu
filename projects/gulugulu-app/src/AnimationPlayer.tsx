import { type MouseEventHandler, type PointerEventHandler, useEffect, useMemo, useRef, useState } from "react";
import { animationDefinitions } from "./petEvents";
import type { AnimationKey } from "./types";

const FALLBACK_DUCK_ASSET = "/guluduck_character_concept.png";

type AnimationPlayerProps = {
  animationKey: AnimationKey;
  alt: string;
  className?: string;
  draggable?: boolean;
  onPointerCancel?: PointerEventHandler<HTMLImageElement>;
  onPointerDown?: PointerEventHandler<HTMLImageElement>;
  onPointerMove?: PointerEventHandler<HTMLImageElement>;
  onPointerUp?: PointerEventHandler<HTMLImageElement>;
  onContextMenu?: MouseEventHandler<HTMLImageElement>;
  onComplete?: () => void;
};

function framePath(animationKey: AnimationKey, frame: number): string {
  const paddedFrame = String(frame).padStart(4, "0");
  return `/animations/guluduck/frames/${animationKey}/${animationKey}_${paddedFrame}.png`;
}

export function AnimationPlayer({
  animationKey,
  alt,
  className,
  draggable,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onContextMenu,
  onComplete,
}: AnimationPlayerProps) {
  const definition = animationDefinitions[animationKey];
  const [frame, setFrame] = useState(1);
  const [failed, setFailed] = useState(false);
  const completedRef = useRef(false);

  useEffect(() => {
    setFrame(1);
    setFailed(false);
    completedRef.current = false;
  }, [animationKey]);

  useEffect(() => {
    if (failed || definition.frames <= 1) return;

    const interval = window.setInterval(() => {
      setFrame((currentFrame) => {
        if (currentFrame < definition.frames) return currentFrame + 1;
        if (!definition.loop && !completedRef.current) {
          completedRef.current = true;
          window.setTimeout(() => onComplete?.(), 0);
        }
        return definition.loop ? 1 : currentFrame;
      });
    }, 1000 / definition.fps);

    return () => window.clearInterval(interval);
  }, [definition.fps, definition.frames, definition.loop, failed, onComplete]);

  const src = useMemo(() => {
    if (failed) return FALLBACK_DUCK_ASSET;
    return framePath(animationKey, frame);
  }, [animationKey, failed, frame]);

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      draggable={draggable}
      onError={() => setFailed(true)}
      onPointerCancel={onPointerCancel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onContextMenu={onContextMenu}
    />
  );
}
