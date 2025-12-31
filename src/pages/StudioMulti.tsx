/**
 * Studio Multi - Page de création pour contenus multi-éléments
 * Tab "Mini-Film" (vidéos multi-clips) et Tab "Pack Campagne" (images + carrousels + vidéos)
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useBrandKit } from '@/hooks/useBrandKit';
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
import { Loader2, Film, Image, Crop, FileArchive, Play, Clapperboard, Package } from 'lucide-react';

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
  const { user } = useAuth();
  const { activeBrand } = useBrandKit();
  
  const [activeTab, setActiveTab] = useState<'mini-film' | 'pack-campagne'>('mini-film');
  const [loading, setLoading] = useState(false);
  
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
  
  // Options avancées
  const [voiceoverEnabled, setVoiceoverEnabled] = useState(true);
  const [safeZone, setSafeZone] = useState(false);

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

  const calculateMiniFilmCost = () => {
    const videoCost = clipCount * 25;
    const variantCount = selectedDeliverables.filter(d => 
      d.startsWith('variant_') || d.startsWith('thumb_') || d === 'cover'
    ).length;
    const variantCost = variantCount * 2;
    return videoCost + variantCost;
  };

  const calculatePackCost = () => {
    const imageCost = imageCount * 1;
    const carouselCost = carouselCount * 10; // 10 Woofs par carrousel (aligné sur WOOF_COSTS)
    const videoCost = videoCount * 25; // 25 Woofs par vidéo
    return imageCost + carouselCost + videoCost;
  };

  const handleSubmitMiniFilm = async () => {
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
      const spec: JobSpecV1Type = {
        version: 'v1',
        kind: 'multi_clip_video',
        brandkit_id: activeBrand.id,
        ratio_master: ratioMaster,
        duration_total: clipCount * durationPerClip,
        clip_count: clipCount,
        script: script,
        visual_style: 'cinematic',
        deliverables: selectedDeliverables as JobSpecV1Type['deliverables'],
        locks: {
          palette_lock: true,
          light_mode: false,
          safe_zone: safeZone,
          identity_lock: true,
        },
        audio: {
          voiceover_enabled: voiceoverEnabled,
          music_volume_db: -20,
          sfx_enabled: false,
        },
        render: {
          fps: 30,
          thumbnails_timestamps: [1.0, Math.floor(clipCount * durationPerClip / 2), clipCount * durationPerClip - 2],
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
      const spec: JobSpecV1Type = {
        version: 'v1',
        kind: 'campaign_pack',
        brandkit_id: activeBrand.id,
        ratio_master: ratioMaster,
        script: script,
        visual_style: 'cinematic',
        image_count: imageCount,
        slides_count: carouselCount * 5, // ~5 slides par carousel
        clip_count: videoCount,
        deliverables: ['zip'] as JobSpecV1Type['deliverables'],
        locks: {
          palette_lock: true,
          light_mode: false,
          safe_zone: safeZone,
          identity_lock: true,
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
      <div className="flex items-center justify-between">
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

      {/* Packs prédéfinis */}
      <Card className="p-4">
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

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="mini-film" className="flex items-center gap-2">
            <Clapperboard className="h-4 w-4" />
            Mini-Film
          </TabsTrigger>
          <TabsTrigger value="pack-campagne" className="flex items-center gap-2">
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Livrables</CardTitle>
                <CardDescription>Sélectionnez les formats à générer</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {DELIVERABLE_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <div 
                      key={option.id}
                      className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted/50"
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
                  onCheckedChange={(checked) => setVoiceoverEnabled(checked === true)}
                />
                <Label htmlFor="voiceover">Voix-off automatique</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="safeZone"
                  checked={safeZone}
                  onCheckedChange={(checked) => setSafeZone(checked === true)}
                />
                <Label htmlFor="safeZone">Zone de sécurité (éviter les bords)</Label>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
            <div>
              <p className="font-medium">Coût estimé</p>
              <p className="text-2xl font-bold text-primary">{calculateMiniFilmCost()} Woofs</p>
              <p className="text-xs text-muted-foreground">
                {clipCount} clips × 25 + {selectedDeliverables.filter(d => d !== 'master_9x16' && d !== 'zip').length} variantes × 2
              </p>
            </div>
            <Button 
              size="lg" 
              onClick={handleSubmitMiniFilm}
              disabled={loading || !campaignName.trim() || !script.trim()}
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
    </div>
  );
}
