import cloudinary from 'npm:cloudinary';

cloudinary.v2.config({
  cloud_name: Deno.env.get('CLOUDINARY_CLOUD_NAME'),
  api_key: Deno.env.get('CLOUDINARY_API_KEY'),
  api_secret: Deno.env.get('CLOUDINARY_API_SECRET'),
});

type Json = Record<string, unknown>;
const j = (d: Json, s = 200) =>
  new Response(JSON.stringify(d), {
    status: s,
    headers: { 'content-type': 'application/json' },
  });

Deno.serve(async (req) => {
  try {
    const { action, params } = (await req.json().catch(() => ({
      action: 'ping',
      params: {},
    }))) as {
      action: 'ping' | 'sign' | 'upload' | 'upload_large' | 'delete';
      params?: any;
    };

    if (action === 'ping') return j({ ok: true, ts: Date.now() });

    if (action === 'sign') {
      const ts = Math.floor(Date.now() / 1000);
      const toSign: Record<string, string | number> = { timestamp: ts };
      if (params?.folder) toSign.folder = params.folder;
      if (params?.public_id) toSign.public_id = params.public_id;
      if (params?.resource_type) toSign.resource_type = params.resource_type;

      const signature = cloudinary.v2.utils.api_sign_request(
        toSign,
        Deno.env.get('CLOUDINARY_API_SECRET')!
      );

      return j({
        timestamp: ts,
        signature,
        api_key: Deno.env.get('CLOUDINARY_API_KEY'),
        cloud_name: Deno.env.get('CLOUDINARY_CLOUD_NAME'),
      });
    }

    if (action === 'upload') {
      const { file, folder, public_id, resource_type = 'auto', ...rest } = params ?? {};
      const res = await cloudinary.v2.uploader.upload(file, {
        resource_type,
        folder,
        public_id,
        overwrite: true,
        invalidate: true,
        ...rest,
      });
      return j(res as Json);
    }

    if (action === 'upload_large') {
      const {
        file,
        folder,
        public_id,
        resource_type = 'video',
        chunk_size = 8_000_000,
        ...rest
      } = params ?? {};

      const res = await cloudinary.v2.uploader.upload_large(file, {
        resource_type,
        folder,
        public_id,
        chunk_size,
        overwrite: true,
        invalidate: true,
        ...rest,
      });
      return j(res as Json);
    }

    if (action === 'delete') {
      const { public_id, resource_type = 'image' } = params ?? {};
      const res = await cloudinary.v2.uploader.destroy(public_id, { resource_type });
      return j(res);
    }

    return j({ error: 'unknown action' }, 400);
  } catch (e: any) {
    return j({ error: String(e?.message ?? e) }, 500);
  }
});
