import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function VerifyReset() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isVerifying, setIsVerifying] = useState(false);

  const token = searchParams.get('token');
  const type = searchParams.get('type');

  const handleConfirmReset = () => {
    if (!token || !type) {
      toast.error("Lien de réinitialisation invalide");
      navigate('/auth');
      return;
    }

    setIsVerifying(true);

    // Construire l'URL de vérification Supabase
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const appOrigin = window.location.origin;
    const verifyUrl = `${supabaseUrl}/auth/v1/verify?token=${encodeURIComponent(token)}&type=${encodeURIComponent(type)}&redirect_to=${encodeURIComponent(appOrigin + '/reset-password')}`;

    console.log('[VerifyReset] Redirecting to verification URL');
    
    // Rediriger vers Supabase pour vérifier le token
    window.location.href = verifyUrl;
  };

  if (!token || !type) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Lien invalide</CardTitle>
            <CardDescription>
              Ce lien de réinitialisation est invalide ou a expiré.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full" 
              onClick={() => navigate('/auth')}
            >
              Retour à la connexion
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Réinitialisation de mot de passe</CardTitle>
          <CardDescription>
            Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour continuer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            className="w-full" 
            onClick={handleConfirmReset}
            disabled={isVerifying}
          >
            {isVerifying ? "Vérification en cours..." : "Confirmer la réinitialisation"}
          </Button>
          <Button 
            variant="ghost" 
            className="w-full" 
            onClick={() => navigate('/auth')}
            disabled={isVerifying}
          >
            Annuler
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
