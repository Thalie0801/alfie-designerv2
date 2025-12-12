import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trackEvent } from "@/utils/trackEvent";
import { Check, CreditCard, Lock, ArrowLeft, Loader2, Mail } from "lucide-react";
import logo from "@/assets/alfie-logo-black.svg";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Price ID for the 19€ carousel pack - created via Stripe API
const CAROUSEL_PRICE_ID = "price_1SdTBtQvcbGhgt8Sl6H2R4yx";

export default function CheckoutExpress() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const product = searchParams.get("product") || "carousel10";
  const sessionId = searchParams.get("session_id");
  const success = searchParams.get("success");

  useEffect(() => {
    trackEvent("express_checkout_view", { product });
    
    // Get user email for display
    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user?.email || null);
    });
  }, [product]);

  // Verify payment on success redirect
  useEffect(() => {
    if (success === "true" && sessionId) {
      verifyPayment(sessionId);
    }
  }, [success, sessionId]);

  const verifyPayment = async (sid: string) => {
    setIsVerifying(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("verify-express-payment", {
        body: { sessionId: sid },
      });

      if (error) {
        console.error("Verification error:", error);
        toast.error("Erreur lors de la vérification du paiement");
        return;
      }

      if (data?.success) {
        trackEvent("express_19_paid", { product, sessionId: sid });
        setIsPaid(true);
        setUserEmail(data.email || userEmail);
        toast.success("Paiement confirmé ! Ton carrousel est en cours de génération.");
      }
    } catch (err) {
      console.error("Error:", err);
      toast.error("Erreur lors de la vérification");
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePayment = async () => {
    setIsLoading(true);
    trackEvent("express_19_checkout_started", { product });

    try {
      // Get current session
      const { data: session } = await supabase.auth.getSession();
      
      if (!session.session) {
        toast.error("Tu dois être connecté pour effectuer un achat");
        navigate("/auth?redirect=/checkout/express");
        return;
      }

      // Call Stripe checkout for one-time payment
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          mode: "payment",
          price_id: CAROUSEL_PRICE_ID,
          purchase_type: "carousel_pack",
          metadata: {
            product: "carousel10",
          },
        },
      });

      if (error) {
        console.error("Checkout error:", error);
        toast.error("Erreur lors de la création du paiement");
        setIsLoading(false);
        return;
      }

      if (data?.url) {
        // Redirect to Stripe
        window.location.href = data.url;
      } else {
        toast.error("URL de paiement non reçue");
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("Erreur lors du paiement");
      setIsLoading(false);
    }
  };

  // Verifying state
  if (isVerifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-alfie-peach/20 via-white to-alfie-lilac/20 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-alfie-mint mx-auto" />
          <h1 className="text-xl font-bold text-slate-900">Vérification du paiement...</h1>
        </div>
      </div>
    );
  }

  // Success state
  if (isPaid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-alfie-peach/20 via-white to-alfie-lilac/20 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-green-100 flex items-center justify-center">
            <Check className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            Merci pour ton achat ! 🎉
          </h1>
          <p className="text-slate-600">
            Ton carrousel 10 slides est en cours de génération.
          </p>
          
          <div className="bg-alfie-mint/10 rounded-xl p-4 flex items-center gap-3">
            <Mail className="h-5 w-5 text-alfie-mint shrink-0" />
            <div className="text-left">
              <p className="text-sm font-medium text-slate-900">Email de livraison</p>
              <p className="text-sm text-slate-600">{userEmail || "Ton email"}</p>
            </div>
          </div>
          
          <p className="text-sm text-slate-500">
            Tu recevras un email avec les liens de téléchargement dès que ton carrousel sera prêt (environ 2-3 minutes).
          </p>
          
          <div className="pt-4 space-y-3">
            <Button
              onClick={() => navigate("/library")}
              className="w-full bg-alfie-mint hover:bg-alfie-pink text-slate-900"
            >
              Voir ma bibliothèque
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/")}
              className="w-full"
            >
              Retour à l'accueil
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-alfie-peach/20 via-white to-alfie-lilac/20">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-600 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Retour</span>
          </button>
          <img src={logo} alt="Alfie" className="h-7" />
          <div className="w-16" /> {/* Spacer */}
        </div>
      </header>

      <main className="px-4 py-12 max-w-lg mx-auto">
        <div className="bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden">
          {/* Product header */}
          <div className="bg-gradient-to-br from-alfie-mint/30 to-alfie-lilac/30 p-6 text-center">
            <Badge className="bg-white/80 text-slate-700 mb-3">
              Achat unique
            </Badge>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              Carrousel 10 slides
            </h1>
            <p className="text-slate-600">
              + Export CSV pour Canva
            </p>
          </div>

          {/* Price */}
          <div className="p-6 text-center border-b border-slate-100">
            <div className="text-4xl font-bold text-slate-900">
              19€
            </div>
            <p className="text-sm text-slate-500">Paiement unique</p>
          </div>

          {/* Features */}
          <div className="p-6 space-y-3">
            <div className="flex items-center gap-3">
              <Check className="h-5 w-5 text-green-500 shrink-0" />
              <span className="text-slate-700">10 slides avec ton Brand Kit</span>
            </div>
            <div className="flex items-center gap-3">
              <Check className="h-5 w-5 text-green-500 shrink-0" />
              <span className="text-slate-700">Textes générés par IA</span>
            </div>
            <div className="flex items-center gap-3">
              <Check className="h-5 w-5 text-green-500 shrink-0" />
              <span className="text-slate-700">Export CSV Canva Bulk Create</span>
            </div>
            <div className="flex items-center gap-3">
              <Check className="h-5 w-5 text-green-500 shrink-0" />
              <span className="text-slate-700">Images haute résolution</span>
            </div>
            <div className="flex items-center gap-3">
              <Check className="h-5 w-5 text-green-500 shrink-0" />
              <span className="text-slate-700">Livraison immédiate par email</span>
            </div>
          </div>

          {/* CTA */}
          <div className="p-6 bg-slate-50">
            <Button
              size="lg"
              onClick={handlePayment}
              disabled={isLoading}
              className="w-full bg-alfie-mint hover:bg-alfie-pink text-slate-900 font-semibold h-14"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Redirection vers Stripe...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-5 w-5" />
                  Payer 19€
                </>
              )}
            </Button>
            <div className="flex items-center justify-center gap-2 mt-4 text-sm text-slate-500">
              <Lock className="h-4 w-4" />
              <span>Paiement sécurisé par Stripe</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
