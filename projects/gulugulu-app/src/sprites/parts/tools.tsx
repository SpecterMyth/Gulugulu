import type { ReactNode } from "react";
import { OUTLINE, type RigPalette } from "../rigTypes";
import { SproutWandTool } from "../kits/grassKit";
import { KeyboardTool } from "../kits/electricKit";
import { MopTool } from "../kits/waterKit";
import { SnowGlobeTool } from "../kits/iceKit";
import { TorchTool } from "../kits/fireKit";

// -----------------------------------------------------------------------------
// 27 件工作工具（计划 §1.3 工具三分类：白领办公 9 / 服务业 9 / 幻想 9）。
// 约定：局部坐标，pivot=(0,0)=握持点/落地支点，主体向上作画（-y 方向），
// 尺寸 ~40-64px 高。工具由 rig 放进 tool 槽，只在 working/laboring/success
// 状态淡入（.part-tool）。一阶六件（laptop/torch/keyboard/mop/sproutWand/
// snowGlobe）中后五件由各元素 kit 导出，在此处转注册。
// -----------------------------------------------------------------------------

export type ToolRenderer = (palette: RigPalette) => ReactNode;

/** 💼 笔记本电脑（guluduck） */
function laptop(): ReactNode {
  return (
    <g>
      <path d="M-26 0 L26 0 L20 -12 L-20 -12 Z" fill="#8E93A6" stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
      <path d="M-14 -4 h28 M-16 -8 h32" stroke="#5C6172" strokeWidth={2} strokeLinecap="round" />
      <path d="M-20 -12 L20 -12 L16 -46 L-16 -46 Z" fill="#3E4356" stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
      <path d="M-13 -17 L13 -17 L10.5 -41 L-10.5 -41 Z" fill="#BFE9FF" className="tool-glow" />
      <g stroke="#2E7BD6" strokeWidth={2} strokeLinecap="round">
        <path d="M-8 -36 h9" />
        <path d="M-7 -30 h13" />
        <path d="M-6 -24 h8" />
      </g>
    </g>
  );
}

/** 💼 签字钢笔 + 合同文件夹（guluswan） */
function fountainPen(): ReactNode {
  return (
    <g>
      <path d="M-24 0 L24 0 L20 -30 L-20 -30 Z" fill="#D9A514" stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
      <path d="M-16 -30 L-16 -36 L-2 -36 L2 -30 Z" fill="#D9A514" stroke={OUTLINE} strokeWidth={3.5} strokeLinejoin="round" />
      <path d="M-14 -8 h22 M-13 -14 h26 M-12 -20 h18" stroke="#FFF7DD" strokeWidth={2.6} strokeLinecap="round" />
      <g transform="translate(12 -26) rotate(38)">
        <path d="M-3 0 L3 0 L2.4 -26 L-2.4 -26 Z" fill="#2E2E36" stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
        <path d="M-2.4 0 L0 8 L2.4 0 Z" fill="#C8CCD8" stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round" />
      </g>
    </g>
  );
}

/** 🍳 中华炒锅（infernofox）：颠勺喷火大厨 */
function wok(): ReactNode {
  return (
    <g>
      <path d="M-26 -14 Q-24 4 0 4 Q24 4 26 -14 Z" fill="#3E4356" stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" />
      <path d="M26 -14 l16 -6" stroke={OUTLINE} strokeWidth={6} strokeLinecap="round" />
      <path d="M-20 -12 Q-18 -2 0 -2" fill="none" stroke="#5C6172" strokeWidth={3} strokeLinecap="round" />
      <g fill="#FFB03A" stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
        <circle cx={-8} cy={-28} r={4.5} />
        <circle cx={6} cy={-38} r={3.8} />
      </g>
      <path d="M-2 -20 q4 -4 0 -9 q6 3 4 9 q-2 3 -4 0 z" fill="#E85D3A" stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round" />
    </g>
  );
}

/** ✨ 雷神小锤（thunderking） */
function mjolnir(): ReactNode {
  return (
    <g>
      <path d="M-2.6 0 L2.6 0 L2.6 -26 L-2.6 -26 Z" fill="#8A6410" stroke={OUTLINE} strokeWidth={3.5} strokeLinejoin="round" />
      <path d="M-17 -26 L17 -26 L15 -48 L-15 -48 Z" fill="#8E93A6" stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" />
      <path d="M-17 -26 L-15 -48 M17 -26 L15 -48" stroke="#5C6172" strokeWidth={2.4} />
      <path d="M1 -44 l-5 8 h4 l-3 8" fill="none" stroke="#FFD93B" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M0 0 a4 3 0 1 0 0.1 0" fill="#D9A514" stroke={OUTLINE} strokeWidth={2.6} />
    </g>
  );
}

/** 🛟 救生圈（tidefrog） */
function lifebuoy(): ReactNode {
  return (
    <g transform="translate(0 -24)">
      <circle cx={0} cy={0} r={24} fill="#FFFFFF" stroke={OUTLINE} strokeWidth={4.5} />
      <circle cx={0} cy={0} r={11} fill="none" stroke={OUTLINE} strokeWidth={4} />
      <g fill="#E2432E" stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
        <path d="M-6 -24 a24 24 0 0 1 12 0 L4 -11 a11 11 0 0 0 -8 0 Z" />
        <path d="M-6 24 a24 24 0 0 0 12 0 L4 11 a11 11 0 0 1 -8 0 Z" />
        <path d="M-24 -6 a24 24 0 0 0 0 12 L-11 4 a11 11 0 0 1 0 -8 Z" />
        <path d="M24 -6 a24 24 0 0 1 0 12 L11 4 a11 11 0 0 0 0 -8 Z" />
      </g>
    </g>
  );
}

/** ✨ 炼金大锅（mycobeast） */
function cauldron(): ReactNode {
  return (
    <g>
      <g stroke={OUTLINE} strokeWidth={4} strokeLinecap="round">
        <path d="M-14 0 l-4 6 M14 0 l4 6" />
      </g>
      <path d="M-24 -34 Q-28 -6 0 -2 Q28 -6 24 -34 Q12 -28 0 -28 Q-12 -28 -24 -34 Z" fill="#3E4356" stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" />
      <path d="M-24 -34 Q0 -22 24 -34 Q26 -40 20 -40 Q0 -32 -20 -40 Q-26 -40 -24 -34 Z" fill="#57B84C" stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
      <g fill="#8CD97B" stroke={OUTLINE} strokeWidth={2.6}>
        <circle cx={-8} cy={-46} r={4} />
        <circle cx={7} cy={-52} r={3} />
      </g>
    </g>
  );
}

/** ✨ 冰霜权杖（glacierpeng） */
function iceScepter(): ReactNode {
  return (
    <g>
      <path d="M-2.4 0 L2.4 0 L2 -40 L-2 -40 Z" fill="#4FA6C9" stroke={OUTLINE} strokeWidth={3.5} strokeLinejoin="round" />
      <path d="M0 -62 L7 -50 L4 -40 L-4 -40 L-7 -50 Z" fill="#B0E5F0" stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
      <path d="M0 -58 L3 -50 L0 -44 L-3 -50 Z" fill="#F7FCFD" opacity={0.9} />
      <g stroke="#B0E5F0" strokeWidth={2.4} strokeLinecap="round">
        <path d="M-12 -56 l-4 -4 M12 -56 l4 -4" />
      </g>
    </g>
  );
}

/** 🍢 烧烤串（blazeduck） */
function skewer(): ReactNode {
  return (
    <g>
      <path d="M0 0 L0 -52" stroke="#8A6410" strokeWidth={3.5} strokeLinecap="round" />
      <g stroke={OUTLINE} strokeWidth={3.5} strokeLinejoin="round">
        <rect x={-7} y={-24} width={14} height={11} rx={3} fill="#E2803A" />
        <rect x={-7} y={-38} width={14} height={11} rx={3} fill="#8CD97B" />
        <rect x={-7} y={-52} width={14} height={11} rx={3} fill="#E2432E" />
      </g>
      <path d="M-3 -56 q3 -4 0 -8 q5 3 3 8 q-1 2 -3 0 z" fill="#FFB03A" stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
    </g>
  );
}

/** 💼 办公打印机（sparkduck）：卡纸中 */
function printer(): ReactNode {
  return (
    <g>
      <path d="M-24 0 L24 0 L24 -22 L-24 -22 Z" fill="#C8CCD8" stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
      <path d="M-18 -22 L18 -22 L14 -32 L-14 -32 Z" fill="#8E93A6" stroke={OUTLINE} strokeWidth={3.5} strokeLinejoin="round" />
      <path d="M-12 -22 L12 -22 L12 -44 L-12 -44 Z" fill="#FFFFFF" stroke={OUTLINE} strokeWidth={3.5} strokeLinejoin="round" transform="rotate(-8 0 -22)" />
      <path d="M-7 -30 h13 M-6 -36 h10" stroke="#8E93A6" strokeWidth={2.2} strokeLinecap="round" transform="rotate(-8 0 -22)" />
      <circle cx={16} cy={-11} r={3} fill="#8FD14F" stroke={OUTLINE} strokeWidth={2} />
      <path d="M-20 -8 h10" stroke="#5C6172" strokeWidth={2.4} strokeLinecap="round" />
    </g>
  );
}

/** 💼 办公室饮水机（rippleduck） */
function waterCooler(): ReactNode {
  return (
    <g>
      <path d="M-13 0 L13 0 L13 -34 L-13 -34 Z" fill="#E8E9EF" stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
      <path d="M-10 -34 L10 -34 L8 -52 Q0 -56 -8 -52 Z" fill="#9BDCFF" opacity={0.85} stroke={OUTLINE} strokeWidth={3.5} strokeLinejoin="round" />
      <path d="M-6 -44 Q0 -47 6 -44" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" fill="none" />
      <rect x={-8} y={-28} width={7} height={5} rx={2} fill="#2E7BD6" stroke={OUTLINE} strokeWidth={2.2} />
      <rect x={2} y={-28} width={7} height={5} rx={2} fill="#E2432E" stroke={OUTLINE} strokeWidth={2.2} />
      <circle cx={0} cy={-12} r={4} fill="#9BDCFF" stroke={OUTLINE} strokeWidth={2.4} />
    </g>
  );
}

/** 🌸 浇水壶（mossduck） */
function wateringCan(): ReactNode {
  return (
    <g>
      <path d="M-16 0 L10 0 L14 -24 L-20 -24 Z" fill="#8FD14F" stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
      <path d="M-18 -20 L-34 -34 L-30 -38 L-16 -26" fill="#8FD14F" stroke={OUTLINE} strokeWidth={3.5} strokeLinejoin="round" />
      <circle cx={-33} cy={-37} r={4.5} fill="#57B84C" stroke={OUTLINE} strokeWidth={3} />
      <path d="M8 -24 q12 -10 4 -20" fill="none" stroke={OUTLINE} strokeWidth={4} strokeLinecap="round" />
      <g fill="#9BDCFF" stroke={OUTLINE} strokeWidth={2}>
        <circle cx={-40} cy={-30} r={2.4} />
        <circle cx={-44} cy={-22} r={2} />
      </g>
    </g>
  );
}

/** 🍧 刨冰机（frostduck） */
function shavedIce(): ReactNode {
  return (
    <g>
      <path d="M-14 0 L14 0 L11 -10 L-11 -10 Z" fill="#C8CCD8" stroke={OUTLINE} strokeWidth={3.5} strokeLinejoin="round" />
      <path d="M-9 -10 Q0 -22 9 -10 Z" fill="#F7FCFD" stroke={OUTLINE} strokeWidth={3.5} strokeLinejoin="round" />
      <path d="M-3 -16 Q0 -19 3 -16" stroke="#B0E5F0" strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <path d="M-8 -22 L8 -22 L5 -40 L-5 -40 Z" fill="#8FD8E8" stroke={OUTLINE} strokeWidth={3.5} strokeLinejoin="round" />
      <path d="M5 -36 q12 0 12 8" fill="none" stroke={OUTLINE} strokeWidth={3.5} strokeLinecap="round" />
      <circle cx={17} cy={-26} r={3.4} fill="#E2432E" stroke={OUTLINE} strokeWidth={2.4} />
    </g>
  );
}

/** 💼 激光笔 + 幻灯遥控（plasmatanuki） */
function laserPointer(): ReactNode {
  return (
    <g>
      <g transform="rotate(-32)">
        <rect x={-4} y={-30} width={8} height={30} rx={4} fill="#3E4356" stroke={OUTLINE} strokeWidth={3.2} />
        <circle cx={0} cy={-22} r={2.2} fill="#8FD14F" />
        <path d="M0 -30 L0 -46" stroke="#E2432E" strokeWidth={2.6} strokeLinecap="round" strokeDasharray="4 3" />
        <circle cx={0} cy={-50} r={3.4} fill="#E2432E" opacity={0.9} />
      </g>
    </g>
  );
}

/** 👔 熨斗（steamander） */
function flatIron(): ReactNode {
  return (
    <g>
      <path d="M-24 0 Q-26 -4 -20 -6 L14 -6 Q24 -6 24 0 Z" fill="#8E93A6" stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
      <path d="M-12 -6 L10 -6 L10 -20 Q-2 -22 -8 -14 Z" fill="#2E7BD6" stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
      <path d="M-4 -13 h10" stroke="#EAF7FF" strokeWidth={2.4} strokeLinecap="round" />
      <g fill="#EAF7FF" opacity={0.9}>
        <circle cx={-20} cy={-14} r={3.4} />
        <circle cx={-26} cy={-22} r={2.6} />
        <circle cx={-19} cy={-28} r={2} />
      </g>
    </g>
  );
}

/** ✨ 余烬灯笼（cinderleaf） */
function emberLantern(): ReactNode {
  return (
    <g>
      <path d="M0 -46 a7 7 0 1 1 0.1 0 M0 -46 v6" fill="none" stroke={OUTLINE} strokeWidth={3.2} strokeLinecap="round" />
      <path d="M-11 -40 h22 l-3 -5 h-16 z" fill="#3E4356" stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
      <path d="M-13 -40 Q-16 -20 -8 -4 L8 -4 Q16 -20 13 -40 Z" fill="#FFE9AD" opacity={0.92} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
      <path d="M-10 0 h20 l-2 -4 h-16 z" fill="#3E4356" stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
      <path d="M0 -14 q6 -6 0 -14 q9 5 6 14 a6 6 0 0 1 -12 0 q0 -3 6 0 z" fill="#E85D3A" stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round" />
      <circle cx={0} cy={-16} r={2.4} fill="#FFF1C9" />
    </g>
  );
}

/** 💼 空调遥控器（thermowolf）：冷热双修 */
function acRemote(): ReactNode {
  return (
    <g>
      <rect x={-11} y={-46} width={22} height={46} rx={7} fill="#F7FCFD" stroke={OUTLINE} strokeWidth={4} />
      <rect x={-7} y={-41} width={14} height={9} rx={2} fill="#8FD14F" opacity={0.7} stroke={OUTLINE} strokeWidth={2} />
      <circle cx={-4.5} cy={-24} r={3.4} fill="#E85D3A" stroke={OUTLINE} strokeWidth={2} />
      <circle cx={4.5} cy={-24} r={3.4} fill="#8FD8E8" stroke={OUTLINE} strokeWidth={2} />
      <rect x={-6} y={-15} width={12} height={4.5} rx={2} fill="#C8CCD8" stroke={OUTLINE} strokeWidth={2} />
      <rect x={-6} y={-8} width={12} height={4.5} rx={2} fill="#C8CCD8" stroke={OUTLINE} strokeWidth={2} />
    </g>
  );
}

/** ✨ 风暴魔杖（stormeel）：杖顶悬浮迷你乌云 */
function stormStaff(): ReactNode {
  return (
    <g>
      <path d="M-2.2 0 L2.2 0 L1.8 -36 L-1.8 -36 Z" fill="#8A6410" stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round" />
      <g transform="translate(0 -46)">
        <path d="M-14 0 a6 6 0 0 1 5 -8 a8 8 0 0 1 14 -2 a6 6 0 0 1 9 6 a5 5 0 0 1 -3 9 q-16 2 -22 0 a5 5 0 0 1 -3 -5 z" fill="#8E93A6" stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round" />
        <path d="M0 5 l-4 7 h3.4 l-3 7" fill="none" stroke="#FFD93B" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </g>
  );
}

/** 💼 客服耳麦（vinevolt）：立在身旁地面，藤蔓般的卷线拖在地上 */
function headset(): ReactNode {
  return (
    <g transform="translate(34 0)">
      <path d="M-18 -18 Q-18 -40 0 -40 Q18 -40 18 -18" fill="none" stroke={OUTLINE} strokeWidth={5} strokeLinecap="round" />
      <rect x={-23} y={-20} width={10} height={16} rx={4.5} fill="#57B84C" stroke={OUTLINE} strokeWidth={3.2} />
      <rect x={13} y={-20} width={10} height={16} rx={4.5} fill="#57B84C" stroke={OUTLINE} strokeWidth={3.2} />
      <path d="M-18 -8 Q-15 2 -4 1" fill="none" stroke={OUTLINE} strokeWidth={3.4} strokeLinecap="round" />
      <circle cx={-1} cy={1} r={3.6} fill="#FFD93B" stroke={OUTLINE} strokeWidth={2.4} />
      {/* 藤蔓卷线拖地 */}
      <path d="M18 -6 q8 4 4 8 q8 -2 8 5 q0 4 -6 4" fill="none" stroke="#8CD97B" strokeWidth={2.8} strokeLinecap="round" />
    </g>
  );
}

/** 💼 数位板 + 触控笔（auroramink） */
function tabletPen(): ReactNode {
  return (
    <g>
      <path d="M-24 0 L24 0 L18 -30 L-18 -30 Z" fill="#3E4356" stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
      <path d="M-17 -5 L17 -5 L13 -25 L-13 -25 Z" fill="#BFE9FF" />
      <path d="M-10 -12 Q-4 -20 2 -14 Q8 -8 12 -18" fill="none" stroke="#8FD8E8" strokeWidth={2.8} strokeLinecap="round" />
      <path d="M-10 -12 Q-4 -20 2 -14" fill="none" stroke="#FFD93B" strokeWidth={2.8} strokeLinecap="round" opacity={0.85} />
      <g transform="translate(20 -34) rotate(30)">
        <rect x={-2.4} y={0} width={4.8} height={20} rx={2.4} fill="#FFD93B" stroke={OUTLINE} strokeWidth={2.6} />
        <path d="M-2.4 20 L0 26 L2.4 20 Z" fill="#3E4356" stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
      </g>
    </g>
  );
}

/** 🎣 长柄捞网（lotusturtle） */
function pondNet(): ReactNode {
  return (
    <g>
      <path d="M0 0 L14 -40" stroke="#8A6410" strokeWidth={3.6} strokeLinecap="round" />
      <ellipse cx={19} cy={-52} rx={14} ry={13} fill="none" stroke={OUTLINE} strokeWidth={3.6} transform="rotate(20 19 -52)" />
      <g stroke="#8E93A6" strokeWidth={1.8} opacity={0.85}>
        <path d="M8 -48 q11 -3 22 -1 M9 -55 q10 -4 21 -2 M13 -62 q8 -2 15 0" fill="none" />
        <path d="M12 -44 q2 -10 4 -18 M19 -42 q2 -11 3 -21 M26 -44 q1 -9 1 -17" fill="none" />
      </g>
      <circle cx={30} cy={-40} r={2.6} fill="#9BDCFF" stroke={OUTLINE} strokeWidth={1.8} />
    </g>
  );
}

/** ✨ 水晶球（floeseal） */
function crystalBall(): ReactNode {
  return (
    <g>
      <path d="M-14 0 L14 0 L10 -8 L-10 -8 Z" fill="#4FA6C9" stroke={OUTLINE} strokeWidth={3.5} strokeLinejoin="round" />
      <circle cx={0} cy={-26} r={19} fill="#DFF4FA" opacity={0.85} stroke={OUTLINE} strokeWidth={4} />
      <path d="M-8 -34 a11 11 0 0 1 6 -4" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" fill="none" />
      <path d="M-6 -22 q6 -8 12 0 q-6 6 -12 0 z" fill="#9BDCFF" opacity={0.8} />
      <path d="M8 -40 l2 -4 M12 -34 l4 -2" stroke="#B0E5F0" strokeWidth={2.2} strokeLinecap="round" />
    </g>
  );
}

/** ✨ 魔法毛线球（frostbunny）：悬浮毛线针自动织围巾 */
function yarnBall(): ReactNode {
  return (
    <g>
      <circle cx={0} cy={-14} r={14} fill="#B0E5F0" stroke={OUTLINE} strokeWidth={4} />
      <g stroke="#4FA6C9" strokeWidth={2.4} fill="none" strokeLinecap="round">
        <path d="M-12 -20 Q0 -26 12 -18 M-13 -12 Q0 -18 13 -10 M-10 -5 Q0 -12 11 -4" />
      </g>
      <g transform="translate(4 -34)">
        <path d="M-14 6 L10 -12 M-6 12 L16 -6" stroke="#8A6410" strokeWidth={3} strokeLinecap="round" />
        <circle cx={10} cy={-12} r={2.6} fill="#E2A52C" stroke={OUTLINE} strokeWidth={1.8} />
        <circle cx={16} cy={-6} r={2.6} fill="#E2A52C" stroke={OUTLINE} strokeWidth={1.8} />
      </g>
      <path d="M13 -8 Q26 -6 24 4 Q22 10 12 9" fill="none" stroke="#57B84C" strokeWidth={4.5} strokeLinecap="round" />
      <path d="M14 -3 h8 M13 3 h9" stroke="#8CD97B" strokeWidth={1.8} strokeLinecap="round" />
    </g>
  );
}

export const TOOLS: Record<string, ToolRenderer> = {
  laptop,
  fountainPen,
  wok,
  mjolnir,
  lifebuoy,
  cauldron,
  iceScepter,
  skewer,
  printer,
  waterCooler,
  wateringCan,
  shavedIce,
  laserPointer,
  flatIron,
  emberLantern,
  acRemote,
  stormStaff,
  headset,
  tabletPen,
  pondNet,
  crystalBall,
  yarnBall,
  // 一阶元素 kit 工具（各物种 rig 集成时补注册；签名不同的用包装函数适配）
  sproutWand: SproutWandTool,
  keyboard: (palette) => <KeyboardTool accent={palette.accent} />,
  mop: () => <MopTool />,
  snowGlobe: () => <SnowGlobeTool />,
  torch: () => <TorchTool />,
};

/** 元素 kit 的工具在集成阶段注册进来（避免 kit ↔ tools 循环依赖）。 */
export function registerKitTools(entries: Record<string, ToolRenderer>) {
  Object.assign(TOOLS, entries);
}
