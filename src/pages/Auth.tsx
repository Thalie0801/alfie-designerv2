import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sparkles, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { getAuthHeader } from "@/lib/auth";

const authSchema = z.object({
  email: z.string().email({ message: "Email invalide" }),
  password: z.string().min(6, { message: "Mot de passe minimum 6 caractères" }),
  fullName: z.string().min(2, { message: "Nom requis" }).optional(),
});

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signUp, user } = useAuth();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const [loading, setLoading] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  // --- Payment params ---
  const sessionId = searchParams.get("session_id");
  const paymentStatus = searchParams.get("payment");
  const hasPaymentSession = Boolean(sessionId && paymentStatus === "success");

  // Empêche plusieurs vérifications si le composant re-render
  const paymentCheckedRef = useRef(false);

  // Vérification de paiement (mémoïsée)
  const verifyPayment = useCallback(
    async (sid: string) => {
      if (!sid) return; // sécurité
      try {
        setVerifyingPayment(true);

        const { data, error } = await supabase.functions.invoke("verify-payment", {
          body: { session_id: sid },
          headers: await getAuthHeader(),
        });

        if (error) throw error;

        toast.success(`Paiement confirmé ! Plan ${data?.plan ?? ""} activé.`);

        // Si l'utilisateur n'est pas loggé, on pré-remplit et passe en signup
        if (!user) {
          setMode("signup");
          if (data?.email) setEmail(data.email);
        } else {
          // Déjà loggé → dashboard
          navigate("/dashboard", { replace: true });
        }
      } catch (err: any) {
        console.error("Payment verification error:", err);
        toast.error("Erreur lors de la vérification du paiement");
      } finally {
        setVerifyingPayment(false);
      }
    },
    [navigate, user],
  );

  // Déclenche la vérification UNE seule fois si la session de paiement est présente
  useEffect(() => {
    if (hasPaymentSession && sessionId && !paymentCheckedRef.current) {
      paymentCheckedRef.current = true;
      verifyPayment(sessionId);
    }
  }, [hasPaymentSession, sessionId, verifyPayment]);

  // Déjà connecté → dashboard (objectif: jamais rediriger vers /billing)
  useEffect(() => {
    if (user && !verifyingPayment) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, verifyingPayment, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate
      const data = authSchema.parse({
        email,
        password,
        fullName: mode === "signup" ? fullName : undefined,
      });

      if (mode === "login") {
        const { error } = await signIn(data.email, data.password);
        if (error) {
          const msg = error.message || "";
          if (msg.includes("Invalid login credentials")) {
            toast.error("Email ou mot de passe incorrect");
          } else if (msg.includes("Email not confirmed")) {
            toast.error("Veuillez confirmer votre email avant de vous connecter");
          } else if (msg.includes("User not found")) {
            toast.error("Aucun compte trouvé avec cet email");
          } else {
            toast.error(`Erreur de connexion: ${msg}`);
          }
        } else {
          toast.success("Connexion réussie !");
          // Redirige explicitement vers dashboard (objectif produit)
          navigate("/dashboard", { replace: true });
        }
      } else {
        const { error } = await signUp(data.email, data.password, fullName);
        if (error) {
          const msg = error.message || "";
          if (msg.includes("already registered") || msg.includes("User already registered")) {
            toast.error("Cet email est déjà enregistré. Essayez de vous connecter.");
            setMode("login");
          } else if (msg.includes("Password should be")) {
            toast.error("Le mot de passe doit contenir au moins 6 caractères");
          } else if (msg.includes("Unable to validate email")) {
            toast.error("Email invalide");
          } else {
            toast.error(`Erreur lors de la création du compte: ${msg}`);
          }
        } else {
          toast.success("Compte créé avec succès ! Bienvenue 🎉");
          // Supabase peut exiger confirmation email → la redirection se fera à la connexion.
          // Si ton signUp connecte automatiquement, on force /dashboard :
          navigate("/dashboard", { replace: true });
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0]?.message ?? "Validation invalide");
      } else {
        toast.error("Une erreur est survenue");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-subtle flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
              <Sparkles className="h-6 w-6" />
            </span>
          </div>
          <CardTitle className="text-2xl">{mode === "login" ? "Connexion" : "Créer un compte"}</CardTitle>
          <CardDescription>
            {mode === "login"
              ? "Connectez-vous pour accéder à Alfie Designer"
              : "Commencez à créer vos visuels avec Alfie"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {verifyingPayment && (
            <Alert className="mb-4 border-green-500/50 bg-green-50 dark:bg-green-900/20">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700 dark:text-green-300">
                Vérification de votre paiement en cours...
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 mt-6">
            {mode === "signup" && (
              <div>
                <Input
                  placeholder="Nom complet"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required={mode === "signup"}
                />
              </div>
            )}

            <div>
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <Input
                type="password"
                placeholder="Mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
              {mode === "login" && (
                <button
                  type="button"
                  onClick={() => toast.info("Fonctionnalité bientôt disponible")}
                  className="text-xs text-primary hover:underline mt-1 block text-right"
                >
                  Mot de passe oublié ?
                </button>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading || verifyingPayment}>
              {loading ? "Chargement..." : mode === "login" ? "Se connecter" : "Créer mon compte"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            {mode === "login" ? (
              <p>
                Pas encore de compte ?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="text-primary hover:underline font-medium"
                >
                  S'inscrire
                </button>
              </p>
            ) : (
              <p>
                Déjà un compte ?{" "}
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="text-primary hover:underline font-medium"
                >
                  Se connecter
                </button>
              </p>
            )}
          </div>

          <div className="mt-6 text-center">
            <Button variant="ghost" onClick={() => navigate("/")} className="text-sm">
              ← Retour à l'accueil
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
