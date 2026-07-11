import { convertFileSrc } from "@tauri-apps/api/core";
import { type MouseEventHandler, type PointerEventHandler, useEffect, useMemo, useRef, useState } from "react";
import { animationDefinitions } from "./petEvents";
import type { AnimationKey, AvatarManifest } from "./types";
import { isTauri } from "./tauri";

const FALLBACK_DUCK_ASSET = "/guluduck_character_concept.png";

type AnimationPlayerProps = {
  animationKey: AnimationKey;
  alt: string;
  avatarManifest?: AvatarManifest;
  avatarRootPath?: string | null;
  className?: string;
  draggable?: boolean;
  onPointerCancel?: PointerEventHandler<HTMLImageElement>;
  onPointerDown?: PointerEventHandler<HTMLImageElement>;
  onPointerMove?: PointerEventHandler<HTMLImageElement>;
  onPointerUp?: PointerEventHandler<HTMLImageElement>;
  onContextMenu?: MouseEventHandler<HTMLImageElement>;
  onComplete?: () => void;
};

function builtinFramePath(animationKey: AnimationKey, frame: number): string {
  const paddedFrame = String(frame).padStart(4, "0");
  return `/animations/guluduck/frames/${animationKey}/${animationKey}_${paddedFrame}.png`;
}

function avatarFramePath(manifest: AvatarManifest | undefined, rootPath: string | null | undefined, animationKey: AnimationKey, frame: number): string {
  const definition = manifest?.animations[animationKey];
  if (!definition?.framePathTemplate) return builtinFramePath(animationKey, frame);

  const paddedFrame = String(frame).padStart(4, "0");
  const relativePath = definition.framePathTemplate.replace("{frame}", paddedFrame);
  if (!rootPath) return relativePath.startsWith("/") ? relativePath : `/${relativePath}`;

  const fullPath = `${rootPath.replace(/[\\/]+$/, "")}/${relativePath}`.replaceAll("\\", "/");
  return isTauri() ? convertFileSrc(fullPath) : fullPath;
}

function resolveAnimationKey(manifest: AvatarManifest | undefined, animationKey: AnimationKey): AnimationKey {
  if (!manifest) return animationKey;
  return manifest.animations[animationKey] ? animationKey : "idle_normal";
}

export function AnimationPlayer({
  animationKey,
  alt,
  avatarManifest,
  avatarRootPath,
  className,
  draggable,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onContextMenu,
  onComplete,
}: AnimationPlayerProps) {
  const resolvedAnimationKey = resolveAnimationKey(avatarManifest, animationKey);
  const definition = avatarManifest?.animations[resolvedAnimationKey] ?? animationDefinitions[resolvedAnimationKey];
  const [frame, setFrame] = useState(1);
  const [failed, setFailed] = useState(false);
  const completedRef = useRef(false);

  useEffect(() => {
    setFrame(1);
    setFailed(false);
    completedRef.current = false;
  }, [resolvedAnimationKey, avatarManifest?.id, avatarRootPath]);

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
    return avatarFramePath(avatarManifest, avatarRootPath, resolvedAnimationKey, frame);
  }, [avatarManifest, avatarRootPath, failed, frame, resolvedAnimationKey]);

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
