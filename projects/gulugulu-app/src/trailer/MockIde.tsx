// 假 IDE 面板:静态代码 + agent 状态芯片。纯背景道具(不做打字机——打字机留给介绍
// 字幕)。末行留一个常驻闪烁光标,像真的编辑器。用于 cold-open / 实时反应 / 桌面公民段。
import type { CSSProperties } from "react";
import { trLang } from "./lang";
import { COPY } from "./copy";

type Tok = { c?: string; t: string };
const L = (...toks: Tok[]) => toks;

const CODE: Tok[][] = [
  L({ c: "tok-com", t: "// wiring the pet to your agent's activity" }),
  L({ c: "tok-key", t: "export function " }, { c: "tok-fn", t: "usePetStateMachine" }, { t: "() {" }),
  L({ t: "  " }, { c: "tok-key", t: "const" }, { t: " [state, dispatch] = " }, { c: "tok-fn", t: "useReducer" }, { t: "(reducer)" }),
  L({ t: "  " }, { c: "tok-fn", t: "useEffect" }, { t: "(() => " }, { c: "tok-fn", t: "listen" }, { t: "(" }, { c: "tok-str", t: '"codex://activity"' }, { t: "), [])" }),
  L({ t: "  " }, { c: "tok-key", t: "return" }, { t: " { state, " }, { c: "tok-fn", t: "onToken" }, { t: ", " }, { c: "tok-fn", t: "onError" }, { t: " }" }),
  L({ t: "}" }),
  L({ c: "tok-com", t: "// output tokens = XP · the duck eats" }),
  L({ t: "reactor.feed(" }, { c: "tok-num", t: "42" }, { t: ") " }, { c: "tok-com", t: "// nom" }),
];

// 状态芯片随语言切换(代码本身永远是英文——代码就是代码)。
const IDE = COPY[trLang()].ide;
export type IdeStatus = "thinking" | "tool" | "tokens" | "error";
const STATUS: Record<IdeStatus, { text: string; color?: string }> = {
  thinking: { text: IDE.thinking },
  tool: { text: IDE.tool },
  tokens: { text: IDE.tokens },
  error: { text: IDE.error, color: "#ff6b6b" },
};

export function MockIde({
  status,
  className,
  style,
}: {
  status?: IdeStatus;
  className?: string;
  style?: CSSProperties;
}) {
  const st = status ? STATUS[status] : undefined;
  return (
    <div className={`ide ${className ?? ""}`} style={style}>
      <div className="ide-bar">
        <span className="ide-dot" style={{ background: "#ff5f57" }} />
        <span className="ide-dot" style={{ background: "#febc2e" }} />
        <span className="ide-dot" style={{ background: "#28c840" }} />
        <span style={{ marginLeft: 10 }}>usePetStateMachine.ts</span>
      </div>
      <div className="ide-body">
        {CODE.map((line, li) => (
          <div className="ide-line" key={li}>
            {line.map((tok, ti) => (
              <span className={tok.c} key={ti}>
                {tok.t}
              </span>
            ))}
            {li === CODE.length - 1 && <span className="ide-caret" />}
          </div>
        ))}
      </div>
      {st && (
        <div className="agent-chip" style={st.color ? { color: st.color, borderColor: st.color } : undefined}>
          {status !== "error" && <span className="spin" />}
          {st.text}
        </div>
      )}
    </div>
  );
}
