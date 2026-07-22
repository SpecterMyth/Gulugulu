//! Steam 社区市场真实行情拉取 —— 公共 `priceoverview` 端点 + 进程内缓存 + 限频。
//!
//! 交易市场面板显示玩家自己伙伴的"真实挂单价"。数据源是 Steam 社区市场的公开
//! 只读端点 `https://steamcommunity.com/market/priceoverview/`（无需登录、无需
//! SteamAPI；纯 HTTPS）。因此本模块与 `steam.rs` 的库存/泵线程完全解耦，即使
//! Steam 客户端未运行也能查价。
//!
//! ⚠️ 现实前提：某件物品要有价格，得先真的有人在社区市场上架它。游戏正式发售、
//! 物品可交易且市场上出现挂单之前，端点对绝大多数物品返回 `success:false`（无
//! 挂单）—— 此时面板回退到本地估价（`fakeMarketPrice`）。上架后本模块**无需改动**
//! 即自动显示真实价。
//!
//! 限频：Steam 对该端点按 IP 限流（~20 次/分，超限回 429）。故：
//! - 命中的价格（含"无挂单"）进程内缓存 `CACHE_TTL`，反复开面板不重复请求；
//! - 单次调用最多请求 `MAX_FETCH_PER_CALL` 件、件间隔 `INTER_REQUEST_DELAY`；
//! - 传输层错误（429/超时）不缓存，留待下次重试。

use crate::game_config::GameConfig;
use serde::Serialize;
use std::collections::{BTreeMap, BTreeSet};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

/// 社区市场币种码：23 = 人民币（面板以 ¥ 展示；Steam 返回已带币种符号的字符串）。
pub const MARKET_CURRENCY_CNY: u32 = 23;

const CACHE_TTL: Duration = Duration::from_secs(900); // 15 分钟。
const MAX_FETCH_PER_CALL: usize = 8;
const INTER_REQUEST_DELAY: Duration = Duration::from_millis(250);
const HTTP_TIMEOUT: Duration = Duration::from_secs(10);

/// 一件物品的社区市场行情（`priceoverview` 原样透传，价格字符串含币种符号）。
/// mirrored in src/types.ts —— keep both sides in sync。
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketPrice {
    /// 已格式化的最低挂单价（如 "¥ 0.68"）；无挂单时 Steam 可能缺此字段 → None。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lowest_price: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub median_price: Option<String>,
    /// 近 24h 成交量（Steam 原样字符串，如 "1,234"）。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub volume: Option<String>,
    pub currency: u32,
    /// 该 def 解析出的 market_hash_name（调试可见性）。
    pub market_hash_name: String,
}

type CacheKey = (u32, u32); // (def, currency)
static CACHE: OnceLock<Mutex<BTreeMap<CacheKey, (Option<MarketPrice>, Instant)>>> = OnceLock::new();

fn cache() -> &'static Mutex<BTreeMap<CacheKey, (Option<MarketPrice>, Instant)>> {
    CACHE.get_or_init(|| Mutex::new(BTreeMap::new()))
}

/// 首字母大写（与 `build_itemdefs_core.mjs` 的 `titleCase` 一致 —— 目录物品的英文
/// `name` 即 `titleCase(codename)`，社区市场以此作 market_hash_name）。
fn title_case(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
        None => String::new(),
    }
}

/// def → market_hash_name。仅目录物种（101-106 / 201-221 / 601-657）可确定推导：
/// 其英文名 = `titleCase(codename)`。AI 变种（10001+）的市场名依赖上架时的展示名，
/// 本机无法确定 → None（面板回退本地估价）。
pub fn market_hash_name_for_def(config: &GameConfig, def: u32) -> Option<String> {
    config
        .species_for_steam_def(def)
        .map(|(codename, _)| title_case(codename))
}

/// 拉一件物品的行情。Ok(Some)=有挂单；Ok(None)=端点成功但无挂单（缓存为"无价"）；
/// Err=传输/HTTP 错误（不缓存，留待重试）。
fn fetch_price(app_id: u32, currency: u32, hash: &str) -> Result<Option<MarketPrice>, String> {
    let url = reqwest::Url::parse_with_params(
        "https://steamcommunity.com/market/priceoverview/",
        &[
            ("appid", app_id.to_string()),
            ("currency", currency.to_string()),
            ("market_hash_name", hash.to_string()),
        ],
    )
    .map_err(|error| error.to_string())?;

    let client = reqwest::blocking::Client::builder()
        .timeout(HTTP_TIMEOUT)
        .user_agent("Gulugulu/0.1 (+market-price)")
        .build()
        .map_err(|error| error.to_string())?;

    let response = client.get(url).send().map_err(|error| error.to_string())?;
    if !response.status().is_success() {
        // 429（限频）等：交由调用方跳过缓存、下次重试。
        return Err(format!("http {}", response.status().as_u16()));
    }
    let json: serde_json::Value = response.json().map_err(|error| error.to_string())?;
    if json.get("success").and_then(serde_json::Value::as_bool) != Some(true) {
        return Ok(None); // 无挂单。
    }
    let field = |key: &str| {
        json.get(key)
            .and_then(serde_json::Value::as_str)
            .map(str::to_string)
    };
    Ok(Some(MarketPrice {
        lowest_price: field("lowest_price"),
        median_price: field("median_price"),
        volume: field("volume"),
        currency,
        market_hash_name: hash.to_string(),
    }))
}

/// 批量查价（去重、缓存、限频）。只返回**有挂单**的 def → 行情；无挂单/查不到的
/// 缺席（面板据缺席回退估价）。人民币计价。
pub fn prices_for_defs(config: &GameConfig, app_id: u32, defs: &[u32]) -> BTreeMap<u32, MarketPrice> {
    let mut out = BTreeMap::new();
    let mut seen = BTreeSet::new();
    let mut fetched = 0usize;
    for &def in defs {
        if !seen.insert(def) {
            continue;
        }
        let key: CacheKey = (def, MARKET_CURRENCY_CNY);

        // 命中未过期缓存（含"无价"）。
        let cached = cache()
            .lock()
            .ok()
            .and_then(|guard| guard.get(&key).cloned());
        if let Some((entry, at)) = cached {
            if at.elapsed() < CACHE_TTL {
                if let Some(price) = entry {
                    out.insert(def, price);
                }
                continue;
            }
        }

        let Some(hash) = market_hash_name_for_def(config, def) else {
            continue; // 无法确定市场名（AI 变种等）→ 面板回退估价。
        };
        if fetched >= MAX_FETCH_PER_CALL {
            continue; // 单次调用请求上限，其余下次再查。
        }
        if fetched > 0 {
            std::thread::sleep(INTER_REQUEST_DELAY);
        }
        fetched += 1;

        match fetch_price(app_id, MARKET_CURRENCY_CNY, &hash) {
            Ok(entry) => {
                if let Ok(mut guard) = cache().lock() {
                    guard.insert(key, (entry.clone(), Instant::now()));
                }
                if let Some(price) = entry {
                    out.insert(def, price);
                }
            }
            Err(_) => { /* 传输/限频错误：不缓存，下次重试。 */ }
        }
    }
    out
}

/// IPC：查询一组 itemdef 的社区市场真实行情（人民币）。前端传入交易市场面板里
/// 伙伴的 `steamItemDef` 列表；返回有挂单者的价格，其余缺席（面板回退本地估价）。
#[tauri::command]
pub async fn steam_market_prices(defs: Vec<u32>) -> Result<BTreeMap<u32, MarketPrice>, String> {
    let config = crate::game_config::load_game_config();
    tauri::async_runtime::spawn_blocking(move || {
        prices_for_defs(&config, crate::steam::STEAM_APP_ID, &defs)
    })
    .await
    .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config() -> GameConfig {
        serde_json::from_str(include_str!("../../src/game/config.json")).unwrap()
    }

    #[test]
    fn title_case_matches_itemdef_english_name() {
        assert_eq!(title_case("guluduck"), "Guluduck");
        assert_eq!(title_case("emberfox"), "Emberfox");
        assert_eq!(title_case(""), "");
    }

    #[test]
    fn hash_name_resolves_catalog_and_skips_ai_variant() {
        let config = config();
        // 一阶目录物种 → titleCase(codename)。
        let (codename, _) = config.species_for_steam_def(101).unwrap();
        assert_eq!(
            market_hash_name_for_def(&config, 101).as_deref(),
            Some(title_case(codename).as_str())
        );
        // AI 变种 def 无确定市场名 → None。
        assert_eq!(market_hash_name_for_def(&config, 10_001), None);
        // 蛋 def 非物种 → None。
        assert_eq!(market_hash_name_for_def(&config, 309), None);
    }
}
