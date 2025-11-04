-- Trigger pour cascade automatique des jobs de rendu
create or replace function public.enqueue_render_jobs()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
begin
  if TG_OP = 'UPDATE'
     and NEW.type = 'generate_texts'
     and NEW.status = 'completed'
     and (OLD.status is distinct from NEW.status) then

    insert into job_queue (user_id, order_id, type, status, payload)
    select NEW.user_id,
           oi.order_id,
           case when oi.type = 'carousel' then 'render_carousels' else 'render_images' end,
           'queued',
           jsonb_build_object(
             'userId', NEW.user_id,
             'orderId', oi.order_id,
             'orderItemId', oi.id,
             'brief', oi.brief_json,
             'brandId', (NEW.payload->>'brandId')::uuid,
             'imageIndex', oi.sequence_number,
             'carouselIndex', oi.sequence_number
           )
    from order_items oi
    where oi.order_id = NEW.order_id
      and oi.status in ('queued','ready','pending');

    update order_items
       set status = 'ready'
     where order_id = NEW.order_id
       and status in ('queued','pending');
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_enqueue_render_jobs on job_queue;
create trigger trg_enqueue_render_jobs
after update on job_queue
for each row execute function public.enqueue_render_jobs();