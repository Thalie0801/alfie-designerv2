-- Function: increment_brand_usage(brand_uuid uuid, add_videos int, add_woofs int)
create or replace function public.increment_brand_usage(p_brand_id uuid, p_videos int, p_woofs int)
returns boolean
language plpgsql
security definer
as $$
begin
  update brands
  set videos_used = coalesce(videos_used,0) + p_videos,
      woofs_used  = coalesce(woofs_used,0)  + p_woofs
  where id = p_brand_id
    and (coalesce(videos_used,0) + p_videos) <= quota_videos
    and (coalesce(woofs_used,0)  + p_woofs)  <= quota_woofs;

  if found then
    return true;
  else
    return false;
  end if;
end;
$$;

grant execute on function public.increment_brand_usage(uuid,int,int) to authenticated, service_role;

create or replace function public.increment_profile_visuals(p_profile_id uuid, p_delta int)
returns void
language plpgsql
security definer
as $$
declare
  current_month text := to_char(now() at time zone 'UTC', 'YYYY-MM');
begin
  update profiles
  set visuals_month = case when coalesce(visuals_month_key,'') = current_month
                           then coalesce(visuals_month,0) + p_delta
                      else p_delta
                 end,
      visuals_month_key = current_month
  where id = p_profile_id;
end;
$$;

grant execute on function public.increment_profile_visuals(uuid,int) to authenticated, service_role;
