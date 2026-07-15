import { type RefObject, useLayoutEffect, useRef, useState } from "react";
import type { UiMode } from "../../game/GamePanels";
import { clamp } from "../geometry";

type UseSpeechDropResult = {
  speechDrop: number;
  speechRef: RefObject<HTMLElement | null>;
};

/** —— 对话气泡贴头顶 ——
 *  舞台角色底部对齐、头顶高度随物种/体型变化（矮个头顶离窗口顶更远）。量出角色
 *  实际头顶的屏幕 Y，把气泡整体下移到「底缘刚好压在头顶上方」。用 getBBox（不受
 *  呼吸/摇摆等 CSS 形变影响）+ SVG 视口盒换算，避免动画帧导致的抖动；只在物种/
 *  界面切换与尺寸变化时重量，收敛后不再 setState（避免循环）。 */
export function useSpeechDrop(
  uiMode: UiMode,
  activePetSpecies: string | null,
  duckFacingRef: RefObject<HTMLDivElement | null>,
): UseSpeechDropResult {
  const [speechDrop, setSpeechDrop] = useState(0);
  const speechRef = useRef<HTMLElement | null>(null);
  const showStage = uiMode === "pet" || uiMode === "menu";

  useLayoutEffect(() => {
    if (!showStage) {
      setSpeechDrop(0);
      return;
    }
    const measure = () => {
      const facing = duckFacingRef.current;
      const speech = speechRef.current;
      if (!facing || !speech) return;
      // 当前实际生效的下移量：直接读 CSS 变量本身，永远与已渲染位置一致——即使
      // 一帧内多次测量（rAF + ResizeObserver 同帧触发）也不会与状态失步。
      const speechStyle = getComputedStyle(speech);
      const applied = parseFloat(speechStyle.getPropertyValue("--speech-drop")) || 0;
      const svg = facing.querySelector<SVGSVGElement>(".svg-sprite");
      const body = facing.querySelector<SVGGElement>(".svg-sprite-body");
      if (!svg || !body) {
        // 蛋（无 SVG 角色）或尚未挂载：气泡回到窗口顶部。
        if (applied !== 0) setSpeechDrop(0);
        return;
      }
      let bbox: DOMRect;
      try {
        bbox = body.getBBox();
      } catch {
        return; // 未布局完成时 getBBox 可能抛错，跳过这一帧。
      }
      const svgBox = svg.getBoundingClientRect();
      if (bbox.height <= 0 || svgBox.height <= 0) return;
      // viewBox 256²，preserveAspectRatio 默认 xMidYMid meet：把头顶（bbox.y）
      // 从 viewBox 单位换算到屏幕坐标。
      const unit = Math.min(svgBox.width, svgBox.height) / 256;
      const padY = (svgBox.height - 256 * unit) / 2;
      const headTop = svgBox.top + padY + bbox.y * unit;
      const speechBox = speech.getBoundingClientRect();
      // speechBox.bottom 含当前 translateY，而这个位移正被弹出/呼吸/过渡动画实时改动。
      // 旧算法拿它和「目标 applied」做增量收敛：若某帧测量撞上动画中途（底缘还没下移到位，
      // 但 --speech-drop 已跳到目标值），增量会把这段动画差当成尚需补的下移量，一步过冲、
      // 撞到 160 上限并卡住——气泡就掉到脸上。改为从 transform 矩阵反解出当前真实 translateY，
      // 还原「未下移」的底缘，再一次性算绝对下移量，与动画播放到哪一帧无关。
      const currentTranslateY = new DOMMatrixReadOnly(speechStyle.transform).m42;
      const naturalBottom = speechBox.bottom - currentTranslateY;
      const HEAD_GAP = 6; // 气泡底缘离头顶留的呼吸缝（尾巴顺势指向头顶）。
      const drop = clamp(headTop - HEAD_GAP - naturalBottom, 0, 160);
      if (Math.abs(drop - applied) > 0.5) setSpeechDrop(drop);
    };
    measure();
    // 首帧 SVG 可能还没定稿，下一帧再量一次兜底。
    const raf = requestAnimationFrame(measure);
    // 气泡文案行数变化（1↔3 行）改变自然底缘、角色换装改变头顶：观察尺寸变化重量。
    const observer = new ResizeObserver(() => measure());
    if (speechRef.current) observer.observe(speechRef.current);
    if (duckFacingRef.current) observer.observe(duckFacingRef.current);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [showStage, activePetSpecies, uiMode]);

  return { speechDrop, speechRef };
}
