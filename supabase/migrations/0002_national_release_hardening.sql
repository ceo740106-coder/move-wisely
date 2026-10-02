-- Idempotent hardening for installations that already applied 0001_initial.sql.
alter table public.analysis_reports add column if not exists primary_focus text;

drop constraint if exists analysis_reports_primary_focus_check;
alter table public.analysis_reports
  add constraint analysis_reports_primary_focus_check
  check (primary_focus is null or primary_focus in ('opening','timeTrouble','tactics','calculation','endgame','pawnStructure','hangingPieces'));

create index if not exists analysis_reports_user_focus_idx
  on public.analysis_reports(user_id, primary_focus, created_at desc);

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

-- RLS remains mandatory even if a later schema change re-creates a table.
alter table public.profiles enable row level security;
alter table public.analysis_reports enable row level security;
alter table public.training_progress enable row level security;
