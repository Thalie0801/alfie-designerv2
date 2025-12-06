-- Changer la valeur par défaut de status de 'active' à 'pending'
ALTER TABLE public.profiles 
ALTER COLUMN status SET DEFAULT 'pending';