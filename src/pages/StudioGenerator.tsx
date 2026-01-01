import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Sparkles, Image as ImageIcon, LayoutGrid, Video, Info, Palette } from "lucide-react";
import type { VisualStyle } from "@/lib/types/vision";
import { VISUAL_STYLE_OPTIONS } from "@/lib/constants/visualStyles";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useBrandKit } from "@/hooks/useBrandKit";
import { useAuth } from "@/hooks/useAuth";
import type { AlfiePack, PackAsset } from "@/types/alfiePack";
import type { Ratio } from "@/lib/types/alfie";
import { OrderStatusList } from "@/components/studio/OrderStatusList";
import { sendPackToGenerator, InsufficientWoofsError } from "@/services/generatorFromChat";
import { supabase } from "@/integrations/supabase/client";
import { WOOF_COSTS } from "@/lib/woofs";
import { useQueueMonitor } from "@/hooks/useQueueMonitor";
import { useOrderCompletion } from "@/hooks/useOrderCompletion";
import { QueueStatus } from "@/components/chat/QueueStatus";
import { ReferenceImageUploader } from "@/components/studio/ReferenceImageUploader";

type AssetType = "image" | "carousel" | "video";
type Platform = "instagram" | "tiktok" | "linkedin" | "pinterest" | "youtube";

const PLATFORM_RATIOS: Record<Platform, Ratio[]> = {
  instagram: ["4:5", "1:1", "9:16"],
  tiktok: ["9:16"],
  linkedin: ["1:1", "16:9"],
  pinterest: ["2:3", "4:5", "9:16"],
  youtube: ["16:9", "yt-thumb"],
};

const getRatioLabel = (r: Ratio): string => {
  switch (r) {
    case "9:16": return "📱 Story (9:16)";
    case "1:1": return "⬛ Carré (1:1)";
    case "4:5": return "📐 Portrait (4:5)";
    case "16:9": return "🖥️ Paysage (16:9)";
    case "2:3": return "📌 Pinterest (2:3)";
    case "yt-thumb": return "🎬 Miniature YT (1280×720)";
    default: return r;
  }
};

const ASSET_CONFIG = {
  image: { 
    icon: ImageIcon, 
    label: "Image", 
    emoji: "🖼️",
    cost: WOOF_COSTS.image, 
    description: "Visuel statique pour feed ou story" 
  },
  carousel: { 
    icon: LayoutGrid, 
    label: "Carrousel", 
    emoji: "🎠",
    cost: WOOF_COSTS.carousel, 
    description: "5 slides avec texte intégré" 
  },
  video: { 
    icon: Video, 
    label: "Vidéo", 
    emoji: "✨",
    cost: WOOF_COSTS.video_premium, 
    description: "Clip animé 6-8s avec audio" 
  },
};

export function StudioGenerator() {
  const { user, profile } = useAuth();
  const { activeBrandId, activeBrand, loading: brandLoading } = useBrandKit();
  const navigate = useNavigate();
  const location = useLocation();
  
  const { data: queueData } = useQueueMonitor(!!user?.id && !!activeBrandId);
  const { trackOrders } = useOrderCompletion();

  const [selectedType, setSelectedType] = useState<AssetType>("image");
  const [brief, setBrief] = useState("");
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [ratio, setRatio] = useState<Ratio>("4:5");
  const [useBrandKitToggle, setUseBrandKitToggle] = useState(true);
  const [isLaunching, setIsLaunching] = useState(false);
  const [woofsAvailable, setWoofsAvailable] = useState(0);
  const [woofsQuota, setWoofsQuota] = useState(0);
  
  // Style artistique (pour tous les types)
  const [visualStyle, setVisualStyle] = useState<VisualStyle>('photorealistic');
  
  // Options carrousels uniquement
  const [visualStyleCategory, setVisualStyleCategory] = useState<'background' | 'character' | 'product'>('character');
  const [backgroundOnly, setBackgroundOnly] = useState(false);

  // Video options
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [lipSyncEnabled, setLipSyncEnabled] = useState(false);

  // Reference images (1-3)
  const [referenceImages, setReferenceImages] = useState<string[]>([]);

  // Pré-remplir depuis PromptOptimizer, ChatWidget, ou PackPreparationModal
  useEffect(() => {
    const state = location.state as { 
      // Format PromptOptimizer
      prefillPrompt?: string; 
      contentType?: AssetType;
      referenceImages?: string[];
      suggestedRatio?: string;
      // Format ChatWidget
      prefillBrief?: {
        format?: string;
        ratio?: string;
        topic?: string;
      };
      // Format PackPreparationModal
      pack?: AlfiePack;
      brief?: string;
    } | null;
    
    if (!state) return;
    
    // Prompt (plusieurs sources possibles)
    const promptValue = state.prefillPrompt 
      || state.prefillBrief?.topic 
      || state.brief 
      || state.pack?.summary;
    if (promptValue) setBrief(promptValue);
    
    // Type de contenu
    const typeValue = state.contentType || state.prefillBrief?.format as AssetType;
    if (typeValue && ['image', 'carousel', 'video'].includes(typeValue)) {
      setSelectedType(typeValue as AssetType);
    }
    
    // Ratio suggéré
    const ratioValue = state.suggestedRatio || state.prefillBrief?.ratio;
    if (ratioValue && PLATFORM_RATIOS[platform].includes(ratioValue as Ratio)) {
      setRatio(ratioValue as Ratio);
    }
    
    // Images de référence
    if (state.referenceImages?.length) {
      setReferenceImages(state.referenceImages);
    }
    
    // Pack complet (depuis PackPreparationModal)
    if (state.pack?.assets?.length) {
      const firstAsset = state.pack.assets[0];
      if (firstAsset.prompt) setBrief(firstAsset.prompt);
      if (firstAsset.kind) {
        const kind = firstAsset.kind === 'video_premium' ? 'video' : firstAsset.kind;
        if (['image', 'carousel', 'video'].includes(kind)) {
          setSelectedType(kind as AssetType);
        }
      }
      if (firstAsset.ratio && PLATFORM_RATIOS[platform].includes(firstAsset.ratio as Ratio)) {
        setRatio(firstAsset.ratio as Ratio);
      }
    }
    
    // Nettoyer le state pour éviter de re-remplir si l'utilisateur revient
    window.history.replaceState({}, document.title);
  }, [location.state, platform]);

  // Charger les Woofs disponibles
  useEffect(() => {
    if (!activeBrandId) return;

    const fetchQuota = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-quota", {
          body: { brand_id: activeBrandId },
        });

        if (!error && data?.ok) {
          setWoofsAvailable(data.data.woofs_remaining);
          setWoofsQuota(data.data.woofs_quota);
        }
      } catch (err) {
        console.error("[Studio] Error fetching quota:", err);
      }
    };

    fetchQuota();
  }, [activeBrandId]);

  // Mettre à jour le ratio quand la plateforme change
  useEffect(() => {
    const availableRatios = PLATFORM_RATIOS[platform];
    if (!availableRatios.includes(ratio)) {
      setRatio(availableRatios[0]);
    }
  }, [platform, ratio]);

  const getCurrentCost = () => ASSET_CONFIG[selectedType].cost;

  const canGenerate = () => {
    return brief.trim().length > 0 && woofsAvailable >= getCurrentCost();
  };

  const launchGeneration = async () => {
    if (!user || !activeBrandId) {
      toast.error("Tu dois être connecté avec une marque active");
      return;
    }

    if (!brief.trim()) {
      toast.error("Décris ce que tu veux créer");
      return;
    }

    const cost = getCurrentCost();
    if (woofsAvailable < cost) {
      toast.error(`Tu n'as pas assez de Woofs (${cost} nécessaires, ${woofsAvailable} disponibles)`);
      return;
    }

    setIsLaunching(true);

    try {
      // Construire un pack avec 1 seul asset
      const assetId = `solo_${Date.now()}`;
      const asset: PackAsset = {
        id: assetId,
        brandId: activeBrandId,
        kind: selectedType === "video" ? "video_premium" : selectedType,
        count: selectedType === "carousel" ? 5 : 1,
        platform,
        format: ratio === "9:16" ? "story" : "post",
        ratio,
        title: brief.slice(0, 50),
        goal: "engagement",
        tone: "professionnel",
        prompt: brief,
        woofCostType: selectedType === "video" ? "video_premium" : selectedType === "carousel" ? "carousel" : "image",
        useBrandKit: useBrandKitToggle,
        visualStyle,
        durationSeconds: selectedType === "video" ? 6 : undefined,
        // Reference images
        referenceImageUrl: referenceImages[0], // Primary reference
        referenceImages, // All references
        // Options carrousels
        ...(selectedType === "carousel" && {
          visualStyleCategory,
          backgroundOnly,
        }),
      };

      const pack: AlfiePack = {
        title: `${ASSET_CONFIG[selectedType].label} solo`,
        summary: brief,
        assets: [asset],
      };

      const result = await sendPackToGenerator({
        brandId: activeBrandId,
        pack,
        userId: user.id,
        selectedAssetIds: [assetId],
        useBrandKit: useBrandKitToggle,
        userPlan: profile?.plan || "starter",
        source: 'studio_solo',
        // Video options
        useUnifiedMusic: selectedType === "video" ? musicEnabled : undefined,
        useLipSync: selectedType === "video" ? lipSyncEnabled : undefined,
      });

      toast.success(`${ASSET_CONFIG[selectedType].emoji} Génération lancée !`);
      
      if (result.orderIds?.length) {
        trackOrders(result.orderIds);
      }
      
      // Recharger les Woofs
      const { data } = await supabase.functions.invoke("get-quota", {
        body: { brand_id: activeBrandId },
      });
      if (data?.ok) {
        setWoofsAvailable(data.data.woofs_remaining);
      }

      // Reset
      setBrief("");
    } catch (error) {
      console.error("[Studio] Launch error:", error);
      
      if (error instanceof InsufficientWoofsError) {
        toast.error(error.message);
      } else if (error instanceof Error) {
        toast.error(`Erreur : ${error.message}`);
      } else {
        toast.error("Erreur lors de la génération. Réessaie.");
      }
    } finally {
      setIsLaunching(false);
    }
  };

  // Loading state
  if (brandLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center gap-3 mb-8">
            <Skeleton className="w-8 h-8 rounded-full" />
            <Skeleton className="h-10 w-48" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </div>
    );
  }

  // No brand selected state
  if (!activeBrandId) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8 text-center">
            <div className="flex items-center justify-center gap-3 mb-3">
              <Sparkles className="w-8 h-8 text-alfie-pink" />
              <h1 className="text-3xl md:text-4xl font-bold">Studio Solo</h1>
            </div>
            <p className="text-muted-foreground">Crée un visuel unique</p>
          </div>

          <Card className="max-w-md mx-auto p-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-alfie-mint/20 rounded-full flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-alfie-pink" />
            </div>
            <h2 className="text-xl font-semibold">Presque prêt ! 🐶</h2>
            <p className="text-muted-foreground">
              Sélectionne ou crée une marque pour commencer à générer tes visuels avec Alfie.
            </p>
            <Button onClick={() => navigate("/brand-kit")} className="gap-2">
              Configurer ma marque
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background pb-24 lg:pb-8">
        {/* Barre sticky mobile - Récap Woofs */}
        <div className="lg:hidden sticky top-0 z-40 bg-background/95 backdrop-blur border-b px-3 py-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium">{woofsAvailable} 🐾</span>
              <span className="text-muted-foreground">disponibles</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Coût:</span>
              <span className="font-medium text-primary">{getCurrentCost()} 🐾</span>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
          {/* Header */}
          <div className="mb-6 sm:mb-8 text-center" data-tour-id="studio-header">
            <div className="flex items-center justify-center gap-2 sm:gap-3 mb-2">
              <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-alfie-pink" />
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">Studio Solo</h1>
            </div>
            <p className="text-muted-foreground text-sm sm:text-base">
              Crée un visuel unique : image, carrousel ou vidéo
            </p>
            <Button
              variant="link"
              size="sm"
              onClick={() => navigate("/studio/multi")}
              className="mt-2 text-xs text-muted-foreground"
            >
              Besoin de plusieurs visuels ? → Studio Multi
            </Button>
          </div>

          <div className="max-w-3xl mx-auto space-y-6">
            {/* Type selector - 3 Cards */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              {(Object.keys(ASSET_CONFIG) as AssetType[]).map((type) => {
                const config = ASSET_CONFIG[type];
                const isSelected = selectedType === type;
                
                  const tourId = type === "image" ? "studio-image-card" 
                    : type === "carousel" ? "studio-carousel-card" 
                    : "studio-video-card";
                  
                  return (
                    <button
                      key={type}
                      onClick={() => setSelectedType(type)}
                      data-tour-id={tourId}
                      className={`
                        relative p-4 sm:p-6 rounded-xl border-2 transition-all text-center
                        ${isSelected 
                          ? "border-primary bg-primary/5 shadow-lg" 
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                        }
                      `}
                    >
                    <div className="text-2xl sm:text-3xl mb-2">{config.emoji}</div>
                    <h3 className="font-semibold text-sm sm:text-base">{config.label}</h3>
                    <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
                      {config.description}
                    </p>
                    <Badge 
                      variant={isSelected ? "default" : "secondary"} 
                      className="mt-2 text-xs"
                    >
                      {config.cost} 🐾
                    </Badge>
                    
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Configuration */}
            <Card className="p-4 sm:p-6 space-y-4">
              {/* Brief */}
              <div>
                <label className="font-semibold text-sm flex items-center gap-2 mb-2">
                  Décris ton visuel
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="w-4 h-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Sois précis : sujet, ambiance, couleurs, texte souhaité...</p>
                    </TooltipContent>
                  </Tooltip>
                </label>
                <Textarea
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  placeholder={
                    selectedType === "image" 
                      ? "Ex: Une image minimaliste de produit sur fond beige avec le texte 'Nouveau' en overlay" 
                      : selectedType === "carousel"
                        ? "Ex: Un carrousel éducatif sur les 5 erreurs à éviter en création de contenu"
                        : "Ex: Une vidéo dynamique présentant notre nouvelle collection printemps"
                  }
                  rows={4}
                  className="resize-none"
                />
              </div>

              {/* Reference Images */}
              <ReferenceImageUploader
                images={referenceImages}
                onImagesChange={setReferenceImages}
                maxImages={3}
              />
              <div className="grid grid-cols-2 gap-4">
                <div data-tour-id="studio-platform-select">
                  <label className="font-semibold text-sm block mb-2">Plateforme</label>
                  <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instagram">📸 Instagram</SelectItem>
                      <SelectItem value="tiktok">🎵 TikTok</SelectItem>
                      <SelectItem value="linkedin">💼 LinkedIn</SelectItem>
                      <SelectItem value="pinterest">📌 Pinterest</SelectItem>
                      <SelectItem value="youtube">🎬 YouTube</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="font-semibold text-sm block mb-2">Format</label>
                  <Select value={ratio} onValueChange={(v) => setRatio(v as Ratio)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLATFORM_RATIOS[platform].map((r) => (
                        <SelectItem key={r} value={r}>
                          {getRatioLabel(r)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Style artistique */}
              <div data-tour-id="studio-visual-style">
                <label className="font-semibold text-sm flex items-center gap-2 mb-2">
                  <Palette className="w-4 h-4" />
                  Style artistique
                </label>
                <Select value={visualStyle} onValueChange={(v) => setVisualStyle(v as VisualStyle)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VISUAL_STYLE_OPTIONS.map((style) => (
                      <SelectItem key={style.value} value={style.value}>
                        {style.label} — <span className="text-muted-foreground">{style.description}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Options carrousels uniquement */}
              {selectedType === "carousel" && (
                <div className="space-y-4 p-4 bg-primary/5 rounded-lg border border-primary/20" data-tour-id="studio-carousel-options">
                  <p className="text-sm font-medium flex items-center gap-2">
                    🎠 Options carrousel
                  </p>
                  
                  {/* Style visuel */}
                  <div>
                    <label className="font-medium text-sm block mb-2">Style visuel</label>
                    <Select value={visualStyleCategory} onValueChange={(v) => setVisualStyleCategory(v as 'background' | 'character' | 'product')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="background">🎨 Fond abstrait</SelectItem>
                        <SelectItem value="character">🐕 Personnage / Mascotte</SelectItem>
                        <SelectItem value="product">📦 Produit / Mockup</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      {visualStyleCategory === 'background' && "Dégradés, formes géométriques, textures"}
                      {visualStyleCategory === 'character' && "Personnage 3D Pixar, mascotte, illustrations"}
                      {visualStyleCategory === 'product' && "Mise en scène produit, mockups"}
                    </p>
                  </div>

                  {/* Toggle fond seul */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Fond seul</p>
                      <p className="text-xs text-muted-foreground">Sans texte intégré</p>
                    </div>
                    <Switch checked={backgroundOnly} onCheckedChange={setBackgroundOnly} />
                  </div>
                </div>
              )}

              {/* Options vidéo uniquement */}
              {selectedType === "video" && (
                <div className="space-y-4 p-4 bg-primary/5 rounded-lg border border-primary/20" data-tour-id="studio-video-options">
                  <p className="text-sm font-medium flex items-center gap-2">
                    🎬 Options vidéo
                  </p>
                  
                  {/* Toggle Musique */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Musique de fond</p>
                      <p className="text-xs text-muted-foreground">Musique générée par ElevenLabs</p>
                    </div>
                    <Switch checked={musicEnabled} onCheckedChange={setMusicEnabled} />
                  </div>

                  {/* Toggle Lip-Sync */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Lip-Sync</p>
                      <p className="text-xs text-muted-foreground">Personnage de face, lèvres synchronisées</p>
                    </div>
                    <Switch checked={lipSyncEnabled} onCheckedChange={setLipSyncEnabled} />
                  </div>
                </div>
              )}

              {/* Brand Kit Toggle */}
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg" data-tour-id="studio-brandkit-toggle">
                <div>
                  <p className="font-medium text-sm">Utiliser le Brand Kit</p>
                  <p className="text-xs text-muted-foreground">
                    {activeBrand?.name || "Marque active"}
                  </p>
                </div>
                <Switch checked={useBrandKitToggle} onCheckedChange={setUseBrandKitToggle} />
              </div>

              {/* Brand Kit preview */}
              {useBrandKitToggle && activeBrand && (
                <div className="p-3 bg-muted/20 rounded-lg space-y-2 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{activeBrand.name}</Badge>
                    {activeBrand.niche && <Badge variant="secondary">{activeBrand.niche}</Badge>}
                  </div>
                  {activeBrand.palette && Array.isArray(activeBrand.palette) && (
                    <div className="flex items-center gap-1">
                      {activeBrand.palette.slice(0, 5).map((color: string, i: number) => (
                        <div
                          key={i}
                          className="w-5 h-5 rounded border border-border"
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Desktop CTA */}
            <div className="hidden lg:block">
              <Card className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Coût de cette création</p>
                    <p className="text-2xl font-bold">{getCurrentCost()} 🐾</p>
                    <p className="text-xs text-muted-foreground">
                      ({woofsAvailable} disponibles sur {woofsQuota})
                    </p>
                  </div>
                  <Button
                    size="lg"
                    onClick={launchGeneration}
                    disabled={!canGenerate() || isLaunching}
                    className="gap-2 px-8"
                  >
                    {isLaunching ? (
                      <>
                        <Sparkles className="w-4 h-4 animate-spin" />
                        Génération...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Créer mon {ASSET_CONFIG[selectedType].label.toLowerCase()}
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            </div>

            {/* Orders & Queue status */}
            {user && activeBrandId && (
              <div className="space-y-4">
                <OrderStatusList brandId={activeBrandId} userId={user.id} />
                {queueData && <QueueStatus data={queueData} />}
              </div>
            )}
          </div>
        </div>

        {/* Footer sticky mobile */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 p-3 bg-background/95 backdrop-blur border-t z-30 safe-area-bottom">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 text-center">
              <div className="text-lg font-bold">{woofsAvailable - getCurrentCost()}</div>
              <div className="text-[10px] text-muted-foreground">après création</div>
            </div>
            <Button
              onClick={launchGeneration}
              disabled={!canGenerate() || isLaunching}
              className="flex-1 h-12"
            >
              {isLaunching ? (
                <>
                  <Sparkles className="mr-2 h-4 w-4 animate-spin" />
                  <span className="text-sm">Génération...</span>
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  <span className="text-sm">Créer ({getCurrentCost()} 🐾)</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
