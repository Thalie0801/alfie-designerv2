import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Sparkles, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { trackEvent } from "@/utils/trackEvent";

// Configuration des assets de la galerie
const demoGalleryAssets = {
  previews: [
    { 
      title: "Post Instagram", 
      ratio: "1:1", 
      image: "/images/hero-preview.jpg",
      label: "Généré avec Alfie + Brand Kit"
    },
    { 
      title: "Story", 
      ratio: "9:16", 
      image: "/images/reel-preview.jpg",
      label: "Généré avec Alfie + Brand Kit"
    },
    { 
      title: "Carrousel", 
      ratio: "4:5", 
      image: "/images/carousel-preview.jpg",
      label: "Généré avec Alfie + Brand Kit"
    },
  ],
  beforeAfter: {
    before: { 
      image: "/images/insight-preview.jpg", 
      label: "Sans Brand Kit" 
    },
    after: { 
      image: "/images/hero-visual.jpg", 
      label: "Avec Brand Kit" 
    },
  }
};

export function DemoSection() {
  const navigate = useNavigate();
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const handleCtaClick = () => {
    trackEvent("demo_cta_click");
    navigate("/start");
  };

  const openLightbox = (image: string) => {
    setLightboxImage(image);
  };

  const closeLightbox = () => {
    setLightboxImage(null);
  };

  return (
    <section id="demo" className="px-4 py-16 sm:py-24 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Une démo rapide (30 sec)
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Regarde comment Alfie transforme une idée en visuels brandés.
          </p>
        </div>

        {/* Video placeholder */}
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 aspect-video mb-12 shadow-xl">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4 text-white/80">
              <div className="h-20 w-20 rounded-full bg-white/10 backdrop-blur flex items-center justify-center border border-white/20 cursor-pointer hover:bg-white/20 transition-colors">
                <Play className="h-8 w-8 ml-1" />
              </div>
              <span className="text-sm">Démo vidéo (bientôt)</span>
            </div>
          </div>
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
        </div>

        {/* Gallery of real results */}
        <div className="mb-12">
          <h3 className="text-lg font-semibold text-slate-900 text-center mb-6">
            Exemples de résultats
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {demoGalleryAssets.previews.map((preview) => (
              <div
                key={preview.title}
                onClick={() => openLightbox(preview.image)}
                className="group cursor-pointer bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition-all"
              >
                <div className="aspect-square bg-gradient-to-br from-alfie-mint/20 to-alfie-lilac/20 relative overflow-hidden">
                  <img 
                    src={preview.image} 
                    alt={preview.title}
                    width={400}
                    height={400}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-sm font-medium bg-black/50 px-3 py-1 rounded-full">
                      Voir en grand
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <p className="font-medium text-slate-900">{preview.title}</p>
                  <p className="text-xs text-slate-500 mt-1">{preview.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Before/After */}
        <div className="mb-12">
          <h3 className="text-lg font-semibold text-slate-900 text-center mb-6">
            Avant / Après Brand Kit
          </h3>
          <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
            <div
              onClick={() => openLightbox(demoGalleryAssets.beforeAfter.before.image)}
              className="cursor-pointer group"
            >
              <div className="aspect-square rounded-xl overflow-hidden border-2 border-slate-300 bg-slate-100 relative">
                <img 
                  src={demoGalleryAssets.beforeAfter.before.image} 
                  alt="Sans Brand Kit"
                  width={400}
                  height={400}
                  loading="lazy"
                  className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                  onError={(e) => {
                    e.currentTarget.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center text-slate-400">Image</div>';
                  }}
                />
              </div>
              <p className="text-center text-sm text-slate-500 mt-2 font-medium">
                {demoGalleryAssets.beforeAfter.before.label}
              </p>
            </div>
            <div
              onClick={() => openLightbox(demoGalleryAssets.beforeAfter.after.image)}
              className="cursor-pointer group"
            >
              <div className="aspect-square rounded-xl overflow-hidden border-2 border-alfie-mint bg-alfie-mint/10 relative">
                <img 
                  src={demoGalleryAssets.beforeAfter.after.image} 
                  alt="Avec Brand Kit"
                  width={400}
                  height={400}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  onError={(e) => {
                    e.currentTarget.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center text-alfie-mint">Image</div>';
                  }}
                />
              </div>
              <p className="text-center text-sm text-alfie-mint mt-2 font-semibold">
                {demoGalleryAssets.beforeAfter.after.label} ✨
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Button
            size="lg"
            className="rounded-full bg-alfie-mint px-8 py-3 text-base font-semibold text-slate-900 shadow-md hover:bg-alfie-pink"
            onClick={handleCtaClick}
          >
            <Sparkles className="mr-2 h-5 w-5" />
            Créer mon Brand Kit (1 min)
          </Button>
          <p className="text-xs text-slate-500 mt-3">
            3 visuels gratuits en 5 min. Sans carte.
          </p>
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={closeLightbox}
        >
          <button 
            className="absolute top-4 right-4 text-white/80 hover:text-white"
            onClick={closeLightbox}
          >
            <X className="h-8 w-8" />
          </button>
          <img 
            src={lightboxImage} 
            alt="Preview"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </section>
  );
}
