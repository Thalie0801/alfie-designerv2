# Guide d'Application de la Migration SQL - Studio Timeout

## 🚨 Problème Identifié

**Erreur** : `canceling statement due to statement timeout` (code SQL 57014)

**Cause** : Les requêtes vers `media_generations` et `job_queue` prennent trop de temps car il manque des index sur les colonnes `user_id`, `created_at`, `order_id` et `status`.

**Impact** : Le Studio reste vide et ne peut pas afficher les jobs/assets.

---

## 📋 Solution : Appliquer la Migration SQL

### Option 1 : Via le Dashboard Supabase (Recommandé)

1. **Ouvrir le Dashboard Supabase**
   - Aller sur https://supabase.com/dashboard
   - Sélectionner votre projet Alfie Designer

2. **Ouvrir l'éditeur SQL**
   - Dans le menu de gauche, cliquer sur **"SQL Editor"**
   - Cliquer sur **"New query"**

3. **Copier-coller le SQL**
   - Ouvrir le fichier `supabase/migrations/fix_studio_timeout.sql` depuis GitHub
   - Copier tout le contenu
   - Coller dans l'éditeur SQL de Supabase

4. **Exécuter le SQL**
   - Cliquer sur **"Run"** (ou Ctrl+Enter)
   - Attendre que l'exécution se termine (environ 5-10 secondes)
   - Vérifier qu'il n'y a pas d'erreur

5. **Vérifier les index créés**
   - Exécuter cette requête pour vérifier :
   ```sql
   SELECT 
     schemaname, 
     tablename, 
     indexname, 
     indexdef 
   FROM pg_indexes 
   WHERE tablename IN ('media_generations', 'job_queue')
   ORDER BY tablename, indexname;
   ```
   - Vous devriez voir les nouveaux index commençant par `idx_`

---

### Option 2 : Via Supabase CLI (Avancé)

Si vous avez Supabase CLI installé localement :

```bash
# 1. Se connecter à Supabase
supabase login

# 2. Lier le projet local
supabase link --project-ref YOUR_PROJECT_REF

# 3. Appliquer les migrations
supabase db push
```

---

## 🧪 Tests de Validation

Après avoir appliqué la migration SQL :

### Test 1 : Vérifier que le Studio se charge

1. **Recharger la page du Studio** (F5)
2. **Vérifier dans la console** (F12) qu'il n'y a plus d'erreur de timeout
3. **Vérifier que les jobs s'affichent** (s'il y en a)

### Test 2 : Vérifier les performances

1. **Ouvrir l'onglet Network** dans les DevTools (F12)
2. **Recharger la page du Studio**
3. **Chercher la requête vers `media_generations`**
4. **Vérifier que le temps de réponse est < 1 seconde** (au lieu de 3+ secondes avant)

### Test 3 : Créer un nouveau job

1. **Aller dans le Chat Alfie**
2. **Demander de créer une image** (ex: "Crée-moi une image de chat")
3. **Aller dans le Studio**
4. **Vérifier que le job apparaît immédiatement**

---

## 📊 Index Créés

La migration crée les index suivants :

### Sur `media_generations` :
- `idx_media_generations_user_id` → Filtre rapide par utilisateur
- `idx_media_generations_created_at` → Tri rapide par date
- `idx_media_generations_user_created` → Filtre + tri combinés (optimal)
- `idx_media_generations_order_id` → Filtre rapide par commande
- `idx_media_generations_status` → Filtre rapide par statut

### Sur `job_queue` :
- `idx_job_queue_user_id` → Filtre rapide par utilisateur
- `idx_job_queue_created_at` → Tri rapide par date
- `idx_job_queue_user_created` → Filtre + tri combinés (optimal)
- `idx_job_queue_order_id` → Filtre rapide par commande
- `idx_job_queue_status` → Filtre rapide par statut
- `idx_job_queue_status_updated` → Détection rapide des jobs bloqués

---

## 🔍 Diagnostic en Cas de Problème

Si le Studio reste vide après application de la migration :

### 1. Vérifier que les index existent

```sql
SELECT 
  schemaname, 
  tablename, 
  indexname 
FROM pg_indexes 
WHERE tablename IN ('media_generations', 'job_queue')
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
```

Vous devriez voir **11 index** au total (5 pour `media_generations` + 6 pour `job_queue`).

### 2. Vérifier qu'il y a des données

```sql
-- Compter les jobs de l'utilisateur
SELECT COUNT(*) FROM job_queue 
WHERE user_id = 'VOTRE_USER_ID';

-- Compter les assets de l'utilisateur
SELECT COUNT(*) FROM media_generations 
WHERE user_id = 'VOTRE_USER_ID';
```

Si les compteurs sont à 0, c'est normal que le Studio soit vide (pas de jobs).

### 3. Vérifier les politiques RLS

```sql
-- Vérifier les politiques sur job_queue
SELECT * FROM pg_policies WHERE tablename = 'job_queue';

-- Vérifier les politiques sur media_generations
SELECT * FROM pg_policies WHERE tablename = 'media_generations';
```

Il doit y avoir au moins une politique `FOR SELECT` qui permet à l'utilisateur de lire ses propres données.

### 4. Tester la requête manuellement

```sql
-- Remplacer VOTRE_USER_ID par votre vrai user_id
SELECT * FROM media_generations 
WHERE user_id = 'VOTRE_USER_ID' 
ORDER BY created_at DESC 
LIMIT 50;
```

Cette requête doit retourner un résultat en **moins de 1 seconde**.

---

## 📞 Support

Si le problème persiste après avoir appliqué la migration :

1. **Vérifier les logs Supabase** dans le Dashboard (menu "Logs")
2. **Vérifier la console du navigateur** (F12) pour d'autres erreurs
3. **Consulter les autres problèmes** dans `TACHES_BACKEND_URGENTES.md`

---

## ✅ Checklist

- [ ] Migration SQL appliquée via Dashboard Supabase
- [ ] Index vérifiés (11 index créés)
- [ ] Studio rechargé (F5)
- [ ] Aucune erreur de timeout dans la console
- [ ] Jobs/assets s'affichent dans le Studio (si existants)
- [ ] Temps de réponse < 1 seconde pour les requêtes
