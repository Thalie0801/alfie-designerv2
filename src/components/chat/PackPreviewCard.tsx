import { Package, ChevronRight } from "lucide-react";
import type { AlfiePack } from "@/types/alfiePack";
import { calculatePackWoofCost } from "@/lib/woofs";

interface PackPreviewCardProps {
  pack: AlfiePack;
  onOpenDetail: () => void;
}

export default function PackPreviewCard({ pack, onOpenDetail }: PackPreviewCardProps) {
  // Calculer les compteurs
  const imageCount = pack.assets.filter((a) => a.kind === "image").length;
  const carouselCount = pack.assets.filter((a) => a.kind === "carousel").length;
  const videoCount = pack.assets.filter((a) => a.kind === "video_premium").length;

  // Calculer le coût total en Woofs
  const totalWoofs = calculatePackWoofCost(pack, pack.assets.map((a) => a.id));

  return (
    <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-4 border border-primary/20 space-y-3">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-primary/20 rounded-lg">
          <Package className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-sm">📦 Pack détecté : {pack.title}</h4>
          <p className="text-xs text-muted-foreground mt-1">{pack.summary}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {imageCount > 0 && (
          <span className="px-2 py-1 bg-background/80 rounded-full border">
            {imageCount} {imageCount === 1 ? "visuel" : "visuels"}
          </span>
        )}
        {carouselCount > 0 && (
          <span className="px-2 py-1 bg-background/80 rounded-full border">
            {carouselCount} {carouselCount === 1 ? "carrousel" : "carrousels"}
          </span>
        )}
        {videoCount > 0 && (
          <span className="px-2 py-1 bg-background/80 rounded-full border">
            {videoCount} {videoCount === 1 ? "vidéo" : "vidéos"}
          </span>
        )}
        <span className="px-2 py-1 bg-primary/20 rounded-full border border-primary/30 font-medium">
          {totalWoofs} Woofs 🐶
        </span>
      </div>

      <button
        onClick={onOpenDetail}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
      >
        Préparer la génération
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
