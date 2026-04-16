use anchor_lang::prelude::*;

// PDA seeds
pub const LOBBY_SEED: &[u8] = b"lobby";
pub const VAULT_SEED: &[u8] = b"vault";

// Caps
pub const MAX_PLAYERS: usize = 10;

// Platform rake, in basis points (100 bps = 1%)
pub const PLATFORM_FEE_BPS: u64 = 500; // 5%

// Lobby status values
pub const STATUS_OPEN: u8 = 0;
pub const STATUS_STARTED: u8 = 1;
pub const STATUS_SETTLED: u8 = 2;

// Red-light `leaderboard` BOLT component program ID — used to verify that
// the leaderboard account passed to distribute_prize is the real one.
// Must match declare_id! in programs-ecs/components/leaderboard/src/lib.rs.
pub const LEADERBOARD_COMPONENT_ID: Pubkey =
    pubkey!("6t7mqQmYpTDRvovNfAZW66y9vQdU7UKcSo3TCP9fPRNk");

// Layout of the BOLT Leaderboard account we decode manually:
//   [0..8]     anchor discriminator
//   [8..328]   entries: [[u8; 32]; 10]  (320 bytes)
//   [328]      count: u8
pub const LEADERBOARD_DISC_LEN: usize = 8;
pub const LEADERBOARD_ENTRIES_LEN: usize = 32 * 10;
pub const LEADERBOARD_COUNT_OFFSET: usize = LEADERBOARD_DISC_LEN + LEADERBOARD_ENTRIES_LEN;
