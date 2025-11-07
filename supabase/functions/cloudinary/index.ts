import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { v2 as cloudinary } from 'npm:cloudinary@2.8.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Cloudinary
cloudinary.config({
  cloud_name: Deno.env.get('CLOUDINARY_CLOUD_NAME'),
  api_key: Deno.env.get('CLOUDINARY_API_KEY'),
  api_secret: Deno.env.get('CLOUDINARY_API_SECRET'),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { action, params } = await req.json();

    console.log('[cloudinary] Action:', action, 'Params:', JSON.stringify(params));

    switch (action) {
      case 'ping': {
        return new Response(
          JSON.stringify({ ok: true, timestamp: new Date().toISOString() }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'sign': {
        const { paramsToSign } = params;
        const signature = cloudinary.utils.api_sign_request(
          paramsToSign,
          Deno.env.get('CLOUDINARY_API_SECRET')!
        );
        
        console.log('[cloudinary] Generated signature for params:', paramsToSign);
        
        return new Response(
          JSON.stringify({
            signature,
            timestamp: paramsToSign.timestamp,
            api_key: Deno.env.get('CLOUDINARY_API_KEY'),
            cloud_name: Deno.env.get('CLOUDINARY_CLOUD_NAME'),
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'upload': {
        const { file, folder, public_id, resource_type = 'image', tags = [], context = {} } = params;

        if (!file) {
          return new Response(
            JSON.stringify({ error: 'Missing file parameter' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const uploadOptions: any = {
          folder,
          resource_type,
          tags,
          context,
        };

        if (public_id) {
          uploadOptions.public_id = public_id;
        }

        console.log('[cloudinary] Uploading with options:', uploadOptions);

        const result = await cloudinary.uploader.upload(file, uploadOptions);

        console.log('[cloudinary] Upload success:', {
          public_id: result.public_id,
          secure_url: result.secure_url,
          resource_type: result.resource_type,
          format: result.format,
          width: result.width,
          height: result.height,
          bytes: result.bytes,
          http_code: result.http_code,
          'x-cld-request-id': result['x-cld-request-id'],
        });

        return new Response(
          JSON.stringify({
            public_id: result.public_id,
            secure_url: result.secure_url,
            width: result.width,
            height: result.height,
            format: result.format,
            resource_type: result.resource_type,
            bytes: result.bytes,
            created_at: result.created_at,
            http_code: result.http_code,
            'x-cld-request-id': result['x-cld-request-id'],
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'upload_large': {
        const { file, folder, public_id, resource_type = 'video', chunk_size = 6000000 } = params;

        if (!file) {
          return new Response(
            JSON.stringify({ error: 'Missing file parameter' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('[cloudinary] Uploading large file (chunked):', { folder, public_id, chunk_size });

        const result: any = await cloudinary.uploader.upload_large(file, {
          folder,
          public_id,
          resource_type,
          chunk_size,
        });

        console.log('[cloudinary] Large upload success:', {
          public_id: result.public_id,
          secure_url: result.secure_url,
          bytes: result.bytes,
          http_code: result.http_code,
        });

        return new Response(
          JSON.stringify({
            public_id: result.public_id,
            secure_url: result.secure_url,
            width: result.width,
            height: result.height,
            format: result.format,
            resource_type: result.resource_type,
            bytes: result.bytes,
            duration: result.duration,
            created_at: result.created_at,
            http_code: result.http_code,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete': {
        const { public_id, resource_type = 'image' } = params;

        if (!public_id) {
          return new Response(
            JSON.stringify({ error: 'Missing public_id parameter' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('[cloudinary] Deleting:', { public_id, resource_type });

        const result = await cloudinary.uploader.destroy(public_id, { resource_type });

        console.log('[cloudinary] Delete result:', result);

        return new Response(
          JSON.stringify({
            result: result.result,
            http_code: result.http_code,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action', action }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: any) {
    console.error('[cloudinary] Error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        details: error.error?.message || error.http_code || null,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
