import { PublicKey } from "@solana/web3.js";

// Components
export const GAME_CONFIG_COMPONENT = new PublicKey("4xBQY5TrECe2EUgepnauMdtkSjChxkbw9NvCmwAnMZe6");
export const PLAYER_STATE_COMPONENT = new PublicKey("BCHiAy9P55oJjVrLYQ3nyEBzxTDrBVvdDw2JHz3nAAKh");
export const PLAYER_REGISTRY_COMPONENT = new PublicKey("Aj4HqM8KTLv5avzoUVAky7dRHXU8mCYjvoT6LgPz8BEm");
export const LEADERBOARD_COMPONENT = new PublicKey("EVBJ4dfhix7Cfd6ycx7cTK6NJc3k6pjF5Nz3obKcXC3T");

// Systems
export const INIT_GAME_SYSTEM = new PublicKey("7ASuMaj8sZRjvaEB8qE9o5tuFoyQ5UUCR3H354itdsQA");
export const SPAWN_PLAYER_SYSTEM = new PublicKey("3PYqQuPT96x5GA4EXcDkqKC7DKXLbdkYyJrxNGVWE6fU");
export const START_GAME_SYSTEM = new PublicKey("AUmgrJaCwgJ9QBB3oJGdraA9MswXzjuAgrLTuxA3dYSh");
export const MOVE_PLAYER_SYSTEM = new PublicKey("k2G5xobAryNuPg2FkQd6pK5DQcfErUGskWS54qbC833");
export const CHECK_PRICE_SYSTEM = new PublicKey("C79XfcHutZS87nW1WB52pjtEhdioNMTxxc1Uz5QDTg9E");
export const END_GAME_SYSTEM = new PublicKey("D3Rnz7b9WTovkJzMn46N7cMDrRtkcCw44mRKGFCJZuQv");

// All components for game entity init + delegation
export const ALL_COMPONENTS = [
  GAME_CONFIG_COMPONENT,
  PLAYER_STATE_COMPONENT,
  PLAYER_REGISTRY_COMPONENT,
  LEADERBOARD_COMPONENT,
];
