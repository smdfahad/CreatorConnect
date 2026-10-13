create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  phone text not null default '',
  role text not null check (role in ('creator', 'business_owner')),
  full_name text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists phone text not null default '';
drop trigger if exists profiles_role_immutable on public.profiles;
alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles set role = 'business_owner' where role = 'shop_owner';
alter table public.profiles
  add constraint profiles_role_check check (role in ('creator', 'business_owner'));

create table if not exists public.creators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  channel_name text not null,
  channel_url text not null,
  niche text not null,
  subscribers bigint not null default 0 check (subscribers >= 0),
  engagement numeric(5, 2) not null default 0 check (engagement between 0 and 100),
  starting_price numeric(12, 2) not null default 0 check (starting_price >= 0),
  city text not null,
  description text not null default '',
  profile_image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.creators add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.creators add column if not exists creator_name text not null default '';
alter table public.creators add column if not exists channel_name text not null default '';
alter table public.creators add column if not exists channel_url text not null default '';
alter table public.creators add column if not exists niche text not null default '';
alter table public.creators add column if not exists state text not null default '';
alter table public.creators add column if not exists platform text not null default 'YouTube';
alter table public.creators add column if not exists subscribers bigint not null default 0;
alter table public.creators add column if not exists average_views bigint not null default 0;
alter table public.creators add column if not exists engagement numeric(5, 2) not null default 0;
alter table public.creators add column if not exists starting_price numeric(12, 2) not null default 0;
alter table public.creators add column if not exists short_video_price numeric(12, 2);
alter table public.creators add column if not exists long_video_price numeric(12, 2);
alter table public.creators add column if not exists product_promotion_price numeric(12, 2);
alter table public.creators add column if not exists dedicated_video_price numeric(12, 2);
alter table public.creators add column if not exists city text not null default '';
alter table public.creators add column if not exists description text not null default '';
alter table public.creators add column if not exists profile_image text;
alter table public.creators add column if not exists availability text not null default 'available';
alter table public.creators add column if not exists is_verified boolean not null default false;
alter table public.creators add column if not exists audience jsonb not null default '{}'::jsonb;
alter table public.creators add column if not exists work_samples jsonb not null default '[]'::jsonb;
alter table public.creators add column if not exists content_categories text[] not null default '{}';
alter table public.creators add column if not exists created_at timestamptz not null default now();
alter table public.creators add column if not exists updated_at timestamptz not null default now();
update public.creators set creator_name = channel_name where creator_name = '';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'creators_user_id_fkey'
      and conrelid = 'public.creators'::regclass
  ) then
    alter table public.creators
      add constraint creators_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end;
$$;

create unique index if not exists creators_user_id_idx on public.creators (user_id);

create table if not exists public.business_owners (
  user_id uuid primary key references auth.users(id) on delete cascade,
  business_name text not null,
  owner_name text not null default '',
  business_type text not null,
  city text not null,
  state text not null default '',
  budget numeric(12, 2) not null default 0 check (budget >= 0),
  description text not null default '',
  logo text,
  website text,
  instagram text,
  preferred_niches text[] not null default '{}',
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.business_owners add column if not exists owner_name text not null default '';
alter table public.business_owners add column if not exists state text not null default '';
alter table public.business_owners add column if not exists logo text;
alter table public.business_owners add column if not exists website text;
alter table public.business_owners add column if not exists instagram text;
alter table public.business_owners add column if not exists preferred_niches text[] not null default '{}';
alter table public.business_owners add column if not exists preferences jsonb not null default '{}'::jsonb;

create table if not exists public.collaborations (
  id uuid primary key default gen_random_uuid(),
  business_owner_id uuid not null references auth.users(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  campaign_name text not null default '',
  product_service text not null default '',
  campaign_description text not null default '',
  message text not null,
  preferred_date date,
  deliverables text not null default '',
  proposed_budget numeric(12, 2) not null check (proposed_budget >= 0),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.collaborations add column if not exists campaign_name text not null default '';
alter table public.collaborations add column if not exists product_service text not null default '';
alter table public.collaborations add column if not exists campaign_description text not null default '';
alter table public.collaborations add column if not exists preferred_date date;
alter table public.collaborations add column if not exists deliverables text not null default '';
alter table public.collaborations drop constraint if exists collaborations_status_check;
alter table public.collaborations
  add constraint collaborations_status_check
  check (status in ('pending', 'accepted', 'rejected', 'completed', 'cancelled'));

create table if not exists public.saved_creators (
  business_owner_id uuid not null references auth.users(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (business_owner_id, creator_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  collaboration_id uuid not null references public.collaborations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(trim(body)) > 0 and length(body) <= 5000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  collaboration_id uuid references public.collaborations(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  collaboration_id uuid not null references public.collaborations(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  reviewee_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  review text not null default '',
  created_at timestamptz not null default now(),
  unique (collaboration_id, reviewer_id),
  check (reviewer_id <> reviewee_id)
);

create index if not exists creators_search_idx
  on public.creators (niche, city, starting_price);
create index if not exists collaborations_business_owner_idx
  on public.collaborations (business_owner_id, created_at desc);
create index if not exists collaborations_creator_idx
  on public.collaborations (creator_id, created_at desc);
create index if not exists messages_conversation_idx
  on public.messages (collaboration_id, created_at);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc) where read_at is null;
create index if not exists reviews_reviewee_idx
  on public.reviews (reviewee_id, created_at desc);

create or replace function public.prevent_profile_role_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    raise exception 'Profile role cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_role_immutable on public.profiles;
create trigger profiles_role_immutable
before update on public.profiles
for each row execute function public.prevent_profile_role_change();

create or replace function public.create_creatorconnect_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_role text := new.raw_user_meta_data ->> 'role';
  creator_data jsonb := new.raw_user_meta_data -> 'creator_profile';
  business_data jsonb := new.raw_user_meta_data -> 'business_owner';
begin
  if coalesce(selected_role, '') not in ('creator', 'business_owner') then
    raise exception 'A valid CreatorConnect account type is required';
  end if;

  insert into public.profiles (id, email, phone, role, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    selected_role,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  );

  if selected_role = 'creator' then
    if creator_data is null then
      raise exception 'Creator profile details are required';
    end if;
    insert into public.creators (
      user_id, creator_name, channel_name, channel_url, niche, subscribers,
      average_views, engagement, starting_price, city, description, profile_image,
      availability, audience, work_samples
    ) values (
      new.id,
      coalesce(creator_data ->> 'creator_name', new.raw_user_meta_data ->> 'full_name', ''),
      creator_data ->> 'channel_name',
      creator_data ->> 'channel_url',
      creator_data ->> 'niche',
      coalesce(nullif(creator_data ->> 'subscribers', ''), '0')::bigint,
      coalesce(nullif(creator_data ->> 'average_views', ''), '0')::bigint,
      coalesce(nullif(creator_data ->> 'engagement', ''), '0')::numeric,
      coalesce(nullif(creator_data ->> 'starting_price', ''), '0')::numeric,
      creator_data ->> 'city',
      coalesce(creator_data ->> 'description', ''),
      nullif(creator_data ->> 'profile_image', ''),
      coalesce(creator_data ->> 'availability', 'available'),
      coalesce(creator_data -> 'audience', '{}'::jsonb),
      coalesce(creator_data -> 'work_samples', '[]'::jsonb)
    );
  else
    if business_data is null then
      raise exception 'Business owner profile details are required';
    end if;
    insert into public.business_owners (
      user_id, business_name, owner_name, business_type, city, state, budget,
      description, logo, website, instagram, preferred_niches
    ) values (
      new.id,
      business_data ->> 'business_name',
      coalesce(business_data ->> 'owner_name', new.raw_user_meta_data ->> 'full_name', ''),
      business_data ->> 'business_type',
      business_data ->> 'city',
      coalesce(business_data ->> 'state', ''),
      coalesce(nullif(business_data ->> 'budget', ''), '0')::numeric,
      coalesce(business_data ->> 'description', ''),
      nullif(business_data ->> 'logo', ''),
      nullif(business_data ->> 'website', ''),
      nullif(business_data ->> 'instagram', ''),
      coalesce(
        array(select jsonb_array_elements_text(coalesce(business_data -> 'preferred_niches', '[]'::jsonb))),
        '{}'
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_creatorconnect on auth.users;
create trigger on_auth_user_created_creatorconnect
after insert on auth.users
for each row execute function public.create_creatorconnect_profile();

create or replace function public.protect_collaboration_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.business_owner_id is distinct from old.business_owner_id
    or new.creator_id is distinct from old.creator_id
    or new.campaign_name is distinct from old.campaign_name
    or new.product_service is distinct from old.product_service
    or new.campaign_description is distinct from old.campaign_description
    or new.message is distinct from old.message
    or new.preferred_date is distinct from old.preferred_date
    or new.deliverables is distinct from old.deliverables
    or new.proposed_budget is distinct from old.proposed_budget
    or not (
      (old.status = 'pending' and new.status in ('accepted', 'rejected', 'cancelled'))
      or (old.status = 'accepted' and new.status in ('completed', 'cancelled'))
    ) then
    raise exception 'Collaboration details cannot be changed and status transitions must be valid';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists collaborations_protect_update on public.collaborations;
create trigger collaborations_protect_update
before update on public.collaborations
for each row execute function public.protect_collaboration_update();

create or replace function public.notify_collaboration_participant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient_id uuid;
  notification_title text;
  notification_body text;
begin
  if tg_op = 'INSERT' then
    select c.user_id into recipient_id
    from public.creators c where c.id = new.creator_id;
    notification_title := 'New collaboration request';
    notification_body := coalesce(nullif(new.campaign_name, ''), 'A business sent you a collaboration request.');
  elsif new.status is distinct from old.status then
    if new.status = 'cancelled' then
      select c.user_id into recipient_id from public.creators c where c.id = new.creator_id;
      notification_title := 'Collaboration cancelled';
    else
      recipient_id := new.business_owner_id;
      notification_title := case new.status
        when 'accepted' then 'Your collaboration request was accepted'
        when 'rejected' then 'Your collaboration request was declined'
        when 'completed' then 'Collaboration marked complete'
        else 'Collaboration updated'
      end;
    end if;
    notification_body := coalesce(nullif(new.campaign_name, ''), 'Your collaboration has been updated.');
  else
    return new;
  end if;

  if recipient_id is not null then
    insert into public.notifications (user_id, type, title, body, collaboration_id)
    values (recipient_id, 'collaboration', notification_title, notification_body, new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists collaborations_notify_participant on public.collaborations;
create trigger collaborations_notify_participant
after insert or update of status on public.collaborations
for each row execute function public.notify_collaboration_participant();

create or replace function public.notify_message_recipient()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  collaboration_row public.collaborations%rowtype;
  recipient_id uuid;
begin
  select * into collaboration_row
  from public.collaborations
  where id = new.collaboration_id;

  if new.sender_id = collaboration_row.business_owner_id then
    select c.user_id into recipient_id
    from public.creators c where c.id = collaboration_row.creator_id;
  else
    recipient_id := collaboration_row.business_owner_id;
  end if;

  if recipient_id is not null then
    insert into public.notifications (user_id, type, title, body, collaboration_id)
    values (recipient_id, 'message', 'New message', 'You received a new collaboration message.', new.collaboration_id);
  end if;
  return new;
end;
$$;

drop trigger if exists messages_notify_recipient on public.messages;
create trigger messages_notify_recipient
after insert on public.messages
for each row execute function public.notify_message_recipient();

revoke all on function public.notify_collaboration_participant() from public, anon, authenticated;
revoke all on function public.notify_message_recipient() from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.creators enable row level security;
alter table public.business_owners enable row level security;
alter table public.collaborations enable row level security;
alter table public.saved_creators enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.reviews enable row level security;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles', 'creators', 'business_owners', 'collaborations',
        'saved_creators', 'messages', 'notifications', 'reviews'
      )
  loop
    execute format(
      'drop policy %I on public.%I',
      existing_policy.policyname,
      existing_policy.tablename
    );
  end loop;
end;
$$;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "Anyone can read creator listings" on public.creators;
create policy "Anyone can read creator listings"
  on public.creators for select to anon, authenticated
  using (true);

drop policy if exists "Creators can insert their own profile" on public.creators;
create policy "Creators can insert their own profile"
  on public.creators for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'creator'
    )
  );

drop policy if exists "Creators can update their own profile" on public.creators;
create policy "Creators can update their own profile"
  on public.creators for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'creator'
    )
  );

drop policy if exists "Business owners can read connected business details" on public.business_owners;
create policy "Business owners can read connected business details"
  on public.business_owners for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.collaborations col
      join public.creators c on c.id = col.creator_id
      where col.business_owner_id = business_owners.user_id
        and c.user_id = (select auth.uid())
    )
  );

drop policy if exists "Business owners can read their own profile" on public.business_owners;
create policy "Business owners can read their own profile"
  on public.business_owners for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Business owners can insert their own profile" on public.business_owners;
create policy "Business owners can insert their own profile"
  on public.business_owners for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'business_owner'
    )
  );

drop policy if exists "Business owners can update their own profile" on public.business_owners;
create policy "Business owners can update their own profile"
  on public.business_owners for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'business_owner'
    )
  );

drop policy if exists "Participants can read collaborations" on public.collaborations;
create policy "Participants can read collaborations"
  on public.collaborations for select to authenticated
  using (
    business_owner_id = (select auth.uid())
    or exists (
      select 1 from public.creators c
      where c.id = creator_id and c.user_id = (select auth.uid())
    )
  );

drop policy if exists "Business owners can create collaborations" on public.collaborations;
create policy "Business owners can create collaborations"
  on public.collaborations for insert to authenticated
  with check (
    business_owner_id = (select auth.uid())
    and status = 'pending'
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'business_owner'
    )
    and exists (select 1 from public.creators c where c.id = creator_id)
  );

drop policy if exists "Participants can update collaboration status" on public.collaborations;
create policy "Participants can update collaboration status"
  on public.collaborations for update to authenticated
  using (
    business_owner_id = (select auth.uid())
    or exists (select 1 from public.creators c where c.id = creator_id and c.user_id = (select auth.uid()))
  )
  with check (
    (
      business_owner_id = (select auth.uid())
      and status in ('pending', 'cancelled', 'completed')
    )
    or (
      exists (select 1 from public.creators c
      where c.id = creator_id and c.user_id = (select auth.uid())
        and status in ('pending', 'accepted', 'rejected', 'completed')
      )
    )
  );

drop policy if exists "Business owners can manage their saved creators" on public.saved_creators;
create policy "Business owners can manage their saved creators"
  on public.saved_creators for all to authenticated
  using (
    business_owner_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'business_owner'
    )
  )
  with check (
    business_owner_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'business_owner'
    )
  );

drop policy if exists "Collaboration participants can read messages" on public.messages;
create policy "Collaboration participants can read messages"
  on public.messages for select to authenticated
  using (
    exists (
      select 1 from public.collaborations col
      where col.id = collaboration_id
        and (
          col.business_owner_id = (select auth.uid())
          or exists (
            select 1 from public.creators c
            where c.id = col.creator_id and c.user_id = (select auth.uid())
          )
        )
    )
  );

drop policy if exists "Collaboration participants can send messages" on public.messages;
create policy "Collaboration participants can send messages"
  on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.collaborations col
      where col.id = collaboration_id
        and col.status in ('accepted', 'completed')
        and (
          col.business_owner_id = (select auth.uid())
          or exists (
            select 1 from public.creators c
            where c.id = col.creator_id and c.user_id = (select auth.uid())
          )
        )
    )
  );

drop policy if exists "Participants can mark messages read" on public.messages;
create policy "Participants can mark messages read"
  on public.messages for update to authenticated
  using (
    exists (
      select 1 from public.collaborations col
      where col.id = collaboration_id
        and (
          col.business_owner_id = (select auth.uid())
          or exists (
            select 1 from public.creators c
            where c.id = col.creator_id and c.user_id = (select auth.uid())
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.collaborations col
      where col.id = collaboration_id
        and (
          col.business_owner_id = (select auth.uid())
          or exists (
            select 1 from public.creators c
            where c.id = col.creator_id and c.user_id = (select auth.uid())
          )
        )
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

drop policy if exists "Creator reviews are public" on public.reviews;
create policy "Creator reviews are public"
  on public.reviews for select to anon, authenticated
  using (exists (select 1 from public.creators c where c.user_id = reviewee_id));

drop policy if exists "Collaboration participants can leave one review" on public.reviews;
create policy "Collaboration participants can leave one review"
  on public.reviews for insert to authenticated
  with check (
    reviewer_id = (select auth.uid())
    and exists (
      select 1 from public.collaborations col
      where col.id = collaboration_id
        and col.status = 'completed'
        and (
          (
            col.business_owner_id = (select auth.uid())
            and exists (select 1 from public.creators c where c.id = col.creator_id and c.user_id = reviewee_id)
          )
          or (
            exists (select 1 from public.creators c where c.id = col.creator_id and c.user_id = (select auth.uid()))
            and reviewee_id = col.business_owner_id
          )
        )
    )
  );

grant usage on schema public to anon, authenticated;
revoke all on public.profiles from public, anon, authenticated;
revoke all on public.creators from public, anon, authenticated;
revoke all on public.business_owners from public, anon, authenticated;
revoke all on public.collaborations from public, anon, authenticated;
revoke all on public.saved_creators from public, anon, authenticated;
revoke all on public.messages from public, anon, authenticated;
revoke all on public.notifications from public, anon, authenticated;
revoke all on public.reviews from public, anon, authenticated;
grant select (
  id, user_id, creator_name, channel_name, channel_url, niche, state,
  platform, subscribers, average_views, engagement, starting_price,
  short_video_price, long_video_price, product_promotion_price,
  dedicated_video_price, city, description, profile_image,
  availability, is_verified, audience, work_samples, content_categories,
  created_at
) on public.creators to anon;
grant select (
  id, creator_name, channel_name, channel_url, niche, state, platform,
  subscribers, average_views, engagement, starting_price, short_video_price,
  long_video_price, product_promotion_price, dedicated_video_price, city,
  description, profile_image, availability, is_verified, audience,
  work_samples, content_categories, created_at, updated_at, user_id
) on public.creators to authenticated;
grant insert (
  user_id, creator_name, channel_name, channel_url, niche, state, platform,
  subscribers, average_views, engagement, starting_price, short_video_price,
  long_video_price, product_promotion_price, dedicated_video_price, city,
  description, profile_image, availability, audience, work_samples,
  content_categories, updated_at
) on public.creators to authenticated;
grant update (
  creator_name, channel_name, channel_url, niche, state, platform,
  subscribers, average_views, engagement, starting_price, short_video_price,
  long_video_price, product_promotion_price, dedicated_video_price, city,
  description, profile_image, availability, audience, work_samples,
  content_categories, updated_at
) on public.creators to authenticated;
grant select, update on public.profiles to authenticated;
grant select (
  user_id, business_name, owner_name, business_type, city, state,
  budget, description, logo, website, instagram, preferred_niches,
  preferences, created_at, updated_at
) on public.business_owners to authenticated;
grant insert, update on public.business_owners to authenticated;
grant select, insert, update on public.collaborations to authenticated;
grant select, insert, delete on public.saved_creators to authenticated;
grant select, insert on public.messages to authenticated;
grant update (read_at) on public.messages to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select (reviewee_id, rating, review, created_at) on public.reviews to anon, authenticated;
grant insert (collaboration_id, reviewer_id, reviewee_id, rating, review) on public.reviews to authenticated;
