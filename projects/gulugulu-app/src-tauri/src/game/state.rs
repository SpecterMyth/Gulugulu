use super::*;

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

pub struct GameState {
    pub config: GameConfig,
    pub save: Mutex<Option<GameSave>>,
}

pub type SharedGameState = Arc<GameState>;

pub fn new_shared_state() -> SharedGameState {
    Arc::new(GameState {
        config: load_game_config(),
        save: Mutex::new(None),
    })
}

pub(crate) static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

pub(crate) fn new_id(prefix: &str) -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let counter = ID_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("{prefix}-{nanos:x}-{counter}")
}
