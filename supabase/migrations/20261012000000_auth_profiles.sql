create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  full_name text not null default '',
  role text not null check (role in ('business_owner', 'creator')),
  phone text not null default '',
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists email text not null default '',
  add column if not exists full_name text not null default '',
  add column if not exists role text,
  add column if not exists phone text not null default '',
  add column if not exists created_at timestamptz not null default now();

drop trigger if exists profiles_role_immutable on public.profiles;
alter table public.profiles
  drop constraint if exists profiles_role_check;
update public.profiles
set role = 'business_owner'
where role = 'shop_owner';
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('business_owner', 'creator'));
alter table public.profiles
  alter column role set not null;

create or replace function public.prevent_profile_role_change()
returns trigger
language plpgsql
set search_path = ''
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
set search_path = ''
as $$
declare
  selected_role text := new.raw_user_meta_data ->> 'role';
begin
  if selected_role is null or selected_role not in ('business_owner', 'creator') then
    raise exception 'Choose a valid CreatorConnect account type';
  end if;

  insert into public.profiles (id, email, full_name, role, phone)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    selected_role,
    coalesce(new.raw_user_meta_data ->> 'phone', '')
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_creatorconnect on auth.users;
create trigger on_auth_user_created_creatorconnect
after insert on auth.users
for each row execute function public.create_creatorconnect_profile();

insert into public.profiles (id, email, full_name, role, phone)
select
  u.id,
  coalesce(u.email, ''),
  coalesce(u.raw_user_meta_data ->> 'full_name', ''),
  u.raw_user_meta_data ->> 'role',
  coalesce(u.raw_user_meta_data ->> 'phone', '')
from auth.users u
where u.raw_user_meta_data ->> 'role' in ('business_owner', 'creator')
on conflict (id) do nothing;

alter table public.profiles enable row level security;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
  loop
    execute format('drop policy %I on public.profiles', existing_policy.policyname);
  end loop;
end;
$$;

create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
revoke all on function public.create_creatorconnect_profile() from public, anon, authenticated;
revoke all on function public.prevent_profile_role_change() from public, anon, authenticated;
