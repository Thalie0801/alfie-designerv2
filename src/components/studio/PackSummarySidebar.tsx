import { Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type { AlfiePack } from "@/types/alfiePack";
import { calculatePackWoofCost } from "@/lib/woofs";
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
  const totalCost = calculatePackWoofCost(pack);
  const hasEnough = woofsAvailable >= totalCost;
  const percentUsed = woofsQuota > 0 ? ((woofsQuota - woofsAvailable) / woofsQuota) * 100 : 0;

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

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Coût du pack :</span>
            <Badge variant="secondary" className="bg-orange-50 text-orange-700">
              {totalCost} 🐾
            </Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Disponibles :</span>
            <span className="font-medium">{woofsAvailable} 🐾</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Après génération :</span>
            <span className={hasEnough ? "font-medium" : "font-medium text-destructive"}>
              {hasEnough ? woofsAvailable - totalCost : woofsAvailable} 🐾
            </span>
          </div>
        </div>

        <Progress value={percentUsed} className="h-2" />

        {!hasEnough && (
          <div className="flex items-start gap-2 p-2 bg-destructive/10 rounded-md">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
            <p className="text-xs text-destructive">
              Il te manque <strong>{totalCost - woofsAvailable} Woofs</strong> pour ce pack.
            </p>
          </div>
        )}
      </Card>

      {/* Détail du pack */}
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold text-sm">Contenu du pack</h3>
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

        {pack.assets.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Ajoute des assets pour commencer 🎨
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
            Génération en cours...
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            Lancer la génération
          </>
        )}
      </Button>

      {!hasEnough && pack.assets.length > 0 && (
        <Button variant="outline" className="w-full" asChild>
          <a href="/billing">Recharger mes Woofs</a>
        </Button>
      )}
    </div>
  );
}
