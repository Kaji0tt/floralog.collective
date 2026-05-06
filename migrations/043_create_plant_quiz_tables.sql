-- Plant quiz lifecycle tables (scheduler-driven)

create table if not exists public."PlantQuiz" (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null references auth.users(id) on delete cascade,
  source_discovery_id text not null references public."UserPlantDiscovery"(id) on delete cascade,
  correct_plant_id text not null references public."Plant"(id) on delete restrict,
  option_plant_ids jsonb not null,
  status text not null default 'open' check (status in ('open', 'resolved', 'expired')),
  wrong_attempts integer not null default 0 check (wrong_attempts >= 0 and wrong_attempts <= 3),
  max_attempts integer not null default 3 check (max_attempts = 3),
  scheduled_slot_date date not null,
  scheduled_slot_type text not null check (scheduled_slot_type in ('midday', 'evening')),
  scheduled_at timestamptz not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  reward_seeds integer,
  reward_data_quality integer,
  notification_sent_at timestamptz,
  constraint plant_quiz_option_array check (jsonb_typeof(option_plant_ids) = 'array' and jsonb_array_length(option_plant_ids) = 3)
);

create unique index if not exists idx_plant_quiz_one_open_per_user
  on public."PlantQuiz" (auth_id)
  where status = 'open';

create index if not exists idx_plant_quiz_auth_created
  on public."PlantQuiz" (auth_id, created_at desc);

create index if not exists idx_plant_quiz_slot
  on public."PlantQuiz" (scheduled_slot_date, scheduled_slot_type);

create table if not exists public."PlantQuizSlotRoll" (
  id uuid primary key default gen_random_uuid(),
  slot_date date not null,
  slot_type text not null check (slot_type in ('midday', 'evening')),
  run_key text not null unique,
  random_minute integer not null check (random_minute >= 0 and random_minute <= 59),
  scheduled_at timestamptz not null,
  executed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_plant_quiz_slot_roll_unique_slot
  on public."PlantQuizSlotRoll" (slot_date, slot_type);

create table if not exists public."PlantQuizExcludedDiscovery" (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null references auth.users(id) on delete cascade,
  discovery_id text not null references public."UserPlantDiscovery"(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (auth_id, discovery_id)
);

create index if not exists idx_plant_quiz_excluded_auth
  on public."PlantQuizExcludedDiscovery" (auth_id, created_at desc);

alter table public."PlantQuiz" enable row level security;
alter table public."PlantQuizSlotRoll" enable row level security;
alter table public."PlantQuizExcludedDiscovery" enable row level security;

drop policy if exists "plant_quiz_select_own" on public."PlantQuiz";
create policy "plant_quiz_select_own"
  on public."PlantQuiz"
  for select to authenticated
  using (auth.uid() = auth_id);

drop policy if exists "plant_quiz_excluded_select_own" on public."PlantQuizExcludedDiscovery";
create policy "plant_quiz_excluded_select_own"
  on public."PlantQuizExcludedDiscovery"
  for select to authenticated
  using (auth.uid() = auth_id);

-- Slot roll table is backend-internal only (service role), no authenticated policies.

create or replace function public.set_plant_quiz_slot_roll_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_plant_quiz_slot_roll_updated_at on public."PlantQuizSlotRoll";
create trigger trg_plant_quiz_slot_roll_updated_at
before update on public."PlantQuizSlotRoll"
for each row execute function public.set_plant_quiz_slot_roll_updated_at();
