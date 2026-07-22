import { type MouseEvent as ReactMouseEvent, useEffect, useState } from "react";
import {
  type AgentConnections,
  type GameConfig,
  type GameSave,
  type TokenBreakdown,
  type TokenRange,
  type TokenStats,
  breakdownTotal,
} from "../types";
import { type AllStrings, fmt } from "../i18n";
import { useT } from "../useT";
import { abs } from "./backyardShared";
import { formatCount } from "./format";
import { DailyLoveMeter } from "./EnergyBar";
import { FIXED_DEX_TOTAL, type PokedexModel } from "./pokedexData";
import type { AgentProvider } from "./useAgentConnections";

// ---------------------------------------------------------------------------
// 公告板：全局统计（Token / Agent 连接为主区，下方今日流水与图鉴）。
// 从 BackyardScene 抽出的纯展示块。「详情」按钮切到 Token 四分明细页（替换
// 整块内容，含返回；沿用主页选中的时间段）。
// AI 连接区常驻两行（Claude / Codex）：未连接给「连接」（开终端登录）、
// 已连接给「断开」（二次确认后登出本机 CLI）。
// ---------------------------------------------------------------------------

const AGENT_ORDER: AgentProvider[] = ["claude", "codex"];
const AGENT_NAMES: Record<AgentProvider, string> = { claude: "Claude", codex: "Codex" };

/** 累计 Token 时间窗按钮顺序：1d/1w/1m/all（默认 all）。 */
const RANGE_ORDER: TokenRange[] = ["d1", "w1", "m1", "all"];

/** 四分明细行的展示顺序 + 每类折算经验的喂养权重（与后端 tokenFeedWeights
 *  一致；2026-07-21 起 Token → 陪伴宠经验）。输入（权重 5，最滋补）领头，
 *  产出（×2）次之，读缓存（×0.01）垫底。 */
const BREAKDOWN_PARTS: { key: keyof TokenBreakdown; dot: string; weight: string }[] = [
  { key: "input", dot: "#c9822e", weight: "×5" },
  { key: "output", dot: "#57742e", weight: "×2" },
  { key: "cacheCreate", dot: "#7a6cc4", weight: "×0.2" },
  { key: "cacheRead", dot: "#9a8a70", weight: "×0.01" },
];

export type BackyardNoticeBoardProps = {
  /** 全局 Token 的多时间窗聚合（默认展示 all，玩家可切 1d/1w/1m）。 */
  tokenStats: TokenStats;
  save: GameSave;
  config: GameConfig;
  pokedexModel: PokedexModel;
  /** 开局探测到的 AI 连接态；null=尚未取到（此时行内显示「探测中」占位）。 */
  agentConnections: AgentConnections | null;
  /** 正在登录中的 provider。 */
  agentConnecting: Set<AgentProvider>;
  /** 正在登出中的 provider。 */
  agentDisconnecting: Set<AgentProvider>;
  /** 点击「连接」→ 打开终端跑登录。 */
  onConnectAgent: (provider: AgentProvider) => void;
  /** 点击「断开」（二次确认后）→ 登出本机 CLI。 */
  onDisconnectAgent: (provider: AgentProvider) => void;
};

export function BackyardNoticeBoard({
  tokenStats,
  save,
  config,
  pokedexModel,
  agentConnections,
  agentConnecting,
  agentDisconnecting,
  onConnectAgent,
  onDisconnectAgent,
}: BackyardNoticeBoardProps) {
  const { T } = useT();
  const bk = T.bk.notice;
  // 默认展示全局累计（all）；玩家点 1d/1w/1m 切到对应时间窗。
  const [range, setRange] = useState<TokenRange>("all");
  // 「详情」页开关：打开时四分明细替换整块公告板内容（含返回按钮）。
  const [detailOpen, setDetailOpen] = useState(false);
  // 断开二次确认：记住当前处于「确认断开?」态的 provider（点空白/超时自动取消）。
  const [confirmProvider, setConfirmProvider] = useState<AgentProvider | null>(null);

  // 「确认断开?」若无第二次点击，3.5s 后自动回落，避免误触后一直挂着红字。
  useEffect(() => {
    if (!confirmProvider) return;
    const timer = window.setTimeout(() => setConfirmProvider(null), 3500);
    return () => window.clearTimeout(timer);
  }, [confirmProvider]);

  // 点公告板空白处收起未确认的断开态。
  const boardClick = (event: ReactMouseEvent) => {
    event.stopPropagation();
    setConfirmProvider(null);
  };

  // 时间窗切换分段控件（详情页与主页共用同一 range 状态）。
  const rangeSwitch = (
    <div className="by-board-range" role="group">
      {RANGE_ORDER.map((key) => (
        <button
          key={key}
          type="button"
          className={`by-range-btn${range === key ? " is-active" : ""}`}
          aria-pressed={range === key}
          onClick={(event) => {
            event.stopPropagation();
            setRange(key);
          }}
        >
          {bk.range[key]}
        </button>
      ))}
    </div>
  );

  const boardStyle = abs({ left: 2240, bottom: 208, width: 348, height: 188, borderRadius: 14, border: "4px solid #6B4520", background: "linear-gradient(180deg,#B07B44,#96622F)", boxShadow: "0 12px 22px rgba(43,26,8,0.35)", boxSizing: "border-box", cursor: "default" });
  const cornerDots = null;

  if (detailOpen) {
    const win = tokenStats[range];
    const classified = breakdownTotal(win);
    // 明细账本晚于 raw 账本上线：total 里 breakdown 之外的差额显示为「未分类」。
    const unclassified = Math.max(0, win.total - classified);
    return (
      <div style={boardStyle} onClick={(event) => event.stopPropagation()}>
        <div className="by-board-inner by-board-detail">
          <div className="by-detail-head">
            <button
              type="button"
              className="by-detail-back"
              onClick={(event) => {
                event.stopPropagation();
                setDetailOpen(false);
              }}
            >
              ‹ {bk.detailBack}
            </button>
            {/* 标题即反映主页选中的时间段（今日/本周…），故详情页不再重复放切换控件。 */}
            <span className="by-detail-title">{fmt(bk.detailTitle, { range: bk.range[range] })}</span>
          </div>
          <div className="by-detail-rows">
            {BREAKDOWN_PARTS.map(({ key, dot, weight }) => (
              <div className="by-detail-row" key={key}>
                <span className="by-detail-dot" style={{ background: dot }} />
                <span className="by-detail-label">{bk.parts[key]}</span>
                <span className="by-detail-weight" title={bk.weightHint}>{weight}</span>
                <span className="by-detail-val">{formatCount(win[key])}</span>
              </div>
            ))}
            {unclassified > 0 && (
              <div className="by-detail-row is-muted">
                <span className="by-detail-dot" style={{ background: "#c4b79a" }} />
                <span className="by-detail-label">{bk.partsUnclassified}</span>
                <span className="by-detail-weight" />
                <span className="by-detail-val">{formatCount(unclassified)}</span>
              </div>
            )}
            <div className="by-detail-row is-total">
              <span className="by-detail-dot" style={{ background: "transparent" }} />
              <span className="by-detail-label">{bk.partsTotal}</span>
              <span className="by-detail-weight" />
              <span className="by-detail-val">{formatCount(win.total)}</span>
            </div>
          </div>
        </div>
        {cornerDots}
      </div>
    );
  }

  return (
    <div style={boardStyle} onClick={boardClick}>
      <div className="by-board-inner">
        <div className="by-board-main">
          <span className="by-board-token" title={bk.totalTokensTitle}>🍙 {formatCount(tokenStats[range].total)}</span>
          <div className="by-board-topline">
            <span className="by-board-token-label" title={bk.totalTokensTitle}>{bk.totalTokens}</span>
            <button
              type="button"
              className="by-board-detail-btn"
              onClick={(event) => {
                event.stopPropagation();
                setDetailOpen(true);
              }}
            >
              {bk.detailOpen}
            </button>
          </div>
          {rangeSwitch}
        </div>

        {/* AI 连接：两个并排按钮（Claude / Codex），标签自带名称 + 状态。 */}
        <div className="by-board-agents">
          {AGENT_ORDER.map((provider) => (
            <AgentButton
              key={provider}
              provider={provider}
              conn={agentConnections?.[provider] ?? null}
              connecting={agentConnecting.has(provider)}
              disconnecting={agentDisconnecting.has(provider)}
              confirming={confirmProvider === provider}
              bk={bk}
              onConnect={onConnectAgent}
              onRequestDisconnect={(p) => setConfirmProvider(p)}
              onConfirmDisconnect={(p) => {
                setConfirmProvider(null);
                onDisconnectAgent(p);
              }}
            />
          ))}
        </div>

        {/* 今日互动状态：爱心额度 + 满格一瞥（从左下常驻 HUD 迁入公告板，§6.2/§6.6） */}
        <div className="by-board-love-row">
          <span className="by-board-love" title={bk.loveTitle}>
            <span className="by-board-love-label">{bk.loveLabel}</span>
            <DailyLoveMeter clicks={save.daily.clicks} cap={config.dailyClickCap} showCount />
          </span>
        </div>
        <div className="by-board-grid">
          <span>{bk.tokenLine}</span>
          <span>
            {fmt(T.bk.dexProgress, { collected: pokedexModel.fixedCollected, total: FIXED_DEX_TOTAL })}
          </span>
        </div>
      </div>
      {cornerDots}
    </div>
  );
}

type AgentButtonProps = {
  provider: AgentProvider;
  /** null = 连接态尚未取到（探测中）。 */
  conn: AgentConnections[AgentProvider] | null;
  connecting: boolean;
  disconnecting: boolean;
  confirming: boolean;
  bk: AllStrings["bk"]["notice"];
  onConnect: (provider: AgentProvider) => void;
  onRequestDisconnect: (provider: AgentProvider) => void;
  onConfirmDisconnect: (provider: AgentProvider) => void;
};

/** 单个 provider 一个并排按钮：标签自带名称 + 状态（连接 {name} / {name} 已连接 /
 *  {name} 探测中… 等）。点击按当前态执行连接（开终端登录）或断开（二次确认后登出）。 */
function AgentButton({
  provider,
  conn,
  connecting,
  disconnecting,
  confirming,
  bk,
  onConnect,
  onRequestDisconnect,
  onConfirmDisconnect,
}: AgentButtonProps) {
  const name = AGENT_NAMES[provider];

  // 忙态（登出 / 登录 / 探测中）与未安装：禁用按钮，标签自带 {name} + 状态。
  if (disconnecting) {
    return (
      <button type="button" className="by-agent-btn is-busy" disabled>
        {fmt(bk.agentDisconnecting, { name })}
      </button>
    );
  }
  if (connecting) {
    return (
      <button type="button" className="by-agent-btn is-busy" disabled>
        {fmt(bk.agentConnecting, { name })}
      </button>
    );
  }
  if (!conn) {
    return (
      <button type="button" className="by-agent-btn is-busy" disabled>
        {fmt(bk.agentChecking, { name })}
      </button>
    );
  }
  if (!conn.installed) {
    return (
      <button type="button" className="by-agent-btn is-missing" disabled title={fmt(bk.agentNotInstalledHint, { name })}>
        {fmt(bk.agentNotInstalled, { name })}
      </button>
    );
  }
  if (conn.loggedIn) {
    // 已连接：绿色「{name} 已连接」（悬浮带账号）；点一下转红「确认断开?」，再点才登出。
    const connectedTitle = conn.account
      ? fmt(bk.agentConnectedTitle, { name, account: conn.account })
      : fmt(bk.agentConnected, { name });
    return (
      <button
        type="button"
        className={`by-agent-btn ${confirming ? "is-confirm" : "is-connected"}`}
        title={connectedTitle}
        onClick={(event) => {
          event.stopPropagation();
          if (confirming) onConfirmDisconnect(provider);
          else onRequestDisconnect(provider);
        }}
      >
        {confirming ? bk.agentDisconnectConfirm : fmt(bk.agentConnected, { name })}
      </button>
    );
  }
  // 已装未登录：橙色「连接 {name}」→ 开终端登录。
  return (
    <button
      type="button"
      className="by-agent-btn"
      title={fmt(bk.agentNeedsLoginTitle, { name })}
      onClick={(event) => {
        event.stopPropagation();
        onConnect(provider);
      }}
    >
      {fmt(bk.agentConnect, { name })}
    </button>
  );
}
