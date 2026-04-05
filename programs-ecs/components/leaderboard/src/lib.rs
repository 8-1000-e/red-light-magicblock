use bolt_lang::*;

declare_id!("EVBJ4dfhix7Cfd6ycx7cTK6NJc3k6pjF5Nz3obKcXC3T");

pub const MAX_LEADERBOARD: usize = 10;

#[component(delegate)]
pub struct Leaderboard {
    /// First 10 players to finish (in order), stored as pubkey bytes
    pub entries: [[u8; 32]; MAX_LEADERBOARD],
    /// Number of finishers
    pub count: u8,
}

impl Default for Leaderboard {
    fn default() -> Self {
        Self {
            entries: [[0u8; 32]; MAX_LEADERBOARD],
            count: 0,
            bolt_metadata: BoltMetadata::default(),
        }
    }
}
