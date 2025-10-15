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

    const testAccounts = [
      {
        email: "studio.test1@alfieai.fr",
        password: "Studio2025!Test1",
        full_name: "Test Studio 1",
      },
      {
        email: "studio.test2@alfieai.fr",
        password: "Studio2025!Test2",
        full_name: "Test Studio 2",
      },
      {
        email: "studio.test3@alfieai.fr",
        password: "Studio2025!Test3",
        full_name: "Test Studio 3",
      },
    ];

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

        // Update profile with Studio plan
        const { error: updateError } = await supabaseAdmin
          .from("profiles")
          .update({
            plan: "studio",
            quota_brands: 1,
            quota_visuals_per_month: 1000,
            quota_videos: 100,
            ai_credits_monthly: 729,
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