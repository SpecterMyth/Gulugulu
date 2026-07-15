use serde_json::Value;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

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

/// 中性 cwd：避免把用户项目的 CLAUDE.md / hooks / git 状态泄进生成会话。
fn neutral_cwd() -> PathBuf {
    std::env::temp_dir()
}

// ---------------------------------------------------------------------------
// CLI 调用（claude -p / codex exec）
// ---------------------------------------------------------------------------

fn run_claude(path: &Path, prompt: &str, timeout: Duration) -> Result<String, String> {
    let mut cmd = cli_command(path);
    cmd.args(["-p", "--output-format", "json"]);
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

fn run_codex(path: &Path, prompt: &str, timeout: Duration) -> Result<String, String> {
    let out_file = std::env::temp_dir().join(format!(
        "gulugulu-fusion-last-{}-{}.txt",
        std::process::id(),
        crate::game::now_secs()
    ));
    let _ = std::fs::remove_file(&out_file);
    let mut cmd = cli_command(path);
    cmd.arg("exec")
        .arg("--skip-git-repo-check")
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

pub(crate) fn run_provider(provider: Provider, path: &Path, prompt: &str, timeout: Duration) -> Result<String, String> {
    match provider {
        Provider::Claude => run_claude(path, prompt, timeout),
        Provider::Codex => run_codex(path, prompt, timeout),
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
