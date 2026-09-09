create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

insert into public.organizations (id, name, slug)
values ('00000000-0000-0000-0000-000000000001', 'Elephant & Castle Bebidas Ltda. · YOLO', 'yolo')
on conflict (id) do nothing;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null default '00000000-0000-0000-0000-000000000001' references public.organizations(id),
  full_name text not null default '',
  role text not null default 'operations' check (role in ('admin','management','sales','operations','driver','finance')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email, ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.current_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select organization_id from public.profiles where id = auth.uid() and active = true
$$;

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  kind text not null default 'stock',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  sku text not null,
  name text not null,
  category text not null check (category in ('pop','packaging','ingredient','promotional','other')),
  flavor text,
  unit text not null default 'un',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, sku)
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  asset_code text not null,
  name text not null,
  asset_type text not null check (asset_type in ('black_box','medium_box','freezer','cart','table','banner','desk','other')),
  location_id uuid references public.locations(id),
  status text not null default 'available' check (status in ('available','reserved','checked_out','returned','inspection','cleaning','broken','factory')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, asset_code)
);

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  nf_number text not null,
  supplier text not null,
  received_at timestamptz not null,
  receiving_location_id uuid not null references public.locations(id),
  status text not null default 'analysis' check (status in ('analysis','inspected','completed','cancelled')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (organization_id, nf_number, supplier)
);

create table public.receipt_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  product_id uuid not null references public.products(id),
  lot_number text,
  declared_quantity numeric(14,3) not null check (declared_quantity > 0),
  counted_quantity numeric(14,3),
  aaa_quantity numeric(14,3) not null default 0,
  b_quantity numeric(14,3) not null default 0,
  c_quantity numeric(14,3) not null default 0,
  blocked_quantity numeric(14,3) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table public.stock_containers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  asset_id uuid not null references public.assets(id),
  product_id uuid references public.products(id),
  receipt_item_id uuid references public.receipt_items(id),
  location_id uuid not null references public.locations(id),
  lot_number text,
  quality_grade text check (quality_grade in ('AAA','B','C')),
  physical_state text check (physical_state in ('liquid','frozen')),
  release_status text not null default 'analysis' check (release_status in ('analysis','available','blocked','consumed')),
  quantity numeric(14,3) not null default 0 check (quantity >= 0),
  capacity numeric(14,3) not null default 100 check (capacity > 0),
  is_picking_box boolean not null default false,
  fifo_date date,
  expires_at date,
  updated_at timestamptz not null default now(),
  unique (asset_id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  order_number bigint generated always as identity,
  request_type text not null,
  requester_id uuid not null references public.profiles(id),
  client_name text not null,
  recipient_name text not null,
  recipient_phone text not null,
  recipient_email text,
  address text,
  fulfillment_method text not null,
  delivery_date date not null,
  delivery_window text not null,
  event_starts_at timestamptz,
  event_ends_at timestamptz,
  pickup_at timestamptz,
  delivery_driver_id uuid references public.profiles(id),
  pickup_driver_id uuid references public.profiles(id),
  vehicle text,
  stage text not null default 'to_separate' check (stage in ('to_separate','separating','ready','delivering','delivered','awaiting_pickup','picking_up','return_check','cleaning_restock','completed','exception','cancelled')),
  payment_terms text,
  billable boolean,
  no_charge_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, order_number)
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),
  asset_id uuid references public.assets(id),
  description text not null,
  requested_quantity numeric(14,3) not null check (requested_quantity > 0),
  separated_quantity numeric(14,3) not null default 0 check (separated_quantity >= 0),
  delivered_quantity numeric(14,3) not null default 0 check (delivered_quantity >= 0),
  expected_return_quantity numeric(14,3) not null default 0 check (expected_return_quantity >= 0),
  returned_quantity numeric(14,3) not null default 0 check (returned_quantity >= 0),
  damaged_quantity numeric(14,3) not null default 0 check (damaged_quantity >= 0),
  missing_quantity numeric(14,3) not null default 0 check (missing_quantity >= 0),
  physical_state text check (physical_state in ('liquid','frozen')),
  notes text,
  created_at timestamptz not null default now(),
  check ((product_id is not null)::int + (asset_id is not null)::int <= 1)
);

create table public.asset_reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  asset_id uuid not null references public.assets(id),
  order_id uuid not null references public.orders(id) on delete cascade,
  reserved_from timestamptz not null,
  reserved_until timestamptz not null,
  status text not null default 'reserved' check (status in ('reserved','checked_out','returned','cancelled')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (reserved_until > reserved_from),
  exclude using gist (asset_id with =, tstzrange(reserved_from, reserved_until, '[)') with &&) where (status <> 'cancelled')
);

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null,
  from_stage text,
  to_stage text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  movement_type text not null,
  product_id uuid references public.products(id),
  container_id uuid references public.stock_containers(id),
  order_id uuid references public.orders(id),
  receipt_id uuid references public.receipts(id),
  from_location_id uuid references public.locations(id),
  to_location_id uuid references public.locations(id),
  quantity numeric(14,3) not null,
  physical_state text check (physical_state in ('liquid','frozen')),
  quality_grade text check (quality_grade in ('AAA','B','C')),
  reason text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (quantity <> 0)
);

create table public.order_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  order_id uuid not null references public.orders(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  content_type text,
  size_bytes bigint,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (organization_id, storage_path)
);

create index locations_org_idx on public.locations (organization_id, active);
create index products_org_idx on public.products (organization_id, active);
create index assets_org_status_idx on public.assets (organization_id, status);
create index receipts_org_date_idx on public.receipts (organization_id, received_at desc);
create index containers_org_location_idx on public.stock_containers (organization_id, location_id);
create index orders_org_stage_date_idx on public.orders (organization_id, stage, delivery_date);
create index order_items_order_idx on public.order_items (order_id);
create index order_events_order_idx on public.order_events (order_id, created_at);
create index stock_movements_org_date_idx on public.stock_movements (organization_id, created_at desc);

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.locations enable row level security;
alter table public.products enable row level security;
alter table public.assets enable row level security;
alter table public.receipts enable row level security;
alter table public.receipt_items enable row level security;
alter table public.stock_containers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.asset_reservations enable row level security;
alter table public.order_events enable row level security;
alter table public.stock_movements enable row level security;
alter table public.order_attachments enable row level security;

create policy "organization members can read organization" on public.organizations for select to authenticated using (id = public.current_org_id());
create policy "organization members can read profiles" on public.profiles for select to authenticated using (organization_id = public.current_org_id());
create policy "users can update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and organization_id = public.current_org_id());

do $$
declare table_name text;
begin
  foreach table_name in array array['locations','products','assets','receipts','receipt_items','stock_containers','orders','order_items','asset_reservations','order_events','order_attachments'] loop
    execute format('create policy "org read" on public.%I for select to authenticated using (organization_id = public.current_org_id())', table_name);
    execute format('create policy "org insert" on public.%I for insert to authenticated with check (organization_id = public.current_org_id())', table_name);
    execute format('create policy "org update" on public.%I for update to authenticated using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id())', table_name);
  end loop;
end $$;

create policy "org movement read" on public.stock_movements for select to authenticated using (organization_id = public.current_org_id());
create policy "org movement insert" on public.stock_movements for insert to authenticated with check (organization_id = public.current_org_id());

insert into public.locations (id, organization_id, name, kind) values
  ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Recebimento 1','receiving'),
  ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','Sala de embalagem','packing'),
  ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','Estoque','stock'),
  ('10000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','Freezer 1','freezer'),
  ('10000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000001','Freezer da cozinha','freezer')
on conflict (organization_id, name) do nothing;

insert into public.products (organization_id, sku, name, category, flavor, unit) values
  ('00000000-0000-0000-0000-000000000001','YOL-001','YOLO Pop · Morango','pop','Morango','un'),
  ('00000000-0000-0000-0000-000000000001','YOL-002','YOLO Pop · Maracujá','pop','Maracujá','un'),
  ('00000000-0000-0000-0000-000000000001','YOL-003','YOLO Pop · Limão','pop','Limão','un'),
  ('00000000-0000-0000-0000-000000000001','YOL-004','YOLO Pop · Abacaxi','pop','Abacaxi','un'),
  ('00000000-0000-0000-0000-000000000001','MAT-001','Caixa de envio','packaging',null,'un'),
  ('00000000-0000-0000-0000-000000000001','MAT-002','Insert / encarte','packaging',null,'un')
on conflict (organization_id, sku) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('order-attachments','order-attachments',false,20971520,array['image/jpeg','image/png','image/webp','video/mp4','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public = false;

create policy "org attachment read" on storage.objects for select to authenticated
using (bucket_id = 'order-attachments' and (storage.foldername(name))[1] = public.current_org_id()::text);
create policy "org attachment insert" on storage.objects for insert to authenticated
with check (bucket_id = 'order-attachments' and (storage.foldername(name))[1] = public.current_org_id()::text);
create policy "uploader can delete attachment" on storage.objects for delete to authenticated
using (bucket_id = 'order-attachments' and owner_id = auth.uid()::text);

comment on table public.stock_movements is 'Append-only inventory ledger. Updates and deletes are intentionally omitted from RLS policies.';
comment on table public.order_events is 'Append-only operational audit trail for order stages, delivery, pickup, and returns.';
