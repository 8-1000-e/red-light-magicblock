import * as anchor from "@coral-xyz/anchor";
import { Program, BN, AnchorError } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Connection,
} from "@solana/web3.js";
import { expect } from "chai";
import { RedLightLobby } from "../target/types/red_light_lobby";

// ── Config ──────────────────────────────────────────────────────────────────
// Run against devnet with the local `~/.config/solana/id.json` keypair as
// authority. Small entry fee so we don't burn real SOL.

const ENTRY_FEE_LAMPORTS = new BN(1_000_000); // 0.001 SOL per player
const AIRDROP_LAMPORTS = 5_000_000; // 0.005 SOL to fund a test player
const LOBBY_SEED = Buffer.from("lobby");
const VAULT_SEED = Buffer.from("vault");

// Fake pubkey for an invalid leaderboard (SystemProgram-owned address)
const FAKE_LEADERBOARD_OWNER = SystemProgram.programId;

describe("red-light-lobby", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const program = anchor.workspace.redLightLobby as Program<RedLightLobby>;
  const authority = (provider.wallet as anchor.Wallet).payer;

  /** Derive the two PDAs for a given lobby_id. */
  function pdas(lobbyId: BN) {
    const [lobbyPda] = PublicKey.findProgramAddressSync(
      [LOBBY_SEED, lobbyId.toArrayLike(Buffer, "le", 8)],
      program.programId,
    );
    const [vaultPda] = PublicKey.findProgramAddressSync(
      [VAULT_SEED, lobbyPda.toBuffer()],
      program.programId,
    );
    return { lobbyPda, vaultPda };
  }

  /**
   * Fund a fresh keypair via SystemProgram.transfer from the authority wallet.
   * We avoid `requestAirdrop` because devnet faucet rate-limits hard.
   */
  async function makePlayer(): Promise<Keypair> {
    const kp = Keypair.generate();
    const tx = new anchor.web3.Transaction().add(
      SystemProgram.transfer({
        fromPubkey: authority.publicKey,
        toPubkey: kp.publicKey,
        lamports: AIRDROP_LAMPORTS,
      }),
    );
    await provider.sendAndConfirm(tx, [authority], { commitment: "confirmed" });
    return kp;
  }

  // ── Happy path ────────────────────────────────────────────────────────────

  describe("happy path", () => {
    const lobbyId = new BN(Date.now());
    const { lobbyPda, vaultPda } = pdas(lobbyId);
    let alice: Keypair;
    let bob: Keypair;

    before(async () => {
      alice = await makePlayer(provider.connection);
      bob = await makePlayer(provider.connection);
    });

    it("create_lobby initializes Lobby and Vault PDAs", async () => {
      await program.methods
        .createLobby(lobbyId, ENTRY_FEE_LAMPORTS)
        .accounts({
          lobby: lobbyPda,
          vault: vaultPda,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const lobby = await program.account.lobby.fetch(lobbyPda);
      expect(lobby.lobbyId.toString()).to.equal(lobbyId.toString());
      expect(lobby.authority.equals(authority.publicKey)).to.be.true;
      expect(lobby.entryFee.toString()).to.equal(ENTRY_FEE_LAMPORTS.toString());
      expect(lobby.playerCount).to.equal(0);
      expect(lobby.status).to.equal(0); // STATUS_OPEN

      const vault = await program.account.vault.fetch(vaultPda);
      expect(vault.lobby.equals(lobbyPda)).to.be.true;
      expect(vault.totalPot.toString()).to.equal("0");
    });

    it("join_lobby adds player and transfers entry fee to vault", async () => {
      const vaultBefore = await provider.connection.getBalance(vaultPda);

      await program.methods
        .joinLobby(lobbyId)
        .accounts({
          lobby: lobbyPda,
          vault: vaultPda,
          player: alice.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([alice])
        .rpc();

      const lobby = await program.account.lobby.fetch(lobbyPda);
      expect(lobby.playerCount).to.equal(1);
      expect(lobby.players[0].equals(alice.publicKey)).to.be.true;

      const vault = await program.account.vault.fetch(vaultPda);
      expect(vault.totalPot.toString()).to.equal(ENTRY_FEE_LAMPORTS.toString());

      const vaultAfter = await provider.connection.getBalance(vaultPda);
      expect(vaultAfter - vaultBefore).to.equal(ENTRY_FEE_LAMPORTS.toNumber());
    });

    it("second player can also join", async () => {
      await program.methods
        .joinLobby(lobbyId)
        .accounts({
          lobby: lobbyPda,
          vault: vaultPda,
          player: bob.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([bob])
        .rpc();

      const lobby = await program.account.lobby.fetch(lobbyPda);
      expect(lobby.playerCount).to.equal(2);
      expect(lobby.players[1].equals(bob.publicKey)).to.be.true;

      const vault = await program.account.vault.fetch(vaultPda);
      expect(vault.totalPot.toString()).to.equal(
        ENTRY_FEE_LAMPORTS.muln(2).toString(),
      );
    });

    it("start_match flips status and blocks new joins", async () => {
      await program.methods
        .startMatch(lobbyId)
        .accounts({
          lobby: lobbyPda,
          authority: authority.publicKey,
        })
        .rpc();

      const lobby = await program.account.lobby.fetch(lobbyPda);
      expect(lobby.status).to.equal(1); // STATUS_STARTED
      expect(lobby.startedAt.toNumber()).to.be.greaterThan(0);
    });

    it("join_lobby after start fails with LobbyNotOpen", async () => {
      const latecomer = await makePlayer(provider.connection);
      try {
        await program.methods
          .joinLobby(lobbyId)
          .accounts({
            lobby: lobbyPda,
            vault: vaultPda,
            player: latecomer.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([latecomer])
          .rpc();
        expect.fail("should have failed with LobbyNotOpen");
      } catch (err) {
        const anchorErr = err as AnchorError;
        expect(anchorErr.error.errorCode.code).to.equal("LobbyNotOpen");
      }
    });

    it("distribute_prize with a non-leaderboard account fails with InvalidLeaderboardOwner", async () => {
      // Use the Vault PDA as a stand-in — it's owned by red_light_lobby, not by the leaderboard component.
      try {
        await program.methods
          .distributePrize(lobbyId)
          .accounts({
            lobby: lobbyPda,
            vault: vaultPda,
            leaderboard: vaultPda, // wrong owner on purpose
            treasury: authority.publicKey,
            authority: authority.publicKey,
          })
          .rpc();
        expect.fail("should have failed with InvalidLeaderboardOwner");
      } catch (err) {
        const anchorErr = err as AnchorError;
        expect(anchorErr.error.errorCode.code).to.equal(
          "InvalidLeaderboardOwner",
        );
      }
    });

    it("close_lobby before settle fails with AlreadySettled", async () => {
      // `close_lobby` gate requires STATUS_SETTLED. Calling it while Started should reject.
      try {
        await program.methods
          .closeLobby(lobbyId)
          .accounts({
            lobby: lobbyPda,
            vault: vaultPda,
            authority: authority.publicKey,
          })
          .rpc();
        expect.fail("should have failed with AlreadySettled");
      } catch (err) {
        const anchorErr = err as AnchorError;
        expect(anchorErr.error.errorCode.code).to.equal("AlreadySettled");
      }
    });
  });

  // ── Negative cases ────────────────────────────────────────────────────────

  describe("negative cases", () => {
    it("join_lobby twice with same player fails with AlreadyJoined", async () => {
      const lobbyId = new BN(Date.now() + 1);
      const { lobbyPda, vaultPda } = pdas(lobbyId);
      const player = await makePlayer(provider.connection);

      await program.methods
        .createLobby(lobbyId, ENTRY_FEE_LAMPORTS)
        .accounts({
          lobby: lobbyPda,
          vault: vaultPda,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await program.methods
        .joinLobby(lobbyId)
        .accounts({
          lobby: lobbyPda,
          vault: vaultPda,
          player: player.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([player])
        .rpc();

      try {
        await program.methods
          .joinLobby(lobbyId)
          .accounts({
            lobby: lobbyPda,
            vault: vaultPda,
            player: player.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([player])
          .rpc();
        expect.fail("should have failed with AlreadyJoined");
      } catch (err) {
        const anchorErr = err as AnchorError;
        expect(anchorErr.error.errorCode.code).to.equal("AlreadyJoined");
      }
    });

    it("start_match by non-authority fails with Unauthorized", async () => {
      const lobbyId = new BN(Date.now() + 2);
      const { lobbyPda, vaultPda } = pdas(lobbyId);
      const imposter = await makePlayer(provider.connection);

      await program.methods
        .createLobby(lobbyId, ENTRY_FEE_LAMPORTS)
        .accounts({
          lobby: lobbyPda,
          vault: vaultPda,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      try {
        await program.methods
          .startMatch(lobbyId)
          .accounts({ lobby: lobbyPda, authority: imposter.publicKey })
          .signers([imposter])
          .rpc();
        expect.fail("should have failed with Unauthorized");
      } catch (err) {
        const anchorErr = err as AnchorError;
        expect(anchorErr.error.errorCode.code).to.equal("Unauthorized");
      }
    });

    it("start_match on an already-started lobby fails with LobbyNotOpen", async () => {
      const lobbyId = new BN(Date.now() + 3);
      const { lobbyPda, vaultPda } = pdas(lobbyId);

      await program.methods
        .createLobby(lobbyId, ENTRY_FEE_LAMPORTS)
        .accounts({
          lobby: lobbyPda,
          vault: vaultPda,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await program.methods
        .startMatch(lobbyId)
        .accounts({ lobby: lobbyPda, authority: authority.publicKey })
        .rpc();

      try {
        await program.methods
          .startMatch(lobbyId)
          .accounts({ lobby: lobbyPda, authority: authority.publicKey })
          .rpc();
        expect.fail("should have failed with LobbyNotOpen");
      } catch (err) {
        const anchorErr = err as AnchorError;
        expect(anchorErr.error.errorCode.code).to.equal("LobbyNotOpen");
      }
    });
  });
});
