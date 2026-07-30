// 《危楼打工记》横幅/仪式层(P3,GDD 04 §5/§6/§11):
// - 下班铃:KPI 达标自动收班瞬间(phase shift→shop)横幅 + 通知外层放彩带;
// - 检查日公告:开班(→shift)且 modifier≠none 时 2.5s 全屏公告卡
//   (⏱/🔋/🚩/🧾 图标 + 规则一句话;pointer-events:none 不挡投掷,只加亮);
// - 数量级里程碑:revenueTotal 跨 1e4/1e5/1e6/1e8 → 金光横扫 + 印章字,冷却 10s
//   (冷却内跨档先压着,下次营收变更再补演;v1 场内覆盖层实现,不走 fx 子窗口);
// - 首班教学四步气泡(仅第 1 班且非无限):①开班投掷 → ②首次落定 → ③首次两同
//   粘连 → ④首次达标；每步持续显示，直到对应条件达成。
// 本组件只做 React 声明式横幅;粒子/飞行物在 RoguePulseFx。

import { useCallback, useEffect, useRef, useState } from "react";
import { fmt } from "../../../i18n";
import { useT } from "../../../useT";
import { FACTORY_ROGUE } from "../../../i18n/factoryRogue";
import { kpiBonusFor, POWER_THROW_LIMIT, RUSH_WALL_MS } from "../rogueConfig";
import type { RunPhase, RunView, ShiftModifier } from "../rogueTypes";
import { emitPaperFx } from "../../../ui/PaperFx";

/** 里程碑门槛(任务书 §2:万/十万/百万/亿)。 */
const MILESTONES = [1e4, 1e5, 1e6, 1e8] as const;
const MILE_COOLDOWN_MS = 10_000;
const KPI_CEREMONY_MS = 3_200;
const OVERTIME_INTRO_MS = 1_000;
const KPI_NOTE_CHARS = ["K", "P", "I", "达", "成"] as const;
// UI may be remounted while a run is still alive (for example by StrictMode or a
// surrounding scene refresh). Keep the shift-clear receipt outside the component
// so the same run/shift can never replay its bell and confetti on a remount.
const celebratedShiftByRun = new WeakMap<object, number>();
const MOD_ICON: Record<Exclude<ShiftModifier, "none">, string> = {
  rush: "⏱",
  power: "🔋",
  wind: "🚩",
  audit: "🧾",
};

export function RogueBanners({
  runKey,
  view,
  cues,
  showFirstShiftTutorial,
  overtimeReady,
  onCelebrate,
  onOvertimeReady,
}: {
  /** Stable identity of the current RogueRun, used to dedupe shift-clear VFX. */
  runKey: object;
  view: RunView;
  /** 教学触发线(泵在 FactoryRogueScene 里点亮):首次落定 / 首次两同粘连。 */
  cues: { settled: boolean; samePair: boolean };
  /** 真实第一班已完成时关闭四步气泡，避免后续对局重复授课。 */
  showFirstShiftTutorial: boolean;
  /** KPI 达标便签仪式时通知外层放纸屑礼花。 */
  onCelebrate: (bonus: number) => void;
  /** 前两段仪式结束后解锁场景自动投放。 */
  onOvertimeReady: () => void;
  /** 自动投放是否已经解锁；未解锁时不显示常驻加班状态条。 */
  overtimeReady: boolean;
}) {
  const { lang } = useT();
  const R = FACTORY_ROGUE[lang];

  // ---- 班次节点:下班铃 + 检查日开班公告 ----
  const prevPhaseRef = useRef<RunPhase | null>(null);
  const [bellAt, setBellAt] = useState(0);
  const [announce, setAnnounce] = useState<{ at: number; mod: Exclude<ShiftModifier, "none"> } | null>(null);
  const [overtimeCeremony, setOvertimeCeremony] = useState<{
    stage: "kpi" | "overtime";
    at: number;
  } | null>(null);
  const overtimeReadyCbRef = useRef(onOvertimeReady);
  overtimeReadyCbRef.current = onOvertimeReady;

  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = view.phase;
    if (prev == null) return; // 首挂(开局第 1 班)无转场仪式
    if (prev === "shift" && view.phase === "overtime") {
      setOvertimeCeremony({ stage: "kpi", at: Date.now() });
      onCelebrate(kpiBonusFor(view.kpi));
      emitPaperFx({
        intensity: 3,
        preset: "factory",
        eventId: `factory-kpi:${view.shiftIndex}:${view.kpi}`,
      });
      if (view.shiftIndex === 1) setTut(null);
    }
    if (
      (prev === "shift" && view.phase === "settlement")
      || (prev === "overtime" && view.phase === "settlement")
    ) {
      if ((celebratedShiftByRun.get(runKey) ?? 0) >= view.shiftIndex) return;
      celebratedShiftByRun.set(runKey, view.shiftIndex);
      setBellAt(Date.now());
      emitPaperFx({
        intensity: 2,
        preset: "factory",
        eventId: `factory-shift:${view.shiftIndex}:${view.revenueTotal}`,
      });
      if (view.shiftIndex === 1) setTut(null); // 教学步④完成：首次达标
    }
    if (view.phase === "shift" && prev !== "shift" && view.modifier !== "none") {
      setAnnounce({ at: Date.now(), mod: view.modifier });
    }
    // 依赖只认 phase:modifier/shiftIndex 与 phase 同一次 bump 更新,闭包即最新值。
  }, [view.phase]); // eslint 无:有意只依赖 phase

  useEffect(() => {
    if (overtimeCeremony == null) return;
    if (overtimeCeremony.stage === "kpi") {
      const timer = window.setTimeout(() => {
        setOvertimeCeremony({ stage: "overtime", at: Date.now() });
      }, KPI_CEREMONY_MS);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => {
      setOvertimeCeremony(null);
      overtimeReadyCbRef.current();
    }, OVERTIME_INTRO_MS);
    return () => window.clearTimeout(timer);
  }, [overtimeCeremony]);

  useEffect(() => {
    if (bellAt === 0) return;
    const t = window.setTimeout(() => setBellAt(0), 2800);
    return () => window.clearTimeout(t);
  }, [bellAt]);

  useEffect(() => {
    if (announce == null) return;
    const t = window.setTimeout(() => setAnnounce(null), 2500);
    return () => window.clearTimeout(t);
  }, [announce]);

  // ---- 数量级里程碑(冷却 10s;冷却内先不庆,下次营收变更再补) ----
  const mileIdxRef = useRef(-1);
  const mileLastRef = useRef(0);
  const [mile, setMile] = useState<{ idx: number; at: number } | null>(null);
  useEffect(() => {
    let idx = -1;
    for (let i = 0; i < MILESTONES.length; i++) if (view.revenueTotal >= MILESTONES[i]) idx = i;
    if (idx <= mileIdxRef.current) return;
    const now = Date.now();
    if (now - mileLastRef.current < MILE_COOLDOWN_MS) return;
    mileIdxRef.current = idx;
    mileLastRef.current = now;
    setMile({ idx, at: now });
    emitPaperFx({
      intensity: 2,
      preset: "milestone",
      eventId: `factory-mile:${idx}:${MILESTONES[idx]}`,
    });
  }, [R.mile100k, R.mile100m, R.mile10k, R.mile1m, view.revenueTotal]);
  useEffect(() => {
    if (mile == null) return;
    const t = window.setTimeout(() => setMile(null), 3000);
    return () => window.clearTimeout(t);
  }, [mile]);

  // ---- 首班教学四步气泡 ----
  const tutFiredRef = useRef([false, false, false, false]);
  const [tut, setTut] = useState<{ step: number; at: number } | null>(null);
  const tutOnRef = useRef(false);
  tutOnRef.current = showFirstShiftTutorial && view.shiftIndex === 1 && !view.endless;
  const fireTut = useCallback((n: number) => {
    if (!tutOnRef.current || tutFiredRef.current[n]) return;
    tutFiredRef.current[n] = true;
    setTut({ step: n, at: Date.now() });
  }, []);
  useEffect(() => {
    fireTut(0); // 步①:开班(RunStage 每局挂载一次,挂载即第 1 班开工)
  }, [fireTut]);
  useEffect(() => {
    if (cues.settled) fireTut(1); // 步②:首次落定结算
  }, [cues.settled, fireTut]);
  useEffect(() => {
    if (cues.samePair) fireTut(2); // 步③:首次两同粘连
  }, [cues.samePair, fireTut]);
  useEffect(() => {
    if (view.stats.strikes > 0) fireTut(3); // 步④:首次罢工后，引导达成 KPI
  }, [fireTut, view.stats.strikes]);

  const tutTexts = [R.tutThrow, R.tutStack, R.tutSame, R.tutKpi];
  const mileTexts = [R.mile10k, R.mile100k, R.mile1m, R.mile100m];
  const modName: Record<Exclude<ShiftModifier, "none">, string> = {
    rush: R.modRush,
    power: R.modPower,
    wind: R.modWind,
    audit: R.modAudit,
  };
  const modRule: Record<Exclude<ShiftModifier, "none">, string> = {
    rush: fmt(R.modRushRule, { s: RUSH_WALL_MS / 1000 }),
    power: fmt(R.modPowerRule, { n: POWER_THROW_LIMIT }),
    wind: R.modWindRule,
    audit: R.modAuditRule,
  };

  return (
    <>
      {announce != null && (
        <div className="fr-announce" key={announce.at} aria-hidden="true">
          <div className="fr-announce-card">
            <span className="fr-announce-icon">{MOD_ICON[announce.mod]}</span>
            <span className="fr-announce-name">{modName[announce.mod]}</span>
            <span className="fr-announce-rule">{modRule[announce.mod]}</span>
          </div>
        </div>
      )}

      {bellAt > 0 && (
        <div className="fr-bell" key={bellAt} aria-hidden="true">
          🔔 {R.bellDone}
        </div>
      )}

      {overtimeCeremony?.stage === "kpi" && (
        <div className="fr-kpi-ceremony" key={overtimeCeremony.at} aria-live="assertive">
          <div className="fr-kpi-note-spray" aria-hidden="true">
            {Array.from({ length: 14 }, (_, i) => (
              <i key={i} className={`fr-kpi-scrap fr-kpi-scrap-${i + 1}`} />
            ))}
          </div>
          <div className="fr-kpi-note-word" aria-label="KPI 达成">
            {KPI_NOTE_CHARS.map((char, index) => (
              <span key={char} className={`fr-kpi-note fr-kpi-note-${index + 1}`}>
                {char}
              </span>
            ))}
            <div className="fr-kpi-note-stamp">KPI ACHIEVED!</div>
          </div>
          <div className="fr-kpi-bonus">
            <span>{R.kpiBonus}</span>
            <strong>+¥{kpiBonusFor(view.kpi)}</strong>
          </div>
        </div>
      )}

      {overtimeCeremony?.stage === "overtime" && (
        <div className="fr-overtime-intro" key={overtimeCeremony.at} aria-live="assertive">
          <span>⏱</span>
          <strong>{R.overtimeTitle}</strong>
        </div>
      )}

      {view.phase === "overtime" && overtimeReady && overtimeCeremony == null && (
        <div className="fr-overtime-banner" aria-live="polite">
          <strong>⏱ {R.overtimeStart}</strong>
          <span>{R.overtimeRemaining.replace("{n}", String(view.overtimeRemaining))}</span>
        </div>
      )}

      {mile != null && (
        <div className="fr-mile" key={mile.at} aria-hidden="true">
          <div className="fr-mile-sweep" />
          <div className="fr-mile-stamp">{mileTexts[mile.idx]}</div>
        </div>
      )}

      {tut != null && (
        <div className="fr-tut" data-tut-step={tut.step} key={tut.at}>
          <span className="guide-sticker-sprinkles" aria-hidden="true" />
          <span className="fr-tut-badge">{tut.step + 1}/4</span>
          <span>{tutTexts[tut.step]}</span>
        </div>
      )}
    </>
  );
}
