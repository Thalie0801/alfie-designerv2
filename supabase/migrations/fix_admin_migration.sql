-- ============================================================================
-- fix_admin_migration.sql
-- Crée/MAJ la table profiles, auto-crée les profils, backfill,
-- helpers admin et vue admin_users.
-- ============================================================================

set search_path = public;

-- 1) Table profiles minimale (attachée à auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user','admin','super_admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Trigger updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists tr_profiles_updated_at on public.profiles;
create trigger tr_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- 3) RLS basique (lecture par l'utilisateur courant)
alter table public.profiles enable row level security;

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

-- (Optionnel) accès complet au service_role (Edge Functions/workers)
drop policy if exists profiles_service_all on public.profiles;
create policy profiles_service_all
  on public.profiles
  for all
  to service_role
  using (true) with check (true);

-- 4) Trigger: créer automatiquement le profil à chaque nouvel utilisateur
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'user')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 5) Backfill: créer les profils manquants pour tous les users existants
insert into public.profiles (id, role)
select u.id, 'user'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- 6) Helpers
-- 6.1 is_admin(uuid) → boolean
create or replace function public.is_admin(uid uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.profiles
    where id = uid and role in ('admin','super_admin')
  );
$$;

-- 6.2 promote_to_admin by UUID (role = 'admin' par défaut)
create or replace function public.promote_to_admin(p_user_id uuid, p_role text default 'admin')
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_role not in ('admin','super_admin') then
    raise exception 'Invalid role: % (expected admin or super_admin)', p_role;
  end if;
  update public.profiles
  set role = p_role, updated_at = now()
  where id = p_user_id;
end $$;

-- 6.3 promote_to_admin_by_email (convenience)
create or replace function public.promote_to_admin_by_email(p_email text, p_role text default 'admin')
returns void language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  select id into v_id from auth.users where email = p_email;
  if v_id is null then
    raise exception 'No auth.users found for email %', p_email;
  end if;
  perform public.promote_to_admin(v_id, p_role);
end $$;

-- 7) Vue de debug/admin
create or replace view public.admin_users as
select
  u.id,
  u.email,
  p.role,
  p.created_at,
  p.updated_at
from auth.users u
join public.profiles p on p.id = u.id
where p.role in ('admin','super_admin');

grant select on public.admin_users to authenticated;

-- 8) Vérifs rapides
-- select * from public.admin_users;
-- select id, role from public.profiles where id = auth.uid();

