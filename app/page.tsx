"use client";
import { useState, useCallback } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useSolPrice } from "./hooks/useSolPrice";
import MainMenu from "./components/MainMenu";
import Game from "./components/Game";
import { createGameAndDelegate, createSessionAndJoin, GameState } from "./lib/bolt-actions";
import { Session } from "@magicblock-labs/bolt-sdk";

const ER_RPC = "http://localhost:7799";

export default function Home() {
  const { price, history } = useSolPrice();
  const { connection } = useConnection();
  const { publicKey, signAllTransactions } = useWallet();
  const [screen, setScreen] = useState<"menu" | "game">("menu");
  const [skin, setSkin] = useState(1);
  const [playerName, setPlayerName] = useState("");
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const erConnection = new Connection(ER_RPC, "confirmed");

  const addLog = useCallback((msg: string) => {
    console.log(msg);
    setLog((prev) => [...prev.slice(-20), msg]);
  }, []);

  const handleCreateGame = useCallback(async (selectedSkin: number, name: string) => {
    if (!publicKey || !signAllTransactions) {
      addLog("Connect your wallet first!");
      return;
    }
    setLoading(true);
    setSkin(selectedSkin);
    setPlayerName(name);
    try {
      // 1. Create game on L1 + delegate to ER
      addLog("Creating game...");
      const state = await createGameAndDelegate(
        connection, erConnection, publicKey, signAllTransactions, addLog,
      );
      setGameState(state);

      // 2. Create session + join
      addLog("Joining game...");
      const { session: sess, playerEntityPda } = await createSessionAndJoin(
        connection, erConnection, publicKey, signAllTransactions,
        state.worldPda, state.gameEntityPda, true, name, selectedSkin, addLog,
      );
      setSession(sess);
      setGameState({ ...state, playerEntityPda });

      addLog("Game created! Entering lobby...");
      setScreen("game");
    } catch (e: any) {
      addLog(`Error: ${e.message}`);
      console.error(e);
    }
    setLoading(false);
  }, [publicKey, signAllTransactions, connection, erConnection, addLog]);

  const handleJoinGame = useCallback(async (gameId: string, selectedSkin: number, name: string) => {
    // TODO: resolve gameId → worldPda + gameEntityPda, then createSessionAndJoin
    addLog(`Joining game ${gameId.slice(0, 8)}... (not yet implemented)`);
  }, [addLog]);

  if (screen === "menu") {
    return (
      <div className="relative">
        <MainMenu
          price={price}
          connection={connection}
          onCreateGame={handleCreateGame}
          onJoinGame={handleJoinGame}
        />
        {/* Wallet button */}
        <div className="absolute top-3 left-3 z-50">
          <WalletMultiButton />
        </div>
        {/* Loading overlay */}
        {loading && (
          <div className="fixed inset-0 z-50 bg-black/70 flex flex-col items-center justify-center gap-4">
            <div className="text-2xl text-yellow-400 animate-pulse">Creating game...</div>
            <div className="max-w-md text-sm text-gray-400 text-center">
              {log.slice(-3).map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black text-white flex flex-col overflow-hidden">
      <Game
        price={price}
        history={history}
        skin={skin}
        onBack={() => setScreen("menu")}
      />
    </div>
  );
}
