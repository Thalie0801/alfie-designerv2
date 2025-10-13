create table if not exists affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  ref_code text not null,
  clicked_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  cookie_id uuid default gen_random_uuid()
);

create index if not exists affiliate_clicks_ref_code_idx on affiliate_clicks (ref_code);
create index if not exists affiliate_clicks_clicked_at_idx on affiliate_clicks (clicked_at);

create table if not exists affiliate_attributions (
  id uuid primary key default gen_random_uuid(),
  ref_code text not null,
  user_id uuid references auth.users (id) on delete set null,
  customer_id text,
  stripe_subscription_id text,
  attributed_at timestamptz not null default now(),
  click_id uuid references affiliate_clicks (id) on delete set null
);

create unique index if not exists affiliate_attributions_user_id_key on affiliate_attributions (user_id);
create index if not exists affiliate_attributions_ref_code_idx on affiliate_attributions (ref_code);

create table if not exists affiliate_payouts (
  id uuid primary key default gen_random_uuid(),
  ref_code text not null,
  amount_cents integer not null default 0,
  currency text not null default 'eur',
  status text not null default 'pending',
  period_start date,
  period_end date,
  calculated_at timestamptz not null default now(),
  paid_at timestamptz,
  stripe_transfer_id text,
  notes text
);

create index if not exists affiliate_payouts_ref_code_idx on affiliate_payouts (ref_code);
create index if not exists affiliate_payouts_status_idx on affiliate_payouts (status);
