# Déploiement sur Render & Variables d'environnement

Ce guide résume la configuration minimale pour déployer Alfie Doer (Edge Functions + Web) sur Render.

## 1. Services Render

| Service | Type | Commande | Notes |
| --- | --- | --- | --- |
| `alfie-web` | Web Service (Node 18) | `npm run build && npm run preview` | Expose le front Vite. |
| `alfie-edge` | Web Service (Deno 1.45+) | `supabase functions serve` | Déploie les fonctions Edge (voir `supabase/functions`). |
| `alfie-worker` | Background Worker (Node) | `node services/worker/index.js` | Optionnel, pour traiter `job_queue`. |

## 2. Variables d'environnement communes

Définir les variables suivantes sur chaque service :

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `INTERNAL_FN_SECRET` (clé partagée pour appeler les workers internes)

Pour le front Vite, utilisez le préfixe `VITE_` :

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_EDGE_BASE_URL=https://alfie-edge.onrender.com
VITE_STUDIO_URL=/studio
VITE_LIBRARY_URL=/library
VITE_CLOUDINARY_CLOUD_NAME=...
```

## 3. Supabase Edge Functions

Assurez-vous que les fonctions suivantes sont déployées :

- `alfie-enqueue-job`
- `alfie-search-assets`
- `alfie-sign-upload`

Utilisez `supabase functions deploy <name>` puis configurez l'URL Render pour proxy si nécessaire.

## 4. Webhooks & Realtime

- Activez la publication `supabase_realtime` pour `job_queue`, `library_assets` et `job_events` (voir migrations).
- Sur Render, autorisez les connexions sortantes vers Supabase et Cloudinary.

## 5. Build & CI

Avant chaque déploiement :

```bash
npm install
npm run lint
npm run typecheck
```

Configurez Render pour exécuter `npm ci` suivi de `npm run build` (ou `npm run build:dev` pour un préchauffage) dans l'onglet Build.

## 6. Rotation des secrets

- Cloudinary : renouvelez `CLOUDINARY_API_SECRET` tous les 90 jours et mettez à jour Render + Supabase secrets.
- Supabase : limitez l'accès au `SERVICE_ROLE_KEY` aux seuls services internes (pas de front).

Bon déploiement !
