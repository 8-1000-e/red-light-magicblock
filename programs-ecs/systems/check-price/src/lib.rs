use bolt_lang::*;
use game_config::GameConfig;
use shared::{GameError, read_pyth_price};

declare_id!("14aiGdhHAwHjMCJb8F4agsa4NNWdyZCBQjvBcX3Fib6K");

const CHECK_COOLDOWN: i64 = 3; // check every 3 seconds
const RED_DURATION: i64 = 2;   // red light lasts 2 seconds

#[system]
pub mod check_price {
    pub fn execute(ctx: Context<Components>, _args: Vec<u8>) -> Result<Components> {
        require!(ctx.accounts.game_config.status == 1, GameError::GameNotPlaying);

        let now = Clock::get()?.unix_timestamp;
        let elapsed = now - ctx.accounts.game_config.last_check_time;
        if elapsed < CHECK_COOLDOWN {
            return Ok(ctx.accounts);
        }

        let price = read_pyth_price(&ctx.remaining_accounts[0])?;
        let last_price = ctx.accounts.game_config.last_price;

        // Any drop = red light
        if last_price > 0 && price < last_price  && ctx.accounts.game_config.light == 0 {
            ctx.accounts.game_config.light = 1;
            ctx.accounts.game_config.red_until = now + RED_DURATION;
        } else {
            ctx.accounts.game_config.light = 0;
            ctx.accounts.game_config.red_until = 0;
        }

        ctx.accounts.game_config.last_price = price;
        ctx.accounts.game_config.last_check_time = now;

        Ok(ctx.accounts)
    }

    #[system_input]
    pub struct Components {
        pub game_config: GameConfig,
    }
}
