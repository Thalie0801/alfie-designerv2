import { Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type { AlfiePack } from "@/types/alfiePack";
import { calculatePackWoofCost, safeWoofs } from "@/lib/woofs";
import { WOOF_COSTS } from "@/config/woofs";

interface PackSummarySidebarProps {
  pack: AlfiePack;
  woofsAvailable: number;
  woofsQuota: number;
  onLaunch: () => void;
  isLaunching: boolean;
}

export function PackSummarySidebar({
  pack,
  woofsAvailable,
  woofsQuota,
  onLaunch,
  isLaunching,
}: PackSummarySidebarProps) {
  const totalCost = safeWoofs(calculatePackWoofCost(pack));
  const available = safeWoofs(woofsAvailable);
  const quota = safeWoofs(woofsQuota);
  const hasEnough = available >= totalCost;
  const percentUsed = quota > 0 ? ((quota - available) / quota) * 100 : 0;

  // Compter par type
  const imageCount = pack.assets.filter((a) => a.kind === "image").length;
  const carouselCount = pack.assets.filter((a) => a.kind === "carousel").length;
  const videoBasicCount = pack.assets.filter((a) => a.kind === "video_basic").length;
  const videoPremiumCount = pack.assets.filter((a) => a.kind === "video_premium").length;

  return (
    <div className="space-y-4 sticky top-4">
      {/* Récap Woofs */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-alfie-pink" />
          <h3 className="font-semibold">Récap Woofs</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Les Woofs sont la petite monnaie d'Alfie Designer pour créer tes contenus.
        </p>

        <Separator />

        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Coût de ce pack :</span>
            <Badge variant="secondary" className="bg-orange-50 text-orange-700 font-semibold">
              {totalCost} 🐾
            </Badge>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Tes Woofs disponibles :</span>
            <span className="font-medium">{available} 🐾</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Après cette création :</span>
            <span className={hasEnough ? "font-medium" : "font-medium text-destructive"}>
              {hasEnough ? available - totalCost : available} 🐾
            </span>
          </div>
        </div>

        <Progress value={percentUsed} className="h-2" />

        {!hasEnough && (
          <div className="flex items-start gap-2 p-2 bg-destructive/10 rounded-md">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
            <p className="text-xs text-destructive leading-relaxed">
              Pour ce pack, il te manque encore <strong>{totalCost - available} Woofs</strong>. Tu peux réduire le nombre de visuels, ou recharger tes Woofs avec Alfie 🐶
            </p>
          </div>
        )}
      </Card>

      {/* Détail du pack */}
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold text-sm">Ce que ce pack va créer pour toi :</h3>
        <Separator />
        <div className="space-y-1.5 text-sm">
          {imageCount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Images</span>
              <Badge variant="outline">
                {imageCount} × {WOOF_COSTS.image} 🐾
              </Badge>
            </div>
          )}
          {carouselCount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Carrousels</span>
              <Badge variant="outline">
                {pack.assets
                  .filter((a) => a.kind === "carousel")
                  .reduce((sum, a) => sum + a.count, 0)}{" "}
                slides
              </Badge>
            </div>
          )}
          {videoBasicCount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Vidéos standard</span>
              <Badge variant="outline">
                {videoBasicCount} × {WOOF_COSTS.video_basic} 🐾
              </Badge>
            </div>
          )}
          {videoPremiumCount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Vidéos premium</span>
              <Badge variant="outline">
                {videoPremiumCount} × {WOOF_COSTS.video_premium} 🐾
              </Badge>
            </div>
          )}
        </div>

        {pack.assets.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            Ajoute des visuels 🎨
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mt-2">
            Tu pourras tout ajuster après la génération dans le Studio.
          </p>
        )}
      </Card>

      {/* Bouton lancer */}
      <Button
        onClick={onLaunch}
        disabled={!hasEnough || pack.assets.length === 0 || isLaunching}
        className="w-full"
        size="lg"
      >
        {isLaunching ? (
          <>
            <Sparkles className="mr-2 h-4 w-4 animate-spin" />
            Alfie prépare tes visuels...
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            Créer mes visuels avec Alfie
          </>
        )}
      </Button>

      {!hasEnough && pack.assets.length > 0 && (
        <div className="space-y-2">
          <Button variant="outline" className="w-full" asChild>
            <a href="/billing">Recharger mes Woofs</a>
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Recharger tes Woofs te permet de lancer d'autres campagnes avec Alfie.
          </p>
        </div>
      )}
    </div>
  );
}
