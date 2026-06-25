import type { ScenarioPreset } from "@/types";
import { AlertOctagon, Activity, CloudLightning } from "lucide-react";

interface ScenarioPresetsProps {
  presets: ScenarioPreset[];
  onSelectPreset: (preset: ScenarioPreset) => void;
  selectedPresetId: string | null;
  disabled?: boolean;
}

export default function ScenarioPresets({
  presets,
  onSelectPreset,
  selectedPresetId,
  disabled
}: ScenarioPresetsProps) {
  const getIcon = (id: string) => {
    switch (id) {
      case "marilog_landslide":
        return <AlertOctagon className="h-4 w-4 text-red-500" />;
      case "kadayawan_surge":
        return <Activity className="h-4 w-4 text-yellow-500" />;
      case "typhoon":
        return <CloudLightning className="h-4 w-4 text-blue-400" />;
      default:
        return <AlertOctagon className="h-4 w-4 text-zinc-500" />;
    }
  };

  const getShortName = (name: string) => {
    return name
      .replace(" Closure", "")
      .replace(" Demand Surge", "")
      .replace(" Festival", "")
      .trim();
  };

  return (
    <div className="space-y-2">
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
        Preset Disruption Scenarios
      </h3>
      <div className="flex gap-2">
        {presets.map((preset) => {
          const isSelected = preset.id === selectedPresetId;
          return (
            <button
              key={preset.id}
              onClick={() => onSelectPreset(preset)}
              disabled={disabled}
              title={preset.description}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-2 px-2 text-center transition-all duration-300 ${
                isSelected
                  ? "bg-zinc-800 border-amber-500 text-zinc-100 shadow-md shadow-amber-500/10"
                  : "bg-zinc-950/60 border-zinc-900 text-zinc-400 hover:bg-zinc-900/60 hover:border-zinc-700 hover:text-zinc-200"
              } ${disabled ? "opacity-55 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <div className="shrink-0">{getIcon(preset.id)}</div>
              <div className="text-[10px] font-bold tracking-wide select-none whitespace-nowrap">
                {getShortName(preset.name)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
