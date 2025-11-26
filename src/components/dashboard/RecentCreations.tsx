import { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Image as ImageIcon, Video as VideoIcon, Clock, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

type CreationType = "image" | "video";

interface Creation {
  id: string;
  type: CreationType;
  output_url?: string; // Optional, we use thumbnail_url instead
  thumbnail_url: string | null;
  created_at: string | null;
  prompt: string | null;
}

function timeAgo(dateISO?: string | null) {
  if (!dateISO) return "";
  const d = new Date(dateISO);
  const diff = Date.now() - d.getTime();
  const rtf = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });
  const mins = Math.round(diff / 60000);
  if (Math.abs(mins) < 60) return rtf.format(-mins, "minute");
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 24) return rtf.format(-hours, "hour");
  const days = Math.round(hours / 24);
  return rtf.format(-days, "day");
}

export function RecentCreations() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [creations, setCreations] = useState<Creation[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setCreations([]);
      setLoading(false);
      return;
    }
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const { data, error } = await supabase
          .from("media_generations")
          .select("id, type, thumbnail_url, created_at, prompt")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(6);

        if (error) throw error;
        if (!cancelled && mountedRef.current) setCreations((data as Creation[]) || []);
      } catch (e: any) {
        if (!cancelled && mountedRef.current) {
          setErrorMsg("Impossible de charger les créations récentes.");
          setCreations([]);
        }
      } finally {
        if (!cancelled && mountedRef.current) setLoading(false);
      }
    };

    load();

    // Realtime: écoute des nouvelles générations du user
    const channel = supabase
      .channel(`media_generations_user_${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "media_generations", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as any as Creation;
          // injecte en tête et garde 6 éléments max
          setCreations((prev) => {
            const curr = prev ?? [];
            // évite doublons
            if (curr.some((c) => c.id === row.id)) return curr;
            return [row, ...curr].slice(0, 6);
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const isEmpty = useMemo(() => (creations?.length ?? 0) === 0, [creations]);

  // Loading
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Dernières créations
            </CardTitle>
            <Skeleton className="h-5 w-20" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // État vide (avec CTA)
  if (isEmpty) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Dernières créations
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-10">
          <p className="text-sm text-muted-foreground text-center">
            Aucune création pour l’instant. Lance ta première génération !
          </p>
          <div className="flex gap-2">
            <Button onClick={() => navigate("/app?mode=image")} className="gap-2">
              <Plus className="h-4 w-4" />
              Créer un visuel
            </Button>
            <Button onClick={() => navigate("/app?mode=video")} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Créer une vidéo
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Grille
  return (
    <TooltipProvider delayDuration={150}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Dernières créations
            </CardTitle>
            <button onClick={() => navigate("/library")} className="text-sm text-primary hover:underline">
              Voir tout →
            </button>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {creations!.map((c) => {
              const isVideo = c.type === "video";
              const thumb = c.thumbnail_url || "";
              const alt = c.prompt?.trim()
                ? `Création ${c.type} — ${c.prompt.slice(0, 80)}${c.prompt.length > 80 ? "…" : ""}`
                : `Création ${c.type}`;
              return (
                <button
                  key={c.id}
                  onClick={() => navigate("/library")}
                  className={cn(
                    "group relative aspect-square rounded-lg overflow-hidden border-2 border-border transition-all",
                    "hover:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  )}
                  aria-label={`Ouvrir ${c.type} ${c.id}`}
                >
                  <img
                    src={thumb}
                    alt={alt}
                    loading="lazy"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // fallback simple si l’image échoue
                      (e.currentTarget as HTMLImageElement).src = isVideo
                        ? 'data:image/svg+xml;charset=utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="100%" height="100%" fill="%23eee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="16">Aperçu vidéo</text></svg>'
                        : 'data:image/svg+xml;charset=utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="100%" height="100%" fill="%23eee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="16">Aperçu image</text></svg>';
                    }}
                  />

                  {/* Overlay icône */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-all flex items-center justify-center">
                    {isVideo ? (
                      <VideoIcon className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>

                  {/* Badge type + time-ago */}
                  <div className="absolute top-2 right-2 flex items-center gap-2">
                    <div className="bg-black/70 text-white text-xs px-2 py-1 rounded-full">{isVideo ? "▶" : "🖼"}</div>
                  </div>
                  {c.created_at && (
                    <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[11px] px-2 py-0.5 rounded">
                      {timeAgo(c.created_at)}
                    </div>
                  )}

                  {/* Tooltip prompt si dispo */}
                  {c.prompt ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="sr-only">Voir le prompt</span>
                      </TooltipTrigger>
                      <TooltipContent side="top" align="center" className="max-w-[260px]">
                        {c.prompt}
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                </button>
              );
            })}
          </div>

          {errorMsg && <p className="mt-3 text-xs text-destructive">{errorMsg}</p>}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
