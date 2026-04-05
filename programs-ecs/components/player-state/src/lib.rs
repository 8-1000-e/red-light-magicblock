use bolt_lang::*;

declare_id!("BCHiAy9P55oJjVrLYQ3nyEBzxTDrBVvdDw2JHz3nAAKh");

#[component(delegate)]
pub struct PlayerState {
    pub authority: Pubkey,
    pub alive: bool,
    pub finished: bool,
    pub finish_time: i64,
    /// Y position: 0 = start (bottom), 300 = finish (top)
    pub y: u16,
    /// Player name (max 16 bytes)
    pub name: [u8; 16],
    pub name_len: u8,
    /// Anti speed hack — last slot a move was processed
    pub last_move_slot: u64,
    /// Skin number (1-based, matches props_X_front.png)
    pub skin: u8,
    /// Timestamp when player can respawn (0 = not dead)
    pub respawn_time: i64,
}

impl Default for PlayerState {
    fn default() -> Self {
        Self {
            authority: Pubkey::default(),
            alive: false,
            finished: false,
            finish_time: 0,
            y: 0,
            name: [0u8; 16],
            name_len: 0,
            last_move_slot: 0,
            skin: 1,
            respawn_time: 0,
            bolt_metadata: BoltMetadata::default(),
        }
    }
}
