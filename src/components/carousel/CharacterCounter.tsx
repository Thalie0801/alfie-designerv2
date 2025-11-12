import { cn } from "@/lib/utils";

interface CharacterCounterProps {
  current: number;
  min?: number;
  max: number; // > 0 recommandé
  label?: string;
  className?: string;
}

export function CharacterCounter({ current, min, max, label, className }: CharacterCounterProps) {
  // sécurité max > 0
  const safeMax = Math.max(1, max);
  const pct = Math.max(0, Math.min(100, (current / safeMax) * 100));

  const hasMin = typeof min === "number";
  const underMin = hasMin && current < (min as number);
  const overMax = current > max;

  const isWarning = !overMax && !underMin && pct >= 90; // proche du max
  const isError = overMax || underMin;

  // NOTE: garde tes tokens actuels; change-les si ta palette diffère
  const color = isError ? "text-destructive" : isWarning ? "text-orange-500" : "text-success";

  const bg = isError ? "bg-destructive/20" : isWarning ? "bg-orange-500/20" : "bg-success/20";

  const helper = overMax
    ? `(${current - max} au-delà du max)`
    : underMin
      ? `(${(min as number) - current} restant·s min)`
      : undefined;

  return (
    <div
      className={cn("flex items-center gap-2", className)}
      role="group"
      aria-label={label ?? "Compteur de caractères"}
    >
      {label && <span className="text-xs text-muted-foreground">{label}</span>}

      <div className="flex items-center gap-1" title={helper}>
        <span
          className={cn("text-xs font-medium", color)}
          aria-live="polite"
          aria-atomic="true"
          aria-invalid={isError || undefined}
        >
          {current}/{max}
        </span>

        <div
          className="w-12 h-1.5 rounded-full bg-muted overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={Math.min(current, max)}
          aria-label="Utilisation des caractères"
        >
          <div className={cn("h-full transition-all duration-200", bg)} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
