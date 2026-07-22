import { useEffect, useRef } from "react";
import type { CoachDirective, CoachTarget } from "./coachTypes";
import { CoachHand } from "./CoachHand";
import "./coach.css";

// 教练手势层（docs/gdd/OnboardingCoach.md §2/§6.2）：全窗口固定覆盖、pointer-events:none
// （非阻塞，绝不挡点击）。每帧按 `data-coach` 属性查目标 DOM 屏幕位置，锚定手指/键帽/箭头/环。
// **不渲染任何文字**——引导文案走现有对话气泡（App / charSay）。

function coachKey(t: CoachTarget): string {
  return t.petId ? `${t.kind}:${t.petId}` : t.kind;
}

const HAND_W = 44;
const HAND_H = 58;
// 走位方向箭头的估算尺寸（用于夹进视口 + 挂在主角身体侧的偏移）。
const ARROW_W = 40;
const ARROW_H = 40;
// 生物/蛋类目标不套高亮方框（太丑，#2）；环只留给按钮类小目标帮助定位。
const NO_RING = new Set<string>(["pet", "egg", "char", "placedPet"]);

export function CoachFx({ directive }: { directive: CoachDirective | null }) {
  const ringRef = useRef<HTMLDivElement>(null);
  const handRef = useRef<HTMLDivElement>(null);
  const handInnerRef = useRef<HTMLDivElement>(null);
  const keysRef = useRef<HTMLDivElement>(null);
  const edgeRef = useRef<HTMLDivElement>(null);
  const downRef = useRef<HTMLDivElement>(null);

  const key = directive ? coachKey(directive.target) : null;
  const gesture = directive?.gesture ?? null;
  const ring = directive?.ring ?? false;
  const kind = directive?.target.kind ?? null;

  useEffect(() => {
    if (!directive || !key) return;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      let el: Element | null = null;
      document.querySelectorAll("[data-coach]").forEach((n) => {
        if (n.getAttribute("data-coach") === key) el = n;
      });
      const refs = [ringRef, handRef, keysRef, edgeRef, downRef];
      const hide = () => refs.forEach((r) => r.current && (r.current.style.opacity = "0"));
      if (!el) {
        hide();
        return;
      }
      const r = (el as Element).getBoundingClientRect();
      if (r.width === 0 && r.height === 0) {
        hide();
        return;
      }
      const cx = r.left + r.width / 2;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const off = r.right < 8 || r.left > vw - 8;
      const show = (n: HTMLElement | null, on: boolean, tf?: string) => {
        if (!n) return;
        n.style.opacity = on ? "1" : "0";
        if (on && tf) n.style.transform = tf;
      };

      // #2 环：生物/蛋不套框；按钮类小目标才给环
      const showRing = ring && !off && !(kind != null && NO_RING.has(kind));
      show(ringRef.current, showRing, `translate(${r.left - 6}px, ${r.top - 6}px)`);
      if (showRing && ringRef.current) {
        ringRef.current.style.width = `${r.width + 12}px`;
        ringRef.current.style.height = `${r.height + 12}px`;
      }

      // 手指：仅 tap / rapidTap（走位类不再用手指，见 #5）。
      const showHand = gesture === "tap" || gesture === "rapidTap";
      // #3 目标贴近视口底（手指放下方会被裁切）→ 翻到目标上方、指尖朝下压住按钮。
      const pointDown = showHand && r.bottom + HAND_H > vh - 2;
      const handTop = pointDown
        ? Math.max(2, r.top - HAND_H + 12)
        : Math.max(2, Math.min(r.bottom - 4, vh - HAND_H - 4));
      const handLeft = Math.max(2, Math.min(cx - HAND_W / 2, vw - HAND_W - 2));
      show(handRef.current, showHand, `translate(${handLeft}px, ${handTop}px)`);
      handInnerRef.current?.classList.toggle("is-down", pointDown);

      // #1 走位（arrow）时 ◀ A/D ▶ 固定在底部中央教「怎么移动」；keys/moveKeys 锚在目标上方。
      const isArrow = gesture === "arrow";
      if (isArrow) {
        show(keysRef.current, true, `translate(${vw / 2}px, ${vh - 46}px)`);
      } else {
        // #2 键帽放目标「脚下」（不再压在头顶气泡上）：贴 rect 底、夹进视口内。
        const showKeys = gesture === "keys" || gesture === "moveKeys";
        show(keysRef.current, showKeys && !off, `translate(${cx}px, ${Math.min(r.bottom - 4, vh - 34)}px)`);
      }

      // 方向箭头挂在主角身体的左/右外侧，指示目标此刻在主角哪一侧（不再贴屏幕边缘）：
      // 目标中心在主角右侧 → 右箭头挂身体右侧；反之左箭头挂左侧。走位类都在后院，锚
      // 元素恒为跟随主角（data-coach="char"）。
      let sideArrow = false;
      if (isArrow) {
        const charEl = document.querySelector('[data-coach="char"]');
        const cr = charEl?.getBoundingClientRect();
        if (cr && (cr.width > 0 || cr.height > 0)) {
          const charCx = cr.left + cr.width / 2;
          const toRight = cx >= charCx;
          const ax = toRight
            ? Math.min(cr.right + 4, vw - ARROW_W - 2)
            : Math.max(2, cr.left - 4 - ARROW_W);
          const ay = Math.max(4, Math.min(cr.top + cr.height / 2 - ARROW_H / 2, vh - ARROW_H - 4));
          sideArrow = true;
          show(edgeRef.current, true, `translate(${ax}px, ${ay}px) scaleX(${toRight ? 1 : -1})`);
        }
      }
      if (!sideArrow) show(edgeRef.current, false);
      show(downRef.current, false);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [directive, key, gesture, ring, kind]);

  if (!directive) return null;
  return (
    <div className="coach-fx" aria-hidden="true">
      <div ref={ringRef} className="coach-ring" style={{ opacity: 0 }} />
      <div ref={handRef} className="coach-hold" style={{ opacity: 0 }}>
        <div ref={handInnerRef} className={`coach-hand ${gesture === "rapidTap" ? "is-rapid" : ""}`}>
          <CoachHand />
        </div>
      </div>
      <div ref={keysRef} className="coach-hold" style={{ opacity: 0 }}>
        <div className="coach-keys">
          {gesture === "moveKeys" || gesture === "arrow" ? (
            <>
              <span className="coach-key">◀</span>
              <span className="coach-key">A / D</span>
              <span className="coach-key">▶</span>
            </>
          ) : (
            <span className="coach-key is-wide">⌨</span>
          )}
        </div>
      </div>
      <div ref={edgeRef} className="coach-hold" style={{ opacity: 0 }}>
        <div className="coach-arrow">➤</div>
      </div>
      <div ref={downRef} className="coach-hold" style={{ opacity: 0 }}>
        <div className="coach-arrow-down">▼</div>
      </div>
    </div>
  );
}
