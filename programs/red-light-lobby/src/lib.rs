use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;

pub use instructions::*;

declare_id!("9wP7YLwy4wBUb6fNVbTMqjAXKHSfModT1R1VnkMzVAFH");

#[program]
pub mod red_light_lobby {
    use super::*;

    /// Back creates a new lobby. Opens it for joining.
    pub fn create_lobby(ctx: Context<CreateLobby>, lobby_id: u64, entry_fee: u64) -> Result<()> {
        instructions::create_lobby::create_lobby(ctx, lobby_id, entry_fee)
    }

    /// A player joins an open lobby and pays the entry fee into the vault.
    pub fn join_lobby(ctx: Context<JoinLobby>, lobby_id: u64) -> Result<()> {
        instructions::join_lobby::join_lobby(ctx, lobby_id)
    }

    /// Back locks the lobby so no more players can join — called right before
    /// launching the BOLT match.
    pub fn start_match(ctx: Context<StartMatch>, lobby_id: u64) -> Result<()> {
        instructions::start_match::start_match(ctx, lobby_id)
    }

    /// Back distributes the vault to winners + treasury. The leaderboard
    /// account is passed and decoded on-chain; remaining_accounts must match
    /// leaderboard.entries in order (anti-scam).
    ///
    /// remaining_accounts layout:
    ///   [0..count]  winner wallets in leaderboard order
    pub fn distribute_prize(ctx: Context<DistributePrize>, lobby_id: u64) -> Result<()> {
        instructions::distribute_prize::distribute_prize(ctx, lobby_id)
    }

    /// Back closes a settled lobby and reclaims the rent from Lobby + Vault.
    pub fn close_lobby(ctx: Context<CloseLobby>, lobby_id: u64) -> Result<()> {
        instructions::close_lobby::close_lobby(ctx, lobby_id)
    }
}
