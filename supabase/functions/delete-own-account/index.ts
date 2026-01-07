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
      console.error('[delete-own-account] Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    console.log(`[delete-own-account] Processing deletion for user: ${userId}`);

    // Create admin client for deletion operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Delete user data in order (respecting foreign keys)
    const deletionSteps = [
      // 1. Alfie messages and conversations
      { table: 'alfie_messages', via: 'conversation_id', subquery: 'alfie_conversations' },
      { table: 'alfie_conversations', column: 'user_id' },
      { table: 'alfie_conversation_sessions', column: 'user_id' },
      { table: 'alfie_memory', column: 'user_id' },
      
      // 2. Orders and items
      { table: 'order_items', via: 'order_id', subquery: 'orders' },
      { table: 'orders', column: 'user_id' },
      
      // 3. Jobs
      { table: 'jobs', via: 'job_set_id', subquery: 'job_sets' },
      { table: 'job_sets', column: 'user_id' },
      { table: 'job_queue', column: 'user_id' },
      
      // 4. Assets and media
      { table: 'library_assets', column: 'user_id' },
      { table: 'media_generations', column: 'user_id' },
      { table: 'assets', via: 'brand_id', subquery: 'brands' },
      
      // 5. Deliverables
      { table: 'deliverable', via: 'brand_id', subquery: 'brands' },
      
      // 6. Brands (this cascades counters_monthly via FK)
      { table: 'brands', column: 'user_id' },
      
      // 7. Batch requests
      { table: 'batch_requests', column: 'user_id' },
      
      // 8. Chat sessions
      { table: 'chat_sessions', column: 'user_id' },
      
      // 9. Credit transactions
      { table: 'credit_transactions', column: 'user_id' },
      
      // 10. Anonymize generation logs (keep for audit but remove PII)
      { table: 'generation_logs', column: 'user_id', anonymize: true },
    ];

    for (const step of deletionSteps) {
      try {
        if (step.anonymize) {
          // Anonymize instead of delete for audit trail
          const { error } = await supabaseAdmin
            .from(step.table)
            .update({ 
              user_id: '00000000-0000-0000-0000-000000000000',
              prompt_summary: '[DELETED]',
              metadata: {}
            })
            .eq(step.column!, userId);
          
          if (error) {
            console.warn(`[delete-own-account] Anonymize ${step.table} warning:`, error.message);
          } else {
            console.log(`[delete-own-account] Anonymized ${step.table}`);
          }
        } else if (step.via && step.subquery) {
          // Delete via subquery (for related tables)
          const { data: parentIds } = await supabaseAdmin
            .from(step.subquery)
            .select('id')
            .eq('user_id', userId);
          
          if (parentIds && parentIds.length > 0) {
            const ids = parentIds.map(p => p.id);
            const { error } = await supabaseAdmin
              .from(step.table)
              .delete()
              .in(step.via, ids);
            
            if (error) {
              console.warn(`[delete-own-account] Delete ${step.table} warning:`, error.message);
            } else {
              console.log(`[delete-own-account] Deleted from ${step.table}`);
            }
          }
        } else {
          // Direct delete
          const { error } = await supabaseAdmin
            .from(step.table)
            .delete()
            .eq(step.column!, userId);
          
          if (error) {
            console.warn(`[delete-own-account] Delete ${step.table} warning:`, error.message);
          } else {
            console.log(`[delete-own-account] Deleted from ${step.table}`);
          }
        }
      } catch (stepError) {
        console.warn(`[delete-own-account] Step ${step.table} error:`, stepError);
      }
    }

    // Delete profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId);
    
    if (profileError) {
      console.warn('[delete-own-account] Profile deletion warning:', profileError.message);
    }

    // Handle affiliate data (anonymize, don't delete for commission history)
    const { error: affiliateError } = await supabaseAdmin
      .from('affiliates')
      .update({ 
        email: 'deleted@deleted.com',
        name: '[DELETED USER]',
        status: 'deleted',
        slug: null
      })
      .eq('id', userId);
    
    if (affiliateError) {
      console.warn('[delete-own-account] Affiliate anonymization warning:', affiliateError.message);
    }

    // Finally, delete the auth user
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (authDeleteError) {
      console.error('[delete-own-account] Auth deletion error:', authDeleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete authentication account' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[delete-own-account] Successfully deleted user: ${userId}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Account deleted successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[delete-own-account] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
