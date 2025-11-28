import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PackAsset } from "@/types/alfiePack";
import { Badge } from "@/components/ui/badge";
import { WOOF_COSTS } from "@/config/woofs";

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
];

export function AssetEditDialog({ asset, isOpen, onClose, onSave }: AssetEditDialogProps) {
  const [formData, setFormData] = useState<PackAsset>({ ...asset });

  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  const woofCost = WOOF_COSTS[formData.woofCostType];
  const totalCost = formData.kind === "carousel" ? woofCost * formData.count : woofCost;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier cet asset</DialogTitle>
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
                  newKind === "carousel" ? "carousel_slide" :
                  newKind === "video_basic" ? "video_basic" :
                  "video_premium";
                
                setFormData({ 
                  ...formData, 
                  kind: newKind,
                  woofCostType: newWoofCostType,
                  count: newKind === "carousel" ? (formData.count || 5) : 1,
                  durationSeconds: newKind.includes("video") ? (formData.durationSeconds || 10) : undefined
                });
              }}
            >
              <SelectTrigger id="kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="image">🖼️ Image</SelectItem>
                <SelectItem value="carousel">📊 Carrousel</SelectItem>
                <SelectItem value="video_basic">🎬 Vidéo standard</SelectItem>
                <SelectItem value="video_premium">✨ Vidéo premium (Veo 3.1)</SelectItem>
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
                onChange={(e) => setFormData({ ...formData, count: parseInt(e.target.value) || 1 })}
              />
            </div>
          )}

          {/* Duration (pour vidéos) */}
          {formData.kind.includes("video") && (
            <div className="space-y-2">
              <Label htmlFor="duration">Durée (secondes)</Label>
              <Input
                id="duration"
                type="number"
                min={5}
                max={60}
                value={formData.durationSeconds || 10}
                onChange={(e) => setFormData({ ...formData, durationSeconds: parseInt(e.target.value) || 10 })}
              />
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
