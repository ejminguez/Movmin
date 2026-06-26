import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Map, Route, BarChart3, ChevronDown, ChevronUp, FlaskConical } from "lucide-react";
import movemin_logo from "@/assets/movemin-logo.svg";

const navItems = [
  { label: "Corridor Monitor", to: "/", icon: Map },
  { label: "Route Analytics", to: "/route-analytics", icon: Route },
  { label: "Demand Intelligence", to: "/analytics", icon: BarChart3 },
  { label: "Scenario Simulator", to: "/scenarios", icon: FlaskConical },

];

export function Header() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="flex flex-col shrink-0">
      {/* Header Capsule */}
      <header
        onClick={() => setIsExpanded(!isExpanded)}
        className="mx-6 mt-4 mb-2 flex h-14 cursor-pointer items-center justify-between rounded-2xl bg-[#13382c] px-6 shadow-lg shadow-black/25 border border-emerald-950/20 transition-all duration-300 hover:bg-[#163e31]"
      >
        {/* Logo */}
        <div className="flex items-center select-none">
          <img src={movemin_logo} alt="Movemin Logo" className="w-[50%]"/>
        </div>

        {/* Dropdown Toggle Chevron */}
        <button
          className="text-zinc-100 hover:text-white transition-colors p-1"
          aria-label="Toggle navigation menu"
        >
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 stroke-[2.5]" />
          ) : (
            <ChevronDown className="h-5 w-5 stroke-[2.5]" />
          )}
        </button>
      </header>

      {/* Expanded Dropdown Panel */}
      {isExpanded && (
        <div className="mx-6 mb-4 animate-in slide-in-from-top duration-300 ease-out rounded-2xl bg-[#13382c] p-4 shadow-lg shadow-black/25 border border-emerald-950/20">
          <nav className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={(e) => {
                  // Stop propagation so clicking the link doesn't close/open the header capsule again
                  e.stopPropagation();
                  setIsExpanded(false);
                }}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-2 rounded-xl p-4 text-center border transition-all duration-200 ${
                    isActive
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-500 font-bold"
                      : "bg-[#113127] border-[#0e2921]/40 text-zinc-400 hover:bg-[#163e31] hover:text-zinc-200 hover:border-[#113127]"
                  }`
                }
              >
                <item.icon className="h-5 w-5" />
                <span className="text-xs tracking-tight">{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
