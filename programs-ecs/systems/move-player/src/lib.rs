use bolt_lang::*;
use game_config::GameConfig;
use player_state::PlayerState;
use leaderboard::{Leaderboard, LeaderboardEntry, MAX_LEADERBOARD};
use shared::GameError;

declare_id!("B3jhhTuDaZ5WebzsWQs6GDsm2p63nH5AxNcxhDkj7hFu");

const FINISH_Y: u16 = 300;
const MIN_SLOT_GAP: u64 = 1; // 1 slot minimum between moves (~50ms on ER)
const RESPAWN_DELAY: i64 = 5; // 5 seconds to respawn

#[system]
pub mod move_player {
    pub fn execute(ctx: Context<Components>, _args: Vec<u8>) -> Result<Components>
    {
        require!(ctx.accounts.game_config.status == 1, GameError::GameNotPlaying);
        require!(!ctx.accounts.player_state.finished, GameError::PlayerFinished);

        let now = Clock::get()?.unix_timestamp;

        // Respawn check — if dead and respawn_time has passed, revive
        if !ctx.accounts.player_state.alive {
            if ctx.accounts.player_state.respawn_time > 0 && now >= ctx.accounts.player_state.respawn_time {
                ctx.accounts.player_state.alive = true;
                ctx.accounts.player_state.y = 0;
                ctx.accounts.player_state.respawn_time = 0;
                update_leaderboard(&mut ctx.accounts.leaderboard, &ctx.accounts.player_state, now);
            }
            return Ok(ctx.accounts);
        }

        // Anti speed hack — rate limit by slot
        let slot = Clock::get()?.slot;
        if slot < ctx.accounts.player_state.last_move_slot + MIN_SLOT_GAP {
            return Ok(ctx.accounts);
        }
        ctx.accounts.player_state.last_move_slot = slot;

        let is_red = ctx.accounts.game_config.light == 1
            && now < ctx.accounts.game_config.red_until;

        if is_red {
            // Moved during red light → dead, respawn in 5s
            ctx.accounts.player_state.alive = false;
            ctx.accounts.player_state.respawn_time = now + RESPAWN_DELAY;
        } else {
            // Green light → advance by 1
            ctx.accounts.player_state.y = ctx.accounts.player_state.y.saturating_add(1);

            // Win check
            if ctx.accounts.player_state.y >= FINISH_Y {
                ctx.accounts.player_state.y = FINISH_Y;
                ctx.accounts.player_state.finished = true;
                ctx.accounts.player_state.finish_time = now;
            }
        }

        update_leaderboard(&mut ctx.accounts.leaderboard, &ctx.accounts.player_state, now);

        // End game early if half (or more) of the players have finished
        if ctx.accounts.player_state.finished {
            let cutoff = (ctx.accounts.game_config.active_players as usize) / 2;
            let mut finished_count: usize = 0;
            for i in 0..(ctx.accounts.leaderboard.count as usize) {
                if ctx.accounts.leaderboard.entries[i].finished {
                    finished_count += 1;
                }
            }
            if cutoff > 0 && finished_count >= cutoff {
                ctx.accounts.game_config.status = 2; // Finished
            }
        }

        Ok(ctx.accounts)
    }

    #[system_input]
    pub struct Components {
        pub player_state: PlayerState,
        pub game_config: GameConfig,
        pub leaderboard: Leaderboard,
    }
}

/// Upsert the player's entry in the leaderboard, then sort.
/// Sort order: finished first (by finish_time asc), then non-finished (by y desc).
fn update_leaderboard(lb: &mut Leaderboard, ps: &PlayerState, _now: i64) {
    let pubkey_bytes = ps.owner.to_bytes();

    // Find existing entry by pubkey
    let mut idx: Option<usize> = None;
    for i in 0..(lb.count as usize) {
        if lb.entries[i].pubkey == pubkey_bytes {
            idx = Some(i);
            break;
        }
    }

    let entry = LeaderboardEntry {
        pubkey: pubkey_bytes,
        y: ps.y,
        finished: ps.finished,
        finish_time: ps.finish_time,
        name: ps.name,
        name_len: ps.name_len,
        skin: ps.skin,
    };

    match idx {
        Some(i) => {
            // Update existing entry
            lb.entries[i] = entry;
        }
        None => {
            // Insert new entry if room
            if (lb.count as usize) < MAX_LEADERBOARD {
                lb.entries[lb.count as usize] = entry;
                lb.count += 1;
            }
        }
    }

    // Sort: finished first (by finish_time asc), then non-finished (by y desc).
    // Bubble sort on max 10 entries — cheap.
    let n = lb.count as usize;
    for i in 0..n {
        for j in 0..n - i - 1 {
            let a = &lb.entries[j];
            let b = &lb.entries[j + 1];
            let should_swap = if a.finished && b.finished {
                a.finish_time > b.finish_time
            } else if a.finished && !b.finished {
                false // a comes first
            } else if !a.finished && b.finished {
                true // b comes first — swap
            } else {
                a.y < b.y // both unfinished → higher y first
            };
            if should_swap {
                lb.entries.swap(j, j + 1);
            }
        }
    }
}
