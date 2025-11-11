import { cn } from "@/lib/utils";

export type GeneratorMode = "auto" | "image" | "video" | "text";
export type RatioOption = "1:1" | "9:16" | "16:9" | "3:4" | "4:5";

interface ToolbarProps {
  mode: GeneratorMode;
  onModeChange: (mode: GeneratorMode) => void;
  ratio: RatioOption;
  onRatioChange: (ratio: RatioOption) => void;
}

const MODES: { value: GeneratorMode; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "image", label: "Image" },
  { value: "video", label: "Vidéo" },
  { value: "text", label: "Texte" },
];

const RATIO_OPTIONS: RatioOption[] = ["1:1", "9:16", "16:9", "3:4", "4:5"];

export function Toolbar({ mode, onModeChange, ratio, onRatioChange }: ToolbarProps) {
  const showRatios = mode === "image" || mode === "video";

  return (
    <div className="space-y-2">
      {/* Modes */}
      <div className="flex flex-wrap gap-2">
        {MODES.map(({ value, label }) => {
          const active = mode === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onModeChange(value)}
              className={cn(
                "inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
                active
                  ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
              )}
              aria-pressed={active}
              aria-label={`Mode ${label}`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Ratios (image & vidéo) */}
      {showRatios && (
        <div className="flex flex-wrap gap-2">
          {RATIO_OPTIONS.map((opt) => {
            const active = ratio === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onRatioChange(opt)}
                className={cn(
                  "inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
                  active
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                )}
                aria-pressed={active}
                aria-label={`Format ${opt}`}
                title={`Format ${opt}`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
