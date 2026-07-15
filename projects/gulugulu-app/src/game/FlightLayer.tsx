import { useCallback, useRef, useState, type CSSProperties } from "react";
import { FoodGlyph, KeycapGlyph, StackedKeycapGlyph } from "../sprites/parts/glyphs";

// -----------------------------------------------------------------------------
// 汇聚飞行系统（InteractionEconomy.md §6.3）——新视觉语法：向内=获得精力。
// 键帽（键盘充能，快而近以便看清字符）与能量饭团（吃 Token，从远处慢慢飘来、
// 体型随 token 量放大）从容器边缘飞抛物线汇聚到宠物嘴部：外层做水平线性位移、
// 内层做"先扬后坠"的垂直位移，落点缩小淡出成"被吸收"。全部动画只用
// transform/opacity；样式见 styles.css .flight-*。
// -----------------------------------------------------------------------------

export type Flight = {
  id: number;
  kind: "keycap" | "food";
  /** 键帽字符（food 不用）。 */
  label: string;
  /** 堆叠键帽的 ×N（>1 时渲染堆叠字形）。 */
  count?: number;
  /** 食物体型等级（1..6，按 token 量指数分档）。 */
  level?: number;
  /** 起点相对目标的偏移（px，容器坐标系；飞行终点恒为目标点）。 */
  sx: number;
  sy: number;
  durationMs: number;
  delayMs: number;
};

/** 全局在飞上限（InteractionEconomy §6.7 性能红线）。 */
const MAX_IN_FLIGHT = 12;

/** 飞行队列管理：spawn 批量入队（超限丢最老）、onDone 出队。 */
export function useFlights() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const idRef = useRef(0);

  const spawnFlights = useCallback((items: Array<Omit<Flight, "id">>) => {
    if (items.length === 0) return;
    setFlights((old) => {
      const next = [...old];
      for (const item of items) {
        idRef.current += 1;
        next.push({ ...item, id: idRef.current });
      }
      return next.slice(-MAX_IN_FLIGHT);
    });
  }, []);

  const removeFlight = useCallback((id: number) => {
    setFlights((old) => old.filter((flight) => flight.id !== id));
  }, []);

  return { flights, spawnFlights, removeFlight };
}

/** 把一批键帽标签变成错峰起飞的飞行项（§6.3：每批 ≤6，第 6 枚堆叠 ×N）。
 *  距离短、速度慢——让玩家能看清键帽上的字符。 */
export function keycapFlightsFor(labels: string[], spreadX = 48, fromY = 76): Array<Omit<Flight, "id">> {
  const shown = labels.slice(0, 5);
  const extra = labels.length - shown.length;
  const items: Array<Omit<Flight, "id">> = shown.map((label, index) => ({
    kind: "keycap" as const,
    label,
    sx: (Math.random() - 0.5) * spreadX * 2,
    sy: fromY + Math.random() * 28,
    durationMs: 760 + Math.floor(Math.random() * 160),
    delayMs: index * 95,
  }));
  if (extra > 0) {
    items.push({
      kind: "keycap",
      label: "⌨",
      count: extra + 1,
      sx: (Math.random() - 0.5) * spreadX * 2,
      sy: fromY + Math.random() * 28,
      durationMs: 880,
      delayMs: shown.length * 95,
    });
  }
  return items;
}

/** 把一餐 Token 变成能量饭团飞行项（合餐后单枚；level 决定体型）。
 *  从远处慢慢飘来（~1.9s）到嘴部，明显、看得清。 */
export function foodFlightFor(level: number, fromX = -74, fromY = -152): Omit<Flight, "id"> {
  return {
    kind: "food",
    label: "",
    level,
    sx: fromX - Math.random() * 46,
    sy: fromY - Math.random() * 44,
    durationMs: 1900,
    delayMs: 0,
  };
}

/** 渲染层：挂在 position:relative 的容器里，target 为汇聚点（CSS 长度）。 */
export function FlightLayer({
  flights,
  targetLeft,
  targetTop,
  onDone,
}: {
  flights: Flight[];
  targetLeft: string;
  targetTop: string;
  onDone: (id: number) => void;
}) {
  if (flights.length === 0) return null;
  return (
    <div className="flight-layer" aria-hidden="true">
      {flights.map((flight) => (
        <span
          key={flight.id}
          className={`flight flight-${flight.kind}`}
          style={
            {
              left: targetLeft,
              top: targetTop,
              "--fsx": `${flight.sx}px`,
              "--fsy": `${flight.sy}px`,
              "--fdur": `${flight.durationMs}ms`,
              "--fdelay": `${flight.delayMs}ms`,
            } as CSSProperties
          }
          onAnimationEnd={(event) => {
            if (event.animationName === "flight-arc-x") onDone(flight.id);
          }}
        >
          <span className="flight-x">
            <span className="flight-y">
              {flight.kind === "food" ? (
                <svg
                  viewBox="-20 -20 40 40"
                  width={38 + (flight.level ?? 1) * 13}
                  height={38 + (flight.level ?? 1) * 13}
                >
                  <FoodGlyph level={flight.level ?? 1} />
                </svg>
              ) : (
                <svg viewBox="-22 -15 44 30" width={38} height={26}>
                  {flight.count && flight.count > 1 ? (
                    <StackedKeycapGlyph count={flight.count} />
                  ) : (
                    <KeycapGlyph label={flight.label} />
                  )}
                </svg>
              )}
            </span>
          </span>
        </span>
      ))}
    </div>
  );
}
