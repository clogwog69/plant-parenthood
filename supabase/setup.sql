-- Sprout shared households.
-- Tables are locked (row level security on, no policies). The app can only
-- reach them through the functions below, and every function needs the
-- household's invite code.

create table if not exists sprout_households (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  location jsonb,
  created_at timestamptz not null default now()
);

create table if not exists sprout_plants (
  household_id uuid not null references sprout_households (id) on delete cascade,
  id text not null,
  data jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (household_id, id)
);
create index if not exists sprout_plants_changed on sprout_plants (household_id, updated_at);

create table if not exists sprout_photos (
  household_id uuid not null references sprout_households (id) on delete cascade,
  id text not null,
  plant_id text not null,
  data text not null,
  created_at timestamptz not null default now(),
  primary key (household_id, id)
);

alter table sprout_households enable row level security;
alter table sprout_plants enable row level security;
alter table sprout_photos enable row level security;

create or replace function sprout_house(p_code text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from sprout_households where code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

create or replace function sprout_create(p_name text) returns json
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  loop
    c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    begin
      insert into sprout_households (code, name) values (c, left(coalesce(nullif(trim(p_name), ''), 'Home'), 60));
      exit;
    exception when unique_violation then null;
    end;
  end loop;
  return json_build_object('code', c, 'name', (select name from sprout_households where code = c));
end $$;

create or replace function sprout_join(p_code text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('code', code, 'name', name) from sprout_households where id = sprout_house(p_code);
$$;

create or replace function sprout_pull(p_code text, p_since timestamptz) returns json
language plpgsql security definer set search_path = public as $$
declare h uuid := sprout_house(p_code); t timestamptz := clock_timestamp();
begin
  if h is null then return null; end if;
  return json_build_object(
    'now', t,
    'location', (select location from sprout_households where id = h),
    'plants', coalesce((
      select json_agg(json_build_object('id', id, 'data', data, 'deleted', deleted))
      from sprout_plants
      where household_id = h
        and (p_since is null and not deleted or updated_at > p_since - interval '10 seconds')
    ), '[]'::json)
  );
end $$;

create or replace function sprout_push(p_code text, p_plants jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
declare h uuid := sprout_house(p_code); r jsonb;
begin
  if h is null then return false; end if;
  for r in select * from jsonb_array_elements(p_plants) loop
    insert into sprout_plants (household_id, id, data, deleted, updated_at)
    values (h, r->>'id', case when (r->>'deleted')::boolean then null else r->'data' end, coalesce((r->>'deleted')::boolean, false), clock_timestamp())
    on conflict (household_id, id) do update
      set data = excluded.data, deleted = excluded.deleted, updated_at = excluded.updated_at
      where not sprout_plants.deleted;
    if (r->>'deleted')::boolean then
      delete from sprout_photos where household_id = h and plant_id = r->>'id';
    end if;
  end loop;
  return true;
end $$;

create or replace function sprout_set_location(p_code text, p_location jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
declare h uuid := sprout_house(p_code);
begin
  if h is null then return false; end if;
  update sprout_households set location = p_location where id = h;
  return true;
end $$;

create or replace function sprout_put_photo(p_code text, p_id text, p_plant text, p_data text) returns boolean
language plpgsql security definer set search_path = public as $$
declare h uuid := sprout_house(p_code);
begin
  if h is null or length(p_data) > 3000000 then return false; end if;
  insert into sprout_photos (household_id, id, plant_id, data) values (h, p_id, p_plant, p_data)
  on conflict (household_id, id) do nothing;
  return true;
end $$;

create or replace function sprout_get_photo(p_code text, p_id text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('plantId', plant_id, 'date', (extract(epoch from created_at) * 1000)::bigint, 'dataUrl', data)
  from sprout_photos where household_id = sprout_house(p_code) and id = p_id;
$$;

revoke all on function sprout_house(text) from public, anon, authenticated;
grant execute on function sprout_create(text), sprout_join(text), sprout_pull(text, timestamptz),
  sprout_push(text, jsonb), sprout_set_location(text, jsonb),
  sprout_put_photo(text, text, text, text), sprout_get_photo(text, text) to anon, authenticated;
