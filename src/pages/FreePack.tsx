import { useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trackEvent } from "@/utils/trackEvent";
import { Download, Sparkles, ArrowRight, Check, Loader2 } from "lucide-react";
import logo from "@/assets/alfie-logo-black.svg";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface GeneratedAsset {
  title: string;
  ratio: string;
  url: string;
  thumbnailUrl?: string;
}

export default function FreePack() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isGenerating, setIsGenerating] = useState(true);
  const [progress, setProgress] = useState(0);
  const [generatedAssets, setGeneratedAssets] = useState<GeneratedAsset[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const brandData = location.state as {
    brandName?: string;
    sector?: string;
    styles?: string[];
    colorChoice?: string;
    fontChoice?: string;
    objective?: string;
    email?: string;
    userId?: string;
    brandId?: string;
  } | null;

  const generatePack = useCallback(async () => {
    if (!brandData?.userId || !brandData?.brandId || !brandData?.email) {
      // Use placeholders if no data
      setProgress(100);
      setIsGenerating(false);
      setGeneratedAssets([
        { title: "Post Instagram", ratio: "1:1", url: "/images/hero-preview.jpg" },
        { title: "Story", ratio: "9:16", url: "/images/reel-preview.jpg" },
        { title: "Cover", ratio: "4:5", url: "/images/carousel-preview.jpg" },
      ]);
      return;
    }

    try {
      // Simulate progress while generating
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 5, 90));
      }, 1000);

      const { data, error: genError } = await supabase.functions.invoke("generate-free-pack", {
        body: {
          userId: brandData.userId,
          brandId: brandData.brandId,
          email: brandData.email,
          brandData: {
            brandName: brandData.brandName || "Ma marque",
            sector: brandData.sector || "other",
            styles: brandData.styles || ["Moderne"],
            colorChoice: brandData.colorChoice || "auto",
            fontChoice: brandData.fontChoice || "modern",
            objective: brandData.objective || "grow",
          },
        },
      });

      clearInterval(progressInterval);

      if (genError) {
        console.error("Generation error:", genError);
        setError("Erreur lors de la génération. On utilise des visuels de démo.");
        setGeneratedAssets([
          { title: "Post Instagram", ratio: "1:1", url: "/images/hero-preview.jpg" },
          { title: "Story", ratio: "9:16", url: "/images/reel-preview.jpg" },
          { title: "Cover", ratio: "4:5", url: "/images/carousel-preview.jpg" },
        ]);
      } else if (data?.assets) {
        setGeneratedAssets(data.assets);
        toast.success("Ton pack est prêt !");
      }

      setProgress(100);
      setIsGenerating(false);
      trackEvent("free_pack_generated", { brandData: brandData?.brandName });
    } catch (err) {
      console.error("Error:", err);
      setProgress(100);
      setIsGenerating(false);
      setGeneratedAssets([
        { title: "Post Instagram", ratio: "1:1", url: "/images/hero-preview.jpg" },
        { title: "Story", ratio: "9:16", url: "/images/reel-preview.jpg" },
        { title: "Cover", ratio: "4:5", url: "/images/carousel-preview.jpg" },
      ]);
    }
  }, [brandData]);

  useEffect(() => {
    generatePack();
  }, [generatePack]);

  const handleDownload = async () => {
    trackEvent("free_pack_download");
    
    // For real assets, trigger download
    if (generatedAssets.length > 0 && generatedAssets[0].url.startsWith("http")) {
      toast.info("Préparation du téléchargement...");
      
      // Download each image
      for (const asset of generatedAssets) {
        try {
          const response = await fetch(asset.url);
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${brandData?.brandName || "pack"}-${asset.title.toLowerCase().replace(" ", "-")}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        } catch (e) {
          console.error("Download error:", e);
        }
      }
      
      toast.success("Téléchargement terminé !");
    } else {
      toast.info("Les visuels de démo ne peuvent pas être téléchargés. Crée ton Brand Kit pour des visuels personnalisés !");
    }
  };

  const handleUpgrade = () => {
    trackEvent("express_19_checkout_started");
    navigate("/checkout/express?product=carousel10");
  };

  const handleViewPricing = () => {
    trackEvent("pricing_plan_clicked", { from: "free-pack" });
    navigate("/billing");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-alfie-peach/20 via-white to-alfie-lilac/20">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <img src={logo} alt="Alfie" className="h-7" />
          <Badge variant="secondary" className="bg-alfie-mint/20 text-slate-700">
            Pack gratuit
          </Badge>
        </div>
      </header>

      <main className="px-4 py-8 max-w-4xl mx-auto">
        {isGenerating ? (
          /* Loading state */
          <div className="text-center py-16 space-y-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-alfie-mint/20 flex items-center justify-center">
              <Loader2 className="h-10 w-10 text-alfie-mint animate-spin" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">
              Alfie génère tes visuels...
            </h1>
            <p className="text-slate-600">
              Ça prend environ 1-2 minutes. Reste sur cette page !
            </p>
            <div className="max-w-xs mx-auto">
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-alfie-mint transition-all duration-500"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <p className="text-sm text-slate-500 mt-2">
                {Math.round(Math.min(progress, 100))}% terminé
              </p>
            </div>
            <div className="text-sm text-slate-500 animate-pulse">
              {progress < 30 && "🎨 Analyse de ton Brand Kit..."}
              {progress >= 30 && progress < 60 && "✨ Génération des visuels..."}
              {progress >= 60 && progress < 90 && "🖼️ Finalisation..."}
              {progress >= 90 && "📦 Préparation du pack..."}
            </div>
          </div>
        ) : (
          /* Success state */
          <div className="space-y-8">
            {/* Success header */}
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                Ton pack gratuit est prêt ! 🎉
              </h1>
              <p className="text-slate-600">
                {brandData?.brandName ? `Pour ${brandData.brandName}` : "Voici tes 3 visuels personnalisés"}
              </p>
              {error && (
                <p className="text-sm text-amber-600 bg-amber-50 px-4 py-2 rounded-lg inline-block">
                  {error}
                </p>
              )}
            </div>

            {/* Assets grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {generatedAssets.map((asset) => (
                <div
                  key={asset.title}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="aspect-square bg-gradient-to-br from-alfie-mint/30 to-alfie-lilac/30 flex items-center justify-center relative overflow-hidden">
                    <img 
                      src={asset.url} 
                      alt={asset.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = "/images/hero-preview.jpg";
                      }}
                    />
                  </div>
                  <div className="p-4">
                    <p className="font-medium text-slate-900">{asset.title}</p>
                    <p className="text-sm text-slate-500">{asset.ratio}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Download button */}
            <div className="text-center">
              <Button
                size="lg"
                onClick={handleDownload}
                className="bg-slate-900 hover:bg-slate-800 text-white px-8"
              >
                <Download className="mr-2 h-5 w-5" />
                Télécharger en ZIP
              </Button>
            </div>

            {/* Upsell card */}
            <div className="bg-gradient-to-br from-alfie-mint/20 via-alfie-lilac/20 to-alfie-pink/20 rounded-3xl p-6 sm:p-8 border border-alfie-mint/30">
              <div className="text-center space-y-4">
                <Badge className="bg-alfie-pink/30 text-slate-900 border-0">
                  🚀 Offre spéciale
                </Badge>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                  Upgrade à 19€ seulement
                </h2>
                <p className="text-slate-600 max-w-md mx-auto">
                  Obtiens un carrousel complet de 10 slides + le CSV Canva prêt à importer.
                </p>
                <ul className="text-left max-w-sm mx-auto space-y-2">
                  <li className="flex items-center gap-2 text-slate-700">
                    <Check className="h-4 w-4 text-green-500 shrink-0" />
                    <span>10 slides brandés à ton image</span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-700">
                    <Check className="h-4 w-4 text-green-500 shrink-0" />
                    <span>Export CSV pour Canva Bulk Create</span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-700">
                    <Check className="h-4 w-4 text-green-500 shrink-0" />
                    <span>Textes générés par IA</span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-700">
                    <Check className="h-4 w-4 text-green-500 shrink-0" />
                    <span>Sans engagement</span>
                  </li>
                </ul>
                <Button
                  size="lg"
                  onClick={handleUpgrade}
                  className="bg-alfie-mint hover:bg-alfie-pink text-slate-900 px-8 font-semibold"
                >
                  <Sparkles className="mr-2 h-5 w-5" />
                  Obtenir mon carrousel à 19€
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <p className="text-xs text-slate-500">
                  Paiement unique · Livraison immédiate par email
                </p>
              </div>
            </div>

            {/* Secondary CTA */}
            <div className="text-center pt-4">
              <button
                onClick={handleViewPricing}
                className="text-sm text-slate-500 underline underline-offset-2 hover:text-slate-700"
              >
                Voir les abonnements mensuels →
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
