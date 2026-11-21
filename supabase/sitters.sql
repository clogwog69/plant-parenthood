-- Plant Parenthood: Plant sitters. A private link that lets someone mind the
-- plants while you are away: they see the watering plan between two dates,
-- and can tick plants off as watered. Nothing else in the household.
-- Run this once in Supabase > SQL Editor. Safe to run again.

create table if not exists sprout_sitters (
  token text primary key default replace(gen_random_uuid()::text, '-', ''),
  household_id uuid not null references sprout_households(id) on delete cascade,
  name text not null,
  email text,
  starts date not null,
  ends date not null,
  created_at timestamptz not null default now()
);
create index if not exists sprout_sitters_house on sprout_sitters (household_id);
alter table sprout_sitters enable row level security;

create or replace function sprout_add_sitter(p_code text, p_name text, p_email text, p_starts date, p_ends date) returns text
language plpgsql security definer set search_path = public as $$
declare h uuid := sprout_house(p_code); t text;
begin
  if h is null or coalesce(trim(p_name), '') = '' or p_ends < p_starts then return null; end if;
  insert into sprout_sitters (household_id, name, email, starts, ends)
  values (h, left(trim(p_name), 40), nullif(left(trim(coalesce(p_email, '')), 120), ''), p_starts, p_ends)
  returning token into t;
  return t;
end $$;

create or replace function sprout_list_sitters(p_code text) returns json
language plpgsql security definer set search_path = public as $$
declare h uuid := sprout_house(p_code);
begin
  if h is null then return '[]'::json; end if;
  return coalesce((
    select json_agg(json_build_object('token', token, 'name', name, 'email', email, 'starts', starts, 'ends', ends) order by starts)
    from sprout_sitters where household_id = h and ends >= current_date - 7
  ), '[]'::json);
end $$;

create or replace function sprout_remove_sitter(p_code text, p_token text) returns boolean
language plpgsql security definer set search_path = public as $$
declare h uuid := sprout_house(p_code);
begin
  delete from sprout_sitters where household_id = h and token = p_token;
  return found;
end $$;

-- The link stops working the day after the sit ends.
create or replace function sprout_sitter(p_token text) returns sprout_sitters
language sql security definer set search_path = public as $$
  select * from sprout_sitters where token = p_token and ends >= current_date - 1;
$$;

create or replace function sprout_sit_pull(p_token text) returns json
language plpgsql security definer set search_path = public as $$
declare s sprout_sitters := sprout_sitter(p_token);
begin
  if s.token is null then return null; end if;
  return json_build_object(
    'name', s.name, 'starts', s.starts, 'ends', s.ends,
    'house', (select name from sprout_households where id = s.household_id),
    'location', (select location from sprout_households where id = s.household_id),
    'plants', coalesce((
      select json_agg(data) from sprout_plants
      where household_id = s.household_id and not deleted and data is not null
    ), '[]'::json)
  );
end $$;

-- Marks a plant watered, by the sitter. The household's phones pick it up on their next sync.
create or replace function sprout_sit_water(p_token text, p_plant text) returns json
language plpgsql security definer set search_path = public as $$
declare s sprout_sitters := sprout_sitter(p_token); ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint; d jsonb;
begin
  if s.token is null then return null; end if;
  update sprout_plants set
    data = (data - 'holdWaterUntil')
      || jsonb_build_object(
        'lastWatered', ms,
        'updatedAt', ms,
        'todos', coalesce((select jsonb_agg(t) from jsonb_array_elements(data->'todos') t where t->>'kind' <> 'water'), '[]'::jsonb),
        'events', jsonb_build_array(jsonb_build_object('type', 'watered', 'date', ms, 'by', s.name || ' (sitter)')) || coalesce(data->'events', '[]'::jsonb)
      ),
    updated_at = clock_timestamp()
  where household_id = s.household_id and id = p_plant and not deleted
  returning data into d;
  return d;
end $$;

revoke all on table sprout_sitters from anon, authenticated;
grant execute on function sprout_add_sitter(text, text, text, date, date) to anon;
grant execute on function sprout_list_sitters(text) to anon;
grant execute on function sprout_remove_sitter(text, text) to anon;
grant execute on function sprout_sit_pull(text) to anon;
grant execute on function sprout_sit_water(text, text) to anon;
revoke execute on function sprout_sitter(text) from anon, public;
