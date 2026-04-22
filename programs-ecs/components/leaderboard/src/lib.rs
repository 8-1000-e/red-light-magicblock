use bolt_lang::*;

declare_id!("6t7mqQmYpTDRvovNfAZW66y9vQdU7UKcSo3TCP9fPRNk");

pub const MAX_LEADERBOARD: usize = 10;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace)]
pub struct LeaderboardEntry {
    pub pubkey: [u8; 32],
    pub y: u16,
    pub finished: bool,
    pub finish_time: i64,
    pub name: [u8; 16],
    pub name_len: u8,
    pub skin: u8,
}

impl Default for LeaderboardEntry {
    fn default() -> Self {
        Self {
            pubkey: [0u8; 32],
            y: 0,
            finished: false,
            finish_time: 0,
            name: [0u8; 16],
            name_len: 0,
            skin: 0,
        }
    }
}

#[component(delegate)]
pub struct Leaderboard {
    /// Entries sorted: finished first (by finish_time asc), then non-finished (by y desc)
    pub entries: [LeaderboardEntry; MAX_LEADERBOARD],
    /// Number of entries used
    pub count: u8,
}

impl Default for Leaderboard {
    fn default() -> Self {
        Self {
            entries: [LeaderboardEntry::default(); MAX_LEADERBOARD],
            count: 0,
            bolt_metadata: BoltMetadata::default(),
        }
    }
}
