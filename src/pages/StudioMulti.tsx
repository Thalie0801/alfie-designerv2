/**
 * Studio Multi - Page de création pour contenus multi-éléments
 * Tab "Mini-Film" (vidéos multi-clips) et Tab "Pack Campagne" (images + carrousels + vidéos)
 */
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { MiniFilmScene } from '@/hooks/usePromptOptimizer';
import { useAuth } from '@/hooks/useAuth';
import { useBrandKit } from '@/hooks/useBrandKit';
import { useQueueMonitor } from '@/hooks/useQueueMonitor';
import { QueueStatus } from '@/components/chat/QueueStatus';
import { OrderStatusList } from '@/components/studio/OrderStatusList';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { createJob } from '@/lib/jobClient';
import type { JobSpecV1Type } from '@/types/jobSpec';
import type { Ratio } from '@/lib/types/alfie';
import { Loader2, Film, Image, Crop, FileArchive, Play, Clapperboard, Package, Palette, Paintbrush, User } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import type { VisualStyle } from '@/lib/types/vision';
import { VISUAL_STYLE_OPTIONS } from '@/lib/constants/visualStyles';
import { ReferenceImageUploader } from '@/components/studio/ReferenceImageUploader';
import { SubjectPackSelector } from '@/components/studio/SubjectPackSelector';

type Platform = "instagram" | "tiktok" | "linkedin" | "pinterest" | "youtube";

const PLATFORM_RATIOS: Record<Platform, Ratio[]> = {
  instagram: ["4:5", "1:1", "9:16", "16:9", "2:3", "yt-thumb"],
  tiktok: ["9:16", "4:5", "1:1", "16:9", "2:3", "yt-thumb"],
  linkedin: ["1:1", "16:9", "4:5", "9:16", "2:3", "yt-thumb"],
  pinterest: ["2:3", "4:5", "9:16", "1:1", "16:9", "yt-thumb"],
  youtube: ["16:9", "yt-thumb", "4:5", "1:1", "9:16", "2:3"],
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

const DELIVERABLE_OPTIONS = [
  { id: 'master_9x16', label: 'Master 9:16', icon: Film, description: 'Vidéo verticale principale' },
  { id: 'variant_1x1', label: 'Variante 1:1', icon: Crop, description: 'Format carré pour feed' },
  { id: 'variant_16x9', label: 'Variante 16:9', icon: Film, description: 'Format horizontal YouTube' },
  { id: 'thumb_1', label: 'Miniature 1', icon: Image, description: 'Thumbnail principale' },
  { id: 'thumb_2', label: 'Miniature 2', icon: Image, description: 'Thumbnail alternative' },
  { id: 'thumb_3', label: 'Miniature 3', icon: Image, description: 'Thumbnail alternative' },
  { id: 'cover', label: 'Couverture', icon: Image, description: 'Image de couverture' },
  { id: 'zip', label: 'Archive ZIP', icon: FileArchive, description: 'Téléchargement groupé' },
] as const;

type DeliverableId = typeof DELIVERABLE_OPTIONS[number]['id'];

export default function StudioMulti() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { activeBrand } = useBrandKit();
  const { data: queueData } = useQueueMonitor(!!user?.id && !!activeBrand?.id);

  // Pre-fill from Prompt Optimizer navigation
  useEffect(() => {
    const state = location.state as {
      prefillPrompt?: string;
      contentType?: 'mini-film' | 'carousel' | 'video' | 'image' | 'campaign-pack';
      scenes?: MiniFilmScene[];
      campaignPack?: { assets: Array<{ type: string; prompt: string }>; globalTheme: string };
      referenceImages?: string[];
      suggestedRatio?: string;
    } | null;
    
    if (!state) return;
    
    // Pre-fill script with optimized prompt
    if (state.prefillPrompt) {
      setScript(state.prefillPrompt);
    }
    
    // If Mini-Film scenes available, pre-fill clip count and duration
    if (state.scenes?.length) {
      setClipCount(state.scenes.length);
      const avgDuration = Math.round(
        state.scenes.reduce((sum, s) => sum + s.durationSec, 0) / state.scenes.length
      );
      if ([5, 8, 10].includes(avgDuration)) {
        setDurationPerClip(avgDuration);
      }
    }
    
    // ✅ NEW: Pre-fill from campaignPack
    if (state.campaignPack?.assets) {
      const pack = state.campaignPack;
      const images = pack.assets.filter(a => a.type === 'image');
      const carousels = pack.assets.filter(a => a.type === 'carousel');
      const videos = pack.assets.filter(a => a.type === 'video');
      
      setImageCount(Math.max(1, images.length));
      setCarouselCount(Math.max(0, carousels.length));
      setVideoCount(Math.max(0, videos.length));
      setActiveTab('pack-campagne');
      
      // Use global theme as script if no prefill
      if (!state.prefillPrompt && pack.globalTheme) {
        setScript(pack.globalTheme);
      }
    }
    
    // Pre-fill reference images
    if (state.referenceImages?.length) {
      setReferenceImages(state.referenceImages);
    }
    
    // Force Mini-Film tab if contentType is mini-film
    if (state.contentType === 'mini-film') {
      setActiveTab('mini-film');
    } else if (state.contentType === 'campaign-pack') {
      setActiveTab('pack-campagne');
    }
    
    // Apply suggested ratio if provided
    if (state.suggestedRatio) {
      setRatioMaster(state.suggestedRatio as Ratio);
    }
    
    // Clear state to prevent re-fill on navigation
    if (state.prefillPrompt || state.scenes || state.campaignPack || state.referenceImages?.length || state.suggestedRatio) {
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);
  
  const [activeTab, setActiveTab] = useState<'mini-film' | 'pack-campagne'>('mini-film');
  const [loading, setLoading] = useState(false);
  const [useBrandKitToggle, setUseBrandKitToggle] = useState(true);
  
  // Shared state
  const [campaignName, setCampaignName] = useState('');
  const [script, setScript] = useState('');
  const [platform, setPlatform] = useState<Platform>('instagram');
  const [ratioMaster, setRatioMaster] = useState<Ratio>('9:16');
  
  // Mini-Film specific
  const [clipCount, setClipCount] = useState(3);
  const [durationPerClip, setDurationPerClip] = useState(8);
  const [selectedDeliverables, setSelectedDeliverables] = useState<DeliverableId[]>([
    'master_9x16',
    'variant_1x1', 
    'variant_16x9',
    'thumb_1',
    'thumb_2',
    'thumb_3',
    'cover',
    'zip',
  ]);
  
  // Pack Campagne specific
  const [imageCount, setImageCount] = useState(3);
  const [carouselCount, setCarouselCount] = useState(1);
  const [videoCount, setVideoCount] = useState(1);
  
  // Style artistique
  const [visualStyle, setVisualStyle] = useState<VisualStyle>('cinematic_photorealistic');
  
  // Options avancées
  const [voiceoverEnabled, setVoiceoverEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [lipSyncEnabled, setLipSyncEnabled] = useState(false);
  const [safeZone, setSafeZone] = useState(false);
  const [transitionType, setTransitionType] = useState<'cut' | 'fade' | 'dissolve'>('fade');
  const [selectedVoice, setSelectedVoice] = useState<string>('daniel-fr');

  // Subject Pack
  const [useDefaultSubject, setUseDefaultSubject] = useState(true);
  const [selectedSubjectPackId, setSelectedSubjectPackId] = useState<string | null>(null);

  // Reference images (1-3)
  const [referenceImages, setReferenceImages] = useState<string[]>([]);

  // Update ratio when platform changes
  const handlePlatformChange = (newPlatform: Platform) => {
    setPlatform(newPlatform);
    const availableRatios = PLATFORM_RATIOS[newPlatform];
    if (!availableRatios.includes(ratioMaster)) {
      setRatioMaster(availableRatios[0]);
    }
  };

  const toggleDeliverable = (id: DeliverableId) => {
    setSelectedDeliverables(prev => 
      prev.includes(id) 
        ? prev.filter(d => d !== id)
        : [...prev, id]
    );
  };

  // Helper pour compter les variantes (utilisé dans le calcul ET l'affichage)
  const getVariantCount = () => {
    return selectedDeliverables.filter(d => 
      d.startsWith('variant_') || d.startsWith('thumb_') || d === 'cover'
    ).length;
  };

  // Helper pour lister les variantes cochées
  const getVariantLabels = () => {
    return selectedDeliverables
      .filter(d => d.startsWith('variant_') || d.startsWith('thumb_') || d === 'cover')
      .map(d => DELIVERABLE_OPTIONS.find(o => o.id === d)?.label || d);
  };

  const calculateMiniFilmCost = () => {
    const videoCost = clipCount * 25;
    const variantCost = getVariantCount() * 2;
    return videoCost + variantCost;
  };

  const calculatePackCost = () => {
    const imageCost = imageCount * 1;
    const carouselCost = carouselCount * 10;
    const videoCost = videoCount * 25;
    return imageCost + carouselCost + videoCost;
  };

  const handleSubmitMiniFilm = async () => {
    if (!user?.id || !activeBrand?.id) {
      toast.error('Veuillez vous connecter et sélectionner une marque');
      return;
    }

    // Validation avec messages précis
    if (!script.trim()) {
      toast.error('Script requis', { description: 'Ajoute un script ou une description pour ton mini-film' });
      return;
    }

    // Auto-remplir le nom si vide
    const finalCampaignName = campaignName.trim() || `Mini-film ${new Date().toLocaleDateString('fr-FR')}`;
    setCampaignName(finalCampaignName);

    setLoading(true);

    try {
      // Resolve effective subject pack
      const effectiveSubjectPackId = useDefaultSubject 
        ? (activeBrand as any)?.default_subject_pack_id || null
        : selectedSubjectPackId;

      const spec: JobSpecV1Type = {
        version: 'v1',
        kind: 'multi_clip_video',
        brandkit_id: activeBrand.id, // Always required for quota/tracking
        ratio_master: ratioMaster,
        duration_total: clipCount * durationPerClip,
        clip_count: clipCount,
        script: script,
        visual_style: visualStyle,
        deliverables: selectedDeliverables as JobSpecV1Type['deliverables'],
        use_brand_kit: useBrandKitToggle,
        reference_images: referenceImages.length > 0 ? referenceImages : undefined,
        campaign_name: finalCampaignName,
        subject_pack_id: effectiveSubjectPackId || undefined, // ✅ NEW: Subject Pack
        tags: ['studio_multi'],
        locks: {
          palette_lock: useBrandKitToggle,
          light_mode: false,
          safe_zone: safeZone,
          identity_lock: useBrandKitToggle,
        },
        audio: {
          voiceover_enabled: voiceoverEnabled,
          voice_id: selectedVoice,
          music_enabled: musicEnabled,
          lip_sync_enabled: lipSyncEnabled,
          music_volume_db: -20,
          sfx_enabled: false,
        },
        render: {
          fps: 30,
          thumbnails_timestamps: [1.0, Math.floor(clipCount * durationPerClip / 2), clipCount * durationPerClip - 2],
        },
        transitions: {
          type: transitionType,
        },
      };

      const result = await createJob(spec);
      
      toast.success('Mini-film lancé !', {
        description: `Job ${result.jobId.slice(0, 8)}... créé avec ${result.steps.length} étapes`,
      });

      navigate(`/jobs/${result.jobId}`);
    } catch (err) {
      console.error('[StudioMulti] Failed to create mini-film job:', err);
      toast.error('Erreur lors de la création', {
        description: err instanceof Error ? err.message : 'Erreur inconnue',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitPackCampagne = async () => {
    if (!user?.id || !activeBrand?.id) {
      toast.error('Veuillez vous connecter et sélectionner une marque');
      return;
    }

    if (!campaignName.trim() || !script.trim()) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    setLoading(true);

    try {
      // Resolve effective subject pack
      const effectiveSubjectPackId = useDefaultSubject 
        ? (activeBrand as any)?.default_subject_pack_id || null
        : selectedSubjectPackId;

      const spec: JobSpecV1Type = {
        version: 'v1',
        kind: 'campaign_pack',
        brandkit_id: activeBrand.id, // Always required for quota/tracking
        ratio_master: ratioMaster,
        script: script,
        visual_style: visualStyle,
        image_count: imageCount,
        carousel_count: carouselCount,     // ✅ NEW: Nombre de carrousels
        slides_per_carousel: 5,            // ✅ NEW: 5 slides par carrousel
        clip_count: videoCount,
        deliverables: ['zip'] as JobSpecV1Type['deliverables'],
        use_brand_kit: useBrandKitToggle,
        reference_images: referenceImages.length > 0 ? referenceImages : undefined,
        campaign_name: campaignName,
        subject_pack_id: effectiveSubjectPackId || undefined,
        tags: ['studio_multi'],
        locks: {
          palette_lock: useBrandKitToggle,
          light_mode: false,
          safe_zone: safeZone,
          identity_lock: useBrandKitToggle,
        },
      };

      const result = await createJob(spec);
      
      toast.success('Pack campagne lancé !', {
        description: `Job ${result.jobId.slice(0, 8)}... créé avec ${result.steps.length} étapes`,
      });

      navigate(`/jobs/${result.jobId}`);
    } catch (err) {
      console.error('[StudioMulti] Failed to create campaign pack job:', err);
      toast.error('Erreur lors de la création', {
        description: err instanceof Error ? err.message : 'Erreur inconnue',
      });
    } finally {
      setLoading(false);
    }
  };

  // Packs prédéfinis
  const loadPreset = (type: 'lancement' | 'evergreen' | 'promo') => {
    const presets = {
      lancement: { images: 4, carousels: 1, videos: 1, name: 'Pack Lancement' },
      evergreen: { images: 3, carousels: 2, videos: 0, name: 'Pack Evergreen' },
      promo: { images: 2, carousels: 0, videos: 1, name: 'Pack Promo Express' },
    };
    const preset = presets[type];
    setImageCount(preset.images);
    setCarouselCount(preset.carousels);
    setVideoCount(preset.videos);
    setCampaignName(preset.name);
    setActiveTab('pack-campagne');
    toast.success(`${preset.name} chargé !`);
  };

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div className="flex items-center justify-between" data-tour-id="studio-multi-header">
        <div>
          <h1 className="text-3xl font-bold">Studio Multi</h1>
          <p className="text-muted-foreground mt-2">
            Créez des contenus multi-éléments : mini-films ou packs campagne complets
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/studio')}
          className="text-xs text-muted-foreground"
        >
          ← Studio Solo
        </Button>
      </div>

      {/* Brand Kit Toggle */}
      <Card className="p-4" data-tour-id="studio-multi-brandkit">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Palette className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Utiliser le Brand Kit</p>
              <p className="text-xs text-muted-foreground">
                {activeBrand?.name || "Applique le style de ta marque"}
              </p>
            </div>
          </div>
          <Switch checked={useBrandKitToggle} onCheckedChange={setUseBrandKitToggle} />
        </div>
      </Card>

      {/* Subject Pack Selector - Always visible */}
      <Card className="p-4">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Subject / Personnage</p>
              <p className="text-xs text-muted-foreground">
                Sélectionne le personnage à utiliser
              </p>
            </div>
          </div>
          
          <SubjectPackSelector
            value={selectedSubjectPackId}
            onChange={(v) => {
              setUseDefaultSubject(false);
              setSelectedSubjectPackId(v);
            }}
            brandId={activeBrand?.id}
            placeholder="Choisir un Subject Pack"
            showDefaultOption={true}
          />
        </div>
      </Card>

      {/* Packs prédéfinis */}
      <Card className="p-4" data-tour-id="studio-multi-presets">
        <h3 className="font-semibold text-sm mb-3">📦 Packs prédéfinis</h3>
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadPreset('lancement')}
            className="flex flex-col h-auto py-3"
          >
            <span className="text-lg mb-1">🚀</span>
            <span className="text-xs font-medium">Lancement</span>
            <span className="text-[10px] text-muted-foreground">4 img + 1 car + 1 vid</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadPreset('evergreen')}
            className="flex flex-col h-auto py-3"
          >
            <span className="text-lg mb-1">🌲</span>
            <span className="text-xs font-medium">Evergreen</span>
            <span className="text-[10px] text-muted-foreground">3 img + 2 car</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadPreset('promo')}
            className="flex flex-col h-auto py-3"
          >
            <span className="text-lg mb-1">🔥</span>
            <span className="text-xs font-medium">Promo</span>
            <span className="text-[10px] text-muted-foreground">2 img + 1 vid</span>
          </Button>
        </div>
      </Card>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} data-tour-id="studio-multi-tabs">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="mini-film" className="flex items-center gap-2" data-tour-id="mini-film-tab">
            <Clapperboard className="h-4 w-4" />
            Mini-Film
          </TabsTrigger>
          <TabsTrigger value="pack-campagne" className="flex items-center gap-2" data-tour-id="pack-campaign-tab">
            <Package className="h-4 w-4" />
            Pack Campagne
          </TabsTrigger>
        </TabsList>

        {/* Mini-Film Tab */}
        <TabsContent value="mini-film" className="space-y-6 mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Configuration</CardTitle>
                <CardDescription>Paramètres du mini-film multi-clips</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="campaignName">Nom du projet</Label>
                  <Input
                    id="campaignName"
                    placeholder="Mon super mini-film"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="script">Script / Description</Label>
                  <Textarea
                    id="script"
                    placeholder="Décrivez le contenu de votre vidéo ou collez votre script..."
                    rows={4}
                    value={script}
                    onChange={(e) => setScript(e.target.value)}
                  />
                </div>

                {/* Reference Images */}
                <ReferenceImageUploader
                  images={referenceImages}
                  onImagesChange={setReferenceImages}
                  maxImages={3}
                />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nombre de clips</Label>
                    <Select 
                      value={clipCount.toString()} 
                      onValueChange={(v) => setClipCount(parseInt(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[2, 3, 4, 5, 6].map((n) => (
                          <SelectItem key={n} value={n.toString()}>
                            {n} clips
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Durée par clip</Label>
                    <Select 
                      value={durationPerClip.toString()} 
                      onValueChange={(v) => setDurationPerClip(parseInt(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 secondes</SelectItem>
                        <SelectItem value="8">8 secondes</SelectItem>
                        <SelectItem value="10">10 secondes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Plateforme</Label>
                  <Select 
                    value={platform} 
                    onValueChange={(v) => handlePlatformChange(v as Platform)}
                  >
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

                <div className="space-y-2">
                  <Label>Format principal</Label>
                  <Select 
                    value={ratioMaster} 
                    onValueChange={(v) => setRatioMaster(v as Ratio)}
                  >
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

                <div className="space-y-2">
                  <Label>Transitions entre clips</Label>
                  <Select 
                    value={transitionType} 
                    onValueChange={(v) => setTransitionType(v as 'cut' | 'fade' | 'dissolve')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cut">✂️ Coupe directe</SelectItem>
                      <SelectItem value="fade">🌑 Fondu (fade)</SelectItem>
                      <SelectItem value="dissolve">🔀 Fondu enchaîné (dissolve)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Fade recommandé pour un rendu professionnel
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Paintbrush className="w-4 h-4" />
                    Style artistique
                  </Label>
                  <Select 
                    value={visualStyle} 
                    onValueChange={(v) => setVisualStyle(v as VisualStyle)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VISUAL_STYLE_OPTIONS.map((style) => (
                        <SelectItem key={style.value} value={style.value}>
                          {style.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Livrables</CardTitle>
                <CardDescription>Sélectionnez les formats à générer</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground mb-3 p-2 bg-muted/30 rounded">
                💡 <strong>Variantes</strong> = formats recadrés + miniatures + couverture (×2 Woofs chacune). Master et ZIP ne comptent pas.
              </p>
              {DELIVERABLE_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const isVariant = option.id.startsWith('variant_') || option.id.startsWith('thumb_') || option.id === 'cover';
                  return (
                    <div 
                      key={option.id}
                      onClick={() => toggleDeliverable(option.id)}
                      className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        id={option.id}
                        checked={selectedDeliverables.includes(option.id)}
                        onCheckedChange={() => toggleDeliverable(option.id)}
                      />
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <Label htmlFor={option.id} className="cursor-pointer">
                          {option.label}
                          {isVariant && <span className="ml-1 text-xs text-primary">(+2)</span>}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {option.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Options avancées</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="voiceover"
                  checked={voiceoverEnabled}
                  disabled={lipSyncEnabled} // Disabled when lip-sync is active
                  onCheckedChange={(checked) => setVoiceoverEnabled(checked === true)}
                />
                <Label htmlFor="voiceover" className="flex flex-col">
                  <span>Voix-off ElevenLabs</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    {lipSyncEnabled ? 'Désactivé en mode Lip-Sync' : 'Voiceover professionnel superposé'}
                  </span>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="musicEnabled"
                  checked={musicEnabled}
                  onCheckedChange={(checked) => setMusicEnabled(checked === true)}
                />
                <Label htmlFor="musicEnabled">Musique de fond</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="lipSync"
                  checked={lipSyncEnabled}
                  onCheckedChange={(checked) => {
                    setLipSyncEnabled(checked === true);
                    // Lip-Sync uses VEO native voice, disable ElevenLabs voiceover
                    if (checked === true) {
                      setVoiceoverEnabled(false);
                    }
                  }}
                />
                <Label htmlFor="lipSync" className="flex flex-col">
                  <span>Lip-Sync VEO natif</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    Le personnage parle avec sa propre voix (synchronisé)
                  </span>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="safeZone"
                  checked={safeZone}
                  onCheckedChange={(checked) => setSafeZone(checked === true)}
                />
                <Label htmlFor="safeZone">Zone de sécurité</Label>
              </div>
              
              {/* Voice Selection */}
              <div className="w-full mt-2">
                <Label className="mb-2 block">Voix</Label>
                <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                  <SelectTrigger className="w-full sm:w-[280px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daniel-fr">🎙️ Daniel (Masculin, pro)</SelectItem>
                    <SelectItem value="lily-fr">🎤 Lily (Féminine, douce)</SelectItem>
                    <SelectItem value="charlotte-fr">💫 Charlotte (Féminine, énergique)</SelectItem>
                    <SelectItem value="thomas-fr">🗣️ Thomas (Masculin, chaleureux)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg bg-muted/50 border">
            <div>
              <p className="font-medium">Coût estimé</p>
              <p className="text-2xl font-bold text-primary">{calculateMiniFilmCost()} Woofs</p>
              <p className="text-xs text-muted-foreground">
                {clipCount} clips × 25
                {getVariantCount() > 0 && ` + ${getVariantCount()} variante${getVariantCount() > 1 ? 's' : ''} × 2`}
              </p>
              {getVariantCount() > 0 && (
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Inclus : {getVariantLabels().join(', ')}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 w-full sm:w-auto">
              <Button 
                size="lg" 
                onClick={handleSubmitMiniFilm}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Création...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Lancer le mini-film
                  </>
                )}
              </Button>
              {!script.trim() && (
                <p className="text-xs text-destructive">Ajoute un script pour lancer</p>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Pack Campagne Tab */}
        <TabsContent value="pack-campagne" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuration du Pack</CardTitle>
              <CardDescription>Créez un pack complet avec images, carrousels et vidéos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="packName">Nom de la campagne</Label>
                <Input
                  id="packName"
                  placeholder="Ma campagne marketing"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="packScript">Description / Brief</Label>
                <Textarea
                  id="packScript"
                  placeholder="Décrivez le thème de votre campagne, les messages clés..."
                  rows={4}
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                />
              </div>

              {/* Reference Images */}
              <ReferenceImageUploader
                images={referenceImages}
                onImagesChange={setReferenceImages}
                maxImages={3}
              />

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    Images
                  </Label>
                  <Select 
                    value={imageCount.toString()} 
                    onValueChange={(v) => setImageCount(parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                        <SelectItem key={n} value={n.toString()}>
                          {n} image{n > 1 ? 's' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Crop className="h-4 w-4" />
                    Carrousels
                  </Label>
                  <Select 
                    value={carouselCount.toString()} 
                    onValueChange={(v) => setCarouselCount(parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3].map((n) => (
                        <SelectItem key={n} value={n.toString()}>
                          {n} carrousel{n > 1 ? 's' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Film className="h-4 w-4" />
                    Vidéos
                  </Label>
                  <Select 
                    value={videoCount.toString()} 
                    onValueChange={(v) => setVideoCount(parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3].map((n) => (
                        <SelectItem key={n} value={n.toString()}>
                          {n} vidéo{n > 1 ? 's' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Plateforme</Label>
                <Select 
                  value={platform} 
                  onValueChange={(v) => handlePlatformChange(v as Platform)}
                >
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

              <div className="space-y-2">
                <Label>Format principal</Label>
                <Select 
                  value={ratioMaster} 
                  onValueChange={(v) => setRatioMaster(v as Ratio)}
                >
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

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Paintbrush className="w-4 h-4" />
                  Style artistique
                </Label>
                <Select 
                  value={visualStyle} 
                  onValueChange={(v) => setVisualStyle(v as VisualStyle)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VISUAL_STYLE_OPTIONS.map((style) => (
                      <SelectItem key={style.value} value={style.value}>
                        {style.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Options avancées</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="safeZonePack"
                  checked={safeZone}
                  onCheckedChange={(checked) => setSafeZone(checked === true)}
                />
                <Label htmlFor="safeZonePack">Zone de sécurité (éviter les bords)</Label>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
            <div>
              <p className="font-medium">Coût estimé</p>
              <p className="text-2xl font-bold text-primary">{calculatePackCost()} Woofs</p>
              <p className="text-xs text-muted-foreground">
                {imageCount > 0 && `${imageCount} images × 1`}
                {carouselCount > 0 && ` + ${carouselCount} carrousels × 10`}
                {videoCount > 0 && ` + ${videoCount} vidéos × 25`}
              </p>
            </div>
            <Button 
              size="lg" 
              onClick={handleSubmitPackCampagne}
              disabled={loading || !campaignName.trim() || !script.trim() || (imageCount === 0 && carouselCount === 0 && videoCount === 0)}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Lancer le pack
                </>
              )}
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Queue Status */}
      {user && activeBrand?.id && (
        <div className="space-y-4 mt-6">
          <OrderStatusList brandId={activeBrand.id} userId={user.id} />
          {queueData && <QueueStatus data={queueData} />}
        </div>
      )}
    </div>
  );
}
