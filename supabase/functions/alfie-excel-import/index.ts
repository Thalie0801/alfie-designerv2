import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

import { corsHeaders } from "../_shared/cors.ts";
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Parse multipart form data to get file
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const brandId = formData.get('brandId') as string;
    const campaignName = formData.get('campaignName') as string;

    if (!file) {
      throw new Error('No file provided');
    }

    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer);
    
    // Parse first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    console.log(`📥 [Excel Import] Parsing ${jsonData.length} rows`);

    // Expected columns: type, brief, objective, niche, cta, etc.
    // Group rows by campaign or create one order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: user.id,
        brand_id: brandId || null,
        campaign_name: campaignName || 'Imported Campaign',
        brief_json: {},
      })
      .select()
      .single();

    if (orderError) {
      throw new Error(`Failed to create order: ${orderError.message}`);
    }

    // Create order_items from parsed data
    const orderItems = jsonData.map((row: any, index: number) => ({
      order_id: order.id,
      sequence_number: index + 1,
      type: row.type || 'image', // image | carousel
      brief_json: {
        objective: row.objective || '',
        niche: row.niche || '',
        cta: row.cta || '',
        tone: row.tone || '',
        keywords: row.keywords ? row.keywords.split(',').map((k: string) => k.trim()) : [],
      },
      status: 'pending',
    }));

    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems)
      .select();

    if (itemsError) {
      throw new Error(`Failed to create order items: ${itemsError.message}`);
    }

    console.log(`✅ [Excel Import] Created order ${order.id} with ${items.length} items`);

    return new Response(
      JSON.stringify({
        success: true,
        order_id: order.id,
        items_count: items.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ [Excel Import] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
