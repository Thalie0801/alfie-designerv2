create policy if not exists "service can manage all jobs"
on job_queue
for all
to service_role
using (true)
with check (true);
