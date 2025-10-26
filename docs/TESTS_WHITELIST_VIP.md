# Tests de validation - Whitelist VIP

Ce document fournit une checklist de tests manuels pour valider le bon fonctionnement de la whitelist VIP.

## ✅ Checklist de tests

### 1. Test Admin (nathaliestaelens@gmail.com)

**Objectif** : Vérifier que les admins ne sont jamais redirigés vers `/onboarding/activate`

- [ ] Login avec compte admin
- [ ] Vérifier redirection → `/admin`
- [ ] Vérifier logs console : `[Auth redirect] → /admin (admin user)`
- [ ] ✅ **JAMAIS** de passage par `/onboarding/activate`

### 2. Test Sandrine (sandrine.guedra@gmail.com)

**Objectif** : Compte VIP sans plan actif doit accéder au dashboard

#### 2.1 Sans plan actif

- [ ] Login avec sandrine.guedra@gmail.com
- [ ] Vérifier redirection → `/dashboard`
- [ ] Vérifier logs console :
  ```
  [Auth redirect] Navigating after auth {
    email: 'sandrine.guedra@gmail.com',
    isAdmin: false,
    isAuthorized: false,
    isForceDashboard: true,        ← Doit être true
    effectiveIsAuthorized: true,   ← Doit être true
  }
  ```
- [ ] Aucun message "Plan requis" ou redirection `/onboarding/activate`
- [ ] Accès complet aux fonctionnalités dashboard

#### 2.2 Navigation manuelle

- [ ] Essayer d'accéder directement à `/onboarding/activate`
- [ ] Vérifier que le `ProtectedRoute` laisse passer (pas de redirection)
- [ ] Vérifier logs : `[ProtectedRoute] Access granted { isForceDashboard: true }`

#### 2.3 Refresh page

- [ ] Sur `/dashboard`, faire F5 (refresh)
- [ ] Vérifier que l'utilisateur reste sur `/dashboard`
- [ ] Pas de redirection intempestive vers `/onboarding/activate`

### 3. Test Patricia (patriciaborderon7@gamil.com)

**Objectif** : Même comportement que Sandrine

- [ ] Login avec patriciaborderon7@gamil.com
- [ ] Vérifier redirection → `/dashboard`
- [ ] Vérifier `isForceDashboard: true` dans les logs
- [ ] Accès complet dashboard sans plan actif

**Note** : Attention à l'orthographe "gamil" (pas "gmail") dans l'email

### 4. Test User normal sans plan

**Objectif** : Comportement standard doit être préservé

- [ ] Login avec compte non-VIP sans plan actif
- [ ] Vérifier redirection → `/onboarding/activate`
- [ ] Vérifier logs :
  ```
  [Auth redirect] {
    isAdmin: false,
    isAuthorized: false,
    isForceDashboard: false,       ← Doit être false
    effectiveIsAuthorized: false,  ← Doit être false
  }
  ```
- [ ] Message approprié sur la page onboarding

### 5. Test User normal avec plan actif

**Objectif** : Comportement standard avec abonnement

- [ ] Login avec compte ayant un plan actif (non-VIP)
- [ ] Vérifier redirection → `/dashboard`
- [ ] Vérifier logs :
  ```
  [Auth redirect] {
    isAuthorized: true,
    isForceDashboard: false,
    effectiveIsAuthorized: true,   ← true via isAuthorized
  }
  ```

### 6. Test normalisation email

**Objectif** : Vérifier que les variations d'email fonctionnent

Pour chaque compte VIP, tester :

- [ ] Email avec espaces : `  sandrine.guedra@gmail.com  `
- [ ] Email avec majuscules : `Sandrine.Guedra@Gmail.com`
- [ ] Email mixte : `  SaNdRiNe.GUEdRA@gmail.com  `

Tous doivent fonctionner → redirection `/dashboard`

### 7. Test après paiement

**Objectif** : VIP + nouveau paiement = dashboard direct

- [ ] Simuler un paiement avec email VIP (sandrine.guedra@gmail.com)
- [ ] URL : `/auth?session_id=XXX&payment=success`
- [ ] Vérifier vérification paiement OK
- [ ] Vérifier redirection → `/dashboard` (pas onboarding)
- [ ] Vérifier nettoyage URL (plus de `session_id`, `payment`, `mode`)

### 8. Test edge case : VIP + Admin

**Objectif** : Admin prioritaire même si VIP

- [ ] Si Sandrine devient admin (ajout rôle)
- [ ] Login → doit aller vers `/admin` (priorité admin)
- [ ] Pas vers `/dashboard` même si VIP

## 🔍 Logs à surveiller

Activer la console du navigateur et filtrer par :
- `[Auth redirect]`
- `[Auth]`
- `[ProtectedRoute]`

### Logs OK pour VIP

```
[Auth] User logged in and flags ready, navigating... {
  email: 'sandrine.guedra@gmail.com',
  isAdmin: false,
  isAuthorized: false,
  isForceDashboard: true,          ← ✅ OK
  effectiveIsAuthorized: true      ← ✅ OK
}
[Auth redirect] → /dashboard (authorized or whitelisted)
```

### Logs KO (problème)

```
[Auth redirect] → /onboarding/activate (not authorized)
```

❌ Si un compte VIP arrive ici, il y a un problème !

## 🐛 Debugging

Si un compte VIP est redirigé vers `/onboarding/activate` :

1. **Vérifier l'email dans la whitelist**
   - Ouvrir `src/lib/vip-whitelist.ts`
   - Chercher l'email exact (attention typos)

2. **Vérifier la normalisation**
   - Dans console : `normalizeEmail('  SaNdRiNe.GUEdRA@gmail.com  ')`
   - Résultat attendu : `'sandrine.guedra@gmail.com'`

3. **Vérifier les logs**
   - `isForceDashboard` doit être `true`
   - `effectiveIsAuthorized` doit être `true`

4. **Vérifier le code**
   - `Auth.tsx` importe bien `isVIPUser` et `getEffectiveAuthorization`
   - `ProtectedRoute.tsx` importe bien les mêmes utilitaires
   - Pas de code mort qui écrase les flags

## ✨ Tests de régression

Après chaque modification du système d'auth, re-tester :

- [ ] Les 2 comptes VIP (Sandrine + Patricia)
- [ ] Au moins 1 admin
- [ ] Au moins 1 user normal (avec et sans plan)

**Durée estimée** : ~15 minutes pour test complet

## 📊 Résultats attendus

| Compte | Plan actif | `isForceDashboard` | `effectiveIsAuthorized` | Destination |
|--------|------------|-------------------|------------------------|-------------|
| Admin (nathaliestaelens) | N/A | false | N/A | `/admin` |
| Sandrine VIP | ❌ Non | ✅ true | ✅ true | `/dashboard` |
| Patricia VIP | ❌ Non | ✅ true | ✅ true | `/dashboard` |
| User normal | ✅ Oui | ❌ false | ✅ true | `/dashboard` |
| User normal | ❌ Non | ❌ false | ❌ false | `/onboarding/activate` |

## 🎯 Validation finale

Pour considérer la whitelist VIP comme validée :

- ✅ Tous les tests Sandrine passent (sans plan)
- ✅ Tous les tests Patricia passent (sans plan)
- ✅ Admin nathaliestaelens va toujours vers `/admin`
- ✅ Users normaux comportement standard préservé
- ✅ Logs de debug cohérents et informatifs
- ✅ Aucun compte VIP ne passe par `/onboarding/activate`
