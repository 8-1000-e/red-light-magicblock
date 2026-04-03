use bolt_lang::*;
use game_config::GameConfig;
use player_state::PlayerState;

declare_id!("B41Kov8d1moDABp8RdSTRauZUNpwuNwvc312erhWF7w1");

#[system]
pub mod move_player {
    /// Move the player (decrease y). Parse movement from args.
    /// If RED LIGHT and player is moving → alive = false (killed).
    /// If GREEN LIGHT → decrease y by move amount.
    /// If y reaches 0 → finished = true.
    /// TODO: implement
    pub fn execute(ctx: Context<Components>, _args: Vec<u8>) -> Result<Components> {
        Ok(ctx.accounts)
    }

    #[system_input]
    pub struct Components {
        pub player_state: PlayerState,
        pub game_config: GameConfig,
    }
}
