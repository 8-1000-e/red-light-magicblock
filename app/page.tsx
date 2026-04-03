"use client";
import { useState } from "react";
import { useSolPrice } from "./hooks/useSolPrice";
import MainMenu from "./components/MainMenu";
import Game from "./components/Game";

export default function Home() {
  const { price, history } = useSolPrice();
  const [screen, setScreen] = useState<"menu" | "game">("menu");
  const [skin, setSkin] = useState(1);

  if (screen === "menu") {
    return (
      <MainMenu
        price={price}
        onCreateGame={(s) => { setSkin(s); setScreen("game"); }}
        onJoinGame={(id, s) => { setSkin(s); setScreen("game"); }}
      />
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
