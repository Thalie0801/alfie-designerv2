create table if not exists billing_woofs (
  user_id uuid not null references auth.users(id),
  month date not null,
  used integer not null default 0,
  primary key (user_id, month)
);

create or replace function debit_woofs(user_id_input uuid, amount int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m date := date_trunc('month', now());
begin
  insert into billing_woofs (user_id, month, used)
  values (user_id_input, m, greatest(amount, 0))
  on conflict (user_id, month) do update
  set used = billing_woofs.used + excluded.used;
end;
$$;

create or replace function calculate_woofs_cost(duration_seconds int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  safe_seconds int := coalesce(duration_seconds, 0);
  woofs_needed int;
begin
  woofs_needed := ceil(safe_seconds::numeric / 12)::int;
  if woofs_needed < 1 then
    woofs_needed := 1;
  end if;
  return woofs_needed;
end;
$$;
