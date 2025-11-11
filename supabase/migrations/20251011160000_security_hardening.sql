-- Create dedicated admin users table
create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

drop policy if exists "admin_users_self_select" on public.admin_users;
drop policy if exists "admin_users_manage" on public.admin_users;

create policy "admin_users_self_select"
  on public.admin_users
  for select
  using (
    email = auth.jwt() ->> 'email'
    or exists (
      select 1 from public.admin_users au
      where au.email = auth.jwt() ->> 'email'
        and au.is_active = true
    )
  );

create policy "admin_users_manage"
  on public.admin_users
  for all
  using (
    exists (
      select 1 from public.admin_users au
      where au.email = auth.jwt() ->> 'email'
        and au.is_active = true
    )
  )
  with check (
    exists (
      select 1 from public.admin_users au
      where au.email = auth.jwt() ->> 'email'
        and au.is_active = true
    )
  );

insert into public.admin_users (email, is_active)
values
  ('nathaliestaelens@gmail.com', true),
  ('staelensnathalie@gmail.com', true)
on conflict (email) do update set is_active = excluded.is_active;

-- Harden task_queue policies if the table exists
do $$
begin
  if to_regclass('public.task_queue') is not null then
    execute 'alter table public.task_queue enable row level security';
    execute 'drop policy if exists "public_access" on public.task_queue';
    execute 'drop policy if exists "user_select_own_tasks" on public.task_queue';
    execute 'drop policy if exists "user_insert_own_tasks" on public.task_queue';
    execute 'drop policy if exists "user_update_own_tasks" on public.task_queue';
    execute 'drop policy if exists "admin_all_access" on public.task_queue';

    execute $$create policy "user_select_own_tasks" on public.task_queue
      for select
      using (auth.uid() = user_id);$$;

    execute $$create policy "user_insert_own_tasks" on public.task_queue
      for insert
      with check (auth.uid() = user_id);$$;

    execute $$create policy "user_update_own_tasks" on public.task_queue
      for update
      using (auth.uid() = user_id)$$;

    execute $$create policy "admin_all_access" on public.task_queue
      for all
      using (
        exists (
          select 1 from public.admin_users au
          where au.email = auth.jwt() ->> 'email'
            and au.is_active = true
        )
      )
      with check (
        exists (
          select 1 from public.admin_users au
          where au.email = auth.jwt() ->> 'email'
            and au.is_active = true
        )
      )$$;
  end if;
end;
$$;

-- Make storage buckets private and tighten policies
update storage.buckets
set public = false
where id in ('media-generations', 'chat-uploads', 'assets', 'user-uploads');

drop policy if exists "Anyone can view public media" on storage.objects;
drop policy if exists "Public files are viewable by everyone" on storage.objects;
drop policy if exists "Public assets are viewable" on storage.objects;

drop policy if exists "user_read_user_uploads" on storage.objects;
drop policy if exists "user_insert_user_uploads" on storage.objects;
drop policy if exists "user_delete_user_uploads" on storage.objects;

create policy "user_read_user_uploads"
  on storage.objects
  for select
  using (
    bucket_id = 'user-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "user_insert_user_uploads"
  on storage.objects
  for insert
  with check (
    bucket_id = 'user-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "user_delete_user_uploads"
  on storage.objects
  for delete
  using (
    bucket_id = 'user-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
