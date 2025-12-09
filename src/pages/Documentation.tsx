import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  MessageCircle, 
  Palette, 
  Image, 
  Video, 
  LayoutGrid, 
  Download, 
  Users, 
  HelpCircle,
  Sparkles,
  Dog,
  ArrowRight,
  CheckCircle2,
  Lightbulb,
  Play
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Documentation() {
  const navigate = useNavigate();

  return (
    <div className="container max-w-4xl py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <Badge variant="secondary" className="text-sm">Documentation</Badge>
        <h1 className="text-4xl font-bold">Bienvenue sur Alfie Designer 🐾</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Ton assistant IA créatif pour générer des visuels professionnels en quelques secondes.
        </p>
      </div>

      {/* Interactive Tour CTA */}
      <Card className="border-alfie-mint/30 bg-alfie-mint/5">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-alfie-mint/20 flex items-center justify-center">
                <Play className="h-6 w-6 text-alfie-mint" />
              </div>
              <div>
                <p className="font-medium">Découvrir en 2 minutes</p>
                <p className="text-sm text-muted-foreground">
                  Tour interactif de l'interface
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="text-sm">
              🚀 À venir
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Quick Start */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Démarrage rapide
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Créer avec Alfie, c'est simple comme bonjour :
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-background">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">1</div>
              <div>
                <p className="font-medium">Ouvre le chat</p>
                <p className="text-sm text-muted-foreground">Clique sur la bulle en bas à droite</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-lg bg-background">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">2</div>
              <div>
                <p className="font-medium">Décris ton besoin</p>
                <p className="text-sm text-muted-foreground">"Crée-moi 3 images pour ma promo"</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-lg bg-background">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">3</div>
              <div>
                <p className="font-medium">Confirme et génère</p>
                <p className="text-sm text-muted-foreground">Ajuste les options et lance !</p>
              </div>
            </div>
          </div>
          <Button onClick={() => navigate("/dashboard")} className="w-full md:w-auto">
            Commencer à créer <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Chat with Alfie */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <MessageCircle className="h-6 w-6 text-primary" />
          Discuter avec Alfie
        </h2>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p>
              Alfie est ton assistant créatif IA. Parle-lui naturellement pour créer tes visuels :
            </p>
            <div className="grid gap-3">
              <div className="p-3 rounded-lg bg-muted/50 border-l-4 border-primary">
                <p className="font-medium">"Crée-moi un carrousel sur mes 5 conseils nutrition"</p>
                <p className="text-sm text-muted-foreground">→ Alfie génère 5 slides avec textes et visuels</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 border-l-4 border-primary">
                <p className="font-medium">"Je veux 3 images pour ma promo Black Friday"</p>
                <p className="text-sm text-muted-foreground">→ Alfie crée 3 visuels promotionnels</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 border-l-4 border-primary">
                <p className="font-medium">"Une vidéo teaser pour mon nouveau produit avec cette photo"</p>
                <p className="text-sm text-muted-foreground">→ Alfie anime ton image en vidéo 6 secondes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Visual Styles */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Palette className="h-6 w-6 text-primary" />
          Styles Visuels
        </h2>
        <Card>
          <CardContent className="pt-6">
            <p className="mb-4">
              Alfie détecte automatiquement le style adapté à ta demande, mais tu peux l'ajuster :
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 rounded-lg border space-y-2">
                <Badge variant="outline">🎨 Fond</Badge>
                <p className="font-medium">Arrière-plans abstraits</p>
                <p className="text-sm text-muted-foreground">
                  Dégradés, textures, motifs. Parfait pour les citations, annonces, promos.
                </p>
              </div>
              <div className="p-4 rounded-lg border space-y-2">
                <Badge variant="outline">🧑‍🎨 Personnage</Badge>
                <p className="font-medium">Mascotte 3D style Pixar</p>
                <p className="text-sm text-muted-foreground">
                  Avatar de marque, personnage récurrent. Idéal pour humaniser ta com.
                </p>
              </div>
              <div className="p-4 rounded-lg border space-y-2">
                <Badge variant="outline">📦 Produit</Badge>
                <p className="font-medium">Mise en valeur produit</p>
                <p className="text-sm text-muted-foreground">
                  Packshot, photo produit sublimée. Nécessite une image de référence.
                </p>
              </div>
            </div>
            <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-sm flex items-start gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <span>
                  <strong>Astuce :</strong> Tu peux aussi choisir entre "Coloré" (couleurs vives) et "Pastel" (tons doux) avant de générer.
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Content Types */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Image className="h-6 w-6 text-primary" />
          Types de Contenus
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Image className="h-5 w-5" /> Images
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Visuels statiques pour tes posts, stories, publicités.
              </p>
              <div className="text-sm">
                <span className="font-medium">Coût :</span> 1 Woof / image
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <LayoutGrid className="h-5 w-5" /> Carrousels
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                5 slides avec textes générés par IA. Export CSV pour Canva inclus.
              </p>
              <div className="text-sm">
                <span className="font-medium">Coût :</span> 10 Woofs / carrousel
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Video className="h-5 w-5" /> Vidéos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Animations 6 secondes à partir de tes images. Parfait pour les Reels.
              </p>
              <div className="text-sm">
                <span className="font-medium">Coût :</span> 25 Woofs / vidéo
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Woofs System */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Dog className="h-6 w-6 text-primary" />
          Système de Woofs
        </h2>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p>
              Les <strong>Woofs</strong> sont ta monnaie créative sur Alfie. Chaque génération consomme des Woofs selon le type de contenu :
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Type</th>
                    <th className="text-left py-2 font-medium">Coût</th>
                    <th className="text-left py-2 font-medium">Exemple</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="py-2">Image</td>
                    <td className="py-2">1 Woof</td>
                    <td className="py-2 text-muted-foreground">150 Woofs = 150 images</td>
                  </tr>
                  <tr>
                    <td className="py-2">Carrousel (5 slides)</td>
                    <td className="py-2">10 Woofs</td>
                    <td className="py-2 text-muted-foreground">150 Woofs = 15 carrousels</td>
                  </tr>
                  <tr>
                    <td className="py-2">Vidéo (6s)</td>
                    <td className="py-2">25 Woofs</td>
                    <td className="py-2 text-muted-foreground">150 Woofs = 6 vidéos</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="p-3 rounded-lg bg-primary/10">
              <p className="text-sm">
                <strong>Tes Woofs se rechargent chaque mois</strong> selon ton plan : Starter (150), Pro (450), Studio (1000).
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Brand Kit */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Palette className="h-6 w-6 text-primary" />
          Ton Brand Kit
        </h2>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p>
              Configure ta marque une fois, Alfie l'utilise pour toutes tes créations :
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Couleurs</p>
                  <p className="text-sm text-muted-foreground">Palette de marque automatiquement appliquée</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Voix & Ton</p>
                  <p className="text-sm text-muted-foreground">Style de communication personnalisé</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Niche / Secteur</p>
                  <p className="text-sm text-muted-foreground">Visuels adaptés à ton industrie</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Style Visuel</p>
                  <p className="text-sm text-muted-foreground">Préférences d'illustrations, photos, mood</p>
                </div>
              </div>
            </div>
            <Button variant="outline" onClick={() => navigate("/brand-kit")}>
              Configurer mon Brand Kit
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Library */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Download className="h-6 w-6 text-primary" />
          Bibliothèque & Export
        </h2>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p>
              Tous tes visuels sont sauvegardés dans ta bibliothèque, classés par type :
            </p>
            <div className="grid gap-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                <span><strong>Téléchargement direct</strong> — Clique sur n'importe quel visuel pour le télécharger</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                <span><strong>Export CSV Canva</strong> — Exporte tes textes de carrousel pour Canva Bulk Create</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                <span><strong>Copie des textes</strong> — Récupère facilement les textes générés par Alfie</span>
              </div>
            </div>
            <Button variant="outline" onClick={() => navigate("/library")}>
              Voir ma Bibliothèque
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Affiliate */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          Programme Partenaire
        </h2>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p>
              Gagne des revenus en recommandant Alfie à ton réseau :
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="p-4 rounded-lg border text-center">
                <p className="text-2xl font-bold text-primary">15%</p>
                <p className="text-sm text-muted-foreground">Commission Niveau 1</p>
                <p className="text-xs text-muted-foreground">Tes filleuls directs</p>
              </div>
              <div className="p-4 rounded-lg border text-center">
                <p className="text-2xl font-bold text-primary">5%</p>
                <p className="text-sm text-muted-foreground">Commission Niveau 2</p>
                <p className="text-xs text-muted-foreground">Les filleuls de tes filleuls</p>
              </div>
              <div className="p-4 rounded-lg border text-center">
                <p className="text-2xl font-bold text-primary">2%</p>
                <p className="text-sm text-muted-foreground">Commission Niveau 3</p>
                <p className="text-xs text-muted-foreground">3ème niveau de parrainage</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => navigate("/affiliate")}>
              Rejoindre le programme
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Help */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <HelpCircle className="h-6 w-6 text-primary" />
          Besoin d'aide ?
        </h2>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="p-4 rounded-lg border">
                <p className="font-medium mb-2">💬 Discute avec Alfie</p>
                <p className="text-sm text-muted-foreground">
                  Alfie peut aussi répondre à tes questions sur l'utilisation de la plateforme !
                </p>
              </div>
              <div className="p-4 rounded-lg border">
                <p className="font-medium mb-2">❓ Guide interactif</p>
                <p className="text-sm text-muted-foreground">
                  Clique sur l'icône "?" dans le Dashboard pour relancer le tour guidé.
                </p>
              </div>
            </div>
            <div className="flex gap-3 flex-wrap">
              <Button variant="outline" onClick={() => navigate("/faq")}>
                Voir la FAQ
              </Button>
              <Button variant="outline" onClick={() => navigate("/contact")}>
                Nous contacter
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* CTA */}
      <Card className="border-primary bg-primary/5">
        <CardContent className="pt-6 text-center space-y-4">
          <h3 className="text-xl font-bold">Prêt à créer ? 🚀</h3>
          <p className="text-muted-foreground">
            Ouvre le chat et dis à Alfie ce que tu veux créer. C'est parti !
          </p>
          <Button size="lg" onClick={() => navigate("/dashboard")}>
            Aller au Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
