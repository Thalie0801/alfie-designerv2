/**
 * Campaigns - Page de création de packs campagne
 * Construit un JobSpecV1 et lance via job-orchestrator
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
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { createJob } from '@/lib/jobClient';
import type { JobSpecV1Type } from '@/types/jobSpec';
import { Loader2, Film, Image, Crop, FileArchive, Play } from 'lucide-react';

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

export default function Campaigns() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeBrand } = useBrandKit();
  
  const [loading, setLoading] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [script, setScript] = useState('');
  const [clipCount, setClipCount] = useState(3);
  const [durationPerClip, setDurationPerClip] = useState(8);
  const [ratioMaster, setRatioMaster] = useState<'9:16' | '1:1' | '16:9'>('9:16');
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
  
  // Options avancées
  const [voiceoverEnabled, setVoiceoverEnabled] = useState(true);
  const [safeZone, setSafeZone] = useState(false);

  const toggleDeliverable = (id: DeliverableId) => {
    setSelectedDeliverables(prev => 
      prev.includes(id) 
        ? prev.filter(d => d !== id)
        : [...prev, id]
    );
  };

  const calculateCost = () => {
    // Base cost for multi-clip video
    const videoCost = clipCount * 25; // 25 Woofs per clip
    // Additional costs for variants
    const variantCount = selectedDeliverables.filter(d => 
      d.startsWith('variant_') || d.startsWith('thumb_') || d === 'cover'
    ).length;
    const variantCost = variantCount * 2; // 2 Woofs per variant
    return videoCost + variantCost;
  };

  const handleSubmit = async () => {
    if (!user?.id || !activeBrand?.id) {
      toast.error('Veuillez vous connecter et sélectionner une marque');
      return;
    }

    if (!campaignName.trim()) {
      toast.error('Veuillez entrer un nom de campagne');
      return;
    }

    if (!script.trim()) {
      toast.error('Veuillez entrer un script ou description');
      return;
    }

    setLoading(true);

    try {
      const spec: JobSpecV1Type = {
        version: 'v1',
        kind: 'campaign_pack',
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
      
      toast.success('Pack campagne lancé !', {
        description: `Job ${result.jobId.slice(0, 8)}... créé avec ${result.steps.length} étapes`,
      });

      // Navigate to job console
      navigate(`/jobs/${result.jobId}`);
    } catch (err) {
      console.error('[Campaigns] Failed to create job:', err);
      toast.error('Erreur lors de la création du pack', {
        description: err instanceof Error ? err.message : 'Erreur inconnue',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Pack Campagne</h1>
        <p className="text-muted-foreground mt-2">
          Créez un pack complet avec vidéo multi-clips, variantes de formats et miniatures
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Configuration principale */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>Paramètres de base du pack</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="campaignName">Nom de la campagne</Label>
              <Input
                id="campaignName"
                placeholder="Ma super campagne"
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
                    {[1, 2, 3, 4, 5].map((n) => (
                      <SelectItem key={n} value={n.toString()}>
                        {n} clip{n > 1 ? 's' : ''}
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
              <Label>Format principal</Label>
              <Select 
                value={ratioMaster} 
                onValueChange={(v) => setRatioMaster(v as typeof ratioMaster)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="9:16">9:16 (Vertical - Reels/TikTok)</SelectItem>
                  <SelectItem value="1:1">1:1 (Carré - Feed)</SelectItem>
                  <SelectItem value="16:9">16:9 (Horizontal - YouTube)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Deliverables */}
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

      {/* Options avancées */}
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

      {/* Footer avec coût et bouton */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
        <div>
          <p className="font-medium">Coût estimé</p>
          <p className="text-2xl font-bold text-primary">{calculateCost()} Woofs</p>
          <p className="text-xs text-muted-foreground">
            {clipCount} clips × 25 + {selectedDeliverables.filter(d => d !== 'master_9x16' && d !== 'zip').length} variantes × 2
          </p>
        </div>
        <Button 
          size="lg" 
          onClick={handleSubmit}
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
              Lancer le pack
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
