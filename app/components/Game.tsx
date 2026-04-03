"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { PricePoint } from "../hooks/useSolPrice";
import Image from "next/image";

const PLAYER_SIZE = 65;
const DOLL_SIZE = 110;
const MOVE_SPEED = 4;
const CHECK_INTERVAL_MS = 2_000;
const RED_DURATION_MS = 2_500;
const LOBBY_DURATION_MS = 40_000;

const BOT_NAMES = [
  "SolMage", "CryptoWiz", "MoonBoy", "DiamondHands",
  "DgenKing", "RugPuller", "ApeSensei", "TokenLord",
  "ChainGhost", "BlockNinja"
];

interface Player {
  id: string;
  x: number;
  y: number;
  alive: boolean;
  finished: boolean;
  color: string;
}

interface Props {
  price: number | null;
  history: PricePoint[];
  skin?: number;
  onBack?: () => void;
}

const PLAYER_COLORS = ["#22d3ee", "#a78bfa", "#f472b6", "#facc15", "#4ade80", "#fb923c"];

export default function Game({ price, history, skin = 1, onBack }: Props) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const [fieldW, setFieldW] = useState(800);
  const [fieldH, setFieldH] = useState(600);

  // Measure field on mount + resize
  useEffect(() => {
    const measure = () => {
      if (fieldRef.current) {
        setFieldW(fieldRef.current.clientWidth);
        setFieldH(fieldRef.current.clientHeight);
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const FINISH_Y = 40;
  const START_Y = fieldH - 60;

  const [gameState, setGameState] = useState<"idle" | "lobby" | "playing" | "ended">("idle");
  const [light, setLight] = useState<"green" | "red">("green");
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [lastCheckTime, setLastCheckTime] = useState(0);
  const [redUntil, setRedUntil] = useState(0);
  const [player, setPlayer] = useState<Player>({
    id: "local",
    x: 400,
    y: 540,
    alive: true,
    finished: false,
    color: PLAYER_COLORS[0],
  });
  const [keysDown, setKeysDown] = useState<Set<string>>(new Set());
  const [isMoving, setIsMoving] = useState(false);
  const [lobbyPlayers, setLobbyPlayers] = useState<{ name: string; sprite: number }[]>([]);
  const [lobbyCountdown, setLobbyCountdown] = useState(0);
  const [lobbyStartTime, setLobbyStartTime] = useState(0);
  const animRef = useRef<number>(0);
  const gameStartRef = useRef(0);

  // Enter lobby
  const startLobby = useCallback(() => {
    if (!price) return;
    setGameState("lobby");
    setLobbyStartTime(Date.now());
    setLobbyCountdown(LOBBY_DURATION_MS / 1000);
    setLobbyPlayers([{ name: "You", sprite: 1 }]);
    setPlayer((p) => ({ ...p, x: fieldW / 2, y: START_Y, alive: true, finished: false }));
    setLight("green");
  }, [price, fieldW, START_Y]);

  // Lobby countdown + bot joins
  useEffect(() => {
    if (gameState !== "lobby") return;
    const id = setInterval(() => {
      const elapsed = Date.now() - lobbyStartTime;
      const remaining = Math.max(0, Math.ceil((LOBBY_DURATION_MS - elapsed) / 1000));
      setLobbyCountdown(remaining);

      // Random bot joins
      if (Math.random() < 0.08) {
        setLobbyPlayers((prev) => {
          if (prev.length >= 10) return prev;
          const available = BOT_NAMES.filter((n) => !prev.some((p) => p.name === n));
          if (available.length === 0) return prev;
          const name = available[Math.floor(Math.random() * available.length)];
          return [...prev, { name, sprite: Math.floor(Math.random() * 3) + 1 }];
        });
      }

      // Lobby over → start game
      if (remaining <= 0) {
        clearInterval(id);
        setGameState("playing");
        setLastPrice(price!);
        setLastCheckTime(Date.now());
        setRedUntil(0);
        gameStartRef.current = Date.now();
      }
    }, 200);
    return () => clearInterval(id);
  }, [gameState, lobbyStartTime, price]);

  // Retry = go back to lobby
  const startGame = useCallback(() => {
    startLobby();
  }, [startLobby]);

  // Keyboard
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d"].includes(e.key)) {
        e.preventDefault();
        setKeysDown((prev) => new Set(prev).add(e.key));
      }
    };
    const onUp = (e: KeyboardEvent) => {
      setKeysDown((prev) => {
        const next = new Set(prev);
        next.delete(e.key);
        return next;
      });
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, []);

  // Price check logic
  useEffect(() => {
    if (gameState !== "playing" || !price) return;

    const now = Date.now();

    // Still in red light period
    if (now < redUntil) {
      setLight("red");
      return;
    }

    // Red light just expired → force green for this cycle, reset check timer
    if (light === "red" && now >= redUntil && redUntil > 0) {
      setLight("green");
      setLastPrice(price); // reset baseline so next check compares from now
      setLastCheckTime(now);
      setRedUntil(0);
      return;
    }

    // Time for a new check?
    if (now - lastCheckTime >= CHECK_INTERVAL_MS) {
      if (lastPrice !== null) {
        if (price < lastPrice) {
          setLight("red");
          setRedUntil(now + RED_DURATION_MS);
        } else {
          setLight("green");
        }
      }
      setLastPrice(price);
      setLastCheckTime(now);
    }

    // Red light expired → back to green
    if (light === "red" && now >= redUntil && redUntil > 0) {
      setLight("green");
    }
  }, [price, gameState, lastCheckTime, lastPrice, redUntil, light]);

  // Game loop
  useEffect(() => {
    if (gameState !== "playing") return;

    const loop = () => {
      setPlayer((prev) => {
        if (!prev.alive || prev.finished) return prev;

        let dx = 0;
        let dy = 0;
        if (keysDown.has("ArrowUp") || keysDown.has("w")) dy -= MOVE_SPEED;
        if (keysDown.has("ArrowDown") || keysDown.has("s")) dy += MOVE_SPEED;
        if (keysDown.has("ArrowLeft") || keysDown.has("a")) dx -= MOVE_SPEED;
        if (keysDown.has("ArrowRight") || keysDown.has("d")) dx += MOVE_SPEED;

        const moving = dx !== 0 || dy !== 0;
        setIsMoving(moving);

        // RED LIGHT — moving = death
        if (light === "red" && moving) {
          return { ...prev, alive: false };
        }

        if (!moving) return prev;

        const newX = Math.max(PLAYER_SIZE / 2, Math.min(fieldW - PLAYER_SIZE / 2, prev.x + dx));
        const newY = Math.max(0, Math.min(fieldH, prev.y + dy));

        // Reached the top?
        if (newY <= FINISH_Y) {
          setGameState("ended");
          return { ...prev, x: newX, y: FINISH_Y, finished: true };
        }

        return { ...prev, x: newX, y: newY };
      });

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [gameState, keysDown, light]);

  // Death → end game
  useEffect(() => {
    if (!player.alive && gameState === "playing") {
      setGameState("ended");
    }
  }, [player.alive, gameState]);

  const elapsed = gameState !== "lobby" ? ((Date.now() - gameStartRef.current) / 1000).toFixed(1) : "0";

  return (
    <div className="flex flex-col items-center gap-4 w-full h-full flex-1">
      {/* HUD — pixel card top right */}
      <div className="absolute top-2 right-2 z-50 p-4 flex flex-col gap-0 items-center justify-center" style={{ imageRendering: "pixelated", width: 180, height: 190, backgroundImage: "url('/CARD.png')", backgroundSize: "100% 100%", backgroundRepeat: "no-repeat" }}>
        <div className="text-gray-600 text-sm">SOL/USD</div>

        <div className="flex items-baseline gap-1">
          <span className="text-blue-700 text-lg">-3sec:</span>
          <span className="text-gray-800 text-xl">{lastPrice?.toFixed(4) ?? "..."}</span>
        </div>

        <div className={`text-2xl ${light === "red" ? "text-red-600" : "text-green-600"}`}>
          {light === "red" ? "▼" : "▲"}
        </div>

        <div className="flex items-baseline gap-1">
          <span className="text-rose-600 text-lg">now:</span>
          <span className="text-gray-800 text-xl">{price?.toFixed(4) ?? "..."}</span>
        </div>

        {gameState === "playing" && (
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-gray-500 text-[10px]">CHECK IN:</span>
            <span className="text-gray-800 text-sm">{Math.max(0, CHECK_INTERVAL_MS / 1000 - Math.floor((Date.now() - lastCheckTime) / 1000))}sec</span>
          </div>
        )}

        {/* Buttons */}
        {gameState === "idle" && (
          <button
            onClick={startLobby}
            disabled={!price}
            className="mt-2 px-4 py-2 bg-green-700 hover:bg-green-600 disabled:bg-gray-500 border-2 border-green-900 text-white text-sm transition"
          >
            START
          </button>
        )}
        {gameState === "ended" && (
          <div className="flex gap-2 mt-2">
            <button
              onClick={startLobby}
              className="px-4 py-2 bg-green-700 hover:bg-green-600 border-2 border-green-900 text-white text-sm transition"
            >
              RETRY
            </button>
            {onBack && (
              <button
                onClick={onBack}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 border-2 border-gray-500 text-white text-sm transition"
              >
                MENU
              </button>
            )}
          </div>
        )}
      </div>

      {/* Game field — fullscreen */}
      <div
        ref={fieldRef}
        className="relative overflow-hidden flex-1 w-full"
      >
        {/* Background */}
        <Image
          src="/BACKGROUND.png"
          alt="field"
          fill
          className="object-fill"
          priority
        />

        {/* Finish line label */}
        <div className="absolute top-8 left-0 w-full text-center text-xs text-white/50 font-mono z-10">
          FINISH
        </div>

        {/* Doll */}
        <div
          className="absolute z-20 transition-transform duration-300"
          style={{
            left: fieldW / 2 - DOLL_SIZE / 2,
            top: 0,
            width: DOLL_SIZE,
            height: DOLL_SIZE * 1.5,
          }}
        >
          <Image
            src={light === "red" ? "/girls front.png" : "/girls back.png"}
            alt="doll"
            fill
            className="object-contain"
          />
        </div>

        {/* Player sprite */}
        {(() => {
          let sprite = `/props_${skin}_front.png`; // idle
          if (!player.alive) sprite = `/props_${skin}_dead.png`;
          else if (player.finished) sprite = `/props_${skin}_front.png`;
          else if (isMoving) sprite = `/props_${skin}_back.png`;

          // Hop effect — alternate between 0 and -6px every 150ms when moving
          const hopOffset = (isMoving && player.alive && !player.finished) ? (Math.floor(Date.now() / 130) % 2 === 0 ? -10 : 0) : 0;

          return (
            <div
              className="absolute z-30"
              style={{
                left: player.x - PLAYER_SIZE / 2,
                top: player.y - PLAYER_SIZE + hopOffset,
                width: PLAYER_SIZE,
                height: PLAYER_SIZE * 1.2,
              }}
            >
              <Image
                src={sprite}
                alt="player"
                fill
                className="object-contain"
              />
              {/* Shadow */}
              <div
                className="absolute rounded-full"
                style={{
                  bottom: 8,
                  left: '15%',
                  width: '70%',
                  height: 8,
                  background: 'radial-gradient(ellipse, rgba(0,0,0,0.35) 0%, transparent 70%)',
                }}
              />
            </div>
          );
        })()}

        {/* Lobby overlay */}
        {gameState === "lobby" && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center">
            {/* Darkened overlay */}
            <div className="absolute inset-0 bg-black/50" />

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center gap-6">
              {/* Title */}
              <div className="text-4xl text-white drop-shadow-lg">
                1, 2, 3... SOL-eil
              </div>

              {/* Countdown */}
              <div className="flex flex-col items-center">
                <div className="text-8xl text-yellow-400 drop-shadow-lg" style={{
                  textShadow: "0 0 20px rgba(250, 204, 21, 0.5), 0 4px 0 #b45309"
                }}>
                  {lobbyCountdown}
                </div>
                <div className="text-lg text-white/60 mt-2">
                  GAME STARTS IN
                </div>
              </div>

              {/* Player list */}
              <div className="flex flex-col items-center gap-2 mt-4" style={{ backgroundImage: "url('/CARD.png')", backgroundSize: "100% 100%", backgroundRepeat: "no-repeat", padding: "30px 40px", minWidth: 300 }}>
                <div className="text-sm text-gray-600 mb-2">
                  PLAYERS ({lobbyPlayers.length}/10)
                </div>
                <div className="flex flex-wrap gap-3 justify-center">
                  {lobbyPlayers.map((p, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div className="relative" style={{ width: 40, height: 48 }}>
                        <Image
                          src="/props_1_front.png"
                          alt={p.name}
                          fill
                          className="object-contain"
                          style={{ imageRendering: "pixelated" }}
                        />
                      </div>
                      <span className={`text-[10px] ${i === 0 ? "text-cyan-700" : "text-gray-700"}`}>
                        {p.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hint */}
              <div className="text-sm text-white/40 mt-2">
                Press W or Arrow Up to move — don&apos;t move during RED LIGHT
              </div>
            </div>
          </div>
        )}

        {/* Game over text */}
        {gameState === "ended" && (
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 z-40 text-center">
            <div className={`text-5xl font-bold drop-shadow-lg ${player.finished ? "text-green-400" : "text-red-500"}`}>
              {player.finished ? "YOU WIN!" : "ELIMINATED"}
            </div>
            <div className="text-white/70 text-sm mt-2 drop-shadow">
              {elapsed}s
            </div>
          </div>
        )}
      </div>


      {/* Controls hint */}
      {gameState === "playing" && (
        <div className="text-xs text-gray-600 font-mono">
          Arrow keys or WASD to move — DON&apos;T MOVE during RED LIGHT
        </div>
      )}
    </div>
  );
}
