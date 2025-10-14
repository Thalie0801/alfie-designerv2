import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, Palette, CalendarClock, Film, BarChart3, Layers, Share2, ChevronRight, Shield } from "lucide-react";
import alfieMain from "@/assets/alfie-main.png";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";

// --- Hooks to simulate actions (replace with Lovable actions / API calls) ---
const useAlfieActions = () => {
  const connectCanva = () => alert("OAuth Canva → redirection… (remplacer par oauth_canva_start)");
  const createHero = () => alert("Créer design Hero… (design_create_from_template)");
  const createCarousel = () => alert("Créer design Carousel…");
  const createInsight = () => alert("Créer design Insight…");
  const createReel = () => alert("Créer design Reel 9:16…");
  return { connectCanva, createHero, createCarousel, createInsight, createReel };
};

export default function AlfieLanding() {
  const { connectCanva, createHero, createCarousel, createInsight, createReel } = useAlfieActions();
  const [email, setEmail] = useState("");
  const [isAnnual, setIsAnnual] = useState(false);
  const { createCheckout, loading: checkoutLoading } = useStripeCheckout();

  const calculatePrice = (monthlyPrice: number) => {
    if (isAnnual) {
      const annualPrice = monthlyPrice * 12 * 0.8; // -20%
      return `${Math.round(annualPrice)}€`;
    }
    return `${monthlyPrice}€`;
  };

  const getPriceLabel = () => isAnnual ? " / an" : " / mois";

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 text-slate-900">
      {/* Navbar */}
      <header className="sticky top-0 z-20 backdrop-blur bg-white/70 border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-2xl bg-primary text-white shadow-sm"><Sparkles className="h-4 w-4 sm:h-5 sm:w-5"/></span>
            <span className="font-semibold text-sm sm:text-base">Alfie Designer</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Button size="sm" className="text-xs sm:text-sm" onClick={() => window.location.href = '/auth'}>Ouvrir l'app</Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-3 sm:px-4 py-8 sm:py-14 grid md:grid-cols-2 gap-6 sm:gap-10 items-center">
        <div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight tracking-tight animate-fade-in">
            Ton agent de création <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">via Canva</span> 👋
          </h1>
          <p className="mt-3 sm:mt-4 text-base sm:text-lg text-slate-600 animate-fade-in">Alfie est ton agent de création et planification. Demande-lui ce que tu souhaites et hop, ton design arrive directement dans ton Canva !</p>
              <div className="mt-4 sm:mt-6 flex flex-wrap gap-2 sm:gap-3 animate-fade-in">
                <Button size="lg" className="gradient-hero text-white shadow-medium hover:shadow-strong text-sm sm:text-base" onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>
                  Commencer ✨
                </Button>
                <Button size="lg" variant="outline" className="hover:scale-105 transition-transform text-sm sm:text-base" onClick={() => window.location.href = '/auth'}>
                  Voir une démo
                </Button>
              </div>
          <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-slate-500 text-xs sm:text-sm">
            <div className="flex items-center gap-2"><Shield className="h-3 w-3 sm:h-4 sm:w-4"/> Client maître : aucune publication auto</div>
            <div className="flex items-center gap-2"><Palette className="h-3 w-3 sm:h-4 sm:w-4"/> Brand Kit appliqué</div>
            <div className="flex items-center gap-2"><CalendarClock className="h-3 w-3 sm:h-4 sm:w-4"/> Planif dans Canva</div>
          </div>
        </div>
        <div className="relative mt-8 md:mt-0">
          {/* Alfie Sticker Flottant */}
          <div className="absolute -top-6 sm:-top-12 -left-4 sm:-left-8 z-10 animate-float">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary via-secondary to-accent rounded-full blur-2xl opacity-60 animate-pulse-soft"></div>
              <div className="relative rounded-full border-2 sm:border-4 border-white shadow-strong overflow-hidden w-20 h-20 sm:w-32 sm:h-32 bg-gradient-to-br from-primary/20 to-secondary/20">
                <img src={alfieMain} alt="Alfie" className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-1 sm:-bottom-2 -right-1 sm:-right-2 bg-secondary text-white rounded-full px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-bold shadow-medium">
                👋 Alfie
              </div>
            </div>
          </div>

          <div className="rounded-2xl sm:rounded-3xl border border-slate-100 bg-white shadow-xl p-3 sm:p-6">
            <div className="grid grid-cols-2 gap-2 sm:gap-4">
              <MiniCard 
                icon={<Sparkles className="h-5 w-5"/>} 
                title="Hero / Announcement" 
                subtitle="1:1 • 16:9" 
                onClick={createHero}
                image="/images/hero-visual.jpg"
              />
              <MiniCard 
                icon={<Layers className="h-5 w-5"/>} 
                title="Carousel / Educatif" 
                subtitle="4:5" 
                onClick={createCarousel}
                image="/images/carousel-visual.jpg"
              />
              <MiniCard 
                icon={<BarChart3 className="h-5 w-5"/>} 
                title="Insight / Stats" 
                subtitle="1:1 • 4:5" 
                onClick={createInsight}
                image="/images/insight-card.jpg"
              />
              <MiniCard 
                icon={<Film className="h-5 w-5"/>} 
                title="Reel / Short" 
                subtitle="9:16" 
                onClick={createReel}
                image="/images/reel-visual.jpg"
              />
            </div>
            <div className="mt-4 sm:mt-6 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary/5 to-secondary/5 p-3 sm:p-4 border border-primary/10">
              <p className="text-xs sm:text-sm font-semibold text-slate-700">Brief rapide</p>
              <div className="mt-2 sm:mt-3 grid gap-2 sm:gap-3">
                <Input className="text-xs sm:text-sm" placeholder="Thème / idée (ex: Lancement Q4, Témoignage, Tuto)"/>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  <Input className="text-xs sm:text-sm" placeholder="Style (Minimal, Luxe, Color Pop)"/>
                  <Input className="text-xs sm:text-sm" placeholder="Canaux (IG, LinkedIn…)"/>
                </div>
                <Textarea className="text-xs sm:text-sm" placeholder="Notes (ton, CTA, hashtags)…"/>
                <Button className="w-full shadow-medium text-xs sm:text-sm">Générer mes visuels</Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-3 sm:px-4 py-8 sm:py-12">
        <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 text-center">Comment ça marche ?</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
          <div className="text-center">
            <div className="inline-flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-primary text-white text-xl sm:text-2xl font-bold mb-3 sm:mb-4">1</div>
            <h3 className="text-lg sm:text-xl font-semibold mb-2">Connecte ton Canva</h3>
            <p className="text-sm sm:text-base text-slate-600">Lie ton compte Canva en un clic pour permettre à Alfie de créer directement dans ton espace.</p>
          </div>
          <div className="text-center">
            <div className="inline-flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-primary text-white text-xl sm:text-2xl font-bold mb-3 sm:mb-4">2</div>
            <h3 className="text-lg sm:text-xl font-semibold mb-2">Donne ton brief à Alfie</h3>
            <p className="text-sm sm:text-base text-slate-600">Dis-lui simplement ce que tu veux : un post hero, un carrousel, une stat... Alfie comprend.</p>
          </div>
          <div className="text-center sm:col-span-2 md:col-span-1">
            <div className="inline-flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-primary text-white text-xl sm:text-2xl font-bold mb-3 sm:mb-4">3</div>
            <h3 className="text-lg sm:text-xl font-semibold mb-2">Tout arrive sur ton Canva</h3>
            <p className="text-sm sm:text-base text-slate-600">Alfie crée le design avec ta marque et l'envoie directement dans ton Canva. Planifie sur Canva !</p>
          </div>
        </div>
      </section>

      {/* Cards — Create Visuals */}
      <section className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Créer des visuels en 1 clic</h2>
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          <TemplateCard title="Hero" subtitle="Annonce, Cover, Citation" ratios="1:1 • 16:9" image="/images/hero-preview.jpg" />
          <TemplateCard title="Carousel" subtitle="Tips, Storytelling" ratios="4:5" image="/images/carousel-preview.jpg" />
          <TemplateCard title="Insight" subtitle="Stat, Preuve, Donnée" ratios="1:1 • 4:5" image="/images/insight-preview.jpg" />
          <TemplateCard title="Reel" subtitle="Vidéo 8–20 s" ratios="9:16" image="/images/reel-preview.jpg" />
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-6xl mx-auto px-3 sm:px-4 py-8 sm:py-14">
        <div className="text-center mb-6 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            Tarifs clairs, évolutifs
          </h2>
          
          {/* Toggle Mensuel/Annuel */}
          <div className="flex items-center justify-center gap-3 sm:gap-4 mt-4 sm:mt-6">
            <span className={`text-sm sm:text-base font-medium ${!isAnnual ? 'text-primary' : 'text-muted-foreground'}`}>
              Mensuel
            </span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className={`relative w-12 h-6 sm:w-16 sm:h-8 rounded-full transition-colors ${
                isAnnual ? 'bg-gradient-to-r from-primary to-secondary' : 'bg-slate-300'
              }`}
            >
              <div
                className={`absolute top-0.5 sm:top-1 w-5 h-5 sm:w-6 sm:h-6 bg-white rounded-full shadow-md transition-transform ${
                  isAnnual ? 'translate-x-6 sm:translate-x-9' : 'translate-x-0.5 sm:translate-x-1'
                }`}
              />
            </button>
            <span className={`text-sm sm:text-base font-medium ${isAnnual ? 'text-primary' : 'text-muted-foreground'}`}>
              Annuel <span className="text-green-600 font-semibold">-20%</span>
            </span>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          <PriceCard 
            title="Starter" 
            planKey="starter"
            price={calculatePrice(29)} 
            priceLabel={getPriceLabel()}
            isAnnual={isAnnual}
            bullets={["1 marque","25 vidéos + 100 images/mois","150 crédits IA/mois","100 requêtes Alfie/mois","Générateur de contenu IA intégré","2 templates"]} 
            cta="Essayer Starter"
            onSelect={() => createCheckout('starter')}
            loading={checkoutLoading}
          />
          <PriceCard 
            title="Pro" 
            planKey="pro"
            price={calculatePrice(79)} 
            priceLabel={getPriceLabel()}
            isAnnual={isAnnual}
            highlight 
            bullets={["3 marques","40 vidéos + 295 images/mois","375 crédits IA/mois","250 requêtes Alfie/mois","Générateur de contenu IA intégré","-20% sur packs de crédits","4 templates + Reels"]} 
            cta="Choisir Pro"
            onSelect={() => createCheckout('pro')}
            loading={checkoutLoading}
          />
          <PriceCard 
            title="Studio" 
            planKey="studio"
            price={calculatePrice(149)} 
            priceLabel={getPriceLabel()}
            isAnnual={isAnnual}
            bullets={["Multi-marques (5 max)","150 vidéos + 450 images/mois","750 crédits IA/mois","500 requêtes Alfie/mois","Générateur de contenu IA intégré","-20% sur packs de crédits","Reels avancés","Analytics"]} 
            cta="Passer Studio"
            onSelect={() => createCheckout('studio')}
            loading={checkoutLoading}
          />
          <PriceCard 
            title="Enterprise" 
            planKey="enterprise"
            price="Sur mesure"
            priceLabel=""
            isAnnual={false}
            bullets={["Marques illimitées","Visuels illimités","Crédits IA sur mesure","Alfie illimité","Générateur de contenu IA intégré","API & SSO","White-label","Support dédié 24/7"]} 
            cta="Nous contacter"
            onSelect={() => window.location.href = '/contact'}
            loading={false}
          />
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-3 sm:px-4 py-8 sm:py-12">
        <div className="rounded-2xl sm:rounded-3xl border-2 border-primary/20 bg-gradient-subtle p-4 sm:p-6 md:p-10 text-center shadow-strong">
          <h3 className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Prêt à transformer tes idées en visuels ?
          </h3>
          <p className="mt-2 text-sm sm:text-base text-slate-600">Crée ton compte, connecte ton Canva et génère tes premiers visuels en moins d&apos;une minute.</p>
          <div className="mt-4 sm:mt-6 flex justify-center">
            <Button size="lg" className="gradient-hero text-white shadow-medium text-sm sm:text-base" onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>
              Commencer maintenant 🚀
            </Button>
          </div>
          <p className="mt-2 sm:mt-3 text-[10px] sm:text-xs text-slate-500 flex items-center justify-center gap-1"><Shield className="h-3 w-3"/> Aucune publication automatique — tu restes maître.</p>
        </div>
      </section>

      {/* Community Program */}
      <section className="max-w-6xl mx-auto px-3 sm:px-4 py-8 sm:py-14">
        <div className="grid md:grid-cols-2 gap-6 sm:gap-8 items-center">
          <div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">
              Rejoins la communauté <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">Alfie Creators</span>
            </h2>
            <p className="text-base sm:text-lg text-slate-600 mb-4 sm:mb-6">
              Partage Alfie avec d&apos;autres créateurs et construis ton réseau. Plus tu accompagnes de personnes, plus tu es récompensé. Simple, transparent, communautaire.
            </p>
            <ul className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
              <li className="flex items-start gap-3">
                <div className="bg-green-500 text-white rounded-full p-1 mt-0.5">
                  <Check className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold">Recommande & Gagne</p>
                  <p className="text-sm text-slate-600">Touche des revenus récurrents sur chaque membre que tu parraines</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="bg-blue-500 text-white rounded-full p-1 mt-0.5">
                  <Check className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold">Construis ton réseau</p>
                  <p className="text-sm text-slate-600">Bénéficie de la croissance de ton équipe sur plusieurs niveaux</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="bg-purple-500 text-white rounded-full p-1 mt-0.5">
                  <Check className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold">Évolue avec ta communauté</p>
                  <p className="text-sm text-slate-600">Accède à des statuts exclusifs et des avantages premium</p>
                </div>
              </li>
            </ul>
            <Button 
              size="lg" 
              className="gradient-hero text-white shadow-medium gap-2"
              onClick={() => window.location.href = '/devenir-partenaire'}
            >
              Devenir Partenaire <Share2 className="h-5 w-5" />
            </Button>
          </div>
          <div className="relative mt-6 md:mt-0">
            <div className="rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 p-4 sm:p-8 border-2 border-primary/20 shadow-strong">
              <div className="space-y-3 sm:space-y-4">
                <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-medium">
                  <div className="flex items-center gap-2 sm:gap-3 mb-2">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center text-white font-bold text-sm sm:text-base">
                      15%
                    </div>
                    <div>
                      <p className="font-semibold text-sm sm:text-base">Niveau 1</p>
                      <p className="text-[10px] sm:text-xs text-slate-500">Tes filleuls directs</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-medium ml-4 sm:ml-6">
                  <div className="flex items-center gap-2 sm:gap-3 mb-2">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm sm:text-base">
                      5%
                    </div>
                    <div>
                      <p className="font-semibold text-sm sm:text-base">Niveau 2</p>
                      <p className="text-[10px] sm:text-xs text-slate-500">Le réseau de ton réseau</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-medium ml-8 sm:ml-12">
                  <div className="flex items-center gap-2 sm:gap-3 mb-2">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm sm:text-base">
                      2%
                    </div>
                    <div>
                      <p className="font-semibold text-sm sm:text-base">Niveau 3</p>
                      <p className="text-[10px] sm:text-xs text-slate-500">Réseau étendu</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 sm:mt-6 text-center">
                <p className="text-xs sm:text-sm text-slate-600">
                  <strong>Exemple:</strong> Avec 5 filleuls → 15 niveau 2 → 45 niveau 3
                </p>
                <p className="text-xl sm:text-2xl font-bold text-primary mt-2">
                  ≈70€/mois récurrents 💰
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8 grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 text-xs sm:text-sm text-slate-600">
          <div>
            <div className="font-semibold mb-2">Alfie Designer</div>
            <p>Agent de création IA. Tes visuels restent stockés dans ton compte Canva.</p>
          </div>
          <div>
            <div className="font-semibold mb-2">Ressources</div>
            <ul className="space-y-1">
              <li><a className="hover:underline hover:text-primary transition-colors" href="#">Guide de démarrage</a></li>
              <li><a className="hover:underline hover:text-primary transition-colors cursor-pointer" onClick={() => window.location.href = '/faq'}>FAQ</a></li>
              <li><a className="hover:underline hover:text-primary transition-colors cursor-pointer" onClick={() => window.location.href = '/devenir-partenaire'}>Programme Partenaire 💰</a></li>
            </ul>
          </div>
          <div>
            <div className="font-semibold mb-2">Légal</div>
            <ul className="space-y-1">
              <li><a className="hover:underline hover:text-primary transition-colors cursor-pointer" onClick={() => window.location.href = '/privacy'}>Confidentialité</a></li>
              <li><a className="hover:underline hover:text-primary transition-colors cursor-pointer" onClick={() => window.location.href = '/legal'}>Mentions légales & CGU</a></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}

function MiniCard({ icon, title, subtitle, onClick, image }: { icon: React.ReactNode; title: string; subtitle: string; onClick?: ()=>void; image?: string }) {
  return (
    <button onClick={onClick} className="group relative text-left rounded-xl sm:rounded-2xl border border-slate-200 overflow-hidden hover:shadow-md hover:border-slate-300 transition h-28 sm:h-32">
      {/* Background Image */}
      {image && (
        <div className="absolute inset-0 opacity-30 group-hover:opacity-40 transition-opacity">
          <img src={image} alt={title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-white/90 to-transparent"></div>
        </div>
      )}
      
      {/* Content */}
      <div className="relative h-full p-2.5 sm:p-4 flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <span className="inline-flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-lg sm:rounded-xl bg-slate-900 text-white shadow-md">{icon}</span>
          <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all" />
        </div>
        <div>
          <div className="font-semibold text-xs sm:text-sm">{title}</div>
          <div className="text-[10px] sm:text-xs text-slate-500">{subtitle}</div>
        </div>
      </div>
    </button>
  );
}

function TemplateCard({ title, subtitle, ratios, image }: { title: string; subtitle: string; ratios: string; image?: string }) {
  return (
    <Card className="rounded-2xl sm:rounded-3xl">
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="flex items-center justify-between text-base sm:text-lg">
          {title}
          <Badge variant="outline" className="text-[10px] sm:text-xs">{ratios}</Badge>
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">{subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0">
        <div className="aspect-[4/3] rounded-xl sm:rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden">
          {image ? (
            <img src={image} alt={`Aperçu ${title}`} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full grid place-items-center text-slate-500 text-xs sm:text-base">
              Aperçu {title}
            </div>
          )}
        </div>
        <ul className="mt-3 sm:mt-4 space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-slate-600">
          <li className="flex items-center gap-1.5 sm:gap-2"><Check className="h-3 w-3 sm:h-4 sm:w-4"/> Brand Kit appliqué</li>
          <li className="flex items-center gap-1.5 sm:gap-2"><Check className="h-3 w-3 sm:h-4 sm:w-4"/> Textes générés (Hook/Steps/CTA)</li>
          <li className="flex items-center gap-1.5 sm:gap-2"><Check className="h-3 w-3 sm:h-4 sm:w-4"/> Planif dans Canva (client maître)</li>
        </ul>
      </CardContent>
    </Card>
  );
}

function PriceCard({ 
  title, 
  planKey,
  price, 
  priceLabel, 
  bullets, 
  cta, 
  highlight, 
  isAnnual,
  onSelect,
  loading
}: { 
  title: string; 
  planKey: string;
  price: string; 
  priceLabel: string; 
  bullets: string[]; 
  cta: string; 
  highlight?: boolean; 
  isAnnual?: boolean;
  onSelect: () => void;
  loading?: boolean;
}) {
  return (
    <Card className={`rounded-2xl sm:rounded-3xl hover:scale-105 transition-transform ${highlight ? "border-primary border-2 shadow-strong" : "shadow-medium"}`}>
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="flex items-center justify-between text-base sm:text-lg">
          {title}
          {highlight && <Badge className="bg-gradient-to-r from-primary to-secondary text-white text-[10px] sm:text-xs">⭐ Populaire</Badge>}
        </CardTitle>
        <CardDescription>
          <div className="flex items-baseline gap-1.5 sm:gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">{price}</span>
            <span className="text-slate-500 text-xs sm:text-sm">{priceLabel}</span>
          </div>
          {isAnnual && (
            <Badge className="bg-green-500 text-white mt-1.5 sm:mt-2 text-[10px] sm:text-xs">-20%</Badge>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0">
        <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-center gap-1.5 sm:gap-2"><Check className="h-3 w-3 sm:h-4 sm:w-4"/> {b}</li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="p-4 sm:p-6 pt-0">
        <Button 
          className={`w-full text-xs sm:text-sm ${highlight ? 'gradient-hero text-white shadow-medium' : ''}`} 
          variant={highlight ? "default" : "outline"}
          onClick={onSelect}
          disabled={loading}
        >
          {loading ? 'Chargement...' : cta}
        </Button>
      </CardFooter>
    </Card>
  );
}
