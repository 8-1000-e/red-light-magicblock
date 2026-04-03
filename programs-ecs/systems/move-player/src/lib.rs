use bolt_lang::*;
use game_config::GameConfig;
use player_state::PlayerState;
use shared::GameError;

declare_id!("B41Kov8d1moDABp8RdSTRauZUNpwuNwvc312erhWF7w1");

const FINISH_Y: u16 = 300;
const MIN_SLOT_GAP: u64 = 1; // 1 slot minimum between moves (~50ms on ER)

#[system]
pub mod move_player {
    pub fn execute(ctx: Context<Components>, _args: Vec<u8>) -> Result<Components> {
        require!(ctx.accounts.game_config.status == 1, GameError::GameNotPlaying);
        require!(ctx.accounts.player_state.alive, GameError::PlayerDead);
        require!(!ctx.accounts.player_state.finished, GameError::PlayerFinished);

        // Anti speed hack — rate limit by slot
        let slot = Clock::get()?.slot;
        if slot < ctx.accounts.player_state.last_move_slot + MIN_SLOT_GAP {
            return Ok(ctx.accounts); // silently skip, don't fail
        }
        ctx.accounts.player_state.last_move_slot = slot;

        let now = Clock::get()?.unix_timestamp;
        let is_red = ctx.accounts.game_config.light == 1
            && now < ctx.accounts.game_config.red_until;

        if is_red {
            // Moved during red light → eliminated
            ctx.accounts.player_state.alive = false;
        } else {
            // Green light → advance by 1
            ctx.accounts.player_state.y = ctx.accounts.player_state.y.saturating_add(1);

            // Win check
            if ctx.accounts.player_state.y >= FINISH_Y {
                ctx.accounts.player_state.y = FINISH_Y;
                ctx.accounts.player_state.finished = true;
                ctx.accounts.player_state.finish_time = now;

                // Push to leaderboard
                let pos = ctx.accounts.game_config.finishers as usize;
                if pos < 10 {
                    let addr = ctx.accounts.player_state.authority.to_bytes();
                    ctx.accounts.game_config.leaderboard[pos] = addr;
                    ctx.accounts.game_config.finishers += 1;
                }
            }
        }

        Ok(ctx.accounts)
    }

    #[system_input]
    pub struct Components {
        pub player_state: PlayerState,
        pub game_config: GameConfig,
    }
}
