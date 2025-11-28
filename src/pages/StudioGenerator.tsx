import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Sparkles, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useBrandKit } from "@/hooks/useBrandKit";
import { useAuth } from "@/hooks/useAuth";
import type { AlfiePack, PackAsset } from "@/types/alfiePack";
import { PackAssetRow } from "@/components/studio/PackAssetRow";
import { PackSummarySidebar } from "@/components/studio/PackSummarySidebar";
import { OrderStatusList } from "@/components/studio/OrderStatusList";
import { sendPackToGenerator, InsufficientWoofsError } from "@/services/generatorFromChat";
import { supabase } from "@/integrations/supabase/client";

// Packs prédéfinis
const PRESET_PACKS = {
  lancement: {
    title: "Pack de lancement",
    summary: "3 visuels + 1 carrousel pour annoncer ton lancement",
    assets: [
      {
        id: "launch_1",
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
    summary: "Kit complet pour une promo flash",
    assets: [
      {
        id: "promo_1",
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
        kind: "video_basic" as const,
        count: 1,
        platform: "instagram" as const,
        format: "reel" as const,
        ratio: "9:16" as const,
        durationSeconds: 10,
        title: "Reel promo dynamique",
        goal: "vente" as const,
        tone: "dynamique, percutant",
        prompt: "Vidéo courte pour promo avec timer urgence",
        woofCostType: "video_basic" as const,
      },
    ],
  },
};

export function StudioGenerator() {
  const { user } = useAuth();
  const { activeBrandId, activeBrand } = useBrandKit();
  const location = useLocation();
  const navigate = useNavigate();

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
    setPack(preset);
    setCampaignName(preset.title);
    toast.success(`Pack "${preset.title}" chargé !`);
  };

  const addAsset = (template?: Partial<PackAsset>) => {
    const newAsset: PackAsset = {
      id: `asset_${Date.now()}`,
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

  const launchGeneration = async () => {
    if (!user || !activeBrandId) {
      toast.error("Tu dois être connecté avec une marque active");
      return;
    }

    if (pack.assets.length === 0) {
      toast.error("Ajoute au moins un asset pour lancer la génération");
      return;
    }

    setIsLaunching(true);

    try {
      const result = await sendPackToGenerator({
        brandId: activeBrandId,
        pack,
        userId: user.id,
        selectedAssetIds: pack.assets.map((a) => a.id),
      });

      toast.success(`🎉 C'est parti ! ${result.orderIds.length} générations lancées`);
      
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
      if (error instanceof InsufficientWoofsError) {
        toast.error(error.message);
      } else {
        toast.error("Erreur lors du lancement de la génération");
        console.error("[Studio] Launch error:", error);
      }
    } finally {
      setIsLaunching(false);
    }
  };

  if (!activeBrandId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-6 text-center">
          <p className="text-muted-foreground">
            Sélectionne une marque pour utiliser le Studio
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 mr-0 lg:mr-[360px]">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Sparkles className="w-8 h-8 text-alfie-pink" />
            <h1 className="text-4xl font-bold">Studio Alfie</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Crée ton pack de visuels sur mesure 🎬
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Colonne 1 : Brief global */}
          <div className="lg:col-span-3 space-y-4">
            <Card className="p-4 space-y-4">
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

              <Separator />

              <div>
                <h3 className="font-semibold mb-2 text-sm">Brand Kit</h3>
                {activeBrand && (
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
              </div>
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
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Visuels de ta campagne ({pack.assets.length})</h3>
                <Button onClick={() => addAsset()} size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Ajouter un visuel
                </Button>
              </div>

              {pack.assets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Ajoute des visuels pour construire ton pack, ou charge un pack prédéfini à gauche ✨</p>
                </div>
              ) : (
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
              <OrderStatusList brandId={activeBrandId} userId={user.id} />
            )}
          </div>

          {/* Colonne 3 : Récap Woofs */}
          <div className="lg:col-span-3">
            <PackSummarySidebar
              pack={pack}
              woofsAvailable={woofsAvailable}
              woofsQuota={woofsQuota}
              onLaunch={launchGeneration}
              isLaunching={isLaunching}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
