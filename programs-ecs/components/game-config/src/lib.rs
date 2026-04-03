use bolt_lang::*;

declare_id!("HSmw8VMWEBaNTuTbfG5GZAPabRawKr7DWtDAtov6ev3w");

pub const MAX_LEADERBOARD: usize = 10;

#[component(delegate)]
pub struct GameConfig {
    /// 0 = Waiting, 1 = Playing, 2 = Finished
    pub status: u8,
    /// Number of active players
    pub active_players: u8,
    /// 0 = Green, 1 = Red
    pub light: u8,
    /// Last SOL price checked (Pyth raw u64, 8 decimals)
    pub last_price: u64,
    /// Timestamp of last price check
    pub last_check_time: i64,
    /// Timestamp when red light ends (0 if green)
    pub red_until: i64,
    /// Game start timestamp (set by init-game)
    pub start_time: i64,
    /// Lobby ends at this timestamp (start_time + 40s)
    pub lobby_end: i64,
    /// Leaderboard — first 10 players to finish (in order)
    pub leaderboard: [[u8; 32]; MAX_LEADERBOARD],
    /// Number of finishers
    pub finishers: u8,
}

impl Default for GameConfig {
    fn default() -> Self {
        Self {
            status: 0,
            active_players: 0,
            light: 0,
            last_price: 0,
            last_check_time: 0,
            red_until: 0,
            start_time: 0,
            lobby_end: 0,
            leaderboard: [[0u8; 32]; MAX_LEADERBOARD],
            finishers: 0,
            bolt_metadata: BoltMetadata::default(),
        }
    }
}
