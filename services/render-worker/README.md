# Render Worker

Worker process that polls Supabase `job_queue` entries and uploads completed renders to Cloudinary.

## Running locally

```bash
cd services/render-worker
npm install
cp .env.example .env # fill credentials
npm start
```

The worker will poll every 1.5 seconds, updating job statuses (`processing`, `retrying`, `done`, `error`) and storing Cloudinary previews in `library_assets`.
