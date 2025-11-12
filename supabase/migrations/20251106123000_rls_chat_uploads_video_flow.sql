-- RLS Storage – bucket chat-uploads et tables assets

-- 1) Bucket (idempotent)
insert into storage.buckets (id, name, public)
select 'chat-uploads', 'chat-uploads', false
where not exists (select 1 from storage.buckets where id = 'chat-uploads');

-- 2) Policies Storage (idempotentes)
-- Supprime si existent déjà puis recrée proprement
drop policy if exists "chat_upload_insert" on storage.objects;
drop policy if exists "chat_upload_select" on storage.objects;
drop policy if exists "chat_upload_delete" on storage.objects;

create policy "chat_upload_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'chat-uploads'
  and owner = auth.uid()
);

create policy "chat_upload_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'chat-uploads'
  and owner = auth.uid()
);

create policy "chat_upload_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'chat-uploads'
  and owner = auth.uid()
);

-- 3) RLS pour tables utilisées par les fonctions
alter table public.library_assets enable row level security;
alter table public.media_generations enable row level security;
alter table public.job_queue enable row level security;

-- Policies “own rows” pour client
drop policy if exists la_insert_own on public.library_assets;
drop policy if exists la_select_own on public.library_assets;
create policy la_insert_own on public.library_assets
for insert to authenticated with check (user_id = auth.uid());
create policy la_select_own on public.library_assets
for select to authenticated using (user_id = auth.uid());

drop policy if exists mg_insert_own on public.media_generations;
drop policy if exists mg_select_own on public.media_generations;
create policy mg_insert_own on public.media_generations
for insert to authenticated with check (user_id = auth.uid());
create policy mg_select_own on public.media_generations
for select to authenticated using (user_id = auth.uid());

-- Policies service_role (Edge Functions) – accès total
drop policy if exists la_service_all on public.library_assets;
drop policy if exists mg_service_all on public.media_generations;
drop policy if exists jq_service_all on public.job_queue;
create policy la_service_all on public.library_assets for all to service_role using (true) with check (true);
create policy mg_service_all on public.media_generations for all to service_role using (true) with check (true);
create policy jq_service_all on public.job_queue for all to service_role using (true) with check (true);
