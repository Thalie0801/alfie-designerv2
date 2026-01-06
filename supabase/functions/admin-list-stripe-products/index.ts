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

    console.log("[admin-list-stripe-products] Fetching all products and prices...");

    // Récupérer tous les produits actifs
    const products = await stripe.products.list({ 
      limit: 100,
      active: true 
    });

    // Récupérer tous les prix actifs
    const prices = await stripe.prices.list({ 
      limit: 100,
      active: true,
      expand: ['data.product']
    });

    // Formater les résultats pour faciliter la lecture
    const formattedPrices = prices.data.map((price: any) => ({
      price_id: price.id,
      product_id: typeof price.product === 'string' ? price.product : price.product?.id,
      product_name: typeof price.product === 'object' ? price.product?.name : null,
      amount: price.unit_amount ? price.unit_amount / 100 : null,
      currency: price.currency,
      type: price.type,
      recurring: price.recurring,
      lookup_key: price.lookup_key,
      active: price.active,
      created: new Date(price.created * 1000).toISOString()
    }));

    // Filtrer pour trouver les prix à 19€
    const pricesAt19 = formattedPrices.filter((p: any) => p.amount === 19);

    console.log(`[admin-list-stripe-products] Found ${products.data.length} products and ${prices.data.length} prices`);
    console.log(`[admin-list-stripe-products] Prices at 19€:`, pricesAt19);

    return json({
      ok: true,
      summary: {
        total_products: products.data.length,
        total_prices: prices.data.length,
        prices_at_19_euros: pricesAt19
      },
      products: products.data.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        active: p.active,
        created: new Date(p.created * 1000).toISOString()
      })),
      prices: formattedPrices
    });

  } catch (error: any) {
    console.error("[admin-list-stripe-products] Error:", error);
    return json({ 
      error: "Erreur lors de la récupération des produits Stripe",
      details: error.message 
    }, 500);
  }
});
