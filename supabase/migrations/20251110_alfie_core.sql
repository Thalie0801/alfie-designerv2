-- supabase/migrations/20251110_alfie_core.sql
-- Migration complète pour Alfie Designer selon le blueprint

-- Enable extensions
create extension if not exists "pgcrypto";

-- ============================================================================
-- TABLE: alfie_memory
-- Stockage de la mémoire contextuelle (tone, règles, defaults)
-- ============================================================================
create table if not exists public.alfie_memory (
  id uuid primary key default gen_random_uuid(),
  scope text check (scope in ('global','user','brand')) not null,
  user_id uuid references auth.users(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  constraint unique_memory_key unique (scope, user_id, brand_id, key)
);

comment on table public.alfie_memory is 'Mémoire persistante Alfie (tone, defaults, rules)';
comment on column public.alfie_memory.scope is 'Scope hiérarchique: global > user > brand';
comment on column public.alfie_memory.key is 'Clé typée: tone.profile, cta.defaults, copy.rules, etc.';

-- ============================================================================
-- TABLE: alfie_prompts
-- Prompts versionnés et actifs (system, planner, copy, vision, post)
-- ============================================================================
create table if not exists public.alfie_prompts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version text not null default 'v1',
  role text check (role in ('system','planner','copy','vision','post')) not null,
  body text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint unique_prompt unique (name, version, role)
);

comment on table public.alfie_prompts is 'Prompts versionnés pour orchestration LLM';
comment on column public.alfie_prompts.role is 'Rôle du prompt dans le pipeline';

-- ============================================================================
-- TABLE: orders
-- Commandes de génération avec intent figé
-- ============================================================================
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  intent_json jsonb not null,
  status text check (status in ('draft','queued','running','done','error')) not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.orders is 'Commandes de génération avec contrat d''intent figé';
comment on column public.orders.intent_json is 'AlfieIntent complet (kind, brand, ratio, slides, cta, etc.)';

-- Index pour performance
create index if not exists idx_orders_user_id on public.orders(user_id);
create index if not exists idx_orders_brand_id on public.orders(brand_id);
create index if not exists idx_orders_status on public.orders(status);

-- ============================================================================
-- TABLE: jobs
-- Jobs individuels dans le pipeline (copy, vision, render, upload, thumb)
-- ============================================================================
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  kind text check (kind in ('copy','vision','render','upload','thumb','publish')) not null,
  payload jsonb not null,
  status text check (status in ('queued','running','done','error','retry')) not null default 'queued',
  attempt int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.jobs is 'Jobs atomiques du pipeline de génération';
comment on column public.jobs.kind is 'Type de job: copy, vision, render, upload, thumb, publish';

-- Index pour queue worker
create index if not exists idx_jobs_status on public.jobs(status) where status in ('queued', 'retry');
create index if not exists idx_jobs_order_id on public.jobs(order_id);

-- ============================================================================
-- TABLE: job_events
-- Events et logs temps réel par job
-- ============================================================================
create table if not exists public.job_events (
  id bigserial primary key,
  job_id uuid not null references public.jobs(id) on delete cascade,
  level text check (level in ('debug','info','warn','error')) not null,
  message text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);

comment on table public.job_events is 'Events et logs temps réel pour Job Console';

-- Index pour realtime queries
create index if not exists idx_job_events_job_id on public.job_events(job_id);
create index if not exists idx_job_events_created_at on public.job_events(created_at desc);

-- ============================================================================
-- TABLE: library_assets
-- Assets générés (images, carrousels, vidéos, textes)
-- ============================================================================
create table if not exists public.library_assets (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  type text check (type in ('image','carousel','video','text')) not null,
  url text not null,
  public_id text,
  meta jsonb,
  created_at timestamptz not null default now()
);

comment on table public.library_assets is 'Assets générés liés aux orders/jobs';
comment on column public.library_assets.public_id is 'Cloudinary public_id';
comment on column public.library_assets.meta is 'Tags, context, intent_hash, etc.';

-- Index
create index if not exists idx_library_assets_brand_id on public.library_assets(brand_id);
create index if not exists idx_library_assets_order_id on public.library_assets(order_id);

-- ============================================================================
-- TABLE: plan_limits
-- Définition des plans (starter, pro, enterprise)
-- ============================================================================
create table if not exists public.plan_limits (
  plan text primary key,
  max_visuals int not null,
  monthly_reset_day int not null default 1
);

comment on table public.plan_limits is 'Limites par plan (visuals/mois)';

-- Seed plans
insert into public.plan_limits (plan, max_visuals, monthly_reset_day) values
  ('starter', 10, 1),
  ('pro', 100, 1),
  ('enterprise', 1000, 1)
on conflict (plan) do nothing;

-- ============================================================================
-- TABLE: quotas
-- Quotas utilisateur par période
-- ============================================================================
create table if not exists public.quotas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null references public.plan_limits(plan),
  period_start date not null,
  visuals_used int not null default 0,
  messages_used int not null default 0,
  updated_at timestamptz not null default now(),
  constraint unique_user_period unique (user_id, period_start)
);

comment on table public.quotas is 'Quotas utilisateur par mois';

-- Index
create index if not exists idx_quotas_user_id on public.quotas(user_id);

-- ============================================================================
-- RLS (Row Level Security)
-- ============================================================================

-- Enable RLS on all tables
alter table public.alfie_memory enable row level security;
alter table public.orders enable row level security;
alter table public.jobs enable row level security;
alter table public.job_events enable row level security;
alter table public.library_assets enable row level security;
alter table public.quotas enable row level security;

-- alfie_memory policies
create policy "Memory: users can read their own and brand memories"
  on public.alfie_memory for select
  using (
    case scope
      when 'global' then true
      when 'user' then auth.uid() = user_id
      when 'brand' then auth.uid() = user_id
    end
  );

create policy "Memory: users can write their own and brand memories"
  on public.alfie_memory for insert
  with check (
    case scope
      when 'user' then auth.uid() = user_id
      when 'brand' then auth.uid() = user_id
      else false
    end
  );

create policy "Memory: users can update their own and brand memories"
  on public.alfie_memory for update
  using (
    case scope
      when 'user' then auth.uid() = user_id
      when 'brand' then auth.uid() = user_id
      else false
    end
  );

-- orders policies
create policy "Orders: users can read their own orders"
  on public.orders for select
  using (auth.uid() = user_id);

create policy "Orders: users can create their own orders"
  on public.orders for insert
  with check (auth.uid() = user_id);

create policy "Orders: users can update their own orders"
  on public.orders for update
  using (auth.uid() = user_id);

-- jobs policies
create policy "Jobs: users can read jobs from their orders"
  on public.jobs for select
  using (
    exists(
      select 1 from public.orders o
      where o.id = order_id and o.user_id = auth.uid()
    )
  );

-- job_events policies
create policy "Job events: users can read events from their jobs"
  on public.job_events for select
  using (
    exists(
      select 1 from public.jobs j
      join public.orders o on o.id = j.order_id
      where j.id = job_id and o.user_id = auth.uid()
    )
  );

-- library_assets policies
create policy "Assets: users can read assets from their brands"
  on public.library_assets for select
  using (
    exists(
      select 1 from public.brands b
      where b.id = brand_id and b.owner_id = auth.uid()
    )
  );

-- quotas policies
create policy "Quotas: users can read their own quotas"
  on public.quotas for select
  using (auth.uid() = user_id);

create policy "Quotas: users can update their own quotas"
  on public.quotas for update
  using (auth.uid() = user_id);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers for updated_at
create trigger set_updated_at before update on public.orders
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.jobs
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.alfie_memory
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.quotas
  for each row execute function public.handle_updated_at();

-- ============================================================================
-- REALTIME
-- ============================================================================

-- Enable realtime for job_events (Job Console)
alter publication supabase_realtime add table public.job_events;
alter publication supabase_realtime add table public.jobs;

-- ============================================================================
-- Fin de la migration
-- ============================================================================
-- ============================================================================
-- PATCH RLS & PERF — Alfie Core
-- ============================================================================

-- 1) Prompts: activer RLS + policies lecture (auth) / écriture (service role)
alter table public.alfie_prompts enable row level security;

drop policy if exists "Prompts: read active" on public.alfie_prompts;
create policy "Prompts: read active"
  on public.alfie_prompts for select
  to authenticated
  using (active = true);

drop policy if exists "Prompts: write (service only)" on public.alfie_prompts;
create policy "Prompts: write (service only)"
  on public.alfie_prompts for all
  to service_role
  using (true)
  with check (true);

-- 2) Alfie Memory: éviter lecture publique sur scope=global
drop policy if exists "Memory: users can read their own and brand memories" on public.alfie_memory;
create policy "Memory: read scoped (auth only)"
  on public.alfie_memory for select
  to authenticated
  using (
    case scope
      when 'global' then true                    -- lisible par tout user authentifié
      when 'user'   then auth.uid() = user_id
      when 'brand'  then auth.uid() = user_id
    end
  );

drop policy if exists "Memory: users can write their own and brand memories" on public.alfie_memory;
create policy "Memory: write self/brand"
  on public.alfie_memory for insert
  to authenticated
  with check (
    case scope
      when 'user'  then auth.uid() = user_id
      when 'brand' then auth.uid() = user_id
      else false
    end
  );

drop policy if exists "Memory: users can update their own and brand memories" on public.alfie_memory;
create policy "Memory: update self/brand"
  on public.alfie_memory for update
  to authenticated
  using (
    case scope
      when 'user'  then auth.uid() = user_id
      when 'brand' then auth.uid() = user_id
      else false
    end
  )
  with check (
    case scope
      when 'user'  then auth.uid() = user_id
      when 'brand' then auth.uid() = user_id
      else false
    end
  );

-- 3) Orders: ajouter WITH CHECK pour empêcher changement de user_id vers autre user
drop policy if exists "Orders: users can update their own orders" on public.orders;
create policy "Orders: users can update their own orders"
  on public.orders for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4) Jobs / Job events / Assets / Quotas
--    - lecture: OK (déjà en place)
--    - écriture: réserver au service role (edge functions / cron)
--    - NB: le service_role bypass RLS, mais on documente par clarté

-- Jobs: autoriser INSERT/UPDATE seulement service_role (optionnel car bypass)
create policy if not exists "Jobs: write (service only)"
  on public.jobs for all
  to service_role
  using (true)
  with check (true);

-- Job events: idem (write service only)
create policy if not exists "Job events: write (service only)"
  on public.job_events for all
  to service_role
  using (true)
  with check (true);

-- Library assets: écriture service only
create policy if not exists "Assets: write (service only)"
  on public.library_assets for all
  to service_role
  using (true)
  with check (true);

-- Quotas: éviter que l'utilisateur modifie ses compteurs côté client
drop policy if exists "Quotas: users can update their own quotas" on public.quotas;
create policy "Quotas: write (service only)"
  on public.quotas for all
  to service_role
  using (true)
  with check (true);

-- 5) Contraintes & index complémentaires
-- Plans: bornes sur monthly_reset_day
alter table public.plan_limits
  add constraint plan_limits_mrd_chk check (monthly_reset_day between 1 and 28);

-- Quotas: compteurs non négatifs
alter table public.quotas
  add constraint quotas_non_negative_chk check (visuals_used >= 0 and messages_used >= 0);

-- Jobs: index file d'attente (status, created_at)
create index if not exists idx_jobs_queue on public.jobs (status, created_at)
  where status in ('queued','retry');

-- Assets: index tri récent par brand + GIN sur meta (pour filtres)
create index if not exists idx_library_assets_brand_created_at
  on public.library_assets (brand_id, created_at desc);

create index if not exists idx_library_assets_meta_gin
  on public.library_assets using gin (meta);

-- 6) Triggers updated_at manquants
create trigger set_updated_at before update on public.library_assets
  for each row execute function public.handle_updated_at();

-- 7) Realtime: OK pour jobs/job_events; tu peux ajouter assets si tu veux un flux “nouveaux assets”
-- alter publication supabase_realtime add table public.library_assets;
