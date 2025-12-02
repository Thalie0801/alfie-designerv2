import { Copy, Trash2, ChevronDown, ChevronUp, Upload, X as XIcon, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState, useEffect } from "react";
import type { PackAsset } from "@/types/alfiePack";
import { WOOF_COSTS } from "@/config/woofs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AssetEditDialog } from "./AssetEditDialog";

interface PackAssetRowProps {
  asset: PackAsset;
  onDuplicate: (asset: PackAsset) => void;
  onDelete: (assetId: string) => void;
  onEdit: (asset: PackAsset) => void;
}

const goalDescriptions: Record<string, string> = {
  engagement: "Alfie t'aide à créer du lien avec ta communauté.",
  vente: "Un visuel pour convertir tes prospects en clients.",
  education: "Partage ton expertise de façon simple et impactante.",
  notoriety: "Fais-toi connaître auprès de ta cible idéale.",
  default: "Un contenu pensé pour ta marque.",
};

const assetKindLabel: Record<string, string> = {
  image: "Image",
  carousel: "Carrousel",
  video_premium: "✨ Asset vidéo (6s)",
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
  const [uploading, setUploading] = useState(false);
  const [referenceImage, setReferenceImage] = useState(asset.referenceImageUrl || "");
  const [showEditDialog, setShowEditDialog] = useState(false);

  // Resynchroniser l'état local si le prop asset change
  useEffect(() => {
    setReferenceImage(asset.referenceImageUrl || "");
  }, [asset.referenceImageUrl]);

  const woofCost = WOOF_COSTS[asset.woofCostType];
  const totalCost = asset.kind === "carousel" ? woofCost * asset.count : woofCost;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation du fichier
    if (!file.type.startsWith("image/")) {
      toast.error("Seules les images sont acceptées");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("L'image ne doit pas dépasser 5 MB");
      return;
    }

    setUploading(true);
    try {
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const { data, error } = await supabase.storage
        .from("chat-uploads")
        .upload(`references/${fileName}`, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("chat-uploads")
        .getPublicUrl(data.path);

      setReferenceImage(urlData.publicUrl);
      
      // Mettre à jour l'asset avec la nouvelle image
      const updatedAsset = { ...asset, referenceImageUrl: urlData.publicUrl };
      onEdit(updatedAsset);
      
      toast.success("Image de référence ajoutée !");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Erreur lors de l'upload de l'image");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setReferenceImage("");
    const updatedAsset = { ...asset, referenceImageUrl: undefined };
    onEdit(updatedAsset);
    toast.success("Image de référence retirée");
  };

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
            
            <p className="text-xs text-muted-foreground">
              {goalDescriptions[asset.goal] || goalDescriptions.default}
            </p>

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

        <CollapsibleContent className="pt-3 space-y-3">
          {/* Generated texts preview */}
          {asset.generatedTexts && (
            <div className="text-sm border-l-2 border-primary pl-3 mb-3">
              <p className="font-medium mb-2 text-primary">✨ Textes générés par Alfie</p>
              
              {asset.generatedTexts.text && (
                <div className="space-y-1 text-muted-foreground">
                  <p className="font-medium">{asset.generatedTexts.text.title}</p>
                  <p className="text-xs">{asset.generatedTexts.text.body}</p>
                  {asset.generatedTexts.text.cta && (
                    <p className="text-xs italic">→ {asset.generatedTexts.text.cta}</p>
                  )}
                </div>
              )}

              {asset.generatedTexts.slides && (
                <div className="space-y-1 text-muted-foreground text-xs">
                  <p className="font-medium">Carrousel {asset.generatedTexts.slides.length} slides :</p>
                  {asset.generatedTexts.slides.slice(0, 2).map((slide: any, i: number) => (
                    <p key={i}>• {slide.title}</p>
                  ))}
                  {asset.generatedTexts.slides.length > 2 && (
                    <p className="italic">... et {asset.generatedTexts.slides.length - 2} autres slides</p>
                  )}
                </div>
              )}

              {asset.generatedTexts.video && (
                <div className="space-y-1 text-muted-foreground">
                  <p className="font-medium">{asset.generatedTexts.video.hook}</p>
                  <p className="text-xs line-clamp-2">{asset.generatedTexts.video.script}</p>
                </div>
              )}
            </div>
          )}

          <div className="text-sm text-muted-foreground border-l-2 border-border pl-3">
            <p className="font-medium mb-1">Prompt IA :</p>
            <p>{asset.prompt}</p>
          </div>

          {/* Section image de référence */}
          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  Image source {asset.kind === "video_premium" && <span className="text-red-500">*</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {asset.kind === "video_premium" 
                    ? "L'image sera animée par l'IA. Obligatoire pour générer la vidéo."
                    : "Alfie s'en sert comme inspiration visuelle pour la création."}
                </p>
              </div>
            </div>

            {referenceImage ? (
              <div className="relative">
                <img
                  src={referenceImage}
                  alt="Référence"
                  className="w-full h-32 object-cover rounded-lg border"
                />
                <Button
                  size="sm"
                  variant="destructive"
                  className="absolute top-2 right-2"
                  onClick={handleRemoveImage}
                >
                  <XIcon className="h-4 w-4 mr-1" />
                  Retirer
                </Button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  id={`upload-${asset.id}`}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full pointer-events-none"
                  disabled={uploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? "Upload en cours..." : "Ajouter une image de référence"}
                </Button>
              </div>
            )}
          </div>


          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={() => setShowEditDialog(true)}
          >
            <Edit className="h-4 w-4 mr-2" />
            Modifier cet asset
          </Button>
        </CollapsibleContent>
      </Collapsible>

      <AssetEditDialog
        asset={asset}
        isOpen={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        onSave={onEdit}
      />
    </Card>
  );
}
