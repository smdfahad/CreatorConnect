alter table public.creator_profiles
  add column if not exists state text not null default '',
  add column if not exists profile_image_url text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'creator_profiles_profile_image_url_http'
      and conrelid = 'public.creator_profiles'::regclass
  ) then
    alter table public.creator_profiles
      add constraint creator_profiles_profile_image_url_http
      check (
        profile_image_url is null
        or profile_image_url ~* '^https?://'
      ) not valid;
  end if;
end;
$$;

create or replace view public.public_creator_profiles
with (security_barrier = true)
as
select
  user_id as id,
  user_id,
  full_name,
  channel_name,
  channel_url,
  subscriber_count,
  average_views,
  niche,
  city,
  state,
  biography,
  profile_image_url,
  minimum_fee,
  availability,
  'YouTube'::text as platform,
  case
    when subscriber_count > 0 and average_views is not null
      then round(average_views::numeric / subscriber_count * 100, 2)
    else 0::numeric
  end as engagement,
  created_at
from public.creator_profiles;

revoke all on public.public_creator_profiles from public, anon, authenticated;
grant select on public.public_creator_profiles to authenticated;
