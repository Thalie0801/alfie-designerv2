import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PackAsset } from "@/types/alfiePack";
import { Badge } from "@/components/ui/badge";
import { WOOF_COSTS } from "@/config/woofs";
import { Upload, X as XIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AssetEditDialogProps {
  asset: PackAsset;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedAsset: PackAsset) => void;
}

const GOAL_OPTIONS = [
  { value: "engagement", label: "Engagement" },
  { value: "vente", label: "Vente" },
  { value: "education", label: "Éducation" },
  { value: "notoriety", label: "Notoriété" },
];

const TONE_OPTIONS = [
  { value: "friendly", label: "Friendly" },
  { value: "professional", label: "Professionnel" },
  { value: "enthusiastic", label: "Enthousiaste" },
  { value: "educational", label: "Pédagogique" },
  { value: "persuasive", label: "Persuasif" },
  { value: "inspiring", label: "Inspirant" },
];

const PLATFORM_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "facebook", label: "Facebook" },
  { value: "youtube", label: "YouTube" },
  { value: "pinterest", label: "Pinterest" },
];

const RATIO_OPTIONS = [
  { value: "1:1", label: "1:1 (Carré)" },
  { value: "4:5", label: "4:5 (Portrait)" },
  { value: "9:16", label: "9:16 (Story/Reel)" },
  { value: "16:9", label: "16:9 (Paysage)" },
  { value: "2:3", label: "📌 2:3 (Pinterest)" },
  { value: "yt-thumb", label: "🎬 YT Thumb (1280×720)" },
];

const VISUAL_STYLE_OPTIONS = [
  { value: "photorealistic", label: "📷 Photoréaliste" },
  { value: "cinematic_photorealistic", label: "🎬 Cinématique" },
  { value: "3d_pixar_style", label: "🎨 3D Pixar" },
  { value: "flat_illustration", label: "✏️ Illustration flat" },
  { value: "minimalist_vector", label: "⚪ Vecteur minimaliste" },
  { value: "digital_painting", label: "🖌️ Peinture digitale" },
  { value: "comic_book", label: "💥 Comic book" },
];

export function AssetEditDialog({ asset, isOpen, onClose, onSave }: AssetEditDialogProps) {
  const [formData, setFormData] = useState<PackAsset>({ ...asset });
  
  // ✅ Re-sync formData quand l'asset change
  useEffect(() => {
    setFormData({ ...asset });
  }, [asset.id, asset.kind, asset.count]);
  const [uploading, setUploading] = useState(false);

  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // ✅ Vérifier l'authentification avant l'upload
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      toast.error("Session expirée. Veuillez vous reconnecter.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Seules les images sont acceptées");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("L'image ne doit pas dépasser 5 MB");
      return;
    }

    setUploading(true);
    try {
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const { data, error } = await supabase.storage
        .from("chat-uploads")
        .upload(`references/${fileName}`, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("chat-uploads")
        .getPublicUrl(data.path);

      setFormData({ ...formData, referenceImageUrl: urlData.publicUrl });
      toast.success("Image de référence ajoutée !");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Erreur lors de l'upload");
    } finally {
      setUploading(false);
    }
  };

  // Carrousels = coût fixe de 10 Woofs, sinon utiliser la map
  const totalCost = formData.kind === "carousel" ? 10 : (WOOF_COSTS[formData.woofCostType as keyof typeof WOOF_COSTS] || 1);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier cet asset</DialogTitle>
          <DialogDescription>
            Modifie les paramètres de cet asset avant génération
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Type d'asset */}
          <div className="space-y-2">
            <Label htmlFor="kind">Type de visuel</Label>
            <Select
              value={formData.kind}
              onValueChange={(value) => {
                const newKind = value as PackAsset["kind"];
                const newWoofCostType = 
                  newKind === "image" ? "image" :
                  newKind === "carousel" ? "carousel" :
                  "video_premium";
                
                const fixedDuration = newKind === "video_premium" ? 6 : undefined;
                setFormData({ 
                  ...formData, 
                  kind: newKind,
                  woofCostType: newWoofCostType,
                  count: newKind === "carousel" ? 5 : 1, // Carrousels = toujours 5 slides
                  durationSeconds: fixedDuration
                });
              }}
            >
              <SelectTrigger id="kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="image">🖼️ Image</SelectItem>
                <SelectItem value="carousel">📊 Carrousel</SelectItem>
                <SelectItem value="video_premium">✨ Asset vidéo (6s)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Titre */}
          <div className="space-y-2">
            <Label htmlFor="title">Titre de l'asset</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ex: Visuel d'annonce"
            />
          </div>

          {/* Goal (Objectif) */}
          <div className="space-y-2">
            <Label htmlFor="goal">Objectif</Label>
            <Select
              value={formData.goal}
              onValueChange={(value) => setFormData({ ...formData, goal: value as any })}
            >
              <SelectTrigger id="goal">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GOAL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tone */}
          <div className="space-y-2">
            <Label htmlFor="tone">Ton / Style</Label>
            <Input
              id="tone"
              value={formData.tone}
              onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
              placeholder="Ex: friendly, professionnel, dynamique"
            />
            <div className="flex flex-wrap gap-1">
              {TONE_OPTIONS.map((option) => (
                <Badge
                  key={option.value}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                  onClick={() => setFormData({ ...formData, tone: option.value })}
                >
                  {option.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Platform */}
          <div className="space-y-2">
            <Label htmlFor="platform">Plateforme</Label>
            <Select
              value={formData.platform}
              onValueChange={(value) => setFormData({ ...formData, platform: value as any })}
            >
              <SelectTrigger id="platform">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORM_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Ratio */}
          <div className="space-y-2">
            <Label htmlFor="ratio">Format</Label>
            <Select
              value={formData.ratio}
              onValueChange={(value) => setFormData({ ...formData, ratio: value as any })}
            >
              <SelectTrigger id="ratio">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RATIO_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Visual Style */}
          <div className="space-y-2">
            <Label htmlFor="visualStyle">Style visuel</Label>
            <Select
              value={formData.visualStyle || "photorealistic"}
              onValueChange={(value) => setFormData({ ...formData, visualStyle: value as any })}
            >
              <SelectTrigger id="visualStyle">
                <SelectValue placeholder="Choisir un style" />
              </SelectTrigger>
              <SelectContent>
                {VISUAL_STYLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Le style visuel influence l'esthétique des images générées.
            </p>
          </div>

          {/* Carousel Type (Citations vs Contenu) */}
          {formData.kind === "carousel" && (
            <div className="space-y-2">
              <Label>Type de carrousel</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, carouselType: 'content' })}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    (formData.carouselType || 'content') === 'content'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/50 hover:bg-muted border-border'
                  }`}
                >
                  📝 Conseils / Astuces
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, carouselType: 'citations' })}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    formData.carouselType === 'citations'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/50 hover:bg-muted border-border'
                  }`}
                >
                  💬 Citations
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {formData.carouselType === 'citations' 
                  ? "Chaque slide affiche une citation + nom de l'auteur uniquement"
                  : "Structure complète: Hook → Contenu → CTA"
                }
              </p>
            </div>
          )}

          {/* Carousel Mode (Standard vs Premium) */}
          {/* Note: Les carrousels sont maintenant disponibles uniquement via le Chat Alfie */}
          {formData.kind === "carousel" && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                📱 <strong>Carrousel (5 slides)</strong> — Coût fixe : 10 Woofs
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Alfie génère 5 images de fond + les textes affichés dans le chat.
              </p>
            </div>
          )}

          {/* Count (pour carrousels) */}
          {formData.kind === "carousel" && (
            <div className="space-y-2">
              <Label htmlFor="count">Nombre de slides</Label>
              <Input
                id="count"
                type="number"
                min={2}
                max={10}
                value={formData.count}
                onChange={(e) => {
                  const newCount = Math.max(2, Math.min(10, parseInt(e.target.value) || 5));
                  const currentSlides = formData.generatedTexts?.slides || [];
                  let newSlides = [...currentSlides];
                  
                  // Ajouter des slides vides si on augmente
                  while (newSlides.length < newCount) {
                    newSlides.push({ title: "", subtitle: "", body: "", bullets: [] });
                  }
                  // Retirer des slides si on diminue
                  if (newSlides.length > newCount) {
                    newSlides = newSlides.slice(0, newCount);
                  }
                  
                  setFormData({ 
                    ...formData, 
                    count: newCount,
                    generatedTexts: {
                      ...formData.generatedTexts,
                      slides: newSlides,
                    },
                  });
                }}
              />
            </div>
          )}

          {/* Duration (pour vidéos uniquement) - FIXE */}
          {formData.kind === "video_premium" && (
            <div className="space-y-2">
              <Label>Durée</Label>
              <div className="text-sm text-muted-foreground bg-muted/30 px-3 py-2 rounded-md border">
                6 secondes (fixe)
              </div>
              <p className="text-xs text-muted-foreground">
                Les assets vidéo sont fixés à 6s. Pour une vidéo longue, ajoute plusieurs assets.
              </p>
            </div>
          )}

          {/* Prompt IA */}
          <div className="space-y-2">
            <Label htmlFor="prompt">Prompt IA</Label>
            <Textarea
              id="prompt"
              value={formData.prompt}
              onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
              placeholder="Décris précisément ce que tu veux qu'Alfie génère..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Plus ton prompt est précis, meilleures seront les générations d'Alfie.
            </p>
          </div>

          {/* Image de référence - pour images, carrousels et vidéos premium */}
          {(formData.kind === "image" || formData.kind === "carousel" || formData.kind === "video_premium") && (
            <div className="space-y-2 border rounded-lg p-3">
              <div>
                <Label className="flex items-center gap-1">
                  Image source {formData.kind === "video_premium" ? "(recommandée)" : "(optionnelle)"}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {formData.kind === "video_premium" 
                    ? "L'image sera animée par l'IA pour créer ta vidéo. Recommandée pour de meilleurs résultats."
                    : "Alfie s'en sert comme inspiration visuelle."}
                </p>
              </div>

              {formData.referenceImageUrl ? (
                <div className="relative">
                  <img
                    src={formData.referenceImageUrl}
                    alt="Image de référence"
                    className="w-full h-40 object-cover rounded-lg border"
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    className="absolute top-2 right-2"
                    onClick={() => setFormData({ ...formData, referenceImageUrl: undefined })}
                  >
                    <XIcon className="h-4 w-4 mr-1" />
                    Retirer
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploading}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full pointer-events-none"
                    disabled={uploading}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploading ? "Upload en cours..." : "Ajouter une image source"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Generated texts section */}
          {formData.generatedTexts && (
            <div className="border-t pt-4 space-y-3">
              <Label className="text-base">Textes générés par Alfie</Label>
              
              {/* For carousels: simple message - texts are AI generated */}
              {formData.kind === "carousel" && (
                <div className="bg-muted/50 px-4 py-3 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    📝 Les textes de chaque slide ({formData.count} slides) seront générés automatiquement par Alfie en fonction de ton brief.
                  </p>
                </div>
              )}

              {/* For images: show title, body, cta */}
              {formData.generatedTexts?.text && (
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs">Titre</Label>
                    <Input
                      value={formData.generatedTexts.text.title || ""}
                      onChange={(e) => {
                        const currentTexts = formData.generatedTexts;
                        if (!currentTexts?.text) return;
                        setFormData({
                          ...formData,
                          generatedTexts: {
                            ...currentTexts,
                            text: { 
                              ...currentTexts.text, 
                              title: e.target.value 
                            },
                          },
                        });
                      }}
                      placeholder="Titre du visuel"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Texte principal</Label>
                    <Textarea
                      value={formData.generatedTexts.text.body || ""}
                      onChange={(e) => {
                        const currentTexts = formData.generatedTexts;
                        if (!currentTexts?.text) return;
                        setFormData({
                          ...formData,
                          generatedTexts: {
                            ...currentTexts,
                            text: { 
                              ...currentTexts.text, 
                              body: e.target.value 
                            },
                          },
                        });
                      }}
                      placeholder="Texte du visuel"
                      rows={3}
                    />
                  </div>
                  {formData.generatedTexts.text.cta !== undefined && (
                    <div>
                      <Label className="text-xs">Call-to-action</Label>
                      <Input
                        value={formData.generatedTexts.text.cta || ""}
                        onChange={(e) => {
                          const currentTexts = formData.generatedTexts;
                          if (!currentTexts?.text) return;
                          setFormData({
                            ...formData,
                            generatedTexts: {
                              ...currentTexts,
                              text: { 
                                ...currentTexts.text, 
                                cta: e.target.value 
                              },
                            },
                          });
                        }}
                        placeholder="CTA (optionnel)"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* For videos: show hook, script, cta */}
              {formData.generatedTexts?.video && (
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs">Hook (accroche)</Label>
                    <Input
                      value={formData.generatedTexts.video.hook || ""}
                      onChange={(e) => {
                        const currentTexts = formData.generatedTexts;
                        if (!currentTexts?.video) return;
                        setFormData({
                          ...formData,
                          generatedTexts: {
                            ...currentTexts,
                            video: { 
                              ...currentTexts.video, 
                              hook: e.target.value 
                            },
                          },
                        });
                      }}
                      placeholder="Phrase d'accroche"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Script</Label>
                    <Textarea
                      value={formData.generatedTexts.video.script || ""}
                      onChange={(e) => {
                        const currentTexts = formData.generatedTexts;
                        if (!currentTexts?.video) return;
                        setFormData({
                          ...formData,
                          generatedTexts: {
                            ...currentTexts,
                            video: { 
                              ...currentTexts.video, 
                              script: e.target.value 
                            },
                          },
                        });
                      }}
                      placeholder="Script de la vidéo"
                      rows={4}
                    />
                  </div>
                  {formData.generatedTexts.video.cta !== undefined && (
                    <div>
                      <Label className="text-xs">Call-to-action final</Label>
                      <Input
                        value={formData.generatedTexts.video.cta || ""}
                        onChange={(e) => {
                          const currentTexts = formData.generatedTexts;
                          if (!currentTexts?.video) return;
                          setFormData({
                            ...formData,
                            generatedTexts: {
                              ...currentTexts,
                              video: { 
                                ...currentTexts.video, 
                                cta: e.target.value 
                              },
                            },
                          });
                        }}
                        placeholder="CTA final (optionnel)"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Coût Woofs */}
          <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
            <p className="text-sm">
              <strong>Coût de cet asset :</strong> {totalCost} 🐾 Woofs
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={handleSave}>
            Enregistrer les modifications
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
