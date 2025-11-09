# Checklist de vérifications projet

## Installation et build
- [ ] `git clone <repo>`
- [ ] `npm ci` (ou `yarn install` / `pnpm install` selon le gestionnaire)
- [ ] `npm run build`
- [ ] `npx tsc --noEmit`
- [ ] `npm test`

> Problèmes fréquents : dépendances manquantes, versions de Node incompatibles (consulter `engines` dans `package.json` ou `.nvmrc`), échec du build TypeScript (options `tsconfig`), scripts manquants dans `package.json`.

## TypeScript
- [ ] Exécuter `npx tsc --noEmit` pour recenser toutes les erreurs de typage.
- [ ] Vérifier `tsconfig.json` (ex. `strict`, `target`, `moduleResolution`, `esModuleInterop`, `paths`/`baseUrl`).
- [ ] Identifier des fichiers `.d.ts` manquants pour les dépendances non typées.

## Lint / Formatage
- [ ] `npm run lint` (ESLint) : corriger toute erreur bloquante.
- [ ] Surveiller les conflits entre règles lint et code (ex. `import/order`, `noImplicitAny`).

## Dépendances
- [ ] `npm audit` et/ou `npm outdated` pour détecter vulnérabilités ou breaking changes.
- [ ] Contrôler la cohérence entre le lockfile et l'engine (ex. `yarn.lock` vs `package-lock.json`).

## CI / GitHub Actions
- [ ] Inspecter les logs Actions si des workflows échouent.
- [ ] Diagnostiquer les causes classiques : secrets manquants, token expiré, cache corrompu, version de Node divergente.

## Environnements / Variables
- [ ] Vérifier la présence de `.env.example`.
- [ ] Confirmer que les variables sensibles nécessaires au démarrage sont documentées ou fournies.
- [ ] Identifier les scripts qui supposent une base de données locale (migrations, seeders).

## Base de données / PLpgSQL
- [ ] Vérifier les migrations/fonctions PLpgSQL pour les erreurs de syntaxe.
- [ ] Confirmer la validité des configurations de connexion (HOST/PORT/USER/PASS).

## Structure Git / Fichiers manquants
- [ ] S'assurer que les fichiers essentiels existent : `README`, `.github/workflows`, `package.json`, `tsconfig.json`, `src/`, etc.
- [ ] Identifier les fichiers binaires volumineux committés (à éviter).

## Problèmes courants front/back
- [ ] Repérer les incohérences d'import (extensions `.ts`/`.js`), chemins relatifs cassés après déplacements/renommages.
- [ ] S'assurer que toute modification d'API est répercutée côté client.

## Informations à partager pour obtenir de l'aide
- [ ] Contenu de `package.json` et `tsconfig.json`.
- [ ] Logs des commandes : `npm ci`, `npm run build`, `npx tsc --noEmit`, `npm test`.
- [ ] Fichiers de workflow GitHub Actions (`.github/workflows/*.yml`) et logs d'exécution.
- [ ] Messages d'erreur précis (stack trace) ou copie complète de la sortie du terminal.
- [ ] Extraits de migrations PLpgSQL si des problèmes DB sont suspectés.
- [ ] Commandes utiles à collecter :
  - `node -v && npm -v`
  - `npm ci`
  - `npx tsc --noEmit`
  - `npm run build`
  - `npm test`
  - `npm run lint`
  - `git status --porcelain`
  - `ls -la` (racine) et `tree -L 2` (si disponible)

