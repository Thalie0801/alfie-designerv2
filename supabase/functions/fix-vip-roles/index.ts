import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[fix-vip-roles] Starting VIP/Admin role fix');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Emails à vérifier (hardcodé pour cette correction)
    const adminEmails = ['nathaliestaelens@gmail.com', 'staelensnathalie@gmail.com'];
    const vipEmails: string[] = [];

    const results = [];

    // Traiter les admins
    for (const email of adminEmails) {
      const { data: users } = await supabaseAdmin.auth.admin.listUsers();
      const user = users?.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

      if (!user) {
        console.log(`[fix-vip-roles] User not found: ${email}`);
        results.push({ email, status: 'user_not_found' });
        continue;
      }

      console.log(`[fix-vip-roles] Processing admin: ${email} (${user.id})`);

      // Ajouter le rôle admin
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .upsert({ user_id: user.id, role: 'admin' }, { onConflict: 'user_id,role' });

      if (roleError) {
        console.error(`[fix-vip-roles] Error adding admin role:`, roleError);
        results.push({ email, status: 'role_error', error: roleError.message });
        continue;
      }

      // Mettre à jour le profil avec plan enterprise
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
          plan: 'enterprise',
          status: 'active',
          subscription_end: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (profileError) {
        console.error(`[fix-vip-roles] Error updating profile:`, profileError);
        results.push({ email, status: 'profile_error', error: profileError.message });
        continue;
      }

      results.push({ email, status: 'success', role: 'admin', plan: 'enterprise' });
      console.log(`[fix-vip-roles] ✅ Fixed admin: ${email}`);
    }

    // Traiter les VIPs
    for (const email of vipEmails) {
      const { data: users } = await supabaseAdmin.auth.admin.listUsers();
      const user = users?.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

      if (!user) {
        console.log(`[fix-vip-roles] User not found: ${email}`);
        results.push({ email, status: 'user_not_found' });
        continue;
      }

      console.log(`[fix-vip-roles] Processing VIP: ${email} (${user.id})`);

      // Ajouter le rôle vip
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .upsert({ user_id: user.id, role: 'vip' }, { onConflict: 'user_id,role' });

      if (roleError) {
        console.error(`[fix-vip-roles] Error adding vip role:`, roleError);
        results.push({ email, status: 'role_error', error: roleError.message });
        continue;
      }

      // Mettre à jour le profil avec plan enterprise
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
          plan: 'enterprise',
          status: 'active',
          subscription_end: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (profileError) {
        console.error(`[fix-vip-roles] Error updating profile:`, profileError);
        results.push({ email, status: 'profile_error', error: profileError.message });
        continue;
      }

      results.push({ email, status: 'success', role: 'vip', plan: 'enterprise' });
      console.log(`[fix-vip-roles] ✅ Fixed VIP: ${email}`);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        fixed: results.filter(r => r.status === 'success').length,
        results,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('[fix-vip-roles] Fatal error:', error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error?.message || 'Unknown error',
        stack: error?.stack
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
