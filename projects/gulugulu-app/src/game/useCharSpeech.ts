import { useEffect, useState, type MutableRefObject } from "react";
import type { PetInstance } from "../types";

// ---------------------------------------------------------------------------
// 主角头顶气泡（提示 > 融合条件 > 台词）。
// 从 BackyardScene 抽出的自定义 Hook：拥有 toastSay/hintSay 状态与两个副作用，
// 计算最终 charSay。副作用体、依赖数组与 eslint-disable 均逐字保留。
// ---------------------------------------------------------------------------

type PlacedPet = {
  pet: PetInstance;
  spot: { x: number; bottom: number; size: number; float?: boolean };
};

export type UseCharSpeechInput = {
  toast: { id: number; text: string } | null;
  nearPetId: string | null;
  placedPetsRef: MutableRefObject<PlacedPet[]>;
  fusionHintFor: (pet: PetInstance) => string | null;
  speechVisible: boolean;
  speechLine: string;
};

export function useCharSpeech({
  toast,
  nearPetId,
  placedPetsRef,
  fusionHintFor,
  speechVisible,
  speechLine,
}: UseCharSpeechInput): { charSay: string | null } {
  // 头顶气泡：提示 > 融合条件 > 台词
  const [toastSay, setToastSay] = useState<{ id: number; text: string } | null>(null);
  const [hintSay, setHintSay] = useState<string | null>(null);

  // 全局提示（toast）改由主角气泡代言，2.6s 后收起
  useEffect(() => {
    if (!toast) {
      setToastSay(null);
      return;
    }
    setToastSay(toast);
    const timer = window.setTimeout(() => {
      setToastSay((current) => (current?.id === toast.id ? null : current));
    }, 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // 靠近伙伴时融合条件未达成 → 气泡说明原因，10s 后收起（每次靠近只说一次）
  useEffect(() => {
    if (!nearPetId) {
      setHintSay(null);
      return;
    }
    const near = placedPetsRef.current.find((item) => item.pet.id === nearPetId);
    const hint = near ? fusionHintFor(near.pet) : null;
    setHintSay(hint);
    if (!hint) return;
    const timer = window.setTimeout(() => setHintSay(null), 10_000);
    return () => window.clearTimeout(timer);
    // 仅在"靠近了谁"变化时取一次快照——条件文案不随金币等实时刷新
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearPetId]);

  const charSay = toastSay?.text ?? hintSay ?? (speechVisible ? speechLine : null);

  return { charSay };
}
