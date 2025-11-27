# Gestion des VIP & Admin

## Vue d'ensemble

Les comptes disposant d'un accès privilégié au dashboard sont gérés par deux mécanismes :

1. **VIP** : Gérés via la table `user_roles` en base de données avec le rôle `vip`
2. **Admin** : Gérés via `ADMIN_EMAILS` (variable d'environnement) ou le rôle `admin` en base de données

## Système VIP (via user_roles)

Les utilisateurs VIP ont accès à l'application même sans abonnement actif. Les VIP sont gérés exclusivement via la table `user_roles` en base de données.

### Comment ajouter un VIP ?

1. Connectez-vous à votre backend Lovable Cloud
2. Accédez à la table `user_roles`
3. Ajoutez une nouvelle entrée avec :
   - `user_id` : L'UUID de l'utilisateur (depuis la table `profiles`)
   - `role` : `vip`

### Exemple SQL

```sql
-- Ajouter un utilisateur VIP
INSERT INTO user_roles (user_id, role)
SELECT id, 'vip'::app_role
FROM profiles
WHERE email = 'user@example.com'
ON CONFLICT (user_id, role) DO NOTHING;
```

## Système Admin

Les administrateurs bénéficient d'un accès complet, y compris aux pages `/admin`. Ils peuvent être configurés de deux manières :

### Option 1 : Variable d'environnement (recommandé pour les super-admins)

Configurez la variable `ADMIN_EMAILS` dans votre environnement :

```ini
ADMIN_EMAILS="admin1@example.com,admin2@example.com"
```

Les valeurs sont insensibles à la casse et séparées par des virgules.

⚠️ **N'ajoutez jamais d'adresses e-mail réelles dans le dépôt Git.** Elles doivent être configurées uniquement dans vos variables d'environnement locales ou de production.

### Option 2 : Table user_roles (pour les admins délégués)

Pour créer un admin via la base de données :

```sql
-- Ajouter un administrateur
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM profiles
WHERE email = 'admin@example.com'
ON CONFLICT (user_id, role) DO NOTHING;
```

## Utilitaires disponibles

La logique de vérification se trouve dans :

- **Frontend** : `src/lib/access.ts`
  ```ts
  export async function isVip(userId: string): Promise<boolean>
  export async function isAdmin(userId: string): Promise<boolean>
  export async function isVipOrAdmin(userId: string): Promise<boolean>
  ```

- **Backend** : `supabase/functions/_shared/auth.ts`
  ```ts
  export function isAdminUser(email: string, roles: RoleRow[], options?: AdminCheckOptions): boolean
  ```

Ces helpers sont utilisés pour :
- Autoriser la connexion (cf. `useAuth.tsx`)
- Calculer les redirections post-login (`src/pages/Auth.tsx`)
- Protéger les routes (`src/components/ProtectedRoute.tsx`)
- Vérifier les permissions dans les Edge Functions

## Règles de priorité

1. **Admin** (`ADMIN_EMAILS` ou rôle `admin`) → accès complet `/admin`
2. **VIP** (rôle `vip`) → accès dashboard même sans plan actif
3. **Utilisateur payant** → accès normal via abonnement
4. **Utilisateur non connecté** → redirection vers `/auth`
5. **Utilisateur sans abonnement** → connexion refusée, redirection `/pricing?reason=no-sub`

## Vérifications rapides

- `isVipOrAdmin(userId)` renvoie `true` pour tout compte autorisé sans abonnement
- `useAuth.signIn` bloque la connexion si l'utilisateur n'a ni abonnement, ni rôle VIP/Admin
- `AccessGuard` n'affiche « Connexion requise » que pour les visiteurs non connectés

## Logs utiles

Activez la console du navigateur et surveillez les préfixes suivants :

- `[Auth redirect]` → logique de navigation après login
- `[Auth]` → détails sur la récupération de session et l'état d'autorisation
- `[ProtectedRoute]` → validation côté client avant affichage d'une page protégée
- `[Access]` → chargement des rôles depuis la base de données

Exemple attendu pour un VIP :

```
[Access] Loaded roles for 12345678...: vip
[Auth redirect] Navigating after auth {
  email: 'user@example.com',
  isAdmin: false,
  isVip: true,
  effectiveIsAuthorized: true
}
```

Si un compte VIP est bloqué, vérifiez :

1. Que l'entrée existe bien dans la table `user_roles`
2. Que le `user_id` correspond bien à l'utilisateur
3. Que le rôle est exactement `vip` (sensible à la casse dans la base)
4. Que le cache des rôles n'est pas obsolète (TTL de 60 secondes)

## Migration depuis l'ancien système

L'ancien système `VIP_EMAILS` (hardcodé en variable d'environnement) a été supprimé. Tous les VIP doivent désormais être gérés via la table `user_roles` pour une meilleure sécurité et traçabilité.
