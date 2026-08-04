import { useEffect, useState } from "react";
import type { EggInstance } from "../../types";

/** 1s ticker for the stage egg countdown (only while an egg is on stage). */
export function useEggCountdown(stageEgg: EggInstance | null): number {
  const [stageNow, setStageNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    if (!stageEgg) return;
    const timer = window.setInterval(() => setStageNow(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [stageEgg]);
  return stageNow;
}
