import { ReactNode } from "react";
import { Card } from "@/components/ui/card";

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  gradient?: "hero" | "warm" | "subtle";
}

export const FeatureCard = ({ icon, title, description, gradient = "subtle" }: FeatureCardProps) => {
  return (
    <Card className="group relative overflow-hidden p-6 hover:shadow-strong transition-all duration-500 border-2 hover:border-primary/50">
      <div className={`absolute -top-20 -right-20 w-40 h-40 gradient-${gradient} rounded-full blur-3xl opacity-0 group-hover:opacity-30 transition-opacity duration-500`} />
      
      <div className="relative space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-hero flex items-center justify-center text-white shadow-medium group-hover:scale-110 transition-transform duration-300">
          {icon}
        </div>
        
        <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
          {title}
        </h3>
        
        <p className="text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
    </Card>
  );
};
