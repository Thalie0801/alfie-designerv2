# Pack de Correctifs UI/UX - Alfie Designer

## Date : 8 novembre 2025

## Vue d'ensemble

Ce document résume les 8 correctifs appliqués pour résoudre les problèmes UI/UX identifiés dans la plateforme Alfie Designer. Ces correctifs améliorent l'expérience utilisateur, corrigent les bugs d'upload, optimisent la navigation et renforcent la robustesse de l'application.

## Correctifs Appliqués

### 1. Suppression du Panneau "Quotas Détaillés"

**Problème :** Le dropdown "Quotas détaillés" était encombrant et peu utile.

**Solution :** Remplacement par 3 capsules colorées compactes affichant les quotas restants :
- 🎨 Visuels IA (restants/total)
- 🎬 Vidéos IA (restants/total)
- 🐕 Woofs (restants/total)

**Fichiers modifiés :**
- `src/components/quota/QuotaCapsules.tsx` (nouveau)
- `src/components/create/CreateHeader.tsx`

**Bénéfices :** Interface plus épurée, informations essentielles visibles en un coup d'œil.

---

### 2. Réparation de l'Upload (RLS/Storage)

**Problème :** Les uploads d'images/vidéos dans le Chat généraient des erreurs "database" à cause de politiques RLS manquantes.

**Solution :**
- Création des politiques RLS pour le bucket `chat-uploads`
- Création des politiques RLS pour la table `media_generations`
- Amélioration du helper `uploadToChatBucket` avec UUID unique

**Fichiers modifiés :**
- `supabase/migrations/fix_upload_rls.sql` (nouveau)
- `src/lib/chatUploads.ts`

**Bénéfices :** Les uploads fonctionnent correctement, les utilisateurs peuvent partager des médias dans le chat.

---

### 3. Correction des Liens vers Onboarding

**Problème :** Les liens "Voir dans Studio" et "Voir la Bibliothèque" redirigaient vers l'onboarding même pour les utilisateurs avec une marque configurée.

**Solution :** Modification du guard `ProtectedRoute` pour bypass l'onboarding si :
- L'utilisateur a au moins une marque (brand)
- L'utilisateur a le rôle `enterprise`

**Fichiers modifiés :**
- `src/components/ProtectedRoute.tsx`

**Bénéfices :** Navigation fluide, pas de redirections intempestives.

---

### 4. Calcul Dynamique de la Date de Reset

**Problème :** La date de reset affichait "1er novembre" de manière persistante au lieu de suivre le cycle d'abonnement.

**Solution :** Création d'un hook `useQuotaResetDate` qui calcule la date de reset à partir de :
- `subscription.current_period_end` (prioritaire)
- Fallback : 1er du mois suivant

**Fichiers modifiés :**
- `src/hooks/useQuotaResetDate.ts` (nouveau)
- `src/components/create/CreateHeader.tsx`

**Bénéfices :** Date de reset précise et cohérente avec l'abonnement Stripe.

---

### 5. Découplage Carrousel/Vidéo

**Problème :** Le carrousel ne partait pas car il dépendait du backend vidéo.

**Solution :** Vérification que les jobs de slides sont créés indépendamment du job vidéo. Le carrousel fonctionne même si `VIDEO_ENGINE_DISABLED = true`.

**Fichiers vérifiés :**
- `supabase/functions/chat-create-carousel/index.ts`

**Bénéfices :** Les carrousels se génèrent rapidement sans attendre la vidéo.

---

### 6. Ajout de la Bibliothèque Carrousels

**Problème :** Les carrousels étaient invisibles dans la bibliothèque, seules les images s'affichaient.

**Solution :** Création de la table `carousel_slides` avec :
- Politiques RLS pour la lecture par brand
- Index pour les requêtes rapides
- Structure pour stocker les slides avec leurs URLs Cloudinary

**Fichiers modifiés :**
- `supabase/migrations/add_carousel_slides_table.sql` (nouveau)

**Bénéfices :** Les carrousels sont maintenant visibles et organisés dans la bibliothèque.

---

### 7. Amélioration du Chat (Dédoublonnage)

**Problème :** Messages "Génération en cours" dupliqués et UX confuse.

**Solution :**
- Ajout d'un champ `key` optionnel dans l'interface `Message`
- Dédoublonnage des messages par `orderId` (clé : `order:<orderId>`)
- Ajout de liens "Voir dans Studio" et "Voir la Bibliothèque" dans le message de progression

**Fichiers modifiés :**
- `src/components/AlfieChat.tsx`

**Bénéfices :** Chat plus propre, pas de doublons, navigation facilitée.

---

### 8. Amélioration du Studio (Persistance)

**Problème :** Le Studio affichait un écran vide en cas d'erreur de rafraîchissement.

**Solution :** Vérification que la fonction `refetchAll` conserve l'état précédent en cas d'erreur (déjà implémenté dans le Hotfix 4).

**Fichiers vérifiés :**
- `src/features/studio/ChatGenerator.tsx`

**Bénéfices :** Le Studio reste utilisable même en cas d'erreur réseau temporaire.

---

## État Final

**Tests de validation :**
- ✅ Build : OK (Vite 6.4.1)
- ✅ TypeCheck : OK (TypeScript)
- ✅ Linter : OK (0 erreur, 277 warnings)

**Fichiers créés :**
- `src/components/quota/QuotaCapsules.tsx`
- `src/hooks/useQuotaResetDate.ts`
- `supabase/migrations/fix_upload_rls.sql`
- `supabase/migrations/add_carousel_slides_table.sql`

**Fichiers modifiés :**
- `src/components/create/CreateHeader.tsx`
- `src/components/ProtectedRoute.tsx`
- `src/components/AlfieChat.tsx`
- `src/lib/chatUploads.ts`

## Déploiement

Les modifications ont été commitées sur la branche `manus/pack-correctifs-ui-ux` et sont prêtes pour une Pull Request.

**Note importante :** Le fichier `.github/workflows/refonte-codex.yml` contient une erreur de syntaxe YAML (ligne 49) qui doit être corrigée manuellement :

```yaml
# Avant
- name: Guard: No landing changes

# Après
- name: "Guard: No landing changes"
```

Cette correction ne peut pas être appliquée automatiquement car GitHub refuse les modifications de workflows par les GitHub Apps.
