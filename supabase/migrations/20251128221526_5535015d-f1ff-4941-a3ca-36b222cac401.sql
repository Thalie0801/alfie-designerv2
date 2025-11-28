-- Autoriser les affiliés à créer une demande de paiement pour eux-mêmes
-- L'affiliate.id EST déjà l'UUID de l'utilisateur
CREATE POLICY "affiliates_can_insert_own_payouts"
ON affiliate_payouts
FOR INSERT
TO authenticated
WITH CHECK (
  affiliate_id = auth.uid()
);