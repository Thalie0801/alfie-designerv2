import React, { useMemo, useState } from "react";

type Format = "image" | "reel" | "carousel" | "infographic";
type Aspect = "9:16" | "1:1" | "4:5" | "16:9";

type Props = {
  brandId: string;
  defaultFormat?: Format;
  defaultPrompt?: string;
  onCreated?: (resp: { id: string; status: string; requiresPremiumConfirmation?: boolean }) => void;
  onError?: (message: string) => void;
};

export function ChatGeneratorCard({
  brandId,
  defaultFormat = "image",
  defaultPrompt = "",
  onCreated,
  onError
}: Props) {
  const [tab, setTab] = useState<Format>(defaultFormat);
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [mode, setMode] = useState<"fast" | "quality">("fast");
  const [aspect, setAspect] = useState<Aspect>(defaultFormat === "reel" ? "9:16" : "1:1");
  const [duration, setDuration] = useState<number>(10);
  const [slides, setSlides] = useState<number>(5);
  const [submitting, setSubmitting] = useState(false);
  const [premium, setPremium] = useState<boolean>(false);

  const title = useMemo(() => {
    switch (tab) {
      case "image":
        return "Image";
      case "reel":
        return "Reel 9:16 / 16:9";
      case "carousel":
        return "Carrousel FR";
      case "infographic":
        return "Infographie";
      default:
        return "";
    }
  }, [tab]);

  const handleTabChange = (format: Format) => {
    setTab(format);
    if (format === "reel") {
      setAspect("9:16");
    } else if (aspect === "9:16" && format !== "reel") {
      setAspect("1:1");
    }
  };

  async function create() {
    if (!brandId) {
      onError?.("brandId manquant");
      return;
    }
    if (!prompt.trim()) {
      onError?.("Décris brièvement ce que tu veux générer.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        brandId,
        format: tab,
        objective: prompt,
        styleChoice: tab === "carousel" ? "template_canva" : "ia",
        premiumT2VRequested: tab === "reel" ? premium : false,
        meta: {}
      };

      if (tab === "image" || tab === "infographic") {
        payload.meta = { aspect, variant: tab };
      }
      if (tab === "reel") {
        payload.meta = { aspect, duration_s: clamp(duration, 3, 12), mode, t2v: true };
      }
      if (tab === "carousel") {
        payload.meta = {
          locale: "fr-FR",
          slidesWanted: clamp(slides, 3, 8),
          banCollageGrids: true,
          templateFirst: true
        };
      }

      const res = await fetch("/api/v1/creations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const j = await res.json();
      if (!res.ok) {
        throw new Error(j?.error || "create_failed");
      }
      onCreated?.(j);
    } catch (e: any) {
      onError?.(String(e.message || e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-slate-950/95 p-4 text-slate-100 shadow-xl">
      <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Formats">
        {(["image", "reel", "carousel", "infographic"] as Format[]).map((format) => (
          <button
            key={format}
            role="tab"
            aria-selected={tab === format}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-100/40 ${
              tab === format
                ? "border-blue-500 bg-blue-600 text-white"
                : "border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-600"
            }`}
            onClick={() => handleTabChange(format)}
            disabled={submitting}
          >
            {labelOf(format)}
          </button>
        ))}
      </div>

      <div className="mb-4 text-lg font-bold">{title}</div>

      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300" htmlFor="prompt">
        Brief
      </label>
      <textarea
        id="prompt"
        className="mb-3 w-full rounded-xl border border-slate-700 bg-slate-900/80 p-3 text-sm text-slate-100 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 disabled:opacity-50"
        rows={4}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={placeholderOf(tab)}
        disabled={submitting}
      />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-4">
        <span className="text-sm font-semibold text-slate-200">Mode</span>
        <div className="flex flex-wrap gap-2">
          <button
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              mode === "fast"
                ? "bg-blue-500 text-white"
                : "bg-slate-900 text-slate-200 hover:bg-slate-800"
            }`}
            onClick={() => setMode("fast")}
            disabled={submitting}
          >
            Rapide
          </button>
          <button
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              mode === "quality"
                ? "bg-blue-500 text-white"
                : "bg-slate-900 text-slate-200 hover:bg-slate-800"
            }`}
            onClick={() => setMode("quality")}
            disabled={submitting}
          >
            Qualité
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-4">
        <span className="text-sm font-semibold text-slate-200">Ratio</span>
        <div className="flex flex-wrap gap-2">
          {(["9:16", "1:1", "4:5", "16:9"] as Aspect[]).map((ratio) => (
            <button
              key={ratio}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                aspect === ratio
                  ? "bg-blue-500 text-white"
                  : "bg-slate-900 text-slate-200 hover:bg-slate-800"
              }`}
              onClick={() => setAspect(ratio)}
              disabled={submitting}
            >
              {ratio}
            </button>
          ))}
        </div>
      </div>

      {tab === "reel" && (
        <div className="space-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-slate-200" htmlFor="dur">
              Durée (3–12 s)
            </label>
            <input
              id="dur"
              type="number"
              min={3}
              max={12}
              step={1}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              disabled={submitting}
              className="w-28 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={premium}
              onChange={(e) => setPremium(e.target.checked)}
              disabled={submitting}
              className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-400"
            />
            <span>
              Demander un plan <span className="font-semibold">Premium T2V</span> (consomme des Woofs)
            </span>
          </label>
        </div>
      )}

      {tab === "carousel" && (
        <div className="mt-3 flex flex-col gap-1">
          <label className="text-sm font-semibold text-slate-200" htmlFor="sld">
            Slides (3–8)
          </label>
          <input
            id="sld"
            type="number"
            min={3}
            max={8}
            step={1}
            value={slides}
            onChange={(e) => setSlides(Number(e.target.value))}
            disabled={submitting}
            className="w-28 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
          />
        </div>
      )}

      <button
        className="mt-4 w-full rounded-xl bg-emerald-400 px-4 py-2 text-sm font-extrabold text-slate-900 transition hover:bg-emerald-300 disabled:opacity-60"
        onClick={create}
        disabled={submitting}
      >
        {submitting ? "Génération…" : "Générer"}
      </button>

      <p className="mt-3 text-xs text-slate-300/80">
        Livraison <strong>PULL</strong> : ouvrir dans Canva + ZIP structuré. Aucune autopublication.
      </p>
    </div>
  );
}

function labelOf(format: Format) {
  if (format === "image") return "Image";
  if (format === "reel") return "Reel";
  if (format === "carousel") return "Carrousel";
  return "Infographie";
}

function placeholderOf(format: Format) {
  if (format === "reel")
    return "Ex: Démo produit 9:16, travelling doux, zoom léger sur le logo, musique énergique.";
  if (format === "carousel")
    return "Ex: Promo -20% en 5 slides, titres courts FR, CTA en slide final.";
  if (format === "infographic")
    return "Ex: Chiffres clés Q4, 4 blocs, palette Brand Kit.";
  return "Ex: Image 9:16 pour lancement, style propre, palette de la marque.";
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default ChatGeneratorCard;
