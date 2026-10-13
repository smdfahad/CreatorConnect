create table if not exists public.promotion_listings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  description text not null,
  product_service text not null,
  promotion_type text not null check (
    promotion_type in (
      'YouTube Shorts',
      'Dedicated video',
      'Product review',
      'Restaurant visit',
      'Shop tour',
      'Event coverage'
    )
  ),
  budget_min numeric(12, 2),
  budget_max numeric(12, 2),
  pricing_mode text not null check (pricing_mode in ('fixed', 'negotiable', 'flexible')),
  preferred_niche text not null,
  subscriber_count bigint,
  subscriber_requirement text not null default 'preferred'
    check (subscriber_requirement in ('preferred', 'required')),
  city text not null,
  location text not null,
  deliverables text not null,
  preferred_date date not null,
  deadline date,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'paused', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promotion_listings_title_not_empty check (length(trim(title)) > 0),
  constraint promotion_listings_description_not_empty check (length(trim(description)) > 0),
  constraint promotion_listings_product_service_not_empty check (length(trim(product_service)) > 0),
  constraint promotion_listings_preferred_niche_not_empty check (length(trim(preferred_niche)) > 0),
  constraint promotion_listings_city_not_empty check (length(trim(city)) > 0),
  constraint promotion_listings_location_not_empty check (length(trim(location)) > 0),
  constraint promotion_listings_deliverables_not_empty check (length(trim(deliverables)) > 0),
  constraint promotion_listings_budget_present check (budget_min is not null or budget_max is not null),
  constraint promotion_listings_budget_nonnegative check (
    (budget_min is null or budget_min >= 0)
    and (budget_max is null or budget_max >= 0)
  ),
  constraint promotion_listings_budget_range check (
    budget_min is null or budget_max is null or budget_max >= budget_min
  ),
  constraint promotion_listings_subscriber_count_nonnegative check (
    subscriber_count is null or subscriber_count >= 0
  ),
  constraint promotion_listings_deadline_range check (
    deadline is null or deadline <= preferred_date
  )
);

create index if not exists promotion_listings_business_created_idx
  on public.promotion_listings (business_id, created_at desc);
create index if not exists promotion_listings_published_idx
  on public.promotion_listings (status, preferred_date)
  where status = 'published';

create or replace function public.set_promotion_listing_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if old.status = 'closed' and new.status <> 'closed' then
      raise exception 'Closed promotion listings cannot be reopened';
    end if;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists promotion_listings_set_updated_at on public.promotion_listings;
create trigger promotion_listings_set_updated_at
before update on public.promotion_listings
for each row execute function public.set_promotion_listing_updated_at();

alter table public.promotion_listings enable row level security;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'promotion_listings'
  loop
    execute format('drop policy %I on public.promotion_listings', existing_policy.policyname);
  end loop;
end;
$$;

create policy "Anyone can read published promotion listings"
  on public.promotion_listings for select to anon, authenticated
  using (status = 'published');

create policy "Business owners can read their promotion listings"
  on public.promotion_listings for select to authenticated
  using (
    exists (
      select 1
      from public.businesses b
      where b.id = promotion_listings.business_id
        and b.owner_id = (select auth.uid())
    )
  );

create policy "Business owners can create their promotion listings"
  on public.promotion_listings for insert to authenticated
  with check (
    exists (
      select 1
      from public.businesses b
      join public.profiles p on p.id = b.owner_id
      where b.id = promotion_listings.business_id
        and b.owner_id = (select auth.uid())
        and p.role = 'business_owner'
    )
  );

create policy "Business owners can update their promotion listings"
  on public.promotion_listings for update to authenticated
  using (
    exists (
      select 1
      from public.businesses b
      join public.profiles p on p.id = b.owner_id
      where b.id = promotion_listings.business_id
        and b.owner_id = (select auth.uid())
        and p.role = 'business_owner'
    )
  )
  with check (
    exists (
      select 1
      from public.businesses b
      join public.profiles p on p.id = b.owner_id
      where b.id = promotion_listings.business_id
        and b.owner_id = (select auth.uid())
        and p.role = 'business_owner'
    )
  );

create policy "Business owners can delete their promotion listings"
  on public.promotion_listings for delete to authenticated
  using (
    exists (
      select 1
      from public.businesses b
      join public.profiles p on p.id = b.owner_id
      where b.id = promotion_listings.business_id
        and b.owner_id = (select auth.uid())
        and p.role = 'business_owner'
    )
  );

revoke all on public.promotion_listings from public, anon, authenticated;
grant select on public.promotion_listings to anon, authenticated;
grant insert, update, delete on public.promotion_listings to authenticated;
revoke all on function public.set_promotion_listing_updated_at() from public, anon, authenticated;
