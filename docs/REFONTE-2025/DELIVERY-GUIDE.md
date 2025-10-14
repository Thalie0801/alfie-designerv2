# Guide de livraison PULL — Refonte V1

## Principes clés
- **Toujours** livrer via le duo **Ouvrir dans Canva** + **ZIP** téléchargeable.
- **Aucune** publication automatique ou push social : toute tentative doit lever une erreur explicite côté backend/frontend.
- Conserver les offres existantes (Starter/Pro/Studio), quotas identiques, et **rétention 30 jours** appliquée.
- Les compteurs (images, reels, woofs) doivent afficher une **alerte visuelle à 80 %**.

## Commandes utiles
- `make codex` — applique le codemod refonte (remplacements PULL, blocage autopublish, flag premium Woofs) sans toucher la landing.
- `make validate` — exécute `scripts/validate_refonte.sh` et échoue si des références "push Canva" ou "auto publish" subsistent.
- `make cleanup` — lance `scripts/storage_cleanup.sh` avec `RETENTION_DAYS=30` pour garder la rétention alignée.

## Intégration API
- Endpoint : `GET /v1/counters`
  - Voir [`examples/api/express/counters.ts`](../../examples/api/express/counters.ts).
  - Retourne `period`, `used`, `totals`, `alert80` pour images/reels/woofs.
- Autres endpoints : `/v1/creations/:id/deliver` (livraison PULL), `/v1/creations/:id/confirm-premium` (consentement Woofs).

## Frontend
- Afficher la modale Premium/Woofs avant toute consommation de Woofs.
- Utiliser [`examples/ui/Counters.tsx`](../../examples/ui/Counters.tsx) comme base pour afficher les compteurs avec état "warn" ≥ 80 %.

## Checklist avant merge
1. ✅ Lien Canva + ZIP présents sur chaque livrable.
2. ✅ Aucun call `publish*`/`push*` résiduel (codemod + validate OK).
3. ✅ Compteurs et alerte 80 % affichés.
4. ✅ Quotas identiques, stockage 30 jours opérationnel.
5. ✅ Tests codemod (ou `make test`) exécutés localement.
