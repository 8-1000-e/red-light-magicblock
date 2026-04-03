"use client";
import { useState } from "react";
import Image from "next/image";

interface GameListing {
  id: string;
  players: number;
  maxPlayers: number;
  countdown: number; // seconds remaining in lobby, 0 = in progress
  status: "lobby" | "playing";
}

const TOTAL_SKINS = 5; // will grow as you add props_2, props_3, etc.

interface Props {
  price: number | null;
  onCreateGame: (skin: number) => void;
  onJoinGame: (id: string, skin: number) => void;
}

// Fake games for now — will be replaced by on-chain data
const FAKE_GAMES: GameListing[] = [
  { id: "game-1", players: 4, maxPlayers: 10, countdown: 22, status: "lobby" },
  { id: "game-2", players: 7, maxPlayers: 10, countdown: 0, status: "playing" },
  { id: "game-3", players: 2, maxPlayers: 10, countdown: 35, status: "lobby" },
];

export default function MainMenu({ price, onCreateGame, onJoinGame }: Props) {
  const [playerName, setPlayerName] = useState("");
  const [selectedSkin, setSelectedSkin] = useState(1);

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0" style={{
        backgroundImage: "url('/LOBBY.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        filter: "blur(6px) brightness(0.4)",
      }} />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-3 w-full max-w-xl px-4">

        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="text-6xl text-yellow-400" style={{
            textShadow: "0 0 30px rgba(250, 204, 21, 0.3), 0 6px 0 #92400e"
          }}>
            SOL
          </div>
          <div className="text-4xl text-white" style={{
            textShadow: "0 4px 0 #374151"
          }}>
            SURVIVORS
          </div>
          <div className="text-lg text-gray-400 mt-1">
            Price drops = Red light = Don&apos;t move
          </div>
        </div>

        {/* Skin selector */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => setSelectedSkin((s) => s <= 1 ? TOTAL_SKINS : s - 1)}
            className="text-3xl text-white/60 hover:text-white transition"
          >
            &lt;
          </button>
          <div className="relative" style={{ width: 100, height: 120 }}>
            <Image
              src={`/props_${selectedSkin}_front.png`}
              alt={`skin ${selectedSkin}`}
              fill
              className="object-contain"
              style={{ imageRendering: "pixelated" }}
              onError={(e) => {
                // Fallback to skin 1 if image doesn't exist
                (e.target as HTMLImageElement).src = "/props_1_front.png";
              }}
            />
          </div>
          <button
            onClick={() => setSelectedSkin((s) => s >= TOTAL_SKINS ? 1 : s + 1)}
            className="text-3xl text-white/60 hover:text-white transition"
          >
            &gt;
          </button>
        </div>
        <div className="text-sm text-gray-300">
          Skin #{selectedSkin}
        </div>

        {/* SOL Price */}
        <div className="text-lg text-gray-400">
          SOL/USD: <span className="text-cyan-400">${price?.toFixed(4) ?? "..."}</span>
        </div>

        {/* Name input */}
        <div className="w-full max-w-xs">
          <input
            type="text"
            placeholder="Enter your name..."
            maxLength={16}
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="w-full bg-black/50 border-2 border-gray-700 text-white px-4 py-3 text-center text-lg focus:outline-none focus:border-yellow-500 placeholder-gray-600"
          />
        </div>

        {/* Create Game button */}
        <button
          onClick={() => onCreateGame(selectedSkin)}
          disabled={!price || playerName.length === 0}
          className="w-full max-w-xs py-4 bg-green-700 hover:bg-green-600 disabled:bg-gray-800 disabled:text-gray-600 border-2 border-green-900 disabled:border-gray-700 text-white text-xl transition"
          style={{ textShadow: "0 2px 0 rgba(0,0,0,0.3)" }}
        >
          CREATE GAME
        </button>

        {/* Game list */}
        <div className="w-full">
          <div className="text-sm text-gray-300 mb-3 text-center">
            — OR JOIN A GAME —
          </div>

          <div className="flex flex-col gap-2">
            {FAKE_GAMES.map((game) => (
              <button
                key={game.id}
                onClick={() => onJoinGame(game.id, selectedSkin)}
                disabled={game.status === "playing" || playerName.length === 0}
                className="w-full flex items-center justify-between px-4 py-3 bg-black/40 border border-gray-700 hover:border-gray-500 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:border-gray-700 transition"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    game.status === "lobby" ? "bg-green-500 animate-pulse" : "bg-red-500"
                  }`} />
                  <span className="text-white text-sm">{game.id}</span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-gray-300">{game.players}/{game.maxPlayers}</span>
                  {game.status === "lobby" ? (
                    <span className="text-yellow-400">{game.countdown}s</span>
                  ) : (
                    <span className="text-red-400">IN GAME</span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {FAKE_GAMES.length === 0 && (
            <div className="text-center text-gray-600 text-sm py-4">
              No games available — create one!
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-[10px] text-gray-400 mt-4">
          Built on MagicBlock Ephemeral Rollups + Pyth Lazer
        </div>
      </div>
    </div>
  );
}
