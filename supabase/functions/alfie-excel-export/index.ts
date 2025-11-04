import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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

    const { brandId, startDate, endDate, campaign } = await req.json();

    console.log(`📤 [Excel Export] Exporting assets for brand ${brandId}`);

    // Fetch library_assets from DB
    let query = supabase
      .from('library_assets')
      .select('*')
      .eq('user_id', user.id);

    if (brandId) query = query.eq('brand_id', brandId);
    if (campaign) query = query.eq('campaign', campaign);
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    const { data: assets, error: assetsError } = await query;

    if (assetsError) {
      throw new Error(`Failed to fetch assets: ${assetsError.message}`);
    }

    // Fetch generation_logs
    let logsQuery = supabase
      .from('generation_logs')
      .select('*')
      .eq('user_id', user.id);

    if (brandId) logsQuery = logsQuery.eq('brand_id', brandId);
    if (startDate) logsQuery = logsQuery.gte('created_at', startDate);
    if (endDate) logsQuery = logsQuery.lte('created_at', endDate);

    const { data: logs, error: logsError } = await logsQuery;

    if (logsError) {
      throw new Error(`Failed to fetch logs: ${logsError.message}`);
    }

    // Search Cloudinary for additional metadata (optional, requires Cloudinary API)
    // For now, use DB data only

    // Create Excel workbook with 3 sheets
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Assets
    const assetsSheet = assets?.map((asset) => ({
      'ID': asset.id,
      'Type': asset.type,
      'Format': asset.format || 'N/A',
      'Campaign': asset.campaign || 'N/A',
      'Cloudinary URL': asset.cloudinary_url,
      'Created At': asset.created_at,
      'Tags': asset.tags ? asset.tags.join(', ') : '',
      'Carousel ID': asset.carousel_id || 'N/A',
      'Slide Index': asset.slide_index !== null ? asset.slide_index : 'N/A',
    })) || [];

    const ws1 = XLSX.utils.json_to_sheet(assetsSheet);
    XLSX.utils.book_append_sheet(workbook, ws1, 'Assets');

    // Sheet 2: Carousels (group by carousel_id)
    const carousels = assets?.filter((a) => a.carousel_id) || [];
    const carouselGroups: any = {};
    
    carousels.forEach((asset) => {
      const cid = asset.carousel_id!;
      if (!carouselGroups[cid]) {
        carouselGroups[cid] = [];
      }
      carouselGroups[cid].push(asset);
    });

    const carouselsSheet = Object.entries(carouselGroups).flatMap(([carouselId, slides]: [string, any]) => {
      return slides.map((slide: any, index: number) => ({
        'Carousel ID': carouselId,
        'Slide Index': slide.slide_index,
        'Total Slides': slides.length,
        'URL': slide.cloudinary_url,
        'Created At': slide.created_at,
      }));
    });

    const ws2 = XLSX.utils.json_to_sheet(carouselsSheet);
    XLSX.utils.book_append_sheet(workbook, ws2, 'Carousels');

    // Sheet 3: Logs
    const logsSheet = logs?.map((log) => ({
      'ID': log.id,
      'Type': log.type,
      'Status': log.status,
      'Engine': log.engine || 'N/A',
      'Woofs Cost': log.woofs_cost || 0,
      'Duration (s)': log.duration_seconds || 'N/A',
      'Error': log.error_code || 'N/A',
      'Created At': log.created_at,
    })) || [];

    const ws3 = XLSX.utils.json_to_sheet(logsSheet);
    XLSX.utils.book_append_sheet(workbook, ws3, 'Logs');

    // Write workbook to buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    console.log(`✅ [Excel Export] Generated Excel with ${assets?.length || 0} assets, ${carouselsSheet.length} carousel slides, ${logs?.length || 0} logs`);

    return new Response(excelBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="assets_export_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
      status: 200,
    });
  } catch (error) {
    console.error('❌ [Excel Export] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
