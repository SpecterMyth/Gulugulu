import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
} from "react";
import type { PetInstance } from "../types";
import { WORLD_MAX, WORLD_MIN } from "./backyardShared";

// ---------------------------------------------------------------------------
// 后院 rAF 运动循环：行走 / 相机 / 视差 / 靠近检测 + 键盘移动 + 点击寻路 +
// 视口缩放跟踪。从 BackyardScene 抽出的自定义 Hook：拥有运动相关的 state / ref
// 与全部 effect，逐字保留 step 函数体、每个 setter 调用与每个依赖数组。
// ---------------------------------------------------------------------------

// 角色可漫步进两侧装饰带（留 60px 不贴到世界边缘栅栏）。
const CHAR_MIN = WORLD_MIN + 60;
const CHAR_MAX = WORLD_MAX - 60;
const WALK_SPEED = 230;
const SHOP_CENTER_X = 1150;
const SHOP_NEAR_RANGE = 210;
const PET_NEAR_RANGE = 150;
/** 图鉴馆 / 交易市场建筑中心与感应半径（紧贴公告板右侧的功能区簇） */
const MUSEUM_X = 3310;
const MARKET_X = 4030;
const POI_RANGE = 200;
/** 三个视差层整体下沉量：把土层剖面压缩到只露 76px（正好两行按钮），
 *  角色/布景/面板全部随之贴近窗口底边。 */
const GROUND_SHIFT = 56;
/** 缩放映射视高：下沉后最高场景物约 ≤390，视高收紧让画面再放大一档 */
const VIEW_H = 420;
/** 记住用户上次拉到的后院窗口高度（与 App.tsx storedBackyardHeight 共用 key）。
 *  只在卸载时落一次"停靠后的最终高度"，不逐帧写入——进入瞬间先测到的是上一
 *  面板的窗口高（调试 560 / 菜单 428），逐帧写盘会被 dock 读回放大画面。 */
const BACKYARD_HEIGHT_KEY = "gulugulu.backyardHeight.v2";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

type PlacedPet = {
  pet: PetInstance;
  spot: { x: number; bottom: number; size: number; float?: boolean };
};

type PoiSides = { shop: "left" | "right"; museum: "left" | "right"; market: "left" | "right" };

export type UseBackyardMotionInput = {
  onWalkingChange: (walking: boolean) => void;
  placedPetsRef: MutableRefObject<PlacedPet[]>;
  dismissGuide: () => void;
  dismissGuideRef: MutableRefObject<() => void>;
  charSize: number;
  spawnX: number;
  stageH: number;
};

export function useBackyardMotion({
  onWalkingChange,
  placedPetsRef,
  dismissGuide,
  dismissGuideRef,
  charSize,
  spawnX,
  stageH,
}: UseBackyardMotionInput) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const farRef = useRef<HTMLDivElement | null>(null);
  const midRef = useRef<HTMLDivElement | null>(null);
  const nearRef = useRef<HTMLDivElement | null>(null);
  const charRef = useRef<HTMLDivElement | null>(null);
  const charFaceRef = useRef<HTMLDivElement | null>(null);

  const [walking, setWalking] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [museumOpen, setMuseumOpen] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);
  // 面板开在建筑相对主角的另一侧（靠近瞬间按主角方位定侧，贴地展开不再被窗顶裁切）
  const [poiSides, setPoiSides] = useState<PoiSides>(
    { shop: "right", museum: "right", market: "right" },
  );
  const [nearPetId, setNearPetId] = useState<string | null>(null);
  // 视口尺寸（跟随用户拉伸窗口）：高度决定整体缩放，宽度决定画卷可见范围
  const [view, setView] = useState({ w: 760, h: stageH });

  // rAF 循环读取的世界状态全部放 ref，避免逐帧 setState。
  const motionRef = useRef({ charX: spawnX, target: null as number | null, facing: 1, camX: 0, walking: false });
  const keysRef = useRef({ left: false, right: false });
  const shopOpenRef = useRef(false);
  const museumOpenRef = useRef(false);
  const marketOpenRef = useRef(false);
  const nearPetRef = useRef<string | null>(null);
  const onWalkingChangeRef = useRef(onWalkingChange);

  useEffect(() => {
    onWalkingChangeRef.current = onWalkingChange;
  }, [onWalkingChange]);

  // 场景卸载时把"行走中"复位，避免 App 的喂食队列被卡住。
  useEffect(() => {
    return () => onWalkingChangeRef.current(false);
  }, []);

  // 视口跟踪：用户拉伸窗口时更新缩放/画卷宽度，并记住高度供下次停靠。
  const viewScale = Math.max(0.35, view.h / VIEW_H);
  const stageW = Math.max(320, view.w / viewScale);
  const stageRefValues = useRef({ stageW, scale: viewScale });
  useEffect(() => {
    stageRefValues.current = { stageW, scale: viewScale };
  }, [stageW, viewScale]);

  // 后院最终高度：卸载时落盘。只记停靠/拉伸后的稳定值，不记进入瞬间的过渡值。
  const lastHeightRef = useRef(0);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) {
        lastHeightRef.current = Math.round(h);
        setView((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      observer.disconnect();
      // 窗口此刻已停靠到位（或被用户手动拉伸过），记录最终高度供下次进入按此
      // 停靠——各入口一致。不在测量循环里逐帧写盘：进入瞬间会先测到"上一面板
      // 窗口高"，若逐帧写盘会被 App 的 dock 读回，导致不同入口的后院大小不一致。
      if (lastHeightRef.current >= 240) {
        try {
          window.localStorage.setItem(BACKYARD_HEIGHT_KEY, String(lastHeightRef.current));
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // 主循环：行走 / 相机 / 视差 / 靠近检测（与设计稿 step() 一致）
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const step = (ts: number) => {
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;
      const motion = motionRef.current;
      const keys = keysRef.current;

      let dir = 0;
      if (keys.left && !keys.right) dir = -1;
      else if (keys.right && !keys.left) dir = 1;

      let moving = false;
      if (dir !== 0) {
        motion.target = null;
        motion.charX += dir * WALK_SPEED * dt;
        motion.facing = dir;
        moving = true;
      } else if (motion.target != null) {
        const dx = motion.target - motion.charX;
        if (Math.abs(dx) < 4) {
          motion.target = null;
        } else {
          const sign = Math.sign(dx);
          motion.charX += sign * Math.min(WALK_SPEED * dt, Math.abs(dx));
          motion.facing = sign;
          moving = true;
        }
      }
      motion.charX = clamp(motion.charX, CHAR_MIN, CHAR_MAX);

      // 相机以"世界单位"的画卷宽度取景（= 视口宽 / 整体缩放），可平移进两侧装饰带。
      const vw = stageRefValues.current.stageW;
      const camX = Math.max(WORLD_MIN, Math.min(motion.charX - vw / 2, WORLD_MAX - vw));
      motion.camX = camX;

      if (nearRef.current) nearRef.current.style.transform = `translate3d(${-camX}px,${GROUND_SHIFT}px,0)`;
      if (midRef.current) midRef.current.style.transform = `translate3d(${-camX * 0.55}px,${GROUND_SHIFT}px,0)`;
      if (farRef.current) farRef.current.style.transform = `translate3d(${-camX * 0.25}px,${GROUND_SHIFT}px,0)`;
      if (charRef.current) charRef.current.style.left = `${motion.charX - charSize / 2}px`;
      if (charFaceRef.current) charFaceRef.current.style.transform = motion.facing === -1 ? "scaleX(-1)" : "scaleX(1)";

      if (moving !== motion.walking) {
        motion.walking = moving;
        setWalking(moving);
        onWalkingChangeRef.current(moving);
      }

      const nearShop = Math.abs(motion.charX - SHOP_CENTER_X) < SHOP_NEAR_RANGE;
      if (nearShop !== shopOpenRef.current) {
        shopOpenRef.current = nearShop;
        setShopOpen(nearShop);
        if (nearShop) {
          const side = motion.charX < SHOP_CENTER_X ? "right" : "left";
          setPoiSides((prev) => (prev.shop === side ? prev : { ...prev, shop: side }));
        }
      }

      const nearMuseum = Math.abs(motion.charX - MUSEUM_X) < POI_RANGE;
      if (nearMuseum !== museumOpenRef.current) {
        museumOpenRef.current = nearMuseum;
        setMuseumOpen(nearMuseum);
        if (nearMuseum) {
          const side = motion.charX < MUSEUM_X ? "right" : "left";
          setPoiSides((prev) => (prev.museum === side ? prev : { ...prev, museum: side }));
        }
      }

      const nearMarket = Math.abs(motion.charX - MARKET_X) < POI_RANGE;
      if (nearMarket !== marketOpenRef.current) {
        marketOpenRef.current = nearMarket;
        setMarketOpen(nearMarket);
        if (nearMarket) {
          const side = motion.charX < MARKET_X ? "right" : "left";
          setPoiSides((prev) => (prev.market === side ? prev : { ...prev, market: side }));
        }
      }

      let bestId: string | null = null;
      let bestDistance = PET_NEAR_RANGE;
      for (const { pet, spot } of placedPetsRef.current) {
        const distance = Math.abs(motion.charX - spot.x);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestId = pet.id;
        }
      }
      if (bestId !== nearPetRef.current) {
        nearPetRef.current = bestId;
        setNearPetId(bestId);
      }

      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ← → / A D 连续移动
  useEffect(() => {
    const isLeftKey = (event: KeyboardEvent) => event.key === "ArrowLeft" || event.key === "a" || event.key === "A";
    const isRightKey = (event: KeyboardEvent) => event.key === "ArrowRight" || event.key === "d" || event.key === "D";
    const onKeyDown = (event: KeyboardEvent) => {
      if (isLeftKey(event)) {
        keysRef.current.left = true;
        dismissGuideRef.current();
        if (event.key.startsWith("Arrow")) event.preventDefault();
      } else if (isRightKey(event)) {
        keysRef.current.right = true;
        dismissGuideRef.current();
        if (event.key.startsWith("Arrow")) event.preventDefault();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (isLeftKey(event)) keysRef.current.left = false;
      else if (isRightKey(event)) keysRef.current.right = false;
    };
    // 失焦时 keyup 可能丢失（Alt+Tab 等），清空按键防止角色一直走
    const onBlur = () => {
      keysRef.current.left = false;
      keysRef.current.right = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  const walkToPointer = (event: ReactMouseEvent<HTMLDivElement>) => {
    const rect = rootRef.current?.getBoundingClientRect();
    const viewX = (event.clientX - (rect?.left ?? 0)) / stageRefValues.current.scale;
    motionRef.current.target = clamp(motionRef.current.camX + viewX, CHAR_MIN, CHAR_MAX);
    dismissGuide();
  };

  // 相机定位：把主角（=当前陪伴）瞬移到指定世界 X，下一帧 rAF 循环随之取景。
  // 融合消耗掉当前陪伴后，用它把视角定位到新陪伴原本的站位（而非把新陪伴凭空拽到
  // 玩家脚下）。清空寻路目标，避免刚定位又被上一次点击目标带走。
  const centerOnWorldX = useCallback((x: number) => {
    motionRef.current.charX = clamp(x, CHAR_MIN, CHAR_MAX);
    motionRef.current.target = null;
  }, []);

  // 主角当前世界 X（供就地融合演出在「点融合」瞬间锚定两亲的站位）。读 ref 不触发渲染。
  const readCharX = useCallback(() => motionRef.current.charX, []);

  return {
    rootRef,
    farRef,
    midRef,
    nearRef,
    charRef,
    charFaceRef,
    walking,
    shopOpen,
    museumOpen,
    marketOpen,
    poiSides,
    nearPetId,
    walkToPointer,
    centerOnWorldX,
    readCharX,
    view,
    stageW,
    viewScale,
  };
}
