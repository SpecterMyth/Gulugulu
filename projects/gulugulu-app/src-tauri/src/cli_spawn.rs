use serde_json::Value;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant};

/// 在飞的 CLI 生成子进程 PID 注册表：应用退出时统一树杀，防生成中途关应用留下
/// `node.exe` 孤儿继续跑、白烧 API 额度（review 第 7 项）。进程内共享。
static LIVE_CHILDREN: OnceLock<Mutex<HashSet<u32>>> = OnceLock::new();

fn live_children() -> &'static Mutex<HashSet<u32>> {
    LIVE_CHILDREN.get_or_init(|| Mutex::new(HashSet::new()))
}

/// 树杀某个 PID 及其子树（Windows `taskkill /T`；其它平台 best-effort `kill -9`）。
fn kill_pid_tree(pid: u32) {
    #[cfg(windows)]
    {
        let _ = base_command("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
    #[cfg(not(windows))]
    {
        let _ = base_command("kill").args(["-9", &pid.to_string()]).status();
    }
}

/// 应用退出钩子调用：树杀所有仍在飞的 CLI 生成子进程（含其 node.exe 子树）。
/// 只覆盖优雅退出（关窗口 / 托盘退出）；硬杀应用不会走到这里（需 Job Object，从缺）。
pub(crate) fn kill_all_live_children() {
    let pids: Vec<u32> = live_children()
        .lock()
        .map(|set| set.iter().copied().collect())
        .unwrap_or_default();
    for pid in pids {
        kill_pid_tree(pid);
    }
}

/// 进程生命周期内登记一个在飞子进程；Drop 时自动注销（覆盖正常返回/超时/错误/panic）。
struct ChildGuard(u32);

impl ChildGuard {
    fn register(pid: u32) -> Self {
        if let Ok(mut set) = live_children().lock() {
            set.insert(pid);
        }
        ChildGuard(pid)
    }
}

impl Drop for ChildGuard {
    fn drop(&mut self) {
        if let Ok(mut set) = live_children().lock() {
            set.remove(&self.0);
        }
    }
}

// ---------------------------------------------------------------------------
// 通用 CLI spawn 工具集：Windows 安全地解析 / 探测 / 调用本地 CLI
// （claude / codex），供融合生成（fusion_gen）与语录生成（quote_gen）复用。
//
// Windows 关键约束：
// - cmd /C 包 .cmd/.bat 壳、CREATE_NO_WINDOW 防控制台黑框。
// - where 首行可能是无扩展名的 Git-Bash 壳，必须挑 .exe/.cmd/.bat/.com。
// - cmd /C 壳被杀后留孤儿 node.exe，需 taskkill /T 树杀。
// ---------------------------------------------------------------------------

const PROBE_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Provider {
    Claude,
    Codex,
}

impl Provider {
    pub(crate) fn name(self) -> &'static str {
        match self {
            Provider::Claude => "claude",
            Provider::Codex => "codex",
        }
    }
}

fn base_command(program: impl AsRef<std::ffi::OsStr>) -> Command {
    let cmd = Command::new(program);
    #[cfg(windows)]
    let cmd = {
        use std::os::windows::process::CommandExt;
        let mut cmd = cmd;
        // CREATE_NO_WINDOW：任何 CLI 调用都不许弹控制台黑框。
        cmd.creation_flags(0x0800_0000);
        cmd
    };
    cmd
}

/// npm 全局安装在 Windows 上是 .cmd 壳，必须经 cmd /C 才能启动。
fn cli_command(path: &Path) -> Command {
    #[cfg(windows)]
    {
        let is_batch = path
            .extension()
            .map(|ext| {
                let ext = ext.to_ascii_lowercase();
                ext == "cmd" || ext == "bat"
            })
            .unwrap_or(false);
        if is_batch {
            let mut cmd = base_command("cmd");
            cmd.arg("/C").arg(path);
            return cmd;
        }
    }
    base_command(path)
}

/// 在 PATH（where/which）和常见安装位置里找 CLI 可执行文件。
fn resolve_cli(name: &str) -> Option<PathBuf> {
    #[cfg(windows)]
    let finder = {
        let mut cmd = base_command("cmd");
        cmd.args(["/C", "where", name]);
        cmd
    };
    #[cfg(not(windows))]
    let finder = {
        let mut cmd = base_command("which");
        cmd.arg(name);
        cmd
    };
    let mut finder = finder;
    if let Ok(output) = finder.stdin(Stdio::null()).output() {
        if output.status.success() {
            let lines: Vec<PathBuf> = String::from_utf8_lossy(&output.stdout)
                .lines()
                .map(str::trim)
                .filter(|line| !line.is_empty())
                .map(PathBuf::from)
                .collect();
            if let Some(path) = pick_spawnable(&lines) {
                return Some(path);
            }
        }
    }

    let mut candidates: Vec<PathBuf> = Vec::new();
    #[cfg(windows)]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            candidates.push(PathBuf::from(&appdata).join("npm").join(format!("{name}.cmd")));
        }
        if let Ok(profile) = std::env::var("USERPROFILE") {
            let bin = PathBuf::from(&profile).join(".local").join("bin");
            candidates.push(bin.join(format!("{name}.exe")));
            candidates.push(bin.join(format!("{name}.cmd")));
        }
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            candidates.push(PathBuf::from(&local).join("Programs").join(name).join(format!("{name}.exe")));
        }
    }
    #[cfg(not(windows))]
    {
        if let Ok(home) = std::env::var("HOME") {
            candidates.push(PathBuf::from(&home).join(".local").join("bin").join(name));
            candidates.push(PathBuf::from(&home).join(".npm-global").join("bin").join(name));
        }
        candidates.push(PathBuf::from("/usr/local/bin").join(name));
        candidates.push(PathBuf::from("/opt/homebrew/bin").join(name));
    }
    candidates.into_iter().find(|path| path.exists())
}

/// 从 where/which 的候选行里挑真正能 spawn 的文件。
/// Windows 陷阱：npm 会同时装一个**无扩展名的 Git-Bash 壳**和 .cmd，
/// `where` 先返回前者——CreateProcess 无法执行它，必须优先取
/// .exe/.cmd/.bat/.com，兜底再试给无扩展名路径补扩展名。
fn pick_spawnable(candidates: &[PathBuf]) -> Option<PathBuf> {
    #[cfg(windows)]
    {
        const SPAWNABLE: [&str; 4] = ["exe", "cmd", "bat", "com"];
        for path in candidates {
            if !path.exists() {
                continue;
            }
            let ext = path.extension().map(|e| e.to_ascii_lowercase());
            if ext.map(|e| SPAWNABLE.iter().any(|s| e == *s)).unwrap_or(false) {
                return Some(path.clone());
            }
        }
        for path in candidates {
            for ext in SPAWNABLE {
                let with_ext = path.with_extension(ext);
                if with_ext.exists() {
                    return Some(with_ext);
                }
            }
        }
        None
    }
    #[cfg(not(windows))]
    {
        candidates.iter().find(|path| path.exists()).cloned()
    }
}

pub(crate) struct CliRunOutput {
    pub stdout: String,
    pub stderr: String,
    pub success: bool,
    pub timed_out: bool,
}

/// 超时/退出安全的 CLI 运行环：stdin 后台写入、stdout/stderr 双线程排水
/// （防管道写满死锁）、500ms try_wait 轮询、超时树杀。
fn run_cli_with_timeout(
    mut cmd: Command,
    stdin_data: Option<&str>,
    timeout: Duration,
) -> Result<CliRunOutput, String> {
    use std::io::Read;

    cmd.stdin(if stdin_data.is_some() { Stdio::piped() } else { Stdio::null() })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = cmd.spawn().map_err(|error| format!("无法启动命令：{error}"))?;
    // 登记 PID：应用退出时统一树杀，避免生成中途关应用留下 node.exe 孤儿。
    // _child_guard 在本函数任一返回路径（正常/超时/错误/panic）Drop 时注销。
    let _child_guard = ChildGuard::register(child.id());

    if let Some(data) = stdin_data {
        if let Some(mut stdin) = child.stdin.take() {
            let data = data.to_string();
            thread::spawn(move || {
                use std::io::Write;
                let _ = stdin.write_all(data.as_bytes());
                // drop 关闭管道 → CLI 收到 EOF
            });
        }
    }

    let stdout_handle = child.stdout.take().map(|mut pipe| {
        thread::spawn(move || {
            let mut buf = String::new();
            let _ = pipe.read_to_string(&mut buf);
            buf
        })
    });
    let stderr_handle = child.stderr.take().map(|mut pipe| {
        thread::spawn(move || {
            let mut buf = String::new();
            let _ = pipe.read_to_string(&mut buf);
            buf
        })
    });

    let started = Instant::now();
    let mut timed_out = false;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break Some(status),
            Ok(None) => {
                if started.elapsed() >= timeout {
                    timed_out = true;
                    kill_tree(&mut child);
                    break None;
                }
                thread::sleep(Duration::from_millis(500));
            }
            Err(error) => return Err(error.to_string()),
        }
    };

    let stdout = stdout_handle.and_then(|h| h.join().ok()).unwrap_or_default();
    let stderr = stderr_handle.and_then(|h| h.join().ok()).unwrap_or_default();
    Ok(CliRunOutput {
        stdout,
        stderr,
        success: status.map(|s| s.success()).unwrap_or(false),
        timed_out,
    })
}

/// Windows 上 cmd /C 壳被 kill 后会留下孤儿 node.exe，必须 taskkill /T 树杀。
fn kill_tree(child: &mut Child) {
    #[cfg(windows)]
    {
        let pid = child.id();
        let _ = base_command("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
    let _ = child.kill();
    let _ = child.wait();
}

/// 解析 CLI 并用 `--version` 探测其可用性，返回 (路径, 版本行)。
pub(crate) fn probe_cli(name: &str) -> Result<(PathBuf, String), String> {
    let path = resolve_cli(name).ok_or_else(|| "未找到命令（不在 PATH 或常见安装位置）".to_string())?;
    let mut cmd = cli_command(&path);
    cmd.arg("--version");
    let output = run_cli_with_timeout(cmd, None, PROBE_TIMEOUT)?;
    if output.timed_out {
        return Err("--version 探测超时".to_string());
    }
    if !output.success {
        let tail = tail_of(&output.stderr, 160);
        return Err(if tail.is_empty() { "--version 退出异常".to_string() } else { tail });
    }
    let version = output
        .stdout
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .unwrap_or("unknown")
        .to_string();
    Ok((path, version))
}

/// 真实登录态探测结果。比 `--version` 更强：过期/未刷新的 OAuth token
/// `--version` 照样过（融合会静默回退 codex），这里跑各家 auth-status 子命令。
pub(crate) struct LoginProbe {
    pub installed: bool,
    pub logged_in: bool,
    pub version: Option<String>,
    /// 账号标识（claude=email；codex=状态行文本）。
    pub account: Option<String>,
    pub error: Option<String>,
}

const AUTH_TIMEOUT: Duration = Duration::from_secs(12);

/// 探测某 provider 的**真实登录态**（先 `--version` 确认装机，再跑 auth-status）。
/// - claude：`claude auth status` → JSON `{"loggedIn":bool,"email":...}`
/// - codex：`codex login status` → stdout 含 "Logged in"
pub(crate) fn probe_login(provider: Provider) -> LoginProbe {
    let name = provider.name();
    let (path, version) = match probe_cli(name) {
        Ok(pair) => pair,
        Err(error) => {
            return LoginProbe {
                installed: false,
                logged_in: false,
                version: None,
                account: None,
                error: Some(error),
            };
        }
    };
    match provider {
        Provider::Claude => probe_claude_login(&path, version),
        Provider::Codex => probe_codex_login(&path, version),
    }
}

fn probe_claude_login(path: &Path, version: String) -> LoginProbe {
    let mut cmd = cli_command(path);
    cmd.args(["auth", "status"]);
    // Windows：auth status 同样依赖 Git-Bash，未配置时注入探测到的 bash。
    #[cfg(windows)]
    if std::env::var_os("CLAUDE_CODE_GIT_BASH_PATH").is_none() {
        if let Some(bash) = find_git_bash() {
            cmd.env("CLAUDE_CODE_GIT_BASH_PATH", bash);
        }
    }
    cmd.current_dir(neutral_cwd());
    match run_cli_with_timeout(cmd, None, AUTH_TIMEOUT) {
        Ok(out) => {
            let parsed = serde_json::from_str::<Value>(out.stdout.trim()).ok();
            let logged_in = parsed
                .as_ref()
                .and_then(|v| v.get("loggedIn"))
                .and_then(Value::as_bool)
                .unwrap_or(false);
            let account = parsed
                .as_ref()
                .and_then(|v| v.get("email"))
                .and_then(Value::as_str)
                .map(|s| s.to_string());
            LoginProbe {
                installed: true,
                logged_in,
                version: Some(version),
                account,
                error: if logged_in { None } else { Some("未登录或登录已过期".to_string()) },
            }
        }
        Err(error) => LoginProbe {
            installed: true,
            logged_in: false,
            version: Some(version),
            account: None,
            error: Some(error),
        },
    }
}

fn probe_codex_login(path: &Path, version: String) -> LoginProbe {
    let mut cmd = cli_command(path);
    cmd.args(["login", "status"]);
    cmd.current_dir(neutral_cwd());
    match run_cli_with_timeout(cmd, None, AUTH_TIMEOUT) {
        Ok(out) => {
            let hay = format!("{}\n{}", out.stdout, out.stderr).to_lowercase();
            let logged_in = out.success && hay.contains("logged in") && !hay.contains("not logged in");
            let account = out
                .stdout
                .lines()
                .map(str::trim)
                .find(|line| !line.is_empty())
                .map(|s| s.to_string());
            LoginProbe {
                installed: true,
                logged_in,
                version: Some(version),
                account: if logged_in { account } else { None },
                error: if logged_in { None } else { Some("未登录".to_string()) },
            }
        }
        Err(error) => LoginProbe {
            installed: true,
            logged_in: false,
            version: Some(version),
            account: None,
            error: Some(error),
        },
    }
}

/// 打开一个**可见**控制台窗口跑交互式登录（OAuth 需浏览器 + 可读终端）。
/// Windows：CREATE_NEW_CONSOLE 新开控制台，`cmd /K` 让窗口在登录结束后保留
/// （用户能看到成功/失败并自行关闭）。返回后前端轮询 check_agent_connections。
pub(crate) fn spawn_login_terminal(provider: Provider) -> Result<(), String> {
    let name = provider.name();
    let path = resolve_cli(name)
        .ok_or_else(|| format!("未找到 {name}（不在 PATH 或常见安装位置），请先安装该 CLI"))?;
    let login_args: &[&str] = match provider {
        Provider::Claude => &["auth", "login"],
        Provider::Codex => &["login"],
    };
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NEW_CONSOLE: u32 = 0x0000_0010;
        // cmd /K「"<cli>" <args>」：新控制台里跑登录，结束保留窗口。
        // raw_arg 逐字透传，绕开 Rust 对 cmd 参数的引号转义（否则 cmd 收到被转义的乱码）。
        let payload = format!("\"\"{}\" {}\"", path.display(), login_args.join(" "));
        let mut cmd = Command::new("cmd");
        cmd.creation_flags(CREATE_NEW_CONSOLE);
        cmd.raw_arg("/K");
        cmd.raw_arg(payload);
        if matches!(provider, Provider::Claude)
            && std::env::var_os("CLAUDE_CODE_GIT_BASH_PATH").is_none()
        {
            if let Some(bash) = find_git_bash() {
                cmd.env("CLAUDE_CODE_GIT_BASH_PATH", bash);
            }
        }
        cmd.spawn().map_err(|e| format!("无法打开登录终端：{e}"))?;
        Ok(())
    }
    #[cfg(not(windows))]
    {
        // 非 Windows：best-effort 直接 spawn（继承 stdio）；无 TTY 时提示手动运行。
        let mut cmd = cli_command(&path);
        cmd.args(login_args);
        cmd.spawn()
            .map_err(|e| format!("无法启动登录（请在终端手动运行 `{name} {}`）：{e}", login_args.join(" ")))?;
        Ok(())
    }
}

/// 断开连接：清除本机 CLI 凭据（登出）。登出是非交互命令，直接跑并回报结果，
/// 无需可见终端；前端在成功后重新 `check_agent_connections` 刷新为「未连接」。
/// claude：`auth logout`；codex：`logout`。
pub(crate) fn run_logout(provider: Provider) -> Result<(), String> {
    let name = provider.name();
    let path = resolve_cli(name)
        .ok_or_else(|| format!("未找到 {name}（不在 PATH 或常见安装位置）"))?;
    let logout_args: &[&str] = match provider {
        Provider::Claude => &["auth", "logout"],
        Provider::Codex => &["logout"],
    };
    let mut cmd = cli_command(&path);
    cmd.args(logout_args);
    // Windows：claude 登出同样依赖 Git-Bash，未配置时注入探测到的 bash。
    #[cfg(windows)]
    if matches!(provider, Provider::Claude)
        && std::env::var_os("CLAUDE_CODE_GIT_BASH_PATH").is_none()
    {
        if let Some(bash) = find_git_bash() {
            cmd.env("CLAUDE_CODE_GIT_BASH_PATH", bash);
        }
    }
    cmd.current_dir(neutral_cwd());
    match run_cli_with_timeout(cmd, None, AUTH_TIMEOUT) {
        Ok(out) if out.success => Ok(()),
        // 与 probe_cli / run_claude / run_codex 一致：超时单独给「登出超时」，
        // 不落到 map_cli_error 的「退出异常（无错误输出）」误导文案。
        Ok(out) if out.timed_out => Err(format!("{name} 登出超时")),
        Ok(out) => Err(map_cli_error(name, &out)),
        Err(error) => Err(error),
    }
}

/// 本次生成可用的 provider 顺序（claude 优先）。
pub(crate) fn available_providers() -> Vec<(Provider, PathBuf)> {
    let mut providers = Vec::new();
    if let Ok((path, _)) = probe_cli("claude") {
        providers.push((Provider::Claude, path));
    }
    if let Ok((path, _)) = probe_cli("codex") {
        providers.push((Provider::Codex, path));
    }
    providers
}

pub(crate) fn tail_of(text: &str, max_chars: usize) -> String {
    let trimmed = text.trim();
    let chars: Vec<char> = trimmed.chars().collect();
    if chars.len() <= max_chars {
        return trimmed.to_string();
    }
    chars[chars.len() - max_chars..].iter().collect()
}

fn map_cli_error(name: &str, output: &CliRunOutput) -> String {
    let haystack = format!("{}\n{}", output.stderr, output.stdout).to_lowercase();
    let auth_markers = ["login", "logged in", "log in", "unauthorized", "401", "authenticat", "api key", "credential"];
    if auth_markers.iter().any(|marker| haystack.contains(marker)) {
        return format!("「{name}」未登录或登录已过期，请在终端运行 {name} 完成登录后再试");
    }
    let tail = tail_of(&output.stderr, 200);
    if tail.is_empty() {
        format!("{name} 退出异常（无错误输出）")
    } else {
        format!("{name} 退出异常：{tail}")
    }
}

/// 生成/探测专用中性 cwd：一个**独立子目录**（非裸 temp）。两个作用：
/// (1) 避免把用户项目的 CLAUDE.md / hooks / git 状态泄进生成会话；
/// (2) 给 watcher 一个可识别的标记路径，用来剔除「App 自己的 CLI 生成」写出的会话日志
///     ——否则 quote/fusion 生成消耗的 token 会被 watcher 当成用户 agent 活动，
///     计进经济、喂给陪伴宠、还抢走「最新会话」焦点（见 codex_adapter 采纳过滤）。
pub(crate) fn generation_cwd() -> PathBuf {
    let dir = std::env::temp_dir().join("gulugulu-gen");
    let _ = std::fs::create_dir_all(&dir);
    dir
}

fn neutral_cwd() -> PathBuf {
    generation_cwd()
}

// ---------------------------------------------------------------------------
// CLI 调用（claude -p / codex exec）
// ---------------------------------------------------------------------------

/// Windows：Claude Code CLI 依赖 Git-Bash，未配置 `CLAUDE_CODE_GIT_BASH_PATH`
/// 且 bash 不在 PATH 时会启动即报错退出——导致融合/语录**全部静默回退到 codex**，
/// 用不上 Opus。这里探测本机 Git-Bash 的 bash.exe：从 git.exe 上溯到 Git 根
/// （同时含 `bin\bash.exe` 与 `usr\bin\bash.exe` 的目录即为根），
/// 避开 System32/WindowsApps 下的 WSL bash（Claude Code 不认）。
#[cfg(windows)]
fn find_git_bash() -> Option<PathBuf> {
    fn from_git_exe(git: &Path) -> Option<PathBuf> {
        let mut dir = git.parent();
        while let Some(d) = dir {
            let bin = d.join("bin").join("bash.exe");
            if bin.exists() && d.join("usr").join("bin").join("bash.exe").exists() {
                return Some(bin); // d = Git 安装根
            }
            dir = d.parent();
        }
        None
    }
    if let Ok(out) = base_command("cmd").args(["/C", "where", "git"]).stdin(Stdio::null()).output() {
        if out.status.success() {
            for line in String::from_utf8_lossy(&out.stdout).lines() {
                if let Some(bash) = from_git_exe(Path::new(line.trim())) {
                    return Some(bash);
                }
            }
        }
    }
    for c in [r"C:\Program Files\Git\bin\bash.exe", r"C:\Program Files (x86)\Git\bin\bash.exe"] {
        let p = PathBuf::from(c);
        if p.exists() {
            return Some(p);
        }
    }
    if let Ok(out) = base_command("cmd").args(["/C", "where", "bash"]).stdin(Stdio::null()).output() {
        if out.status.success() {
            for line in String::from_utf8_lossy(&out.stdout).lines() {
                let p = PathBuf::from(line.trim());
                let lower = p.to_string_lossy().to_lowercase();
                if p.exists() && !lower.contains("system32") && !lower.contains("windowsapps") {
                    return Some(p);
                }
            }
        }
    }
    None
}

fn run_claude(path: &Path, prompt: &str, timeout: Duration, model: Option<&str>) -> Result<String, String> {
    let mut cmd = cli_command(path);
    cmd.args(["-p", "--output-format", "json"]);
    // 指定模型（如 opus=最新最强 Opus）；不给则用 CLI 默认模型。
    if let Some(model) = model {
        cmd.args(["--model", model]);
    }
    // Windows：未配置 Git-Bash 时自动探测并注入，否则 claude 启动即报错、回退 codex。
    #[cfg(windows)]
    if std::env::var_os("CLAUDE_CODE_GIT_BASH_PATH").is_none() {
        if let Some(bash) = find_git_bash() {
            cmd.env("CLAUDE_CODE_GIT_BASH_PATH", bash);
        }
    }
    cmd.current_dir(neutral_cwd());
    let output = run_cli_with_timeout(cmd, Some(prompt), timeout)?;
    if output.timed_out {
        return Err("Claude Code 响应超时".to_string());
    }
    if !output.success {
        return Err(map_cli_error("claude", &output));
    }
    // print 模式 JSON 信封：{"result": "...", "is_error": bool, ...}；
    // 老版本 CLI 不是信封时直接用原始 stdout。
    let text = match serde_json::from_str::<Value>(output.stdout.trim()) {
        Ok(envelope) => {
            if envelope.get("is_error").and_then(Value::as_bool) == Some(true) {
                let message = envelope
                    .get("result")
                    .and_then(Value::as_str)
                    .unwrap_or("Claude Code 返回了错误");
                return Err(tail_of(message, 200));
            }
            envelope
                .get("result")
                .and_then(Value::as_str)
                .map(|s| s.to_string())
                .unwrap_or(output.stdout.clone())
        }
        Err(_) => output.stdout.clone(),
    };
    extract_json_object(&text).ok_or_else(|| "输出里没有找到 JSON 对象".to_string())
}

fn run_codex(path: &Path, prompt: &str, timeout: Duration, model: Option<&str>) -> Result<String, String> {
    let out_file = std::env::temp_dir().join(format!(
        "gulugulu-fusion-last-{}-{}.txt",
        std::process::id(),
        crate::game::now_secs()
    ));
    let _ = std::fs::remove_file(&out_file);
    let mut cmd = cli_command(path);
    cmd.arg("exec");
    // 指定模型；不给则用 codex 默认模型。
    if let Some(model) = model {
        cmd.args(["-m", model]);
    }
    cmd.arg("--skip-git-repo-check")
        .args(["--sandbox", "read-only"])
        .arg("--output-last-message")
        .arg(&out_file)
        .arg("-");
    cmd.current_dir(neutral_cwd());
    let output = run_cli_with_timeout(cmd, Some(prompt), timeout)?;
    if output.timed_out {
        let _ = std::fs::remove_file(&out_file);
        return Err("Codex 响应超时".to_string());
    }
    if !output.success {
        let _ = std::fs::remove_file(&out_file);
        return Err(map_cli_error("codex", &output));
    }
    let text = std::fs::read_to_string(&out_file).unwrap_or_else(|_| output.stdout.clone());
    let _ = std::fs::remove_file(&out_file);
    extract_json_object(&text).ok_or_else(|| "输出里没有找到 JSON 对象".to_string())
}

pub(crate) fn run_provider(
    provider: Provider,
    path: &Path,
    prompt: &str,
    timeout: Duration,
    model: Option<&str>,
) -> Result<String, String> {
    match provider {
        Provider::Claude => run_claude(path, prompt, timeout, model),
        Provider::Codex => run_codex(path, prompt, timeout, model),
    }
}

/// 容错提取第一个完整 JSON 对象（容忍 ```json 围栏 / 前后解说文字）。
fn extract_json_object(text: &str) -> Option<String> {
    let start = text.find('{')?;
    let bytes = text.as_bytes();
    let mut depth = 0usize;
    let mut in_string = false;
    let mut escaped = false;
    for (index, &byte) in bytes.iter().enumerate().skip(start) {
        if in_string {
            if escaped {
                escaped = false;
            } else if byte == b'\\' {
                escaped = true;
            } else if byte == b'"' {
                in_string = false;
            }
            continue;
        }
        match byte {
            b'"' => in_string = true,
            b'{' => depth += 1,
            b'}' => {
                depth = depth.saturating_sub(1);
                if depth == 0 {
                    return Some(text[start..=index].to_string());
                }
            }
            _ => {}
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extract_json_object_tolerates_fences_and_prose() {
        let text = "好的，这是设计：\n```json\n{\"a\": {\"b\": \"x{y}\"}, \"c\": 1}\n```\n完";
        let json = extract_json_object(text).unwrap();
        assert_eq!(json, "{\"a\": {\"b\": \"x{y}\"}, \"c\": 1}");
        assert!(extract_json_object("no json here").is_none());
    }

    #[test]
    #[cfg(windows)]
    fn pick_spawnable_prefers_cmd_over_bash_shim() {
        let dir = std::env::temp_dir().join(format!("gulugulu-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let shim = dir.join("codex"); // npm 的无扩展名 Git-Bash 壳
        let cmd = dir.join("codex.cmd");
        std::fs::write(&shim, "#!/bin/sh\n").unwrap();
        std::fs::write(&cmd, "@echo off\n").unwrap();
        // where 的典型输出顺序：无扩展名壳在前
        assert_eq!(pick_spawnable(&[shim.clone(), cmd.clone()]), Some(cmd.clone()));
        // 只有无扩展名壳时，补扩展名兜底也能找到 .cmd
        assert_eq!(pick_spawnable(&[shim.clone()]), Some(cmd.clone()));
        let _ = std::fs::remove_dir_all(&dir);
    }
}
