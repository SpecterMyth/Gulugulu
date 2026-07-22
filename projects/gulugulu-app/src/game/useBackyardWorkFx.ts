import { useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import type { GameConfig, PetInstance } from "../types";

// ---------------------------------------------------------------------------
// 点击打工的场景内特效：工具粒子 + 元素色爆发 + 挤压脉冲。
// 从 BackyardScene 抽出的自定义 Hook：拥有 petFx/workPulse/laboringIds 状态与
// fxIdRef/workComboRef，导出 workClick 处理器与 pulseClassFor 助手。逐字保留。
// ---------------------------------------------------------------------------

/** 打工连击窗口（与主舞台一致），驱动粒子密度 */
const WORK_COMBO_WINDOW_MS = 1100;

export type UseBackyardWorkFxInput = {
  busy: boolean;
  config: GameConfig;
  activePetId: string | null | undefined;
  revealEnergy: (petId: string) => void;
  onWorkPet: (petId: string, at?: { x: number; y: number }) => void;
  /** 把工具粒子发到全屏覆盖层（越过后院停靠窄条窗、满屏飘散）。返回 false=未送达。 */
  emitWorkBurst?: (
    species: string,
    rect: DOMRect,
    tier: number,
    seed: number,
    boom: boolean,
  ) => Promise<boolean>;
};

export function useBackyardWorkFx({
  busy,
  config,
  activePetId,
  revealEnergy,
  onWorkPet,
  emitWorkBurst,
}: UseBackyardWorkFxInput) {
  // 打工中的伙伴（短暂播放 laboring 动画）
  const [laboringIds, setLaboringIds] = useState<ReadonlySet<string>>(new Set());
  // 点击打工的场景内特效：工具粒子 + 元素色爆发 + 挤压脉冲。
  // local=true 时才在窗口内渲染工具粒子（预览 / 覆盖层未就绪的回退）；
  // 送达全屏覆盖层后 local=false，窗口内只留元素色爆发（ReactionBurst）。
  const [petFx, setPetFx] = useState<
    Array<{
      id: number;
      petId: string;
      species: string;
      tier: number;
      seed: number;
      boom: boolean;
      color: string;
      local: boolean;
    }>
  >([]);
  const [workPulse, setWorkPulse] = useState<{ petId: string; flip: number }>({ petId: "", flip: -1 });
  const fxIdRef = useRef(0);
  const workComboRef = useRef({ count: 0, last: 0 });

  /** 点击角色直接打工：就地播打工动画 + 大量工具粒子（乐观），收益/驳回由 onWorkPet 结算。 */
  const workClick = (pet: PetInstance, event: ReactMouseEvent) => {
    event.stopPropagation();
    if (busy) return;
    revealEnergy(pet.id); // 点击后短暂显示该宠精力条（§6.1）
    if (!pet.exhausted) {
      const nowMs = Date.now();
      const combo = workComboRef.current;
      if (nowMs - combo.last > WORK_COMBO_WINDOW_MS) combo.count = 0;
      combo.count += 1;
      combo.last = nowMs;
      const id = fxIdRef.current + 1;
      fxIdRef.current = id;
      const color =
        config.elements[config.species[pet.species]?.elements?.[0] ?? "normal"]?.color ?? "#F5917B";
      // 基础密度拉满一档（≥9），连击继续加密
      const tier = Math.min(Math.max(combo.count + 8, 9), 18);
      const seed = (Math.random() * 0xffffffff) >>> 0;
      const boom = combo.count % 10 === 0;
      // 优先把工具粒子发到全屏覆盖层（越过后院停靠窄条窗、满屏飘散）；覆盖层未就绪/
      // 预览态才回退到窗口内粒子（local=true）。ReactionBurst 元素色爆发始终留在本地。
      const rect = event.currentTarget.getBoundingClientRect();
      const overlay = emitWorkBurst?.(pet.species, rect, tier, seed, boom);
      setPetFx((list) => [
        ...list.slice(-7),
        { id, petId: pet.id, species: pet.species, tier, seed, boom, color, local: !overlay },
      ]);
      if (overlay) {
        void overlay.then((sent) => {
          if (!sent) {
            setPetFx((list) => list.map((item) => (item.id === id ? { ...item, local: true } : item)));
          }
        });
      }
      window.setTimeout(() => {
        setPetFx((list) => list.filter((item) => item.id !== id));
      }, 1250);
      setWorkPulse((prev) => ({ petId: pet.id, flip: prev.flip < 0 ? 0 : prev.flip + 1 }));
      // 非主角伙伴也要做打工动作：短暂切到 laboring 姿态
      if (pet.id !== activePetId) {
        setLaboringIds((prev) => new Set(prev).add(pet.id));
        window.setTimeout(() => {
          setLaboringIds((prev) => {
            const next = new Set(prev);
            next.delete(pet.id);
            return next;
          });
        }, 1100);
      }
    }
    onWorkPet(pet.id, { x: event.clientX, y: event.clientY });
  };

  const pulseClassFor = (petId: string) =>
    workPulse.petId === petId && workPulse.flip >= 0
      ? workPulse.flip % 2 === 0
        ? "pet-react-pulse-a"
        : "pet-react-pulse-b"
      : "";

  return { petFx, workPulse, laboringIds, workClick, pulseClassFor };
}
