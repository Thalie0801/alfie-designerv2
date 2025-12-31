import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Wand2, Copy, Check, Sparkles, ArrowRight, Lightbulb, AlertCircle, Film, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { usePromptOptimizer } from "@/hooks/usePromptOptimizer";
import { useBrandKit } from "@/hooks/useBrandKit";

const CONTENT_TYPES = [
  { value: "image", label: "🖼️ Image unique" },
  { value: "carousel", label: "📱 Carrousel" },
  { value: "video", label: "🎬 Vidéo (clip court)" },
  { value: "mini-film", label: "🎥 Mini-Film (multi-scènes)" },
];

const PLATFORMS = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "pinterest", label: "Pinterest" },
  { value: "youtube", label: "YouTube Shorts" },
];

type ContentType = "image" | "carousel" | "video" | "mini-film";
type Destination = "solo" | "multi";

export default function PromptOptimizer() {
  const navigate = useNavigate();
  const { optimize, isLoading, result, error, reset } = usePromptOptimizer();
  const { activeBrand } = useBrandKit();

  const [prompt, setPrompt] = useState("");
  const [contentType, setContentType] = useState<ContentType>("image");
  const [platform, setPlatform] = useState("instagram");
  const [useBrandKitToggle, setUseBrandKitToggle] = useState(true);
  const [copied, setCopied] = useState(false);
  const [destination, setDestination] = useState<Destination>("solo");

  // Force destination to "multi" when mini-film is selected
  useEffect(() => {
    if (contentType === "mini-film") {
      setDestination("multi");
    }
  }, [contentType]);

  const handleOptimize = async () => {
    if (!prompt.trim()) {
      toast.error("Écris d'abord une idée de visuel");
      return;
    }

    const platformPrompt = `Pour ${platform}: ${prompt}`;
    
    await optimize({
      prompt: platformPrompt,
      type: contentType,
      brandId: useBrandKitToggle && activeBrand?.id ? activeBrand.id : undefined,
    });
  };

  const handleCopy = async () => {
    if (result?.optimizedPrompt) {
      await navigator.clipboard.writeText(result.optimizedPrompt);
      setCopied(true);
      toast.success("Prompt copié !");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleGoToStudio = () => {
    const studioPath = destination === "multi" ? "/studio/multi" : "/studio";
    navigate(studioPath, { 
      state: { 
        prefillPrompt: result?.optimizedPrompt,
        contentType,
        scenes: result?.scenes, // For mini-film multi-scene data
      } 
    });
  };

  const handleReset = () => {
    reset();
    setPrompt("");
  };

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Wand2 className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Optimiseur de Prompts</h1>
        </div>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Transforme tes idées simples en prompts professionnels optimisés pour générer des visuels exceptionnels
        </p>
      </div>

      {/* Input Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Décris ton idée
          </CardTitle>
          <CardDescription>
            Écris simplement ce que tu veux créer, l'IA s'occupe du reste
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Textarea
            placeholder="Ex: Une image minimaliste pour promouvoir notre nouvelle offre coaching, avec texte 'Transforme ta vie' en overlay sur fond dégradé moderne..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[120px] text-base"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type de contenu</Label>
              <Select value={contentType} onValueChange={(v) => setContentType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Plateforme cible</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Destination Selector */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              Destination
              {contentType === "mini-film" && (
                <Badge variant="secondary" className="text-xs">Forcé Multi</Badge>
              )}
            </Label>
            <Select 
              value={destination} 
              onValueChange={(v) => setDestination(v as Destination)}
              disabled={contentType === "mini-film"}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="solo">
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="h-4 w-4" />
                    Studio Solo (génération simple)
                  </div>
                </SelectItem>
                <SelectItem value="multi">
                  <div className="flex items-center gap-2">
                    <Film className="h-4 w-4" />
                    Studio Multi (Films / Packs)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div>
              <p className="font-medium text-sm">Utiliser le Brand Kit</p>
              <p className="text-xs text-muted-foreground">
                {activeBrand ? `Applique le style de "${activeBrand.name}"` : "Aucune marque active"}
              </p>
            </div>
            <Switch 
              checked={useBrandKitToggle} 
              onCheckedChange={setUseBrandKitToggle}
              disabled={!activeBrand}
            />
          </div>

          <Button 
            onClick={handleOptimize} 
            disabled={isLoading || !prompt.trim()}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                Optimisation en cours...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4 mr-2" />
                Optimiser le prompt
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {result && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Prompt optimisé
              </CardTitle>
              <Badge variant="secondary">{result.estimatedGenerationTime}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Optimized Prompt */}
            <div className="relative">
              <pre className="whitespace-pre-wrap bg-background p-4 rounded-lg border text-sm leading-relaxed">
                {result.optimizedPrompt}
              </pre>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2"
                onClick={handleCopy}
              >
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>

            {/* Details Accordion */}
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="reasoning">
                <AccordionTrigger>💡 Raisonnement de l'IA</AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground">{result.reasoning}</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="negative">
                <AccordionTrigger>🚫 Prompt négatif</AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground font-mono">{result.negativePrompt}</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="details">
                <AccordionTrigger>📐 Détails techniques</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ratio suggéré</span>
                      <Badge variant="outline">{result.suggestedAspectRatio}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Temps estimé</span>
                      <span>{result.estimatedGenerationTime}</span>
                    </div>
                    {result.brandAlignment && (
                      <div className="pt-2 border-t">
                        <p className="text-muted-foreground mb-1">Alignement Brand Kit</p>
                        <p className="text-xs">{result.brandAlignment}</p>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleReset} className="flex-1">
                Recommencer
              </Button>
              <Button onClick={handleGoToStudio} className="flex-1">
                Générer dans le Studio
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
