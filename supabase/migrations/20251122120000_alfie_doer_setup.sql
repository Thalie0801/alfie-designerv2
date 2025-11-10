-- Alfie Doer unified orchestration tables & helpers

-- Ensure orders can store intent payloads and richer statuses
alter table public.orders
  add column if not exists intent_json jsonb default '{}'::jsonb,
  add column if not exists summary text;

-- Normalize status enum (no check constraint here, rely on worker logic)
-- Legacy instances might have a constraint, drop it to allow new statuses
alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (
    status in (
      'pending','queued','processing','rendering','done','completed','failed','error'
    )
  );

-- Library assets richer observability
alter table public.library_assets
  add column if not exists preview_url text,
  add column if not exists download_url text,
  add column if not exists error_message text,
  add column if not exists brand_id uuid references public.brands(id) on delete set null;

create index if not exists idx_library_assets_brand
  on public.library_assets(brand_id, created_at desc);

-- Plan limits per brand (simple counters)
create table if not exists public.plan_limits (
  brand_id uuid primary key references public.brands(id) on delete cascade,
  period text not null default to_char(date_trunc('month', now()), 'YYYY-MM'),
  max_visuals int not null default 100,
  used int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.plan_limits enable row level security;

drop policy if exists plan_limits_select_own on public.plan_limits;
drop policy if exists plan_limits_manage_service on public.plan_limits;

create policy plan_limits_select_own
  on public.plan_limits for select
  using (exists (select 1 from public.brands b where b.id = plan_limits.brand_id and b.user_id = auth.uid()));

create policy plan_limits_manage_service
  on public.plan_limits for all
  using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- Job events table logging transitions on job_queue
create table if not exists public.job_events (
  id bigserial primary key,
  job_id uuid not null references public.job_queue(id) on delete cascade,
  kind text not null,
  message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_job_events_job on public.job_events(job_id, created_at desc);

alter table public.job_events enable row level security;

drop policy if exists job_events_select_own on public.job_events;
drop policy if exists job_events_service_all on public.job_events;

create policy job_events_select_own
  on public.job_events for select
  using (
    exists (
      select 1
      from public.job_queue jq
      where jq.id = job_events.job_id
        and jq.user_id = auth.uid()
    )
  );

create policy job_events_service_all
  on public.job_events for all
  using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- Trigger logging
create or replace function public.log_job_queue_event()
returns trigger as $$
begin
  if tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      insert into public.job_events(job_id, kind, message)
      values (new.id, new.status, new.error_message);
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    insert into public.job_events(job_id, kind, message)
    values (new.id, coalesce(new.status, 'pending'), new.error_message);
    return new;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists tr_job_queue_log on public.job_queue;
create trigger tr_job_queue_log
  after insert or update on public.job_queue
  for each row execute function public.log_job_queue_event();
