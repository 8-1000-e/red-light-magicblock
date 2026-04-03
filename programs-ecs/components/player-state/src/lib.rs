use bolt_lang::*;

declare_id!("3pXqzoU9T4uQzVTv1gZJrPNe59qFKy2GP4353JK22Swu");

#[component(delegate)]
#[derive(Default)]
pub struct PlayerState {
    pub authority: Pubkey,
    pub alive: bool,
    pub finished: bool,
    pub finish_time: i64,
    /// Y position (0 = top/finish, 100 = bottom/start)
    pub y: u8,
}
