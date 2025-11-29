import { useState, useMemo } from "react";
import { X, Image, Film, Grid3x3, AlertCircle } from "lucide-react";
import type { AlfiePack, PackAsset } from "@/types/alfiePack";
import { calculatePackWoofCost, safeWoofs } from "@/lib/woofs";
import { sendPackToGenerator, InsufficientWoofsError } from "@/services/generatorFromChat";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";

interface PackPreparationModalProps {
  pack: AlfiePack;
  brandId: string;
  onClose: () => void;
}

// ✅ Phase 2: Fallback text generation function
function generateFallbackTexts(asset: PackAsset, campaignTitle: string): any {
  if (asset.kind === 'carousel') {
    return {
      slides: Array.from({ length: asset.count }, (_, i) => ({
        title: i === 0 ? asset.title : i === asset.count - 1 ? "Passez à l'action" : `Point ${i}`,
        subtitle: i === 0 ? campaignTitle : `Élément ${i + 1} de ${asset.goal}`,
      })),
    };
  }
  
  if (asset.kind.includes('video')) {
    return {
      video: {
        hook: asset.title || "Découvrez notre secret",
        script: asset.prompt.slice(0, 200),
        cta: "En savoir plus",
      },
    };
  }
  
  return {
    text: {
      title: asset.title,
      body: asset.prompt.slice(0, 120),
      cta: "En savoir plus",
    },
  };
}

export default function PackPreparationModal({ pack, brandId, onClose }: PackPreparationModalProps) {
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(
    new Set(pack.assets.map((a) => a.id))
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [useBrandKit, setUseBrandKit] = useState(true); // ✅ Phase 2: Toggle Brand Kit
  const { profile } = useAuth();
  const navigate = useNavigate();

  // Calculer le coût dynamique selon la sélection
  const totalWoofs = useMemo(
    () => safeWoofs(calculatePackWoofCost(pack, Array.from(selectedAssetIds))),
    [pack, selectedAssetIds]
  );

  // Toggle checkbox
  const toggleAsset = (assetId: string) => {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      return next;
    });
  };

  // Icône selon le type d'asset
  const getAssetIcon = (asset: PackAsset) => {
    switch (asset.kind) {
      case "carousel":
        return <Grid3x3 className="w-4 h-4" />;
      case "video_basic":
      case "video_premium":
        return <Film className="w-4 h-4" />;
      default:
        return <Image className="w-4 h-4" />;
    }
  };

  // Label du type
  const getAssetTypeLabel = (asset: PackAsset) => {
    switch (asset.kind) {
      case "carousel":
        return `Carrousel (${asset.count} slides)`;
      case "video_basic":
        return "Vidéo animée";
      case "video_premium":
        return "Vidéo premium (Veo 3.1)";
      default:
        return "Visuel";
    }
  };

  // Lancer la génération
  const handleGenerate = async () => {
    if (selectedAssetIds.size === 0) {
      toast.error("Sélectionne au moins un asset à générer");
      return;
    }

    if (!profile?.id) {
      toast.error("Utilisateur non connecté");
      return;
    }

    setIsGenerating(true);

    try {
      // ✅ ÉTAPE 1 : Générer les textes pour les assets sélectionnés
      const selectedAssets = pack.assets.filter((a) => selectedAssetIds.has(a.id));
      
      console.log("[PackPreparationModal] Generating texts for", selectedAssets.length, "assets");
      
      let textsData: any = null;
      let textsError: any = null;
      
      try {
        const response = await supabase.functions.invoke("alfie-generate-texts", {
          body: {
            brandId,
            brief: pack.summary || pack.title,
            assets: selectedAssets.map((asset) => ({
              id: asset.id,
              kind: asset.kind,
              title: asset.title,
              goal: asset.goal,
              tone: asset.tone,
              platform: asset.platform,
              ratio: asset.ratio,
              count: asset.count,
              durationSeconds: asset.durationSeconds,
              prompt: asset.prompt,
            })),
            useBrandKit, // ✅ Use toggle value
          },
        });
        textsData = response.data;
        textsError = response.error;
      } catch (e) {
        textsError = e;
      }

      // ✅ ÉTAPE 2 : Fallback si génération de textes échoue (Phase 2)
      let assetsWithTexts = pack.assets;
      
      if (textsError || !textsData?.texts) {
        console.warn("[PackPreparationModal] Text generation failed, using fallback texts:", textsError);
        
        // Générer des textes par défaut localement
        assetsWithTexts = pack.assets.map((asset) => ({
          ...asset,
          generatedTexts: generateFallbackTexts(asset, pack.title),
        }));
        
        toast.warning("Textes générés localement. Tu peux les éditer dans le Studio.", { duration: 4000 });
      } else {
        console.log("[PackPreparationModal] ✅ Texts generated:", textsData);
        assetsWithTexts = pack.assets.map((asset) => ({
          ...asset,
          generatedTexts: textsData.texts?.[asset.id] || generateFallbackTexts(asset, pack.title),
        }));
      }

      const packWithTexts = { ...pack, assets: assetsWithTexts };

      // ✅ ÉTAPE 3 : Envoyer le pack AVEC les textes
      await sendPackToGenerator({
        brandId,
        pack: packWithTexts,
        userId: profile.id,
        selectedAssetIds: Array.from(selectedAssetIds),
        useBrandKit, // ✅ Pass toggle value
      });

      toast.success("C'est parti ! Alfie prépare ton pack de visuels 🎬");
      onClose();

      // Optionnel : rediriger vers la bibliothèque
      setTimeout(() => {
        navigate("/library");
      }, 1500);
    } catch (error) {
      console.error("Generation error:", error);

      if (error instanceof InsufficientWoofsError) {
        toast.error(
          <div className="space-y-2">
            <p className="font-medium">Tu n'as plus assez de Woofs pour cette génération.</p>
            <p className="text-sm">{error.message}</p>
            <button
              onClick={() => navigate("/billing")}
              className="text-sm underline hover:no-underline"
            >
              Voir les plans
            </button>
          </div>,
          { duration: 6000 }
        );
      } else {
        toast.error("Erreur lors de la génération. Réessaie dans quelques instants.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Envoyer au Studio pour édition
  const handleEditInStudio = () => {
    navigate("/studio", {
      state: {
        pack,
        brief: pack.summary,
      },
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-background rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">On prépare ta campagne avec Alfie 🐶</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Alfie a pré-rempli ce pack pour toi. Tu peux cocher/décocher les éléments avant de lancer la création.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-lg transition-colors"
            disabled={isGenerating}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <h3 className="font-medium text-sm mb-1">{pack.title}</h3>
            <p className="text-xs text-muted-foreground">{pack.summary}</p>
          </div>

          {/* Liste des assets */}
          <div className="space-y-2">
            {pack.assets.map((asset) => {
              const isSelected = selectedAssetIds.has(asset.id);
              const cost = asset.woofCostType === "carousel_slide" ? asset.count : 
                           asset.woofCostType === "video_basic" ? 10 :
                           asset.woofCostType === "video_premium" ? 50 : 1;

              return (
                <label
                  key={asset.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? "bg-primary/10 border-primary/30"
                      : "bg-background hover:bg-muted/50 border-border"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleAsset(asset.id)}
                    className="mt-1"
                    disabled={isGenerating}
                  />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      {getAssetIcon(asset)}
                      <span className="font-medium text-sm">{asset.title}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>{getAssetTypeLabel(asset)}</span>
                      <span>•</span>
                      <span>{asset.platform}</span>
                      <span>•</span>
                      <span>{asset.ratio}</span>
                      <span>•</span>
                      <span>{asset.goal}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{asset.prompt}</p>
                  </div>
                  <div className="text-xs font-medium px-2 py-1 bg-primary/20 rounded-full">
                    {cost} Woofs
                  </div>
                </label>
              );
            })}
          </div>

          {/* Coût total */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
            <span className="font-medium text-sm">Coût total</span>
            <span className="font-bold text-lg text-primary">{totalWoofs} Woofs 🐶</span>
          </div>

          {/* ✅ Phase 2: Toggle useBrandKit */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div>
              <span className="font-medium text-sm">Utiliser le Brand Kit</span>
              <p className="text-xs text-muted-foreground">Adapter le ton et le style à ta marque</p>
            </div>
            <Switch checked={useBrandKit} onCheckedChange={setUseBrandKit} />
          </div>

          {/* Warning si pas assez de Woofs */}
          {totalWoofs > 0 && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-900 dark:text-amber-100">
                Cette génération consommera <strong>{totalWoofs} Woofs</strong> de ton quota mensuel.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 p-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-muted transition-colors"
            disabled={isGenerating}
          >
            Retour au Studio
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleEditInStudio}
              disabled={isGenerating}
              className="px-4 py-2 text-sm font-medium border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
            >
              ✏️ Éditer dans le Studio
            </button>
            <button
              onClick={handleGenerate}
              disabled={isGenerating || selectedAssetIds.size === 0}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? "Alfie prépare tes visuels..." : "Créer ce pack avec Alfie"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
