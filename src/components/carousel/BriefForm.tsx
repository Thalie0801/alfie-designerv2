import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, X, Sparkles } from "lucide-react";
import { CharacterCounter } from "./CharacterCounter";

export type AspectRatio = "1:1" | "4:5" | "9:16" | "16:9";
export type OutputKind = "image" | "carousel" | "video";

export interface BriefFormData {
  // contenu
  objective: string;
  audience: string;
  offer: string;
  proofs: string[];
  cta: string;
  tone: string;
  locale: string;

  // nouveau
  kind: OutputKind; // image | carousel | video
  aspect_ratio: AspectRatio; // obligatoire
  video_duration?: number; // si kind === 'video'
}

interface BriefFormProps {
  onSubmit: (brief: BriefFormData) => void;
  onCancel: () => void;
}

const TONES = [
  { value: "professional", label: "Sobre B2B" },
  { value: "energetic", label: "Énergique" },
  { value: "educational", label: "Pédagogique" },
  { value: "friendly", label: "Convivial" },
  { value: "luxury", label: "Premium/Luxe" },
  { value: "technical", label: "Technique" },
  { value: "custom", label: "Personnalisé" },
];

const LOCALES = [
  { value: "fr-FR", label: "🇫🇷 Français" },
  { value: "en-US", label: "🇺🇸 English" },
  { value: "es-ES", label: "🇪🇸 Español" },
  { value: "de-DE", label: "🇩🇪 Deutsch" },
  { value: "it-IT", label: "🇮🇹 Italiano" },
  { value: "pt-BR", label: "🇧🇷 Português" },
];

const ASPECTS: { value: AspectRatio; label: string }[] = [
  { value: "1:1", label: "1:1 — carré" },
  { value: "4:5", label: "4:5 — portrait feed" },
  { value: "9:16", label: "9:16 — story / reel" },
  { value: "16:9", label: "16:9 — paysage" },
];

const OUTPUTS: { value: OutputKind; label: string }[] = [
  { value: "image", label: "Image" },
  { value: "carousel", label: "Carrousel" },
  { value: "video", label: "Vidéo" },
];

// petit nettoyage anti-emoji/contrôles pour fiabiliser Cloudinary
function cleanText(s: string, max = 220) {
  if (!s) return "";
  let out = s.replace(/[\u0000-\u001F\u007F\u00A0\uFEFF]/g, "");
  try {
    out = out.replace(/\p{Extended_Pictographic}/gu, "");
  } catch {
    // emojis
    out = out.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "");
  }
  out = out.trim();
  return out.length > max ? out.slice(0, max).trim() : out;
}

export function BriefForm({ onSubmit, onCancel }: BriefFormProps) {
  const [formData, setFormData] = useState<BriefFormData>({
    objective: "",
    audience: "",
    offer: "",
    proofs: [],
    cta: "",
    tone: "professional",
    locale: "fr-FR",
    kind: "carousel",
    aspect_ratio: "4:5",
    video_duration: 8,
  });
  const [newProof, setNewProof] = useState("");
  const [customTone, setCustomTone] = useState("");

  const isValid = useMemo(() => {
    const okBasics =
      formData.objective.trim() &&
      formData.audience.trim() &&
      formData.offer.trim() &&
      formData.cta.trim() &&
      formData.objective.length <= 100 &&
      formData.audience.length <= 100 &&
      formData.offer.length <= 200 &&
      formData.cta.length <= 40;

    const okAspect = Boolean(formData.aspect_ratio);
    const okVideo =
      formData.kind !== "video" ||
      (formData.video_duration && formData.video_duration >= 3 && formData.video_duration <= 60);

    return Boolean(okBasics && okAspect && okVideo);
  }, [formData]);

  const addProof = () => {
    const v = newProof.trim();
    if (!v) return;
    if (formData.proofs.length >= 3) return;
    setFormData({ ...formData, proofs: [...formData.proofs, v] });
    setNewProof("");
  };

  const removeProof = (index: number) => {
    setFormData({ ...formData, proofs: formData.proofs.filter((_, i) => i !== index) });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    const cleaned: BriefFormData = {
      ...formData,
      objective: cleanText(formData.objective, 100),
      audience: cleanText(formData.audience, 100),
      offer: cleanText(formData.offer, 200),
      proofs: formData.proofs.map((p) => cleanText(p, 150)).slice(0, 3),
      cta: cleanText(formData.cta, 40),
      tone: formData.tone === "custom" ? cleanText(customTone, 60) || "custom" : formData.tone,
      // aspect + video_duration déjà ok
    };

    onSubmit(cleaned);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-2xl mx-auto p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Brief créatif</h2>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Annuler
          </Button>
          <Button type="submit" disabled={!isValid} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Générer
          </Button>
        </div>
      </div>

      {/* Bloc sortie + format */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sortie & Format</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Type de création *</Label>
            <Select
              value={formData.kind}
              onValueChange={(value: OutputKind) => setFormData({ ...formData, kind: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OUTPUTS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Format (aspect ratio) *</Label>
            <Select
              value={formData.aspect_ratio}
              onValueChange={(value: AspectRatio) => setFormData({ ...formData, aspect_ratio: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASPECTS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formData.kind === "video" && (
            <div className="space-y-2 sm:col-span-2">
              <Label>Durée vidéo (3–60s)</Label>
              <Input
                type="number"
                min={3}
                max={60}
                value={formData.video_duration ?? 8}
                onChange={(e) => setFormData({ ...formData, video_duration: Number(e.target.value || 8) })}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Infos essentielles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Informations essentielles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Objectif *</Label>
              <CharacterCounter current={formData.objective.length} max={100} />
            </div>
            <Input
              value={formData.objective}
              onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
              placeholder='Ex: "lancement", "promo -25%", "démo produit"'
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Audience *</Label>
              <CharacterCounter current={formData.audience.length} max={100} />
            </div>
            <Input
              value={formData.audience}
              onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
              placeholder='Ex: "PME B2B", "coachs bien-être", "développeurs"'
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Offre/Produit *</Label>
              <CharacterCounter current={formData.offer.length} max={200} />
            </div>
            <Textarea
              value={formData.offer}
              onChange={(e) => setFormData({ ...formData, offer: e.target.value })}
              placeholder="Décrivez votre offre en 1 phrase claire..."
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Preuves (1-3)</Label>
            {formData.proofs.length > 0 && (
              <div className="space-y-2">
                {formData.proofs.map((proof, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{idx + 1}.</span>
                    <Input value={proof} readOnly className="flex-1" />
                    <Button type="button" size="icon" variant="ghost" onClick={() => removeProof(idx)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {formData.proofs.length < 3 && (
              <div className="flex gap-2">
                <Input
                  value={newProof}
                  onChange={(e) => setNewProof(e.target.value)}
                  placeholder='Ex: "avis 5★", "1000+ clients", "Logo X autorisé"'
                  maxLength={150}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addProof();
                    }
                  }}
                />
                <Button type="button" size="icon" variant="outline" onClick={addProof}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Call-to-Action *</Label>
              <CharacterCounter current={formData.cta.length} max={40} />
            </div>
            <Input
              value={formData.cta}
              onChange={(e) => setFormData({ ...formData, cta: e.target.value })}
              placeholder='Ex: "Essayer", "Demander une démo"'
              required
            />
          </div>
        </CardContent>
      </Card>

      {/* Ton & langue */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Ton & Langue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Ton/Style *</Label>
            <Select value={formData.tone} onValueChange={(value) => setFormData({ ...formData, tone: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONES.map((tone) => (
                  <SelectItem key={tone.value} value={tone.value}>
                    {tone.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formData.tone === "custom" && (
            <div className="space-y-2">
              <Label>Décrivez votre ton</Label>
              <Input
                value={customTone}
                onChange={(e) => setCustomTone(e.target.value)}
                placeholder="Ex: Dynamique mais sérieux, avec une touche d'humour..."
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Langue *</Label>
            <Select value={formData.locale} onValueChange={(value) => setFormData({ ...formData, locale: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCALES.map((locale) => (
                  <SelectItem key={locale.value} value={locale.value}>
                    {locale.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
