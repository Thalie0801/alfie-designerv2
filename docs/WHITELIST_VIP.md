# Whitelist VIP & Admin (Accès Dashboard)

## Vue d'ensemble

Les comptes disposant d'un accès garanti au dashboard sont désormais gérés par des
**variables d'environnement**. Deux listes distinctes existent :

- `VIP_EMAILS` : clients autorisés à utiliser l'app même sans abonnement actif.
- `ADMIN_EMAILS` : accès administrateur complet, même sans abonnement.

Les valeurs sont **insensibles à la casse** et doivent être séparées par des virgules.
Exemple dans `.env.local` :

```ini
VIP_EMAILS="sandrine.guedra54@gmail.com,borderonpatricia7@gmail.com"
ADMIN_EMAILS="nathaliestaelens@gmail.com"
```

> ⚠️ N'ajoutez jamais d'adresses e-mail réelles dans le dépôt Git. Elles doivent être
> configurées uniquement dans vos variables d'environnement locales ou de production.

## Utilitaires disponibles

La logique centrale se trouve dans `src/lib/access.ts` :

```ts
export const list = (value?: string): string[]
export const VIPS: string[]
export const ADMINS: string[]
export const isVip(email?: string | null): boolean
export const isAdmin(email?: string | null): boolean
export const isVipOrAdmin(email?: string | null): boolean
```

Ces helpers sont utilisés côté client pour :

- Autoriser la connexion (cf. `useAuth.tsx`).
- Calculer les redirections post-login (`src/pages/Auth.tsx`).
- Protéger les routes (`src/components/ProtectedRoute.tsx`).

## Comment ajouter un nouvel accès VIP/Admin ?

1. Ouvrez votre fichier `.env.local` (ou la configuration Vercel/Vercel CLI).
2. Ajoutez l'email désiré dans la liste correspondante, séparé par une virgule.
3. Redémarrez le serveur de développement si nécessaire.

Exemple :

```ini
VIP_EMAILS="sandrine.guedra54@gmail.com,borderonpatricia7@gmail.com"
ADMIN_EMAILS="nathaliestaelens@gmail.com"
```

## Règles de priorité

1. **Admin** (`ADMIN_EMAILS` ou rôle Supabase `admin`) → accès complet `/admin`.
2. **VIP** (`VIP_EMAILS`) → accès dashboard même sans plan actif.
3. **Utilisateur payant** → accès normal via abonnement.
4. **Utilisateur non connecté** → redirection vers `/auth`.
5. **Utilisateur sans abonnement** → connexion refusée, redirection `/pricing?reason=no-sub`.

## Vérifications rapides

- `isVipOrAdmin(email)` renvoie `true` pour tout compte autorisé sans abonnement.
- `useAuth.signIn` bloque la connexion si `hasActiveSubscriptionByEmail` renvoie `false` et que
  l'utilisateur n'est ni VIP ni admin.
- `AccessGuard` n'affiche « Connexion requise » que pour les visiteurs non connectés.

## Logs utiles

Activez la console du navigateur et surveillez les préfixes suivants :

- `[Auth redirect]` → logique de navigation après login.
- `[Auth]` → détails sur la récupération de session et l'état d'autorisation.
- `[ProtectedRoute]` → validation côté client avant affichage d'une page protégée.

Exemple attendu pour un VIP :

```
[Auth redirect] Navigating after auth {
  email: 'sandrine.guedra54@gmail.com',
  isAdmin: false,
  isAuthorized: false,
  isWhitelisted: true,
  effectiveIsAuthorized: true,
  flagsReady: true
}
```

Si un compte configuré dans `VIP_EMAILS` est bloqué, vérifiez :

1. Que l'email est correctement orthographié et sans espaces.
2. Que le serveur a été redémarré après modification de l'environnement.
3. Que la casse est normalisée (le helper applique déjà `trim().toLowerCase()`).
