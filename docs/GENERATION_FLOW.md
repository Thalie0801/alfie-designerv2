# 📐 Alfie Designer - Flux de Génération

## 🎯 Vue d'ensemble

Le système de génération d'Alfie Designer repose sur un pipeline asynchrone unifié via `job_queue`, permettant la création d'images, carrousels et vidéos avec gestion des quotas et traçabilité complète.

## 🏗️ Architecture Générale

```
┌─────────────────┐
│   Frontend      │
│  (React/Vite)   │
└────────┬────────┘
         │
         │ 1. Appel Edge Function
         ▼
┌─────────────────────┐
│  Edge Functions     │
│  - generate-media   │
│  - chat-create-*    │
└────────┬────────────┘
         │
         │ 2. Création Order + Job
         ▼
┌─────────────────────┐
│   Supabase DB       │
│  ┌────────────────┐ │
│  │  orders        │ │
│  │  order_items   │ │
│  │  job_queue     │ │
│  └────────────────┘ │
└────────┬────────────┘
         │
         │ 3. Worker traite jobs
         ▼
┌─────────────────────┐
│  alfie-job-worker   │
│  - processJobs()    │
│  - render images    │
│  - render carousels │
│  - generate videos  │
└────────┬────────────┘
         │
         │ 4. Génération via API
         ▼
┌─────────────────────┐
│   Moteurs IA        │
│  - Nano Banana      │
│  - Replicate        │
│  - Image→Video      │
└────────┬────────────┘
         │
         │ 5. Upload & Enregistrement
         ▼
┌─────────────────────┐
│  Cloudinary + DB    │
│  - library_assets   │
│  - media_generations│
│  - counters_monthly │
└─────────────────────┘
```

## 📊 Tables Principales

### 1. `orders`
Point d'entrée pour toute demande de génération.

```sql
orders (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  brand_id uuid,
  type text NOT NULL, -- 'image' | 'carousel' | 'video'
  status text DEFAULT 'pending',
  created_at timestamp
)
```

**Statuts** : `pending` → `processing` → `completed` / `failed`

### 2. `order_items`
Décomposition d'un order en sous-tâches (ex: 5 slides pour un carrousel).

```sql
order_items (
  id uuid PRIMARY KEY,
  order_id uuid REFERENCES orders(id),
  sequence_number int,
  type text NOT NULL,
  brief_json jsonb,
  text_json jsonb,
  status text DEFAULT 'pending'
)
```

### 3. `job_queue`
File d'attente unifiée pour tous les types de jobs.

```sql
job_queue (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  brand_id uuid,
  order_id uuid REFERENCES orders(id),
  type text NOT NULL, -- 'render_images' | 'render_carousels' | 'generate_video'
  kind text, -- 'carousel' | 'image' | 'video'
  payload jsonb NOT NULL,
  status text DEFAULT 'queued',
  attempts int DEFAULT 0,
  max_attempts int DEFAULT 3,
  created_at timestamp,
  updated_at timestamp
)
```

**Statuts** : `queued` → `running` → `completed` / `failed`

### 4. `library_assets`
Stockage final des visuels générés (images & carrousels).

```sql
library_assets (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  brand_id uuid,
  order_id uuid,
  order_item_id uuid,
  type text NOT NULL, -- 'image' | 'carousel_slide'
  cloudinary_url text NOT NULL,
  cloudinary_public_id text,
  slide_index int, -- pour carrousels
  text_json jsonb,
  metadata jsonb,
  created_at timestamp
)
```

### 5. `media_generations`
Stockage des vidéos et assets temporaires.

```sql
media_generations (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  brand_id uuid NOT NULL,
  type text NOT NULL, -- 'video' | 'image'
  output_url text NOT NULL,
  thumbnail_url text,
  status text DEFAULT 'completed',
  metadata jsonb, -- contient order_id
  woofs int DEFAULT 0,
  duration_seconds int,
  created_at timestamp
)
```

### 6. `counters_monthly`
Suivi de la consommation des quotas par marque.

```sql
counters_monthly (
  brand_id uuid PRIMARY KEY,
  period_yyyymm int NOT NULL, -- ex: 202501
  images_used int DEFAULT 0,
  reels_used int DEFAULT 0,
  woofs_used int DEFAULT 0
)
```

## 🔄 Flux Détaillés

### 🖼️ Génération d'Images Simples

#### Points d'entrée
- **Studio** : `ChatGenerator.tsx` → formulaire structuré
- **Chat Widget** : `ChatWidget.tsx` → intent détecté

#### Étapes
1. **Frontend → Edge Function**
   ```typescript
   // Dans ChatGenerator.tsx
   const { data } = await supabase.functions.invoke('generate-media', {
     body: {
       format: 'image',
       count: 1,
       topic: 'un chat sur une plage',
       brandId: activeBrandId,
       ratio: '1:1'
     }
   });
   ```

2. **Edge Function `generate-media`**
   - Valide les quotas disponibles
   - Crée un `order` avec `type: 'image'`
   - Crée un `order_item` avec le brief
   - Insère un job dans `job_queue` :
     ```json
     {
       "type": "render_images",
       "kind": "image",
       "payload": {
         "orderId": "...",
         "items": [{ "prompt": "...", "ratio": "1:1" }]
       }
     }
     ```
   - Retourne `{ orderId, jobId }`

3. **Worker `alfie-job-worker`** (déclenché par cron ou invoke)
   - Claim le job (statut → `running`)
   - Appelle `processRenderImages(job)`
   - Génère l'image via `alfie-generate-ai-image` (Nano Banana)
   - Parse la réponse pour extraire l'URL de l'image
   - Upload vers Cloudinary :
     - `publicId`: `alfie/{brandId}/{orderId}/image-{timestamp}`
     - Tags : `brand:{brandId}`, `order:{orderId}`, `type:image`, `ratio:1:1`
   - Enregistre dans `library_assets` :
     ```json
     {
       "user_id": "...",
       "brand_id": "...",
       "order_id": "...",
       "type": "image",
       "cloudinary_url": "https://...",
       "cloudinary_public_id": "alfie/..."
     }
     ```
   - Consomme les quotas via `consumeBrandQuotas(brandId, 1)`
   - Met à jour le job (statut → `completed`)

4. **Frontend - Affichage**
   - Polling sur `order.status` ou réaltime sur `library_assets`
   - Affichage dans `Library.tsx` avec thumbnail Cloudinary

### 🎠 Génération de Carrousels

#### Points d'entrée
- **Studio** : `ChatGenerator.tsx` avec `format: 'carousel'`
- **Legacy** : `chat-create-carousel` (à migrer)

#### Étapes
1. **Frontend → Edge Function**
   ```typescript
   const { data } = await supabase.functions.invoke('generate-media', {
     body: {
       format: 'carousel',
       count: 5, // nombre de slides
       topic: 'Les tendances marketing 2025',
       brandId: activeBrandId,
       ratio: '1:1'
     }
   });
   ```

2. **Edge Function `generate-media`**
   - Valide les quotas (count × 1 image quota)
   - Crée un `order` avec `type: 'carousel'`
   - Crée **N** `order_items` (un par slide) :
     ```json
     [
       { "sequence_number": 0, "type": "carousel_slide", "brief_json": {...} },
       { "sequence_number": 1, "type": "carousel_slide", "brief_json": {...} },
       ...
     ]
     ```
   - Insère un job global dans `job_queue` :
     ```json
     {
       "type": "render_carousels",
       "kind": "carousel",
       "payload": {
         "orderId": "...",
         "slideCount": 5,
         "topic": "..."
       }
     }
     ```

3. **Worker `alfie-job-worker`**
   - Claim le job (statut → `running`)
   - Appelle `processRenderCarousels(job)`
   - Pour chaque slide (0 à N-1) :
     - Génère l'image via `alfie-generate-ai-image`
     - Upload vers Cloudinary : `alfie/{brandId}/{orderId}/slide-{index}`
     - Enregistre dans `library_assets` :
       ```json
       {
         "type": "carousel_slide",
         "slide_index": 0,
         "order_id": "...",
         "cloudinary_url": "..."
       }
       ```
   - Consomme les quotas : `consumeBrandQuotas(brandId, slideCount)`
   - Met à jour le job (statut → `completed`)

4. **Frontend - Affichage**
   - `ChatGenerator.tsx` groupe les assets par `order_id`
   - Tri par `slide_index` croissant
   - Affichage avec navigation entre slides

### 🎬 Génération de Vidéos (Reels)

#### Points d'entrée
- **Studio** : `ChatGenerator.tsx` avec `format: 'video'`
- **Legacy** : `chat-generate-video` (à vérifier)

#### Étapes
1. **Frontend → Edge Function**
   ```typescript
   const { data } = await supabase.functions.invoke('generate-media', {
     body: {
       format: 'video',
       topic: 'une vague qui déferle',
       brandId: activeBrandId,
       ratio: '9:16',
       duration: 15
     }
   });
   ```

2. **Edge Function `generate-media`**
   - Valide les quotas vidéo disponibles
   - Calcule le coût en Woofs : `calculate_woofs_cost(duration)`
   - Crée un `order` avec `type: 'video'`
   - Insère un job dans `job_queue` :
     ```json
     {
       "type": "generate_video",
       "kind": "video",
       "payload": {
         "orderId": "...",
         "prompt": "...",
         "duration": 15,
         "ratio": "9:16"
       }
     }
     ```

3. **Worker `alfie-job-worker`**
   - Claim le job (statut → `running`)
   - Appelle `processGenerateVideo(job)`
   - Génère la vidéo via Replicate ou Image→Video
   - Polling du statut (peut prendre 2-5 min)
   - Upload vers Cloudinary (si nécessaire)
   - Enregistre dans `media_generations` :
     ```json
     {
       "type": "video",
       "output_url": "https://...",
       "thumbnail_url": "https://...",
       "status": "completed",
       "duration_seconds": 15,
       "woofs": 2,
       "metadata": { "orderId": "..." }
     }
     ```
   - Consomme les quotas : `consumeBrandQuotas(brandId, 0, 1, woofsCost)`
   - Met à jour le job (statut → `completed`)

4. **Frontend - Affichage**
   - Polling sur `job.status` avec progress bar
   - Lien vers `media_generations` via `metadata.orderId`
   - Affichage dans `Library.tsx` avec player vidéo

## ⚙️ Gestion des Quotas

### Fonction `consumeBrandQuotas`

```typescript
async function consumeBrandQuotas(
  brandId: string,
  imageCount: number = 0,
  videoCount: number = 0,
  woofsCount: number = 0
): Promise<void>
```

**Logique** :
1. Récupère le `period_yyyymm` actuel (ex: `202501`)
2. Upsert dans `counters_monthly` :
   ```sql
   INSERT INTO counters_monthly (brand_id, period_yyyymm, images_used, reels_used, woofs_used)
   VALUES ($1, $2, $3, $4, $5)
   ON CONFLICT (brand_id, period_yyyymm)
   DO UPDATE SET
     images_used = counters_monthly.images_used + EXCLUDED.images_used,
     reels_used = counters_monthly.reels_used + EXCLUDED.reels_used,
     woofs_used = counters_monthly.woofs_used + EXCLUDED.woofs_used;
   ```
3. Trigger SQL met à jour les colonnes legacy `brands.images_used`, etc.

### Vérification des Quotas

**Dans `alfie-check-quota` :**
```typescript
// 1. Récupérer les quotas max du plan
const { quota_images, quota_videos, quota_woofs } = await getBrandPlan(brandId);

// 2. Récupérer la consommation actuelle
const { images_used, reels_used, woofs_used } = await getCurrentMonthCounters(brandId);

// 3. Comparer
if (images_used + requestedImages > quota_images) {
  throw new Error('Quota images dépassé');
}
```

**Bypass Admin** :
- Si `isAdmin === true`, les quotas sont illimités
- Vérifié via `adminEmails` ou `user_roles.role = 'admin'` ou `profile.granted_by_admin = true`

## 🔄 Worker - `alfie-job-worker`

### Architecture

```typescript
// Point d'entrée principal
serve(async (req) => {
  const jobs = await claimJobs(10); // Récupère 10 jobs max
  
  for (const job of jobs) {
    await processJob(job);
  }
});

async function processJob(job: Job) {
  try {
    switch (job.type) {
      case 'render_images':
        await processRenderImages(job);
        break;
      case 'render_carousels':
        await processRenderCarousels(job);
        break;
      case 'generate_video':
        await processGenerateVideo(job);
        break;
    }
    await markJobCompleted(job.id);
  } catch (error) {
    await handleJobError(job, error);
  }
}
```

### Gestion des Erreurs

**Stratégie de retry** :
- `max_attempts: 3` par défaut
- Attente exponentielle : `2^attempts × 60s`
- Si `attempts >= max_attempts` → `status: 'failed'`

**Logging** :
```typescript
console.log(`[alfie-job-worker] Processing job ${job.id} (type=${job.type})`);
console.error(`[alfie-job-worker] Job ${job.id} failed:`, error);
```

### Timeout

**Mécanisme** :
- Si un job reste en `running` > 10 minutes → marqué `failed` par un cleanup cron
- Edge function `cleanup-stuck-jobs` (à exécuter toutes les 15 min)

## 🎨 Frontend - Affichage des Résultats

### `ChatGenerator.tsx`

**Récupération des orders** :
```typescript
const { data: orders } = await supabase
  .from('orders')
  .select('*, library_assets(*)')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });
```

**Groupement par order** :
```typescript
const orderSummaries = orders.map(order => ({
  ...order,
  assets: order.library_assets.sort((a, b) => 
    (a.slide_index ?? 0) - (b.slide_index ?? 0)
  ),
  expectedTotal: order.type === 'carousel' ? 5 : 1,
  completedCount: order.library_assets.length
}));
```

### `Library.tsx`

**Affichage unifié** :
```typescript
const { data: assets } = await supabase
  .from('library_assets')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });

// Grouper par carousel_id pour affichage compact
const grouped = groupBy(assets, 'carousel_id');
```

## 🔍 Chemins de Code Legacy (À Nettoyer)

### Fonctions Edge Obsolètes
- `chat-create-carousel` → Migrer vers `generate-media`
- `generate-content` → Ancien système, remplacé par `generate-media`
- `create-job-set` → Legacy, remplacé par `job_queue`

### Tables Legacy
- `job_sets` → Remplacée par `orders`
- `jobs` → Remplacée par `job_queue`
- `assets` → Remplacée par `library_assets`

### Code Mort
- `src/lib/alfie/generation.ts` → Contient des fonctions non utilisées

## 📈 Métriques & Monitoring

### Logs à Surveiller
- `[alfie-job-worker] Job ${id} processing time: ${duration}ms`
- `[generate-media] Order created: ${orderId}`
- `[consumeBrandQuotas] Updated counters for brand ${brandId}`

### Dashboards Recommandés
- Taux de succès des jobs par type
- Temps moyen de génération (image/carousel/video)
- Consommation quotas par plan
- Jobs bloqués > 10 min

## 🚀 Prochaines Améliorations

1. **Realtime** : WebSocket pour mise à jour live des jobs
2. **Priorités** : Jobs premium avant jobs gratuits
3. **Batch** : Traiter N images en parallèle
4. **Cache** : Réutiliser les générations similaires
5. **A/B Testing** : Générer des variants automatiques
