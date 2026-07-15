// Game module: save data, pure game logic, persistence, and IPC commands.
//
// This module was split out of a single `game.rs` file into submodules; the
// glob re-exports below preserve the flat `crate::game::X` paths that the rest
// of the crate (fusion_gen.rs, lib.rs, quote_gen.rs, steam*.rs,
// codex_adapter.rs) and the cross-submodule references rely on.

// Shared external imports, re-exported so every submodule can pick them up via
// `use super::*;` / `use crate::game::*;`.
pub(crate) use crate::game_config::{
    fusion_recipe_key, is_test_mode, load_game_config, GameConfig, SpeciesInfo,
};
pub(crate) use serde::{Deserialize, Serialize};
pub(crate) use std::collections::BTreeMap;
pub(crate) use std::fs;
pub(crate) use std::path::PathBuf;
pub(crate) use std::sync::atomic::{AtomicU64, Ordering};
pub(crate) use std::sync::{Arc, Mutex};
pub(crate) use std::time::{SystemTime, UNIX_EPOCH};
pub(crate) use tauri::{AppHandle, Manager};

mod commands;
mod debug;
mod logic;
mod model;
mod persist;
mod state;

pub(crate) use commands::*;
pub(crate) use debug::*;
pub(crate) use logic::*;
pub(crate) use model::*;
pub(crate) use persist::*;
pub(crate) use state::*;

#[cfg(test)]
mod tests;
