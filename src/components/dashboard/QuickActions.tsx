import { memo, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Image as ImageIcon, Library, Layout } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useBrandKit } from "@/hooks/useBrandKit";
import { useActivityStats } from "@/hooks/useActivityStats";
import { cn } from "@/lib/utils";

type QuickActionsProps = {
  className?: string;
  compact?: boolean; // réduit la hauteur si true
};

type Action = {
  id: "image" | "video" | "library" | "templates";
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  to: string;
  // optionnel: condition de dispo + message
  isDisabled?: boolean;
  disabledReason?: string | null;
};

function percent(used?: number, quota?: number) {
  if (!quota || quota <= 0) return 0;
  const p = ((used ?? 0) / quota) * 100;
  return Number.isFinite(p) ? Math.max(0, Math.min(100, p)) : 0;
}

export const QuickActions = memo(function QuickActions({ className, compact }: QuickActionsProps) {
  const navigate = useNavigate();
  const { activeBrand, activeBrandId } = useBrandKit();
  const { stats } = useActivityStats(activeBrandId);

  const noBrand = !activeBrand;
  const imagesOver = (stats?.imagesQuota ?? 0) > 0 && (stats?.imagesCount ?? 0) >= (stats?.imagesQuota ?? 0);

  const actions: Action[] = useMemo(
    () => [
      {
        id: "image",
        label: "Créer un visuel",
        icon: ImageIcon,
        to: "/app?mode=image",
        isDisabled: noBrand || imagesOver,
        disabledReason: noBrand ? "Aucune marque active" : imagesOver ? "Quota visuels atteint" : null,
      },
      {
        id: "library",
        label: "Ma bibliothèque",
        icon: Library,
        to: "/library",
        isDisabled: false,
        disabledReason: null,
      },
      {
        id: "templates",
        label: "Templates",
        icon: Layout,
        to: "/templates",
        isDisabled: false,
        disabledReason: null,
      },
    ],
    [noBrand, imagesOver],
  );

  const cellClass = cn(
    "h-24 md:h-24",
    compact && "h-16 md:h-16",
    "flex-col gap-2 hover:border-primary hover:bg-primary/5 transition-all",
  );

  return (
    <TooltipProvider delayDuration={150}>
      <div className={cn("grid grid-cols-2 md:grid-cols-4 gap-3", className)} role="list" aria-label="Actions rapides">
        {actions.map(({ id, label, icon: Icon, to, isDisabled, disabledReason }) => {
          const content = (
            <Button
              key={id}
              onClick={() => !isDisabled && navigate(to)}
              variant="outline"
              className={cellClass}
              disabled={isDisabled}
              aria-disabled={isDisabled || undefined}
              aria-label={label}
              data-testid={`qa-${id}`}
            >
              <Icon className="h-6 w-6" aria-hidden />
              <span className="font-medium">{label}</span>
              {/* hint quotas si pertinent */}
              {id === "image" && stats?.imagesQuota ? (
                <span className="sr-only">
                  {Math.round(percent(stats?.imagesCount, stats?.imagesQuota))}% de votre quota visuels utilisé
                </span>
              ) : null}
            </Button>
          );

          return disabledReason ? (
            <Tooltip key={id}>
              <TooltipTrigger asChild>{content}</TooltipTrigger>
              <TooltipContent>{disabledReason}</TooltipContent>
            </Tooltip>
          ) : (
            content
          );
        })}
      </div>
    </TooltipProvider>
  );
});
