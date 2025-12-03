import { Link } from "react-router-dom";
import { Users, TrendingUp, Crown, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const highlights = [
  {
    icon: Users,
    title: "15% de commission",
    description: "Sur chaque filleul direct qui s'abonne",
  },
  {
    icon: TrendingUp,
    title: "3 niveaux de revenus",
    description: "Commissions récurrentes sur 3 générations",
  },
  {
    icon: Crown,
    title: "Statuts évolutifs",
    description: "Créateur → Mentor → Leader",
  },
];

export function AffiliateSection() {
  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-6xl">
        {/* Badge */}
        <div className="flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-alfie-lilac/20 px-4 py-1.5 text-sm font-medium text-alfie-lilac">
            🤝 Programme Partenaire
          </span>
        </div>

        {/* Title */}
        <h2 className="mt-6 text-center text-3xl font-bold text-foreground sm:text-4xl">
          Gagne des revenus en recommandant Alfie
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
          Transforme ta passion pour la création de contenu en revenus récurrents mensuels
        </p>

        {/* Highlights */}
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {highlights.map((item) => (
            <div
              key={item.title}
              className="group rounded-2xl border border-border/50 bg-card p-6 text-center transition-all hover:border-alfie-mint/50 hover:shadow-lg"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-alfie-mint/10 text-alfie-mint transition-transform group-hover:scale-110">
                <item.icon className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">
                {item.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {item.description}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 flex justify-center">
          <Button
            asChild
            size="lg"
            className="rounded-full bg-alfie-mint px-8 text-slate-900 hover:bg-alfie-pink"
          >
            <Link to="/devenir-partenaire">
              Devenir Partenaire
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
