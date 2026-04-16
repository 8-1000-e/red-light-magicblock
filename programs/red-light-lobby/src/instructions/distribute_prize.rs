use anchor_lang::prelude::*;
use crate::constants::*;
use crate::errors::*;
use crate::state::*;

/// Split table (shares of total_pot, in basis points):
///   count = 0    → treasury gets 100%
///   count = 1|2  → winner1 95%, treasury 5%
///   count = 3    → winner1 70%, winner2 25%, treasury 5%
///   count ≥ 4    → winner1 55%, winner2 25%, winner3 15%, treasury 5%
///
/// Anti-scam: the handler decodes the on-chain `leaderboard` account manually
/// and verifies that remaining_accounts[i] matches leaderboard.entries[i] for
/// every paid position. The back cannot substitute its own wallets.
pub fn distribute_prize(ctx: Context<DistributePrize>, _lobby_id: u64) -> Result<()> {
    let lobby = &ctx.accounts.lobby;

    require!(lobby.status == STATUS_STARTED, LobbyError::LobbyNotStarted);
    require_keys_eq!(
        ctx.accounts.authority.key(),
        lobby.authority,
        LobbyError::Unauthorized
    );
    require_keys_eq!(
        ctx.accounts.treasury.key(),
        lobby.authority,
        LobbyError::InvalidTreasury
    );

    // 1. Verify the leaderboard account is owned by the BOLT leaderboard component program
    require_keys_eq!(
        *ctx.accounts.leaderboard.owner,
        LEADERBOARD_COMPONENT_ID,
        LobbyError::InvalidLeaderboardOwner
    );

    // 2. Decode count + entries manually from raw bytes
    let lb_data = ctx.accounts.leaderboard.try_borrow_data()?;
    require!(
        lb_data.len() >= LEADERBOARD_COUNT_OFFSET + 1,
        LobbyError::LeaderboardTooSmall
    );
    let count = lb_data[LEADERBOARD_COUNT_OFFSET].min(MAX_PLAYERS as u8);
    let entries_slice =
        &lb_data[LEADERBOARD_DISC_LEN..LEADERBOARD_DISC_LEN + LEADERBOARD_ENTRIES_LEN];

    // 3. Verify each remaining_account matches the corresponding leaderboard entry
    let rem = ctx.remaining_accounts;
    require!((rem.len() as u8) >= count, LobbyError::NotEnoughAccounts);
    for i in 0..count as usize {
        let expected_bytes: [u8; 32] = entries_slice[i * 32..(i + 1) * 32]
            .try_into()
            .expect("slice of length 32 must convert");
        let expected_pk = Pubkey::new_from_array(expected_bytes);
        require_keys_eq!(rem[i].key(), expected_pk, LobbyError::LeaderboardMismatch);
    }
    drop(lb_data);

    // 4. Compute cuts (all bps out of 10000, fractions of total_pot)
    let total_pot = ctx.accounts.vault.total_pot;
    let (w1_bps, w2_bps, w3_bps): (u64, u64, u64) = match count {
        0 => (0, 0, 0),
        1 | 2 => (9500, 0, 0),
        3 => (7000, 2500, 0),
        _ => (5500, 2500, 1500),
    };
    let w1_cut = total_pot * w1_bps / 10000;
    let w2_cut = total_pot * w2_bps / 10000;
    let w3_cut = total_pot * w3_bps / 10000;

    // Treasury takes 5% normally, or the whole pot when there is no winner.
    let treasury_cut = if count == 0 {
        total_pot
    } else {
        total_pot * PLATFORM_FEE_BPS / 10000
    };

    // 5. Perform the transfers (vault owned by this program → direct lamport ops)
    if w1_cut > 0 {
        ctx.accounts.vault.sub_lamports(w1_cut)?;
        rem[0].add_lamports(w1_cut)?;
    }
    if w2_cut > 0 {
        ctx.accounts.vault.sub_lamports(w2_cut)?;
        rem[1].add_lamports(w2_cut)?;
    }
    if w3_cut > 0 {
        ctx.accounts.vault.sub_lamports(w3_cut)?;
        rem[2].add_lamports(w3_cut)?;
    }
    if treasury_cut > 0 {
        ctx.accounts.vault.sub_lamports(treasury_cut)?;
        ctx.accounts.treasury.add_lamports(treasury_cut)?;
    }

    // 6. Bookkeeping
    let paid = w1_cut + w2_cut + w3_cut + treasury_cut;
    let vault_mut = &mut ctx.accounts.vault;
    vault_mut.total_pot = vault_mut.total_pot.saturating_sub(paid);

    let lobby_mut = &mut ctx.accounts.lobby;
    lobby_mut.status = STATUS_SETTLED;

    Ok(())
}

#[derive(Accounts)]
#[instruction(lobby_id: u64)]
pub struct DistributePrize<'info> {
    #[account(
        mut,
        seeds = [LOBBY_SEED, lobby_id.to_le_bytes().as_ref()],
        bump = lobby.bump,
    )]
    pub lobby: Account<'info, Lobby>,

    #[account(
        mut,
        seeds = [VAULT_SEED, lobby.key().as_ref()],
        bump = vault.bump,
    )]
    pub vault: Account<'info, Vault>,

    /// Red-light leaderboard PDA. Ownership check performed in the handler.
    /// CHECK: raw data, decoded manually.
    pub leaderboard: UncheckedAccount<'info>,

    /// Must equal lobby.authority — guards against rake redirection.
    /// CHECK: key match enforced in handler.
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,

    pub authority: Signer<'info>,
}
