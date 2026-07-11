import React, { type ChangeEvent, type ClipboardEvent, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";

type JobEventType =
  | "job_created"
  | "provider_started"
  | "provider_log"
  | "codex_started"
  | "codex_log"
  | "spec_ready"
  | "pose_sheet_ready"
  | "frames_ready"
  | "qa_ready"
  | "webp_ready"
  | "package_ready"
  | "failed";

type ProviderModel = { id: string; label?: string };

type ClientProvider = {
  id: string;
  label: string;
  kind: string;
  models: ProviderModel[];
  defaultModel?: string;
  requiresApiKey: boolean;
  apiKeyConfigured: boolean;
};

type ClientProviderConfig = {
  defaultProvider: string;
  providers: ClientProvider[];
};

type JobEvent = {
  type: JobEventType;
  jobId: string;
  timestamp: string;
  message: string;
  payload?: Record<string, unknown>;
};

type PreviewItem = {
  animation: string;
  poseSheetUrl?: string;
  firstFrameUrl?: string;
  webpUrl?: string;
  qaReportUrl?: string;
  frames?: number;
  fps?: number;
  loopAdjusted?: boolean;
  motionScore?: number;
  warnings?: string[];
};

const API_BASE = "";

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [sourcePreview, setSourcePreview] = useState<string | null>(null);
  const [mode, setMode] = useState<"single" | "fusion">("single");
  const [fileB, setFileB] = useState<File | null>(null);
  const [sourcePreviewB, setSourcePreviewB] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [standardDesignUrl, setStandardDesignUrl] = useState<string | null>(null);
  const [packageUrl, setPackageUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dataUrl, setDataUrl] = useState("");
  const [providerConfig, setProviderConfig] = useState<ClientProviderConfig | null>(null);
  const [providerError, setProviderError] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/providers`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("providers unavailable"))))
      .then((config: ClientProviderConfig) => {
        if (cancelled) return;
        setProviderError(false);
        setProviderConfig(config);
        const initial = config.providers.find((item) => item.id === config.defaultProvider) ?? config.providers[0];
        if (initial) {
          setSelectedProvider(initial.id);
          setSelectedModel(initial.defaultModel ?? initial.models[0]?.id ?? "");
        }
      })
      .catch(() => {
        if (!cancelled) setProviderError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeProvider = providerConfig?.providers.find((item) => item.id === selectedProvider) ?? null;
  const providerNeedsKey = Boolean(activeProvider?.requiresApiKey && !activeProvider.apiKeyConfigured);

  const handleProviderChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const providerId = event.target.value;
    setSelectedProvider(providerId);
    const provider = providerConfig?.providers.find((item) => item.id === providerId);
    setSelectedModel(provider?.defaultModel ?? provider?.models[0]?.id ?? "");
  };

  const previews = useMemo(() => {
    const items = new Map<string, PreviewItem>();
    for (const event of events) {
      const animation = event.payload?.animation;
      if (typeof animation !== "string") continue;
      const item = items.get(animation) ?? { animation };
      if (event.type === "pose_sheet_ready" && typeof event.payload?.imageUrl === "string") {
        item.poseSheetUrl = event.payload.imageUrl;
      }
      if (event.type === "frames_ready" && typeof event.payload?.firstFrameUrl === "string") {
        item.firstFrameUrl = event.payload.firstFrameUrl;
      }
      if (event.type === "qa_ready") {
        if (typeof event.payload?.reportUrl === "string") item.qaReportUrl = event.payload.reportUrl;
        if (typeof event.payload?.loopAdjusted === "boolean") item.loopAdjusted = event.payload.loopAdjusted;
        if (typeof event.payload?.motionScore === "number") item.motionScore = event.payload.motionScore;
        if (Array.isArray(event.payload?.warnings)) item.warnings = event.payload.warnings.map(String);
      }
      if (event.type === "webp_ready" && typeof event.payload?.webpUrl === "string") {
        item.webpUrl = event.payload.webpUrl;
        if (typeof event.payload.frames === "number") item.frames = event.payload.frames;
        if (typeof event.payload.fps === "number") item.fps = event.payload.fps;
      }
      items.set(animation, item);
    }
    return Array.from(items.values());
  }, [events]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setSelectedFile(selected);
  };

  const handlePaste = (event: ClipboardEvent<HTMLElement>) => {
    const imageItem = Array.from(event.clipboardData.items).find((item) => item.type.startsWith("image/"));
    const pastedFile = imageItem?.getAsFile() ?? null;
    if (!pastedFile) return;
    event.preventDefault();
    setSelectedFile(new File([pastedFile], "pasted-avatar.png", { type: pastedFile.type || "image/png" }));
  };

  const setSelectedFile = (selected: File | null) => {
    setFile(selected);
    setEvents([]);
    setJobId(null);
    setStandardDesignUrl(null);
    setPackageUrl(null);
    if (sourcePreview) URL.revokeObjectURL(sourcePreview);
    setSourcePreview(selected ? URL.createObjectURL(selected) : null);
  };

  const setSelectedFileB = (selected: File | null) => {
    setFileB(selected);
    setEvents([]);
    setJobId(null);
    setStandardDesignUrl(null);
    setPackageUrl(null);
    if (sourcePreviewB) URL.revokeObjectURL(sourcePreviewB);
    setSourcePreviewB(selected ? URL.createObjectURL(selected) : null);
  };

  const handleFileChangeB = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedFileB(event.target.files?.[0] ?? null);
  };

  const useDataUrl = () => {
    const match = dataUrl.trim().match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
    if (!match) return;
    const bytes = Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0));
    setSelectedFile(new File([bytes], "data-url-avatar.png", { type: match[1] }));
  };

  const startGeneration = async () => {
    if (!file || busy) return;
    if (mode === "fusion" && !fileB) return;
    setBusy(true);
    setEvents([]);
    setPackageUrl(null);
    setStandardDesignUrl(null);

    try {
      const form = new FormData();
      if (selectedProvider) form.append("provider", selectedProvider);
      if (selectedModel) form.append("model", selectedModel);
      let endpoint = `${API_BASE}/api/jobs`;
      if (mode === "fusion" && fileB) {
        form.append("imageA", file);
        form.append("imageB", fileB);
        endpoint = `${API_BASE}/api/fusions`;
      } else {
        form.append("image", file);
      }
      const response = await fetch(endpoint, { method: "POST", body: form });
      if (!response.ok) throw new Error(await response.text());
      const data = (await response.json()) as { jobId: string; eventsUrl: string };
      setJobId(data.jobId);

      eventSourceRef.current?.close();
      const source = new EventSource(data.eventsUrl);
      eventSourceRef.current = source;
      const eventTypes: JobEventType[] = [
        "job_created",
        "provider_started",
        "provider_log",
        "codex_started",
        "codex_log",
        "spec_ready",
        "pose_sheet_ready",
        "frames_ready",
        "qa_ready",
        "webp_ready",
        "package_ready",
        "failed",
      ];
      for (const type of eventTypes) {
        source.addEventListener(type, (message) => {
          const event = JSON.parse((message as MessageEvent).data) as JobEvent;
          setEvents((items) => {
            if (items.some((item) => item.type === event.type && item.timestamp === event.timestamp && item.message === event.message)) {
              return items;
            }
            return [...items, event];
          });
          if (event.type === "spec_ready" && typeof event.payload?.imageUrl === "string") {
            setStandardDesignUrl(event.payload.imageUrl);
          }
          if (event.type === "package_ready") {
            setBusy(false);
            source.close();
            if (typeof event.payload?.packageUrl === "string") setPackageUrl(event.payload.packageUrl);
          }
          if (event.type === "failed") {
            setBusy(false);
            source.close();
          }
        });
      }
      source.onerror = () => {
        // EventSource fires onerror on transient reconnects too. Only end the run
        // when the connection is truly closed; otherwise let it auto-reconnect
        // (the server replays buffered job events on reconnect).
        if (source.readyState === EventSource.CLOSED) {
          setBusy(false);
        }
      };
    } catch (error) {
      setBusy(false);
      setEvents((items) => [
        ...items,
        {
          type: "failed",
          jobId: jobId ?? "local",
          timestamp: new Date().toISOString(),
          message: error instanceof Error ? error.message : String(error),
        },
      ]);
    }
  };

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <h1>Gulugulu 自定义宠物</h1>
          <p>上传一张图片生成待机动画，或选择「融合两只」用两张参考图融合出一只新宠物。透明背景、平滑可循环。</p>
        </div>
        {jobId && <span className="job-id">{jobId}</span>}
      </header>

      <section className="upload-band" onPaste={handlePaste}>
        <div className="mode-switch">
          <button type="button" className={mode === "single" ? "is-selected" : ""} disabled={busy} onClick={() => setMode("single")}>
            单只形象
          </button>
          <button type="button" className={mode === "fusion" ? "is-selected" : ""} disabled={busy} onClick={() => setMode("fusion")}>
            融合两只
          </button>
        </div>
        <div className="drop-zones">
          <label className="drop-zone" tabIndex={0}>
            <input accept="image/png,image/jpeg,image/webp" type="file" onChange={handleFileChange} />
            {sourcePreview ? (
              <img src={sourcePreview} alt="参考图 A" />
            ) : (
              <span>{mode === "fusion" ? "宠物 A：选择或粘贴图片" : "选择 PNG / JPG / WebP，或直接粘贴图片"}</span>
            )}
          </label>
          {mode === "fusion" && (
            <label className="drop-zone" tabIndex={0}>
              <input accept="image/png,image/jpeg,image/webp" type="file" onChange={handleFileChangeB} />
              {sourcePreviewB ? <img src={sourcePreviewB} alt="参考图 B" /> : <span>宠物 B：选择图片</span>}
            </label>
          )}
        </div>
        <div className="actions">
          <label className="provider-field">
            <span>Provider</span>
            <select
              value={selectedProvider}
              disabled={busy || !providerConfig}
              onChange={handleProviderChange}
            >
              {providerConfig?.providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.label}
                </option>
              ))}
            </select>
          </label>
          {activeProvider && activeProvider.models.length > 0 && (
            <label className="provider-field">
              <span>Model</span>
              <select value={selectedModel} disabled={busy} onChange={(event) => setSelectedModel(event.target.value)}>
                {activeProvider.models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label ?? model.id}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            disabled={
              !file ||
              (mode === "fusion" && !fileB) ||
              busy ||
              !providerConfig ||
              !selectedProvider ||
              providerNeedsKey
            }
            onClick={() => void startGeneration()}
          >
            {busy ? (mode === "fusion" ? "融合中" : "生成中") : mode === "fusion" ? "融合宠物" : "生成待机动画"}
          </button>
          {packageUrl && (
            <a className="button-link secondary" href={packageUrl}>
              下载宠物包
            </a>
          )}
          {packageUrl && <span className="install-hint">回到桌宠右键菜单，点击"安装最近生成"。</span>}
        </div>
        {providerError && (
          <p className="provider-warning">无法加载 Provider 配置（/api/providers）。请确认生成服务正在运行，然后刷新页面。</p>
        )}
        {providerNeedsKey && (
          <p className="provider-warning">
            未检测到 {activeProvider?.label} 的 API Key。请在 projects/config/avatar-providers.json 填写 apiKey，或设置{" "}
            {activeProvider?.id === "openrouter" ? "OPENROUTER_API_KEY" : "对应"} 环境变量后重试。
          </p>
        )}
        <div className="data-url-box">
          <textarea
            value={dataUrl}
            placeholder="也可以粘贴图片 Data URL"
            onChange={(event) => setDataUrl(event.target.value)}
          />
          <button type="button" disabled={busy || !dataUrl.trim().startsWith("data:image/")} onClick={useDataUrl}>
            使用 Data URL
          </button>
        </div>
      </section>

      <section className="progress-layout">
        <aside className="timeline">
          {events.length === 0 ? <span className="empty">等待开始</span> : null}
          {events.map((event) => (
            <article key={`${event.timestamp}-${event.type}-${event.message}`} className={`event event-${event.type}`}>
              <strong>{event.type}</strong>
              <span>{event.message}</span>
              {(event.type === "codex_log" || event.type === "provider_log") && (
                <pre className="event-detail">{formatEventDetail(event)}</pre>
              )}
            </article>
          ))}
        </aside>

        <section className="preview-panel">
          {standardDesignUrl && (
            <article className="standard">
              <h2>标准设定图</h2>
              <img src={standardDesignUrl} alt="标准设定图" />
            </article>
          )}

          <div className="animation-grid">
            {previews.map((item) => (
              <article key={item.animation} className="animation-card">
                <h3>{item.animation}</h3>
                <div className="preview-row">
                  {item.poseSheetUrl && <img src={item.poseSheetUrl} alt={`${item.animation} pose sheet`} />}
                  {item.firstFrameUrl && <img src={item.firstFrameUrl} alt={`${item.animation} first frame`} />}
                  {item.webpUrl && (
                    <span className="sprite-stage">
                      <img
                        src={item.webpUrl}
                        alt={`${item.animation} webp`}
                        style={{
                          "--sprite-frames": String(Math.max(1, item.frames ?? 1)),
                          width: `${Math.max(1, item.frames ?? 1) * 100}%`,
                          animationDuration: `${Math.max(0.2, (item.frames ?? 1) / (item.fps ?? 16))}s`,
                          animationTimingFunction: `steps(${Math.max(1, (item.frames ?? 1) - 1)}, end)`,
                        } as React.CSSProperties}
                      />
                    </span>
                  )}
                </div>
                {item.qaReportUrl && (
                  <div className="qa-row">
                    <a href={item.qaReportUrl}>QA report</a>
                    <span>{item.loopAdjusted ? "首尾已校准" : "首尾自然循环"}</span>
                    {typeof item.motionScore === "number" && <span>motion {item.motionScore.toFixed(1)}</span>}
                  </div>
                )}
                {item.warnings && item.warnings.length > 0 && <p className="qa-warning">{item.warnings.join(" / ")}</p>}
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function formatEventDetail(event: JobEvent): string {
  const payload = event.payload ?? {};
  const parts: string[] = [];
  if (typeof payload.cwd === "string") parts.push(`cwd: ${payload.cwd}`);
  if (typeof payload.command === "string") parts.push(`command: ${payload.command}`);
  if (typeof payload.stdin === "string") parts.push(`stdin:\n${payload.stdin}`);
  if (typeof payload.text === "string") parts.push(payload.text);
  if (parts.length > 0) return parts.join("\n\n");
  return JSON.stringify(payload, null, 2);
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
