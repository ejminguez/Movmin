import { Bus } from "lucide-react";

export function Header() {
  return (
    <header className="flex h-14 items-center gap-3 border-b px-6">
      <Bus className="h-6 w-6" />
      <h1 className="text-lg font-semibold">Movmin</h1>
    </header>
  );
}
