import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@18.5.0';
import { createClient as _createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) throw new Error('STRIPE_SECRET_KEY is not set');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header provided');

    // ✅ Décoder le JWT (la fonction est déjà protégée par verify_jwt)
    const token = authHeader.replace('Bearer ', '');
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
    const payload = JSON.parse(atob(padded));

    const userEmail: string | undefined = payload.email || payload.user_metadata?.email;
    const _userId: string | undefined = payload.sub;

    if (!userEmail) throw new Error('User not authenticated or email not available');

    const stripe = new Stripe(stripeKey, { apiVersion: '2025-08-27.basil' });

    const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
    if (customers.data.length === 0) {
      return new Response(
        JSON.stringify({ subscribed: false, status: 'none', current_period_end: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const customerId = customers.data[0].id;
    const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: 'active', limit: 1 });

    if (subscriptions.data.length === 0) {
      return new Response(
        JSON.stringify({ subscribed: false, status: 'none', current_period_end: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const sub = subscriptions.data[0];
    const end = new Date(sub.current_period_end * 1000).toISOString();
    const planName = sub.items.data[0]?.price?.product as string;

    // ✅ Retourner aussi le plan pour UI
    return new Response(
      JSON.stringify({ 
        subscribed: true, 
        status: 'active', 
        current_period_end: end,
        plan_id: planName,
        subscription_id: sub.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[check-subscription] ERROR:', message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
