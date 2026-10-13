create table if not exists public.creator_collaborations (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null unique references public.creator_offers(id) on delete restrict,
  business_id uuid not null references public.businesses(id) on delete restrict,
  business_user_id uuid not null references auth.users(id) on delete cascade,
  creator_user_id uuid not null references auth.users(id) on delete cascade,
  promotion_listing_id uuid not null references public.promotion_listings(id) on delete restrict,
  business_name text not null,
  creator_name text not null,
  listing_title text not null,
  agreed_price numeric(12, 2) not null check (agreed_price >= 0),
  deliverables text not null check (length(trim(deliverables)) > 0),
  agreed_date date,
  status text not null default 'awaiting_confirmation'
    check (status in ('awaiting_confirmation', 'confirmed', 'in_progress', 'completed', 'cancelled', 'disputed')),
  business_confirmed_at timestamptz,
  creator_confirmed_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (business_user_id <> creator_user_id),
  check (
    (status = 'awaiting_confirmation' and confirmed_at is null)
    or status = 'cancelled'
    or (status in ('confirmed', 'in_progress', 'completed', 'disputed') and confirmed_at is not null)
  )
);

create index if not exists creator_collaborations_business_idx
  on public.creator_collaborations (business_user_id, created_at desc);
create index if not exists creator_collaborations_creator_idx
  on public.creator_collaborations (creator_user_id, created_at desc);
create index if not exists creator_collaborations_upcoming_idx
  on public.creator_collaborations (agreed_date)
  where status in ('confirmed', 'in_progress');

create table if not exists public.creator_collaboration_conversations (
  id uuid primary key default gen_random_uuid(),
  collaboration_id uuid not null unique
    references public.creator_collaborations(id) on delete cascade,
  business_user_id uuid not null references auth.users(id) on delete cascade,
  creator_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (business_user_id <> creator_user_id)
);

create table if not exists public.creator_collaboration_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references public.creator_collaboration_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(trim(body)) > 0 and length(body) <= 5000),
  created_at timestamptz not null default now()
);

create index if not exists creator_collaboration_messages_conversation_idx
  on public.creator_collaboration_messages (conversation_id, created_at);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  collaboration_id uuid,
  offer_id uuid,
  reference_id uuid,
  conversation_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications add column if not exists offer_id uuid;
alter table public.notifications add column if not exists reference_id uuid;
alter table public.notifications add column if not exists conversation_id uuid;

create unique index if not exists notifications_upcoming_campaign_once_idx
  on public.notifications (user_id, type, reference_id)
  where type = 'campaign_upcoming' and reference_id is not null;

alter table public.creator_collaborations enable row level security;
alter table public.creator_collaboration_conversations enable row level security;
alter table public.creator_collaboration_messages enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "Participants can read creator collaborations" on public.creator_collaborations;
create policy "Participants can read creator collaborations"
  on public.creator_collaborations for select to authenticated
  using (business_user_id = (select auth.uid()) or creator_user_id = (select auth.uid()));

drop policy if exists "Participants can read creator collaboration conversations" on public.creator_collaboration_conversations;
create policy "Participants can read creator collaboration conversations"
  on public.creator_collaboration_conversations for select to authenticated
  using (business_user_id = (select auth.uid()) or creator_user_id = (select auth.uid()));

drop policy if exists "Participants can read creator collaboration messages" on public.creator_collaboration_messages;
create policy "Participants can read creator collaboration messages"
  on public.creator_collaboration_messages for select to authenticated
  using (
    exists (
      select 1 from public.creator_collaboration_conversations c
      where c.id = conversation_id
        and (c.business_user_id = (select auth.uid()) or c.creator_user_id = (select auth.uid()))
    )
  );

drop policy if exists "Participants can send creator collaboration messages" on public.creator_collaboration_messages;
create policy "Participants can send creator collaboration messages"
  on public.creator_collaboration_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1
      from public.creator_collaboration_conversations c
      join public.creator_collaborations col on col.id = c.collaboration_id
      where c.id = conversation_id
        and (c.business_user_id = (select auth.uid()) or c.creator_user_id = (select auth.uid()))
        and col.status in ('confirmed', 'in_progress', 'completed', 'disputed')
    )
  );

drop policy if exists "Users can read their own notifications" on public.notifications;
create policy "Users can read their own notifications"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can mark their own notifications read" on public.notifications;
create policy "Users can mark their own notifications read"
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.creator_collaborations from anon, authenticated;
grant select on public.creator_collaborations to authenticated;
revoke all on public.creator_collaboration_conversations from anon, authenticated;
grant select on public.creator_collaboration_conversations to authenticated;
revoke all on public.creator_collaboration_messages from anon, authenticated;
grant select, insert on public.creator_collaboration_messages to authenticated;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create or replace function public.create_creator_collaboration_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.creator_collaboration_conversations (
    collaboration_id, business_user_id, creator_user_id
  )
  values (new.id, new.business_user_id, new.creator_user_id)
  on conflict (collaboration_id) do nothing;
  return new;
end;
$$;

drop trigger if exists creator_collaboration_conversation_created on public.creator_collaborations;
create trigger creator_collaboration_conversation_created
after insert on public.creator_collaborations
for each row execute function public.create_creator_collaboration_conversation();

create or replace function public.confirm_creator_collaboration(
  p_offer_id uuid,
  p_agreed_date date default null
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
  v_business public.businesses%rowtype;
  v_creator public.creator_profiles%rowtype;
  v_role text;
  v_collaboration public.creator_collaborations%rowtype;
  v_is_business boolean;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_agreed_date is not null and p_agreed_date < current_date then
    raise exception 'The agreed campaign date cannot be in the past' using errcode = '22023';
  end if;

  select o.* into v_offer
  from public.creator_offers o
  where o.id = p_offer_id and o.status = 'accepted'
  for update;
  if not found then
    raise exception 'Only offers with mutually accepted terms can be confirmed' using errcode = '22023';
  end if;

  select l.* into v_listing
  from public.promotion_listings l
  where l.id = v_offer.promotion_listing_id;
  select b.* into v_business
  from public.businesses b
  where b.id = v_listing.business_id;
  select cp.* into v_creator
  from public.creator_profiles cp
  where cp.user_id = v_offer.creator_user_id;
  select p.role into v_role
  from public.profiles p
  where p.id = v_user_id;

  v_is_business := v_user_id = v_business.owner_id;
  if not v_is_business and v_user_id <> v_offer.creator_user_id then
    raise exception 'Only the offer participants can confirm this collaboration' using errcode = '42501';
  end if;
  if (v_is_business and v_role is distinct from 'business_owner')
    or (not v_is_business and v_role is distinct from 'creator') then
    raise exception 'Your account role cannot confirm this collaboration' using errcode = '42501';
  end if;
  if v_business.id is null or v_creator.user_id is null then
    raise exception 'The business or creator profile for this offer is unavailable' using errcode = 'P0002';
  end if;

  select c.* into v_collaboration
  from public.creator_collaborations c
  where c.offer_id = v_offer.id
  for update;

  if not found then
    insert into public.creator_collaborations (
      offer_id, business_id, business_user_id, creator_user_id,
      promotion_listing_id, business_name, creator_name, listing_title,
      agreed_price, deliverables, agreed_date, status,
      business_confirmed_at, creator_confirmed_at
    )
    values (
      v_offer.id, v_business.id, v_business.owner_id, v_offer.creator_user_id,
      v_listing.id, v_business.business_name, v_creator.channel_name, v_listing.title,
      v_offer.proposed_price, v_offer.proposed_deliverables, p_agreed_date,
      'awaiting_confirmation',
      case when v_is_business then now() else null end,
      case when v_is_business then null else now() end
    )
    returning * into v_collaboration;
    return v_collaboration.id;
  end if;

  if v_collaboration.status <> 'awaiting_confirmation' then
    return v_collaboration.id;
  end if;
  if (
    (v_is_business and v_collaboration.creator_confirmed_at is not null)
    or (not v_is_business and v_collaboration.business_confirmed_at is not null)
  ) and v_collaboration.agreed_date is distinct from p_agreed_date then
    raise exception 'The agreed campaign date differs from the other participant confirmation' using errcode = '22023';
  end if;

  update public.creator_collaborations c
  set agreed_date = p_agreed_date,
      business_confirmed_at = case
        when v_is_business then coalesce(c.business_confirmed_at, now())
        else c.business_confirmed_at
      end,
      creator_confirmed_at = case
        when not v_is_business then coalesce(c.creator_confirmed_at, now())
        else c.creator_confirmed_at
      end,
      status = case
        when (v_is_business and c.creator_confirmed_at is not null)
          or (not v_is_business and c.business_confirmed_at is not null)
          then 'confirmed'
        else 'awaiting_confirmation'
      end,
      confirmed_at = case
        when (v_is_business and c.creator_confirmed_at is not null)
          or (not v_is_business and c.business_confirmed_at is not null)
          then now()
        else null
      end,
      updated_at = now()
  where c.id = v_collaboration.id;

  return v_collaboration.id;
end;
$$;

create or replace function public.update_creator_collaboration_status(
  p_collaboration_id uuid,
  p_status text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_collaboration public.creator_collaborations%rowtype;
  v_role text;
  v_allowed boolean := false;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select c.* into v_collaboration
  from public.creator_collaborations c
  where c.id = p_collaboration_id
  for update;
  if not found then
    raise exception 'Collaboration not found' using errcode = 'P0002';
  end if;
  if v_user_id not in (v_collaboration.business_user_id, v_collaboration.creator_user_id) then
    raise exception 'Only collaboration participants can update its status' using errcode = '42501';
  end if;
  select p.role into v_role from public.profiles p where p.id = v_user_id;
  if (v_user_id = v_collaboration.business_user_id and v_role is distinct from 'business_owner')
    or (v_user_id = v_collaboration.creator_user_id and v_role is distinct from 'creator') then
    raise exception 'Your account role cannot update this collaboration' using errcode = '42501';
  end if;

  v_allowed := case v_collaboration.status
    when 'awaiting_confirmation' then p_status = 'cancelled'
    when 'confirmed' then p_status in ('in_progress', 'cancelled', 'disputed')
    when 'in_progress' then p_status in ('completed', 'cancelled', 'disputed')
    when 'disputed' then p_status in ('in_progress', 'completed', 'cancelled')
    else false
  end;
  if coalesce(v_allowed, false) is not true then
    raise exception 'That collaboration status transition is not allowed' using errcode = '22023';
  end if;

  update public.creator_collaborations c
  set status = p_status, updated_at = now()
  where c.id = v_collaboration.id;
  return v_collaboration.id;
end;
$$;

create or replace function public.notify_upcoming_creator_collaborations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_inserted integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  insert into public.notifications (user_id, type, title, body, reference_id)
  select v_user_id, 'campaign_upcoming', 'Upcoming campaign',
    c.listing_title || ' is scheduled for ' || to_char(c.agreed_date, 'Mon DD, YYYY') || '.',
    c.id
  from public.creator_collaborations c
  where v_user_id in (c.business_user_id, c.creator_user_id)
    and c.status in ('confirmed', 'in_progress')
    and c.agreed_date between current_date and current_date + 3
  on conflict (user_id, type, reference_id)
    where type = 'campaign_upcoming' and reference_id is not null
    do nothing;
  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

create or replace function public.notify_creator_offer_participants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_user_id uuid;
  v_recipient_id uuid;
  v_type text;
  v_title text;
  v_body text;
begin
  select b.owner_id into v_business_user_id
  from public.promotion_listings l
  join public.businesses b on b.id = l.business_id
  where l.id = new.promotion_listing_id;

  if tg_op = 'INSERT' then
    v_recipient_id := v_business_user_id;
    v_type := 'new_offer';
    v_title := 'New creator offer';
    v_body := coalesce(nullif(new.listing_title, ''), 'A creator sent an offer for your promotion.');
  elsif new.status is distinct from old.status then
    if new.status = 'pending_creator' then
      v_recipient_id := new.creator_user_id;
      v_type := 'counteroffer';
      v_title := 'New counteroffer';
      v_body := 'A business sent you a counteroffer. Review the updated terms.';
    elsif new.status in ('accepted', 'rejected') and old.status = 'pending_creator' then
      v_recipient_id := v_business_user_id;
      v_type := case when new.status = 'accepted' then 'offer_accepted' else 'offer_rejected' end;
      v_title := case when new.status = 'accepted' then 'Offer accepted' else 'Offer rejected' end;
      v_body := 'The creator responded to your counteroffer.';
    elsif new.status in ('accepted', 'rejected') then
      v_recipient_id := new.creator_user_id;
      v_type := case when new.status = 'accepted' then 'offer_accepted' else 'offer_rejected' end;
      v_title := case when new.status = 'accepted' then 'Offer accepted' else 'Offer rejected' end;
      v_body := case when new.status = 'accepted'
        then 'Your offer terms were accepted. Confirm the collaboration details with the business.'
        else 'The business declined your offer.' end;
    end if;
  end if;

  if v_recipient_id is not null and v_type is not null then
    insert into public.notifications (user_id, type, title, body, offer_id, reference_id)
    values (v_recipient_id, v_type, v_title, v_body, new.id, new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists creator_offer_participant_notification on public.creator_offers;
create trigger creator_offer_participant_notification
after insert or update of status on public.creator_offers
for each row execute function public.notify_creator_offer_participants();

create or replace function public.notify_creator_collaboration_participants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text;
  v_title text;
  v_body text;
begin
  if tg_op = 'INSERT' then
    return new;
  elsif new.status is not distinct from old.status then
    return new;
  elsif new.status = 'confirmed' then
    v_type := 'collaboration_confirmed';
    v_title := 'Collaboration confirmed';
    v_body := new.listing_title || ' is confirmed by both participants.';
  elsif new.status = 'completed' then
    v_type := 'completion_update';
    v_title := 'Collaboration completed';
    v_body := new.listing_title || ' was marked completed.';
  else
    return new;
  end if;

  insert into public.notifications (user_id, type, title, body, reference_id)
  values
    (new.business_user_id, v_type, v_title, v_body, new.id),
    (new.creator_user_id, v_type, v_title, v_body, new.id);
  return new;
end;
$$;

drop trigger if exists creator_collaboration_participant_notification on public.creator_collaborations;
create trigger creator_collaboration_participant_notification
after update of status on public.creator_collaborations
for each row execute function public.notify_creator_collaboration_participants();

create or replace function public.notify_creator_collaboration_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation public.creator_collaboration_conversations%rowtype;
  v_collaboration public.creator_collaborations%rowtype;
  v_recipient_id uuid;
begin
  select c.* into v_conversation
  from public.creator_collaboration_conversations c
  where c.id = new.conversation_id;
  select col.* into v_collaboration
  from public.creator_collaborations col
  where col.id = v_conversation.collaboration_id;
  v_recipient_id := case
    when new.sender_id = v_conversation.business_user_id then v_conversation.creator_user_id
    else v_conversation.business_user_id
  end;
  insert into public.notifications (
    user_id, type, title, body, reference_id, conversation_id
  )
  values (
    v_recipient_id, 'new_message', 'New collaboration message',
    left(new.body, 180), v_collaboration.id, v_conversation.id
  );
  return new;
end;
$$;

drop trigger if exists creator_collaboration_message_notification on public.creator_collaboration_messages;
create trigger creator_collaboration_message_notification
after insert on public.creator_collaboration_messages
for each row execute function public.notify_creator_collaboration_message();

revoke all on function public.confirm_creator_collaboration(uuid, date) from public, anon, authenticated;
revoke all on function public.update_creator_collaboration_status(uuid, text) from public, anon, authenticated;
revoke all on function public.notify_upcoming_creator_collaborations() from public, anon, authenticated;
revoke all on function public.create_creator_collaboration_conversation() from public, anon, authenticated;
revoke all on function public.notify_creator_offer_participants() from public, anon, authenticated;
revoke all on function public.notify_creator_collaboration_participants() from public, anon, authenticated;
revoke all on function public.notify_creator_collaboration_message() from public, anon, authenticated;
grant execute on function public.confirm_creator_collaboration(uuid, date) to authenticated;
grant execute on function public.update_creator_collaboration_status(uuid, text) to authenticated;
grant execute on function public.notify_upcoming_creator_collaborations() to authenticated;
