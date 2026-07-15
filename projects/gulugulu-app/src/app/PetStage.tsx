import type { ComponentProps, CSSProperties, PointerEvent, RefObject } from "react";
import { StageEgg } from "../game/GamePanels";
import { FlightLayer } from "../game/FlightLayer";
import { formatCount } from "../game/format";
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
  comboView: { count: number; coins: number; exp: number; flip: number } | null;
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
  comboView,
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
    <div className="pet-stage">
      {/* 汇聚飞行层：键帽雨 / 能量饭团飞向宠物嘴部（InteractionEconomy §6.3） */}
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
      {/* 连击累计读数（点击游戏爽快感） */}
      {comboView && (
        <div
          className={`combo-pop ${comboView.flip % 2 === 0 ? "combo-pop-a" : "combo-pop-b"}`}
          style={{ "--combo-scale": `${1 + Math.min(comboView.count, 20) * 0.025}` } as CSSProperties}
          aria-hidden="true"
        >
          {comboView.count > 1 && <span className="combo-count">连击 ×{comboView.count}</span>}
          <span className="combo-line">🪙 +{formatCount(comboView.coins)}</span>
          {comboView.exp > 0 && (
            <span className="combo-line combo-exp">✨ +{formatCount(comboView.exp)}</span>
          )}
        </div>
      )}
      <div
        ref={duckFacingRef}
        className={`duck-facing ${finisherClass}`}
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
