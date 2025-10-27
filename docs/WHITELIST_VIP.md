# Whitelist VIP - Comptes Clients Exceptionnels

## Vue d'ensemble

Certains comptes clients bénéficient d'un accès **garanti** au dashboard (`/dashboard`), indépendamment de leur statut d'abonnement ou d'autorisation normale. Ces comptes sont gérés via une **whitelist** définie dans le code.

## Comptes VIP actuels

| Email | Notes |
|-------|-------|
| `sandrine.guedra@gmail.com` | Compte VIP - Ambassadeur |
| `sandrine.guedra54@gmail.com` | Compte VIP - Ambassadeur (variante) |
| `borderonpatricia7@gmail.com` | Compte VIP - Ambassadeur |
| `patriciaborderon7@gamil.com` | Rétro-compatibilité (ancienne orthographe) |
| `nathaliestaelens@gmail.com` | Admin - Accès complet |

## Fonctionnement

### 1. Normalisation des emails

Tous les emails sont normalisés avant comparaison :
- Trim (suppression espaces)
- Lowercase (minuscules)

```typescript
function normalizeEmail(email?: string | null): string {
  return (email ?? '').trim().toLowerCase();
}
```

### 2. Calcul des flags effectifs

Dans **Auth.tsx** et **ProtectedRoute.tsx** :

```typescript
const emailNorm = normalizeEmail(user?.email);
const isForceDashboard = FORCE_DASHBOARD_EMAILS.has(emailNorm);

// Flag effectif = autorisé normalement OU dans la whitelist
const effectiveIsAuthorized = isAuthorized || isForceDashboard;
```

### 3. Logique de navigation (Auth.tsx)

```typescript
const navigateAfterAuth = useCallback(() => {
  // 1. Admin d'abord (priorité absolue)
  if (effectiveIsAdmin) return navigate('/admin');
  
  // 2. Whitelist VIP OU autorisés normalement
  if (effectiveIsAuthorized) return navigate('/dashboard');
  
  // 3. Sinon onboarding
  return navigate('/onboarding/activate');
}, [effectiveIsAdmin, effectiveIsAuthorized, navigate]);
```

### 4. Protection des routes (ProtectedRoute.tsx)

- Les utilisateurs whitelist **ne sont jamais redirigés** vers `/onboarding/activate`
- Ils sont traités comme des utilisateurs autorisés normaux
- Les admins conservent toujours la priorité (accès `/admin`)

## Hiérarchie des priorités

1. **Admin** → `/admin` (priorité absolue)
2. **Whitelist VIP** → `/dashboard` (même sans plan actif)
3. **Autorisé normal** → `/dashboard` (avec plan actif)
4. **Non autorisé** → `/onboarding/activate`

## Ajout d'un nouveau compte VIP

Pour ajouter un compte à la whitelist :

1. Ouvrir `src/lib/vip-whitelist.ts`
2. Ajouter l'email (sera automatiquement normalisé) dans `FORCE_DASHBOARD_EMAILS` :

```typescript
export const FORCE_DASHBOARD_EMAILS = new Set([
  'sandrine.guedra@gmail.com',
  'patriciaborderon7@gamil.com',
  'nouveau.client@example.com', // ← Nouveau compte
]);
```

3. ✅ **Un seul fichier à modifier** - la logique est automatiquement synchronisée dans :
   - `src/pages/Auth.tsx` (navigation après login)
   - `src/components/ProtectedRoute.tsx` (protection des routes)

## Utilitaires disponibles

Le fichier `src/lib/vip-whitelist.ts` expose :

```typescript
// Whitelist des emails VIP
export const FORCE_DASHBOARD_EMAILS: Set<string>

// Normalise un email (trim + lowercase)
export function normalizeEmail(email?: string | null): string

// Vérifie si un email est VIP
export function isVIPUser(email?: string | null): boolean

// Calcule l'autorisation effective (autorisé OU VIP)
export function getEffectiveAuthorization(
  isAuthorized: boolean, 
  userEmail?: string | null
): boolean
```

## Logs de debug

Tous les logs de whitelist utilisent le préfixe `[Auth redirect]` ou `[ProtectedRoute]` :

```
[Auth redirect] Navigating after auth {
  email: 'sandrine.guedra@gmail.com',
  isAdmin: false,
  isAuthorized: false,
  isForceDashboard: true,        ← Whitelist détectée
  effectiveIsAuthorized: true,   ← Accès garanti
  flagsReady: true
}
```

```
[ProtectedRoute] Access granted {
  email: 'sandrine.guedra@gmail.com',
  effectiveIsAdmin: false,
  effectiveIsAuthorized: true,   ← Accès garanti via whitelist
  isForceDashboard: true
}
```

## Tests de validation

### Cas 1 : Sandrine sans plan actif

- ✅ Login → `/dashboard` (pas `/onboarding/activate`)
- ✅ Accès direct à toutes les fonctionnalités dashboard
- ✅ Pas de message "Plan requis"

### Cas 2 : Patricia sans plan actif

- ✅ Login → `/dashboard`
- ✅ Même comportement que Sandrine

### Cas 3 : Compte VIP + Admin

- ✅ Login → `/admin` (admin prioritaire)
- ✅ Peut aussi accéder `/dashboard` si souhaité

### Cas 4 : User normal sans plan

- ✅ Login → `/onboarding/activate` (comportement normal)

## Sécurité

- ❌ **NE PAS** stocker les flags whitelist en localStorage/sessionStorage
- ✅ **TOUJOURS** calculer `effectiveIsAuthorized` côté serveur si besoin
- ✅ Les emails sont normalisés pour éviter les contournements
- ✅ Set JavaScript garantit unicité et recherche O(1)

## Maintenance

- **Revue mensuelle** : Vérifier si les comptes VIP sont toujours actifs
- **Documentation** : Garder ce fichier à jour avec les nouveaux VIP
- **Communication** : Informer l'équipe support des comptes exceptionnels
