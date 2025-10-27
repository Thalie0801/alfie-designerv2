# Tests de validation - Whitelist VIP / Admin

Cette checklist permet de vérifier que la configuration d'accès fonctionne correctement avec
les variables d'environnement `VIP_EMAILS` et `ADMIN_EMAILS`.

## 1. Compte Admin (email présent dans `ADMIN_EMAILS`)

- [ ] Se connecter avec un email configuré dans `ADMIN_EMAILS`.
- [ ] Vérifier la redirection directe vers `/admin`.
- [ ] Aucun passage par `/onboarding/activate`.
- [ ] Vérifier les logs console : `[Auth redirect] → /admin (admin user)`.

## 2. Compte VIP (email présent dans `VIP_EMAILS`)

- [ ] Login avec un email listé dans `VIP_EMAILS` sans abonnement actif.
- [ ] Redirection immédiate vers `/dashboard`.
- [ ] Logs attendus :
  ```
  [Auth redirect] Navigating after auth {
    isWhitelisted: true,
    effectiveIsAuthorized: true
  }
  ```
- [ ] Pas de bannière « Connexion requise » sur le dashboard.

### 2.1 Navigation manuelle

- [ ] Accéder à `/dashboard` puis rafraîchir la page → rester sur le dashboard.
- [ ] Accéder directement à `/onboarding/activate` → rester autorisé (pas de redirection).

## 3. Utilisateur normal sans plan

- [ ] Login avec un email **non présent** dans les whitelist et plan `free`.
- [ ] La connexion doit être refusée.
- [ ] Redirection vers `/pricing?reason=no-sub`.
- [ ] Message toast affiché : « Votre abonnement n'est pas actif… ».

## 4. Utilisateur normal avec plan actif

- [ ] Login avec un compte payant.
- [ ] Redirection vers `/dashboard`.
- [ ] Logs `[Auth redirect]` indiquant `isAuthorized: true`.

## 5. Normalisation des emails

Pour chaque adresse configurée dans `VIP_EMAILS`/`ADMIN_EMAILS` :

- [ ] Tester avec majuscules/minuscules (`Vip.User@Example.com`).
- [ ] Tester avec espaces (`  vip.user@example.com  `).
- [ ] Vérifier que l'accès est toujours accordé.

## 6. Contrôle post-login

- [ ] Pour un compte non autorisé, vérifier que `useAuth.signIn` renvoie une erreur
      `NO_ACTIVE_SUBSCRIPTION`.
- [ ] S'assurer que `supabase.auth` revient à un état déconnecté.

## 7. Logs à surveiller

- `[Auth redirect]`
- `[Auth]`
- `[ProtectedRoute]`

Exemple d'accès autorisé via whitelist :

```
[ProtectedRoute] Access granted {
  email: 'vip1@example.com',
  effectiveIsAdmin: false,
  effectiveIsAuthorized: true,
  isWhitelisted: true
}
```

Si un compte autorisé est bloqué, vérifier :

1. Les variables d'environnement (`VIP_EMAILS`, `ADMIN_EMAILS`).
2. La présence éventuelle d'espaces ou de fautes de frappe.
3. Le redémarrage du serveur après modification de l'environnement.
