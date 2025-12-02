import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Sparkles, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useBrandKit } from "@/hooks/useBrandKit";
import { useAuth } from "@/hooks/useAuth";
import type { AlfiePack, PackAsset } from "@/types/alfiePack";
import { PackAssetRow } from "@/components/studio/PackAssetRow";
import { PackSummarySidebar } from "@/components/studio/PackSummarySidebar";
import { OrderStatusList } from "@/components/studio/OrderStatusList";
import { sendPackToGenerator, InsufficientWoofsError } from "@/services/generatorFromChat";
import { supabase } from "@/integrations/supabase/client";
import { calculatePackWoofCost } from "@/lib/woofs";
import { useQueueMonitor } from "@/hooks/useQueueMonitor";
import { useOrderCompletion } from "@/hooks/useOrderCompletion";
import { QueueStatus } from "@/components/chat/QueueStatus";
import { TourProvider, HelpLauncher } from "@/components/tour/InteractiveTour";
import { StudioTourAutoStart } from "@/components/tour/StudioTourAutoStart";
import { STUDIO_STEPS } from "@/components/tour/StudioTourSteps";

/**
 * Enrichit un pack avec woofCostType basé sur le kind de chaque asset
 */
function enrichPackWithWoofCostType(pack: AlfiePack): AlfiePack {
  return {
    ...pack,
    assets: pack.assets.map((asset) => ({
      ...asset,
      count: asset.kind === 'carousel' ? (asset.count || 5) : (asset.count || 1),
      woofCostType: asset.kind === 'carousel' 
        ? 'carousel_slide' 
        : asset.kind === 'image'
          ? 'image'
          : 'video_premium',
    })),
  };
}

// Packs prédéfinis
const PRESET_PACKS = {
  lancement: {
    title: "Pack de lancement",
    summary: "3 visuels + 1 carrousel pour annoncer ton lancement",
    assets: [
      {
        id: "launch_1",
        brandId: "", // Will be filled with activeBrandId
        kind: "image" as const,
        count: 1,
        platform: "instagram" as const,
        format: "post" as const,
        ratio: "4:5" as const,
        title: "Visuel d'annonce",
        goal: "engagement" as const,
        tone: "excitant, accrocheur",
        prompt: "Visuel d'annonce impactant pour un lancement de produit",
        woofCostType: "image" as const,
      },
      {
        id: "launch_2",
        brandId: "",
        kind: "carousel" as const,
        count: 5,
        platform: "instagram" as const,
        format: "post" as const,
        ratio: "4:5" as const,
        title: "Carrousel : 5 raisons de découvrir",
        goal: "education" as const,
        tone: "informatif, engageant",
        prompt: "Carrousel expliquant 5 bénéfices clés du produit lancé",
        woofCostType: "carousel_slide" as const,
      },
      {
        id: "launch_3",
        brandId: "",
        kind: "image" as const,
        count: 1,
        platform: "instagram" as const,
        format: "story" as const,
        ratio: "9:16" as const,
        title: "Story teaser",
        goal: "engagement" as const,
        tone: "mystérieux, teaser",
        prompt: "Story verticale en teaser avant-première",
        woofCostType: "image" as const,
      },
    ],
  },
  evergreen: {
    title: "Pack evergreen",
    summary: "Contenus éducatifs intemporels pour nourrir ta communauté",
    assets: [
      {
        id: "evergreen_1",
        brandId: "",
        kind: "carousel" as const,
        count: 7,
        platform: "instagram" as const,
        format: "post" as const,
        ratio: "4:5" as const,
        title: "Carrousel : Guide pratique",
        goal: "education" as const,
        tone: "pédagogique, accessible",
        prompt: "Carrousel guide pratique avec conseils actionnables",
        woofCostType: "carousel_slide" as const,
      },
      {
        id: "evergreen_2",
        brandId: "",
        kind: "image" as const,
        count: 1,
        platform: "instagram" as const,
        format: "post" as const,
        ratio: "1:1" as const,
        title: "Citation inspirante",
        goal: "engagement" as const,
        tone: "inspirant, motivant",
        prompt: "Citation inspirante liée à la thématique",
        woofCostType: "image" as const,
      },
    ],
  },
  promo: {
    title: "Pack promo express",
    summary: "Images pour une promo flash",
    assets: [
      {
        id: "promo_1",
        brandId: "",
        kind: "image" as const,
        count: 1,
        platform: "instagram" as const,
        format: "post" as const,
        ratio: "1:1" as const,
        title: "Visuel promo",
        goal: "vente" as const,
        tone: "urgent, persuasif",
        prompt: "Visuel de promotion avec offre claire et call-to-action",
        woofCostType: "image" as const,
      },
      {
        id: "promo_2",
        brandId: "",
        kind: "image" as const,
        count: 1,
        platform: "instagram" as const,
        format: "story" as const,
        ratio: "9:16" as const,
        title: "Story promo dynamique",
        goal: "vente" as const,
        tone: "dynamique, percutant",
        prompt: "Story verticale pour promo avec timer urgence",
        woofCostType: "image" as const,
      },
    ],
  },
};

export function StudioGenerator() {
  const { user } = useAuth();
  const { activeBrandId, activeBrand, loading: brandLoading } = useBrandKit();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Monitoring de la queue avec auto-kick du worker
  const { data: queueData } = useQueueMonitor(!!user?.id && !!activeBrandId);
  
  // Suivi de complétion des orders
  const { trackOrders } = useOrderCompletion();

  const [campaignName, setCampaignName] = useState("");
  const [brief, setBrief] = useState("");
  const [pack, setPack] = useState<AlfiePack>({
    title: "Mon pack personnalisé",
    summary: "",
    assets: [],
  });
  const [isLaunching, setIsLaunching] = useState(false);
  const [woofsAvailable, setWoofsAvailable] = useState(0);
  const [woofsQuota, setWoofsQuota] = useState(0);
  const [isGeneratingFromBrief, setIsGeneratingFromBrief] = useState(false);
  const [briefGenerationError, setBriefGenerationError] = useState<string | null>(null);
  const [useBrandKitForPack, setUseBrandKitForPack] = useState(true);

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

  // Charger le pack depuis le ChatWidget (si pré-rempli)
  useEffect(() => {
    const state = location.state as { pack?: AlfiePack; brief?: string } | null;
    
    if (state?.pack) {
      console.log("[Studio] Loading pack from chat:", state.pack);
      setPack(state.pack);
      setCampaignName(state.pack.title);
      setBrief(state.brief || state.pack.summary);
    }

    // Nettoyer le state pour éviter de le recharger
    if (state?.pack) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  const loadPreset = (presetKey: keyof typeof PRESET_PACKS) => {
    const preset = PRESET_PACKS[presetKey];
    // Fill brandId for all assets
    const assetsWithBrand = preset.assets.map(asset => ({
      ...asset,
      brandId: activeBrandId || "",
    }));
    setPack({ ...preset, assets: assetsWithBrand });
    setCampaignName(preset.title);
    toast.success(`Pack "${preset.title}" chargé !`);
  };

  const addAsset = (template?: Partial<PackAsset>) => {
    const newAsset: PackAsset = {
      id: `asset_${Date.now()}`,
      brandId: activeBrandId || "",
      kind: template?.kind || "image",
      count: template?.count || 1,
      platform: template?.platform || "instagram",
      format: template?.format || "post",
      ratio: template?.ratio || "4:5",
      title: template?.title || "Nouveau visuel",
      goal: template?.goal || "engagement",
      tone: template?.tone || "friendly",
      prompt: template?.prompt || "",
      woofCostType: template?.woofCostType || "image",
      useBrandKit: useBrandKitForPack, // ✅ Propager le toggle Brand Kit
      ...template,
    };

    setPack((prev) => ({
      ...prev,
      assets: [...prev.assets, newAsset],
    }));
  };

  const duplicateAsset = (asset: PackAsset) => {
    const duplicated = {
      ...asset,
      id: `asset_${Date.now()}`,
      title: `${asset.title} (copie)`,
    };
    setPack((prev) => ({
      ...prev,
      assets: [...prev.assets, duplicated],
    }));
    toast.success("Asset dupliqué !");
  };

  const deleteAsset = (assetId: string) => {
    setPack((prev) => ({
      ...prev,
      assets: prev.assets.filter((a) => a.id !== assetId),
    }));
    toast.success("Asset supprimé");
  };

  const editAsset = (updatedAsset: PackAsset) => {
    setPack((prev) => ({
      ...prev,
      assets: prev.assets.map((a) => (a.id === updatedAsset.id ? updatedAsset : a)),
    }));
  };

  // Fonction pour générer un pack à partir du brief
  const handleGenerateFromBrief = async () => {
    if (!activeBrandId || !campaignName.trim()) {
      toast.error("Veuillez remplir le nom de campagne");
      return;
    }

    if (!brief.trim()) {
      toast.error("Décris ton projet ou objectif dans le brief avant de demander un pack à Alfie 🐶");
      return;
    }

    setIsGeneratingFromBrief(true);
    setBriefGenerationError(null);

    try {
      let packStructure: AlfiePack;

      // Cas 1 : Brief rempli - générer pack personnalisé
      if (brief.trim()) {
        const userMessage = `[CAMPAGNE_BRIEF]
Nom : ${campaignName}
Objectif : ${brief}

[BRAND_KIT_ENABLED]
${useBrandKitForPack}

Ta mission : Propose-moi un PACK COMPLET de 4 à 6 visuels cohérents avec ce brief.

Chaque visuel doit avoir un RÔLE DISTINCT dans la campagne :
- Teaser ou accroche
- Éducation ou explication
- Preuve sociale ou témoignage
- Call-to-action fort
- Behind-the-scenes ou storytelling

Mix attendu : au moins 1 carrousel (5 slides) + 2-3 images + 1 option animée/vidéo selon mon budget.`;

        const { data, error } = await supabase.functions.invoke("alfie-chat-widget", {
          body: {
            brandId: activeBrandId,
            persona: "realisateur_studio",
            messages: [
              { role: "user", content: userMessage }
            ],
            lang: "fr",
            useBrandKit: useBrandKitForPack,
          },
        });

        if (error) {
          console.error("Edge function error:", error);
          throw new Error(error.message || "Erreur lors de l'appel à Alfie");
        }

        const packData = data?.pack;
        
        if (packData && packData.assets && packData.assets.length > 0) {
          packStructure = enrichPackWithWoofCostType(packData);
        } else {
          console.warn("No pack detected in response");
          setBriefGenerationError(
            "Alfie n'a pas réussi à proposer un pack automatiquement. Tu peux ajouter tes visuels manuellement ou réessayer plus tard."
          );
          return;
        }
      } else {
        // Cas 2 : Brief vide - proposer un pack par défaut "présentation de marque"
        console.log("[Studio] Brief empty, creating default brand presentation pack");
        
        packStructure = {
          title: `Présentation ${activeBrand?.name || "de la marque"}`,
          summary: "Pack par défaut pour présenter ta marque",
          assets: [
            {
              id: `default_${Date.now()}_1`,
              brandId: activeBrandId || "",
              kind: "carousel",
              count: 5,
              platform: "instagram",
              format: "post",
              ratio: "4:5",
              title: "Carrousel : Découvrez notre marque",
              goal: "education",
              tone: activeBrand?.voice || "professionnel, accessible",
              prompt: `Carrousel de présentation de la marque ${activeBrand?.name || ""}. Slide 1: Accroche, Slide 2: Notre mission, Slides 3-4: Nos valeurs et notre offre, Slide 5: Call-to-action pour découvrir`,
              woofCostType: "carousel_slide",
            },
          ],
        };
      }

      // ✅ Phase 4: Generate texts with robust fallback
      const assetBriefs = packStructure.assets.map((asset) => ({
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
      }));

      let textsData: any = null;
      let textsError: any = null;

      try {
        const response = await supabase.functions.invoke("alfie-generate-texts", {
          body: {
            brandId: activeBrandId,
            brief: brief || `Présentation de ${activeBrand?.name || "la marque"}`,
            assets: assetBriefs,
            useBrandKit: useBrandKitForPack,
          },
        });
        textsData = response.data;
        textsError = response.error;
      } catch (e) {
        textsError = e;
      }

      // ✅ Phase 4: Local fallback helper
      const generateLocalFallback = (asset: PackAsset) => {
        const brandName = activeBrand?.name || "Notre marque";
        
        if (asset.kind === 'carousel') {
          return {
            slides: [
              { title: asset.title || "Découvrez", subtitle: brief.slice(0, 80) || "Notre contenu exclusif" },
              ...Array.from({ length: asset.count - 2 }, (_, i) => ({
                title: `Point clé ${i + 1}`,
                subtitle: `Élément ${i + 1}`,
              })),
              { title: "Passez à l'action", subtitle: `Rejoignez ${brandName}` },
            ],
          };
        }
        
        if (asset.kind.includes('video')) {
          return { video: { hook: asset.title, script: asset.prompt.slice(0, 200), cta: "En savoir plus" } };
        }
        
        return { text: { title: asset.title, body: asset.prompt.slice(0, 120), cta: "En savoir plus" } };
      };

      // Merge texts with fallback
      const assetsWithTexts = packStructure.assets.map((asset) => ({
        ...asset,
        generatedTexts: textsData?.texts?.[asset.id] || generateLocalFallback(asset),
      }));

      setPack({ ...packStructure, assets: assetsWithTexts });
      
      if (textsError) {
        toast.warning("Textes générés localement. Tu peux les éditer avant génération.");
      } else {
        toast.success("Pack proposé ! Tu peux éditer les textes avant génération.");
      }
      setBriefGenerationError(null);

    } catch (err) {
      console.error("Error generating pack from brief:", err);
      setBriefGenerationError(
        err instanceof Error 
          ? `Erreur : ${err.message}` 
          : "Alfie a rencontré un souci technique. Réessaie dans quelques instants."
      );
    } finally {
      setIsGeneratingFromBrief(false);
    }
  };

  const launchGeneration = async () => {
    if (!user || !activeBrandId) {
      toast.error("Tu dois être connecté avec une marque active");
      return;
    }

    if (pack.assets.length === 0) {
      toast.error("Ajoute au moins un asset pour lancer la génération");
      return;
    }

    // ✅ Vérifier que les vidéos ont une image de référence
    const videosWithoutImage = pack.assets.filter(
      (a) => a.kind === "video_premium" && !a.referenceImageUrl
    );

    if (videosWithoutImage.length > 0) {
      toast.warning(
        `📸 Recommandé : ajoute une image source pour de meilleurs résultats vidéo`,
        { duration: 4000 }
      );
      // Continue sans bloquer - image recommandée mais pas obligatoire
    }

    // Calculer le coût pour afficher dans la confirmation
    const totalCost = calculatePackWoofCost(pack);

    // Confirmation explicite avant de lancer
    const confirmed = window.confirm(
      `Tu vas créer ${pack.assets.length} visuel(s) pour un coût de ${totalCost} Woofs.\n\nConfirmer ?`
    );

    if (!confirmed) {
      return;
    }

    setIsLaunching(true);

    try {
      const result = await sendPackToGenerator({
        brandId: activeBrandId,
        pack,
        userId: user.id,
        selectedAssetIds: pack.assets.map((a) => a.id),
        useBrandKit: useBrandKitForPack, // ✅ Propagation du toggle Brand Kit
      });

      toast.success(`Super ! Alfie lance la génération de tes visuels 🐶`);
      
      // ✅ Démarrer le suivi de complétion
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

      // Reset le pack
      setPack({
        title: "Mon pack personnalisé",
        summary: "",
        assets: [],
      });
      setCampaignName("");
      setBrief("");
    } catch (error) {
      console.error("[Studio] Launch error:", error);
      
      if (error instanceof InsufficientWoofsError) {
        toast.error(error.message);
      } else if (error instanceof Error) {
        // Message humain selon le type d'erreur
        if (error.message.includes("Brand not found")) {
          toast.error("Il manque encore quelques infos. Vérifie qu'une marque est bien sélectionnée.");
        } else if (error.message.includes("Failed to create order")) {
          toast.error("Alfie a rencontré un souci pour créer ta commande. Réessaie dans quelques instants.");
        } else {
          toast.error(`Alfie a rencontré un souci technique : ${error.message}`);
        }
      } else {
        toast.error("Alfie a rencontré un souci technique pour lancer la génération. Réessaie dans quelques minutes.");
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Skeleton className="lg:col-span-3 h-64" />
            <Skeleton className="lg:col-span-6 h-96" />
            <Skeleton className="lg:col-span-3 h-48" />
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
          {/* Header cohérent */}
          <div className="mb-8 text-center">
            <div className="flex items-center justify-center gap-3 mb-3">
              <Sparkles className="w-8 h-8 text-alfie-pink" />
              <h1 className="text-3xl md:text-4xl font-bold">Studio Alfie</h1>
            </div>
            <p className="text-muted-foreground">
              Crée ton pack de visuels sur mesure 🎬
            </p>
          </div>

          {/* Card améliorée */}
          <Card className="max-w-md mx-auto p-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-alfie-mint/20 rounded-full flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-alfie-pink" />
            </div>
            <h2 className="text-xl font-semibold">
              Presque prêt ! 🐶
            </h2>
            <p className="text-muted-foreground">
              Sélectionne ou crée une marque pour commencer à générer tes visuels avec Alfie.
            </p>
            <Button 
              onClick={() => navigate('/brand-kit')}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Configurer ma marque
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <TourProvider steps={STUDIO_STEPS} options={{ userEmail: user?.email }}>
      <StudioTourAutoStart />
      
      <div className="min-h-screen bg-background pb-20 lg:pb-8">
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
          {/* Header */}
          <div data-tour-id="studio-header" className="mb-6 sm:mb-8 text-center">
            <div className="flex items-center justify-center gap-2 sm:gap-3 mb-2 sm:mb-3">
              <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-alfie-pink" />
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">Studio Alfie</h1>
            </div>
            <p className="text-muted-foreground text-sm sm:text-base md:text-lg">
              Crée ton pack de visuels sur mesure 🎬
            </p>
          </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 pb-20 sm:pb-0">
          {/* Colonne 1 : Brief global */}
          <div className="lg:col-span-3 space-y-4">
            {/* Card Brief de campagne */}
            <Card data-tour-id="studio-brief" className="p-4 space-y-4">
              <div>
                <h3 className="font-semibold mb-2 text-sm">Nom de la campagne</h3>
                <Input
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="Ex: Lancement Printemps 2025"
                />
              </div>

              <div>
                <h3 className="font-semibold mb-2 text-sm">Brief global</h3>
                <Textarea
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  placeholder="Explique à Alfie ce que tu veux lancer (offre, cible, ton, plateforme…)"
                  rows={6}
                />
              </div>
            </Card>

            {/* Card Brand Kit - SÉPARÉE */}
            <Card data-tour-id="studio-brandkit" className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Brand Kit</h3>
                <Switch
                  checked={useBrandKitForPack}
                  onCheckedChange={setUseBrandKitForPack}
                />
              </div>
              
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Utiliser le Brand Kit pour cette campagne
                </span>
              </div>
              
              {!useBrandKitForPack && (
                <p className="text-xs text-muted-foreground italic">
                  Alfie créera des visuels plus neutres, sans reprendre ta charte de marque.
                </p>
              )}
              
              {/* Affichage Brand Kit existant (si toggle activé) */}
              {useBrandKitForPack && activeBrand && (
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{activeBrand.name}</Badge>
                  </div>
                  {activeBrand.palette && Array.isArray(activeBrand.palette) && (
                    <div className="flex items-center gap-1">
                      {activeBrand.palette.slice(0, 5).map((color, i) => (
                        <div
                          key={i}
                          className="w-6 h-6 rounded border border-border"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  )}
                  {activeBrand.voice && (
                    <p className="italic">"{activeBrand.voice}"</p>
                  )}
                </div>
              )}
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-3 text-sm">Packs prédéfinis</h3>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => loadPreset("lancement")}
                >
                  🚀 Pack de lancement
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => loadPreset("evergreen")}
                >
                  🌲 Pack evergreen
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => loadPreset("promo")}
                >
                  🔥 Pack promo express
                </Button>
              </div>
            </Card>
          </div>

          {/* Colonne 2 : Pack d'assets */}
          <div className="lg:col-span-6 space-y-4">
            <Card data-tour-id="studio-assets" className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Visuels de ta campagne ({pack.assets.length})</h3>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Ajouter un visuel
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => addAsset({ kind: "image", woofCostType: "image" })}>
                      🖼️ Image
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => addAsset({ kind: "carousel", count: 5, woofCostType: "carousel_slide" })}>
                      📊 Carrousel
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => addAsset({ kind: "video_premium", durationSeconds: 6, woofCostType: "video_premium" })}>
                      ✨ Asset vidéo (6s)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* CTA pour générer depuis le brief - TOUJOURS AFFICHÉ */}
              {pack.assets.length === 0 && !briefGenerationError && (
                <Card className="p-6 text-center space-y-3 bg-gradient-to-br from-alfie-mint/10 to-alfie-pink/10 border-alfie-mint/30 mb-4">
                  <Sparkles className="h-8 w-8 mx-auto text-alfie-pink" />
                  <p className="text-sm text-muted-foreground">
                    {brief.trim() 
                      ? "Tu peux demander à Alfie de te proposer un pack à partir de ton brief ✨" 
                      : "Alfie peut te proposer un pack de présentation de ta marque par défaut ✨"
                    }
                  </p>
                  <Button
                    data-tour-id="studio-propose-pack"
                    onClick={handleGenerateFromBrief}
                    disabled={isGeneratingFromBrief}
                    className="gap-2"
                  >
                    {isGeneratingFromBrief ? (
                      <>
                        <Sparkles className="h-4 w-4 animate-spin" />
                        Alfie analyse ton brief...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Proposer un pack avec Alfie
                      </>
                    )}
                  </Button>
                </Card>
              )}

              {/* Message d'erreur si la génération a échoué */}
              {briefGenerationError && (
                <Card className="p-4 bg-orange-50 border-orange-200 mb-4">
                  <p className="text-sm text-orange-800">{briefGenerationError}</p>
                  <Button
                    onClick={handleGenerateFromBrief}
                    variant="outline"
                    size="sm"
                    className="mt-3"
                  >
                    Réessayer
                  </Button>
                </Card>
              )}

              {pack.assets.length === 0 && !brief.trim() && (
                <div className="text-center py-8 text-muted-foreground">
                  <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Ajoute des visuels pour construire ton pack, ou charge un pack prédéfini à gauche ✨</p>
                </div>
              )}

              {pack.assets.length > 0 && (
                <>
                  {pack.title !== "Mon pack personnalisé" && (
                    <div className="mb-4 p-3 bg-muted/30 rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        Alfie prépare avec toi le pack : <strong>{pack.title}</strong>. Voici tout ce qu'il va créer pour ta marque 👇
                      </p>
                    </div>
                  )}
                  <div className="space-y-3">
                    {pack.assets.map((assetItem) => (
                      <PackAssetRow
                        key={assetItem.id}
                        asset={assetItem}
                        onDuplicate={duplicateAsset}
                        onDelete={deleteAsset}
                        onEdit={editAsset}
                      />
                    ))}
                  </div>
                </>
              )}
            </Card>

            {user && activeBrandId && (
              <>
                <OrderStatusList brandId={activeBrandId} userId={user.id} />
                {queueData && <QueueStatus data={queueData} />}
              </>
            )}
          </div>

          {/* Colonne 3 : Récap Woofs - Sticky bottom mobile */}
          <div className="lg:col-span-3 fixed bottom-0 left-0 right-0 p-3 bg-background border-t lg:relative lg:p-0 lg:border-0 z-30">
            <PackSummarySidebar
              data-tour-id="studio-woofs-recap"
              pack={pack}
              woofsAvailable={woofsAvailable}
              woofsQuota={woofsQuota}
              onLaunch={launchGeneration}
              isLaunching={isLaunching}
            />
          </div>
        </div>
      </div>
      
      {/* Help Launcher Button */}
      <div className="fixed bottom-20 right-4 z-50">
        <HelpLauncher />
      </div>
    </div>
    </TourProvider>
  );
}
