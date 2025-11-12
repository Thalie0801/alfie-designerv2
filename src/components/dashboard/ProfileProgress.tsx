import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Trophy, Check, Circle } from "lucide-react";
import { useBrandKit } from "@/hooks/useBrandKit";
import { useActivityStats } from "@/hooks/useActivityStats";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Brand = {
  id: string;
  name: string;
  palette?: string[] | null;
  voice?: string | null;
  logo_url?: string | null;
  canva_connected?: boolean;
};

export function ProfileProgress() {
  const {
    activeBrand,
    activeBrandId,
    totalBrands,
    loading: brandLoading,
  } = useBrandKit() as {
    activeBrand: Brand | null;
    activeBrandId: string | null;
    totalBrands: number;
    loading?: boolean;
  };
  const { stats, loading: statsLoading } = useActivityStats(activeBrandId) as {
    stats?: {
      imagesCount?: number;
      videosCount?: number;
    } | null;
    loading?: boolean;
  };

  const isLoading = brandLoading || statsLoading;

  const tasks = useMemo(() => {
    const imagesCount = stats?.imagesCount ?? 0;
    const videosCount = stats?.videosCount ?? 0;

    return [
      { id: "brand", label: "Créer une marque", completed: (totalBrands ?? 0) > 0, points: 20 },
      {
        id: "palette",
        label: "Définir une palette de couleurs",
        completed: !!(activeBrand?.palette && activeBrand.palette.length),
        points: 15,
      },
      { id: "voice", label: "Définir le ton de la marque", completed: !!activeBrand?.voice, points: 15 },
      { id: "logo", label: "Ajouter un logo", completed: !!activeBrand?.logo_url, points: 10 },
      { id: "canva", label: "Connecter Canva", completed: !!activeBrand?.canva_connected, points: 20 },
      { id: "generation", label: "Créer ta première génération", completed: imagesCount + videosCount > 0, points: 20 },
    ] as const;
  }, [activeBrand, stats, totalBrands]);

  const { totalPoints, maxPoints, percentage } = useMemo(() => {
    const max = tasks.reduce((s, t) => s + t.points, 0);
    const got = tasks.reduce((s, t) => s + (t.completed ? t.points : 0), 0);
    const pct = max > 0 ? Math.round((got / max) * 100) : 0;
    return { totalPoints: got, maxPoints: max, percentage: pct };
  }, [tasks]);

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-accent/10 to-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <Skeleton className="h-5 w-40" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-3 w-full" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-4 w-10 ml-auto" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const barClass =
    percentage >= 100
      ? "bg-emerald-500"
      : percentage >= 75
        ? "bg-primary"
        : percentage >= 40
          ? "bg-amber-500"
          : "bg-muted-foreground";

  return (
    <Card className="bg-gradient-to-br from-accent/10 to-primary/5" data-testid="profile-progress">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" aria-hidden />
          Profil complété à {percentage}%
          <Badge variant="outline" className="ml-2 tabular-nums" aria-label={`${totalPoints} points sur ${maxPoints}`}>
            {totalPoints}/{maxPoints} pts
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <Progress
          value={percentage}
          className="h-3"
          // override bar color via data-[state] selector wrapper
          // (si votre Progress supporte custom className sur l’inner bar, adaptez)
        />
        {/* petite barre colorée overlay */}
        <div className="relative -mt-3 h-3 rounded overflow-hidden pointer-events-none" aria-hidden>
          <div className={cn("h-full", barClass)} style={{ width: `${percentage}%` }} />
        </div>

        <ul className="space-y-2">
          {tasks.map((task) => {
            const done = task.completed;
            return (
              <li key={task.id} className="flex items-center gap-2 text-sm" data-testid={`task-${task.id}`}>
                {done ? (
                  <Check className="h-4 w-4 text-primary shrink-0" aria-hidden />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                )}
                <span className={cn("flex-1", done && "text-muted-foreground line-through")}>{task.label}</span>
                <Badge variant={done ? "default" : "secondary"} className="shrink-0">
                  +{task.points}
                </Badge>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
