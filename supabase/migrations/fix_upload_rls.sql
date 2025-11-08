-- Fix upload errors: RLS policies for chat-uploads bucket and media_generations table
-- Date: 2025-11-08

-- ============================================
-- A. Storage policies for chat-uploads bucket
-- ============================================

-- Enable RLS on storage.objects if not already enabled
alter table storage.objects enable row level security;

-- Allow authenticated users to insert their files into 'chat-uploads'
drop policy if exists "chat uploads insert" on storage.objects;
create policy "chat uploads insert"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'chat-uploads' );

-- Allow authenticated users to read files from 'chat-uploads'
drop policy if exists "chat uploads read" on storage.objects;
create policy "chat uploads read"
on storage.objects for select
to authenticated
using ( bucket_id = 'chat-uploads' and (owner = auth.uid() or true) );

-- ============================================
-- B. Media generations table policies
-- ============================================

-- Enable RLS on media_generations if not already enabled
alter table public.media_generations enable row level security;

-- Allow users to insert their own media generations
drop policy if exists "media: user can insert own" on public.media_generations;
create policy "media: user can insert own"
on public.media_generations for insert
to authenticated
with check ( user_id = auth.uid() );

-- Allow users to view their own media generations
drop policy if exists "media: user can view own" on public.media_generations;
create policy "media: user can view own"
on public.media_generations for select
to authenticated
using ( user_id = auth.uid() );

-- Allow users to update their own media generations
drop policy if exists "media: user can update own" on public.media_generations;
create policy "media: user can update own"
on public.media_generations for update
to authenticated
using ( user_id = auth.uid() )
with check ( user_id = auth.uid() );
