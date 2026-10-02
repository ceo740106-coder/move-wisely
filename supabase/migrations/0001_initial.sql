create extension if not exists pgcrypto;

grant usage on schema public to authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  chess_username text check (char_length(chess_username) <= 32),
  default_time_class text check (default_time_class in ('bullet','blitz','rapid','daily')),
  competition_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.analysis_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chess_username text not null check (char_length(chess_username) between 1 and 32),
  time_class text not null check (time_class in ('bullet','blitz','rapid','daily')),
  games_analyzed integer not null check (games_analyzed between 1 and 30),
  engine_version text not null check (char_length(engine_version) <= 100),
  engine_depth integer not null check (engine_depth between 8 and 20),
  overall_cpl integer not null check (overall_cpl between 0 and 5000),
  accuracy numeric(5,2) not null check (accuracy between 0 and 100),
  source text not null default 'chesscom' check (source in ('chesscom','pgn')),
  verified_issues integer not null default 0 check (verified_issues between 0 and 500),
  primary_focus text check (primary_focus is null or primary_focus in ('opening','timeTrouble','tactics','calculation','endgame','pawnStructure','hangingPieces')),
  report jsonb not null check (jsonb_typeof(report) = 'object' and pg_column_size(report) <= 2000000),
  created_at timestamptz not null default now()
);

create table if not exists public.training_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_id uuid not null references public.analysis_reports(id) on delete cascade,
  task_key text not null check (char_length(task_key) between 1 and 120),
  completed_at timestamptz not null default now(),
  unique(user_id, report_id, task_key)
);

create index if not exists analysis_reports_user_created_idx on public.analysis_reports(user_id, created_at desc);
create index if not exists training_progress_user_report_idx on public.training_progress(user_id, report_id);

alter table public.profiles enable row level security;
alter table public.analysis_reports enable row level security;
alter table public.training_progress enable row level security;

revoke all on public.profiles from anon;
revoke all on public.analysis_reports from anon;
revoke all on public.training_progress from anon;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, delete on public.analysis_reports to authenticated;
grant select, insert, update, delete on public.training_progress to authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_delete_own on public.profiles for delete to authenticated using ((select auth.uid()) = id);

drop policy if exists reports_select_own on public.analysis_reports;
create policy reports_select_own on public.analysis_reports for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists reports_insert_own on public.analysis_reports;
create policy reports_insert_own on public.analysis_reports for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists reports_delete_own on public.analysis_reports;
create policy reports_delete_own on public.analysis_reports for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists training_select_own on public.training_progress;
create policy training_select_own on public.training_progress for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists training_insert_own on public.training_progress;
create policy training_insert_own on public.training_progress for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists training_update_own on public.training_progress;
create policy training_update_own on public.training_progress for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists training_delete_own on public.training_progress;
create policy training_delete_own on public.training_progress for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)), 80))
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user_profile() from public;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

create or replace function public.touch_profile_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.touch_profile_updated_at() from public;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.touch_profile_updated_at();
