-- Link Sandrine to Nathalie as parent
UPDATE affiliates 
SET parent_id = (SELECT id FROM affiliates WHERE email = 'nathaliestaelens@gmail.com')
WHERE email = 'sandrine.guedra54@gmail.com' AND parent_id IS NULL;

-- Recalculate Nathalie's affiliate status
SELECT update_affiliate_status((SELECT id FROM affiliates WHERE email = 'nathaliestaelens@gmail.com'));