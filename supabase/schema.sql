-- Logic Quest: cloud saves. Run this once in the Supabase SQL editor (see docs/SETUP-ACCOUNTS.md).
-- Safe to run again: it only creates what is missing and replaces the policies.

create table if not exists public.saves (
  user_id    uuid primary key references auth.users on delete cascade,
  data       jsonb not null,                 -- the game's SaveData, as is
  rev        int not null default 0,         -- bumped on every write; the client updates "where rev = <known>"
  updated_at timestamptz not null default now()
);

-- Row level security: a signed-in user can reach only their own row.
alter table public.saves enable row level security;

-- Nobody is trusted by default. Then grant exactly what the game needs, to signed-in users only.
-- No delete: deleting the account removes the row through "on delete cascade".
revoke all on public.saves from anon, authenticated;
grant select, insert, update on public.saves to authenticated;

drop policy if exists "saves: read own"   on public.saves;
drop policy if exists "saves: insert own" on public.saves;
drop policy if exists "saves: update own" on public.saves;

create policy "saves: read own" on public.saves
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "saves: insert own" on public.saves
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "saves: update own" on public.saves
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Keep updated_at honest.
create or replace function public.saves_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists saves_touch on public.saves;
create trigger saves_touch before update on public.saves
  for each row execute function public.saves_touch();
