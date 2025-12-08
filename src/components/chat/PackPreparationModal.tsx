import { useState, useMemo, useRef } from "react";
import { X, Image, Film, Grid3x3, AlertCircle, Volume2, VolumeX, Upload } from "lucide-react";
import type { AlfiePack, PackAsset } from "@/types/alfiePack";
import { calculatePackWoofCost, safeWoofs } from "@/lib/woofs";
import { getWoofCost } from "@/types/alfiePack";
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

// ✅ Phase 2: Fallback text generation function - utilise des titres DIFFÉRENCIÉS pour chaque slide
function generateFallbackTexts(asset: PackAsset, campaignTitle: string): any {
  if (asset.kind === 'carousel') {
    const topic = asset.prompt || asset.title || campaignTitle;
    const totalSlides = asset.count || 5;
    
    // ✅ Titres DIFFÉRENCIÉS pour chaque slide intermédiaire
    const defaultTitles = ["Le problème", "La solution", "Les avantages", "Comment ça marche", "Ce qui change"];
    const defaultSubtitles = ["Découvrez ce défi courant...", "Voici notre approche...", "Ce que vous obtenez...", "Simple et efficace...", "Faites le premier pas..."];
    
    return {
      slides: Array.from({ length: totalSlides }, (_, i) => {
        if (i === 0) {
          return { title: asset.title || topic, subtitle: campaignTitle };
        } else if (i === totalSlides - 1) {
          return { title: "Passez à l'action", subtitle: "Prêt à commencer ?" };
        } else {
          // ✅ Titres UNIQUES par position
          const titleIndex = Math.min(i - 1, defaultTitles.length - 1);
          return { title: defaultTitles[titleIndex], subtitle: defaultSubtitles[titleIndex] };
        }
      }),
    };
  }
  
  if (asset.kind.includes('video')) {
    return {
      video: {
        hook: asset.title || "Découvrez notre secret",
        script: asset.prompt?.slice(0, 200) || "",
        cta: "En savoir plus",
      },
    };
  }
  
  return {
    text: {
      title: asset.title,
      body: asset.prompt?.slice(0, 120) || "",
      cta: "En savoir plus",
    },
  };
}

export default function PackPreparationModal({ pack, brandId, onClose }: PackPreparationModalProps) {
  // ✅ State local pour pouvoir modifier les assets (notamment referenceImageUrl)
  const [localAssets, setLocalAssets] = useState<PackAsset[]>(pack.assets);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(
    new Set(pack.assets.map((a) => a.id))
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [useBrandKit, setUseBrandKit] = useState(true); // ✅ Phase 2: Toggle Brand Kit
  // carouselMode supprimé - carrousels ont maintenant un coût fixe de 10 Woofs
  const [colorMode, setColorMode] = useState<'vibrant' | 'pastel'>('vibrant'); // ✅ Toggle Coloré/Pastel
  const [audioSettings, setAudioSettings] = useState<Record<string, boolean>>(() => {
    // Par défaut, audio activé pour toutes les vidéos
    const initial: Record<string, boolean> = {};
    pack.assets.filter(a => a.kind === 'video_premium').forEach(a => {
      initial[a.id] = true;
    });
    return initial;
  });
  const [uploadingForId, setUploadingForId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const { profile } = useAuth();
  const navigate = useNavigate();
  
  // Vérifie si le pack contient des carrousels
  const hasCarousels = pack.assets.some(a => a.kind === 'carousel');
  
  // Toggle audio pour une vidéo spécifique
  const toggleAudio = (assetId: string) => {
    setAudioSettings(prev => ({
      ...prev,
      [assetId]: !prev[assetId]
    }));
  };

  // ✅ Upload d'image de référence pour vidéos/images
  const handleImageUpload = async (assetId: string, file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Seules les images sont acceptées');
      return;
    }

    setUploadingForId(assetId);
    try {
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `video-refs/${assetId}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('chat-uploads')
        .upload(filePath, file, { upsert: true });
      
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-uploads')
        .getPublicUrl(filePath);

      // ✅ Mettre à jour le localAssets avec l'image
      setLocalAssets(prev => prev.map(asset => 
        asset.id === assetId 
          ? { ...asset, referenceImageUrl: publicUrl }
          : asset
      ));
      
      console.log(`[PackPreparationModal] ✅ Image uploaded for ${assetId}:`, publicUrl);
      toast.success('Image source ajoutée !');
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Erreur lors de l\'upload');
    } finally {
      setUploadingForId(null);
    }
  };

  // Calculer le coût dynamique selon la sélection (utilise localAssets)
  const localPack = useMemo(() => ({ ...pack, assets: localAssets }), [pack, localAssets]);
  
  // Calculer le coût - carrousel = 10 Woofs fixe
  const totalWoofs = useMemo(() => {
    const assetsWithMode = localAssets.map(asset => ({
      ...asset,
      woofCostType: asset.kind === 'carousel' ? 'carousel' as const : asset.woofCostType,
    }));
    const packWithMode = { ...pack, assets: assetsWithMode };
    return safeWoofs(calculatePackWoofCost(packWithMode, Array.from(selectedAssetIds)));
  }, [localAssets, pack, selectedAssetIds]);

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
      case "video_premium":
        return "Vidéo courte (6s)";
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

    // ✅ Utiliser localAssets au lieu de pack.assets pour avoir les images uploadées
    const selectedAssets = localAssets.filter((a) => selectedAssetIds.has(a.id));
    const videosWithoutImage = selectedAssets.filter(
      (a) => a.kind === "video_premium" && !a.referenceImageUrl
    );
    
    // ✅ DEBUG LOG : Vérifier que les images sont bien présentes
    console.log("[PackPreparationModal] Selected assets with images:", selectedAssets.map(a => ({
      id: a.id,
      kind: a.kind,
      title: a.title,
      referenceImageUrl: a.referenceImageUrl ? "✅ " + a.referenceImageUrl.slice(0, 50) : "❌ MISSING"
    })));

    if (videosWithoutImage.length > 0) {
      // ✅ Simple warning, pas bloquant
      toast.warning(
        `📸 Recommandé : ajoute une image source pour de meilleures vidéos`,
        { duration: 4000 }
      );
      // Continue quand même
    }

    setIsGenerating(true);

    try {
      // ✅ ÉTAPE 1 : Vérifier si les textes existent déjà dans le pack
      
      const hasExistingTexts = localAssets.some(a =>
        (a.generatedTexts?.slides?.length ?? 0) > 0 || 
        a.generatedTexts?.text?.title ||
        a.generatedTexts?.video?.hook
      );
      
      console.log("[PackPreparationModal] hasExistingTexts:", hasExistingTexts);
      
      let textsData: any = null;
      let textsError: any = null;
      
      // ✅ Si les textes existent déjà, on les utilise directement
      if (hasExistingTexts) {
        console.log("[PackPreparationModal] ✅ Using existing texts from chat");
      } else {
        // ✅ Sinon, on génère les textes
        console.log("[PackPreparationModal] Generating texts for", selectedAssets.length, "assets");
        
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
      }

      // ✅ ÉTAPE 2 : Fallback si génération de textes échoue (Phase 2)
      // ✅ IMPORTANT: Utiliser localAssets pour conserver les images uploadées
      let assetsWithTexts = localAssets;
      
      if (hasExistingTexts) {
        // ✅ Utiliser les textes existants du pack sans appeler alfie-generate-texts
        assetsWithTexts = localAssets.map((asset) => ({
          ...asset,
          useBrandKit,
          woofCostType: asset.kind === 'carousel' ? 'carousel' as const : asset.woofCostType,
          withAudio: asset.kind === 'video_premium' ? audioSettings[asset.id] : undefined,
        }));
      } else if (textsError || !textsData?.texts) {
        console.warn("[PackPreparationModal] Text generation failed, using fallback texts:", textsError);
        
        // Générer des textes par défaut localement
        assetsWithTexts = localAssets.map((asset) => ({
          ...asset,
          useBrandKit,
          woofCostType: asset.kind === 'carousel' ? 'carousel' as const : asset.woofCostType,
          withAudio: asset.kind === 'video_premium' ? audioSettings[asset.id] : undefined,
          generatedTexts: generateFallbackTexts(asset, localPack.title),
        }));
        
        toast.warning("Textes générés localement. Tu peux les éditer dans le Studio.", { duration: 4000 });
      } else {
        console.log("[PackPreparationModal] ✅ Texts generated:", textsData);
        assetsWithTexts = localAssets.map((asset) => ({
          ...asset,
          useBrandKit,
          woofCostType: asset.kind === 'carousel' ? 'carousel' as const : asset.woofCostType,
          withAudio: asset.kind === 'video_premium' ? audioSettings[asset.id] : undefined,
          generatedTexts: textsData.texts?.[asset.id] || generateFallbackTexts(asset, localPack.title),
        }));
      }

      const packWithTexts = { ...localPack, assets: assetsWithTexts };

      // ✅ ÉTAPE 3 : Envoyer le pack AVEC les textes et le plan utilisateur
      await sendPackToGenerator({
        brandId,
        pack: packWithTexts,
        userId: profile.id,
        selectedAssetIds: Array.from(selectedAssetIds),
        useBrandKit,
        userPlan: profile.plan || 'starter',
        colorMode,
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

  return (
    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-background rounded-t-2xl sm:rounded-lg shadow-xl w-full sm:max-w-2xl h-[92vh] sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col">
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
          {localAssets.map((asset) => {
              const isSelected = selectedAssetIds.has(asset.id);
              // Carrousels = 10 Woofs fixe
              const cost = asset.kind === 'carousel' ? 10 : getWoofCost(asset);

              return (
                <div
                  key={asset.id}
                  className={`p-3 rounded-lg border transition-all ${
                    isSelected
                      ? "bg-primary/10 border-primary/30"
                      : "bg-background hover:bg-muted/50 border-border"
                  }`}
                >
                  <label className="flex items-start gap-3 cursor-pointer">
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
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {/* ✅ Afficher les textes selon le type d'asset */}
                        {asset.kind === 'carousel' && asset.generatedTexts?.slides 
                          ? `Carrousel ${asset.generatedTexts.slides.length} slides : ${asset.generatedTexts.slides.slice(0, 2).map(s => s.title).join(' • ')}...`
                          : asset.kind.includes('video') && asset.generatedTexts?.video
                          ? `🎬 ${asset.generatedTexts.video.hook || 'Script vidéo'}`
                          : asset.kind === 'image' && asset.generatedTexts?.text
                          ? asset.generatedTexts.text.title
                          : asset.prompt
                        }
                      </p>
                      
                      {/* ✅ Toggle audio pour les vidéos */}
                      {asset.kind === 'video_premium' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleAudio(asset.id);
                          }}
                          className={`flex items-center gap-1.5 mt-2 px-2 py-1 rounded text-xs transition-colors ${
                            audioSettings[asset.id] 
                              ? 'bg-primary/20 text-primary' 
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {audioSettings[asset.id] ? (
                            <><Volume2 className="w-3 h-3" /> Avec son</>
                          ) : (
                            <><VolumeX className="w-3 h-3" /> Sans son</>
                          )}
                        </button>
                      )}
                    </div>
                    <div className="text-xs font-medium px-2 py-1 bg-primary/20 rounded-full">
                      {cost} Woofs
                    </div>
                  </label>
                  
                  {/* ✅ Upload d'image pour vidéos et images */}
                  {(asset.kind === 'video_premium' || asset.kind === 'image') && (
                    <div className="mt-2 ml-6">
                      {asset.referenceImageUrl ? (
                        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                          <img 
                            src={asset.referenceImageUrl} 
                            alt="Image source" 
                            className="w-12 h-12 object-cover rounded"
                          />
                          <span className="text-xs text-muted-foreground flex-1">Image source ajoutée ✓</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              fileInputRefs.current[asset.id]?.click();
                            }}
                            className="text-xs text-primary hover:underline"
                          >
                            Changer
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            fileInputRefs.current[asset.id]?.click();
                          }}
                          disabled={uploadingForId === asset.id}
                          className="flex items-center gap-2 p-2 border border-dashed border-orange-400 rounded bg-orange-50 dark:bg-orange-950/20 text-orange-600 text-xs hover:bg-orange-100 dark:hover:bg-orange-950/40 transition w-full"
                        >
                          {uploadingForId === asset.id ? (
                            <span>Upload en cours...</span>
                          ) : (
                            <>
                              <Upload className="w-4 h-4" />
                              <span>📸 Ajouter une image source {asset.kind === 'video_premium' ? '(recommandé)' : ''}</span>
                            </>
                          )}
                        </button>
                      )}
                      <input
                        ref={(el) => { fileInputRefs.current[asset.id] = el; }}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(asset.id, file);
                        }}
                      />
                    </div>
                  )}
                </div>
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

          {/* Note: Les carrousels ont un coût fixe de 10 Woofs */}
          {hasCarousels && (
            <div className="p-3 bg-muted/30 rounded-lg">
              <p className="text-sm font-medium">📱 Carrousel : 10 Woofs</p>
              <p className="text-xs text-muted-foreground">5 slides texte + images de fond</p>
            </div>
          )}

          {/* ✅ Toggle Coloré/Pastel */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div>
              <span className="font-medium text-sm">Style couleurs</span>
              <p className="text-xs text-muted-foreground">Choisir le style de couleurs des visuels</p>
            </div>
            <div className="flex gap-1">
              <button 
                type="button"
                onClick={() => setColorMode('vibrant')}
                className={`px-3 py-1.5 text-sm font-medium rounded-l-md transition-colors flex items-center gap-1 ${
                  colorMode === 'vibrant' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                🌈 Coloré
              </button>
              <button 
                type="button"
                onClick={() => setColorMode('pastel')}
                className={`px-3 py-1.5 text-sm font-medium rounded-r-md transition-colors flex items-center gap-1 ${
                  colorMode === 'pastel' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                🎀 Pastel
              </button>
            </div>
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
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 border-t safe-bottom">
          <button
            onClick={onClose}
            className="order-2 sm:order-1 px-4 py-3 sm:py-2 text-sm font-medium rounded-lg hover:bg-muted transition-colors touch-target"
            disabled={isGenerating}
          >
            Annuler
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || selectedAssetIds.size === 0}
            className="order-1 sm:order-2 px-4 py-3 sm:py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-target"
          >
            {isGenerating ? "Alfie prépare tes visuels..." : "Créer ce pack avec Alfie"}
          </button>
        </div>
      </div>
    </div>
  );
}
