-- Plant Parenthood: photo help, morning list and notifications.
-- Run this once in Supabase > SQL Editor. Safe to run again.

alter table sprout_households add column if not exists digest jsonb;
alter table sprout_households add column if not exists helper_seen timestamptz;

-- Questions waiting for the helper on the home computer.
create table if not exists sprout_requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references sprout_households (id) on delete cascade,
  kind text not null,
  input jsonb not null default '{}'::jsonb,
  photo text,
  status text not null default 'pending',
  result jsonb,
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);
create index if not exists sprout_requests_queue on sprout_requests (household_id, status, created_at);

-- Phones that asked for notifications.
create table if not exists sprout_push_subs (
  endpoint text primary key,
  household_id uuid not null references sprout_households (id) on delete cascade,
  name text,
  sub jsonb not null,
  tz text,
  last_digest text,
  created_at timestamptz not null default now()
);

-- The notification signing keys. Made by the "push" function on first use.
create table if not exists sprout_secrets (
  name text primary key,
  value jsonb not null
);

alter table sprout_requests enable row level security;
alter table sprout_push_subs enable row level security;
alter table sprout_secrets enable row level security;

create or replace function sprout_set_digest(p_code text, p_digest jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
declare h uuid := sprout_house(p_code);
begin
  if h is null or length(p_digest::text) > 20000 then return false; end if;
  update sprout_households set digest = p_digest where id = h;
  return true;
end $$;

create or replace function sprout_ask(p_code text, p_kind text, p_input jsonb, p_photo text) returns uuid
language plpgsql security definer set search_path = public as $$
declare h uuid := sprout_house(p_code); r uuid;
begin
  if h is null or p_kind not in ('identify', 'tag', 'diagnose', 'ask') then return null; end if;
  if length(coalesce(p_photo, '')) > 3000000 or length(coalesce(p_input, '{}'::jsonb)::text) > 8000 then return null; end if;
  delete from sprout_requests where created_at < now() - interval '1 day';
  if (select count(*) from sprout_requests where household_id = h and status in ('pending', 'working') and created_at > now() - interval '10 minutes') >= 6 then
    return null;
  end if;
  insert into sprout_requests (household_id, kind, input, photo)
  values (h, p_kind, coalesce(p_input, '{}'::jsonb), p_photo) returning id into r;
  return r;
end $$;

create or replace function sprout_answer(p_code text, p_id uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'status', r.status,
    'result', r.result,
    'helper', coalesce(h.helper_seen > now() - interval '45 seconds', false)
  )
  from sprout_requests r join sprout_households h on h.id = r.household_id
  where r.id = p_id and r.household_id = sprout_house(p_code);
$$;

-- The helper asks for the next job. Also marks the helper as "here".
create or replace function sprout_work_claim(p_code text) returns json
language plpgsql security definer set search_path = public as $$
declare h uuid := sprout_house(p_code); r sprout_requests;
begin
  if h is null then return null; end if;
  update sprout_households set helper_seen = now() where id = h;
  select * into r from sprout_requests
  where household_id = h
    and created_at > now() - interval '10 minutes'
    and (status = 'pending' or (status = 'working' and claimed_at < now() - interval '3 minutes'))
  order by created_at
  limit 1
  for update skip locked;
  if not found then return null; end if;
  update sprout_requests set status = 'working', claimed_at = now() where id = r.id;
  return json_build_object('id', r.id, 'kind', r.kind, 'input', r.input, 'photo', r.photo);
end $$;

create or replace function sprout_work_done(p_code text, p_id uuid, p_result jsonb, p_ok boolean) returns boolean
language plpgsql security definer set search_path = public as $$
declare h uuid := sprout_house(p_code);
begin
  if h is null or length(coalesce(p_result, '{}'::jsonb)::text) > 20000 then return false; end if;
  update sprout_requests
  set status = case when p_ok then 'done' else 'failed' end, result = p_result, photo = null
  where id = p_id and household_id = h and status = 'working';
  return found;
end $$;

grant execute on function sprout_set_digest(text, jsonb), sprout_ask(text, text, jsonb, text),
  sprout_answer(text, uuid), sprout_work_claim(text), sprout_work_done(text, uuid, jsonb, boolean) to anon, authenticated;
grant execute on function sprout_house(text) to service_role;
