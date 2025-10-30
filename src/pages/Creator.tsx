import { useState } from "react";
import { AccessGuard } from "@/components/AccessGuard";
import { AeditusCard } from "@/components/AeditusCard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useBrandKit, BrandKit } from "@/hooks/useBrandKit";

type Mode = "image" | "video";

type Artifact = { 
  kind: "image" | "video"; 
  uri: string; 
  meta?: { 
    index?: number; 
    resolution?: string; 
    brandId?: string | null; 
    brandName?: string | null;
    overlay?: boolean;
    duration?: number;
    fps?: number;
  } 
};

const RESOLUTIONS = [
  { label: "Carré (1080x1080)", value: "1080x1080" },
  { label: "Vertical (1080x1350)", value: "1080x1350" },
  { label: "Story (1080x1920)", value: "1080x1920" },
  { label: "Paysage (1920x1080)", value: "1920x1080" },
  { label: "Ultra HD (3840x2160)", value: "3840x2160" }
] as const;

function parseWH(res: string): { w: number; h: number } {
  const m = res.match(/^(\d+)\s*x\s*(\d+)$/i);
  if (!m) return { w: 1080, h: 1350 };
  const w = Math.max(1, parseInt(m[1], 10));
  const h = Math.max(1, parseInt(m[2], 10));
  return { w, h };
}

function buildBrandAwarePrompt(userPrompt: string, brand?: BrandKit | null): string {
  if (!brand) return userPrompt?.trim() || "";

  let paletteStr = "";
  const pal = brand.palette as any;
  if (Array.isArray(pal)) {
    paletteStr = `primary ${pal[0] ?? "auto"}, accents ${pal.slice(1).filter(Boolean).join(", ") || "—"}`;
  } else if (pal && typeof pal === "object") {
    const accents = Array.isArray(pal.accents) ? pal.accents.filter(Boolean).join(", ") : "—";
    paletteStr = `primary ${pal.primary ?? "auto"}, secondary ${pal.secondary ?? "auto"}, accents ${accents}`;
  } else {
    paletteStr = "auto";
  }

  const fontsStr = brand.fonts
    ? `headings ${brand.fonts.primary || "sans-serif"}, body ${brand.fonts.secondary || "sans-serif"}`
    : "cohérentes à la marque";

  return [
    userPrompt?.trim() || "",
    `--- Brand Guidelines ---`,
    `Brand: ${brand.name || "Non spécifiée"}`,
    `Colors → ${paletteStr}`,
    `Tone: ${brand.voice || "cohérent à la marque"}`,
    `Typography vibe: ${fontsStr}`,
    `Avoid: low contrast, off-brand colors, generic stock vibes`,
  ].join("\n");
}

export default function Creator() {
  const { toast } = useToast();
  const { brands, activeBrandId, setActiveBrand, brandKit } = useBrandKit();
  
  const [mode, setMode] = useState<Mode>("image");
  const [prompt, setPrompt] = useState("");
  const [headline, setHeadline] = useState("");
  const [caption, setCaption] = useState("");
  const [cta, setCta] = useState("");
  const [socialCaption, setSocialCaption] = useState("");
  const [resolution, setResolution] = useState("1080x1350");
  const [slides, setSlides] = useState(1);
  const [writeOnSlides, setWriteOnSlides] = useState(true);
  const [duration, setDuration] = useState(10);
  const [fps, setFps] = useState(24);
  const [loading, setLoading] = useState(false);

  const [plan, setPlan] = useState<string[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [error, setError] = useState<string | null>(null);

  const missingSocialCaption = socialCaption.trim() === "";
  
  const DEFAULT_PLAN = [
    "1) Préparer prompt visuel",
    `2) Générer ${slides} ${mode === "video" ? "vidéo(s)" : "image(s)"}`,
    "3) (Option) Poser le texte fourni",
    "4) Vérifier lisibilité & formats",
    "5) Exporter & sauvegarder",
  ];

  async function generateSingleSlide(index: number): Promise<Artifact> {
    const enrichedPrompt = buildBrandAwarePrompt(prompt, brandKit);
    const { w, h } = parseWH(resolution);
    
    if (mode === "image") {
      const { data, error: imgError } = await supabase.functions.invoke("alfie-generate-ai-image", {
        body: {
          prompt: enrichedPrompt,
          templateImageUrl: undefined,
          brandKit: brandKit ? {
            id: brandKit.id,
            name: brandKit.name,
            palette: brandKit.palette,
            logo_url: brandKit.logo_url,
            fonts: brandKit.fonts,
            voice: brandKit.voice
          } : null,
          resolution,
          slideIndex: index,
          totalSlides: slides
        }
      });
      
      if (imgError) throw new Error(`Image: ${imgError.message || "échec d'invocation"}`);
      if (!data?.imageUrl) throw new Error("Image: aucune URL renvoyée par le backend");
      
      return {
        kind: "image",
        uri: data.imageUrl,
        meta: {
          index,
          resolution,
          brandId: brandKit?.id ?? null,
          brandName: brandKit?.name ?? null,
          overlay: !!(writeOnSlides && (headline || caption || cta))
        }
      };
    } else {
      const aspectRatio = `${w}:${h}`;
      const { data, error: videoError } = await supabase.functions.invoke("generate-video", {
        body: {
          prompt: enrichedPrompt,
          aspectRatio,
          provider: "replicate"
        }
      });
      
      if (videoError) throw new Error(`Vidéo: ${videoError.message || "échec d'invocation"}`);
      const videoUrl: string | undefined = data?.videoUrl || data?.url;
      if (!videoUrl) throw new Error("Vidéo: aucune URL renvoyée par le backend");
      
      return {
        kind: "video",
        uri: videoUrl,
        meta: {
          index,
          resolution,
          duration,
          fps,
          brandId: brandKit?.id ?? null,
          brandName: brandKit?.name ?? null
        }
      };
    }
  }

  async function handleGenerate() {
    if (!resolution.match(/^\d+x\d+$/)) {
      toast({ title: "Résolution invalide", description: "Format attendu: LxH (ex: 1080x1350)", variant: "destructive" });
      return;
    }
    if (slides < 1 || slides > 20) {
      toast({ 
        title: "Erreur", 
        description: "Le nombre de slides doit être entre 1 et 20", 
        variant: "destructive" 
      });
      return;
    }
    
    setLoading(true);
    setError(null);
    setArtifacts([]);
    setPlan(DEFAULT_PLAN);
    
    try {
      const results: Artifact[] = [];
      
      for (let i = 0; i < slides; i++) {
        console.log(`Génération slide ${i + 1}/${slides}...`);
        const artifact = await generateSingleSlide(i + 1);
        results.push(artifact);
        setArtifacts(prev => [...prev, artifact]);
        
        setPlan(prev => {
          const updated = [...prev];
          updated.push(`✓ Slide ${i + 1}/${slides} généré`);
          return updated;
        });
      }
      
      setPlan(prev => [...prev, "✓ Tous les livrables prêts"]);
      toast({
        title: "Génération réussie",
        description: `${slides} slide(s) ${mode === "video" ? "vidéo" : "image"} généré(s) avec succès.`
      });
    } catch (e: any) {
      const errorMsg = e?.message ?? "Erreur inconnue";
      setError(errorMsg);
      toast({ title: "Erreur", description: errorMsg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const canGenerate = !loading && prompt.trim() !== "" && slides >= 1 && slides <= 20;

  return (
    <AccessGuard>
      <div className="mx-auto max-w-7xl p-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Colonne gauche : Formulaire */}
          <div className="space-y-5">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="text-lg font-semibold text-card-foreground mb-4">Créer</div>
              
              {/* Section Brief */}
              <div className="space-y-3">
                <div className="text-sm font-semibold text-card-foreground">Brief</div>
                
                <div>
                  <label htmlFor="mode" className="text-sm font-medium text-card-foreground">Mode</label>
                  <div className="mt-1 flex gap-2">
                    <button
                      onClick={() => setMode("image")}
                      className={`px-3 py-1 rounded-2xl border border-border transition-colors ${
                        mode === "image" ? "bg-primary text-primary-foreground" : "bg-background text-foreground"
                      }`}
                      aria-pressed={mode === "image"}
                    >
                      Image
                    </button>
                    <button
                      onClick={() => setMode("video")}
                      className={`px-3 py-1 rounded-2xl border border-border transition-colors ${
                        mode === "video" ? "bg-primary text-primary-foreground" : "bg-background text-foreground"
                      }`}
                      aria-pressed={mode === "video"}
                    >
                      Vidéo
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="brand" className="text-sm font-medium text-card-foreground">Marque (optionnel)</label>
                  <select
                    id="brand"
                    value={activeBrandId || ""}
                    onChange={(e) => setActiveBrand(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-input bg-background p-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                  <option value="">Aucune marque</option>
                  {Array.isArray(brands) && brands.length > 0 ? (
                    brands.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))
                  ) : (
                    <option disabled>Aucune marque disponible</option>
                  )}
                  </select>
                  {brandKit && brandKit.palette.length > 0 && (
                    <div className="mt-1 flex gap-1">
                      {brandKit.palette.slice(0, 5).map((c, i) => (
                        <div key={i} style={{ backgroundColor: c }} className="w-6 h-6 rounded-full border" />
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="prompt" className="text-sm font-medium text-card-foreground">
                    Prompt visuel (décrit l'image/la vidéo)
                  </label>
                  <textarea
                    id="prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={4}
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Ex: Affiche énergique rentrée, fond coloré, style moderne, produits en avant-plan…"
                  />
                </div>
              </div>

              {/* Section Textes sur slides */}
              <div className="mt-4 space-y-3">
                <div className="text-sm font-semibold text-card-foreground">Textes sur slides</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="headline" className="text-sm font-medium text-card-foreground">Headline (optionnel)</label>
                    <input
                      id="headline"
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="Titre / Slogan"
                    />
                  </div>
                  <div>
                    <label htmlFor="cta" className="text-sm font-medium text-card-foreground">CTA (optionnel)</label>
                    <input
                      id="cta"
                      value={cta}
                      onChange={(e) => setCta(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="Ex: Découvrir"
                    />
                  </div>
                  <div className="col-span-2">
                    <label htmlFor="caption" className="text-sm font-medium text-card-foreground">Sous-titre (optionnel)</label>
                    <input
                      id="caption"
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="Courte description"
                    />
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="writeOnSlides"
                      checked={writeOnSlides}
                      onChange={(e) => setWriteOnSlides(e.target.checked)}
                      className="rounded border-input"
                    />
                    <label htmlFor="writeOnSlides" className="text-xs text-muted-foreground">
                      Écrire ces textes directement sur l'image/vidéo (V2)
                    </label>
                  </div>
                </div>
              </div>

              {/* Section Légende d'accompagnement */}
              <div className="mt-4 space-y-3">
                <div className="text-sm font-semibold text-card-foreground">Légende d'accompagnement</div>
                <div>
                  <label htmlFor="socialCaption" className="text-sm font-medium text-card-foreground">
                    Légende pour les réseaux sociaux (optionnel)
                  </label>
                  <textarea
                    id="socialCaption"
                    value={socialCaption}
                    onChange={(e) => setSocialCaption(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Caption pour accompagner votre visuel"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    La légende d'accompagnement n'est pas rédigée par Alfie. Pour la légende : Aeditus.
                  </p>
                </div>
              </div>

              {/* Section Résolution & Nombre */}
              <div className="mt-4 space-y-3">
                <div className="text-sm font-semibold text-card-foreground">Résolution & Nombre</div>
                
                <div>
                  <label htmlFor="resolution" className="text-sm font-medium text-card-foreground">Résolution</label>
                  <select
                    id="resolution"
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-input bg-background p-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {RESOLUTIONS.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="slides" className="text-sm font-medium text-card-foreground">Nombre de slides</label>
                  <input
                    id="slides"
                    type="number"
                    min={1}
                    max={20}
                    value={slides}
                    onChange={(e) => setSlides(Math.max(1, Math.min(20, parseInt(e.target.value || "1", 10))))}
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                {mode === "video" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="duration" className="text-sm font-medium text-card-foreground">Durée (s)</label>
                      <input
                        id="duration"
                        type="number"
                        min={1}
                        value={duration}
                        onChange={(e) => setDuration(parseInt(e.target.value, 10))}
                        className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    <div>
                      <label htmlFor="fps" className="text-sm font-medium text-card-foreground">FPS</label>
                      <input
                        id="fps"
                        type="number"
                        min={1}
                        value={fps}
                        onChange={(e) => setFps(parseInt(e.target.value, 10))}
                        className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4">
                <button
                  disabled={!canGenerate}
                  onClick={handleGenerate}
                  className="w-full px-4 py-2 rounded-2xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-busy={loading}
                  aria-disabled={!canGenerate}
                >
                  {loading 
                    ? `Génération ${Math.min(artifacts.length + 1, slides)}/${slides}…` 
                    : `Générer ${slides} ${mode === "video" ? "vidéo(s)" : "image(s)"}`
                  }
                </button>
                {error && <p className="mt-2 text-sm text-destructive" role="alert">{error}</p>}
              </div>
            </div>

            {/* Promo Aeditus si légende manquante */}
            {missingSocialCaption && (
              <AeditusCard
                title="Besoin d'une légende ?"
                message="Votre visuel gagnera en impact avec une légende d'accompagnement. Utilisez Aeditus (SaaS dédié au contenu)."
              />
            )}
          </div>

          {/* Colonne centre : Plan */}
          <div className="space-y-5">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="text-lg font-semibold text-card-foreground mb-3">Plan</div>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                {(plan.length === 0 && !loading && artifacts.length === 0) ? (
                  DEFAULT_PLAN.map((step, idx) => <li key={idx} className="opacity-50">{step}</li>)
                ) : (
                  plan.map((step, idx) => (
                    <li key={idx} className={step.startsWith("✓") ? "text-green-600 font-medium" : ""}>
                      {step}
                    </li>
                  ))
                )}
              </ol>
            </div>
          </div>

          {/* Colonne droite : Livrables */}
          <div className="space-y-5">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="text-lg font-semibold text-card-foreground">Livrables</div>
                <div className="text-xs text-muted-foreground">
                  {resolution} • {slides} slide(s) • {mode.toUpperCase()}
                </div>
              </div>

              {artifacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun livrable pour l'instant.</p>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {artifacts.map((a, i) => (
                    <div key={i} className="rounded-xl border border-border p-2 bg-background">
                      {a.kind === "image" ? (
                        <img src={a.uri} alt={`Slide ${i + 1}`} className="w-full h-auto rounded-lg" />
                      ) : (
                        <video src={a.uri} controls className="w-full rounded-lg" />
                      )}
                      <div className="flex items-center justify-between mt-2 text-xs">
                        <div className="flex gap-2">
                          <span className={`px-2 py-1 rounded-full ${
                            a.kind === "image" 
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200" 
                              : "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200"
                          }`}>
                            {a.kind.toUpperCase()}
                          </span>
                          {a.meta?.overlay && (
                            <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200">
                              Overlay
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <a
                            href={a.uri}
                            download
                            className="underline text-primary hover:text-primary/80"
                            aria-label={`Télécharger ${a.kind} ${i + 1}`}
                          >
                            Télécharger
                          </a>
                          <a
                            href={a.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline text-primary hover:text-primary/80"
                            aria-label={`Ouvrir ${a.kind} ${i + 1} dans un nouvel onglet`}
                          >
                            Ouvrir
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AccessGuard>
  );
}
