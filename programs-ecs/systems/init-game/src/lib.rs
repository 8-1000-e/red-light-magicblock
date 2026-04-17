use bolt_lang::*;
use game_config::GameConfig;
declare_id!("38wPngniB8Hn4eHqbr2rJBXVLtNGgYYDcLBtqHfPm6Wn");

const LOBBY_DURATION: i64 = 0; // lobby handled by back, not on-chain

#[system]
pub mod init_game {
    pub fn execute(ctx: Context<Components>, _args: Vec<u8>) -> Result<Components> 
    {
      let now = Clock::get()?.unix_timestamp;                                      
      ctx.accounts.game_config.status = 0;
      ctx.accounts.game_config.active_players = 0;
      ctx.accounts.game_config.light = 0;
      ctx.accounts.game_config.last_price = 0;
      ctx.accounts.game_config.last_check_time = 0;
      ctx.accounts.game_config.red_until = 0;
      ctx.accounts.game_config.start_time = now;
      ctx.accounts.game_config.lobby_end = now + LOBBY_DURATION;
      Ok(ctx.accounts)
    }

    #[system_input]
    pub struct Components {
        pub game_config: GameConfig,
    }
}
