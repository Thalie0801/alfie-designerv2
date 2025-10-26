-- Supprimer les packs woofs en double (garder seulement les originaux)
DELETE FROM public.woof_packs 
WHERE id IN (
  '08a6dbbc-7616-4417-b894-97bb5914eea8',
  'a0baf3c4-7a01-4914-9e5c-fd447979ec46'
);

-- Vérifier qu'il ne reste que 2 packs actifs
-- SELECT * FROM public.woof_packs WHERE active = true ORDER BY price_eur;