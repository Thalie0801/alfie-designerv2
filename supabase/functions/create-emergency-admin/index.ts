import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const INTERNAL_FN_SECRET = Deno.env.get("INTERNAL_FN_SECRET") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { secret } = await req.json();

    // Vérifier le secret
    if (!secret || secret !== INTERNAL_FN_SECRET) {
      console.error("[create-emergency-admin] Invalid secret provided");
      return new Response(
        JSON.stringify({ error: "Unauthorized - invalid secret" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const adminEmail = "direction.serenity.nathalie@gmail.com";
    const adminPassword = "AlfieAdmin2025!Secure";

    console.log(`[create-emergency-admin] Creating admin user: ${adminEmail}`);

    // Créer l'utilisateur
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        full_name: "Nathalie Admin"
      }
    });

    if (authError) {
      console.error("[create-emergency-admin] Error creating user:", authError);
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = authData.user.id;
    console.log(`[create-emergency-admin] User created with ID: ${userId}`);

    // Créer le profil
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: userId,
        email: adminEmail,
        full_name: "Nathalie Admin",
        plan: "admin",
        granted_by_admin: true
      });

    if (profileError) {
      console.error("[create-emergency-admin] Error creating profile:", profileError);
    }

    // Attribuer le rôle admin
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: userId,
        role: "admin"
      });

    if (roleError) {
      console.error("[create-emergency-admin] Error creating role:", roleError);
    }

    console.log(`[create-emergency-admin] ✅ Admin user created successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Admin user created successfully",
        credentials: {
          email: adminEmail,
          password: adminPassword
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[create-emergency-admin] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message ?? "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
