# Flux d'authentification et redirection

## Ordre de priorité pour la navigation après authentification

La fonction `navigateAfterAuth()` dans `src/pages/Auth.tsx` applique cette logique :

1. **Admin** (`effectiveIsAdmin === true`) → `/admin`
2. **Whitelist VIP OU Autorisé** (`effectiveIsAuthorized === true`) → `/dashboard`
   - `effectiveIsAuthorized = isAuthorized || isForceDashboard`
   - Whitelist VIP : comptes clients exceptionnels (Sandrine, Patricia)
3. **Non autorisé** → `/onboarding/activate`

## Comptes VIP (Whitelist)

Certains clients bénéficient d'un accès **garanti** au dashboard, même sans plan actif :
- `sandrine.guedra54@gmail.com`
- `borderonpatricia7@gmail.com`

Voir `docs/WHITELIST_VIP.md` pour plus de détails.

## Garanties de sécurité

- La navigation n'a lieu que lorsque `flagsReady === true`, c'est-à-dire que `isAdmin` et `isAuthorized` sont des booléens (pas `undefined`)
- Tous les logs de redirection commencent par `[Auth redirect]` pour faciliter le debugging
- Les admins ne sont **jamais** redirigés vers `/onboarding/activate`
- Les comptes VIP whitelist ont un accès **garanti** au dashboard, même sans plan actif
- Normalisation des emails (trim + lowercase) pour éviter les contournements

## Codes d'erreur de `verify-payment`

La fonction edge `verify-payment` retourne des codes d'erreur structurés :

| Code | Description | Action suggérée |
|------|-------------|-----------------|
| `SUCCESS` | Paiement vérifié avec succès | Continuer le flux |
| `SESSION_ID_REQUIRED` | Aucun session_id fourni | Erreur technique |
| `SESSION_NOT_FOUND` | Session Stripe introuvable | Session invalide ou expirée |
| `PAYMENT_NOT_COMPLETED` | Paiement non finalisé | Rediriger vers paiement |
| `INVALID_PLAN` | Plan inconnu dans metadata | Erreur de configuration |
| `STORAGE_ERROR` | Erreur DB lors du stockage | Erreur technique |
| `UNKNOWN_ERROR` | Erreur non gérée | Erreur technique |

## Nettoyage de l'URL

Après vérification du paiement, les paramètres suivants sont supprimés de l'URL :
- `session_id`
- `payment`
- `mode`

Cela évite de re-vérifier le paiement lors d'un refresh.

## Logs de debug

Pour activer les logs détaillés, chercher `console.debug('[Auth'` dans le code.
Pour les désactiver en production, utiliser un wrapper ou une variable d'environnement.

### Exemples de logs

```
[Auth] Payment session detected, verifying...
[Auth] Payment verified successfully { plan: 'pro', email: 'user@example.com' }
[Auth redirect] Navigating after auth {
  email: 'sandrine.guedra@gmail.com',
  isAdmin: false,
  isAuthorized: false,
  isForceDashboard: true,        ← Whitelist VIP
  effectiveIsAuthorized: true,   ← Accès garanti
  flagsReady: true
}
[Auth redirect] → /dashboard (authorized or whitelisted)
[Auth] Cleaned payment params from URL
```

## Protection contre les actions concurrentes

Le formulaire est désactivé (`formDisabled = true`) lorsque :
- `loading === true` (soumission en cours)
- `verifyingPayment === true` (vérification paiement en cours)
- `mode === 'signup' && !canSignUp` (inscription non autorisée)

Cela empêche les doubles soumissions et les actions concurrentes.
