import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { v2 as cloudinary } from 'cloudinary';

type JobRow = {
  id: string;
  brand_id: string;
  kind: 'image' | 'carousel' | 'video';
  status: string;
  payload: Record<string, any>;
  attempts: number;
  max_attempts: number;
  user_id: string;
};

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE;
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const cloudKey = process.env.CLOUDINARY_API_KEY;
const cloudSecret = process.env.CLOUDINARY_API_SECRET;

if (!supabaseUrl || !supabaseServiceRole) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE environment variables');
}

if (!cloudName || !cloudKey || !cloudSecret) {
  throw new Error('Missing Cloudinary configuration (CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET)');
}

const supa = createClient(supabaseUrl, supabaseServiceRole, {
  auth: {
    persistSession: false,
  },
});

cloudinary.config({
  cloud_name: cloudName,
  api_key: cloudKey,
  api_secret: cloudSecret,
  secure: true,
});

const PREVIEW_URL = (publicId: string) =>
  cloudinary.url(publicId, {
    width: 512,
    height: 512,
    crop: 'fill',
    gravity: 'auto',
    quality: 80,
    format: 'jpg',
  });

async function takeJob(): Promise<JobRow | null> {
  const { data: job, error } = await supa
    .from('job_queue')
    .select('id, brand_id, kind, status, payload, attempts, max_attempts, user_id')
    .in('status', ['queued', 'retrying'])
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[worker] takeJob error', error);
    return null;
  }
  if (!job) return null;

  const { error: updateErr } = await supa
    .from('job_queue')
    .update({
      status: 'processing',
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id)
    .in('status', ['queued', 'retrying']);

  if (updateErr) {
    console.error('[worker] failed to claim job', updateErr);
    return null;
  }

  return job as JobRow;
}

async function handleImage(job: JobRow) {
  const { brand_id: brandId, payload } = job;
  const source = payload?.source ?? payload?.generated_url ?? payload?.url;
  if (!source || typeof source !== 'string') {
    throw new Error('missing source url');
  }

  const folder = `alfie/${brandId}/${job.id}`;
  const upload = await cloudinary.uploader.upload(source, {
    folder,
    resource_type: 'image',
    context: { brand: brandId, job: job.id },
    tags: ['alfie', 'image'],
  });

  if (!upload.secure_url) {
    throw new Error('missing secure_url');
  }

  const previewUrl = PREVIEW_URL(upload.public_id);
  const meta = {
    folder,
    context: upload.context ?? {},
    etag: upload.etag,
  };

  const { error: insertErr } = await supa.from('library_assets').insert({
    brand_id: brandId,
    order_id: payload?.order_id ?? null,
    kind: 'image',
    user_id: payload?.user_id ?? job.user_id,
    public_id: upload.public_id,
    secure_url: upload.secure_url,
    preview_url: previewUrl,
    cloudinary_public_id: upload.public_id,
    cloudinary_url: upload.secure_url,
    width: upload.width,
    height: upload.height,
    bytes: upload.bytes,
    format: upload.format,
    meta,
    metadata: meta,
  });

  if (insertErr) {
    throw insertErr;
  }

  const { error: updateErr } = await supa
    .from('job_queue')
    .update({
      status: 'done',
      result: { public_id: upload.public_id, secure_url: upload.secure_url },
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id);

  if (updateErr) throw updateErr;
}

async function processJob(job: JobRow) {
  switch (job.kind) {
    case 'image':
      await handleImage(job);
      break;
    default:
      throw new Error(`unsupported job kind: ${job.kind}`);
  }
}

async function runOnce() {
  const job = await takeJob();
  if (!job) return;

  try {
    await processJob(job);
  } catch (err) {
    const attempts = (job.attempts ?? 0) + 1;
    const maxAttempts = job.max_attempts ?? 3;
    const nextStatus = attempts < maxAttempts ? 'retrying' : 'error';
    const errorMessage = err instanceof Error ? err.message : String(err);

    const { error: updateErr } = await supa
      .from('job_queue')
      .update({
        status: nextStatus,
        attempts,
        retry_count: attempts,
        max_attempts: maxAttempts,
        max_retries: maxAttempts,
        error: errorMessage.slice(0, 2000),
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    if (updateErr) {
      console.error('[worker] failed to update job after error', updateErr);
    } else {
      console.warn(`[worker] job ${job.id} failed -> ${nextStatus}: ${errorMessage}`);
    }
    return;
  }

  const { error: syncAttemptsErr } = await supa
    .from('job_queue')
    .update({ attempts: job.attempts, retry_count: job.attempts })
    .eq('id', job.id);

  if (syncAttemptsErr) {
    console.error('[worker] failed to sync attempts counters', syncAttemptsErr);
  }
}

setInterval(runOnce, 1500);

console.log('render-worker loop started');
