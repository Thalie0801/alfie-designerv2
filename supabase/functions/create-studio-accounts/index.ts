import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create admin client with service role key
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

    // ⚠️ SECURITY: Credentials must be passed in request body, never hardcoded
    const body = await req.json();
    const testAccounts = body.accounts || [];

    const results = [];

    for (const account of testAccounts) {
      try {
        // Create user in auth.users
        const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
          email: account.email,
          password: account.password,
          email_confirm: true,
          user_metadata: {
            full_name: account.full_name,
          },
        });

        if (userError) {
          console.error(`Error creating user ${account.email}:`, userError);
          results.push({
            email: account.email,
            success: false,
            error: userError.message,
          });
          continue;
        }

        // Update profile with Studio plan (free access to all services)
        const { error: updateError } = await supabaseAdmin
          .from("profiles")
          .update({
            plan: "studio",
            quota_brands: 10,
            quota_visuals_per_month: 1000,
            quota_videos: 100,
            ai_credits_monthly: 10000,
            full_name: account.full_name,
          })
          .eq("id", userData.user.id);

        if (updateError) {
          console.error(`Error updating profile for ${account.email}:`, updateError);
          results.push({
            email: account.email,
            success: false,
            error: updateError.message,
          });
          continue;
        }

        results.push({
          email: account.email,
          password: account.password,
          success: true,
          message: "Compte Studio créé avec succès",
        });

        console.log(`✅ Studio account created: ${account.email}`);
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
    console.error("Error in create-studio-accounts:", error);
    return new Response(
      JSON.stringify({ error: error?.message || String(error) }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});