import { spawn } from "node:child_process";
import { createServer } from "node:net";

export const sleep = (milliseconds) => new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));

/** Ask Windows for an actually bindable loopback port instead of deriving one
 * from the PID. Hyper-V/WSL commonly reserve otherwise unused-looking ranges. */
export const findAvailablePort = () => new Promise((resolvePort, rejectPort) => {
  const server = createServer();
  server.unref();
  server.once("error", rejectPort);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    const port = typeof address === "object" && address != null ? address.port : null;
    server.close((error) => {
      if (error != null) rejectPort(error);
      else if (port == null) rejectPort(new Error("Loopback port allocation returned no port"));
      else resolvePort(port);
    });
  });
});

export const withTimeout = async (work, timeoutMs, label) => {
  let timer = null;
  try {
    return await Promise.race([
      Promise.resolve(work),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs} ms`)), timeoutMs);
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer != null) clearTimeout(timer);
  }
};

export const createStageRunner = (stageTimings, defaultTimeoutMs) => async (label, task, timeoutMs = defaultTimeoutMs) => {
  const startedAt = Date.now();
  console.log(`[stage:start] ${label}`);
  let status = "passed";
  try {
    return await withTimeout(Promise.resolve().then(task), timeoutMs, label);
  } catch (error) {
    status = "failed";
    throw error;
  } finally {
    const durationMs = Date.now() - startedAt;
    stageTimings.push({ label, status, durationMs, timeoutMs });
    console.log(`[stage:${status}] ${label} ${durationMs}ms`);
  }
};

export const fetchWithTimeout = async (url, timeoutMs = 2_000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

export const fetchJsonWithTimeout = async (url, timeoutMs = 2_000) => {
  const response = await fetchWithTimeout(url, timeoutMs);
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return await response.json();
};

export const waitForDebugEndpoint = async (child, url, {
  attempts = 100,
  intervalMs = 250,
  requestTimeoutMs = 2_000,
} = {}) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (child?.exitCode != null) break;
    try {
      const payload = await fetchJsonWithTimeout(url, requestTimeoutMs);
      if (payload.webSocketDebuggerUrl) return payload.webSocketDebuggerUrl;
    } catch {
      await sleep(intervalMs);
    }
  }
  return "";
};

export const waitForWebSocketEndpoint = (child, timeoutMs = 30_000) => {
  if (child == null) return Promise.reject(new Error("Browser process was not started"));
  return new Promise((resolveWait, rejectWait) => {
    let settled = false;
    let timer = null;
    let stderrTail = "";
    const finish = (error, endpoint = "") => {
      if (settled) return;
      settled = true;
      if (timer != null) clearTimeout(timer);
      child.stderr?.off("data", onData);
      child.off("exit", onExit);
      if (error != null) rejectWait(error);
      else resolveWait(endpoint);
    };
    const onData = (chunk) => {
      stderrTail = (stderrTail + chunk.toString()).slice(-8_000);
      const match = stderrTail.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match != null) finish(null, match[1]);
    };
    const onExit = (code, signal) => finish(new Error(`Browser exited before CDP became ready (code=${code}, signal=${signal})`));
    child.stderr?.on("data", onData);
    child.once("exit", onExit);
    timer = setTimeout(() => finish(new Error(`Browser CDP endpoint did not appear after ${timeoutMs} ms`)), timeoutMs);
    timer.unref?.();
  });
};

export const configurePageTimeouts = (page, {
  operationTimeoutMs = 30_000,
  navigationTimeoutMs = 90_000,
} = {}) => {
  page.setDefaultTimeout(operationTimeoutMs);
  page.setDefaultNavigationTimeout(navigationTimeoutMs);
};

export const waitForFonts = async (page, timeoutMs = 15_000, label = "document.fonts.ready") => withTimeout(
  page.evaluate(async () => {
    if (document.fonts == null) return "unsupported";
    await document.fonts.ready;
    return document.fonts.status;
  }),
  timeoutMs,
  label,
);

export const closePage = async (page, timeoutMs = 10_000) => {
  if (page == null || page.isClosed()) return;
  await withTimeout(page.close({ runBeforeUnload: false }), timeoutMs, "page.close");
};

export const waitForChildExit = (child, timeoutMs = 1_500) => {
  if (child == null || child.exitCode != null || child.signalCode != null) return Promise.resolve(true);
  return new Promise((resolveWait) => {
    let settled = false;
    let timer = null;
    const finish = (exited) => {
      if (settled) return;
      settled = true;
      if (timer != null) clearTimeout(timer);
      child.off("exit", onExit);
      resolveWait(exited);
    };
    const onExit = () => finish(true);
    child.once("exit", onExit);
    if (child.exitCode != null || child.signalCode != null) {
      finish(true);
      return;
    }
    timer = setTimeout(() => finish(false), timeoutMs);
    timer.unref?.();
  });
};

const processIsRunning = (pid) => {
  if (pid == null) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const waitForProcessExit = async (pid, timeoutMs) => {
  const deadline = Date.now() + timeoutMs;
  while (processIsRunning(pid) && Date.now() < deadline) await sleep(50);
  return !processIsRunning(pid);
};

export const stopChild = async (child, label = "child process") => {
  if (child == null || child.exitCode != null || child.signalCode != null || !processIsRunning(child.pid)) {
    return { label, method: "already-exited", exited: true };
  }

  if (process.platform === "win32" && child.pid != null) {
    const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    await waitForChildExit(killer, 5_000);
    const exited = await waitForProcessExit(child.pid, 3_000);
    if (!exited) throw new Error(`${label} (pid ${child.pid}) did not exit after taskkill /T /F`);
    return { label, method: "forced-tree", exited: true };
  }

  child.kill();
  if (await waitForChildExit(child, 1_500)) return { label, method: "graceful", exited: true };

  child.kill("SIGKILL");

  const exited = await waitForChildExit(child, 3_000);
  if (!exited) throw new Error(`${label} (pid ${child.pid ?? "unknown"}) did not exit after forced termination`);
  return { label, method: "forced", exited: true };
};
