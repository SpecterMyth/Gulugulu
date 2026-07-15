import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
import { readOfflineWelcome, startHeartbeat } from "../../game/WelcomeBack";

/** 欢迎回来摘要卡（OnboardingFlow §二·4）：启动时若离线 >2h（或 ?welcome=1）弹卡；
 *  运行时持续写心跳时间戳。不依赖存档字段（见 WelcomeBack.ts）。 */
export function useWelcomeBack(): [number | null, Dispatch<SetStateAction<number | null>>] {
  const [welcomeOffline, setWelcomeOffline] = useState<number | null>(null);
  useEffect(() => {
    const welcome = readOfflineWelcome();
    if (welcome) setWelcomeOffline(welcome.offlineMs);
    return startHeartbeat();
  }, []);
  return [welcomeOffline, setWelcomeOffline];
}
