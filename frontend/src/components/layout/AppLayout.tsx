import { Outlet } from "react-router-dom";
import { Header } from "./Header";

export function AppLayout() {
  return (
    <div className="flex h-screen flex-col bg-zinc-950">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-auto px-6 pb-6 pt-2">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

