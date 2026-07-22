use crate::cli_spawn::{probe_login, run_logout, spawn_login_terminal, LoginProbe, Provider};
use serde::Serialize;

// ---------------------------------------------------------------------------
// Agent 连接状态：开局探测 Claude / Codex 的**真实登录态**（非仅装机），
// 未连接时后院公告板给「连接」按钮，点击 → connect_agent 开可见终端跑登录。
// ---------------------------------------------------------------------------

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConn {
    /// "claude" | "codex"
    pub provider: String,
    pub installed: bool,
    pub logged_in: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub account: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl ProviderConn {
    fn from_probe(provider: &str, probe: LoginProbe) -> Self {
        ProviderConn {
            provider: provider.to_string(),
            installed: probe.installed,
            logged_in: probe.logged_in,
            version: probe.version,
            account: probe.account,
            error: probe.error,
        }
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentConnections {
    pub claude: ProviderConn,
    pub codex: ProviderConn,
}

/// 探测两个 provider 的真实登录态（各跑 `--version` + auth-status，off UI 线程）。
#[tauri::command]
pub async fn check_agent_connections() -> Result<AgentConnections, String> {
    tauri::async_runtime::spawn_blocking(|| AgentConnections {
        claude: ProviderConn::from_probe("claude", probe_login(Provider::Claude)),
        codex: ProviderConn::from_probe("codex", probe_login(Provider::Codex)),
    })
    .await
    .map_err(|error| error.to_string())
}

/// 打开可见终端跑交互式登录；返回后前端轮询 check_agent_connections 直到已连接。
#[tauri::command]
pub async fn connect_agent(provider: String) -> Result<(), String> {
    let target = match provider.as_str() {
        "claude" => Provider::Claude,
        "codex" => Provider::Codex,
        other => return Err(format!("未知 provider：{other}")),
    };
    tauri::async_runtime::spawn_blocking(move || spawn_login_terminal(target))
        .await
        .map_err(|error| error.to_string())?
}

/// 断开连接（登出）：清除本机 CLI 凭据；返回后前端重新 check_agent_connections
/// 刷新为「未连接」。非交互命令，直接跑（off UI 线程），失败回报错误文案。
#[tauri::command]
pub async fn disconnect_agent(provider: String) -> Result<(), String> {
    let target = match provider.as_str() {
        "claude" => Provider::Claude,
        "codex" => Provider::Codex,
        other => return Err(format!("未知 provider：{other}")),
    };
    tauri::async_runtime::spawn_blocking(move || run_logout(target))
        .await
        .map_err(|error| error.to_string())?
}
