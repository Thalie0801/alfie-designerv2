import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BREVO_API_URL = "https://api.brevo.com/v3";

interface ManageListsRequest {
  action: "list" | "create" | "get-contacts";
  name?: string; // For create
  folderId?: number; // For create, defaults to 1
  listId?: number; // For get-contacts
  limit?: number;
  offset?: number;
}

function getApiKey(): string {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  if (!apiKey) {
    throw new Error("BREVO_API_KEY is not configured");
  }
  return apiKey;
}

function getHeaders(): HeadersInit {
  return {
    "api-key": getApiKey(),
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

// Check if request is from admin
async function isAdmin(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.slice(7);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return false;

    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    return !!roleData;
  } catch {
    return false;
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Admin check
    const admin = await isAdmin(req);
    if (!admin) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: ManageListsRequest = await req.json();
    const { action, name, folderId = 1, listId, limit = 50, offset = 0 } = body;

    console.log("[brevo-manage-lists] Action:", action);

    switch (action) {
      case "list": {
        const response = await fetch(
          `${BREVO_API_URL}/contacts/lists?limit=${limit}&offset=${offset}`,
          { method: "GET", headers: getHeaders() }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to get lists: ${errorText}`);
        }

        const result = await response.json();
        return new Response(
          JSON.stringify({
            success: true,
            lists: result.lists || [],
            count: result.count || 0,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "create": {
        if (!name) {
          return new Response(
            JSON.stringify({ error: "List name is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const response = await fetch(`${BREVO_API_URL}/contacts/lists`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({ name, folderId }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to create list: ${errorText}`);
        }

        const result = await response.json();
        console.log("[brevo-manage-lists] List created:", result.id);

        return new Response(
          JSON.stringify({
            success: true,
            listId: result.id,
            name,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "get-contacts": {
        if (!listId) {
          return new Response(
            JSON.stringify({ error: "listId is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const response = await fetch(
          `${BREVO_API_URL}/contacts/lists/${listId}/contacts?limit=${limit}&offset=${offset}`,
          { method: "GET", headers: getHeaders() }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to get contacts: ${errorText}`);
        }

        const result = await response.json();
        return new Response(
          JSON.stringify({
            success: true,
            contacts: result.contacts || [],
            count: result.count || 0,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action. Use: list, create, or get-contacts" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: unknown) {
    console.error("[brevo-manage-lists] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
