# Système de Quotas et Conformité Alfie

## Configuration Système (src/config/systemConfig.ts)

Tous les paramètres système sont centralisés et peuvent être ajustés :

```typescript
SYSTEM_CONFIG = {
  VEO3_WOOF_FACTOR: 4,           // Coût Veo 3 en Woofs
  SORA_WOOF_FACTOR: 1,           // Coût Sora en Woofs
  HARD_STOP_MULTIPLIER: 1.10,    // Hard-stop à 110% des quotas
  ALERT_THRESHOLD: 0.80,         // Alerte à 80% des quotas
  ASSET_RETENTION_DAYS: 30,      // Rétention assets (J+30)
  RESET_DAY_OF_MONTH: 1,         // Reset quotas le 1er du mois
  PACK_WOOFS_SIZES: [50, 100],   // Tailles des packs add-on
  PROMPT_MAX_LOG_LENGTH: 100,    // Limite logs prompts (RGPD)
  LOG_RETENTION_DAYS: 30,        // Rétention logs (J+30)
}
```

## Architecture Multi-Tenant

### 1. Isolation par Marque (Brand)
- Chaque marque a son propre plan et quotas dédiés
- Quotas mensuels : `quota_images`, `quota_videos`, `quota_woofs`
- Compteurs : `images_used`, `videos_used`, `woofs_used`
- Reset automatique le 1er du mois via cron job

### 2. Modèle de Données

**brands**
```sql
- id: uuid (PK)
- user_id: uuid (FK)
- name: text
- plan: plan_type (starter|pro|studio)
- quota_images: int (150/450/1000)
- quota_videos: int (15/45/100)
- quota_woofs: int (15/45/100)
- images_used: int
- videos_used: int
- woofs_used: int
- resets_on: date
- stripe_subscription_id: text
```

**media_generations (Assets)**
```sql
- id: uuid (PK)
- brand_id: uuid (FK)
- user_id: uuid (FK)
- type: text (image|video)
- engine: asset_engine (nano|sora|veo3)
- woofs: int (0 pour images, 1 pour Sora, 4 pour Veo3)
- prompt: text
- output_url: text
- expires_at: timestamp (created_at + 30j)
- status: text (completed|expired)
```

**generation_logs (Audit Trail)**
```sql
- id: uuid (PK)
- brand_id: uuid (FK)
- user_id: uuid (FK)
- type: text (image|video)
- engine: text (nano|sora|veo3)
- prompt_summary: text (tronqué à 100 chars - RGPD)
- woofs_cost: int
- status: text (success|failed|expired)
- duration_seconds: int (analytics)
- error_code: text
- metadata: jsonb
```

## Sécurité et Conformité RGPD

### 1. Isolation des Données
- RLS policies sur toutes les tables sensibles
- Utilisateurs ne voient que leurs propres données
- Admins ont accès global via `has_role(auth.uid(), 'admin')`

### 2. Logs Sobres
- Prompts tronqués à 100 caractères maximum
- Pas de données sensibles dans les logs
- Purge automatique des logs > 30 jours
- Utilisation : `logGeneration()` de `generationLogger.ts`

### 3. Purge Automatique
Deux cron jobs PostgreSQL configurés :

**Purge Assets (quotidien, 2h UTC)**
- Marque les assets expirés comme `status='expired'`
- Conserve l'historique pour audit
- Edge function : `purge-expired-assets`

**Reset Quotas (mensuel, 1er à 1h UTC)**
- Reset des compteurs `*_used` à 0
- Mise à jour de `resets_on` au mois suivant
- Edge function : `reset-monthly-quotas`

### 4. Export Avant Purge
Les utilisateurs peuvent télécharger leurs assets avant expiration.
Message d'avertissement affiché à J-7.

## Routing Vidéo

### Règles de Décision (videoRouting.ts)

1. **Sora par défaut** (1 Woof)
   - Vidéos ≤ 10 secondes
   - Styles : reel, loop, intro, quick

2. **Veo 3** (4 Woofs)
   - Vidéos > 10 secondes
   - Styles : cinématique, ads, visage, complexe

3. **Fallback Budget**
   - Si `remainingWoofs < 4` : force Sora
   - Message utilisateur explicite

### Hard-Stop et Alertes

**Hard-Stop à 110%**
- Bloque toute génération
- Message : "Quota atteint. Ajoutez un Pack Woofs (+50/+100) ou patientez jusqu'au {reset_date}"

**Alerte à 80%**
- Toast warning
- Message : "Vous avez utilisé X% de vos quotas pour {brand}"
- Suggestion d'upgrade

## Roadmap

### V1 (Actuel)
✅ Génération images/vidéos avec quotas
✅ Compteurs et alertes
✅ Packaging et download
✅ Purge automatique 30j
✅ Adaptation Canva (gratuite)
✅ Logs sobres (RGPD)

### V2 (API Canva)
- [ ] Dépôt auto dans dossier Canva
- [ ] Planification publication

### V2.1 (Analytics)
- [ ] Favoris de prompts par marque
- [ ] Analytics : ratio Sora/Veo, temps brief→livrable
- [ ] Dashboard analytics (déjà préparé via `generation_logs`)

## Utilisation Développeur

### Logger une Génération
```typescript
import { logGeneration } from '@/utils/generationLogger';

await logGeneration({
  brandId: activeBrandId,
  userId: user.id,
  type: 'video',
  engine: 'sora',
  prompt: userPrompt,
  woofsCost: 1,
  status: 'success',
  durationSeconds: 120,
  metadata: { aspect_ratio: '16:9' }
});
```

### Vérifier les Quotas
```typescript
import { getQuotaStatus, canGenerateVideo } from '@/utils/quotaManager';

const status = await getQuotaStatus(brandId);
const check = await canGenerateVideo(brandId, woofCost);

if (!check.canGenerate) {
  toast.error(check.reason);
  return;
}
```

### Analytics Marque
```typescript
import { getBrandAnalytics } from '@/utils/generationLogger';

const analytics = await getBrandAnalytics(brandId);
// { totalGenerations, soraCount, veo3Count, successRate, ... }
```

## Tests des Cron Jobs

Pour tester manuellement les cron jobs :

```bash
# Tester la purge
curl -X POST https://itsjonazifiiikozengd.supabase.co/functions/v1/purge-expired-assets \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Tester le reset quotas
curl -X POST https://itsjonazifiiikozengd.supabase.co/functions/v1/reset-monthly-quotas \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

## Monitoring

Les logs sont disponibles dans :
- Supabase Dashboard → Edge Functions → Logs
- Table `generation_logs` pour audit
- Cron jobs logs dans PostgreSQL extensions

## Support

Pour modifier les paramètres système, éditer `src/config/systemConfig.ts`.
Les cron jobs sont configurés dans la migration SQL et peuvent être ajustés via `pg_cron.schedule()`.
