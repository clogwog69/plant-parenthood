-- Plant Parenthood: let the helper on the home computer answer photo
-- questions from every household, not just its own.
-- Run this once in Supabase > SQL Editor. Safe to run again.
--
-- The helper proves who it is with a secret that never leaves the home
-- computer (helper/config.json). Only a fingerprint of that secret is stored
-- here. Replace HELPER_FINGERPRINT below with the one the helper prints
-- when you run:  node helper/helper.mjs fingerprint

create table if not exists sprout_helper (
  id int primary key default 1 check (id = 1),
  token_hash text not null,
  seen timestamptz
);
alter table sprout_helper enable row level security;

insert into sprout_helper (id, token_hash) values (1, 'HELPER_FINGERPRINT')
on conflict (id) do update set token_hash = excluded.token_hash;

create or replace function sprout_helper_ok(p_token text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from sprout_helper
    where id = 1 and token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'utf8')), 'hex')
  );
$$;

-- "Is anybody there to look at my photo?" now counts the all-households helper too.
create or replace function sprout_answer(p_code text, p_id uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'status', r.status,
    'result', r.result,
    'helper', coalesce(h.helper_seen > now() - interval '45 seconds', false)
           or coalesce((select seen > now() - interval '45 seconds' from sprout_helper where id = 1), false)
  )
  from sprout_requests r join sprout_households h on h.id = r.household_id
  where r.id = p_id and r.household_id = sprout_house(p_code);
$$;

-- The helper asks for the next job from any household.
create or replace function sprout_work_claim_any(p_token text) returns json
language plpgsql security definer set search_path = public as $$
declare r sprout_requests;
begin
  if not sprout_helper_ok(p_token) then raise exception 'not the helper'; end if;
  update sprout_helper set seen = now() where id = 1;
  select * into r from sprout_requests
  where created_at > now() - interval '10 minutes'
    and (status = 'pending' or (status = 'working' and claimed_at < now() - interval '3 minutes'))
  order by created_at
  limit 1
  for update skip locked;
  if not found then return null; end if;
  update sprout_requests set status = 'working', claimed_at = now() where id = r.id;
  return json_build_object('id', r.id, 'kind', r.kind, 'input', r.input, 'photo', r.photo);
end $$;

create or replace function sprout_work_done_any(p_token text, p_id uuid, p_result jsonb, p_ok boolean) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not sprout_helper_ok(p_token) then raise exception 'not the helper'; end if;
  if length(coalesce(p_result, '{}'::jsonb)::text) > 20000 then return false; end if;
  update sprout_requests
  set status = case when p_ok then 'done' else 'failed' end, result = p_result, photo = null
  where id = p_id and status = 'working';
  return found;
end $$;

revoke execute on function sprout_helper_ok(text) from public, anon, authenticated;
grant execute on function sprout_answer(text, uuid), sprout_work_claim_any(text),
  sprout_work_done_any(text, uuid, jsonb, boolean) to anon, authenticated;
