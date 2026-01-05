import { useState, useMemo, useRef, useEffect } from "react";
import { X, Image, Film, Grid3x3, AlertCircle, Volume2, VolumeX, Upload, Pencil, Mic, Music } from "lucide-react";
import type { AlfiePack, PackAsset } from "@/types/alfiePack";
// Import removed - costBreakdown now calculated locally
import { getWoofCost } from "@/types/alfiePack";
import { sendPackToGenerator, InsufficientWoofsError } from "@/services/generatorFromChat";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// ✅ Voix ElevenLabs françaises disponibles
const FRENCH_VOICES = [
  { id: 'lily-fr', name: 'Lily', description: 'Féminine, douce' },
  { id: 'daniel-fr', name: 'Daniel', description: 'Masculin, pro' },
  { id: 'charlotte-fr', name: 'Charlotte', description: 'Féminine, énergique' },
  { id: 'thomas-fr', name: 'Thomas', description: 'Masculin, chaleureux' },
] as const;

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
  const [useBrandKit, setUseBrandKit] = useState(true);
  const [useLogo, setUseLogo] = useState(false); // ✅ NEW: Option logo
  const [brandLogoUrl, setBrandLogoUrl] = useState<string | null>(null); // ✅ NEW: Logo URL from brand
  const [colorMode, setColorMode] = useState<'vibrant' | 'pastel'>('vibrant');
  const [backgroundOnly, setBackgroundOnly] = useState(false); // ✅ Toggle fond seul (sans texte)
  const [visualStyle, setVisualStyle] = useState<'background' | 'character' | 'product'>(() => {
    // ✅ Auto-detect: prefer explicit AI hint, otherwise infer from pack content
    const firstAsset = pack.assets[0] as any;
    if (firstAsset?.visualStyleCategory) return firstAsset.visualStyleCategory;

    const hasProduct = pack.assets.some((a) => !!a.referenceImageUrl);
    if (hasProduct) return 'product';

    const hasCharacter = pack.assets.some(
      (a) =>
        /personnage|avatar|mascotte|character|pixar/i.test(a.prompt || '') ||
        (a as any)?.visualStyleCategory === 'character'
    );
    if (hasCharacter) return 'character';

    return 'background';
  });
  
  const [audioSettings, setAudioSettings] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    pack.assets.filter(a => a.kind === 'video_premium').forEach(a => {
      initial[a.id] = true;
    });
    return initial;
  });
  
  // ✅ ElevenLabs Audio Options
  const [useVoiceover, setUseVoiceover] = useState(false);
  const [useUnifiedMusic, setUseUnifiedMusic] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<string>('lily-fr');

  // ✅ Lip-Sync natif VEO 3.1
  const [useLipSync, setUseLipSync] = useState(false);
  
  // ✅ NEW: Pro Video Pipeline settings
  const [videoMode, setVideoMode] = useState<'voiceover' | 'lipsync'>('voiceover');
  const [musicVolume, setMusicVolume] = useState(15); // 0-30%
  const [duckingEnabled, setDuckingEnabled] = useState(true);

  // ✅ UX: si l’utilisateur active ElevenLabs (musique unifiée), on active aussi la voix-off par défaut
  // (sinon on obtient souvent “la même musique” sans narration, perçue comme un doublon)
  useEffect(() => {
    if (useUnifiedMusic && !useVoiceover) {
      setUseVoiceover(true);
    }
  }, [useUnifiedMusic, useVoiceover]);
  
  const [uploadingForId, setUploadingForId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const { profile } = useAuth();
  const navigate = useNavigate();
  
  // ✅ NEW: Fetch brand logo_url on mount
  useEffect(() => {
    if (!brandId) return;
    supabase
      .from("brands")
      .select("logo_url")
      .eq("id", brandId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.logo_url) {
          setBrandLogoUrl(data.logo_url);
        }
      });
  }, [brandId]);
  
  // ✅ Detect pack contents (use localAssets to include uploads)
  const hasProductImage = localAssets.some((a) => !!a.referenceImageUrl);
  const hasAnyCarousel = localAssets.some((a) => a.kind === 'carousel');
  // Toggle audio pour une vidéo spécifique
  const toggleAudio = (assetId: string) => {
    setAudioSettings(prev => ({
      ...prev,
      [assetId]: !prev[assetId]
    }));
  };

  // ✅ Upload d'image de référence pour vidéos/images
  const handleImageUpload = async (assetId: string, file: File) => {
    // ✅ Vérifier l'authentification avant l'upload
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      toast.error("Session expirée. Veuillez vous reconnecter.");
      return;
    }

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
  
  // ✅ Calcul détaillé par type d'asset
  const costBreakdown = useMemo(() => {
    const selectedAssets = localAssets.filter(a => selectedAssetIds.has(a.id));
    const images = selectedAssets.filter(a => a.kind === 'image').length;
    const carousels = selectedAssets.filter(a => a.kind === 'carousel').length;
    const videos = selectedAssets.filter(a => a.kind === 'video_premium').length;
    return {
      images,
      carousels,
      videos,
      imagesWoofs: images * 1,
      carouselsWoofs: carousels * 10,
      videosWoofs: videos * 25,
      total: images * 1 + carousels * 10 + videos * 25,
    };
  }, [localAssets, selectedAssetIds]);
  
  // Calculer le coût - carrousel = 10 Woofs fixe
  const totalWoofs = costBreakdown.total;

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
          visualStyleCategory: (asset as any).visualStyleCategory || visualStyle, // ✅ FIX: Propager visualStyle par asset
          woofCostType: asset.kind === 'carousel' ? 'carousel' as const : asset.woofCostType,
          withAudio: asset.kind === 'video_premium' ? audioSettings[asset.id] : undefined,
          // ✅ ElevenLabs Audio Options
          audioMode: asset.kind === 'video_premium' && (useVoiceover || useUnifiedMusic) ? 'elevenlabs' : 'veo',
          voiceId: asset.kind === 'video_premium' && useVoiceover ? selectedVoice : undefined,
          useVoiceover: asset.kind === 'video_premium' ? useVoiceover : undefined,
          useUnifiedMusic: asset.kind === 'video_premium' ? useUnifiedMusic : undefined,
          useLipSync: asset.kind === 'video_premium' ? useLipSync : undefined,
          // ✅ Pro Video Pipeline settings
          videoMode: asset.kind === 'video_premium' ? videoMode : undefined,
          musicVolume: asset.kind === 'video_premium' ? musicVolume : undefined,
          duckingEnabled: asset.kind === 'video_premium' ? duckingEnabled : undefined,
        }));
      } else if (textsError || !textsData?.texts) {
        console.warn("[PackPreparationModal] Text generation failed, using fallback texts:", textsError);
        
        // Générer des textes par défaut localement
        assetsWithTexts = localAssets.map((asset) => ({
          ...asset,
          useBrandKit,
          visualStyleCategory: (asset as any).visualStyleCategory || visualStyle, // ✅ FIX: Propager visualStyle par asset
          woofCostType: asset.kind === 'carousel' ? 'carousel' as const : asset.woofCostType,
          withAudio: asset.kind === 'video_premium' ? audioSettings[asset.id] : undefined,
          // ✅ ElevenLabs Audio Options
          audioMode: asset.kind === 'video_premium' && (useVoiceover || useUnifiedMusic) ? 'elevenlabs' : 'veo',
          voiceId: asset.kind === 'video_premium' && useVoiceover ? selectedVoice : undefined,
          useVoiceover: asset.kind === 'video_premium' ? useVoiceover : undefined,
          useUnifiedMusic: asset.kind === 'video_premium' ? useUnifiedMusic : undefined,
          useLipSync: asset.kind === 'video_premium' ? useLipSync : undefined,
          // ✅ Pro Video Pipeline settings
          videoMode: asset.kind === 'video_premium' ? videoMode : undefined,
          musicVolume: asset.kind === 'video_premium' ? musicVolume : undefined,
          duckingEnabled: asset.kind === 'video_premium' ? duckingEnabled : undefined,
          generatedTexts: generateFallbackTexts(asset, localPack.title),
        }));
        
        toast.warning("Textes générés localement. Tu peux les éditer dans le Studio.", { duration: 4000 });
      } else {
        console.log("[PackPreparationModal] ✅ Texts generated:", textsData);
        assetsWithTexts = localAssets.map((asset) => ({
          ...asset,
          useBrandKit,
          visualStyleCategory: (asset as any).visualStyleCategory || visualStyle, // ✅ FIX: Propager visualStyle par asset
          woofCostType: asset.kind === 'carousel' ? 'carousel' as const : asset.woofCostType,
          withAudio: asset.kind === 'video_premium' ? audioSettings[asset.id] : undefined,
          // ✅ ElevenLabs Audio Options
          audioMode: asset.kind === 'video_premium' && (useVoiceover || useUnifiedMusic) ? 'elevenlabs' : 'veo',
          voiceId: asset.kind === 'video_premium' && useVoiceover ? selectedVoice : undefined,
          useVoiceover: asset.kind === 'video_premium' ? useVoiceover : undefined,
          useUnifiedMusic: asset.kind === 'video_premium' ? useUnifiedMusic : undefined,
          useLipSync: asset.kind === 'video_premium' ? useLipSync : undefined,
          // ✅ Pro Video Pipeline settings
          videoMode: asset.kind === 'video_premium' ? videoMode : undefined,
          musicVolume: asset.kind === 'video_premium' ? musicVolume : undefined,
          duckingEnabled: asset.kind === 'video_premium' ? duckingEnabled : undefined,
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
        useLogo, // ✅ NEW: Option logo
        userPlan: profile.plan || 'starter',
        colorMode,
        visualStyle, // ✅ NEW: Style visuel adaptatif
        carouselMode: backgroundOnly ? 'background_only' : 'standard', // ✅ Toggle fond seul
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
            
            {/* ✅ Détail des coûts par type */}
            {selectedAssetIds.size > 0 && (
              <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-xs font-medium text-primary mb-2">📊 Estimation Woofs</p>
                <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                  {costBreakdown.images > 0 && (
                    <span>🖼️ {costBreakdown.images} image{costBreakdown.images > 1 ? 's' : ''} × 1 = {costBreakdown.imagesWoofs}</span>
                  )}
                  {costBreakdown.carousels > 0 && (
                    <span>📱 {costBreakdown.carousels} carrousel{costBreakdown.carousels > 1 ? 's' : ''} × 10 = {costBreakdown.carouselsWoofs}</span>
                  )}
                  {costBreakdown.videos > 0 && (
                    <span>🎬 {costBreakdown.videos} vidéo{costBreakdown.videos > 1 ? 's' : ''} × 25 = {costBreakdown.videosWoofs}</span>
                  )}
                </div>
                <div className="mt-2 pt-2 border-t border-primary/10 text-sm font-semibold text-primary">
                  🐶 Total : {totalWoofs} Woofs
                </div>
              </div>
            )}
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
                      
                      {/* ✅ Toggle audio pour les vidéos Veo 3.1 (musique générée automatiquement) */}
                      {asset.kind === 'video_premium' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleAudio(asset.id);
                          }}
                          className={`flex items-center gap-1.5 mt-2 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                            audioSettings[asset.id] 
                              ? 'bg-primary/20 text-primary border border-primary/30' 
                              : 'bg-muted text-muted-foreground border border-transparent'
                          }`}
                        >
                          {audioSettings[asset.id] ? (
                            <><Volume2 className="w-3.5 h-3.5" /> Musique auto 🎵</>
                          ) : (
                            <><VolumeX className="w-3.5 h-3.5" /> Sans audio</>
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

          {/* ✅ NEW: Chips compacts pour options (remplace les toggles) */}
          <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-lg">
            {/* Chip Brand Kit */}
            <button 
              type="button"
              onClick={() => setUseBrandKit(!useBrandKit)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                useBrandKit 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-background border border-border hover:bg-muted'
              }`}
            >
              🏢 Brand Kit {useBrandKit && '✓'}
            </button>
            
            {/* ✅ NEW: Chip Logo - visible uniquement si la marque a un logo */}
            {brandLogoUrl && (
              <button 
                type="button"
                onClick={() => setUseLogo(!useLogo)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                  useLogo 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-background border border-border hover:bg-muted'
                }`}
              >
                🖼️ Logo {useLogo && '✓'}
              </button>
            )}
            
            {/* Chip Coloré/Pastel */}
            <button 
              type="button"
              onClick={() => setColorMode(prev => prev === 'vibrant' ? 'pastel' : 'vibrant')}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-background border border-border hover:bg-muted transition-all flex items-center gap-1.5"
            >
              {colorMode === 'vibrant' ? '🌈 Coloré' : '🎀 Pastel'}
            </button>
            
            {/* ✅ NEW: Chip Fond seul (background_only) */}
            <button 
              type="button"
              onClick={() => setBackgroundOnly(!backgroundOnly)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                backgroundOnly 
                  ? 'bg-amber-500 text-white' 
                  : 'bg-background border border-border hover:bg-muted'
              }`}
            >
              🖼️ Fond seul {backgroundOnly && '✓'}
            </button>
            
            {/* Chip Style visuel - toujours visible s'il y a un carrousel (sinon l'utilisateur ne peut pas corriger) */}
            {hasAnyCarousel && (
              <button 
                type="button"
                onClick={() => setVisualStyle(prev => 
                  prev === 'background' ? 'character' : 
                  prev === 'character' ? 'product' : 'background'
                )}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-background border border-border hover:bg-muted transition-all flex items-center gap-1.5"
              >
                {visualStyle === 'background' && '🎨 Fond'}
                {visualStyle === 'character' && '🧑 Personnage'}
                {visualStyle === 'product' && '📦 Produit'}
              </button>
            )}
          </div>
          
          {/* ✅ Section Audio ElevenLabs - toujours visible */}
          {(() => {
            const hasVideoSelected = localAssets.some(a => a.kind === 'video_premium' && selectedAssetIds.has(a.id));
            const hasAnyVideo = localAssets.some(a => a.kind === 'video_premium');
            
            return (
              <div className={`p-3 rounded-lg space-y-3 border transition-all ${
                hasVideoSelected 
                  ? 'bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border-purple-200/50 dark:border-purple-800/50' 
                  : 'bg-muted/30 border-border/50 opacity-60'
              }`}>
                <h4 className="text-xs font-semibold flex items-center gap-2 text-purple-700 dark:text-purple-300">
                  <Music className="w-4 h-4" />
                  Audio des vidéos (ElevenLabs)
                  {!hasVideoSelected && (
                    <span className="text-muted-foreground font-normal ml-1">
                      {hasAnyVideo ? '— Sélectionne une vidéo pour activer' : '— Ajoute une vidéo au pack'}
                    </span>
                  )}
                </h4>
                
                <div className="flex flex-wrap gap-2">
                  {/* Chip Voix-off */}
                  <button
                    type="button"
                    onClick={() => hasVideoSelected && setUseVoiceover(!useVoiceover)}
                    disabled={!hasVideoSelected}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                      !hasVideoSelected 
                        ? 'bg-muted text-muted-foreground cursor-not-allowed'
                        : useVoiceover 
                        ? 'bg-purple-500 text-white' 
                        : 'bg-background border border-border hover:bg-muted'
                    }`}
                  >
                    <Mic className="w-3.5 h-3.5" />
                    Voix-off {useVoiceover && hasVideoSelected && '✓'}
                  </button>
                  
                  {/* Chip Musique unifiée */}
                  <button
                    type="button"
                    onClick={() => hasVideoSelected && setUseUnifiedMusic(!useUnifiedMusic)}
                    disabled={!hasVideoSelected}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                      !hasVideoSelected 
                        ? 'bg-muted text-muted-foreground cursor-not-allowed'
                        : useUnifiedMusic 
                        ? 'bg-pink-500 text-white' 
                        : 'bg-background border border-border hover:bg-muted'
                    }`}
                  >
                    <Music className="w-3.5 h-3.5" />
                    Musique unifiée {useUnifiedMusic && hasVideoSelected && '✓'}
                  </button>
                  
                  {/* ✅ Chip Lip-Sync natif VEO 3.1 */}
                  <button
                    type="button"
                    onClick={() => hasVideoSelected && setUseLipSync(!useLipSync)}
                    disabled={!hasVideoSelected}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                      !hasVideoSelected 
                        ? 'bg-muted text-muted-foreground cursor-not-allowed'
                        : useLipSync 
                        ? 'bg-emerald-500 text-white' 
                        : 'bg-background border border-border hover:bg-muted'
                    }`}
                  >
                    👄 Lip-Sync {useLipSync && hasVideoSelected && '✓'}
                  </button>
                  
                  {/* ✅ Toggle Mode: Lip-sync vs Voiceover */}
                  <button
                    type="button"
                    onClick={() => hasVideoSelected && setVideoMode(prev => prev === 'voiceover' ? 'lipsync' : 'voiceover')}
                    disabled={!hasVideoSelected}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                      !hasVideoSelected 
                        ? 'bg-muted text-muted-foreground cursor-not-allowed'
                        : videoMode === 'lipsync' 
                        ? 'bg-cyan-500 text-white' 
                        : 'bg-background border border-border hover:bg-muted'
                    }`}
                  >
                    {videoMode === 'lipsync' ? '🗣️ Lip-Sync natif' : '🎤 Voiceover'}
                  </button>
                  
                  {/* ✅ Toggle Ducking */}
                  <button
                    type="button"
                    onClick={() => hasVideoSelected && setDuckingEnabled(!duckingEnabled)}
                    disabled={!hasVideoSelected}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                      !hasVideoSelected 
                        ? 'bg-muted text-muted-foreground cursor-not-allowed'
                        : duckingEnabled 
                        ? 'bg-amber-500 text-white' 
                        : 'bg-background border border-border hover:bg-muted'
                    }`}
                  >
                    🔊 Ducking {duckingEnabled && hasVideoSelected && '✓'}
                  </button>
                </div>
                
                {/* ✅ Slider Volume Musique */}
                {hasVideoSelected && useUnifiedMusic && (
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground flex items-center justify-between">
                      <span>Volume musique :</span>
                      <span className="font-medium">{musicVolume}%</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="30"
                      value={musicVolume}
                      onChange={(e) => setMusicVolume(Number(e.target.value))}
                      className="w-full h-2 bg-pink-200 dark:bg-pink-800 rounded-lg appearance-none cursor-pointer accent-pink-500"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>0%</span>
                      <span>30%</span>
                    </div>
                  </div>
                )}
                
                {/* Sélecteur de voix si voix-off activée */}
                {useVoiceover && hasVideoSelected && (
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Choix de la voix :</label>
                    <div className="flex flex-wrap gap-1.5">
                      {FRENCH_VOICES.map((voice) => (
                        <button
                          key={voice.id}
                          type="button"
                          onClick={() => setSelectedVoice(voice.id)}
                          className={`px-2.5 py-1 rounded-full text-xs transition-all ${
                            selectedVoice === voice.id
                              ? 'bg-purple-500 text-white'
                              : 'bg-background border border-border hover:bg-muted'
                          }`}
                        >
                          {voice.name} <span className="opacity-70">({voice.description})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Info sur les options */}
                {hasVideoSelected && (useVoiceover || useUnifiedMusic) && (
                  <p className="text-xs text-purple-600 dark:text-purple-400">
                    {useVoiceover && useUnifiedMusic 
                      ? '🎙️ Voix-off du script + 🎵 musique de fond unifiée'
                      : useVoiceover 
                      ? '🎙️ Le script sera lu par une voix professionnelle'
                      : '🎵 Une musique d\'ambiance sera générée pour toutes les vidéos'}
                  </p>
                )}
              </div>
            );
          })()}

          {/* Warning si produit sans image */}
          {visualStyle === 'product' && !hasProductImage && (
            <p className="text-xs text-amber-600 dark:text-amber-400 px-3">
              💡 Ajoute une image de ton produit pour de meilleurs résultats
            </p>
          )}

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
            className="order-3 sm:order-1 px-4 py-3 sm:py-2 text-sm font-medium rounded-lg hover:bg-muted transition-colors touch-target"
            disabled={isGenerating}
          >
            Annuler
          </button>
          
          {/* Bouton Éditer dans le Studio */}
          <button
            onClick={() => {
              onClose();
              navigate("/studio", { 
                state: { 
                  pack: localPack, 
                  brief: pack.summary 
                } 
              });
            }}
            className="order-2 px-4 py-3 sm:py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors flex items-center justify-center gap-2 touch-target"
            disabled={isGenerating}
          >
            <Pencil className="w-4 h-4" />
            Éditer dans le Studio
          </button>
          
          <button
            onClick={handleGenerate}
            disabled={isGenerating || selectedAssetIds.size === 0}
            className="order-1 sm:order-3 px-4 py-3 sm:py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-target"
          >
            {isGenerating ? "Alfie prépare tes visuels..." : "Créer ce pack avec Alfie"}
          </button>
        </div>
      </div>
    </div>
  );
}
