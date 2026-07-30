// 粘连图纯算法:接触邻接表、最近邻吸取、踩桌判定、接桌最短通路。
// 全部输入 BodyLike/DeskLike 快照,无 DOM 无内部状态;scripts/factory_rogue_check.mjs 直测。
// 几何语义与 FactoryScene 对齐:圆心 x/y、脚底 = y + r、y 向下增大。

import type { BodyLike, DeskLike } from "./rogueTypes";

/** 逻辑连通判定半径系数。比实际粘合/反弹碰撞范围更宽，方便结构跨小缝连到更多桌子。 */
export const GRAPH_CONTACT_SLACK = 1.5;
/** 踩桌:脚底(y+r)与桌面上表面(desk.top)的距离容差(px)。 */
export const DESK_FOOT_TOL = 6;
/** 踩桌:圆的 x 区间与桌面板的水平重叠须 ≥ r × 此系数。 */
export const DESK_OVERLAP_RATIO = 0.5;
/** 无向邻接表:uid → 相邻 uid 列表(所有 settled 体都有表项,孤点=空数组)。 */
export type Adjacency = Map<number, number[]>;

export type AdjacencyOpts = {
  /** 接触松弛(默认 GRAPH_CONTACT_SLACK)。 */
  slack?: number;
  /** 粘连覆写(万金油):返回 true/false 强制,null = 按默认元素交集。 */
  stickOverride?: (a: BodyLike, b: BodyLike) => boolean | null;
};

export function elementsIntersect(a: BodyLike, b: BodyLike): boolean {
  return a.elements.some((el) => b.elements.includes(el));
}

/** settled 体两两「接触且可粘」→ 无向边表。接触 = dist ≤ (r1+r2)×slack;
 *  可粘 = stickOverride 优先,否则元素有交集(与场景物理同一判据)。 */
export function buildAdjacency(bodies: BodyLike[], opts?: AdjacencyOpts): Adjacency {
  const slack = opts?.slack ?? GRAPH_CONTACT_SLACK;
  const settled = bodies.filter((b) => b.settled);
  const adj: Adjacency = new Map();
  for (const b of settled) adj.set(b.uid, []);
  for (let i = 0; i < settled.length; i++) {
    const a = settled[i];
    for (let j = i + 1; j < settled.length; j++) {
      const b = settled[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const lim = (a.r + b.r) * slack;
      if (dx * dx + dy * dy > lim * lim) continue;
      const stuck = opts?.stickOverride?.(a, b) ?? elementsIntersect(a, b);
      if (!stuck) continue;
      adj.get(a.uid)!.push(b.uid);
      adj.get(b.uid)!.push(a.uid);
    }
  }
  return adj;
}

/** 吸取集:从 fromUid 沿无向粘连边做 BFS,按最少边数由近到远取 reach 只。
 *  不再限制连接方向,也不再按向下层数扩张;返回 uid 数组不含自身。 */
export function absorbSet(bodies: BodyLike[], adjacency: Adjacency, fromUid: number, reach: number): number[] {
  const validUids = new Set(bodies.map((b) => b.uid));
  if (!validUids.has(fromUid) || reach <= 0) return [];
  const seen = new Set<number>([fromUid]);
  const queue: number[] = [fromUid];
  const out: number[] = [];
  for (let i = 0; i < queue.length && out.length < reach; i++) {
    for (const v of adjacency.get(queue[i]) ?? []) {
      if (seen.has(v) || !validUids.has(v)) continue;
      seen.add(v);
      queue.push(v);
      out.push(v);
      if (out.length === reach) break;
    }
  }
  return out;
}

/** 踩桌判定:落定宠「脚底贴桌面 + 水平重叠足够」→ 桌元素 → 桌基 uid 列表。
 *  桌基只表示物理连接；是否能在该属性桌计分，由本次投放者单独决定。 */
export function deskBases(bodies: BodyLike[], desks: DeskLike[]): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const d of desks) {
    for (const b of bodies) {
      if (!b.settled) continue;
      if (Math.abs(b.y + b.r - d.top) > DESK_FOOT_TOL) continue;
      const overlap = Math.min(b.x + b.r, d.x + d.w) - Math.max(b.x - b.r, d.x);
      if (overlap < b.r * DESK_OVERLAP_RATIO) continue;
      const list = out.get(d.element);
      if (list) list.push(b.uid);
      else out.set(d.element, [b.uid]);
    }
  }
  return out;
}

/**
 * 找出由指定桌面直接支撑的全部粘连咕噜。
 *
 * 与计分用 deskBases 不同，这里只看物理支撑，不要求桌面元素与咕噜元素一致；
 * 从直接踩桌的根节点沿真实粘连图扩散，保证搬桌返池时不会把一座连在一起的塔撕开。
 */
export function bodiesSupportedByDesks(
  bodies: BodyLike[],
  desks: DeskLike[],
  elements: readonly string[],
  opts?: AdjacencyOpts,
): number[] {
  const selected = new Set(elements);
  const roots = new Set<number>();
  for (const desk of desks) {
    if (!selected.has(desk.element)) continue;
    for (const body of bodies) {
      if (!body.settled) continue;
      if (Math.abs(body.y + body.r - desk.top) > DESK_FOOT_TOL) continue;
      const overlap = Math.min(body.x + body.r, desk.x + desk.w) - Math.max(body.x - body.r, desk.x);
      if (overlap >= body.r * DESK_OVERLAP_RATIO) roots.add(body.uid);
    }
  }
  if (roots.size === 0) return [];
  const adjacency = buildAdjacency(bodies, opts);
  const seen = new Set<number>(roots);
  const queue = [...roots];
  for (let i = 0; i < queue.length; i++) {
    for (const uid of adjacency.get(queue[i]) ?? []) {
      if (seen.has(uid)) continue;
      seen.add(uid);
      queue.push(uid);
    }
  }
  return queue;
}

/**
 * 搬桌切割：把整张连通图按「离哪张桌的根节点最近」划分为桌属区域，只移动
 * 两张被交换桌拥有的区域。若两座塔已经搭桥，最短路径中点就是切割点；等距时
 * 按身体圆心离桌面中心的水平距离裁决。第三张桌的根节点也会参与划分，因此不会
 * 把跨三桌结构整片拖走。
 */
export function deskSwapMoves(
  bodies: BodyLike[],
  desks: DeskLike[],
  elements: readonly [string, string],
  opts?: AdjacencyOpts,
): { uid: number; dx: number }[] {
  const settled = bodies.filter((body) => body.settled);
  if (settled.length === 0) return [];
  const adjacency = buildAdjacency(settled, opts);
  const deskInfos = desks.map((desk, index) => {
    const roots: number[] = [];
    for (const body of settled) {
      if (Math.abs(body.y + body.r - desk.top) > DESK_FOOT_TOL) continue;
      const overlap = Math.min(body.x + body.r, desk.x + desk.w) - Math.max(body.x - body.r, desk.x);
      if (overlap >= body.r * DESK_OVERLAP_RATIO) roots.push(body.uid);
    }
    return {
      element: desk.element,
      center: desk.x + desk.w / 2,
      index,
      roots,
      distances: new Map<number, number>(),
    };
  });

  for (const info of deskInfos) {
    const queue = info.roots.slice();
    for (const uid of queue) info.distances.set(uid, 0);
    for (let i = 0; i < queue.length; i++) {
      const uid = queue[i];
      const nextDistance = (info.distances.get(uid) ?? 0) + 1;
      for (const next of adjacency.get(uid) ?? []) {
        if (info.distances.has(next)) continue;
        info.distances.set(next, nextDistance);
        queue.push(next);
      }
    }
  }

  const byUid = new Map(settled.map((body) => [body.uid, body]));
  const targets = new Map([
    [elements[0], deskInfos.find((info) => info.element === elements[1])],
    [elements[1], deskInfos.find((info) => info.element === elements[0])],
  ]);
  const moves: { uid: number; dx: number }[] = [];

  for (const body of settled) {
    let owner: (typeof deskInfos)[number] | null = null;
    let ownerDistance = Number.POSITIVE_INFINITY;
    let ownerHorizontal = Number.POSITIVE_INFINITY;
    for (const info of deskInfos) {
      const distance = info.distances.get(body.uid);
      if (distance == null) continue;
      const horizontal = Math.abs(body.x - info.center);
      if (
        distance < ownerDistance
        || (distance === ownerDistance && horizontal < ownerHorizontal)
        || (
          distance === ownerDistance
          && horizontal === ownerHorizontal
          && info.index < (owner?.index ?? Number.POSITIVE_INFINITY)
        )
      ) {
        owner = info;
        ownerDistance = distance;
        ownerHorizontal = horizontal;
      }
    }
    if (owner == null || !targets.has(owner.element)) continue;
    const target = targets.get(owner.element);
    const current = byUid.get(body.uid);
    if (target == null || current == null) continue;
    const dx = target.center - owner.center;
    if (dx !== 0) moves.push({ uid: body.uid, dx });
  }
  return moves;
}

export type DeskPathOpts = {
  /** 额外计分许可。返回 true 时，本次投放者即使不含桌元素 E 也可在该桌计分。
   *  只检查投放者；路径上的中间咕噜不做属性限制。 */
  relayAllowed?: (body: BodyLike, element: string) => boolean;
  /** 吸收继承的虚拟桌基：桌元素 → 现在继承该桌连接的 uid。 */
  extraBases?: Record<string, number[]>;
};

/**
 * 找出已经接入某张属性桌通路、但自身不含该桌属性的中继咕噜。
 *
 * 从每张桌的有效桌基反向沿粘连图扩散；只有桌属性本体或 relayAllowed
 * 明确放行的节点才能进入通路。若一只咕噜同时接通了另一张自身属性匹配的桌，
 * 它仍在正常工作，不应因为也充当了异属性中继而全局切成睡眠态。
 */
export function mismatchedDeskPathUids(
  bodies: BodyLike[],
  adjacency: Adjacency,
  desks: DeskLike[],
  opts?: DeskPathOpts,
): Set<number> {
  const byUid = new Map<number, BodyLike>();
  for (const body of bodies) byUid.set(body.uid, body);

  const bases = deskBases(bodies, desks);
  for (const [element, uids] of Object.entries(opts?.extraBases ?? {})) {
    const list = bases.get(element) ?? [];
    for (const uid of uids) if (!list.includes(uid)) list.push(uid);
    if (list.length > 0) bases.set(element, list);
  }

  const mismatched = new Set<number>();
  const working = new Set<number>();
  for (const [element, baseUids] of bases) {
    const allowed = (body: BodyLike) =>
      body.elements.includes(element) || (opts?.relayAllowed?.(body, element) ?? false);
    const seen = new Set<number>();
    const queue: number[] = [];

    for (const uid of baseUids) {
      const body = byUid.get(uid);
      if (body == null || !allowed(body) || seen.has(uid)) continue;
      seen.add(uid);
      queue.push(uid);
    }

    for (let i = 0; i < queue.length; i++) {
      for (const uid of adjacency.get(queue[i]) ?? []) {
        if (seen.has(uid)) continue;
        const body = byUid.get(uid);
        if (body == null || !allowed(body)) continue;
        seen.add(uid);
        queue.push(uid);
      }
    }

    for (const uid of seen) {
      if (byUid.get(uid)?.elements.includes(element)) working.add(uid);
      else mismatched.add(uid);
    }
  }
  for (const uid of working) mismatched.delete(uid);
  return mismatched;
}

/** 接桌通路:对每个有物理桌基的桌元素 E,从 fromUid 沿无向粘连边 BFS。
 *  只要求本次投放者「含 E 或 relayAllowed(投放者,E)」；中间节点与桌基节点忽略属性。
 *  终点为 E 桌桌基宠(fromUid 自己踩桌则路径=[fromUid])。
 *  返回 Record<E, uid 链(含首尾)>,采用最少连接边数的最近通路。 */
export function deskPaths(
  bodies: BodyLike[],
  adjacency: Adjacency,
  desks: DeskLike[],
  fromUid: number,
  opts?: DeskPathOpts,
): Record<string, number[]> {
  const byUid = new Map<number, BodyLike>();
  for (const b of bodies) byUid.set(b.uid, b);
  const from = byUid.get(fromUid);
  const out: Record<string, number[]> = {};
  if (!from) return out;
  const bases = deskBases(bodies, desks);
  for (const [element, uids] of Object.entries(opts?.extraBases ?? {})) {
    const list = bases.get(element) ?? [];
    for (const uid of uids) if (!list.includes(uid)) list.push(uid);
    if (list.length > 0) bases.set(element, list);
  }
  for (const [element, baseUids] of bases) {
    const scorerEligible =
      from.elements.includes(element)
      || (opts?.relayAllowed?.(from, element) ?? false);
    if (!scorerEligible) continue;
    const baseSet = new Set(baseUids);
    if (baseSet.has(fromUid)) {
      out[element] = [fromUid];
      continue;
    }
    // 无向 BFS,首次命中桌基即为最少边数通路。
    const prev = new Map<number, number>();
    const seen = new Set<number>([fromUid]);
    let frontier: number[] = [fromUid];
    let hit: number | null = null;
    while (frontier.length > 0 && hit == null) {
      const next: number[] = [];
      for (const uid of frontier) {
        for (const v of adjacency.get(uid) ?? []) {
          if (seen.has(v)) continue;
          const bv = byUid.get(v);
          if (!bv) continue;
          seen.add(v);
          prev.set(v, uid);
          if (baseSet.has(v)) {
            hit = v;
            break;
          }
          next.push(v);
        }
        if (hit != null) break;
      }
      frontier = next;
    }
    if (hit != null) {
      const path: number[] = [hit];
      let cur = hit;
      while (cur !== fromUid) {
        cur = prev.get(cur)!;
        path.push(cur);
      }
      path.reverse();
      out[element] = path;
    }
  }
  return out;
}
