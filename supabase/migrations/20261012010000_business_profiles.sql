create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  business_name text not null,
  owner_name text not null,
  category text not null,
  description text not null default '',
  city text not null,
  state text not null,
  address text,
  contact_email text,
  contact_phone text,
  logo_url text,
  photo_urls text[] not null default '{}',
  website_url text,
  social_links jsonb not null default '{}'::jsonb,
  opening_hours text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint businesses_name_not_empty check (length(trim(business_name)) > 0),
  constraint businesses_owner_name_not_empty check (length(trim(owner_name)) > 0),
  constraint businesses_category_not_empty check (length(trim(category)) > 0),
  constraint businesses_city_not_empty check (length(trim(city)) > 0),
  constraint businesses_state_not_empty check (length(trim(state)) > 0),
  constraint businesses_social_links_object check (jsonb_typeof(social_links) = 'object')
);

alter table public.businesses
  add column if not exists owner_id uuid references auth.users(id) on delete cascade,
  add column if not exists business_name text not null default '',
  add column if not exists owner_name text not null default '',
  add column if not exists category text not null default '',
  add column if not exists description text not null default '',
  add column if not exists city text not null default '',
  add column if not exists state text not null default '',
  add column if not exists address text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists logo_url text,
  add column if not exists photo_urls text[] not null default '{}',
  add column if not exists website_url text,
  add column if not exists social_links jsonb not null default '{}'::jsonb,
  add column if not exists opening_hours text,
  add column if not exists is_public boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists businesses_owner_id_unique
  on public.businesses (owner_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'businesses_owner_id_fkey'
      and conrelid = 'public.businesses'::regclass
  ) then
    alter table public.businesses
      add constraint businesses_owner_id_fkey
      foreign key (owner_id) references auth.users(id) on delete cascade
      not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'businesses_owner_id_required'
      and conrelid = 'public.businesses'::regclass
  ) then
    alter table public.businesses
      add constraint businesses_owner_id_required check (owner_id is not null)
      not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'businesses_name_not_empty'
      and conrelid = 'public.businesses'::regclass
  ) then
    alter table public.businesses
      add constraint businesses_name_not_empty
      check (length(trim(business_name)) > 0) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'businesses_owner_name_not_empty'
      and conrelid = 'public.businesses'::regclass
  ) then
    alter table public.businesses
      add constraint businesses_owner_name_not_empty
      check (length(trim(owner_name)) > 0) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'businesses_category_not_empty'
      and conrelid = 'public.businesses'::regclass
  ) then
    alter table public.businesses
      add constraint businesses_category_not_empty
      check (length(trim(category)) > 0) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'businesses_city_not_empty'
      and conrelid = 'public.businesses'::regclass
  ) then
    alter table public.businesses
      add constraint businesses_city_not_empty
      check (length(trim(city)) > 0) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'businesses_state_not_empty'
      and conrelid = 'public.businesses'::regclass
  ) then
    alter table public.businesses
      add constraint businesses_state_not_empty
      check (length(trim(state)) > 0) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'businesses_social_links_object'
      and conrelid = 'public.businesses'::regclass
  ) then
    alter table public.businesses
      add constraint businesses_social_links_object
      check (jsonb_typeof(social_links) = 'object') not valid;
  end if;
end;
$$;

create or replace function public.set_business_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists businesses_set_updated_at on public.businesses;
create trigger businesses_set_updated_at
before update on public.businesses
for each row execute function public.set_business_updated_at();

alter table public.businesses enable row level security;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'businesses'
  loop
    execute format('drop policy %I on public.businesses', existing_policy.policyname);
  end loop;
end;
$$;

drop policy if exists "Owners can read their own business" on public.businesses;
create policy "Owners can read their own business"
  on public.businesses for select to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "Owners can create their own business" on public.businesses;
create policy "Owners can create their own business"
  on public.businesses for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'business_owner'
    )
  );

drop policy if exists "Owners can update their own business" on public.businesses;
create policy "Owners can update their own business"
  on public.businesses for update to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'business_owner'
    )
  )
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'business_owner'
    )
  );

drop policy if exists "Owners can delete their own business" on public.businesses;
create policy "Owners can delete their own business"
  on public.businesses for delete to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'business_owner'
    )
  );

revoke all on public.businesses from public, anon, authenticated;
grant select, insert, update, delete on public.businesses to authenticated;

create or replace view public.public_business_profiles
with (security_barrier = true)
as
select
  id,
  business_name,
  category,
  description,
  city,
  state,
  logo_url,
  photo_urls,
  website_url,
  social_links,
  opening_hours
from public.businesses
where is_public = true;

revoke all on public.public_business_profiles from public, anon, authenticated;
grant select on public.public_business_profiles to anon, authenticated;

revoke all on function public.set_business_updated_at() from public, anon, authenticated;
