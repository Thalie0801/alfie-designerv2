import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BarChart3, Image as ImageIcon, Video as VideoIcon, Zap } from "lucide-react";
import { useActivityStats } from "@/hooks/useActivityStats";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ActivityCardProps {
  activeBrandId: string | null;
}

type QuotaBlock = {
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  used: number;
  quota: number;
  testId: string;
};

function percent(used: number, quota: number) {
  if (!quota || quota <= 0) return 0;
  const p = (used / quota) * 100;
  return Number.isFinite(p) ? Math.max(0, Math.min(100, p)) : 0;
}

function human(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n);
}

/**
 * Parent component: only checks if activeBrandId is available
 * No conditional hooks here - stable hook count
 */
export function ActivityCard({ activeBrandId }: ActivityCardProps) {
  if (!activeBrandId) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            Sélectionnez une marque pour voir l'activité.
          </div>
        </CardContent>
      </Card>
    );
  }

  return <ActivityCardInner activeBrandId={activeBrandId} />;
}

/**
 * Child component: contains all hooks and logic
 * Only mounted when activeBrandId exists, so hooks are always called consistently
 */
function ActivityCardInner({ activeBrandId }: { activeBrandId: string }) {
  const { stats, loading } = useActivityStats(activeBrandId);

  // All hooks called unconditionally
  const blocks: QuotaBlock[] = useMemo(
    () =>
      stats
        ? [
            {
              label: "Visuels",
              icon: ImageIcon,
              used: stats.imagesCount ?? 0,
              quota: stats.imagesQuota ?? 0,
              testId: "images",
            },
            {
              label: "Vidéos",
              icon: VideoIcon,
              used: stats.videosCount ?? 0,
              quota: stats.videosQuota ?? 0,
              testId: "videos",
            },
            {
              label: "Woofs",
              icon: Zap,
              used: stats.totalWoofsUsed ?? 0,
              quota: stats.woofsQuota ?? 0,
              testId: "woofs",
            },
          ]
        : [],
    [stats]
  );

  const overAnyQuota = useMemo(
    () => blocks.some((b) => b.quota > 0 && b.used > b.quota),
    [blocks]
  );

  // Early returns AFTER all hooks
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Activité ce mois
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            Aucune donnée disponible.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-accent/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Activité ce mois
          {overAnyQuota && (
            <Badge variant="destructive" className="ml-2">
              Sur quota
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        {blocks.map(({ label, icon: Icon, used, quota, testId }) => {
          const p = percent(used, quota);
          const over = quota > 0 && used > quota;
          const remaining = Math.max(0, quota - used);

          return (
            <div key={testId} className="space-y-2" data-testid={`activity-${testId}`}>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <span className="font-medium">{label}</span>
                  {quota > 0 && (
                    <Badge variant={over ? "destructive" : "secondary"} className="ml-1">
                      {over ? "Dépassement" : `${human(remaining)} restants`}
                    </Badge>
                  )}
                </div>

                <span
                  className={cn("text-muted-foreground tabular-nums", over && "text-destructive font-medium")}
                  aria-label={`${human(used)} utilisés sur ${human(quota)}`}
                >
                  {human(used)} {quota ? <>/ {human(quota)}</> : null}
                </span>
              </div>

              <Progress
                value={p}
                className={cn("h-2", over && "bg-destructive/10")}
                aria-valuenow={p}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Progression ${label}`}
              />

              {over && (
                <p className="text-xs text-destructive">
                  Vous avez dépassé le quota de {label.toLowerCase()} de {human(used - quota)}.
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
