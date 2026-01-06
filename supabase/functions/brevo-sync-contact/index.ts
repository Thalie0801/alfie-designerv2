import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BREVO_API_URL = "https://api.brevo.com/v3";

// List IDs - Configure these in your Brevo dashboard
// You can get these IDs by calling brevo-manage-lists with action: "list"
const BREVO_LISTS = {
  LEADS: Number(Deno.env.get("BREVO_LIST_LEADS") || 0),
  CLIENTS: Number(Deno.env.get("BREVO_LIST_CLIENTS") || 0),
  NEWSLETTER: Number(Deno.env.get("BREVO_LIST_NEWSLETTER") || 0),
};

interface SyncContactRequest {
  email: string;
  firstName?: string;
  lastName?: string;
  source?: string;
  listType?: "lead" | "client" | "newsletter";
  attributes?: Record<string, unknown>;
  generationCount?: number;
  marketingOptIn?: boolean;
}

function getApiKey(): string {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  if (!apiKey) {
    throw new Error("BREVO_API_KEY is not configured");
  }
  return apiKey;
}

async function createOrUpdateContact(params: {
  email: string;
  attributes: Record<string, unknown>;
  listIds: number[];
}): Promise<{ success: boolean; created?: boolean }> {
  const { email, attributes, listIds } = params;

  const body: Record<string, unknown> = {
    email,
    attributes,
    updateEnabled: true,
    emailBlacklisted: false,
  };

  if (listIds.length > 0) {
    body.listIds = listIds;
  }

  const response = await fetch(`${BREVO_API_URL}/contacts`, {
    method: "POST",
    headers: {
      "api-key": getApiKey(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (response.status === 201) {
    console.log("[brevo-sync] Contact created:", email);
    return { success: true, created: true };
  }

  if (response.status === 204) {
    console.log("[brevo-sync] Contact updated:", email);
    return { success: true, created: false };
  }

  // Handle duplicate - contact exists
  if (response.status === 400) {
    const errorData = await response.json();
    if (errorData.code === "duplicate_parameter") {
      // Add to lists separately if contact exists
      if (listIds.length > 0) {
        await addToLists(email, listIds);
      }
      return { success: true, created: false };
    }
    console.error("[brevo-sync] Error:", errorData);
    return { success: false };
  }

  const errorText = await response.text();
  console.error("[brevo-sync] Failed:", response.status, errorText);
  return { success: false };
}

async function addToLists(email: string, listIds: number[]): Promise<void> {
  for (const listId of listIds) {
    if (listId === 0) continue; // Skip unconfigured lists
    
    try {
      const response = await fetch(`${BREVO_API_URL}/contacts/lists/${listId}/contacts/add`, {
        method: "POST",
        headers: {
          "api-key": getApiKey(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ emails: [email] }),
      });

      if (response.ok) {
        console.log(`[brevo-sync] Added ${email} to list ${listId}`);
      } else {
        console.warn(`[brevo-sync] Failed to add to list ${listId}`);
      }
    } catch (e) {
      console.error(`[brevo-sync] Error adding to list ${listId}:`, e);
    }
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: SyncContactRequest = await req.json();
    const {
      email,
      firstName,
      lastName,
      source = "unknown",
      listType = "lead",
      attributes: customAttributes = {},
      generationCount,
      marketingOptIn,
    } = body;

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[brevo-sync] Processing:", email, "listType:", listType);

    // Build attributes
    const attributes: Record<string, unknown> = {
      ...customAttributes,
      SOURCE: source,
      LAST_SEEN_AT: new Date().toISOString(),
    };

    if (firstName) attributes.FIRSTNAME = firstName;
    if (lastName) attributes.LASTNAME = lastName;
    if (generationCount !== undefined) attributes.GENERATION_COUNT = generationCount;
    if (marketingOptIn !== undefined) attributes.OPT_IN = marketingOptIn;

    // Determine which lists to add
    const listIds: number[] = [];
    switch (listType) {
      case "lead":
        if (BREVO_LISTS.LEADS > 0) listIds.push(BREVO_LISTS.LEADS);
        break;
      case "client":
        if (BREVO_LISTS.CLIENTS > 0) listIds.push(BREVO_LISTS.CLIENTS);
        break;
      case "newsletter":
        if (BREVO_LISTS.NEWSLETTER > 0) listIds.push(BREVO_LISTS.NEWSLETTER);
        break;
    }

    // Also add to newsletter if marketing opt-in
    if (marketingOptIn && BREVO_LISTS.NEWSLETTER > 0 && !listIds.includes(BREVO_LISTS.NEWSLETTER)) {
      listIds.push(BREVO_LISTS.NEWSLETTER);
    }

    const result = await createOrUpdateContact({
      email: email.toLowerCase().trim(),
      attributes,
      listIds,
    });

    return new Response(
      JSON.stringify({
        success: result.success,
        created: result.created,
        email,
        listType,
        listsAdded: listIds.filter(id => id > 0),
      }),
      {
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("[brevo-sync] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
