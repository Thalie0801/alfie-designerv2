-- Orders, job queue, and library assets base schema with minimal RLS
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  brand_id uuid,
  status text not null default 'pending',
  source text,
  meta jsonb,
  created_at timestamptz default now()
);

create table if not exists job_queue (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  user_id uuid not null,
  type text not null,
  status text not null default 'pending',
  attempts int not null default 0,
  payload jsonb,
  error_message text,
  created_at timestamptz default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create table if not exists library_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  order_id uuid references orders(id) on delete set null,
  kind text not null,
  status text not null default 'ready',
  url text,
  meta jsonb,
  created_at timestamptz default now()
);

alter table orders enable row level security;
alter table job_queue enable row level security;
alter table library_assets enable row level security;

drop policy if exists "orders insert own" on orders;
drop policy if exists "orders select own" on orders;
drop policy if exists "job insert own" on job_queue;
drop policy if exists "job select own" on job_queue;
drop policy if exists "assets select own" on library_assets;

create policy "orders insert own" on orders
  for insert with check (auth.uid() = user_id);
create policy "orders select own" on orders
  for select using (auth.uid() = user_id);

create policy "job insert own" on job_queue
  for insert with check (auth.uid() = user_id);
create policy "job select own" on job_queue
  for select using (auth.uid() = user_id);

create policy "assets select own" on library_assets
  for select using (auth.uid() = user_id);

create or replace function close_order_if_all_jobs_done(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from job_queue
    where order_id = p_order_id
      and status in ('pending', 'processing', 'error')
  ) then
    update orders
    set status = 'done'
    where id = p_order_id;
  end if;
end;
$$;
