import { Route, Map, AlertTriangle, BarChart3, Cog } from "lucide-react";

const navItems = [
  { label: "Corridor Monitor", icon: Map, active: true },
  { label: "Routes", icon: Route },
  { label: "Incidents", icon: AlertTriangle },
  { label: "Analytics", icon: BarChart3 },
  { label: "Settings", icon: Cog },
];

export function Sidebar() {
  return (
    <aside className="flex w-56 flex-col border-r bg-sidebar p-3">
      <nav className="flex flex-col gap-1">
        {navItems.map((item) => (
          <button
            key={item.label}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              item.active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50"
            }`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
