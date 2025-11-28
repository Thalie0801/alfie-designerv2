import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Non authentifié' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Créer client Supabase avec JWT utilisateur
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: { authorization: authHeader }
      }
    });

    // Récupérer l'utilisateur authentifié
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('[request-affiliate-payout] Auth error:', userError);
      return new Response(
        JSON.stringify({ success: false, error: 'Utilisateur non trouvé' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Vérifier que l'utilisateur est un affilié
    const { data: affiliate, error: affiliateError } = await supabase
      .from('affiliates')
      .select('id, status')
      .eq('id', user.id)
      .maybeSingle();

    if (affiliateError) {
      console.error('[request-affiliate-payout] Affiliate lookup error:', affiliateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erreur lors de la vérification du compte affilié' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!affiliate) {
      return new Response(
        JSON.stringify({ success: false, error: 'Compte affilié introuvable' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculer les commissions totales
    const { data: commissions, error: commissionsError } = await supabase
      .from('affiliate_commissions')
      .select('amount')
      .eq('affiliate_id', affiliate.id);

    if (commissionsError) {
      console.error('[request-affiliate-payout] Commissions error:', commissionsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erreur lors du calcul des commissions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const totalCommissions = (commissions || []).reduce(
      (sum, c) => sum + Number(c.amount || 0),
      0
    );

    // Calculer les payouts déjà payés
    const { data: paidPayouts, error: payoutsError } = await supabase
      .from('affiliate_payouts')
      .select('amount, status')
      .eq('affiliate_id', affiliate.id)
      .eq('status', 'paid');

    if (payoutsError) {
      console.error('[request-affiliate-payout] Payouts error:', payoutsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erreur lors du calcul des paiements' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const totalPaidOut = (paidPayouts || []).reduce(
      (sum, p) => sum + Number(p.amount || 0),
      0
    );

    // Gains non payés
    const unpaidEarnings = totalCommissions - totalPaidOut;

    // Vérifier le montant minimum
    const MIN_PAYOUT = 50;
    if (unpaidEarnings < MIN_PAYOUT) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Montant minimum de ${MIN_PAYOUT}€ requis pour demander un paiement. Vous avez ${unpaidEarnings.toFixed(2)}€ disponibles.`
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Vérifier qu'il n'y a pas déjà un payout pending
    const { data: pendingPayout, error: pendingError } = await supabase
      .from('affiliate_payouts')
      .select('id')
      .eq('affiliate_id', affiliate.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (pendingError) {
      console.error('[request-affiliate-payout] Pending check error:', pendingError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erreur lors de la vérification des demandes en cours' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (pendingPayout) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Une demande est déjà en cours de traitement. Merci de patienter.'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Créer le payout
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const { data: newPayout, error: insertError } = await supabase
      .from('affiliate_payouts')
      .insert({
        affiliate_id: affiliate.id,
        amount: Math.round(unpaidEarnings * 100) / 100, // Arrondir à 2 décimales
        period,
        status: 'pending'
      })
      .select()
      .single();

    if (insertError) {
      console.error('[request-affiliate-payout] Insert error:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erreur lors de la création de la demande de paiement' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[request-affiliate-payout] Created payout ${newPayout.id} for ${unpaidEarnings.toFixed(2)}€ (affiliate ${affiliate.id})`);

    return new Response(
      JSON.stringify({
        success: true,
        amount: newPayout.amount,
        payout_id: newPayout.id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[request-affiliate-payout] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erreur inattendue lors de la demande de paiement' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
