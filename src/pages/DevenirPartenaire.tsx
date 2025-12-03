import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Users, Award, Crown, Target, Sparkles, ArrowRight } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function DevenirPartenaire() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur bg-white/70 border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-white shadow-sm">
              <Sparkles className="h-5 w-5"/>
            </span>
            <span className="font-semibold">Alfie Designer</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" onClick={() => window.location.href = '/'}>
              Retour
            </Button>
            <Button onClick={() => window.location.href = '/auth'}>
              Devenir Partenaire
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 py-14">
        <div className="text-center max-w-3xl mx-auto">
          <Badge className="bg-gradient-to-r from-primary to-secondary text-white mb-4">
            Programme Partenaire
          </Badge>
          <h1 className="text-4xl md:text-5xl font-extrabold leading-tight mb-6">
            Rejoins la communauté <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">Alfie Creators</span>
          </h1>
          <p className="text-xl text-slate-600 mb-8">
            Transforme ta passion pour la création en revenus récurrents. Recommande Alfie, accompagne des créateurs, et construis ton réseau rémunéré.
          </p>
          <Button size="lg" className="gradient-hero text-white shadow-medium gap-2" onClick={() => window.location.href = '/auth'}>
            Commencer maintenant <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <h2 className="text-3xl font-bold text-center mb-12 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Comment ça marche ?
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <Card className="border-2 border-primary/20 shadow-medium hover:shadow-strong transition-shadow">
            <CardHeader>
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center text-white text-2xl font-bold mb-4 mx-auto">
                1
              </div>
              <CardTitle className="text-center">Inscris-toi</CardTitle>
              <CardDescription className="text-center">
                Crée ton compte Alfie et active ton statut de partenaire
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Accès complet à l&apos;outil
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Lien de parrainage unique
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Dashboard de suivi
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-500/20 shadow-medium hover:shadow-strong transition-shadow">
            <CardHeader>
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-2xl font-bold mb-4 mx-auto">
                2
              </div>
              <CardTitle className="text-center">Partage & Accompagne</CardTitle>
              <CardDescription className="text-center">
                Recommande Alfie à d&apos;autres créateurs et aide-les à démarrer
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-blue-500" />
                  Partage ton lien
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-blue-500" />
                  Accompagne tes filleuls
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-blue-500" />
                  Construis ta communauté
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-500/20 shadow-medium hover:shadow-strong transition-shadow">
            <CardHeader>
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-2xl font-bold mb-4 mx-auto">
                3
              </div>
              <CardTitle className="text-center">Gagne des revenus</CardTitle>
              <CardDescription className="text-center">
                Reçois des commissions récurrentes sur 3 niveaux
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-purple-500" />
                  Paiements mensuels
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-purple-500" />
                  Revenus passifs
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-purple-500" />
                  Croissance exponentielle
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Commission Structure */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <h2 className="text-3xl font-bold text-center mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Structure de commissions
        </h2>
        <p className="text-center text-slate-600 mb-12 max-w-2xl mx-auto">
          Un système transparent et équitable qui récompense ta contribution et celle de ton réseau
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="border-2 border-green-500/30 shadow-medium hover:scale-105 transition-transform">
            <CardHeader className="bg-gradient-to-br from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20">
              <div className="flex items-center justify-between mb-4">
                <Badge className="bg-green-500 text-white">Niveau 1</Badge>
                <div className="text-3xl font-bold text-green-600">15%</div>
              </div>
              <CardTitle>Tes filleuls directs</CardTitle>
              <CardDescription>
                Commission sur chaque personne que tu parraines directement
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Abonnement minimum 99€/mois</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Commission mensuelle récurrente</span>
                </div>
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg mt-4">
                  <p className="text-sm font-medium text-green-700 dark:text-green-300">
                    Exemple: 5 filleuls × 99€ × 15% = <strong>74,25€/mois</strong>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-500/30 shadow-medium hover:scale-105 transition-transform">
            <CardHeader className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
              <div className="flex items-center justify-between mb-4">
                <Badge className="bg-blue-500 text-white">Niveau 2</Badge>
                <div className="text-3xl font-bold text-blue-600">5%</div>
              </div>
              <CardTitle>Réseau indirect</CardTitle>
              <CardDescription>
                Les filleuls de tes filleuls (débloquer avec 3+ filleuls)
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-blue-500" />
                  <span>Statut Mentor requis</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-blue-500" />
                  <span>≥3 filleuls actifs</span>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg mt-4">
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    Exemple: 15 niveau 2 × 99€ × 5% = <strong>74,25€/mois</strong>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-500/30 shadow-medium hover:scale-105 transition-transform">
            <CardHeader className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
              <div className="flex items-center justify-between mb-4">
                <Badge className="bg-purple-500 text-white">Niveau 3</Badge>
                <div className="text-3xl font-bold text-purple-600">2%</div>
              </div>
              <CardTitle>Réseau étendu</CardTitle>
              <CardDescription>
                Le réseau de ton niveau 2 (débloquer avec 5+ filleuls)
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-purple-500" />
                  <span>Statut Leader requis</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-purple-500" />
                  <span>≥5 filleuls actifs</span>
                </div>
                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg mt-4">
                  <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
                    Exemple: 45 niveau 3 × 99€ × 2% = <strong>89,10€/mois</strong>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-12 text-center">
          <Card className="max-w-2xl mx-auto border-2 border-primary/30 shadow-strong">
            <CardHeader className="bg-gradient-subtle">
              <CardTitle className="text-2xl">Exemple de revenus potentiels</CardTitle>
              <CardDescription>Avec une équipe de 65 membres sur 3 niveaux</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <span>5 filleuls directs (15%)</span>
                  <span className="font-bold text-green-600">74,25€</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <span>15 niveau 2 (5%)</span>
                  <span className="font-bold text-blue-600">74,25€</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <span>45 niveau 3 (2%)</span>
                  <span className="font-bold text-purple-600">89,10€</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg border-2 border-primary/30">
                  <span className="text-lg font-bold">Total mensuel récurrent</span>
                  <span className="text-3xl font-extrabold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                    ≈238€/mois
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Status Progression */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <h2 className="text-3xl font-bold text-center mb-12 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Évolution & Statuts
        </h2>

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="border-2 border-green-500/20 hover:shadow-strong transition-shadow">
            <CardHeader className="text-center">
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center text-white mb-4">
                <Target className="h-10 w-10" />
              </div>
              <CardTitle>Créateur</CardTitle>
              <CardDescription>Statut de départ</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Abonnement actif requis
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Commission niveau 1: 15%
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Lien de parrainage
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-500/20 hover:shadow-strong transition-shadow">
            <CardHeader className="text-center">
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white mb-4">
                <Award className="h-10 w-10" />
              </div>
              <CardTitle>Mentor</CardTitle>
              <CardDescription>≥3 filleuls actifs</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-blue-500" />
                  Commissions niveaux 1 + 2
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-blue-500" />
                  15% + 5%
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-blue-500" />
                  Badge exclusif
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-500/20 hover:shadow-strong transition-shadow">
            <CardHeader className="text-center">
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white mb-4">
                <Crown className="h-10 w-10" />
              </div>
              <CardTitle>Leader</CardTitle>
              <CardDescription>≥5 filleuls actifs</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-purple-500" />
                  Commissions niveaux 1 + 2 + 3
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-purple-500" />
                  15% + 5% + 2%
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-purple-500" />
                  Avantages premium
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-4xl mx-auto px-4 py-12">
        <h2 className="text-3xl font-bold text-center mb-12">Questions fréquentes</h2>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Comment devenir partenaire ?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600">
                Il suffit de créer un compte Alfie Designer. Tous les utilisateurs actifs (avec un abonnement ≥99€/mois) deviennent automatiquement partenaires et reçoivent leur lien de parrainage unique.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quand suis-je payé ?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600">
                Les commissions sont calculées mensuellement et versées au début du mois suivant. Tu peux suivre tes gains en temps réel depuis ton dashboard.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Comment débloquer les niveaux 2 et 3 ?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600">
                Le niveau 2 se débloque automatiquement dès que tu as 3 filleuls actifs (statut Mentor). Le niveau 3 se débloque avec 5 filleuls actifs (statut Leader). Pas de condition cachée !
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Puis-je perdre mes commissions ?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600">
                Les commissions sont récurrentes tant que tes filleuls restent abonnés. Si ton propre abonnement n&apos;est plus actif, tu ne touches plus de commissions sur ton réseau.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-4xl mx-auto px-4 py-14">
        <Card className="border-2 border-primary/30 shadow-strong bg-gradient-subtle">
          <CardContent className="text-center py-12">
            <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Prêt à rejoindre la communauté ?
            </h2>
            <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto">
              Commence dès maintenant à utiliser Alfie pour tes créations et partage ton expérience avec d&apos;autres créateurs.
            </p>
            <Button size="lg" className="gradient-hero text-white shadow-medium gap-2" onClick={() => window.location.href = '/auth'}>
              <Users className="h-5 w-5" />
              Devenir Partenaire
            </Button>
            <p className="mt-4 text-sm text-slate-500">
              ✓ Aucun engagement • ✓ Revenus récurrents • ✓ Support dédié
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-white">
        <div className="max-w-6xl mx-auto px-4 py-8 text-center text-sm text-slate-600">
          <p>© 2025 Alfie Designer • Programme Partenaire</p>
        </div>
      </footer>
    </div>
  );
}