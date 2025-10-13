import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface VisualTypeCardProps {
  icon: ReactNode;
  type: string;
  title: string;
  description: string;
  ratios: string[];
  color: "blue" | "orange" | "purple" | "green";
}

const colorClasses = {
  blue: "from-primary to-primary-glow",
  orange: "from-secondary to-secondary",
  purple: "from-accent to-accent",
  green: "from-green-500 to-emerald-500",
};

export const VisualTypeCard = ({ icon, type, title, description, ratios, color }: VisualTypeCardProps) => {
  return (
    <Card className="group relative overflow-hidden p-6 hover:shadow-strong transition-all duration-500 cursor-pointer">
      <div className={`absolute inset-0 bg-gradient-to-br ${colorClasses[color]} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />
      
      <div className="relative space-y-4">
        <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center text-white shadow-medium`}>
          {icon}
        </div>
        
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            {type}
          </div>
          <h3 className="text-2xl font-bold text-foreground">
            {title}
          </h3>
        </div>
        
        <p className="text-muted-foreground leading-relaxed">
          {description}
        </p>
        
        <div className="flex flex-wrap gap-2 pt-2">
          {ratios.map((ratio) => (
            <span key={ratio} className="px-3 py-1 rounded-full bg-muted text-xs font-medium">
              {ratio}
            </span>
          ))}
        </div>
        
        <Button className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-all">
          Créer maintenant
          <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>
    </Card>
  );
};
