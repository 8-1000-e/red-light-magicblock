pub mod create_lobby;
pub mod join_lobby;
pub mod start_match;
pub mod distribute_prize;
pub mod close_lobby;

// Glob re-export: each handler is uniquely named (create_lobby, join_lobby, …)
// so no collision, and the Accounts structs + generated __client_accounts_*
// modules are made available at crate root for Anchor's #[program] macro.
pub use create_lobby::*;
pub use join_lobby::*;
pub use start_match::*;
pub use distribute_prize::*;
pub use close_lobby::*;
