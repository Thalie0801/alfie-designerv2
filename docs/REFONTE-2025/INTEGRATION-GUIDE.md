# Guide d'intégration — Refonte V1
## Rappels clés
- Livraison **PULL** vers Canva (bouton _Ouvrir dans Canva_) + **ZIP** structuré. Aucune publication automatique. :contentReference[oaicite:3]{index=3}
- Compteurs Images/Reels/Woofs avec **alerte 80 %**. :contentReference[oaicite:4]{index=4}
- Offres inchangées (Starter/Pro/Studio), **1 plan = 1 marque**, stockage 30 jours. :contentReference[oaicite:5]{index=5}

## Branches & CI
- Travailler sur `refonte-alfie-2025`. La workflow _Refonte Codex_ applique les transformations auto, puis pousse.
- La workflow _Guard — No Landing Changes_ interdit toute modification de la landing.

## Backend (exemple Express)
```ts
// routes/refonte.ts
router.post('/v1/creations', createDeliverable);
router.get('/v1/creations/:id/preview', getPreview);
router.post('/v1/creations/:id/confirm-premium', confirmPremium); // consomme des Woofs (sur confirmation)
router.get('/v1/creations/:id/deliver', getCanvaLinkAndZip);       // PULL vers Canva + ZIP
router.get('/v1/counters', getCounters);
```
Ces endpoints doivent respecter : pas de _push_ Canva, pas d'autopublication, délais preview ciblés. :contentReference[oaicite:6]{index=6}

## Front (points d'entrée)
- Afficher la **modale Premium** avant tout usage Premium T2V (consommation Woofs). :contentReference[oaicite:7]{index=7}
- Afficher les **compteurs** et l'alerte à 80 %.
- Récupérer l'abonnement actif via Supabase et vérifier les quotas avant de créer un visuel.

```ts
// hooks/useSubscription.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/supabase/client';

export const useSubscription = () =>
  useQuery({
    queryKey: ['subscription'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_subscription_details')
        .select('*')
        .single();

      if (error) throw error;
      return data;
    },
  });

export const canCreateVisual = async (
  userId: string,
  increment = 1,
) => {
  const { data, error } = await supabase.rpc('check_user_quota', {
    p_user_id: userId,
    p_quota_type: 'visuals_per_month',
    p_increment: increment,
  });

  if (error) throw error;
  return Boolean(data);
};
```

## Qualité
- Checklists AA, alt‑texts, SRT vidéo, safe‑zones 9:16. :contentReference[oaicite:8]{index=8}
