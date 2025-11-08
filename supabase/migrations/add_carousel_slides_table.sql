-- Add carousel_slides table for library listing
-- Date: 2025-11-08

create table if not exists public.carousel_slides (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  slide_index int not null check (slide_index >= 0),
  cloudinary_url text,
  cloudinary_public_id text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  unique(order_id, slide_index)
);

-- Enable RLS
alter table public.carousel_slides enable row level security;

-- Policy: users can view slides from their own brands
create policy "slides: view own brand"
on public.carousel_slides for select
to authenticated
using ( brand_id in (select id from brands where user_id = auth.uid()) );

-- Policy: service role can insert/update slides
create policy "slides: service can manage"
on public.carousel_slides for all
to service_role
using ( true )
with check ( true );

-- Index for faster queries
create index if not exists idx_carousel_slides_brand_id on public.carousel_slides(brand_id);
create index if not exists idx_carousel_slides_order_id on public.carousel_slides(order_id);
create index if not exists idx_carousel_slides_created_at on public.carousel_slides(created_at desc);
