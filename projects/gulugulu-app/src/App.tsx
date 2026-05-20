import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { currentMonitor, getCurrentWindow, PhysicalPosition } from "@tauri-apps/api/window";
import { type MouseEvent, type PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  normalizeCodexEvent,
  SLEEP_TIMEOUT_MS,
  stateAnimationMap,
  stateForPetEvent,
  transientStateDurationMs,
} from "./petEvents";
import { AnimationPlayer } from "./AnimationPlayer";
import type { CodexActivityEvent, CodexStatus, PetEvent, PetEventType, PetState, TokenUsage } from "./types";
import { isTauri } from "./tauri";
import quotesData from "../assets/text/ai_quotes.json";

const DRAG_THRESHOLD_PX = 4;
const AUTONOMOUS_MOVE_DELAY_MS = 18_000;
const AUTONOMOUS_MOVE_DURATION_MS = 1800;
const AUTONOMOUS_MOVE_PADDING_PX = 24;
const AUTONOMOUS_MOVE_CANDIDATE_COUNT = 36;
const STATUS_PANEL_VISIBLE_MS = 5_000;
const LANGUAGE_STORAGE_KEY = "gulugulu.language";

const emptyUsage: TokenUsage = {
  inputTokens: 0,
  cachedInputTokens: 0,
  outputTokens: 0,
  reasoningOutputTokens: 0,
  totalTokens: 0,
};

type DragState = {
  pointerId: number;
  startScreenX: number;
  startScreenY: number;
  active: boolean;
};

type ExpPop = {
  id: number;
  value: number;
  lane: number;
};

type PendingFed = {
  id: number;
  experienceDelta: number;
};

const interruptibleDuringSuccess = new Set<PetEventType>([
  "pet_idle",
  "user_click",
  "user_drag_start",
  "user_drag_move",
  "user_drag_end",
  "agent_error",
]);

type Language = "zh" | "en";

type QuoteEntry = {
  id: string;
  lang: Language;
  text: string;
  tags: string[];
};

type ContextMenuState = {
  x: number;
  y: number;
};

type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Direction = "left" | "right";

const quotes = quotesData.quotes as QuoteEntry[];
const quotesByLanguage: Record<Language, QuoteEntry[]> = {
  zh: quotes.filter((quote) => quote.lang === "zh"),
  en: quotes.filter((quote) => quote.lang === "en"),
};

const speechContextTags: Record<PetState, string[]> = {
  idle: ["assistant", "chatgpt", "meme", "sycophancy"],
  sleeping: ["disclaimer", "reasoning", "comfort"],
  clicked: ["meme", "sycophancy", "comfort"],
  drag_start: ["comfort", "apology", "meme"],
  dragging: ["comfort", "apology", "agent"],
  drop: ["apology", "meme", "agent"],
  moving: ["agent", "coding", "meme"],
  thinking: ["reasoning", "deepseek", "essay", "disclaimer"],
  working: ["coding", "agent", "claude", "overconfident"],
  success: ["coding", "agent", "overconfident", "meme"],
  fed: ["coding", "overconfident", "meme", "hallucination"],
  error: ["apology", "refusal", "safety", "hallucination"],
};

const speakingEventTypes = new Set<PetEventType>([
  "agent_thinking_start",
  "agent_work_finish",
  "user_click",
  "user_drag_end",
]);

const uiCopy: Record<
  Language,
  {
    languageLabel: string;
    simplifiedChinese: string;
    english: string;
    closePet: string;
    previewMode: string;
    codexOnline: string;
    findingCodex: string;
    statusError: string;
    tokens: string;
    last: string;
    exp: string;
    inOut: (inputTokens: string, outputTokens: string) => string;
    expPop: (value: string) => string;
    duckAlt: string;
  }
> = {
  zh: {
    languageLabel: "语言",
    simplifiedChinese: "简体中文",
    english: "English",
    closePet: "关闭宠物",
    previewMode: "预览模式",
    codexOnline: "Codex 在线",
    findingCodex: "寻找 Codex",
    statusError: "Codex 连接需要注意",
    tokens: "Tokens",
    last: "Lasts",
    exp: "Exp",
    inOut: (inputTokens, outputTokens) => `入 ${inputTokens} / 出 ${outputTokens}`,
    expPop: (value) => `Exp +${value}`,
    duckAlt: "咕噜咕噜小鸭",
  },
  en: {
    languageLabel: "Language",
    simplifiedChinese: "Simplified Chinese",
    english: "English",
    closePet: "Close pet",
    previewMode: "Preview mode",
    codexOnline: "Codex online",
    findingCodex: "Finding Codex",
    statusError: "Codex connection needs attention",
    tokens: "Tokens",
    last: "Last",
    exp: "Exp",
    inOut: (inputTokens, outputTokens) => `In ${inputTokens} / Out ${outputTokens}`,
    expPop: (value) => `Exp +${value}`,
    duckAlt: "Gulugulu duck",
  },
};

function makePetEvent(type: PetEventType): PetEvent {
  return {
    type,
    timestamp: new Date().toISOString(),
  };
}

function loadInitialLanguage(): Language {
  const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return savedLanguage === "en" || savedLanguage === "zh" ? savedLanguage : "zh";
}

function createQuoteDecks(): Record<Language, Set<string>> {
  return {
    zh: new Set(quotesByLanguage.zh.map((quote) => quote.id)),
    en: new Set(quotesByLanguage.en.map((quote) => quote.id)),
  };
}

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function chooseQuote(language: Language, state: PetState, decks: Record<Language, Set<string>>): string {
  const languageQuotes = quotesByLanguage[language];
  const tags = speechContextTags[state];
  let unusedIds = decks[language];

  if (unusedIds.size === 0) {
    unusedIds = new Set(languageQuotes.map((quote) => quote.id));
    decks[language] = unusedIds;
  }

  const unusedQuotes = languageQuotes.filter((quote) => unusedIds.has(quote.id));
  const contextualQuotes = unusedQuotes.filter((quote) => quote.tags.some((tag) => tags.includes(tag)));
  const candidates = contextualQuotes.length > 0 ? contextualQuotes : unusedQuotes;
  const selected = randomItem(candidates.length > 0 ? candidates : languageQuotes);
  unusedIds.delete(selected.id);
  return selected.text.replace("XXX", language === "zh" ? "状态" : "state");
}

function shouldSpeakForEvent(type: PetEventType): boolean {
  return speakingEventTypes.has(type);
}

function formatNumber(value: number): string {
  return value.toLocaleString();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function centerOf(bounds: Bounds): { x: number; y: number } {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}

function overlapArea(a: Bounds, b: Bounds): number {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

function randomBetween(min: number, max: number): number {
  if (max <= min) return min;
  return min + Math.random() * (max - min);
}

function chooseAutonomousTarget(currentBounds: Bounds, monitorBounds: Bounds, activeBounds?: Bounds | null): PhysicalPosition {
  const minX = monitorBounds.x + AUTONOMOUS_MOVE_PADDING_PX;
  const minY = monitorBounds.y + AUTONOMOUS_MOVE_PADDING_PX;
  const maxX = monitorBounds.x + monitorBounds.width - currentBounds.width - AUTONOMOUS_MOVE_PADDING_PX;
  const maxY = monitorBounds.y + monitorBounds.height - currentBounds.height - AUTONOMOUS_MOVE_PADDING_PX;
  const maxDistance = Math.max(1, monitorBounds.width / 5);
  const currentArea = currentBounds.width * currentBounds.height;
  const candidatePositions: PhysicalPosition[] = [];

  const addCandidate = (x: number, y: number) => {
    const targetX = clamp(x, minX, maxX);
    const targetY = clamp(y, minY, maxY);
    const deltaX = targetX - currentBounds.x;
    const deltaY = targetY - currentBounds.y;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance <= maxDistance) {
      candidatePositions.push(new PhysicalPosition(Math.round(targetX), Math.round(targetY)));
      return;
    }

    const ratio = maxDistance / distance;
    candidatePositions.push(
      new PhysicalPosition(
        Math.round(clamp(currentBounds.x + deltaX * ratio, minX, maxX)),
        Math.round(clamp(currentBounds.y + deltaY * ratio, minY, maxY)),
      ),
    );
  };

  if (activeBounds) {
    const avoidBounds: Bounds = {
      x: activeBounds.x - AUTONOMOUS_MOVE_PADDING_PX,
      y: activeBounds.y - AUTONOMOUS_MOVE_PADDING_PX,
      width: activeBounds.width + AUTONOMOUS_MOVE_PADDING_PX * 2,
      height: activeBounds.height + AUTONOMOUS_MOVE_PADDING_PX * 2,
    };
    const outsideZones = [
      { minX, maxX: avoidBounds.x - currentBounds.width, minY, maxY },
      { minX: avoidBounds.x + avoidBounds.width, maxX, minY, maxY },
      { minX, maxX, minY, maxY: avoidBounds.y - currentBounds.height },
      { minX, maxX, minY: avoidBounds.y + avoidBounds.height, maxY },
    ].filter((zone) => zone.maxX >= zone.minX && zone.maxY >= zone.minY);

    for (const zone of outsideZones) {
      addCandidate(randomBetween(zone.minX, zone.maxX), randomBetween(zone.minY, zone.maxY));
    }

    for (let index = 0; index < AUTONOMOUS_MOVE_CANDIDATE_COUNT; index += 1) {
      const zone = outsideZones.length > 0 ? randomItem(outsideZones) : null;
      if (zone) {
        addCandidate(randomBetween(zone.minX, zone.maxX), randomBetween(zone.minY, zone.maxY));
      }
    }
  }

  while (candidatePositions.length < AUTONOMOUS_MOVE_CANDIDATE_COUNT) {
    const angle = Math.random() * Math.PI * 2;
    const distance = maxDistance * (0.35 + Math.random() * 0.65);
    addCandidate(currentBounds.x + Math.cos(angle) * distance, currentBounds.y + Math.sin(angle) * distance);
  }

  const scoredCandidates = candidatePositions.map((position) => {
    const candidateBounds: Bounds = {
      x: position.x,
      y: position.y,
      width: currentBounds.width,
      height: currentBounds.height,
    };
    const activeOverlap = activeBounds ? overlapArea(candidateBounds, activeBounds) / currentArea : 0;
    const currentOverlap = activeBounds ? overlapArea(currentBounds, activeBounds) / currentArea : 0;
    const deltaX = position.x - currentBounds.x;
    const deltaY = position.y - currentBounds.y;
    const distance = Math.hypot(deltaX, deltaY);
    const movementScore = 1 - Math.abs(distance - maxDistance * 0.65) / maxDistance;
    const escapeScore = currentOverlap > 0 && activeOverlap < currentOverlap ? (currentOverlap - activeOverlap) * 800 : 0;
    const outsideScore = activeBounds && activeOverlap === 0 ? 1000 : 0;

    return {
      position,
      score: outsideScore + escapeScore + movementScore * 80 - activeOverlap * 2000 + Math.random() * 20,
    };
  });

  scoredCandidates.sort((a, b) => b.score - a.score);
  return scoredCandidates[0]?.position ?? new PhysicalPosition(currentBounds.x, currentBounds.y);
}

async function moveWindowAlongPath(
  target: PhysicalPosition,
  onDirectionChange: (direction: Direction) => void,
): Promise<void> {
  if (!isTauri()) return;

  const appWindow = getCurrentWindow();
  const start = await appWindow.outerPosition();
  const deltaX = target.x - start.x;
  const deltaY = target.y - start.y;
  onDirectionChange(deltaX < 0 ? "left" : "right");

  if (Math.abs(deltaX) < 2 && Math.abs(deltaY) < 2) return;

  await new Promise<void>((resolve) => {
    const startedAt = performance.now();

    const step = (now: number) => {
      const progress = clamp((now - startedAt) / AUTONOMOUS_MOVE_DURATION_MS, 0, 1);
      const eased = easeInOutCubic(progress);
      void appWindow.setPosition(
        new PhysicalPosition(Math.round(start.x + deltaX * eased), Math.round(start.y + deltaY * eased)),
      );

      if (progress < 1) {
        window.requestAnimationFrame(step);
        return;
      }

      resolve();
    };

    window.requestAnimationFrame(step);
  });
}

export default function App() {
  const [petState, setPetState] = useState<PetState>("idle");
  const [movementDirection, setMovementDirection] = useState<Direction>("right");
  const [language, setLanguage] = useState<Language>(() => loadInitialLanguage());
  const [speechLine, setSpeechLine] = useState(() => chooseQuote(loadInitialLanguage(), "idle", createQuoteDecks()));
  const [speechVisible, setSpeechVisible] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [status, setStatus] = useState<CodexStatus | null>(null);
  const [totalUsage, setTotalUsage] = useState<TokenUsage>(emptyUsage);
  const [lastUsage, setLastUsage] = useState<TokenUsage>(emptyUsage);
  const [projectTokens, setProjectTokens] = useState(0);
  const [lastTokenDelta, setLastTokenDelta] = useState(0);
  const [experience, setExperience] = useState(0);
  const [expPops, setExpPops] = useState<ExpPop[]>([]);
  const [pendingFedQueue, setPendingFedQueue] = useState<PendingFed[]>([]);
  const [lastEventAt, setLastEventAt] = useState(Date.now());
  const stateRef = useRef<PetState>("idle");
  const dragRef = useRef<DragState | null>(null);
  const dragEndTimerRef = useRef<number | null>(null);
  const expPopIdRef = useRef(0);
  const pendingFedIdRef = useRef(0);
  const playingFedRef = useRef(false);
  const seenTokenEventKeysRef = useRef<Set<string>>(new Set());
  const autonomousMovePlayedRef = useRef(false);
  const quoteDecksRef = useRef(createQuoteDecks());
  const statusPanelTimerRef = useRef<number | null>(null);
  const [statusPanelVisible, setStatusPanelVisible] = useState(false);

  const showSpeechForState = useCallback(
    (state: PetState) => {
      setSpeechLine(chooseQuote(language, state, quoteDecksRef.current));
      setSpeechVisible(true);
    },
    [language],
  );

  const dispatchPetEvent = useCallback((event: PetEvent) => {
    if (stateRef.current === "success" && !interruptibleDuringSuccess.has(event.type)) {
      return;
    }

    const nextState = stateForPetEvent(event);
    stateRef.current = nextState;
    setPetState(nextState);
    setLastEventAt(Date.now());

    if (shouldSpeakForEvent(event.type)) {
      showSpeechForState(nextState);
    }

    if (!event.type.startsWith("pet_move")) {
      autonomousMovePlayedRef.current = false;
    }
  }, [showSpeechForState]);

  const dispatchLocalEvent = useCallback(
    (type: PetEventType) => {
      dispatchPetEvent(makePetEvent(type));
    },
    [dispatchPetEvent],
  );

  const showStatusPanel = useCallback(() => {
    setStatusPanelVisible(true);
    if (statusPanelTimerRef.current !== null) {
      window.clearTimeout(statusPanelTimerRef.current);
    }
    statusPanelTimerRef.current = window.setTimeout(() => {
      setStatusPanelVisible(false);
      statusPanelTimerRef.current = null;
    }, STATUS_PANEL_VISIBLE_MS);
  }, []);

  const changeLanguage = useCallback(
    (nextLanguage: Language) => {
      setLanguage(nextLanguage);
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
      setSpeechLine(chooseQuote(nextLanguage, stateRef.current, quoteDecksRef.current));
      setContextMenu(null);
    },
    [],
  );

  const showExpPop = useCallback((value: number) => {
    const id = expPopIdRef.current + 1;
    expPopIdRef.current = id;
    setExpPops((items) => [...items.slice(-3), { id, value, lane: id % 3 }]);
    window.setTimeout(() => {
      setExpPops((items) => items.filter((item) => item.id !== id));
    }, 1500);
  }, []);

  const enqueueFed = useCallback((experienceDelta: number) => {
    const id = pendingFedIdRef.current + 1;
    pendingFedIdRef.current = id;
    setPendingFedQueue((items) => [...items, { id, experienceDelta }]);
  }, []);

  const startNextFedIfReady = useCallback(() => {
    if (playingFedRef.current || pendingFedQueue.length === 0) return;
    if (stateRef.current !== "idle" && stateRef.current !== "sleeping") return;

    const [nextFed, ...rest] = pendingFedQueue;
    playingFedRef.current = true;
    setPendingFedQueue(rest);
    showExpPop(nextFed.experienceDelta);
    dispatchPetEvent(makePetEvent("agent_token_gain"));
  }, [dispatchPetEvent, pendingFedQueue, showExpPop]);

  const finishDrag = useCallback(() => {
    const drag = dragRef.current;
    if (!drag?.active) return;

    if (dragEndTimerRef.current !== null) {
      window.clearTimeout(dragEndTimerRef.current);
      dragEndTimerRef.current = null;
    }

    dragRef.current = null;
    dispatchLocalEvent("user_drag_end");
  }, [dispatchLocalEvent]);

  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;

    invoke<CodexStatus>("get_codex_status")
      .then((nextStatus) => {
        if (disposed) return;
        setStatus(nextStatus);
        setProjectTokens(nextStatus.totalTokens);
        setExperience(nextStatus.experience);
        setTotalUsage((usage) => ({
          ...usage,
          totalTokens: nextStatus.totalTokens,
        }));
        if (nextStatus.error) dispatchLocalEvent("agent_error");
      })
      .catch(() => dispatchLocalEvent("agent_error"));

    const statusTimer = window.setInterval(() => {
      invoke<CodexStatus>("get_codex_status")
        .then((nextStatus) => {
          if (disposed) return;
          setStatus(nextStatus);
          setProjectTokens(nextStatus.totalTokens);
          setExperience(nextStatus.experience);
          setTotalUsage((usage) => ({
            ...usage,
            totalTokens: nextStatus.totalTokens,
          }));
        })
        .catch(() => undefined);
    }, 2000);

    let unlisten: (() => void) | undefined;
    listen<CodexActivityEvent>("codex://activity", (event) => {
      const payload = event.payload;

      if (payload.kind === "token_count") {
        const eventKey = [
          payload.source,
          payload.sessionId,
          payload.timestamp,
          payload.projectPath ?? "",
          payload.tokenDelta,
          payload.projectTotalTokens,
          payload.projectExperience,
        ].join("|");
        if (seenTokenEventKeysRef.current.has(eventKey)) return;

        seenTokenEventKeysRef.current.add(eventKey);
        if (seenTokenEventKeysRef.current.size > 80) {
          const [oldestKey] = seenTokenEventKeysRef.current;
          seenTokenEventKeysRef.current.delete(oldestKey);
        }
      }

      if (payload.kind !== "token_count") {
        dispatchPetEvent(normalizeCodexEvent(payload));
      }

      if (payload.totalUsage) {
        setTotalUsage(payload.totalUsage);
      }

      if (payload.lastUsage) {
        setLastUsage(payload.lastUsage);
      }

      if (payload.kind === "token_count") {
        setProjectTokens(payload.projectTotalTokens);
        setExperience(payload.projectExperience);
        setLastTokenDelta(payload.tokenDelta);
        if (!payload.lastUsage) {
          setLastUsage({
            ...emptyUsage,
            totalTokens: payload.tokenDelta,
          });
        }
        if (payload.tokenDelta > 0) {
          enqueueFed(payload.experienceDelta);
        }
      }

      invoke<CodexStatus>("get_codex_status")
        .then(setStatus)
        .catch(() => undefined);
    }).then((dispose) => {
      if (disposed) {
        dispose();
        return;
      }
      unlisten = dispose;
    });

    return () => {
      disposed = true;
      window.clearInterval(statusTimer);
      unlisten?.();
    };
  }, [dispatchLocalEvent, dispatchPetEvent, enqueueFed]);

  useEffect(() => {
    return () => {
      if (statusPanelTimerRef.current !== null) {
        window.clearTimeout(statusPanelTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void) | undefined;
    getCurrentWindow()
      .onMoved(() => {
        if (!dragRef.current?.active) return;

        if (stateRef.current !== "dragging") {
          dispatchLocalEvent("user_drag_move");
        }

        if (dragEndTimerRef.current !== null) {
          window.clearTimeout(dragEndTimerRef.current);
        }

        dragEndTimerRef.current = window.setTimeout(() => {
          finishDrag();
        }, 260);
      })
      .then((dispose) => {
        unlisten = dispose;
      })
      .catch(() => undefined);

    return () => {
      if (dragEndTimerRef.current !== null) {
        window.clearTimeout(dragEndTimerRef.current);
        dragEndTimerRef.current = null;
      }
      unlisten?.();
    };
  }, [dispatchLocalEvent, finishDrag]);

  useEffect(() => {
    if (!speechVisible) return;

    const timer = window.setTimeout(() => {
      setSpeechVisible(false);
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [speechLine, speechVisible]);

  useEffect(() => {
    if (!contextMenu) return;

    const closeMenu = () => setContextMenu(null);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };

    window.addEventListener("pointerdown", closeMenu);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (petState === "idle" || petState === "sleeping" || petState === "dragging" || petState === "error") return;

    const duration = transientStateDurationMs[petState] ?? 5000;
    const timer = window.setTimeout(() => dispatchLocalEvent("pet_idle"), duration);
    return () => window.clearTimeout(timer);
  }, [dispatchLocalEvent, lastEventAt, petState]);

  useEffect(() => {
    startNextFedIfReady();
  }, [pendingFedQueue, petState, startNextFedIfReady]);

  useEffect(() => {
    if (petState === "sleeping" || petState === "error" || petState === "dragging") return;

    const timer = window.setTimeout(() => {
      dispatchLocalEvent("pet_sleep_start");
    }, SLEEP_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [dispatchLocalEvent, lastEventAt, petState]);

  useEffect(() => {
    if (petState !== "idle" || autonomousMovePlayedRef.current) return;

    const timer = window.setTimeout(() => {
      if (stateRef.current !== "idle" || autonomousMovePlayedRef.current) return;

      autonomousMovePlayedRef.current = true;
      dispatchLocalEvent("pet_move_start");
      dispatchLocalEvent("pet_move");

      if (!isTauri()) {
        window.setTimeout(() => dispatchLocalEvent("pet_move_stop"), AUTONOMOUS_MOVE_DURATION_MS);
        return;
      }

      const appWindow = getCurrentWindow();
      Promise.all([
        appWindow.outerPosition(),
        appWindow.outerSize(),
        currentMonitor(),
        invoke<Bounds | null>("get_active_window_bounds").catch(() => null),
      ])
        .then(([position, size, monitor, activeBounds]) => {
          const monitorBounds: Bounds = monitor
            ? {
                x: monitor.position.x,
                y: monitor.position.y,
                width: monitor.size.width,
                height: monitor.size.height,
              }
            : {
                x: position.x - 320,
                y: position.y - 240,
                width: 1280,
                height: 720,
              };
          const currentBounds: Bounds = {
            x: position.x,
            y: position.y,
            width: size.width,
            height: size.height,
          };
          const target = chooseAutonomousTarget(currentBounds, monitorBounds, activeBounds);
          return moveWindowAlongPath(target, setMovementDirection);
        })
        .catch(() => undefined)
        .finally(() => {
          dispatchLocalEvent("pet_move_stop");
        });
    }, AUTONOMOUS_MOVE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [dispatchLocalEvent, lastEventAt, petState]);

  const statusText = useMemo(() => {
    const copy = uiCopy[language];
    if (!isTauri()) return copy.previewMode;
    if (status?.error) return language === "zh" ? copy.statusError : status.error;
    if (status?.codexWatching && status.claudeCodeWatching) {
      return language === "zh" ? "Codex + Claude Code 在线" : "Codex + Claude Code online";
    }
    if (status?.codexWatching) return copy.codexOnline;
    if (status?.claudeCodeWatching) {
      return language === "zh" ? "Claude Code 在线" : "Claude Code online";
    }
    if (status?.watching && status.activeSource === "claudeCode") {
      return language === "zh" ? "Claude Code 在线" : "Claude Code online";
    }
    if (status?.watching && status.activeSource && status.activeSource !== "codex") {
      return language === "zh" ? "Agent 在线" : "Agent online";
    }
    if (status?.watching) return copy.codexOnline;
    if (status?.claudeHome && !status?.codexHome) {
      return language === "zh" ? "寻找 Agent" : "Finding agent";
    }
    return copy.findingCodex;
  }, [language, status]);

  const animationKey = stateAnimationMap[petState];

  const handleAnimationComplete = useCallback(() => {
    if (stateRef.current === "fed") {
      playingFedRef.current = false;
      dispatchLocalEvent("pet_idle");
      window.setTimeout(startNextFedIfReady, 0);
      return;
    }

    if (
      stateRef.current === "clicked" ||
      stateRef.current === "drag_start" ||
      stateRef.current === "drop" ||
      stateRef.current === "success"
    ) {
      dispatchLocalEvent("pet_idle");
    }
  }, [dispatchLocalEvent, startNextFedIfReady]);

  const handlePointerDown = (event: PointerEvent<HTMLImageElement>) => {
    if (event.button === 2) return;
    event.currentTarget.setPointerCapture(event.pointerId);

    dragRef.current = {
      pointerId: event.pointerId,
      startScreenX: event.screenX,
      startScreenY: event.screenY,
      active: false,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLImageElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.screenX - drag.startScreenX;
    const deltaY = event.screenY - drag.startScreenY;
    const distance = Math.hypot(deltaX, deltaY);

    if (!drag.active && distance >= DRAG_THRESHOLD_PX) {
      drag.active = true;
      dispatchLocalEvent("user_drag_start");
      window.setTimeout(() => {
        if (dragRef.current?.pointerId === event.pointerId) {
          if (stateRef.current === "drag_start") {
            dispatchLocalEvent("user_drag_move");
          }
        }
      }, 80);
      if (isTauri()) {
        void getCurrentWindow()
          .startDragging()
          .catch(() => undefined);
      }
      return;
    }

    if (!drag.active || stateRef.current === "dragging") return;

    dispatchLocalEvent("user_drag_move");
  };

  const handlePointerUp = (event: PointerEvent<HTMLImageElement>) => {
    if (event.button === 2) return;
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Native window dragging can release pointer capture before React sees pointerup.
    }

    if (drag.active) {
      finishDrag();
      return;
    }

    dragRef.current = null;
    dispatchLocalEvent("user_click");
    showStatusPanel();
  };

  const handlePointerCancel = (event: PointerEvent<HTMLImageElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    finishDrag();
  };

  const handleContextMenu = (event: MouseEvent<HTMLImageElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = null;
    setContextMenu({
      x: Math.min(event.clientX, window.innerWidth - 178),
      y: Math.min(event.clientY, window.innerHeight - 124),
    });
  };

  const closePet = () => {
    setContextMenu(null);
    if (isTauri()) {
      void invoke("close_pet");
      return;
    }
    window.close();
  };

  const copy = uiCopy[language];

  return (
    <main className={`pet-shell state-${petState} facing-${movementDirection}`}>
      <section className={`speech ${speechVisible ? "is-visible" : "is-hidden"}`} data-tauri-drag-region>
        <span>{speechLine}</span>
      </section>

      <div className="pet-stage">
        <div className="exp-pop-layer" aria-hidden="true">
          {expPops.map((item) => (
            <span key={item.id} className={`exp-pop exp-pop-lane-${item.lane}`}>
              {copy.expPop(formatNumber(item.value))}
            </span>
          ))}
        </div>
        <div className="duck-facing">
          <AnimationPlayer
            key={`${animationKey}-${lastEventAt}`}
            className="duck"
            animationKey={animationKey}
            alt={copy.duckAlt}
            draggable={false}
            onContextMenu={handleContextMenu}
            onPointerCancel={handlePointerCancel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onComplete={handleAnimationComplete}
          />
        </div>
      </div>

      <section className="status-popover" data-visible={statusPanelVisible}>
        <div className="status-panel" data-tauri-drag-region>
          <section className="stats">
            <div>
              <span className="label">{copy.tokens}</span>
              <strong className="number-wide">{formatNumber(projectTokens)}</strong>
            </div>
            <div>
              <span className="label">{copy.last}</span>
              <strong className="number-compact">{formatNumber(lastTokenDelta)}</strong>
            </div>
            <div>
              <span className="label">{copy.exp}</span>
              <strong className="number-compact">{formatNumber(experience)}</strong>
            </div>
          </section>

          <section className="detail">
            <span>{statusText}</span>
            <span>{copy.inOut(formatNumber(totalUsage.inputTokens), formatNumber(totalUsage.outputTokens))}</span>
          </section>
        </div>
      </section>

      {contextMenu && (
        <nav
          className="pet-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="context-menu-group">
            <span className="context-menu-label">{copy.languageLabel}</span>
            <button
              className={language === "zh" ? "is-selected" : ""}
              type="button"
              onClick={() => changeLanguage("zh")}
            >
              {copy.simplifiedChinese}
            </button>
            <button
              className={language === "en" ? "is-selected" : ""}
              type="button"
              onClick={() => changeLanguage("en")}
            >
              {copy.english}
            </button>
          </div>
          <button className="context-menu-danger" type="button" onClick={closePet}>
            {copy.closePet}
          </button>
        </nav>
      )}
    </main>
  );
}
