// 工厂入口枢纽:uiMode==="factory" 挂这里。不再有中间的「选择模式」两卡界面——
// 点 Factory 直接进《危楼打工记》roguelike 局(FactoryRogueScene 自带洗桌序 →
// Crew Draft 选人 → 开局)。「经典演示」(FactoryScene 不传 rogue)改由 Debug 面板
// 入口触发,通过 variant="demo" 承载(见 App.tsx 的 factoryVariant 状态)。
// 两种模式的返回都直接透传 onBack → 回到主界面菜单态。

import { useEffect, useState } from "react";
import type { GameConfig, GameSave } from "../../types";
import { FactoryScene } from "../FactoryScene";
import { FactoryRogueScene } from "./FactoryRogueScene";
import "./factoryFps.css";
import "./rogue.css";

/** 工厂模式变体:默认 rogue(危楼打工记),demo 仅经 Debug 面板进入(经典演示沙盒)。 */
export type FactoryVariant = "rogue" | "demo";

function FactoryFps() {
  const [fps, setFps] = useState<number | null>(null);

  useEffect(() => {
    let animationFrame = 0;
    let frameCount = 0;
    let sampleStartedAt = performance.now();

    const sample = (now: number) => {
      frameCount += 1;
      const elapsed = now - sampleStartedAt;
      if (elapsed >= 500) {
        setFps(Math.round((frameCount * 1000) / elapsed));
        frameCount = 0;
        sampleStartedAt = now;
      }
      animationFrame = window.requestAnimationFrame(sample);
    };

    animationFrame = window.requestAnimationFrame(sample);
    return () => window.cancelAnimationFrame(animationFrame);
  }, []);

  return (
    <output className="factory-fps" aria-label={fps == null ? "FPS" : `FPS: ${fps}`}>
      {fps == null ? "--" : fps} FPS
    </output>
  );
}

export function FactoryHub({
  save,
  config,
  variant,
  onBack,
  onClaimFactoryLevels,
  onSave,
  onFirstShiftComplete,
  onFormalStart,
}: {
  save: GameSave;
  config: GameConfig;
  /** 由 App 决定:菜单进入=rogue;Debug「经典演示」进入=demo。缺省 rogue。 */
  variant?: FactoryVariant;
  onBack: () => void;
  /** 通到第 N 关时上报领取训练材料（EconomyRework-TrainingHall.md §5.2）。 */
  onClaimFactoryLevels: (maxLevel: number) => Promise<Record<string, number>>;
  onSave: (save: GameSave) => void;
  onFirstShiftComplete?: () => Promise<void> | void;
  onFormalStart?: () => void;
}) {
  if (variant === "demo") {
    // 经典演示沙盒:无关卡制、不产出材料;返回直接回主界面。
    return (
      <>
        <FactoryScene save={save} config={config} onBack={onBack} />
        <FactoryFps />
      </>
    );
  }
  return (
    <>
      <FactoryRogueScene
        save={save}
        config={config}
        onBack={onBack}
        onClaimFactoryLevels={onClaimFactoryLevels}
        onSave={onSave}
        onRunStart={onFormalStart}
        onFirstShiftComplete={onFirstShiftComplete}
      />
      <FactoryFps />
    </>
  );
}
