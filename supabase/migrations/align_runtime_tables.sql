alter table public.profiles
  add column if not exists provider text default 'email',
  add column if not exists onboarding_completed boolean not null default false;

create table if not exists public.posture_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  source_type text not null default 'webcam',
  status text not null default 'bom',
  score integer,
  context_text text not null default '',
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  app_name text not null,
  connection_id text,
  status text not null default 'disconnected',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, app_name)
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  channel text not null,
  status text not null default 'queued',
  title text,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.composio_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  app_name text not null,
  auth_config_id text,
  connection_id text not null,
  status text not null default 'initiated',
  redirect_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, app_name),
  unique (connection_id)
);

alter table public.posture_analysis
  add column if not exists posture_session_id uuid,
  add column if not exists source_type text,
  add column if not exists status text,
  add column if not exists context_text text not null default '';

update public.posture_analysis
set
  source_type = coalesce(source_type, input_mode),
  status = coalesce(
    status,
    case
      when risk_level = 'high' then 'risco'
      when risk_level = 'medium' then 'atencao'
      else 'bom'
    end
  )
where source_type is null
   or status is null;

create index if not exists idx_posture_sessions_user_date on public.posture_sessions (user_id, captured_at desc);
create index if not exists idx_integrations_user_app on public.integrations (user_id, app_name);
create index if not exists idx_reminders_user_date on public.reminders (user_id, created_at desc);
create index if not exists idx_composio_connections_user_app on public.composio_connections (user_id, app_name);

drop trigger if exists set_posture_sessions_updated_at on public.posture_sessions;
create trigger set_posture_sessions_updated_at before update on public.posture_sessions
for each row execute function public.set_updated_at();

drop trigger if exists set_integrations_updated_at on public.integrations;
create trigger set_integrations_updated_at before update on public.integrations
for each row execute function public.set_updated_at();

drop trigger if exists set_reminders_updated_at on public.reminders;
create trigger set_reminders_updated_at before update on public.reminders
for each row execute function public.set_updated_at();

drop trigger if exists set_composio_connections_updated_at on public.composio_connections;
create trigger set_composio_connections_updated_at before update on public.composio_connections
for each row execute function public.set_updated_at();

alter table public.posture_sessions enable row level security;
alter table public.integrations enable row level security;
alter table public.reminders enable row level security;
alter table public.composio_connections enable row level security;

grant all on public.posture_sessions to authenticated;
grant all on public.integrations to authenticated;
grant all on public.reminders to authenticated;
grant all on public.composio_connections to authenticated;

drop policy if exists "posture_sessions_all_own" on public.posture_sessions;
create policy "posture_sessions_all_own" on public.posture_sessions
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "integrations_all_own" on public.integrations;
create policy "integrations_all_own" on public.integrations
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "reminders_all_own" on public.reminders;
create policy "reminders_all_own" on public.reminders
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "composio_connections_all_own" on public.composio_connections;
create policy "composio_connections_all_own" on public.composio_connections
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
