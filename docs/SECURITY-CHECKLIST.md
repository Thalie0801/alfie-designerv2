# Audit rapide de sécurité

Cette checklist reprend les exigences fournies et note l'état actuel du dépôt. Les éléments cochés disposent d'une mise en œuvre vérifiable dans le code ou la configuration ; les éléments non cochés nécessitent encore du travail ou une confirmation côté infrastructure.

## Infrastructure
- [ ] HTTPS obligatoire (TLS 1.3) — à confirmer sur l'hébergement (Vercel gère automatiquement TLS mais aucune preuve dans le dépôt).
- [ ] Firewall applicatif (WAF) — aucune configuration Vercel/Supabase documentée.
- [ ] Backups chiffrés automatiques — non documentés dans le dépôt.
- [ ] Séparation dev/staging/prod — pas de fichiers d'environnement distincts repérés.

## Code
- [x] Pas de secrets hardcodés — les fonctions côté Supabase lisent les clés via variables d'environnement (ex. `REPLICATE_API_TOKEN`, `KIE_API_KEY` dans `supabase/functions/generate-video/index.ts`).
- [x] Validation des inputs — les edge functions vérifient la présence des paramètres obligatoires et renvoient des erreurs explicites (ex. `prompt`, `generationId` dans `supabase/functions/generate-video/index.ts`).
- [x] Requêtes SQL paramétrées — les accès base passent par le client Supabase qui encapsule les paramètres (`from().insert()`, `rpc()` dans `supabase/functions/create-video/index.ts`).
- [ ] Dépendances à jour (`npm audit`) — l'exécution échoue (403 sur l'API npm) donc statut à confirmer manuellement.
- [ ] ESLint sécurité — la configuration actuelle n'embarque aucune règle ou plugin orienté sécurité.

## API
- [ ] Authentification JWT — partielle : plusieurs edge functions désactivent `verify_jwt` dans `supabase/config.toml`, ce qui laisse des routes publiques.
- [ ] Rate limiting par IP — seules des colonnes de quota par utilisateur existent, aucune limitation par adresse IP (voir migration `20251006092524...` sur `profiles`).
- [ ] CORS restrictif — les fonctions exposent `Access-Control-Allow-Origin: *` (ex. en-têtes dans `supabase/functions/generate-video/index.ts`).
- [ ] Validation des uploads — aucun contrôle explicite du type de fichier lorsque des contenus générés sont stockés.
- [x] Logs d'accès — les créations sont tracées dans `generation_logs` via le logger applicatif (`src/utils/generationLogger.ts`).

## Base de données
- [ ] Connexions chiffrées (SSL) — dépend de la configuration Supabase/Postgres externe, non documentée ici.
- [x] Principe du moindre privilège — les tables sensibles appliquent RLS et limitent la visibilité aux propriétaires / admins (ex. politiques dans `supabase/migrations/20251009045414_dbbad460-5569-4507-a714-9ff4e565a8c3.sql`).
- [ ] Pas de rôle root en production — aucune mention dans la configuration.
- [ ] Backups testés régulièrement — aucun script ou documentation détecté.

## Monitoring
- [ ] Alertes sur tentatives d'intrusion — aucune intégration SIEM/alerte documentée.
- [ ] Dashboard de sécurité — non présent dans les dashboards listés.
- [ ] Logs centralisés (ELK/Splunk) — non documenté.
- [ ] Tests de pénétration trimestriels — pas de trace de campagne régulière.

> Cette synthèse sert de base de travail : compléter chaque case restante avec une action ou un lien de preuve au fur et à mesure des remédiations.
