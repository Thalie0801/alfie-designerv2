import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create user client to verify identity
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('[export-user-data] Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    console.log(`[export-user-data] Exporting data for user: ${userId}`);

    // Create admin client for reading all user data
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Collect all user data
    const exportData: Record<string, unknown> = {
      exportDate: new Date().toISOString(),
      userId: userId,
      email: user.email,
    };

    // 1. Profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    exportData.profile = profile;

    // 2. Brands
    const { data: brands } = await supabaseAdmin
      .from('brands')
      .select('*')
      .eq('user_id', userId);
    exportData.brands = brands;

    // 3. Brand quotas (counters_monthly)
    if (brands && brands.length > 0) {
      const brandIds = brands.map(b => b.id);
      const { data: counters } = await supabaseAdmin
        .from('counters_monthly')
        .select('*')
        .in('brand_id', brandIds);
      exportData.quotaHistory = counters;
    }

    // 4. Orders
    const { data: orders } = await supabaseAdmin
      .from('orders')
      .select('*, order_items(*)')
      .eq('user_id', userId);
    exportData.orders = orders;

    // 5. Library assets
    const { data: libraryAssets } = await supabaseAdmin
      .from('library_assets')
      .select('*')
      .eq('user_id', userId);
    exportData.libraryAssets = libraryAssets;

    // 6. Media generations
    const { data: mediaGenerations } = await supabaseAdmin
      .from('media_generations')
      .select('*')
      .eq('user_id', userId);
    exportData.mediaGenerations = mediaGenerations;

    // 7. Alfie conversations (without full message content for privacy)
    const { data: conversations } = await supabaseAdmin
      .from('alfie_conversations')
      .select('id, title, created_at, updated_at')
      .eq('user_id', userId);
    exportData.conversations = conversations;

    // 8. Alfie memory preferences
    const { data: alfieMemory } = await supabaseAdmin
      .from('alfie_memory')
      .select('*')
      .eq('user_id', userId);
    exportData.preferences = alfieMemory;

    // 9. Generation logs (anonymized prompt summaries)
    const { data: generationLogs } = await supabaseAdmin
      .from('generation_logs')
      .select('type, status, engine, created_at, duration_seconds, woofs_cost')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);
    exportData.generationHistory = generationLogs;

    // 10. Affiliate data
    const { data: affiliate } = await supabaseAdmin
      .from('affiliates')
      .select('name, slug, affiliate_status, status, created_at, active_direct_referrals')
      .eq('id', userId)
      .single();
    exportData.affiliate = affiliate;

    // 11. Affiliate earnings (own commissions only)
    const { data: commissions } = await supabaseAdmin
      .from('affiliate_commissions')
      .select('level, commission_rate, amount, created_at')
      .eq('affiliate_id', userId);
    exportData.affiliateCommissions = commissions;

    // 12. Credit transactions
    const { data: creditTransactions } = await supabaseAdmin
      .from('credit_transactions')
      .select('*')
      .eq('user_id', userId);
    exportData.creditTransactions = creditTransactions;

    // 13. Batch requests
    const { data: batchRequests } = await supabaseAdmin
      .from('batch_requests')
      .select('modality, status, created_at, process_after')
      .eq('user_id', userId);
    exportData.batchRequests = batchRequests;

    console.log(`[export-user-data] Export completed for user: ${userId}`);

    // Return as JSON
    return new Response(
      JSON.stringify(exportData, null, 2),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="alfie-export-${new Date().toISOString().split('T')[0]}.json"`
        } 
      }
    );

  } catch (error) {
    console.error('[export-user-data] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
