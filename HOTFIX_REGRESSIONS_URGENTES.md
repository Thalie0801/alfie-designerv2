# Hotfix Régressions Urgentes - Alfie Designer

## Date : 8 novembre 2025

## 1. Problèmes Identifiés

Suite au déploiement du commit `30c122a`, plusieurs régressions critiques ont été identifiées :

1. ❌ **Doublons de capsules quotas** : Les quotas s'affichent en double (738/1000 + 616/1000)
2. ❌ **Date de reset incorrecte** : Affiche "1 novembre" au lieu de "1 décembre"
3. ❌ **Studio vide** : Aucun job affiché, seulement le bouton "Forcer le traitement"
4. ❌ **Pas d'aperçus dans la bibliothèque** : Les carrousels n'affichent pas d'aperçus
5. ❌ **Carrousels cassés** : Textes tronqués et liens visibles sur les slides
6. ❌ **Génération vidéo cassée** : Redirige vers une URL Cloudinary brute
7. ❌ **Upload cassé** : Ouvre un nouvel onglet au lieu d'uploader

## 2. Corrections Appliquées (Frontend)

### ✅ Correction 1 : Suppression des doublons de quotas

**Problème** : Les composants `CreateHeader` et `QuotaBar` affichaient tous les deux des capsules de quotas.

**Solution** : Suppression de `QuotaBar` dans `AlfieChat.tsx` (ligne 792).

**Fichier modifié** :
- `src/components/AlfieChat.tsx`

```diff
- {/* Quota Bar */}
- {activeBrandId && <QuotaBar activeBrandId={activeBrandId} />}
```

### ✅ Correction 2 : Date de reset dynamique

**Problème** : Le hook `useQuotaResetDate` utilisait une date passée (`resetsOn`) sans vérifier si elle était dans le futur.

**Solution** : Ajout d'une vérification pour ignorer les dates passées et utiliser le fallback (1er du mois prochain).

**Fichier modifié** :
- `src/hooks/useQuotaResetDate.ts`

```typescript
export function useQuotaResetDate(subscription?: Subscription | null): Date {
  const today = new Date();
  
  // If subscription has a current_period_end, use it only if it's in the future
  if (subscription?.current_period_end) {
    try {
      const resetDate = new Date(subscription.current_period_end);
      if (resetDate > today) {
        return resetDate;
      }
      // Date is in the past, fall through to fallback
    } catch {
      // Invalid date, fall through to fallback
    }
  }

  // Fallback: first day of next month
  return new Date(today.getFullYear(), today.getMonth() + 1, 1);
}
```

## 3. Problèmes Non Résolus (Backend/Base de Données)

Les problèmes suivants nécessitent des actions côté backend ou base de données :

### ⚠️ Problème 3 : Studio vide

**Cause probable** : 
- Politiques RLS trop restrictives sur `job_queue` ou `media_generations`
- Aucun job dans la base de données pour l'utilisateur actuel

**Action requise** :
1. Vérifier les politiques RLS sur `job_queue` et `media_generations`
2. Vérifier que des jobs existent dans la base de données
3. Vérifier les logs de la requête SQL dans Supabase

### ⚠️ Problème 4 : Pas d'aperçus dans la bibliothèque

**Cause probable** : 
- Les carrousels n'ont pas de `thumbnail_url` dans `media_generations`
- Les aperçus ne sont pas générés lors de la création du carrousel

**Action requise** :
1. Vérifier que l'edge function `alfie-render-carousel-slide` génère bien un `thumbnail_url`
2. Ajouter une génération d'aperçu pour les carrousels

### ⚠️ Problème 5 : Carrousels avec textes tronqués et liens visibles

**Cause probable** : 
- L'edge function `alfie-render-carousel-slide` génère des overlays avec des textes trop longs
- Les URLs Cloudinary sont visibles sur les slides au lieu d'être masquées

**Action requise** :
1. Vérifier le code de `supabase/functions/alfie-render-carousel-slide/index.ts`
2. Limiter la longueur des textes dans les overlays
3. S'assurer que les URLs ne sont pas affichées sur les slides

**Code à vérifier** :
```typescript
// Dans alfie-render-carousel-slide/index.ts
// Vérifier que les textes sont tronqués correctement
const title = slideContent.title?.substring(0, 50) || '';
const subtitle = slideContent.subtitle?.substring(0, 100) || '';
```

### ⚠️ Problème 6 : Génération vidéo redirige vers Cloudinary

**Cause probable** : 
- Le bouton "Créer une vidéo" utilise un lien `<a href="...">` au lieu d'un bouton qui appelle une edge function
- L'URL Cloudinary est construite côté frontend au lieu d'être générée par le backend

**Action requise** :
1. Vérifier le composant qui affiche le bouton "Créer une vidéo" dans la bibliothèque
2. Remplacer le lien par un bouton qui appelle une edge function
3. Créer une edge function qui génère la vidéo et retourne l'URL finale

### ⚠️ Problème 7 : Upload ouvre un nouvel onglet

**Cause probable** : 
- Les politiques RLS du bucket `chat-uploads` n'ont pas été appliquées
- La migration `fix_upload_rls.sql` n'a pas été exécutée sur Supabase

**Action requise** :
1. Appliquer la migration `supabase/migrations/fix_upload_rls.sql` sur Supabase
2. Vérifier que le bucket `chat-uploads` existe et a les bonnes politiques RLS

**Commande à exécuter** :
```bash
# Depuis votre machine locale avec Supabase CLI
supabase db push
```

Ou appliquer manuellement le SQL dans l'éditeur SQL de Supabase :
```sql
-- Voir le contenu de supabase/migrations/fix_upload_rls.sql
```

## 4. État Final

**Corrections frontend appliquées** :
- ✅ Doublons quotas supprimés
- ✅ Date de reset corrigée

**Corrections backend requises** :
- ⚠️ Studio vide (RLS/données)
- ⚠️ Aperçus manquants (edge function)
- ⚠️ Carrousels cassés (edge function)
- ⚠️ Vidéo cassée (edge function)
- ⚠️ Upload cassé (migration SQL)

## 5. Prochaines Étapes

1. **Appliquer la migration SQL** : `fix_upload_rls.sql`
2. **Vérifier les edge functions** : `alfie-render-carousel-slide`, génération vidéo
3. **Vérifier les politiques RLS** : `job_queue`, `media_generations`
4. **Tester l'upload** après application de la migration
5. **Tester les carrousels** après correction des edge functions
