import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Image, Video, Download, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useBrandKit } from '@/hooks/useBrandKit';
import { useAlfieCredits } from '@/hooks/useAlfieCredits';

export function ContentGenerator() {
  const [prompt, setPrompt] = useState('');
  const [contentType, setContentType] = useState<'image' | 'video'>('image');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('1:1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  
  const { brandKit } = useBrandKit();
  const { decrementCredits, hasCredits } = useAlfieCredits();

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
    if (!prompt.trim()) {
      toast.error('Décris ce que tu veux créer !');
      return;
    }

    const creditCost = contentType === 'image' ? 1 : 3;
    
    if (!hasCredits(creditCost)) {
      toast.error(`Il te faut ${creditCost} crédits pour générer ${contentType === 'image' ? 'une image' : 'une vidéo'}`);
      return;
    }

    setIsGenerating(true);
    setGeneratedContent(null);

    try {
      const { data, error } = await supabase.functions.invoke('generate-content', {
        body: {
          type: contentType,
          prompt: prompt,
          brandKit: brandKit,
          aspectRatio: aspectRatio
        },
      });

      if (error) throw error;

      if (data.contentUrl) {
        setGeneratedContent(data.contentUrl);
        await decrementCredits(creditCost, contentType === 'image' ? 'image_generation' : 'video_generation');
        toast.success(`${contentType === 'image' ? 'Image' : 'Vidéo'} générée avec succès ! ✨`);
      } else if (data.status === 'coming_soon') {
        toast.info(data.error);
      } else {
        throw new Error(data.error || 'Erreur de génération');
      }
    } catch (error: any) {
      console.error('Generation error:', error);
      toast.error(error.message || 'Erreur lors de la génération');
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
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <Tabs value={contentType} onValueChange={(v) => setContentType(v as 'image' | 'video')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="image" className="gap-2">
              <Image className="h-4 w-4" />
              Image (1 crédit)
            </TabsTrigger>
            <TabsTrigger value="video" className="gap-2">
              <Video className="h-4 w-4" />
              Vidéo VEO3 (3 crédits)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="image" className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Format</label>
              <Select value={aspectRatio} onValueChange={(v: any) => setAspectRatio(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1:1">Carré 1:1 (Instagram Post)</SelectItem>
                  <SelectItem value="9:16">Vertical 9:16 (Stories, Reels)</SelectItem>
                  <SelectItem value="16:9">Horizontal 16:9 (YouTube)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Décris ton visuel</label>
              <Textarea
                placeholder="Ex: Une affiche moderne pour promouvoir mon nouveau produit, style minimaliste, couleurs vives..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
              />
            </div>

            <Button 
              onClick={handleGenerate} 
              disabled={isGenerating || !prompt.trim()}
              className="w-full gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Génération en cours...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Générer l'image
                </>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="video" className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg border">
              <p className="text-sm text-muted-foreground">
                🎥 <strong>Génération vidéo VEO3</strong> sera bientôt disponible ! 
                Cette fonctionnalité permettra de créer des vidéos de 5-8 secondes optimisées pour les réseaux sociaux.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Format vidéo</label>
              <Select value={aspectRatio} onValueChange={(v: any) => setAspectRatio(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="9:16">Vertical 9:16 (TikTok, Reels, Stories)</SelectItem>
                  <SelectItem value="16:9">Horizontal 16:9 (YouTube)</SelectItem>
                  <SelectItem value="1:1">Carré 1:1 (Feed)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Décris ta vidéo</label>
              <Textarea
                placeholder="Ex: Une animation de produit qui tourne sur fond coloré, transition fluide, ambiance dynamique..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
              />
            </div>

            <Button 
              onClick={handleGenerate} 
              disabled={true}
              className="w-full gap-2"
            >
              <Video className="h-4 w-4" />
              Bientôt disponible
            </Button>
          </TabsContent>
        </Tabs>

        {/* Résultat généré */}
        {generatedContent && (
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Contenu généré</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const filename = `alfie-${contentType}-${Date.now()}.${contentType === 'image' ? 'png' : 'mp4'}`;
                  downloadContent(generatedContent, filename);
                }}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Télécharger
              </Button>
            </div>
            
            {contentType === 'image' ? (
              <img 
                src={generatedContent} 
                alt="Contenu généré"
                className="w-full rounded-lg border shadow-md"
              />
            ) : (
              <video 
                src={generatedContent}
                controls
                className="w-full rounded-lg border shadow-md"
              />
            )}
          </div>
        )}

        {brandKit && (
          <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded">
            ✨ Ton Brand Kit sera appliqué automatiquement
          </div>
        )}
      </CardContent>
    </Card>
  );
}