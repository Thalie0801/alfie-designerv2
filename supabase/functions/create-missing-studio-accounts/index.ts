import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Security: This function should only be called by authorized admins
    // Check for internal secret or admin authorization
    const authHeader = req.headers.get("authorization");
    const internalSecret = req.headers.get("x-internal-secret");
    
    if (!authHeader && internalSecret !== Deno.env.get("INTERNAL_FN_SECRET")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Admin access required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const accounts = [
      {
        email: "Sandrine.guedra@gmail.com",
        password: "Sgu54700!",
        full_name: "Sandrine Guedra",
      },
      {
        email: "b2494709@gmail.com",
        password: "JeanDavid08.",
        full_name: "Jean David",
      },
    ];

    const results = [];

    for (const account of accounts) {
      try {
        // Try to create user
        const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
          email: account.email,
          password: account.password,
          email_confirm: true,
          user_metadata: {
            full_name: account.full_name,
          },
        });

        if (userError) {
          // If user already exists, try to find them
          const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
          const existingUser = existingUsers?.users?.find(u => u.email === account.email);
          
          if (existingUser) {
            // Update existing profile
            const { error: updateError } = await supabaseAdmin
              .from("profiles")
              .upsert({
                id: existingUser.id,
                email: account.email,
                full_name: account.full_name,
                plan: "studio",
                quota_brands: 10,
                quota_visuals_per_month: 1000,
                quota_videos: 100,
                ai_credits_monthly: 10000,
              });

            if (updateError) {
              results.push({
                email: account.email,
                success: false,
                error: updateError.message,
              });
            } else {
              results.push({
                email: account.email,
                success: true,
                message: "Profil Studio mis à jour",
              });
            }
          } else {
            results.push({
              email: account.email,
              success: false,
              error: userError.message,
            });
          }
          continue;
        }

        // Create/update profile for new user
        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .upsert({
            id: userData.user.id,
            email: account.email,
            full_name: account.full_name,
            plan: "studio",
            quota_brands: 10,
            quota_visuals_per_month: 1000,
            quota_videos: 100,
            ai_credits_monthly: 10000,
          });

        if (profileError) {
          results.push({
            email: account.email,
            success: false,
            error: profileError.message,
          });
        } else {
          results.push({
            email: account.email,
            password: account.password,
            success: true,
            message: "Compte Studio créé avec succès",
          });
        }

        console.log(`✅ Studio account processed: ${account.email}`);
      } catch (error: any) {
        console.error(`Error processing ${account.email}:`, error);
        results.push({
          email: account.email,
          success: false,
          error: error?.message || String(error),
        });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error in create-missing-studio-accounts:", error);
    return new Response(
      JSON.stringify({ error: error?.message || String(error) }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
