# 🚀 GUIDE DE MIGRATION - NOUVEAU PROJET SUPABASE

## 📋 PRÉREQUIS

- Accès aux secrets Lovable Cloud
- Accès admin au projet Supabase actuel (itsjonazifiiikozengd)
- 1-2 heures de disponibilité

---

## 🔧 ÉTAPE 1: CRÉER LE NOUVEAU PROJET SUPABASE

### Via Lovable Cloud (RECOMMANDÉ)

1. **Aller dans Settings → Integrations → Lovable Cloud**
2. **Cliquer sur "Disconnect Cloud"** (⚠️ Cela ne supprimera PAS le projet actuel)
3. **Recliquer sur "Enable Cloud"** → Un nouveau projet sera créé automatiquement
4. **Noter les nouvelles credentials:**
   - Project ID (commence par quelque chose comme `abcdefghijklmnopqrst`)
   - Supabase URL: `https://<project-id>.supabase.co`
   - Anon Key
   - Service Role Key

---

## 💾 ÉTAPE 2: EXÉCUTER LE SCHÉMA SQL

1. **Ouvrir le nouveau projet Supabase:**
   - Settings → Cloud → View Backend
   - Aller dans SQL Editor

2. **Copier-coller le contenu COMPLET de `docs/NEW_SUPABASE_SCHEMA.sql`**

3. **Exécuter la requête** (RUN)

4. **Vérifier que toutes les tables sont créées:**
   - profiles
   - user_roles
   - brands
   - job_queue
   - library_assets
   - orders
   - counters_monthly
   - job_sets
   - idempotency_keys
   - affiliates
   - affiliate_conversions
   - payment_sessions

---

## 📊 ÉTAPE 3: MIGRER LES DONNÉES ESSENTIELLES

### A. Exporter depuis l'ancien projet

Connectez-vous à l'ancien projet Supabase et exécutez ces requêtes dans SQL Editor:

```sql
-- 1. Exporter les profiles (limité aux 50 derniers utilisateurs actifs)
COPY (
  SELECT id, email, full_name, plan, stripe_customer_id, stripe_subscription_id,
         subscription_status, quota_visuals_per_month, quota_brands, quota_videos,
         quota_woofs, visuals_used, active_brand_id, granted_by_admin, created_at
  FROM profiles
  ORDER BY created_at DESC
  LIMIT 50
) TO STDOUT WITH CSV HEADER;

-- 2. Exporter les user_roles
COPY (
  SELECT user_id, role
  FROM user_roles
  WHERE user_id IN (
    SELECT id FROM profiles ORDER BY created_at DESC LIMIT 50
  )
) TO STDOUT WITH CSV HEADER;

-- 3. Exporter les brands
COPY (
  SELECT id, user_id, name, palette, logo_url, fonts, voice, niche,
         canva_connected, images_used, carousels_used, reels_used, woofs_used,
         quota_visuals_per_month, quota_videos, quota_woofs, is_default, created_at
  FROM brands
  WHERE user_id IN (
    SELECT id FROM profiles ORDER BY created_at DESC LIMIT 50
  )
) TO STDOUT WITH CSV HEADER;

-- 4. Exporter les affiliates
COPY (
  SELECT id, user_id, email, code, parent_id, status, level,
         total_referrals, total_sales, commission_earned, created_at
  FROM affiliates
) TO STDOUT WITH CSV HEADER;
```

**⚠️ IMPORTANT:** Sauvegardez ces exports dans des fichiers CSV:
- `profiles_export.csv`
- `user_roles_export.csv`
- `brands_export.csv`
- `affiliates_export.csv`

### B. Créer les comptes auth dans le nouveau projet

Pour chaque utilisateur à migrer, vous devez créer le compte auth MANUELLEMENT:

1. **Via Supabase Dashboard → Authentication → Users → Add User**
2. **Ou via SQL (si vous avez les mots de passe hashés):**

```sql
-- Cette opération nécessite les privilèges admin auth
-- À faire via l'interface Supabase ou via API admin
```

**💡 ALTERNATIVE RECOMMANDÉE:** 

Envoyez un email aux utilisateurs actifs pour qu'ils se réinscrivent avec leur email habituel. Vous pouvez créer manuellement les comptes admin seulement.

### C. Importer les données dans le nouveau projet

Une fois les comptes auth créés, importez les données:

```sql
-- 1. Importer profiles (ajuster les valeurs depuis le CSV)
INSERT INTO profiles (id, email, full_name, plan, ...)
VALUES
  ('uuid-1', 'user1@example.com', 'User One', 'pro', ...),
  ('uuid-2', 'user2@example.com', 'User Two', 'free', ...);

-- 2. Importer user_roles
INSERT INTO user_roles (user_id, role)
VALUES
  ('uuid-admin', 'admin'),
  ('uuid-mod', 'moderator');

-- 3. Importer brands
INSERT INTO brands (id, user_id, name, palette, ...)
VALUES
  ('brand-uuid-1', 'uuid-1', 'Brand Name', '["#FF0000"]'::jsonb, ...);

-- 4. Importer affiliates
INSERT INTO affiliates (id, user_id, email, code, ...)
VALUES
  ('aff-uuid-1', 'uuid-1', 'affiliate@example.com', 'CODE123', ...);
```

---

## 🔑 ÉTAPE 4: METTRE À JOUR LES SECRETS LOVABLE CLOUD

### Secrets à mettre à jour:

1. **ALFIE_SUPABASE_URL** → `https://<new-project-id>.supabase.co`
2. **VITE_SUPABASE_URL** → `https://<new-project-id>.supabase.co`
3. **ALFIE_SUPABASE_ANON_KEY** → Nouvelle anon key
4. **VITE_SUPABASE_ANON_KEY** → Nouvelle anon key
5. **ALFIE_SUPABASE_SERVICE_ROLE_KEY** → Nouvelle service role key
6. **SUPABASE_SERVICE_ROLE_KEY** → Nouvelle service role key
7. **SUPABASE_URL** → `https://<new-project-id>.supabase.co`
8. **SUPABASE_ANON_KEY** → Nouvelle anon key

### Comment mettre à jour:

Via l'interface Lovable:
- Settings → Cloud → Secrets
- Cliquer sur "Edit" pour chaque secret
- Coller la nouvelle valeur

---

## 🔄 ÉTAPE 5: METTRE À JOUR LE CODE

### A. Mettre à jour supabase/config.toml

```toml
project_id = "nouveau-project-id"
```

### B. Mettre à jour .github/workflows/deploy-supabase-functions.yml

```yaml
DEFAULT_PROJECT_REF: nouveau-project-id
```

### C. Redéployer les Edge Functions

Toutes les Edge Functions seront automatiquement redéployées lors du prochain build.

Pour forcer un redéploiement immédiat:
- Settings → Cloud → Functions → Deploy All

---

## ✅ ÉTAPE 6: VÉRIFICATIONS

### Tests à effectuer:

1. **Login:** Essayer de se connecter avec un compte admin
2. **Studio:** Créer une image de test
3. **Job Queue:** Vérifier que les jobs sont traités
4. **Library:** Vérifier que les assets s'affichent
5. **Billing:** Tester un paiement Stripe (en mode test)

### Requêtes de diagnostic:

```sql
-- Vérifier le nombre d'utilisateurs
SELECT COUNT(*) FROM profiles;

-- Vérifier les jobs en cours
SELECT status, COUNT(*) FROM job_queue GROUP BY status;

-- Vérifier les assets
SELECT COUNT(*) FROM library_assets;

-- Vérifier les brands
SELECT user_id, COUNT(*) FROM brands GROUP BY user_id;
```

---

## 🚨 ROLLBACK (SI NÉCESSAIRE)

Si la migration échoue, vous pouvez revenir à l'ancien projet:

1. Remettre les anciens secrets dans Lovable Cloud
2. Remettre l'ancien `project_id` dans `supabase/config.toml`
3. Redéployer

---

## 📝 NOTES IMPORTANTES

### ⚠️ CE QUI NE SERA PAS MIGRÉ:

- ❌ Historique `media_generations` (cause du problème)
- ❌ Jobs anciens dans `job_queue` (on repart à zéro)
- ❌ Historique des paiements (sauf si vraiment nécessaire)

### ✅ CE QUI SERA CONSERVÉ:

- ✅ Utilisateurs actifs
- ✅ Rôles admin/moderator
- ✅ Brands configurées
- ✅ Affiliés et leur hiérarchie
- ✅ Quotas et plans

---

## 🎯 ESTIMATION DE TEMPS

- **Création nouveau projet:** 5 min
- **Exécution schéma SQL:** 2 min
- **Export données ancien projet:** 10 min
- **Import données nouveau projet:** 30 min (si script, sinon 1h manuellement)
- **Mise à jour secrets:** 10 min
- **Tests de vérification:** 15 min

**TOTAL:** ~1h30 (avec scripts) ou 2h30 (manuellement)

---

## 🆘 SUPPORT

En cas de problème:
1. Vérifier les logs des Edge Functions
2. Vérifier les RLS policies
3. Vérifier que les secrets sont bien mis à jour
4. Contacter Lovable Support si nécessaire
