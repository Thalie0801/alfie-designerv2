import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export type BillingPlan = "starter" | "pro" | "studio" | "enterprise";
export type BillingPeriod = "monthly" | "annual";

export interface PriceCardProps {
  title: string;
  monthlyPrice: number;
  isAnnual: boolean;
  calculatePrice: (price: number) => string;
  calculateOriginalAnnualPrice: (price: number) => number;
  getPriceLabel: () => string;
  features: string[];
  plan: BillingPlan;
  popular?: boolean;
  onCheckout: (plan: BillingPlan) => void;
  checkoutLoading: boolean;
}

export function PriceCard({
  title,
  monthlyPrice,
  isAnnual,
  calculatePrice,
  calculateOriginalAnnualPrice,
  getPriceLabel,
  features,
  plan,
  popular,
  onCheckout,
  checkoutLoading,
}: PriceCardProps) {
  return (
    <Card
      className={`relative border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:shadow-2xl ${
        popular ? "border-alfie-mint shadow-xl scale-105" : ""
      }`}
    >
      {popular && (
        <div className="absolute -top-4 left-0 right-0 flex justify-center">
          <Badge className="bg-alfie-mint text-slate-900 shadow-lg">Le plus populaire</Badge>
        </div>
      )}
      <CardHeader className="pb-8 pt-8 text-center">
        <CardTitle className="mb-2 text-2xl">{title}</CardTitle>
        <div className="mb-2 flex items-baseline justify-center gap-1">
          <span className="text-5xl font-bold">{calculatePrice(monthlyPrice)}</span>
          <span className="text-muted-foreground">{getPriceLabel()}</span>
        </div>
        {isAnnual && (
          <div className="text-sm text-muted-foreground line-through">
            {calculateOriginalAnnualPrice(monthlyPrice)}€ / an
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-3">
          {features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button
          className="h-12 w-full"
          variant={popular ? "default" : "outline"}
          disabled={checkoutLoading}
          onClick={() => onCheckout(plan)}
        >
          {checkoutLoading ? "Chargement..." : "Commencer"}
        </Button>
      </CardFooter>
    </Card>
  );
}
