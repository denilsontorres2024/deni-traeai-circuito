create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key,
  email text unique,
  full_name text,
  avatar_url text,
  job_title text,
  goal text,
  timezone text not null default 'UTC',
  discomfort_areas text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.connected_apps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  provider text not null check (
    provider in (
      'google_calendar',
      'gmail',
      'slack',
      'telegram',
      'google_sheets',
      'notion',
      'airtable',
      'twilio'
    )
  ),
  status text not null default 'disconnected' check (
    status in ('disconnected', 'connecting', 'connected', 'error')
  ),
  account_label text,
  external_account_id text,
  scopes text[] not null default '{}',
  last_synced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table if not exists public.posture_analysis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  input_mode text not null check (input_mode in ('webcam', 'image', 'video')),
  score integer not null check (score between 0 and 100),
  risk_level text not null check (risk_level in ('low', 'medium', 'high')),
  confidence numeric(5, 2) not null check (confidence between 0 and 100),
  summary text not null,
  diagnosis text not null,
  detected_issues text[] not null default '{}',
  recommendations text[] not null default '{}',
  exercises text[] not null default '{}',
  daily_plan text[] not null default '{}',
  metrics jsonb not null default '[]'::jsonb,
  landmarks jsonb not null default '[]'::jsonb,
  media_url text,
  raw_ai_response jsonb,
  analyzed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calendar_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  insight_date date not null default current_date,
  long_meetings integer not null default 0,
  consecutive_meetings integer not null default 0,
  seated_minutes integer not null default 0,
  free_minutes integer not null default 0,
  summary text not null,
  raw_calendar jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, insight_date)
);

create table if not exists public.daily_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  posture_analysis_id uuid,
  plan_date date not null default current_date,
  title text not null,
  summary text not null,
  priority text not null default 'medium',
  blocks jsonb not null default '[]'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  trigger_type text not null check (
    trigger_type in (
      'after_analysis',
      'daily_plan',
      'before_meeting',
      'after_meeting',
      'low_score_alert',
      'weekly_summary',
      'monthly_summary'
    )
  ),
  is_enabled boolean not null default true,
  priority integer not null default 1,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, trigger_type)
);

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  automation_rule_id uuid,
  trigger_type text not null,
  status text not null check (status in ('pending', 'running', 'completed', 'failed')),
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  channel text not null check (channel in ('gmail', 'slack', 'telegram', 'whatsapp')),
  status text not null default 'queued' check (status in ('queued', 'sent', 'delivered', 'failed')),
  subject text,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.exercise_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  daily_plan_id uuid,
  exercise_name text not null,
  duration_minutes integer not null default 0,
  source text not null,
  completed_at timestamptz not null default now(),
  notes text
);

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  reminder_channel_priority text[] not null default '{gmail,slack,telegram,whatsapp}',
  workday_start text,
  workday_end text,
  preferred_break_minutes integer not null default 5,
  seated_alert_minutes integer not null default 50,
  openai_goal text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_connected_apps_user_status on public.connected_apps (user_id, status);
create index if not exists idx_posture_analysis_user_date on public.posture_analysis (user_id, analyzed_at desc);
create index if not exists idx_daily_plans_user_date on public.daily_plans (user_id, plan_date desc);
create index if not exists idx_automation_runs_user_date on public.automation_runs (user_id, created_at desc);
create index if not exists idx_notifications_user_status on public.notifications (user_id, status, created_at desc);
create index if not exists idx_exercise_history_user_date on public.exercise_history (user_id, completed_at desc);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_connected_apps_updated_at on public.connected_apps;
create trigger set_connected_apps_updated_at before update on public.connected_apps
for each row execute function public.set_updated_at();

drop trigger if exists set_posture_analysis_updated_at on public.posture_analysis;
create trigger set_posture_analysis_updated_at before update on public.posture_analysis
for each row execute function public.set_updated_at();

drop trigger if exists set_calendar_insights_updated_at on public.calendar_insights;
create trigger set_calendar_insights_updated_at before update on public.calendar_insights
for each row execute function public.set_updated_at();

drop trigger if exists set_daily_plans_updated_at on public.daily_plans;
create trigger set_daily_plans_updated_at before update on public.daily_plans
for each row execute function public.set_updated_at();

drop trigger if exists set_automation_rules_updated_at on public.automation_rules;
create trigger set_automation_rules_updated_at before update on public.automation_rules
for each row execute function public.set_updated_at();

drop trigger if exists set_user_preferences_updated_at on public.user_preferences;
create trigger set_user_preferences_updated_at before update on public.user_preferences
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.connected_apps enable row level security;
alter table public.posture_analysis enable row level security;
alter table public.calendar_insights enable row level security;
alter table public.daily_plans enable row level security;
alter table public.automation_rules enable row level security;
alter table public.automation_runs enable row level security;
alter table public.notifications enable row level security;
alter table public.exercise_history enable row level security;
alter table public.user_preferences enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.profiles to authenticated;
grant all on public.profiles to authenticated;
grant all on public.connected_apps to authenticated;
grant all on public.posture_analysis to authenticated;
grant all on public.calendar_insights to authenticated;
grant all on public.daily_plans to authenticated;
grant all on public.automation_rules to authenticated;
grant all on public.automation_runs to authenticated;
grant all on public.notifications to authenticated;
grant all on public.exercise_history to authenticated;
grant all on public.user_preferences to authenticated;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
for insert to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own" on public.profiles
for delete to authenticated
using (auth.uid() = id);

drop policy if exists "connected_apps_all_own" on public.connected_apps;
create policy "connected_apps_all_own" on public.connected_apps
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "posture_analysis_all_own" on public.posture_analysis;
create policy "posture_analysis_all_own" on public.posture_analysis
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "calendar_insights_all_own" on public.calendar_insights;
create policy "calendar_insights_all_own" on public.calendar_insights
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "daily_plans_all_own" on public.daily_plans;
create policy "daily_plans_all_own" on public.daily_plans
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "automation_rules_all_own" on public.automation_rules;
create policy "automation_rules_all_own" on public.automation_rules
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "automation_runs_all_own" on public.automation_runs;
create policy "automation_runs_all_own" on public.automation_runs
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "notifications_all_own" on public.notifications;
create policy "notifications_all_own" on public.notifications
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "exercise_history_all_own" on public.exercise_history;
create policy "exercise_history_all_own" on public.exercise_history
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "user_preferences_all_own" on public.user_preferences;
create policy "user_preferences_all_own" on public.user_preferences
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
