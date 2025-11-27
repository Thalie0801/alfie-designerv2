import { Copy, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";
import type { PackAsset } from "@/types/alfiePack";
import { WOOF_COSTS } from "@/config/woofs";

interface PackAssetRowProps {
  asset: PackAsset;
  onDuplicate: (asset: PackAsset) => void;
  onDelete: (assetId: string) => void;
  onEdit: (asset: PackAsset) => void;
}

const assetKindLabel: Record<string, string> = {
  image: "Image",
  carousel: "Carrousel",
  video_basic: "Vidéo standard",
  video_premium: "Vidéo premium (Veo 3.1)",
};

const platformEmoji: Record<string, string> = {
  instagram: "📸",
  tiktok: "🎵",
  youtube: "▶️",
  linkedin: "💼",
  facebook: "👥",
  pinterest: "📌",
  generic: "🌐",
};

export function PackAssetRow({ asset, onDuplicate, onDelete, onEdit }: PackAssetRowProps) {
  const [isOpen, setIsOpen] = useState(false);

  const woofCost = WOOF_COSTS[asset.woofCostType];
  const totalCost = asset.kind === "carousel" ? woofCost * asset.count : woofCost;

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg">{platformEmoji[asset.platform]}</span>
              <h3 className="font-semibold">{asset.title}</h3>
              <Badge variant="secondary">
                {assetKindLabel[asset.kind] || asset.kind}
              </Badge>
              {asset.kind === "carousel" && (
                <Badge variant="outline">{asset.count} slides</Badge>
              )}
              <Badge variant="outline" className="bg-orange-50 text-orange-700">
                {totalCost} 🐾
              </Badge>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{asset.platform}</span>
              <span>•</span>
              <span>{asset.format}</span>
              <span>•</span>
              <span>{asset.ratio}</span>
              {asset.durationSeconds && (
                <>
                  <span>•</span>
                  <span>{asset.durationSeconds}s</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <Badge variant="outline">{asset.goal}</Badge>
              <span className="text-muted-foreground">{asset.tone}</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDuplicate(asset)}
              title="Dupliquer"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(asset.id)}
              className="text-destructive hover:text-destructive"
              title="Supprimer"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <CollapsibleContent className="pt-3 space-y-2">
          <div className="text-sm text-muted-foreground border-l-2 border-border pl-3">
            <p className="font-medium mb-1">Prompt IA :</p>
            <p>{asset.prompt}</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={() => onEdit(asset)}
          >
            Modifier cet asset
          </Button>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
