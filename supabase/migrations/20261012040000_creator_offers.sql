create table if not exists public.creator_offers (
  id uuid primary key default gen_random_uuid(),
  promotion_listing_id uuid not null references public.promotion_listings(id) on delete cascade,
  creator_user_id uuid not null references auth.users(id) on delete cascade,
  listing_title text not null,
  business_name text not null,
  proposed_price numeric(12, 2) not null,
  message text not null,
  proposed_deliverables text not null,
  proposed_schedule text,
  status text not null default 'pending_business'
    check (status in ('pending_business', 'pending_creator', 'accepted', 'rejected', 'withdrawn')),
  counteroffer_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_offers_price_nonnegative check (
    proposed_price >= 0 and proposed_price <= 9999999999.99
  ),
  constraint creator_offers_message_not_empty check (
    length(trim(message)) > 0 and length(message) <= 4000
  ),
  constraint creator_offers_deliverables_not_empty check (
    length(trim(proposed_deliverables)) > 0 and length(proposed_deliverables) <= 4000
  ),
  constraint creator_offers_schedule_length check (
    proposed_schedule is null or length(proposed_schedule) <= 1000
  ),
  constraint creator_offers_counteroffer_count_nonnegative check (counteroffer_count >= 0)
);

create unique index if not exists creator_offers_one_active_per_listing_idx
  on public.creator_offers (creator_user_id, promotion_listing_id)
  where status in ('pending_business', 'pending_creator', 'accepted');

create index if not exists creator_offers_business_listing_idx
  on public.creator_offers (promotion_listing_id, created_at desc);
create index if not exists creator_offers_creator_created_idx
  on public.creator_offers (creator_user_id, created_at desc);

create table if not exists public.creator_offer_history (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.creator_offers(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  actor_role text not null check (actor_role in ('creator', 'business_owner')),
  action text not null check (
    action in (
      'submitted',
      'counteroffered',
      'accepted',
      'rejected',
      'withdrawn'
    )
  ),
  proposed_price numeric(12, 2) not null,
  message text not null,
  proposed_deliverables text not null,
  proposed_schedule text,
  created_at timestamptz not null default now()
);

create index if not exists creator_offer_history_offer_created_idx
  on public.creator_offer_history (offer_id, created_at asc);

create or replace function public.set_creator_offer_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists creator_offers_set_updated_at on public.creator_offers;
create trigger creator_offers_set_updated_at
before update on public.creator_offers
for each row execute function public.set_creator_offer_updated_at();

alter table public.creator_offers enable row level security;
alter table public.creator_offer_history enable row level security;

drop policy if exists "Offer parties can read creator offers" on public.creator_offers;
create policy "Offer parties can read creator offers"
  on public.creator_offers for select to authenticated
  using (
    (
      creator_user_id = (select auth.uid())
      and exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.role = 'creator'
      )
    )
    or exists (
      select 1
      from public.promotion_listings l
      join public.businesses b on b.id = l.business_id
      join public.profiles p on p.id = b.owner_id
      where l.id = creator_offers.promotion_listing_id
        and b.owner_id = (select auth.uid())
        and p.role = 'business_owner'
    )
  );

drop policy if exists "Offer parties can read creator offer history" on public.creator_offer_history;
create policy "Offer parties can read creator offer history"
  on public.creator_offer_history for select to authenticated
  using (
    exists (
      select 1
      from public.creator_offers o
      where o.id = creator_offer_history.offer_id
        and (
          (
            o.creator_user_id = (select auth.uid())
            and exists (
              select 1 from public.profiles p
              where p.id = (select auth.uid()) and p.role = 'creator'
            )
          )
          or exists (
            select 1
            from public.promotion_listings l
            join public.businesses b on b.id = l.business_id
            join public.profiles p on p.id = b.owner_id
            where l.id = o.promotion_listing_id
              and b.owner_id = (select auth.uid())
              and p.role = 'business_owner'
          )
        )
    )
  );

drop policy if exists "Business owners can review offered creator profiles" on public.creator_profiles;
create policy "Business owners can review offered creator profiles"
  on public.creator_profiles for select to authenticated
  using (
    exists (
      select 1
      from public.creator_offers o
      join public.promotion_listings l on l.id = o.promotion_listing_id
      join public.businesses b on b.id = l.business_id
      join public.profiles p on p.id = b.owner_id
      where o.creator_user_id = creator_profiles.user_id
        and b.owner_id = (select auth.uid())
        and p.role = 'business_owner'
    )
  );

revoke all on public.creator_offers from public, anon, authenticated;
grant select on public.creator_offers to authenticated;
revoke all on public.creator_offer_history from public, anon, authenticated;
grant select on public.creator_offer_history to authenticated;
revoke all on function public.set_creator_offer_updated_at() from public, anon, authenticated;

create or replace function public.submit_creator_offer(
  p_promotion_listing_id uuid,
  p_proposed_price numeric,
  p_message text,
  p_proposed_deliverables text,
  p_proposed_schedule text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_creator_role text;
  v_listing public.promotion_listings%rowtype;
  v_business_name text;
  v_offer_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select p.role into v_creator_role
  from public.profiles p
  where p.id = v_user_id;
  if v_creator_role is distinct from 'creator'
    or not exists (select 1 from public.creator_profiles cp where cp.user_id = v_user_id) then
    raise exception 'A complete creator profile is required to submit an offer' using errcode = '42501';
  end if;

  select * into v_listing
  from public.promotion_listings l
  where l.id = p_promotion_listing_id
  for share;
  if not found or v_listing.status <> 'published' then
    raise exception 'This promotion listing is no longer open for offers' using errcode = 'P0002';
  end if;
  if p_proposed_price is null or p_proposed_price < 0 or p_proposed_price > 9999999999.99 then
    raise exception 'Enter a valid proposed price' using errcode = '22023';
  end if;
  if nullif(trim(p_message), '') is null or length(p_message) > 4000
    or nullif(trim(p_proposed_deliverables), '') is null or length(p_proposed_deliverables) > 4000
    or coalesce(length(p_proposed_schedule), 0) > 1000 then
    raise exception 'Message, deliverables, or schedule is invalid' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.creator_offers o
    where o.promotion_listing_id = p_promotion_listing_id
      and o.creator_user_id = v_user_id
      and o.status in ('pending_business', 'pending_creator', 'accepted')
  ) then
    raise exception 'An active or accepted offer already exists for this listing' using errcode = '23505';
  end if;

  select b.business_name into v_business_name
  from public.businesses b
  where b.id = v_listing.business_id;

  insert into public.creator_offers (
    promotion_listing_id, creator_user_id, listing_title, business_name,
    proposed_price, message, proposed_deliverables, proposed_schedule, status
  )
  values (
    v_listing.id, v_user_id, v_listing.title, coalesce(v_business_name, 'Business'),
    p_proposed_price, trim(p_message), trim(p_proposed_deliverables),
    nullif(trim(p_proposed_schedule), ''), 'pending_business'
  )
  returning id into v_offer_id;

  insert into public.creator_offer_history (
    offer_id, actor_user_id, actor_role, action, proposed_price, message,
    proposed_deliverables, proposed_schedule
  )
  values (
    v_offer_id, v_user_id, 'creator', 'submitted', p_proposed_price,
    trim(p_message), trim(p_proposed_deliverables), nullif(trim(p_proposed_schedule), '')
  );

  return v_offer_id;
end;
$$;

create or replace function public.business_offer_action(
  p_offer_id uuid,
  p_action text,
  p_proposed_price numeric default null,
  p_message text default null,
  p_proposed_deliverables text default null,
  p_proposed_schedule text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_offer public.creator_offers%rowtype;
  v_listing public.promotion_listings%rowtype;
  v_owner_role text;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select o.* into v_offer
  from public.creator_offers o
  where o.id = p_offer_id
  for update;
  if not found then
    raise exception 'Offer not found' using errcode = 'P0002';
  end if;
  select l.* into v_listing
  from public.promotion_listings l
  where l.id = v_offer.promotion_listing_id
  for share;
  select p.role into v_owner_role
  from public.businesses b
  join public.profiles p on p.id = b.owner_id
  where b.id = v_listing.business_id and b.owner_id = v_user_id;
  if v_owner_role is distinct from 'business_owner' then
    raise exception 'Only the listing owner can respond to this offer' using errcode = '42501';
  end if;
  if v_offer.status <> 'pending_business' then
    raise exception 'This offer is not awaiting a business response' using errcode = '22023';
  end if;
  if p_action is null or p_action not in ('accept', 'reject', 'counteroffer') then
    raise exception 'Invalid business offer action' using errcode = '22023';
  end if;
  if p_action in ('accept', 'counteroffer') and v_listing.status <> 'published' then
    raise exception 'This listing is closed or unavailable; it cannot be accepted or countered' using errcode = '22023';
  end if;

  if p_action = 'counteroffer' then
    if p_proposed_price is null or p_proposed_price < 0 or p_proposed_price > 9999999999.99
      or nullif(trim(p_message), '') is null or length(p_message) > 4000
      or nullif(trim(p_proposed_deliverables), '') is null or length(p_proposed_deliverables) > 4000
      or coalesce(length(p_proposed_schedule), 0) > 1000 then
      raise exception 'Enter a valid price, message, and deliverables for the counteroffer' using errcode = '22023';
    end if;
    update public.creator_offers o
    set proposed_price = p_proposed_price,
        message = trim(p_message),
        proposed_deliverables = trim(p_proposed_deliverables),
        proposed_schedule = nullif(trim(p_proposed_schedule), ''),
        status = 'pending_creator',
        counteroffer_count = counteroffer_count + 1
    where o.id = v_offer.id;
    insert into public.creator_offer_history (
      offer_id, actor_user_id, actor_role, action, proposed_price, message,
      proposed_deliverables, proposed_schedule
    )
    values (
      v_offer.id, v_user_id, 'business_owner', 'counteroffered', p_proposed_price,
      trim(p_message), trim(p_proposed_deliverables), nullif(trim(p_proposed_schedule), '')
    );
  else
    update public.creator_offers o
    set status = case when p_action = 'accept' then 'accepted' else 'rejected' end
    where o.id = v_offer.id;
    insert into public.creator_offer_history (
      offer_id, actor_user_id, actor_role, action, proposed_price, message,
      proposed_deliverables, proposed_schedule
    )
    values (
      v_offer.id, v_user_id, 'business_owner', p_action, v_offer.proposed_price,
      v_offer.message, v_offer.proposed_deliverables, v_offer.proposed_schedule
    );
  end if;
  return v_offer.id;
end;
$$;

create or replace function public.creator_offer_response(
  p_offer_id uuid,
  p_action text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_offer public.creator_offers%rowtype;
  v_creator_role text;
  v_next_status text;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select o.* into v_offer
  from public.creator_offers o
  where o.id = p_offer_id and o.creator_user_id = v_user_id
  for update;
  if not found then
    raise exception 'Offer not found or not owned by this creator' using errcode = '42501';
  end if;
  select p.role into v_creator_role from public.profiles p where p.id = v_user_id;
  if v_creator_role is distinct from 'creator' then
    raise exception 'Only the creator can respond to this offer' using errcode = '42501';
  end if;

  if p_action = 'withdraw' and v_offer.status = 'pending_business' then
    v_next_status := 'withdrawn';
  elsif p_action in ('accept', 'reject') and v_offer.status = 'pending_creator' then
    v_next_status := case when p_action = 'accept' then 'accepted' else 'rejected' end;
    if p_action = 'accept' then
      perform 1 from public.promotion_listings l
      where l.id = v_offer.promotion_listing_id
        and l.status = 'published'
      for share;
      if not found then
        raise exception 'This listing is closed or unavailable; the counteroffer cannot be accepted' using errcode = '22023';
      end if;
    end if;
  else
    raise exception 'This offer is not awaiting that creator action' using errcode = '22023';
  end if;

  update public.creator_offers o
  set status = v_next_status
  where o.id = v_offer.id;
  insert into public.creator_offer_history (
    offer_id, actor_user_id, actor_role, action, proposed_price, message,
    proposed_deliverables, proposed_schedule
  )
  values (
    v_offer.id, v_user_id, 'creator', p_action, v_offer.proposed_price,
    v_offer.message, v_offer.proposed_deliverables, v_offer.proposed_schedule
  );
  return v_offer.id;
end;
$$;

revoke all on function public.submit_creator_offer(uuid, numeric, text, text, text) from public, anon, authenticated;
revoke all on function public.business_offer_action(uuid, text, numeric, text, text, text) from public, anon, authenticated;
revoke all on function public.creator_offer_response(uuid, text) from public, anon, authenticated;
grant execute on function public.submit_creator_offer(uuid, numeric, text, text, text) to authenticated;
grant execute on function public.business_offer_action(uuid, text, numeric, text, text, text) to authenticated;
grant execute on function public.creator_offer_response(uuid, text) to authenticated;
