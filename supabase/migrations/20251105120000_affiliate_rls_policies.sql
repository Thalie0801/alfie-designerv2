-- Affiliate RLS policies and helper function
create or replace function public.is_admin(p_uid uuid)
returns boolean
language sql
stable
as $$
  select exists (select 1 from user_roles where user_id = p_uid and role = 'admin')
  or exists (select 1 from profiles where id = p_uid and granted_by_admin = true);
$$;

-- ========== AFFILIATES ==========
alter table affiliates enable row level security;

-- Lire son propre compte affilié
create policy "affiliates_select_self"
on affiliates for select
to authenticated
using ( id = auth.uid() );

-- Lire ses filleuls directs (pour la section "Mes filleuls")
create policy "affiliates_select_children"
on affiliates for select
to authenticated
using ( parent_id = auth.uid() );

-- Insérer sa propre ligne (si tu veux auto-créer à la connexion)
create policy "affiliates_insert_self"
on affiliates for insert
to authenticated
with check ( id = auth.uid() );

-- Admin: lire/mettre à jour/supprimer tout (pour ton /admin)
create policy "affiliates_admin_rw"
on affiliates for all
to authenticated
using ( is_admin(auth.uid()) )
with check ( is_admin(auth.uid()) );

-- ========== CLICKS ==========
alter table affiliate_clicks enable row level security;
create policy "clicks_select_self"
on affiliate_clicks for select
to authenticated
using ( affiliate_id = auth.uid() );

-- ========== CONVERSIONS ==========
alter table affiliate_conversions enable row level security;
create policy "conversions_select_self"
on affiliate_conversions for select
to authenticated
using ( affiliate_id = auth.uid() );

-- ========== COMMISSIONS ==========
alter table affiliate_commissions enable row level security;
create policy "commissions_select_self"
on affiliate_commissions for select
to authenticated
using ( affiliate_id = auth.uid() );

-- ========== PAYOUTS ==========
alter table affiliate_payouts enable row level security;
create policy "payouts_select_self"
on affiliate_payouts for select
to authenticated
using ( affiliate_id = auth.uid() );
