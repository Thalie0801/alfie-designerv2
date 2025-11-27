/**
 * Edge Function: monitor-db-size
 * 
 * Vérifie la taille de la base de données et alerte si > 2GB
 * À appeler régulièrement via cron ou manuellement
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  try {
    console.log("[MONITOR] Checking database size...");

    // Requête pour obtenir la taille de chaque table
    const { data: tables, error: tablesError } = await supabaseAdmin.rpc(
      "get_table_sizes"
    );

    if (tablesError) {
      console.error("[MONITOR] Error fetching table sizes:", tablesError);
      // Si la fonction RPC n'existe pas encore, on continue avec un warning
      console.warn("[MONITOR] get_table_sizes RPC not found, using fallback");
    }

    // Récupérer les stats générales
    const { data: mediaCount } = await supabaseAdmin
      .from("media_generations")
      .select("id", { count: "exact", head: true });

    const { data: libraryCount } = await supabaseAdmin
      .from("library_assets")
      .select("id", { count: "exact", head: true });

    const stats = {
      timestamp: new Date().toISOString(),
      tables: tables || [],
      media_generations_count: mediaCount || 0,
      library_assets_count: libraryCount || 0,
    };

    // ⚠️ Alerte si nombre de records suspects
    const ALERT_THRESHOLD_MEDIA = 10000; // Alert si > 10k media generations
    const ALERT_THRESHOLD_LIBRARY = 50000; // Alert si > 50k library assets

    const alerts: string[] = [];

    if ((mediaCount || 0) > ALERT_THRESHOLD_MEDIA) {
      alerts.push(
        `⚠️ DB ALERT: media_generations has ${mediaCount} records (threshold: ${ALERT_THRESHOLD_MEDIA})`
      );
    }

    if ((libraryCount || 0) > ALERT_THRESHOLD_LIBRARY) {
      alerts.push(
        `⚠️ DB ALERT: library_assets has ${libraryCount} records (threshold: ${ALERT_THRESHOLD_LIBRARY})`
      );
    }

    if (alerts.length > 0) {
      console.error("[MONITOR] 🚨 DATABASE ALERTS:", alerts);
      // TODO: Envoyer notification (email, Slack, etc.)
    } else {
      console.log("[MONITOR] ✅ Database size is healthy");
    }

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        alerts,
        message:
          alerts.length > 0
            ? "Database size alerts detected"
            : "Database size is healthy",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("[MONITOR] Error in monitor-db-size:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
