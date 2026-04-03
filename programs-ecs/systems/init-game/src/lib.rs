use bolt_lang::*;
use game_config::GameConfig;
declare_id!("2ta7fTqSgTZ59Tr1WcdjUjgVL3uMyjtGed2jE3Eqfv6x");

const LOBBY_DURATION: i64 = 40; // 40 seconds lobby

#[system]
pub mod init_game {
    pub fn execute(ctx: Context<Components>, _args: Vec<u8>) -> Result<Components> 
    {
      let now = Clock::get()?.unix_timestamp;                                      
      ctx.accounts.game_config.status = 0;                                         
      ctx.accounts.game_config.active_players = 0;                                 
      ctx.accounts.game_config.light = 0;                         
      ctx.accounts.game_config.start_time = now;                                   
      ctx.accounts.game_config.lobby_end = now + LOBBY_DURATION;
      Ok(ctx.accounts)
    }

    #[system_input]
    pub struct Components {
        pub game_config: GameConfig,
    }
}
