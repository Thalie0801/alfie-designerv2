# 🛡️ SYSTÈME DE PRÉVENTION DE SATURATION DB

## 🎯 Objectif
Empêcher la saturation de la base de données comme celle qui a bloqué itsjonazifiiikozengd (252MB de base64 dans media_generations).

---

## ✅ RÈGLES CRITIQUES (NON-NÉGOCIABLES)

### 1. ⛔ JAMAIS DE BASE64 EN DB
- **Interdiction absolue** de stocker des images/vidéos en base64 dans la DB
- Toujours utiliser Cloudinary pour le stockage binaire
- Seulement stocker les URLs Cloudinary dans `library_assets`

### 2. 📦 Table `library_assets` - Structure optimisée
```sql
CREATE TABLE public.library_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.job_queue(id) ON DELETE SET NULL,
  asset_type TEXT NOT NULL, -- 'image', 'carousel', 'video'
  cloudinary_public_id TEXT, -- ID Cloudinary pour transformation
  cloudinary_url TEXT, -- URL signée (https://res.cloudinary.com/...)
  thumbnail_url TEXT, -- URL thumbnail (optionnel)
  metadata JSONB DEFAULT '{}'::jsonb, -- prompt, dimensions, etc.
  slide_index INTEGER, -- Pour carousels multi-slides
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_library_assets_user_id ON public.library_assets(user_id);
CREATE INDEX idx_library_assets_brand_id ON public.library_assets(brand_id);
CREATE INDEX idx_library_assets_created_at ON public.library_assets(created_at DESC);
```

### 3. 🗑️ TTL Automatique - Cleanup des assets anciens
```sql
-- Fonction de nettoyage automatique (30 jours)
CREATE OR REPLACE FUNCTION public.cleanup_old_assets()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.library_assets
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Cron job quotidien (via pg_cron ou edge function schedulée)
-- Appeler cleanup_old_assets() chaque jour à 3h du matin
```

### 4. 📊 Requêtes Frontend Optimisées
```typescript
// ❌ INTERDIT - Ne JAMAIS charger les blobs
const { data } = await supabase
  .from('library_assets')
  .select('*'); // ❌ Charge TOUT y compris les URLs longues

// ✅ CORRECT - Seulement les métadonnées
const { data } = await supabase
  .from('library_assets')
  .select('id, asset_type, thumbnail_url, metadata, created_at')
  .order('created_at', { ascending: false })
  .limit(50);

// Charger cloudinary_url seulement si besoin (download/preview)
const { data: fullAsset } = await supabase
  .from('library_assets')
  .select('cloudinary_url')
  .eq('id', assetId)
  .single();
```

---

## 🔧 IMPLÉMENTATION POST-MIGRATION

### Phase 1 : Schéma DB propre (✅ Déjà dans NEW_SUPABASE_SCHEMA.sql)
- Table `library_assets` sans colonne `output_url`
- Indexes sur `user_id`, `brand_id`, `created_at`

### Phase 2 : Edge Functions - Validation stricte
```typescript
// Dans alfie-job-worker/index.ts et alfie-render-image/index.ts
async function saveAssetToLibrary(asset: {
  userId: string;
  brandId: string;
  jobId: string;
  assetType: string;
  cloudinaryPublicId: string;
  cloudinaryUrl: string;
}) {
  // ⚠️ Validation : interdire les data:image/png;base64
  if (asset.cloudinaryUrl.startsWith('data:')) {
    throw new Error('SECURITY: base64 URLs are forbidden in library_assets');
  }

  // ✅ Insérer seulement les URLs Cloudinary
  const { error } = await supabase
    .from('library_assets')
    .insert({
      user_id: asset.userId,
      brand_id: asset.brandId,
      job_id: asset.jobId,
      asset_type: asset.assetType,
      cloudinary_public_id: asset.cloudinaryPublicId,
      cloudinary_url: asset.cloudinaryUrl,
      thumbnail_url: `${asset.cloudinaryUrl}/w_200,h_200,c_fill`, // Thumbnail Cloudinary
      metadata: {},
      created_at: new Date().toISOString(),
    });

  if (error) throw error;
}
```

### Phase 3 : Frontend - Hooks optimisés
```typescript
// src/hooks/useLibraryAssets.tsx
export function useLibraryAssets(brandId: string) {
  return useQuery({
    queryKey: ['library-assets', brandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('library_assets')
        .select('id, asset_type, thumbnail_url, metadata, created_at')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .limit(50); // Pagination

      if (error) throw error;
      return data;
    },
  });
}
```

### Phase 4 : Monitoring - Edge Function
```typescript
// supabase/functions/monitor-db-size/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Requête taille DB
  const { data } = await supabase.rpc('pg_database_size', { dbname: 'postgres' });
  const sizeGB = data / (1024 * 1024 * 1024);

  // ⚠️ Alerte si > 2GB
  if (sizeGB > 2) {
    console.error(`🚨 DB SIZE ALERT: ${sizeGB.toFixed(2)}GB`);
    // Envoyer notification (email, Slack, etc.)
  }

  return new Response(JSON.stringify({ size_gb: sizeGB }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

---

## 📋 CHECKLIST POST-MIGRATION

- [ ] Nouveau schéma SQL exécuté (sans `output_url`)
- [ ] Edge Functions validés (pas de base64 autorisé)
- [ ] Hooks frontend optimisés (pas de `SELECT *`)
- [ ] Fonction `cleanup_old_assets()` créée
- [ ] Cron job de nettoyage activé (30 jours)
- [ ] Monitoring DB activé (alerte > 2GB)
- [ ] Tests : Générer 10 images → Vérifier `library_assets` < 1MB

---

## 🎯 RÉSULTAT ATTENDU

| Métrique | Ancien projet | Nouveau projet |
|----------|---------------|----------------|
| Taille DB | 252MB (saturé) | < 50MB (propre) |
| `library_assets` | Base64 blobs | URLs Cloudinary |
| TTL assets | ❌ Aucun | ✅ 30 jours |
| Requêtes frontend | `SELECT *` | `SELECT id, ...` |
| Monitoring | ❌ Aucun | ✅ Alerte > 2GB |

---

## 🆘 EN CAS DE PROBLÈME

Si la DB commence à grossir anormalement :

```sql
-- Diagnostic : Trouver les grosses tables
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;

-- Diagnostic : Trouver les grosses colonnes dans library_assets
SELECT
  id,
  asset_type,
  length(cloudinary_url) AS url_length,
  pg_column_size(metadata) AS metadata_size
FROM public.library_assets
ORDER BY pg_column_size(metadata) DESC
LIMIT 10;
```

Si `library_assets` > 100MB → **Appliquer cleanup manuel immédiat**.
