-- Allow queued and rendering statuses for orders
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('draft','brief_collection','text_generation','visual_generation','rendering','queued','completed','failed'));
