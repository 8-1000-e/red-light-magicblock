use bolt_lang::*;
use game_config::GameConfig;
use player_state::PlayerState;
use leaderboard::Leaderboard;
use shared::GameError;

declare_id!("B3jhhTuDaZ5WebzsWQs6GDsm2p63nH5AxNcxhDkj7hFu");

const FINISH_Y: u16 = 200;
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
            }
            return Ok(ctx.accounts);
        }

        // Anti speed hack — rate limit by slot
        let slot = Clock::get()?.slot;
        if slot < ctx.accounts.player_state.last_move_slot + MIN_SLOT_GAP {
            return Ok(ctx.accounts); // silently skip, don't fail
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

                // Push to leaderboard
                let pos = ctx.accounts.leaderboard.count as usize;
                if pos < 10 {
                    let addr = ctx.accounts.player_state.owner.to_bytes();
                    ctx.accounts.leaderboard.entries[pos] = addr;
                    ctx.accounts.leaderboard.count += 1;
                }
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
