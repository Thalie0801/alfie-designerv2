import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "npm:stripe@18";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WOOFS_PACKS = [
  { size: 50, price: 1000, actualWoofs: 50, name: "Pack Starter - 50 Woofs" },
  { size: 100, price: 1900, actualWoofs: 100, name: "Pack Pro - 100 Woofs" },
  { size: 250, price: 4500, actualWoofs: 250, name: "Pack Studio - 250 Woofs" },
  { size: 500, price: 8500, actualWoofs: 600, name: "Pack Max - 500 Woofs (+100 bonus)" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }

    const stripe = new Stripe(stripeKey);

    // Parse request body for action type
    let action = "woofs_packs"; // default
    try {
      const body = await req.json();
      action = body.action || "woofs_packs";
    } catch {
      // No body or invalid JSON, use default action
    }

    // Action: Create carousel product (19€ one-off)
    if (action === "create_carousel_product") {
      const lookupKey = "price_carousel_10_slides";

      // Check if already exists
      const existingPrices = await stripe.prices.list({
        lookup_keys: [lookupKey],
        limit: 1,
      });

      if (existingPrices.data.length > 0) {
        console.log(`Carousel product already exists: ${existingPrices.data[0].id}`);
        return new Response(
          JSON.stringify({
            success: true,
            message: "Carousel product already exists",
            productId: existingPrices.data[0].product,
            priceId: existingPrices.data[0].id,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create product
      const product = await stripe.products.create({
        name: "Carrousel 10 slides + CSV Canva",
        description: "10 slides de carrousel personnalisés avec ton Brand Kit + export CSV pour Canva Bulk Create",
        metadata: {
          type: "carousel_pack",
          slides: "10",
        },
      });

      // Create price (19€ one-off)
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: 1900, // 19€ in cents
        currency: "eur",
        lookup_key: lookupKey,
        metadata: {
          type: "carousel_pack",
          slides: "10",
        },
      });

      console.log(`Created carousel product with price ${price.id}`);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Carousel product created successfully",
          productId: product.id,
          priceId: price.id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default action: Create Woofs packs
    const createdProducts: Array<{ size: number; productId: string; priceId: string }> = [];

    for (const pack of WOOFS_PACKS) {
      const lookupKey = `price_woofs_pack_${pack.size}`;

      // Check if price already exists with this lookup_key
      const existingPrices = await stripe.prices.list({
        lookup_keys: [lookupKey],
        limit: 1,
      });

      if (existingPrices.data.length > 0) {
        console.log(`Price ${lookupKey} already exists, skipping...`);
        createdProducts.push({
          size: pack.size,
          productId: existingPrices.data[0].product as string,
          priceId: existingPrices.data[0].id,
        });
        continue;
      }

      // Create product
      const product = await stripe.products.create({
        name: pack.name,
        description: `Rechargez ${pack.size} Woofs${pack.actualWoofs > pack.size ? ` (+ ${pack.actualWoofs - pack.size} bonus gratuits!)` : ""}`,
        metadata: {
          woofs: pack.size.toString(),
          actualWoofs: pack.actualWoofs.toString(),
          type: "woofs_pack",
        },
      });

      // Create price with lookup_key
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: pack.price,
        currency: "eur",
        lookup_key: lookupKey,
        metadata: {
          woofs: pack.size.toString(),
          actualWoofs: pack.actualWoofs.toString(),
        },
      });

      console.log(`Created product ${pack.name} with price ${price.id}`);

      createdProducts.push({
        size: pack.size,
        productId: product.id,
        priceId: price.id,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Woofs products created successfully",
        products: createdProducts,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error creating products:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
