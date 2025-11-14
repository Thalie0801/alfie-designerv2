# Infra notes

## Supabase dashboard
- Configure **Site URL** and **Additional Redirect URLs** to include both production domains and Lovable sandboxes (e.g. `*.lovable.app`, `*.lovableproject.com`).
- Ensure Edge Functions allow the Studio origin by updating the CORS configuration accordingly.

## Database policies
- The `media_generations` table must keep `user_id` referencing `auth.users(id)` and have RLS enabled.
- Provide `SELECT` and `INSERT` policies allowing `auth.uid() = user_id` so Studio users can read/write their own assets.

## Edge function secrets
- Define `RENDER_BACKEND_URL` (default `https://alfie-designer.onrender.com`) for both `generate-image` and `process-jobs` Edge Functions so they can reach the Render backend.
- Keep the value in Supabase's project configuration and Render's environment to stay in sync.
