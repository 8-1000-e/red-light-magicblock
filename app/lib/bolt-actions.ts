import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import {
  InitializeNewWorld,
  AddEntity,
  InitializeComponent,
  ApplySystem,
  FindComponentPda,
  createDelegateInstruction,
  CreateSession,
  Session,
} from "@magicblock-labs/bolt-sdk";
import { BN } from "@coral-xyz/anchor";
import {
  ALL_COMPONENTS,
  GAME_CONFIG_COMPONENT,
  PLAYER_STATE_COMPONENT,
  PLAYER_REGISTRY_COMPONENT,
  INIT_GAME_SYSTEM,
  SPAWN_PLAYER_SYSTEM,
  START_GAME_SYSTEM,
  MOVE_PLAYER_SYSTEM,
  CHECK_PRICE_SYSTEM,
} from "./program-ids";

let ER_VALIDATOR = new PublicKey("mAGicPQYBMvcYveUZA5F5UNNwyHvfYh5xkLS2Fr1mev");

export function setErValidator(pubkey: string) {
  ER_VALIDATOR = new PublicKey(pubkey);
}

export interface GameState {
  worldPda: PublicKey;
  gameEntityPda: PublicKey;
  playerEntityPda?: PublicKey;
}

type Log = (msg: string) => void;

// ─── Helpers ───

async function prepareTx(tx: Transaction, connection: Connection, payer: PublicKey): Promise<Transaction> {
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer;
  return tx;
}

async function sendSignedTx(tx: Transaction, connection: Connection, log: Log, label: string): Promise<string> {
  log(`Sending tx (${label})...`);
  const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true });
  log(`Sent: ${sig.slice(0, 16)}...`);
  await connection.confirmTransaction(sig, "confirmed");
  log(`Confirmed: ${sig.slice(0, 16)}...`);
  return sig;
}

function sendSessionTx(session: Session) {
  return async (tx: Transaction, conn: Connection): Promise<string> => {
    const { blockhash } = await conn.getLatestBlockhash();
    tx.feePayer = session.signer.publicKey;
    tx.recentBlockhash = blockhash;
    tx.sign(session.signer);
    const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: true });
    const result = await conn.confirmTransaction(sig, "confirmed");
    if (result.value.err) throw new Error(`TX failed: ${JSON.stringify(result.value.err)}`);
    return sig;
  };
}

// ─── Create game + delegate (2 wallet signs) ───
export async function createGameAndDelegate(
  connection: Connection,
  erConnection: Connection,
  payer: PublicKey,
  signAllTransactions: (txs: Transaction[]) => Promise<Transaction[]>,
  log: Log,
): Promise<GameState> {
  log("--- CREATE GAME ---");

  // Phase 1: Create world
  const initWorld = await InitializeNewWorld({ payer, connection });
  const worldPda = initWorld.worldPda;
  await prepareTx(initWorld.transaction, connection, payer);
  const [signedWorld] = await signAllTransactions([initWorld.transaction]);
  await sendSignedTx(signedWorld, connection, log, "create world");
  log(`World: ${worldPda.toBase58().slice(0, 12)}...`);

  // Phase 2: Add game entity + init components + init-game + delegate
  const addGameEntity = await AddEntity({ payer, world: worldPda, connection });
  const gameEntityPda = addGameEntity.entityPda;

  const batchInitTx = new Transaction();
  for (const componentId of ALL_COMPONENTS) {
    const initComp = await InitializeComponent({ payer, entity: gameEntityPda, componentId });
    batchInitTx.add(...initComp.transaction.instructions);
  }

  const applyInitGame = await ApplySystem({
    authority: payer,
    systemId: INIT_GAME_SYSTEM,
    world: worldPda,
    entities: [
      { entity: gameEntityPda, components: [{ componentId: GAME_CONFIG_COMPONENT }] },
    ],
  });

  // Delegate all 3 components to ER
  const delegateIxs = ALL_COMPONENTS.map((componentId) => {
    const componentPda = FindComponentPda({ componentId, entity: gameEntityPda });
    return createDelegateInstruction(
      { payer, entity: gameEntityPda, account: componentPda, ownerProgram: componentId },
      0, ER_VALIDATOR,
    );
  });
  const delegateTx = new Transaction().add(...delegateIxs);

  // Prepare + sign all in 1 popup
  const l1Txs = [addGameEntity.transaction, batchInitTx, applyInitGame.transaction, delegateTx];
  for (const tx of l1Txs) await prepareTx(tx, connection, payer);

  log("Signing (1 approval)...");
  const signedL1 = await signAllTransactions(l1Txs);

  await sendSignedTx(signedL1[0], connection, log, "add game entity");
  log(`Game entity: ${gameEntityPda.toBase58().slice(0, 12)}...`);
  await sendSignedTx(signedL1[1], connection, log, "init 3 components");
  await sendSignedTx(signedL1[2], connection, log, "init-game");
  await sendSignedTx(signedL1[3], connection, log, "delegate to ER");

  // Phase 3: Re-apply init-game on ER
  const applyInitGameER = await ApplySystem({
    authority: payer,
    systemId: INIT_GAME_SYSTEM,
    world: worldPda,
    entities: [
      { entity: gameEntityPda, components: [{ componentId: GAME_CONFIG_COMPONENT }] },
    ],
  });
  await prepareTx(applyInitGameER.transaction, erConnection, payer);
  const [signedER] = await signAllTransactions([applyInitGameER.transaction]);
  await sendSignedTx(signedER, erConnection, log, "init-game on ER");

  log("Game created + delegated!");
  return { worldPda, gameEntityPda };
}

// ─── Session + join game (1 wallet sign) ───
export async function createSessionAndJoin(
  l1Connection: Connection,
  erConnection: Connection | null,
  payer: PublicKey,
  signAllTransactions: (txs: Transaction[]) => Promise<Transaction[]>,
  worldPda: PublicKey,
  gameEntityPda: PublicKey,
  delegated: boolean,
  playerName: string,
  skin: number,
  log: Log,
): Promise<{ session: Session; playerEntityPda: PublicKey }> {
  log("--- SESSION + JOIN ---");

  // 1. Session key
  const sessionSigner = Keypair.generate();
  const topUp = new BN(0.002 * 1e9);
  const validity = new BN(Math.floor(Date.now() / 1000) + 60 * 60);
  const { transaction: sessionTx, session } = await CreateSession({
    sessionSigner, authority: payer, topUp, validity,
  });
  await prepareTx(sessionTx, l1Connection, payer);
  sessionTx.partialSign(sessionSigner);

  // 2. Player entity + components
  const addPlayerEntity = await AddEntity({ payer, world: worldPda, connection: l1Connection });
  const playerEntityPda = addPlayerEntity.entityPda;

  const playerComponents = [PLAYER_STATE_COMPONENT];
  const batchInitTx = new Transaction();
  for (const componentId of playerComponents) {
    const initComp = await InitializeComponent({ payer, entity: playerEntityPda, componentId });
    batchInitTx.add(...initComp.transaction.instructions);
  }

  const l1Txs = [sessionTx, addPlayerEntity.transaction, batchInitTx];

  // Delegate player component if game is on ER
  if (delegated && erConnection) {
    const batchDelegateTx = new Transaction();
    for (const componentId of playerComponents) {
      const componentPda = FindComponentPda({ componentId, entity: playerEntityPda });
      const ix = createDelegateInstruction(
        { payer, entity: playerEntityPda, account: componentPda, ownerProgram: componentId },
        0, ER_VALIDATOR,
      );
      batchDelegateTx.add(ix);
    }
    l1Txs.push(batchDelegateTx);
  }

  for (const tx of l1Txs.slice(1)) await prepareTx(tx, l1Connection, payer);

  log("Signing (1 approval)...");
  const signedL1 = await signAllTransactions(l1Txs);

  await sendSignedTx(signedL1[0], l1Connection, log, "create session");
  await sendSignedTx(signedL1[1], l1Connection, log, "add player entity");
  await sendSignedTx(signedL1[2], l1Connection, log, "init player components");
  if (signedL1[3]) await sendSignedTx(signedL1[3], l1Connection, log, "delegate player to ER");

  // 3. Spawn on ER via session key
  const spawnConn = (delegated && erConnection) ? erConnection : l1Connection;
  const applySpawn = await ApplySystem({
    authority: session.signer.publicKey,
    systemId: SPAWN_PLAYER_SYSTEM,
    world: worldPda,
    entities: [
      { entity: playerEntityPda, components: [{ componentId: PLAYER_STATE_COMPONENT }] },
      { entity: gameEntityPda, components: [{ componentId: GAME_CONFIG_COMPONENT }, { componentId: PLAYER_REGISTRY_COMPONENT }] },
    ],
    args: { name: playerName, skin },
    session,
  });
  const sendSession = sendSessionTx(session);
  await sendSession(applySpawn.transaction, spawnConn);
  log("Player spawned!");

  return { session, playerEntityPda };
}

// ─── Move player (session key, no popup) ───
export async function movePlayer(
  connection: Connection,
  session: Session,
  worldPda: PublicKey,
  playerEntityPda: PublicKey,
  gameEntityPda: PublicKey,
): Promise<string> {
  const applyMove = await ApplySystem({
    authority: session.signer.publicKey,
    systemId: MOVE_PLAYER_SYSTEM,
    world: worldPda,
    entities: [
      { entity: playerEntityPda, components: [{ componentId: PLAYER_STATE_COMPONENT }] },
      { entity: gameEntityPda, components: [{ componentId: GAME_CONFIG_COMPONENT }] },
    ],
    session,
  });
  const send = sendSessionTx(session);
  return send(applyMove.transaction, connection);
}

// ─── Check price (session key or anyone) ───
export async function checkPrice(
  connection: Connection,
  session: Session,
  worldPda: PublicKey,
  gameEntityPda: PublicKey,
  pythPricePda: PublicKey,
): Promise<string> {
  const applyCheck = await ApplySystem({
    authority: session.signer.publicKey,
    systemId: CHECK_PRICE_SYSTEM,
    world: worldPda,
    entities: [
      { entity: gameEntityPda, components: [{ componentId: GAME_CONFIG_COMPONENT }] },
    ],
    extraAccounts: [{ pubkey: pythPricePda, isWritable: false, isSigner: false }],
    session,
  });
  const send = sendSessionTx(session);
  return send(applyCheck.transaction, connection);
}

// ─── Start game (after lobby) ───
export async function startGame(
  connection: Connection,
  session: Session,
  worldPda: PublicKey,
  gameEntityPda: PublicKey,
  pythPricePda: PublicKey,
): Promise<string> {
  const applyStart = await ApplySystem({
    authority: session.signer.publicKey,
    systemId: START_GAME_SYSTEM,
    world: worldPda,
    entities: [
      { entity: gameEntityPda, components: [{ componentId: GAME_CONFIG_COMPONENT }] },
    ],
    extraAccounts: [{ pubkey: pythPricePda, isWritable: false, isSigner: false }],
    session,
  });
  const send = sendSessionTx(session);
  return send(applyStart.transaction, connection);
}
