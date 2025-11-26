import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

interface MaintenanceScreenProps {
  onRetry: () => void;
}

export function MaintenanceScreen({ onRetry }: MaintenanceScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-destructive/10 p-4">
            <AlertCircle className="w-12 h-12 text-destructive" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            Service temporairement indisponible
          </h1>
          <p className="text-muted-foreground">
            Nous rencontrons actuellement des difficultés techniques. 
            Nos équipes travaillent à résoudre le problème.
          </p>
        </div>

        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Ce problème est généralement résolu en quelques minutes.
          </p>
          <p>
            Vous pouvez réessayer maintenant ou attendre quelques instants.
          </p>
        </div>

        <Button 
          onClick={onRetry} 
          size="lg"
          className="w-full"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Réessayer maintenant
        </Button>

        <p className="text-xs text-muted-foreground">
          Si le problème persiste, contactez le support à{" "}
          <a 
            href="mailto:support@alfie.design" 
            className="text-primary hover:underline"
          >
            support@alfie.design
          </a>
        </p>
      </div>
    </div>
  );
}
