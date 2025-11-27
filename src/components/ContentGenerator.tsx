import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Image, Video, Download, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useBrandKit } from '@/hooks/useBrandKit';
import { useBrandQuota } from '@/hooks/useBrandQuota';

export function ContentGenerator() {
  const [prompt, setPrompt] = useState('');
  const [contentType, setContentType] = useState<'image' | 'video'>('image');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('1:1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  
  const { user } = useAuth();
  const { brandKit } = useBrandKit();
  const { quota, loading: quotaLoading, refresh: refreshQuota } = useBrandQuota();

  const downloadContent = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      window.URL.revokeObjectURL(blobUrl);
      toast.success('Contenu téléchargé ! 📥');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Erreur lors du téléchargement');
    }
  };

  const handleGenerate = async () => {
    if (!user) {
      toast.error('Connecte-toi pour générer du contenu');
      return;
    }

    if (!prompt.trim()) {
      toast.error('Décris ce que tu veux créer !');
      return;
    }

    // Check quota
    if (!quota.canGenerateImage && contentType === 'image') {
      toast.error(`🚨 Quota mensuel atteint (${quota.imagesUsed}/${quota.quotaImages}). Upgrade ton plan pour continuer !`);
      return;
    }

    if (!brandKit) {
      toast.warning('⚠️ Aucune marque sélectionnée. Le contenu sera généré sans Brand Kit.');
    }

    setIsGenerating(true);
    setGeneratedContent(null);

    try {
      const { data, error } = await supabase.functions.invoke('generate-content', {
        body: {
          type: contentType,
          prompt: prompt,
          brandKit: brandKit ? {
            id: brandKit.id,
            name: brandKit.name,
            palette: brandKit.palette,
            logo_url: brandKit.logo_url
          } : undefined,
          aspectRatio: aspectRatio
        },
      });

      if (error) throw error;

      if (data?.error) {
        if (data.code === 'quota_exceeded') {
          toast.error(`🚨 ${data.error}`);
          await refreshQuota();
          return;
        }
        
        if (data.status === 'not_implemented' || data.status === 'coming_soon') {
          toast.info(`🚧 ${data.error}`);
          return;
        }
        
        throw new Error(data.error);
      }

      if (data.contentUrl) {
        setGeneratedContent(data.contentUrl);
        await refreshQuota();
        toast.success(`${contentType === 'image' ? 'Image' : 'Vidéo'} générée avec succès ! ✨`);
      } else {
        throw new Error('Aucun contenu généré');
      }
    } catch (error: any) {
      console.error('Generation error:', error);
      const userFriendlyMessage = error.message?.includes('quota')
        ? '🚨 Quota insuffisant. Veuillez upgrader votre plan.'
        : error.message?.includes('auth')
        ? '🔒 Erreur d\'authentification. Veuillez vous reconnecter.'
        : error.message?.includes('network')
        ? '🌐 Erreur réseau. Vérifiez votre connexion.'
        : `❌ ${error.message || 'Erreur lors de la génération'}`;
      toast.error(userFriendlyMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="shadow-strong border-2 border-primary/20">
      <CardHeader className="border-b bg-gradient-subtle">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Générateur de Contenu IA
        </CardTitle>
        <CardDescription>
          Crée des visuels et vidéos pour tes réseaux sociaux avec l'IA
          {quota.brandId && (
            <div className="mt-2 text-sm font-medium text-primary">
              📊 Quota: {quota.imagesRemaining}/{quota.quotaImages} images restantes ce mois
            </div>
          )}
          {!quota.brandId && !quotaLoading && (
            <div className="mt-2 text-sm text-muted-foreground">
              ℹ️ Sélectionne une marque pour voir tes quotas
            </div>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <Tabs value={contentType} onValueChange={(v) => setContentType(v as 'image' | 'video')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="image" className="gap-2">
              <Image className="h-4 w-4" />
              Image
            </TabsTrigger>
            <TabsTrigger value="video" className="gap-2">
              <Video className="h-4 w-4" />
              Vidéo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="image" className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Que veux-tu créer ?</label>
              <Textarea
                placeholder="Ex: Une image Instagram avec un coucher de soleil sur la plage, ambiance relaxante..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Format</label>
              <Select value={aspectRatio} onValueChange={(v) => setAspectRatio(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1:1">Carré (1:1) - Instagram Post</SelectItem>
                  <SelectItem value="9:16">Vertical (9:16) - Story / Reels</SelectItem>
                  <SelectItem value="16:9">Horizontal (16:9) - YouTube</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {brandKit && (
              <div className="p-3 bg-accent/50 rounded-lg border border-accent">
                <p className="text-sm text-muted-foreground">
                  ✨ Utilise le Brand Kit <strong>{brandKit.name}</strong>
                </p>
              </div>
            )}

            <Button 
              onClick={handleGenerate} 
              disabled={isGenerating || !prompt.trim() || (!quota.canGenerateImage && contentType === 'image') || quotaLoading}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Génération en cours...
                </>
              ) : quotaLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Chargement...
                </>
              ) : !quota.canGenerateImage && contentType === 'image' ? (
                <>
                  ⚠️ Quota atteint ({quota.imagesUsed}/{quota.quotaImages})
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Générer l'image
                </>
              )}
            </Button>

            {generatedContent && (
              <div className="space-y-3 border rounded-lg p-4 bg-card">
                <img 
                  src={generatedContent} 
                  alt="Contenu généré"
                  className="w-full rounded-lg shadow-md"
                />
                <Button 
                  onClick={() => downloadContent(generatedContent, `alfie-image-${Date.now()}.png`)}
                  variant="outline"
                  className="w-full"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Télécharger l'image
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="video" className="space-y-4 mt-4">
            <div className="p-6 text-center space-y-4 bg-accent/20 rounded-lg border-2 border-dashed border-accent">
              <Video className="h-12 w-12 mx-auto text-muted-foreground" />
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">Génération vidéo bientôt disponible</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  La génération de vidéos sera ajoutée très prochainement ! 
                  En attendant, utilise l'onglet <strong>Studio</strong> pour créer des vidéos à partir d'images.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
