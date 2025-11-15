import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Loader2, Image as ImageIcon, FileImage, Video } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type MediaType = "image" | "carousel" | "video";
type AspectRatio = "1:1" | "9:16" | "4:5";

interface StudioGeneratorProps {
  activeBrandId: string | null;
}

interface MediaGeneration {
  id: string;
  type: string;
  output_url: string;
  thumbnail_url: string | null;
  created_at: string;
}

export function StudioGenerator({ activeBrandId }: StudioGeneratorProps) {
  const [mediaType, setMediaType] = useState<MediaType>("image");
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("4:5");
  const [quantity, setQuantity] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAssets, setGeneratedAssets] = useState<MediaGeneration[]>([]);

  const handleGenerate = async () => {
    if (!activeBrandId) {
      toast.error("Sélectionne d'abord une marque");
      return;
    }

    if (!prompt.trim()) {
      toast.error("Écris un prompt pour ta création");
      return;
    }

    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke("studio-generate", {
        body: {
          type: mediaType,
          prompt: prompt.trim(),
          brandId: activeBrandId,
          aspectRatio,
          quantity: mediaType === "carousel" ? quantity : 1,
          duration: mediaType === "video" ? 15 : undefined,
        },
      });

      if (error) {
        if (error.message.includes("402")) {
          toast.error("Crédits AI insuffisants. Ajoute des crédits dans Settings → Usage");
        } else if (error.message.includes("429")) {
          toast.error("Rate limit atteint. Attends quelques secondes et réessaye");
        } else {
          throw error;
        }
        return;
      }

      if (!data?.ok || !data?.resourceId) {
        throw new Error("Pas de resourceId retourné");
      }

      toast.success("Génération lancée !");

      // Subscribe to real-time updates for the generated asset
      const channel = supabase
        .channel(`media-${data.resourceId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "media_generations",
            filter: `id=eq.${data.resourceId}`,
          },
          (payload) => {
            if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
              const asset = payload.new as MediaGeneration;
              if (asset.output_url) {
                setGeneratedAssets((prev) => {
                  const exists = prev.find((a) => a.id === asset.id);
                  if (exists) {
                    return prev.map((a) => (a.id === asset.id ? asset : a));
                  }
                  return [...prev, asset];
                });
                toast.success("Asset prêt !");
              }
            }
          }
        )
        .subscribe();

      // Cleanup subscription after 2 minutes
      setTimeout(() => {
        channel.unsubscribe();
      }, 120000);
    } catch (err) {
      console.error("Erreur génération:", err);
      toast.error(err instanceof Error ? err.message : "Erreur de génération");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Studio Alfie</h1>
        <p className="text-muted-foreground">
          Crée des images, carousels et vidéos pour tes réseaux sociaux
        </p>
      </div>

      {!activeBrandId && (
        <Card className="p-4 bg-yellow-50 border-yellow-200">
          <p className="text-sm text-yellow-800">
            ⚠️ Sélectionne une marque pour commencer à générer
          </p>
        </Card>
      )}

      <Card className="p-6 space-y-6">
        <div>
          <label className="text-sm font-medium mb-2 block">Type de média</label>
          <div className="grid grid-cols-3 gap-3">
            <Button
              variant={mediaType === "image" ? "default" : "outline"}
              onClick={() => setMediaType("image")}
              className="h-auto flex-col gap-2 py-4"
            >
              <ImageIcon className="h-6 w-6" />
              <span>Image</span>
            </Button>
            <Button
              variant={mediaType === "carousel" ? "default" : "outline"}
              onClick={() => setMediaType("carousel")}
              className="h-auto flex-col gap-2 py-4"
            >
              <FileImage className="h-6 w-6" />
              <span>Carousel</span>
            </Button>
            <Button
              variant={mediaType === "video" ? "default" : "outline"}
              onClick={() => setMediaType("video")}
              className="h-auto flex-col gap-2 py-4"
            >
              <Video className="h-6 w-6" />
              <span>Vidéo</span>
            </Button>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Format</label>
          <div className="grid grid-cols-3 gap-3">
            <Button
              variant={aspectRatio === "1:1" ? "default" : "outline"}
              onClick={() => setAspectRatio("1:1")}
              size="sm"
            >
              1:1 (Carré)
            </Button>
            <Button
              variant={aspectRatio === "9:16" ? "default" : "outline"}
              onClick={() => setAspectRatio("9:16")}
              size="sm"
            >
              9:16 (Story)
            </Button>
            <Button
              variant={aspectRatio === "4:5" ? "default" : "outline"}
              onClick={() => setAspectRatio("4:5")}
              size="sm"
            >
              4:5 (Post)
            </Button>
          </div>
        </div>

        <div>
          <label htmlFor="prompt" className="text-sm font-medium mb-2 block">
            Prompt
          </label>
          <Textarea
            id="prompt"
            placeholder="Un chat dans l'espace qui flotte parmi les étoiles..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            className="resize-none"
          />
        </div>

        {mediaType === "carousel" && (
          <div>
            <label htmlFor="quantity" className="text-sm font-medium mb-2 block">
              Nombre de slides: {quantity}
            </label>
            <input
              id="quantity"
              type="range"
              min={3}
              max={10}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full"
            />
          </div>
        )}

        {mediaType === "video" && (
          <div className="text-sm text-muted-foreground">
            Durée: 15 secondes (format optimisé pour TikTok/Reels)
          </div>
        )}

        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !activeBrandId || !prompt.trim()}
          className="w-full"
          size="lg"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Génération en cours...
            </>
          ) : (
            "🪄 Générer"
          )}
        </Button>
      </Card>

      {generatedAssets.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Résultats</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {generatedAssets.map((asset) => (
              <Card key={asset.id} className="overflow-hidden">
                <img
                  src={asset.thumbnail_url || asset.output_url}
                  alt="Generated asset"
                  className="w-full aspect-square object-cover"
                />
                <div className="p-3 space-y-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => window.open(asset.output_url, "_blank")}
                  >
                    Télécharger
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
