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

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Not authenticated', details: authError }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get user roles
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    // Get user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // Check VIP_EMAILS environment variable
    const vipEmails = (Deno.env.get('VIP_EMAILS') || '').toLowerCase().split(',').map(e => e.trim()).filter(Boolean);
    const adminEmails = (Deno.env.get('ADMIN_EMAILS') || '').toLowerCase().split(',').map(e => e.trim()).filter(Boolean);
    
    const isInVipEnv = vipEmails.includes(user.email?.toLowerCase() || '');
    const isInAdminEnv = adminEmails.includes(user.email?.toLowerCase() || '');

    return new Response(JSON.stringify({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      },
      roles: roles || [],
      profile: profile || null,
      environment: {
        isInVipEnv,
        isInAdminEnv,
        vipEmails: vipEmails.length > 0 ? vipEmails : 'Not configured',
        adminEmails: adminEmails.length > 0 ? adminEmails : 'Not configured'
      },
      errors: {
        rolesError: rolesError?.message,
        profileError: profileError?.message
      }
    }, null, 2), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[debug-user-access] Error:', error);
    return new Response(JSON.stringify({
      ok: false,
      error: error?.message || 'Unknown error',
      stack: error?.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
