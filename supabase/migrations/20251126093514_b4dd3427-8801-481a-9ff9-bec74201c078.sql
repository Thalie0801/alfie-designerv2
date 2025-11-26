-- Fix orders table constraints
-- 1. Drop and recreate status check constraint with all valid statuses
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('draft','brief_collection','text_generation','visual_generation','rendering','queued','completed','failed'));

-- 2. Fix foreign key to point to profiles instead of auth.users
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_user_id_fkey;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;