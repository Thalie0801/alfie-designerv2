-- Add archival support columns and policy to job_queue
alter table public.job_queue
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists job_version int not null default 2;

-- Allow authenticated users to archive their own jobs
drop policy if exists jq_update_archive_own on public.job_queue;
create policy jq_update_archive_own
on public.job_queue for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (is_archived is not distinct from is_archived)
  );

-- Active jobs view used by the Studio
create or replace view public.v_job_queue_active as
select *
from public.job_queue
where is_archived = false;
