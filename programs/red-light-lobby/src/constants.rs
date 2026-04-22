use anchor_lang::prelude::*;

// PDA seeds
pub const LOBBY_SEED: &[u8] = b"lobby";
pub const VAULT_SEED: &[u8] = b"vault";

// Caps
pub const MAX_PLAYERS: usize = 10;

// Platform rake, in basis points (100 bps = 1%)
pub const PLATFORM_FEE_BPS: u64 = 500; // 5%

// Fee charged on leave to prevent join/leave spam (covers back's tx fee)
pub const LEAVE_FEE: u64 = 200_000; // 0.0001 SOL

// Lobby status values
pub const STATUS_OPEN: u8 = 0;
pub const STATUS_STARTED: u8 = 1;
pub const STATUS_SETTLED: u8 = 2;

// Red-light `leaderboard` BOLT component program ID — used to verify that
// the leaderboard account passed to distribute_prize is the real one.
// Must match declare_id! in programs-ecs/components/leaderboard/src/lib.rs.
pub const LEADERBOARD_COMPONENT_ID: Pubkey =
    pubkey!("6t7mqQmYpTDRvovNfAZW66y9vQdU7UKcSo3TCP9fPRNk");

// Layout of the BOLT Leaderboard account we decode manually.
// Entry: pubkey(32) + y(u16=2) + finished(1) + finish_time(i64=8) + name(16) + name_len(1) + skin(1) = 61 bytes
//   [0..8]              anchor discriminator
//   [8..618]            entries: [Entry; 10]  (610 bytes)
//   [618]               count: u8
pub const LEADERBOARD_DISC_LEN: usize = 8;
pub const LEADERBOARD_ENTRY_SIZE: usize = 61;
pub const LEADERBOARD_ENTRY_Y_OFFSET: usize = 32;         // within an entry: y starts at byte 32
pub const LEADERBOARD_ENTRY_FINISHED_OFFSET: usize = 34;  // finished bool at byte 34
pub const LEADERBOARD_ENTRIES_LEN: usize = LEADERBOARD_ENTRY_SIZE * 10;
pub const LEADERBOARD_COUNT_OFFSET: usize = LEADERBOARD_DISC_LEN + LEADERBOARD_ENTRIES_LEN;
