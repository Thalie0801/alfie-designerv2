import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useAuth } from "@/hooks/useAuth";
import { useBrandKit } from "@/hooks/useBrandKit";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, Eraser, Expand, ImageOff, ZoomIn, Download, X } from "lucide-react";

type ToolType = 'inpainting' | 'outpainting' | 'remove-background' | 'upscale';

interface ToolResult {
  imageUrl: string;
  generationId?: string;
}

export default function AITools() {
  const { user } = useAuth();
  const { activeBrandId } = useBrandKit();
  
  const [activeTab, setActiveTab] = useState<ToolType>('inpainting');
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ToolResult | null>(null);
  
  // Inpainting state
  const [maskDescription, setMaskDescription] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  
  // Outpainting state
  const [direction, setDirection] = useState<'left' | 'right' | 'up' | 'down' | 'all'>('all');
  const [extendPrompt, setExtendPrompt] = useState("");
  
  // Upscale state
  const [scaleFactor, setScaleFactor] = useState<2 | 4>(2);

  // Reference image handler
  const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setReferenceImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Convert to base64 for preview and upload
    const reader = new FileReader();
    reader.onloadend = () => {
      setSourceImage(reader.result as string);
      setResult(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const handleProcess = async () => {
    if (!sourceImage || !user?.id) {
      toast.error("Veuillez d'abord uploader une image");
      return;
    }

    // Validate tool-specific requirements
    if (activeTab === 'inpainting' && (!maskDescription || !editPrompt)) {
      toast.error("Veuillez décrire la zone à modifier et le changement souhaité");
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const payload: Record<string, unknown> = {
        userId: user.id,
        brandId: activeBrandId,
        tool: activeTab,
        imageUrl: sourceImage,
      };

      // Add tool-specific params
      if (activeTab === 'inpainting') {
        payload.maskDescription = maskDescription;
        payload.editPrompt = editPrompt;
        if (referenceImage) payload.referenceImage = referenceImage;
      } else if (activeTab === 'outpainting') {
        payload.direction = direction;
        payload.extendPrompt = extendPrompt;
      } else if (activeTab === 'upscale') {
        payload.scaleFactor = scaleFactor;
      }

      const { data, error } = await supabase.functions.invoke('ai-image-tools', {
        body: payload,
      });

      if (error) throw new Error(error.message);
      
      // Handle rate limit error
      if (data?.code === 'RATE_LIMIT_EXCEEDED') {
        toast.error(data.error || "Limite quotidienne atteinte (10/jour)");
        return;
      }
      
      if (data?.error) throw new Error(data.error);

      setResult({
        imageUrl: data.imageUrl,
        generationId: data.generationId,
      });
      
      // Show success with remaining uses
      const remainingMsg = data.remaining_today !== undefined 
        ? ` (${data.remaining_today} restantes aujourd'hui)`
        : '';
      toast.success(`Image traitée avec succès !${remainingMsg}`);
    } catch (err) {
      console.error("AI Tools error:", err);
      toast.error(err instanceof Error ? err.message : "Erreur lors du traitement");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result?.imageUrl) return;
    
    const link = document.createElement('a');
    link.href = result.imageUrl;
    link.download = `alfie-${activeTab}-${Date.now()}.png`;
    link.click();
  };

  const clearAll = () => {
    setSourceImage(null);
    setResult(null);
    setMaskDescription("");
    setEditPrompt("");
    setReferenceImage(null);
    setExtendPrompt("");
  };

  const toolInfo = {
    inpainting: {
      title: "Retouche locale",
      description: "Modifier une zone spécifique de l'image",
      icon: Eraser,
    },
    outpainting: {
      title: "Extension",
      description: "Étendre l'image au-delà de ses bordures",
      icon: Expand,
    },
    'remove-background': {
      title: "Suppression de fond",
      description: "Retirer l'arrière-plan automatiquement",
      icon: ImageOff,
    },
    upscale: {
      title: "Amélioration",
      description: "Augmenter la résolution et les détails",
      icon: ZoomIn,
    },
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Outils IA</h1>
        <p className="text-muted-foreground">
          Retouchez, étendez et améliorez vos images avec l'IA
          <span className="ml-2 text-xs bg-secondary px-2 py-0.5 rounded-full">
            Gratuit • 10/jour
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Controls */}
        <div className="space-y-6">
          {/* Upload Zone */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Image source
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!sourceImage ? (
                <div
                  {...getRootProps()}
                  className={`
                    border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                    transition-colors
                    ${isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
                  `}
                >
                  <input {...getInputProps()} />
                  <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {isDragActive 
                      ? "Déposez l'image ici..." 
                      : "Glissez une image ou cliquez pour sélectionner"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    PNG, JPG, WEBP • Max 10 MB
                  </p>
                </div>
              ) : (
                <div className="relative">
                  <img 
                    src={sourceImage} 
                    alt="Source" 
                    className="w-full rounded-lg max-h-64 object-contain bg-muted"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={clearAll}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tool Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Outil</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ToolType)}>
                <TabsList className="grid grid-cols-4 w-full">
                  {Object.entries(toolInfo).map(([key, info]) => (
                    <TabsTrigger key={key} value={key} className="flex items-center gap-1">
                      <info.icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{info.title.split(' ')[0]}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="inpainting" className="space-y-4 mt-4">
                  {/* Reference image for product swap */}
                  <div className="space-y-2">
                    <Label>Image de référence (optionnel)</Label>
                    <p className="text-xs text-muted-foreground">
                      Produit ou objet à insérer à la place de la zone masquée
                    </p>
                    {!referenceImage ? (
                      <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-4 cursor-pointer hover:border-primary/50 transition-colors">
                        <Upload className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Uploader une image</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleReferenceUpload}
                          className="hidden"
                        />
                      </label>
                    ) : (
                      <div className="relative inline-block">
                        <img src={referenceImage} alt="Référence" className="h-20 rounded border" />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6"
                          onClick={() => setReferenceImage(null)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Zone à remplacer</Label>
                    <Input
                      placeholder="Ex: les pots de produits au centre, le logo..."
                      value={maskDescription}
                      onChange={(e) => setMaskDescription(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Instructions {referenceImage ? "(optionnel)" : ""}</Label>
                    <Input
                      placeholder={referenceImage 
                        ? "Ex: intégrer naturellement, même éclairage..."
                        : "Ex: un coucher de soleil, une couleur bleue..."
                      }
                      value={editPrompt}
                      onChange={(e) => setEditPrompt(e.target.value)}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="outpainting" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Direction d'extension</Label>
                    <Select value={direction} onValueChange={(v) => setDirection(v as typeof direction)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Toutes directions</SelectItem>
                        <SelectItem value="left">Gauche</SelectItem>
                        <SelectItem value="right">Droite</SelectItem>
                        <SelectItem value="up">Haut</SelectItem>
                        <SelectItem value="down">Bas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Contenu à ajouter (optionnel)</Label>
                    <Input
                      placeholder="Ex: continuer la plage, ajouter des montagnes..."
                      value={extendPrompt}
                      onChange={(e) => setExtendPrompt(e.target.value)}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="remove-background" className="mt-4">
                  <p className="text-sm text-muted-foreground">
                    L'IA détectera automatiquement le sujet principal et supprimera l'arrière-plan.
                  </p>
                </TabsContent>

                <TabsContent value="upscale" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Facteur d'agrandissement</Label>
                    <Select 
                      value={String(scaleFactor)} 
                      onValueChange={(v) => setScaleFactor(Number(v) as 2 | 4)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2x (Double)</SelectItem>
                        <SelectItem value="4">4x (Quadruple)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>
              </Tabs>

              <Button
                className="w-full mt-6"
                onClick={handleProcess}
                disabled={!sourceImage || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Traitement en cours...
                  </>
                ) : (
                  <>
                    {(() => {
                      const Icon = toolInfo[activeTab].icon;
                      return Icon ? <Icon className="h-4 w-4 mr-2" /> : null;
                    })()}
                    {toolInfo[activeTab].title}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right: Result */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Résultat</CardTitle>
            <CardDescription>
              {result ? "Image traitée" : "Le résultat apparaîtra ici"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="space-y-4">
                <img 
                  src={result.imageUrl} 
                  alt="Result" 
                  className="w-full rounded-lg max-h-96 object-contain bg-muted"
                />
                <Button onClick={handleDownload} className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Télécharger
                </Button>
              </div>
            ) : (
              <div className="border-2 border-dashed rounded-lg p-12 text-center">
                <div className="text-muted-foreground">
                  {isLoading ? (
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="h-12 w-12 animate-spin" />
                      <p>L'IA travaille sur votre image...</p>
                    </div>
                  ) : (
                    <>
                      <ImageOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Uploadez une image et choisissez un outil</p>
                    </>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
