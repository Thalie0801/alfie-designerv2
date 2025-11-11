set search_path = public;

-- 1) Colonne admin si absente
alter table public.profiles
  add column if not exists is_admin boolean default false;

-- 2) Créer les lignes manquantes dans profiles (tous les users)
insert into public.profiles (id)
select u.id
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- 3) Promouvoir CET utilisateur admin (⚠️ email ci-dessous)
update public.profiles
set is_admin = true
where id = (select id from auth.users where email = 'nathaliestaelens@gmail.com');

-- 4) (sécurité de lecture pour le frontend)
drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select
  on public.profiles for select to authenticated
  using (id = auth.uid());

-- ✅ Vérifs rapides
select u.email, p.is_admin
from auth.users u
join public.profiles p on p.id = u.id
order by u.created_at desc;
