import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, Loader2, AlertCircle, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import JSZip from "jszip";

interface Asset {
  title: string;
  ratio: string;
  url: string;
  thumbnailUrl?: string;
}

export default function Pack() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brandName, setBrandName] = useState<string>("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Lien invalide. Vérifie ton email pour le bon lien.");
      setLoading(false);
      return;
    }

    fetchPack();
  }, [token]);

  async function fetchPack() {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-pack-by-token?token=${encodeURIComponent(token!)}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.error || "Pack non trouvé");
        return;
      }

      setBrandName(result.brandName || "Ton pack");
      setAssets(result.assets || []);
    } catch (err) {
      console.error("Error fetching pack:", err);
      setError("Erreur lors du chargement du pack");
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadAll() {
    if (assets.length === 0) return;

    setDownloading(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder("pack-alfie");

      for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];
        if (!asset.url || asset.url.startsWith("/")) continue;

        try {
          const response = await fetch(asset.url);
          const blob = await response.blob();
          const extension = asset.url.includes(".png") ? "png" : "jpg";
          const filename = `${i + 1}-${asset.title.replace(/\s+/g, "-").toLowerCase()}.${extension}`;
          folder?.file(filename, blob);
        } catch (err) {
          console.error(`Failed to download ${asset.title}:`, err);
        }
      }

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pack-${brandName.replace(/\s+/g, "-").toLowerCase()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error creating ZIP:", err);
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement de ton pack...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card rounded-2xl p-8 text-center shadow-lg">
          <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Oups !</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button
            onClick={() => window.location.href = "/start"}
            className="bg-primary hover:bg-primary/90"
          >
            Créer un nouveau pack
          </Button>
        </div>
      </div>
    );
  }

  const validAssets = assets.filter((a) => a.url && !a.url.startsWith("/"));

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <span className="text-3xl">🎁</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            {brandName}
          </h1>
          <p className="text-muted-foreground">
            Voici tes {validAssets.length} visuels générés par Alfie
          </p>
        </div>

        {/* Download All Button */}
        {validAssets.length > 0 && (
          <div className="flex justify-center mb-8">
            <Button
              onClick={handleDownloadAll}
              disabled={downloading}
              size="lg"
              className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white gap-2"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Préparation du ZIP...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Télécharger tout en ZIP
                </>
              )}
            </Button>
          </div>
        )}

        {/* Assets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {validAssets.map((asset, index) => (
            <div
              key={index}
              className="group relative bg-card rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-shadow"
            >
              <div className="aspect-square relative">
                <img
                  src={asset.url}
                  alt={asset.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <a
                    href={asset.url}
                    download={`${asset.title.replace(/\s+/g, "-").toLowerCase()}.jpg`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white text-foreground px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-gray-100 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Télécharger
                  </a>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-medium text-foreground">{asset.title}</h3>
                <p className="text-sm text-muted-foreground">{asset.ratio}</p>
              </div>
            </div>
          ))}
        </div>

        {validAssets.length === 0 && (
          <div className="text-center py-12">
            <ImageIcon className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">Aucun visuel trouvé dans ce pack</p>
          </div>
        )}

        {/* Footer CTA */}
        <div className="mt-12 text-center">
          <div className="inline-block bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 rounded-2xl p-6">
            <p className="text-lg font-medium text-foreground mb-2">
              Tu veux plus de visuels ?
            </p>
            <p className="text-muted-foreground mb-4">
              Crée des visuels illimités avec un compte Alfie Pro
            </p>
            <Button
              onClick={() => window.location.href = "/billing"}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
            >
              🚀 Découvrir les offres
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
