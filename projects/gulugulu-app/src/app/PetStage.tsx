import type { ComponentProps, PointerEvent, RefObject } from "react";
import { StageEgg } from "../game/GamePanels";
import { FlightLayer } from "../game/FlightLayer";
import { SvgSprite } from "../sprites/SvgSprite";
import { ReactionBurst } from "../sprites/parts/vfx";
import { WorkBurst } from "../sprites/parts/workFx";
import { getCustomWorkFx } from "../sprites/customSpecies";
import { getSpeciesVisual } from "../sprites/speciesTable";
import type { GameConfig, PetInstance, PetState } from "../types";
import type { EggInstance } from "../types";
import { type GamePop, POP_ICONS } from "./pops";

type PetStageProps = {
  flights: ComponentProps<typeof FlightLayer>["flights"];
  removeFlight: ComponentProps<typeof FlightLayer>["onDone"];
  pops: GamePop[];
  /** 舞台根（.pet-stage）：全屏覆盖层的能量饭团汇聚点据此换算屏幕坐标。 */
  stageRef: RefObject<HTMLDivElement | null>;
  duckFacingRef: RefObject<HTMLDivElement | null>;
  finisherClass: string;
  handlePointerCancel: (event: PointerEvent<HTMLElement>) => void;
  handlePointerDown: (event: PointerEvent<HTMLElement>) => void;
  handlePointerMove: (event: PointerEvent<HTMLElement>) => void;
  handlePointerUp: (event: PointerEvent<HTMLElement>) => void;
  gameReady: boolean;
  activePet: PetInstance | null;
  stageEgg: EggInstance | null;
  gameConfig: GameConfig | null;
  stageNow: number;
  isSvgStage: boolean;
  reactionPulseClass: string;
  waking: boolean;
  petState: PetState;
  reactionBursts: number[];
  reactionColor: string;
  workBursts: Array<{ id: number; tier: number; seed: number; boom: boolean }>;
};

export function PetStage({
  flights,
  removeFlight,
  pops,
  stageRef,
  duckFacingRef,
  finisherClass,
  handlePointerCancel,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  gameReady,
  activePet,
  stageEgg,
  gameConfig,
  stageNow,
  isSvgStage,
  reactionPulseClass,
  waking,
  petState,
  reactionBursts,
  reactionColor,
  workBursts,
}: PetStageProps) {
  return (
    <div className="pet-stage" ref={stageRef}>
      {/* 汇聚飞行层：键帽雨（窗口内）/ 能量饭团（覆盖层未就绪时回退窗口内），
          均飞向宠物嘴部 50%/56%（InteractionEconomy §6.3）——与覆盖层汇聚点同值 */}
      <FlightLayer flights={flights} targetLeft="50%" targetTop="56%" onDone={removeFlight} />
      {/* 精力条不常态显示：菜单收起时保持桌宠干净，点击后由菜单 HUD 条呈现 */}
      <div className="exp-pop-layer" aria-hidden="true">
        {pops
          .filter((item) => item.x == null)
          .map((item) => (
            <span
              key={item.id}
              className={`exp-pop pop-${item.kind} exp-pop-lane-${item.lane} ${item.big ? "pop-big" : ""}`}
            >
              <span className="pop-icon">{POP_ICONS[item.kind]}</span>
              {item.text}
            </span>
          ))}
      </div>
      <div
        ref={duckFacingRef}
        className={`duck-facing ${finisherClass}`}
        data-coach={activePet ? "pet" : stageEgg ? "egg" : undefined}
        onPointerCancel={handlePointerCancel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {gameReady && !activePet && stageEgg && gameConfig ? (
          <StageEgg egg={stageEgg} config={gameConfig} now={stageNow} />
        ) : isSvgStage && gameConfig && activePet ? (
          <div
            className={`pet-react-pulse ${reactionPulseClass}${waking ? " is-waking" : ""}${
              petState === "fed" ? " is-eating" : ""
            }`}
          >
            <SvgSprite
              species={activePet.species}
              config={gameConfig}
              petState={petState}
              className="duck duck-svg"
            />
          </div>
        ) : null}
        {reactionBursts.map((id) => (
          <ReactionBurst key={id} color={reactionColor} />
        ))}
        {/* 打工工具粒子爆发（窗口内兜底路径；粒子=手中工具的产物） */}
        {isSvgStage &&
          activePet &&
          workBursts.map((burst) => (
            <WorkBurst
              key={burst.id}
              species={activePet.species}
              tier={burst.tier}
              seed={burst.seed}
              boom={burst.boom}
              toolId={getSpeciesVisual(activePet.species, undefined)?.toolId ?? null}
              customFx={getCustomWorkFx(activePet.species)}
            />
          ))}
      </div>
    </div>
  );
}
