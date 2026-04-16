use bolt_lang::*;
use game_config::GameConfig;
use player_state::PlayerState;
use player_registry::PlayerRegistry;
use shared::{parse_json_str, parse_json_u64, GameError};

declare_id!("CSkzXYoeQJXNRtEoPYaf5vUX7vhFooBeRjpJc1DkHrPT");

#[system]
pub mod spawn_player {
    pub fn execute(ctx: Context<Components>, _args: Vec<u8>) -> Result<Components> 
    {
        require!(ctx.accounts.game_config.status == 0, GameError::GameNotWaiting);
        let active = ctx.accounts.game_config.active_players as usize;
        require!(active < 10, GameError::TooManyPlayers);

        // Parse name
        let name_bytes = parse_json_str(&_args, b"name");
        let len = name_bytes.len().min(16);
        ctx.accounts.player_state.name[..len].copy_from_slice(&name_bytes[..len]);
        ctx.accounts.player_state.name_len = len as u8;

        // authority = session_signer (whoever signed the tx) — BOLT convention
        ctx.accounts.player_state.authority = *ctx.accounts.authority.key;

        // owner = phantom pubkey of the player, passed as last remaining_account
        let owner_idx = ctx.remaining_accounts.len() - 1;
        ctx.accounts.player_state.owner = *ctx.remaining_accounts[owner_idx].key;

        // Init player — y=0 (bottom), goes up to 200 (finish)
        ctx.accounts.player_state.alive = true;
        ctx.accounts.player_state.finished = false;
        ctx.accounts.player_state.finish_time = 0;
        ctx.accounts.player_state.y = 0;

        let skin = parse_json_u64(&_args, b"skin") as u8;
        ctx.accounts.player_state.skin = if skin >= 1 { skin } else { 1 };

        // Register in player_registry
        let state_bytes = ctx.accounts.player_state.key().to_bytes();
        ctx.accounts.player_registry.player_states[active] = state_bytes;
        ctx.accounts.player_registry.count += 1;
        ctx.accounts.game_config.active_players += 1;

        Ok(ctx.accounts)
    }

    #[system_input]
    pub struct Components {
        pub player_state: PlayerState,
        pub game_config: GameConfig,
        pub player_registry: PlayerRegistry,
    }
}
