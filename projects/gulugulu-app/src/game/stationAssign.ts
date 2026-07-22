// ---------------------------------------------------------------------------
// 后院驻留点的「持久化站位分配」纯逻辑（从 BackyardScene 抽出，便于离线验收）。
//
// 目标不变量：每只宠物一进场就绑定一个固定站位；某只离场（放生 / 融合消耗）只释放
// 它自己那一格，绝不牵动其他伙伴——放生不再引发整体重排，也不会有伙伴滑进刚空出的
// 坑位。新宠物取当前最低空位；水系首只优先占池塘漂浮位。首帧布局与旧的「按存档序号
// 取 GROUND_STATIONS[index]」完全一致，只是之后不再随成员增减而 densify。
//
// 站位坐标映射（pond / ground[n] → 具体落点）留在 BackyardScene，本模块只管「谁在
// 哪一格」，故可脱离 React / 坐标常量单测。
// ---------------------------------------------------------------------------

/** 一只宠物的固定站位：池塘漂浮位，或某个地面驻留点序号。 */
export type StationSlot = { pond: true } | { ground: number };

/** 供分配用的宠物最小画像（避免依赖完整 PetInstance）。 */
export type StationPet = { id: string; species: string };

/**
 * 就地更新持久化分配表 `assign`（petId → 站位）以匹配当前 `pets`：
 *  1. 删除已离场宠物的条目（释放其站位，**不** densify 其他条目）；
 *  2. 按 `pets` 顺序为尚未分配的宠物补位：水系首只（且池塘空）→ 池塘，其余 → 当前最低
 *     空地面序号。
 *
 * 已在表中的宠物条目保持不动 —— 这正是「放生 / 融合不牵动其他伙伴」的保证。
 * 幂等：同一 `pets` 重复调用不产生额外变化（可安全用于 render 期间的 useMemo）。
 */
export function assignPetStations(
  assign: Map<string, StationSlot>,
  pets: readonly StationPet[],
  isWater: (species: string) => boolean,
): void {
  const liveIds = new Set(pets.map((pet) => pet.id));
  // 1) 释放离场宠物的站位。
  for (const id of Array.from(assign.keys())) {
    if (!liveIds.has(id)) assign.delete(id);
  }
  // 2) 汇总已占用的地面序号 / 池塘。
  const takenGround = new Set<number>();
  let pondTaken = false;
  for (const slot of assign.values()) {
    if ("pond" in slot) pondTaken = true;
    else takenGround.add(slot.ground);
  }
  // 3) 按存档顺序为未分配宠物补位。
  for (const pet of pets) {
    if (assign.has(pet.id)) continue;
    if (isWater(pet.species) && !pondTaken) {
      assign.set(pet.id, { pond: true });
      pondTaken = true;
    } else {
      let index = 0;
      while (takenGround.has(index)) index += 1;
      takenGround.add(index);
      assign.set(pet.id, { ground: index });
    }
  }
}
