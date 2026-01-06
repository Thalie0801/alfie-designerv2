import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      return json({ error: "Stripe not configured" }, 500);
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    console.log("[admin-create-upsell-product] Creating Pack 30 Visuels product...");

    // Créer le produit
    const product = await stripe.products.create({
      name: "Pack 30 Visuels Réutilisables",
      description: "30 visuels marketing prêts à l'emploi générés avec votre Brand Kit (5 structures × 6 variations)",
      metadata: {
        type: "upsell",
        visuals_count: "30"
      }
    });

    console.log("[admin-create-upsell-product] Product created:", product.id);

    // Créer le prix à 19€
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: 1900, // 19€ en centimes
      currency: "eur",
      lookup_key: "price_upsell_visuels_30",
      metadata: {
        type: "upsell",
        visuals_count: "30"
      }
    });

    console.log("[admin-create-upsell-product] Price created:", price.id);

    return json({
      ok: true,
      product: {
        id: product.id,
        name: product.name,
        description: product.description
      },
      price: {
        id: price.id,
        amount: 19,
        currency: "eur",
        lookup_key: price.lookup_key
      },
      message: "Produit et prix créés avec succès! Utilisez ce price_id dans votre code: " + price.id
    });

  } catch (error: any) {
    console.error("[admin-create-upsell-product] Error:", error);
    return json({ 
      error: "Erreur lors de la création du produit",
      details: error.message 
    }, 500);
  }
});
