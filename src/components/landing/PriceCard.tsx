import { Check, Sparkles, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export type BillingPlan = "starter" | "pro" | "studio" | "enterprise";
export type BillingPeriod = "monthly" | "annual";
export type AITier = "standard" | "premium";

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
  aiTier?: AITier;
  onSelectPlan: (plan: BillingPlan) => void;
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
  aiTier = "standard",
  onSelectPlan,
}: PriceCardProps) {
  const isPremium = aiTier === "premium";
  
  return (
    <Card
      className={`relative border-slate-200 bg-white shadow-lg transition-all hover:shadow-2xl ${
        popular ? "border-alfie-mint border-2 shadow-xl scale-105" : ""
      }`}
    >
      {popular && (
        <div className="absolute -top-4 left-0 right-0 flex justify-center">
          <Badge className="bg-alfie-mint text-slate-900 shadow-lg">Le plus populaire</Badge>
        </div>
      )}
      <CardHeader className="pb-8 pt-8 text-center">
        <CardTitle className="mb-2 text-2xl">{title}</CardTitle>
        
        {/* Badge IA Standard / Premium */}
        <div className="mb-3 flex justify-center">
          {isPremium ? (
            <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white gap-1 px-3 py-1">
              <Sparkles className="h-3 w-3" />
              IA PREMIUM
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1 px-3 py-1 bg-slate-200 text-slate-700">
              <Zap className="h-3 w-3" />
              IA Standard
            </Badge>
          )}
        </div>
        
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
          onClick={() => onSelectPlan(plan)}
        >
          Commencer
        </Button>
      </CardFooter>
    </Card>
  );
}
