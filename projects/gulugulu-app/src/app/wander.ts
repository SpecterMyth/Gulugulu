import { getCurrentWindow, PhysicalPosition } from "@tauri-apps/api/window";
import { isTauri } from "../tauri";
import {
  type Bounds,
  type Direction,
  clamp,
  easeInOutCubic,
  overlapArea,
  randomBetween,
  randomItem,
} from "./geometry";

export const AUTONOMOUS_MOVE_DURATION_MS = 1800;
const AUTONOMOUS_MOVE_PADDING_PX = 24;
const AUTONOMOUS_MOVE_CANDIDATE_COUNT = 36;

export function chooseAutonomousTarget(currentBounds: Bounds, monitorBounds: Bounds, activeBounds?: Bounds | null): PhysicalPosition {
  const minX = monitorBounds.x + AUTONOMOUS_MOVE_PADDING_PX;
  const minY = monitorBounds.y + AUTONOMOUS_MOVE_PADDING_PX;
  const maxX = monitorBounds.x + monitorBounds.width - currentBounds.width - AUTONOMOUS_MOVE_PADDING_PX;
  const maxY = monitorBounds.y + monitorBounds.height - currentBounds.height - AUTONOMOUS_MOVE_PADDING_PX;
  const maxDistance = Math.max(1, monitorBounds.width / 5);
  const currentArea = currentBounds.width * currentBounds.height;
  const candidatePositions: PhysicalPosition[] = [];

  const addCandidate = (x: number, y: number) => {
    const targetX = clamp(x, minX, maxX);
    const targetY = clamp(y, minY, maxY);
    const deltaX = targetX - currentBounds.x;
    const deltaY = targetY - currentBounds.y;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance <= maxDistance) {
      candidatePositions.push(new PhysicalPosition(Math.round(targetX), Math.round(targetY)));
      return;
    }

    const ratio = maxDistance / distance;
    candidatePositions.push(
      new PhysicalPosition(
        Math.round(clamp(currentBounds.x + deltaX * ratio, minX, maxX)),
        Math.round(clamp(currentBounds.y + deltaY * ratio, minY, maxY)),
      ),
    );
  };

  if (activeBounds) {
    const avoidBounds: Bounds = {
      x: activeBounds.x - AUTONOMOUS_MOVE_PADDING_PX,
      y: activeBounds.y - AUTONOMOUS_MOVE_PADDING_PX,
      width: activeBounds.width + AUTONOMOUS_MOVE_PADDING_PX * 2,
      height: activeBounds.height + AUTONOMOUS_MOVE_PADDING_PX * 2,
    };
    const outsideZones = [
      { minX, maxX: avoidBounds.x - currentBounds.width, minY, maxY },
      { minX: avoidBounds.x + avoidBounds.width, maxX, minY, maxY },
      { minX, maxX, minY, maxY: avoidBounds.y - currentBounds.height },
      { minX, maxX, minY: avoidBounds.y + avoidBounds.height, maxY },
    ].filter((zone) => zone.maxX >= zone.minX && zone.maxY >= zone.minY);

    for (const zone of outsideZones) {
      addCandidate(randomBetween(zone.minX, zone.maxX), randomBetween(zone.minY, zone.maxY));
    }

    for (let index = 0; index < AUTONOMOUS_MOVE_CANDIDATE_COUNT; index += 1) {
      const zone = outsideZones.length > 0 ? randomItem(outsideZones) : null;
      if (zone) {
        addCandidate(randomBetween(zone.minX, zone.maxX), randomBetween(zone.minY, zone.maxY));
      }
    }
  }

  while (candidatePositions.length < AUTONOMOUS_MOVE_CANDIDATE_COUNT) {
    const angle = Math.random() * Math.PI * 2;
    const distance = maxDistance * (0.35 + Math.random() * 0.65);
    addCandidate(currentBounds.x + Math.cos(angle) * distance, currentBounds.y + Math.sin(angle) * distance);
  }

  const scoredCandidates = candidatePositions.map((position) => {
    const candidateBounds: Bounds = {
      x: position.x,
      y: position.y,
      width: currentBounds.width,
      height: currentBounds.height,
    };
    const activeOverlap = activeBounds ? overlapArea(candidateBounds, activeBounds) / currentArea : 0;
    const currentOverlap = activeBounds ? overlapArea(currentBounds, activeBounds) / currentArea : 0;
    const deltaX = position.x - currentBounds.x;
    const deltaY = position.y - currentBounds.y;
    const distance = Math.hypot(deltaX, deltaY);
    const movementScore = 1 - Math.abs(distance - maxDistance * 0.65) / maxDistance;
    const escapeScore = currentOverlap > 0 && activeOverlap < currentOverlap ? (currentOverlap - activeOverlap) * 800 : 0;
    const outsideScore = activeBounds && activeOverlap === 0 ? 1000 : 0;

    return {
      position,
      score: outsideScore + escapeScore + movementScore * 80 - activeOverlap * 2000 + Math.random() * 20,
    };
  });

  scoredCandidates.sort((a, b) => b.score - a.score);
  return scoredCandidates[0]?.position ?? new PhysicalPosition(currentBounds.x, currentBounds.y);
}

export async function moveWindowAlongPath(
  target: PhysicalPosition,
  onDirectionChange: (direction: Direction) => void,
): Promise<void> {
  if (!isTauri()) return;

  const appWindow = getCurrentWindow();
  const start = await appWindow.outerPosition();
  const deltaX = target.x - start.x;
  const deltaY = target.y - start.y;
  onDirectionChange(deltaX < 0 ? "left" : "right");

  if (Math.abs(deltaX) < 2 && Math.abs(deltaY) < 2) return;

  await new Promise<void>((resolve) => {
    const startedAt = performance.now();

    const step = (now: number) => {
      const progress = clamp((now - startedAt) / AUTONOMOUS_MOVE_DURATION_MS, 0, 1);
      const eased = easeInOutCubic(progress);
      void appWindow.setPosition(
        new PhysicalPosition(Math.round(start.x + deltaX * eased), Math.round(start.y + deltaY * eased)),
      );

      if (progress < 1) {
        window.requestAnimationFrame(step);
        return;
      }

      resolve();
    };

    window.requestAnimationFrame(step);
  });
}
