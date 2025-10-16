import { useState, useRef } from 'react';
import { Sparkles, ImagePlus, Loader2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useBrandKit } from '@/hooks/useBrandKit';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAuthHeader } from '@/lib/auth';

interface GeneratedAsset {
  type: 'image' | 'video';
  url: string;
  prompt: string;
  format: string;
}

type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

export function ChatGenerator() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [generatedAsset, setGeneratedAsset] = useState<GeneratedAsset | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { brandKit } = useBrandKit();

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image valide');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image trop volumineuse (max 10MB)');
      return;
    }

    setUploadingImage(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Vous devez être connecté');
        return;
      }

      const fileName = `${user.id}/${Date.now()}-${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from('chat-uploads')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-uploads')
        .getPublicUrl(fileName);

      setUploadedImage(publicUrl);
      toast.success('Image ajoutée ! 📸');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Erreur lors de l\'upload');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() && !uploadedImage) {
      toast.error('Ajoutez un prompt ou une image');
      return;
    }

    setIsGenerating(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Vous devez être connecté');
        return;
      }

      // Si une image est uploadée, on fait une transformation d'image
      if (uploadedImage) {
        const { data, error } = await supabase.functions.invoke('alfie-generate-ai-image', {
          body: {
            templateImageUrl: uploadedImage,
            brandKit: brandKit,
            prompt: prompt || "Transform this image with a creative style"
          },
          headers: await getAuthHeader(),
        });

        if (error) throw error;
        
        if (!data?.imageUrl) {
          throw new Error("Aucune image générée");
        }

        setGeneratedAsset({
          type: 'image',
          url: data.imageUrl,
          prompt: prompt || "Image transformation",
          format: aspectRatio
        });

        // Stocker en DB dans media_generations (bibliothèque)
        await supabase.from('media_generations').insert({
          user_id: user.id,
          type: 'image',
          prompt: prompt || "Image transformation",
          input_url: uploadedImage,
          output_url: data.imageUrl,
          status: 'completed',
          brand_id: brandKit?.id || null,
          metadata: { aspectRatio }
        });

        toast.success('Image générée avec succès ! ✨');
      } else {
        // Sinon génération d'image depuis le texte
        const { data, error } = await supabase.functions.invoke('generate-ai-image', {
          body: {
            prompt: prompt,
            aspectRatio: aspectRatio
          },
          headers: await getAuthHeader(),
        });

        if (error) throw error;

        if (!data?.imageUrl) {
          throw new Error("Aucune image générée");
        }

        setGeneratedAsset({
          type: 'image',
          url: data.imageUrl,
          prompt: prompt,
          format: aspectRatio
        });

        // Stocker en DB dans media_generations (bibliothèque)
        await supabase.from('media_generations').insert({
          user_id: user.id,
          type: 'image',
          prompt: prompt,
          output_url: data.imageUrl,
          status: 'completed',
          brand_id: brandKit?.id || null,
          metadata: { aspectRatio }
        });

        toast.success('Image générée avec succès ! ✨');
      }
    } catch (error: any) {
      console.error('Generation error:', error);
      toast.error(error.message || 'Erreur lors de la génération');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!generatedAsset) return;
    
    const link = document.createElement('a');
    link.href = generatedAsset.url;
    link.download = `alfie-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Téléchargement lancé ! 📥');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12 space-y-4">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="relative">
              <Sparkles className="h-16 w-16 text-primary animate-pulse" />
              <div className="absolute inset-0 blur-xl bg-primary/20 animate-pulse"></div>
            </div>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
            ALFIE STUDIO
          </h1>
          <p className="text-muted-foreground text-lg">
            Créez des visuels époustouflants en quelques secondes
          </p>
        </div>

        {/* Main Content */}
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Generated Asset Preview */}
          {generatedAsset && (
            <div className="relative rounded-2xl overflow-hidden bg-card border border-border backdrop-blur-sm animate-fade-in">
              <div className={cn(
                "relative",
                generatedAsset.format === '1:1' && "aspect-square",
                generatedAsset.format === '16:9' && "aspect-video",
                generatedAsset.format === '9:16' && "aspect-[9/16]",
                generatedAsset.format === '4:3' && "aspect-[4/3]",
                generatedAsset.format === '3:4' && "aspect-[3/4]"
              )}>
                <img 
                  src={generatedAsset.url} 
                  alt={generatedAsset.prompt}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent"></div>
                <div className="absolute bottom-0 left-0 right-0 p-6 space-y-3">
                  <p className="text-sm text-muted-foreground">{generatedAsset.prompt}</p>
                  <p className="text-xs text-muted-foreground">Format: {generatedAsset.format}</p>
                  <Button
                    onClick={handleDownload}
                    className="w-full bg-primary hover:bg-primary/90"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Télécharger
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Input Section */}
          <div className="rounded-2xl bg-card border border-border backdrop-blur-sm p-6 space-y-6">
            {/* Uploaded Image Preview */}
            {uploadedImage && (
              <div className="relative rounded-xl overflow-hidden bg-muted/50 border border-border">
                <div className="flex items-center gap-4 p-4">
                  <img 
                    src={uploadedImage} 
                    alt="Image source" 
                    className="h-24 w-24 object-cover rounded-lg"
                  />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground mb-2">Image source ajoutée</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setUploadedImage(null)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      Retirer
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Format Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Format de l'image</label>
              <Select value={aspectRatio} onValueChange={(value) => setAspectRatio(value as AspectRatio)}>
                <SelectTrigger className="bg-muted/50 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1:1">Carré (1:1)</SelectItem>
                  <SelectItem value="16:9">Paysage (16:9)</SelectItem>
                  <SelectItem value="9:16">Portrait (9:16)</SelectItem>
                  <SelectItem value="4:3">Standard (4:3)</SelectItem>
                  <SelectItem value="3:4">Portrait (3:4)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Prompt Input */}
            <div className="relative">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Décrivez la scène que vous imaginez, ou uploadez une image pour la transformer..."
                className="min-h-[120px] bg-muted/50 border-border resize-none text-base"
                disabled={isGenerating}
              />
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="ghost"
                  size="sm"
                  disabled={uploadingImage || isGenerating}
                >
                  {uploadingImage ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ImagePlus className="h-4 w-4 mr-2" />
                  )}
                  Upload image
                </Button>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={isGenerating || (!prompt.trim() && !uploadedImage)}
                className={cn(
                  "bg-primary hover:bg-primary/90",
                  "font-semibold px-8",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Génération...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Générer
                  </>
                )}
              </Button>
            </div>

            {/* Info Text */}
            <div className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground text-center">
                Propulsé par Lovable AI • Gemini Nano Banana
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
