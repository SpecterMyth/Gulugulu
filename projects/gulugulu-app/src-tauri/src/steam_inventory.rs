//! ISteamInventory 薄封装 —— 仓库唯一的 unsafe 边界（02-rust-core.md C1）。
//!
//! 模型：发起调用拿到结果句柄 → 泵线程轮询 `GetResultStatus`（不注册回调，
//! 避免依赖高层 crate 缺失的回调类型）→ OK 时 `GetResultItems` 取
//! quantity>0 且未标记 removed/consumed 的条目 → 任何出口必 `DestroyResult`。
//! 超时回 `Uncertain`（≠ Failed：兑换可能已在服务器成功，意图不得清除）。

use std::time::{Duration, Instant};

/// 一次库存操作发放/持有的物品（item id 用十进制字符串，防 JS 精度损坏）。
#[derive(Clone, Debug)]
pub struct GrantedItem {
    pub item_id: String,
    pub def: u32,
    #[allow(dead_code)] // 调试可见性保留（当前逻辑按 1 件处理）。
    pub quantity: u16,
}

#[derive(Clone, Debug)]
pub enum OpOutcome {
    /// 操作成功。列表为结果集中 quantity>0 的条目（掉落限频时为空）。
    Granted(Vec<GrantedItem>),
    Failed(String),
    /// 超时/通道断开：结果未知，调用方保留写前意图交给下轮探测。
    Uncertain,
}

fn inventory() -> *mut steamworks_sys::ISteamInventory {
    unsafe { steamworks_sys::SteamAPI_SteamInventory_v003() }
}

const INVALID_RESULT: steamworks_sys::SteamInventoryResult_t = -1;

fn issue(
    call: impl FnOnce(
        *mut steamworks_sys::ISteamInventory,
        *mut steamworks_sys::SteamInventoryResult_t,
    ) -> bool,
) -> Result<steamworks_sys::SteamInventoryResult_t, String> {
    let inv = inventory();
    if inv.is_null() {
        return Err("Steam 库存接口不可用".to_string());
    }
    let mut handle: steamworks_sys::SteamInventoryResult_t = INVALID_RESULT;
    let ok = call(inv, &mut handle);
    if !ok || handle == INVALID_RESULT {
        return Err("库存调用发起失败".to_string());
    }
    Ok(handle)
}

pub fn start_get_all() -> Result<steamworks_sys::SteamInventoryResult_t, String> {
    issue(|inv, handle| unsafe { steamworks_sys::SteamAPI_ISteamInventory_GetAllItems(inv, handle) })
}

pub fn start_trigger_drop(def: u32) -> Result<steamworks_sys::SteamInventoryResult_t, String> {
    issue(|inv, handle| unsafe {
        steamworks_sys::SteamAPI_ISteamInventory_TriggerItemDrop(
            inv,
            handle,
            def as steamworks_sys::SteamItemDef_t,
        )
    })
}

pub fn start_exchange(
    generate_def: u32,
    destroy: &[u64],
) -> Result<steamworks_sys::SteamInventoryResult_t, String> {
    let generate: [steamworks_sys::SteamItemDef_t; 1] =
        [generate_def as steamworks_sys::SteamItemDef_t];
    let generate_qty: [u32; 1] = [1];
    let destroy_ids: Vec<steamworks_sys::SteamItemInstanceID_t> = destroy.to_vec();
    let destroy_qty: Vec<u32> = destroy.iter().map(|_| 1u32).collect();
    issue(|inv, handle| unsafe {
        steamworks_sys::SteamAPI_ISteamInventory_ExchangeItems(
            inv,
            handle,
            generate.as_ptr(),
            generate_qty.as_ptr(),
            1,
            destroy_ids.as_ptr(),
            destroy_qty.as_ptr(),
            destroy_ids.len() as u32,
        )
    })
}

pub fn start_consume(item_id: u64) -> Result<steamworks_sys::SteamInventoryResult_t, String> {
    issue(|inv, handle| unsafe {
        steamworks_sys::SteamAPI_ISteamInventory_ConsumeItem(inv, handle, item_id, 1)
    })
}

/// 仅开发期有效（Valve 在正式版禁用 GenerateItems）。
pub fn start_generate(defs: &[u32]) -> Result<steamworks_sys::SteamInventoryResult_t, String> {
    let ids: Vec<steamworks_sys::SteamItemDef_t> =
        defs.iter().map(|d| *d as steamworks_sys::SteamItemDef_t).collect();
    let qty: Vec<u32> = defs.iter().map(|_| 1u32).collect();
    issue(|inv, handle| unsafe {
        steamworks_sys::SteamAPI_ISteamInventory_GenerateItems(
            inv,
            handle,
            ids.as_ptr(),
            qty.as_ptr(),
            ids.len() as u32,
        )
    })
}

fn destroy_result(handle: steamworks_sys::SteamInventoryResult_t) {
    let inv = inventory();
    if !inv.is_null() {
        unsafe { steamworks_sys::SteamAPI_ISteamInventory_DestroyResult(inv, handle) };
    }
}

fn collect_items(handle: steamworks_sys::SteamInventoryResult_t) -> Vec<GrantedItem> {
    let inv = inventory();
    if inv.is_null() {
        return Vec::new();
    }
    let mut count: u32 = 0;
    let ok = unsafe {
        steamworks_sys::SteamAPI_ISteamInventory_GetResultItems(
            inv,
            handle,
            std::ptr::null_mut(),
            &mut count,
        )
    };
    if !ok || count == 0 {
        return Vec::new();
    }
    let mut details: Vec<steamworks_sys::SteamItemDetails_t> = Vec::with_capacity(count as usize);
    let ok = unsafe {
        steamworks_sys::SteamAPI_ISteamInventory_GetResultItems(
            inv,
            handle,
            details.as_mut_ptr(),
            &mut count,
        )
    };
    if !ok {
        return Vec::new();
    }
    unsafe { details.set_len(count as usize) };
    const REMOVED: u16 = 1 << 8; // k_ESteamItemRemoved
    const CONSUMED: u16 = 1 << 9; // k_ESteamItemConsumed
    details
        .into_iter()
        .filter(|d| d.m_unQuantity > 0 && d.m_unFlags & (REMOVED | CONSUMED) == 0)
        .map(|d| GrantedItem {
            item_id: (d.m_itemId as u64).to_string(),
            def: d.m_iDefinition as u32,
            quantity: d.m_unQuantity,
        })
        .collect()
}

/// 同步等待结果：轮询 GetResultStatus（调用方负责在等待间隙跑 run_callbacks）。
pub fn wait_result(
    handle: steamworks_sys::SteamInventoryResult_t,
    timeout: Duration,
    mut pump: impl FnMut(),
) -> OpOutcome {
    let inv = inventory();
    if inv.is_null() {
        destroy_result(handle);
        return OpOutcome::Failed("Steam 库存接口不可用".to_string());
    }
    let started = Instant::now();
    loop {
        pump();
        let status = unsafe { steamworks_sys::SteamAPI_ISteamInventory_GetResultStatus(inv, handle) };
        if status == steamworks_sys::EResult::k_EResultOK {
            let items = collect_items(handle);
            destroy_result(handle);
            return OpOutcome::Granted(items);
        }
        if status != steamworks_sys::EResult::k_EResultPending {
            destroy_result(handle);
            return OpOutcome::Failed(format!("库存操作失败（EResult={status:?}）"));
        }
        if started.elapsed() > timeout {
            destroy_result(handle);
            return OpOutcome::Uncertain;
        }
        std::thread::sleep(Duration::from_millis(20));
    }
}
