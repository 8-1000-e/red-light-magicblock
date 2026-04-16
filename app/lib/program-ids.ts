import { PublicKey } from "@solana/web3.js";

// Components
export const GAME_CONFIG_COMPONENT = new PublicKey("s3SeWXJEkjvj7kVxptEJCxnq6XY4wzja1vVHcAYJLAu");
export const PLAYER_STATE_COMPONENT = new PublicKey("GyvRi4vsBV7EnVmPTVnvekznbTHW3YfUhsUi8mir8FzF");
export const PLAYER_REGISTRY_COMPONENT = new PublicKey("BcsUagMEnK2GoDCmKfLe6uZikLw2ZBGCC3RYqp6CdVGQ");
export const LEADERBOARD_COMPONENT = new PublicKey("6t7mqQmYpTDRvovNfAZW66y9vQdU7UKcSo3TCP9fPRNk");

// Systems
export const INIT_GAME_SYSTEM = new PublicKey("38wPngniB8Hn4eHqbr2rJBXVLtNGgYYDcLBtqHfPm6Wn");
export const SPAWN_PLAYER_SYSTEM = new PublicKey("CSkzXYoeQJXNRtEoPYaf5vUX7vhFooBeRjpJc1DkHrPT");
export const START_GAME_SYSTEM = new PublicKey("51AxDtg6NSUJZw1yeocFNs5qcHrxyJDNcYGT26Xi32r7");
export const MOVE_PLAYER_SYSTEM = new PublicKey("B3jhhTuDaZ5WebzsWQs6GDsm2p63nH5AxNcxhDkj7hFu");
export const CHECK_PRICE_SYSTEM = new PublicKey("6KChRcRC1UtgnWcpxEStZyryAXqpRpzsaPBqHw9BqVyv");
export const END_GAME_SYSTEM = new PublicKey("7H3MHGLVtkaTve5WHTfcgtMUf3HJ7xhcj9WVNPxaBsNW");

// All components for game entity init + delegation
export const ALL_COMPONENTS = [
  GAME_CONFIG_COMPONENT,
  PLAYER_STATE_COMPONENT,
  PLAYER_REGISTRY_COMPONENT,
  LEADERBOARD_COMPONENT,
];
