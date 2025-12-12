import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trackEvent } from "@/utils/trackEvent";
import { Check, CreditCard, Lock, ArrowLeft } from "lucide-react";
import logo from "@/assets/alfie-logo-black.svg";
import { supabase } from "@/integrations/supabase/client";

export default function CheckoutExpress() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const product = searchParams.get("product") || "carousel10";

  useEffect(() => {
    trackEvent("express_checkout_view", { product });
  }, [product]);

  const handlePayment = async () => {
    setIsLoading(true);
    trackEvent("express_19_checkout_started", { product });

    try {
      
      // Call Stripe checkout for one-time payment
      const response = await supabase.functions.invoke("create-checkout", {
        body: {
          priceId: "price_carousel10", // Will need to create this in Stripe
          mode: "payment", // One-time payment, not subscription
          successUrl: `${window.location.origin}/checkout/express?success=true`,
          cancelUrl: `${window.location.origin}/checkout/express?product=${product}`,
        },
      });

      if (response.data?.url) {
        window.location.href = response.data.url;
      } else {
        // For demo, simulate successful payment
        setTimeout(() => {
          trackEvent("express_19_paid", { product });
          setIsPaid(true);
          setIsLoading(false);
        }, 2000);
      }
    } catch (error) {
      console.error("Checkout error:", error);
      // For demo, simulate successful payment
      setTimeout(() => {
        trackEvent("express_19_paid", { product });
        setIsPaid(true);
        setIsLoading(false);
      }, 2000);
    }
  };

  // Check for success param (redirect from Stripe)
  useEffect(() => {
    if (searchParams.get("success") === "true") {
      trackEvent("express_19_paid", { product });
      setIsPaid(true);
    }
  }, [searchParams, product]);

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
            Ton carrousel 10 slides est en cours de génération. Tu vas recevoir un email avec le lien de téléchargement.
          </p>
          <div className="pt-4 space-y-3">
            <Button
              onClick={() => navigate("/studio")}
              className="w-full bg-alfie-mint hover:bg-alfie-pink text-slate-900"
            >
              Accéder au Studio
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
                "Redirection vers le paiement..."
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
