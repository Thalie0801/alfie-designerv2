import { useState } from "react";
import { AccessGuard } from "@/components/AccessGuard";
import { AeditusCard } from "@/components/AeditusCard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Artifact = { kind: "image" | "video"; uri: string; meta?: any };

const DEFAULT_RES = "1080x1350";
const parseWH = (r: string) => {
  const [w, h] = r.split("x").map((n) => parseInt(n, 10));
  return { w: w || 1080, h: h || 1350 };
};

export default function Creator() {
  const { toast } = useToast();
  const [mode, setMode] = useState<"image" | "video">("image");
  const [prompt, setPrompt] = useState("");
  const [headline, setHeadline] = useState("");
  const [caption, setCaption] = useState("");
  const [cta, setCta] = useState("");
  const [resolution, setResolution] = useState(DEFAULT_RES);
  const [duration, setDuration] = useState(10);
  const [fps, setFps] = useState(24);
  const [loading, setLoading] = useState(false);

  const [plan, setPlan] = useState<string[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [error, setError] = useState<string | null>(null);

  const missingCopy = headline.trim() === "" || caption.trim() === "" || cta.trim() === "";

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setArtifacts([]);
    
    setPlan([
      "1) Préparer le prompt visuel",
      mode === "video" ? "2) Générer la vidéo" : "2) Générer l'image",
      "3) (Option) Mettre en page / overlay",
      "4) Vérifier lisibilité et formats",
      "5) Exporter les livrables",
    ]);

    try {
      const { w, h } = parseWH(resolution);
      
      if (mode === "image") {
        const { data, error: imgError } = await supabase.functions.invoke("alfie-generate-ai-image", {
          body: {
            prompt,
            templateImageUrl: null,
            brandKit: null,
          },
        });

        if (imgError) throw new Error(imgError.message);
        if (data?.generatedImageUrl) {
          setArtifacts([{ kind: "image", uri: data.generatedImageUrl }]);
          setPlan((p) => [...p, "✓ Livrables prêts"]);
        }
      } else {
        const aspectRatio = `${w}:${h}`;
        const { data, error: videoError } = await supabase.functions.invoke("chat-generate-video", {
          body: {
            prompt,
            aspectRatio,
            source: null,
          },
        });

        if (videoError) throw new Error(videoError.message);
        if (data?.videoUrl || data?.url) {
          const videoUrl = data.videoUrl || data.url;
          setArtifacts([{ kind: "video", uri: videoUrl }]);
          setPlan((p) => [...p, "✓ Livrables prêts"]);
        }
      }

      toast({
        title: "Génération réussie",
        description: `Votre ${mode === "video" ? "vidéo" : "image"} a été générée avec succès.`,
      });
    } catch (e: any) {
      const errorMsg = e?.message ?? "Erreur inconnue";
      setError(errorMsg);
      toast({
        title: "Erreur",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  const { w, h } = parseWH(resolution);

  return (
    <AccessGuard>
      <div className="mx-auto max-w-7xl p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Colonne gauche : Formulaire & actions */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="text-lg font-semibold text-card-foreground">Créer</div>
              
              <div className="mt-3">
                <label className="text-sm font-medium text-card-foreground">Mode</label>
                <div className="mt-1 flex gap-2">
                  <button
                    onClick={() => setMode("image")}
                    className={`px-3 py-1 rounded-2xl border border-border transition-colors ${
                      mode === "image" ? "bg-primary text-primary-foreground" : "bg-background text-foreground"
                    }`}
                  >
                    Image
                  </button>
                  <button
                    onClick={() => setMode("video")}
                    className={`px-3 py-1 rounded-2xl border border-border transition-colors ${
                      mode === "video" ? "bg-primary text-primary-foreground" : "bg-background text-foreground"
                    }`}
                  >
                    Vidéo
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <label className="text-sm font-medium text-card-foreground">
                  Prompt visuel (décrit l'image/la vidéo)
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Ex: Affiche énergique rentrée, fond coloré, style moderne, produits en avant-plan…"
                />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium text-card-foreground">Headline (optionnel)</label>
                  <input
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Titre / Slogan (si disponible)"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-card-foreground">CTA (optionnel)</label>
                  <input
                    value={cta}
                    onChange={(e) => setCta(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Ex: Découvrir / Commander"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-card-foreground">Caption (optionnel)</label>
                  <input
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Courte description si vous l'avez déjà"
                  />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="col-span-3">
                  <label className="text-sm font-medium text-card-foreground">Résolution</label>
                  <input
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="1080x1350"
                  />
                </div>
                {mode === "video" && (
                  <>
                    <div>
                      <label className="text-sm font-medium text-card-foreground">Durée (s)</label>
                      <input
                        type="number"
                        min={1}
                        value={duration}
                        onChange={(e) => setDuration(parseInt(e.target.value, 10))}
                        className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-card-foreground">FPS</label>
                      <input
                        type="number"
                        min={1}
                        value={fps}
                        onChange={(e) => setFps(parseInt(e.target.value, 10))}
                        className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="mt-4">
                <button
                  disabled={loading || !prompt.trim()}
                  onClick={handleGenerate}
                  className="w-full px-4 py-2 rounded-2xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {loading ? "Génération en cours…" : mode === "video" ? "Générer la vidéo" : "Générer l'image"}
                </button>
                {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
              </div>
            </div>

            {/* Promo Aeditus si texte manquant */}
            {missingCopy && (
              <AeditusCard
                title="Besoin d'un texte ?"
                message="Votre visuel gagnera en impact avec une headline/caption/CTA. Utilisez Aeditus (SaaS dédié au contenu)."
              />
            )}
          </div>

          {/* Colonne centre : Plan minimal */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="text-lg font-semibold text-card-foreground">Plan</div>
              <ol className="mt-3 list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                {plan.length === 0 ? (
                  <li>Démarrez une génération pour voir le flow.</li>
                ) : (
                  plan.map((step, idx) => <li key={idx}>{step}</li>)
                )}
              </ol>
            </div>
          </div>

          {/* Colonne droite : Livrables */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold text-card-foreground">Livrables</div>
                <div className="text-xs text-muted-foreground">
                  {w}×{h}
                  {mode === "video" ? ` • ${duration}s @ ${fps}fps` : ""}
                </div>
              </div>

              {artifacts.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Aucun livrable pour l'instant.</p>
              ) : (
                <div className="mt-3 grid grid-cols-1 gap-3">
                  {artifacts.map((a, i) => (
                    <div key={i} className="rounded-xl border border-border p-2 bg-background">
                      {a.kind === "image" ? (
                        <img src={a.uri} alt={`img-${i}`} className="w-full h-auto rounded-lg" />
                      ) : (
                        <video src={a.uri} controls className="w-full rounded-lg" />
                      )}
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{a.kind.toUpperCase()}</span>
                        <a
                          href={a.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline text-primary hover:text-primary/80"
                        >
                          Ouvrir
                        </a>
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
