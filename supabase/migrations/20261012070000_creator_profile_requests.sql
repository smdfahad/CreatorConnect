create table if not exists public.creator_collaboration_requests (
  id uuid primary key default gen_random_uuid(),
  business_user_id uuid not null references auth.users(id) on delete cascade,
  creator_user_id uuid not null references auth.users(id) on delete cascade,
  business_name text not null,
  creator_name text not null,
  proposed_budget numeric(12, 2) not null check (proposed_budget >= 0),
  message text not null check (length(trim(message)) > 0 and length(message) <= 5000),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (business_user_id <> creator_user_id)
);

create index if not exists creator_collaboration_requests_business_idx
  on public.creator_collaboration_requests (business_user_id, created_at desc);
create index if not exists creator_collaboration_requests_creator_idx
  on public.creator_collaboration_requests (creator_user_id, created_at desc);
create unique index if not exists creator_collaboration_requests_pending_unique
  on public.creator_collaboration_requests (business_user_id, creator_user_id)
  where status = 'pending';

alter table public.creator_collaboration_requests enable row level security;
drop policy if exists "Participants can read creator profile requests" on public.creator_collaboration_requests;
create policy "Participants can read creator profile requests"
  on public.creator_collaboration_requests for select to authenticated
  using (
    business_user_id = (select auth.uid())
    or creator_user_id = (select auth.uid())
  );

revoke all on public.creator_collaboration_requests from public, anon, authenticated;
grant select on public.creator_collaboration_requests to authenticated;

create or replace function public.request_creator_collaboration(
  p_creator_user_id uuid,
  p_proposed_budget numeric,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_user_id uuid := (select auth.uid());
  v_business_name text;
  v_creator_name text;
  v_request_id uuid;
begin
  if v_business_user_id is null
    or p_creator_user_id is null
    or p_creator_user_id = v_business_user_id
    or p_proposed_budget is null
    or p_proposed_budget < 0
    or p_proposed_budget > 9999999999.99
    or p_message is null
    or length(trim(p_message)) = 0
    or length(p_message) > 5000 then
    raise exception 'A valid creator, budget, and request message are required'
      using errcode = '22023';
  end if;

  select p.full_name into v_business_name
  from public.profiles p
  where p.id = v_business_user_id
    and p.role = 'business_owner';
  if not found then
    raise exception 'Only business owners can request creator collaborations'
      using errcode = '42501';
  end if;

  select cp.full_name into v_creator_name
  from public.creator_profiles cp
  join public.profiles p on p.id = cp.user_id
  where cp.user_id = p_creator_user_id
    and p.role = 'creator';
  if not found then
    raise exception 'The registered creator profile is unavailable'
      using errcode = 'P0002';
  end if;

  insert into public.creator_collaboration_requests (
    business_user_id,
    creator_user_id,
    business_name,
    creator_name,
    proposed_budget,
    message
  )
  values (
    v_business_user_id,
    p_creator_user_id,
    v_business_name,
    v_creator_name,
    p_proposed_budget,
    trim(p_message)
  )
  returning id into v_request_id;

  insert into public.notifications (user_id, type, title, body, reference_id)
  values (
    p_creator_user_id,
    'creator_profile_request',
    'New collaboration request',
    v_business_name || ' sent you a collaboration request.',
    v_request_id
  );

  return v_request_id;
end;
$$;

create or replace function public.respond_to_creator_collaboration_request(
  p_request_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_creator_user_id uuid := (select auth.uid());
  v_request public.creator_collaboration_requests%rowtype;
begin
  if v_creator_user_id is null
    or p_request_id is null
    or p_status is null
    or p_status not in ('accepted', 'rejected') then
    raise exception 'A valid request response is required'
      using errcode = '22023';
  end if;

  update public.creator_collaboration_requests r
  set status = p_status,
      responded_at = now()
  where r.id = p_request_id
    and r.creator_user_id = v_creator_user_id
    and r.status = 'pending'
  returning r.* into v_request;

  if not found then
    raise exception 'The pending request was not found for this creator'
      using errcode = '42501';
  end if;

  insert into public.notifications (user_id, type, title, body, reference_id)
  values (
    v_request.business_user_id,
    'creator_profile_request_response',
    'Collaboration request ' || p_status,
    v_request.creator_name || ' ' || p_status || ' your collaboration request.',
    v_request.id
  );
end;
$$;

revoke all on function public.request_creator_collaboration(uuid, numeric, text) from public, anon, authenticated;
grant execute on function public.request_creator_collaboration(uuid, numeric, text) to authenticated;
revoke all on function public.respond_to_creator_collaboration_request(uuid, text) from public, anon, authenticated;
grant execute on function public.respond_to_creator_collaboration_request(uuid, text) to authenticated;
