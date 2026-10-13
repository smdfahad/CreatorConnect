create table if not exists public.creator_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  channel_name text not null,
  channel_url text not null,
  subscriber_count bigint not null default 0,
  average_views bigint,
  niche text not null,
  city text not null,
  location text not null,
  biography text not null default '',
  promotion_interests text[] not null default '{}',
  preferred_promotion_types text[] not null default '{}',
  minimum_fee numeric(12, 2),
  availability text not null default 'available'
    check (availability in ('available', 'busy', 'unavailable')),
  preferred_travel_distance_km integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_profiles_full_name_not_empty check (length(trim(full_name)) > 0),
  constraint creator_profiles_channel_name_not_empty check (length(trim(channel_name)) > 0),
  constraint creator_profiles_channel_url_not_empty check (length(trim(channel_url)) > 0),
  constraint creator_profiles_youtube_url check (
    channel_url ~* '^https?://([a-z0-9-]+\.)*youtube\.com(/|$)'
    or channel_url ~* '^https?://youtu\.be(/|$)'
  ),
  constraint creator_profiles_subscriber_count_nonnegative check (subscriber_count >= 0),
  constraint creator_profiles_average_views_nonnegative check (
    average_views is null or average_views >= 0
  ),
  constraint creator_profiles_niche_not_empty check (length(trim(niche)) > 0),
  constraint creator_profiles_city_not_empty check (length(trim(city)) > 0),
  constraint creator_profiles_location_not_empty check (length(trim(location)) > 0),
  constraint creator_profiles_minimum_fee_nonnegative check (
    minimum_fee is null or minimum_fee >= 0
  ),
  constraint creator_profiles_travel_distance_nonnegative check (
    preferred_travel_distance_km is null or preferred_travel_distance_km >= 0
  ),
  constraint creator_profiles_interests_allowed check (
    promotion_interests <@ array[
      'Technology', 'Food', 'Travel', 'Fashion', 'Gaming', 'Education',
      'Fitness', 'Finance', 'Lifestyle', 'Comedy', 'Beauty', 'Business', 'Other'
    ]::text[]
  ),
  constraint creator_profiles_promotion_types_allowed check (
    preferred_promotion_types <@ array[
      'YouTube Shorts', 'Dedicated video', 'Product review',
      'Restaurant visit', 'Shop tour', 'Event coverage'
    ]::text[]
  )
);

create index if not exists creator_profiles_city_idx
  on public.creator_profiles (lower(city));

create or replace function public.set_creator_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists creator_profiles_set_updated_at on public.creator_profiles;
create trigger creator_profiles_set_updated_at
before update on public.creator_profiles
for each row execute function public.set_creator_profile_updated_at();

alter table public.creator_profiles enable row level security;
drop policy if exists "Creators can read their own creator profile" on public.creator_profiles;
drop policy if exists "Creators can create their own creator profile" on public.creator_profiles;
drop policy if exists "Creators can update their own creator profile" on public.creator_profiles;

create policy "Creators can read their own creator profile"
  on public.creator_profiles for select to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'creator'
    )
  );

create policy "Creators can create their own creator profile"
  on public.creator_profiles for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'creator'
    )
  );

create policy "Creators can update their own creator profile"
  on public.creator_profiles for update to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'creator'
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'creator'
    )
  );

revoke all on public.creator_profiles from public, anon, authenticated;
grant select on public.creator_profiles to anon, authenticated;
grant insert, update on public.creator_profiles to authenticated;
revoke all on function public.set_creator_profile_updated_at() from public, anon, authenticated;

create table if not exists public.saved_opportunities (
  id uuid primary key default gen_random_uuid(),
  creator_user_id uuid not null references auth.users(id) on delete cascade,
  promotion_listing_id uuid not null references public.promotion_listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint saved_opportunities_creator_listing_unique unique (creator_user_id, promotion_listing_id)
);

create index if not exists saved_opportunities_creator_created_idx
  on public.saved_opportunities (creator_user_id, created_at desc);

alter table public.saved_opportunities enable row level security;
drop policy if exists "Creators can read their saved opportunities" on public.saved_opportunities;
drop policy if exists "Creators can save published opportunities" on public.saved_opportunities;
drop policy if exists "Creators can remove their saved opportunities" on public.saved_opportunities;

create policy "Creators can read their saved opportunities"
  on public.saved_opportunities for select to authenticated
  using (
    creator_user_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'creator'
    )
  );

create policy "Creators can save published opportunities"
  on public.saved_opportunities for insert to authenticated
  with check (
    creator_user_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'creator'
    )
    and exists (
      select 1 from public.promotion_listings l
      where l.id = promotion_listing_id
        and l.status = 'published'
    )
  );

create policy "Creators can remove their saved opportunities"
  on public.saved_opportunities for delete to authenticated
  using (
    creator_user_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'creator'
    )
  );

revoke all on public.saved_opportunities from public, anon, authenticated;
grant select, insert, delete on public.saved_opportunities to authenticated;

create or replace view public.published_promotion_listings
with (security_barrier = true)
as
select
  l.id,
  l.business_id,
  l.title,
  l.description,
  l.product_service,
  l.promotion_type,
  l.budget_min,
  l.budget_max,
  l.pricing_mode,
  l.preferred_niche,
  l.subscriber_count,
  l.subscriber_requirement,
  l.city,
  l.location,
  l.deliverables,
  l.preferred_date,
  l.deadline,
  l.created_at,
  b.business_name,
  b.category as business_category,
  b.logo_url as business_logo_url
from public.promotion_listings l
join public.businesses b on b.id = l.business_id
where l.status = 'published';

revoke all on public.published_promotion_listings from public, anon, authenticated;
grant select on public.published_promotion_listings to anon, authenticated;

create or replace function public.discover_promotion_listings(
  p_search text default null,
  p_category text default null,
  p_city text default null,
  p_budget_min numeric default null,
  p_budget_max numeric default null,
  p_negotiable_only boolean default false,
  p_promotion_type text default null,
  p_subscriber_requirement text default null,
  p_sort text default 'recent',
  p_limit integer default 12,
  p_offset integer default 0
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with creator_preference as (
    select niche, city, subscriber_count, minimum_fee
    from public.creator_profiles
    where user_id = (select auth.uid())
  ),
  filtered as (
    select
      l.*,
      case
        when p_sort = 'best' then
          (case when cp.niche is not null and lower(cp.niche) = lower(l.preferred_niche) then 4 else 0 end)
          + (case when cp.city is not null and lower(cp.city) = lower(l.city) then 2 else 0 end)
          + (case when cp.minimum_fee is not null and coalesce(l.budget_max, l.budget_min) >= cp.minimum_fee then 1 else 0 end)
          + (case when cp.subscriber_count is not null and l.subscriber_count is not null
                    and cp.subscriber_count >= l.subscriber_count then 1 else 0 end)
        else 0
      end as match_score
    from public.published_promotion_listings l
    left join creator_preference cp on true
    where
      (nullif(trim(p_search), '') is null or position(lower(trim(p_search)) in lower(concat_ws(
        ' ', l.title, l.description, l.product_service, l.deliverables,
        l.business_name, l.business_category
      ))) > 0)
      and (nullif(trim(p_category), '') is null or lower(l.business_category) = lower(trim(p_category)))
      and (nullif(trim(p_city), '') is null or lower(l.city) = lower(trim(p_city)))
      and (
        p_budget_min is null or l.budget_max is null or l.budget_max >= p_budget_min
      )
      and (
        p_budget_max is null or l.budget_min is null or l.budget_min <= p_budget_max
      )
      and (not coalesce(p_negotiable_only, false) or l.pricing_mode = 'negotiable')
      and (nullif(trim(p_promotion_type), '') is null or l.promotion_type = trim(p_promotion_type))
      and (
        nullif(trim(p_subscriber_requirement), '') is null
        or l.subscriber_requirement = trim(p_subscriber_requirement)
      )
  ),
  paged as (
    select *
    from filtered
    order by
      case when p_sort = 'best' then match_score end desc nulls last,
      created_at desc
    limit least(greatest(coalesce(p_limit, 12), 1), 24)
    offset greatest(coalesce(p_offset, 0), 0)
  )
  select jsonb_build_object(
    'total_count', (select count(*) from filtered),
    'items', coalesce(
      (select jsonb_agg(to_jsonb(paged) - 'match_score' order by
        case when p_sort = 'best' then match_score end desc nulls last,
        created_at desc
      ) from paged),
      '[]'::jsonb
    )
  );
$$;

revoke all on function public.discover_promotion_listings(
  text, text, text, numeric, numeric, boolean, text, text, text, integer, integer
) from public;
grant execute on function public.discover_promotion_listings(
  text, text, text, numeric, numeric, boolean, text, text, text, integer, integer
) to anon, authenticated;
