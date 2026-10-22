-- =========================================================
-- M&N Foods — schema
-- Plakken in Supabase → SQL Editor → Run (één keer)
-- =========================================================

-- ---------- Tabellen ----------

create table if not exists cities (
  id          text primary key,              -- 'gent', 'kortrijk'
  name        text not null,
  center_lat  double precision,
  center_lng  double precision,
  sort_order  int default 0
);

create table if not exists categories (
  id          serial primary key,
  name        text unique not null,
  sort_order  int default 0
);

create table if not exists people (
  id     text primary key check (id in ('noah', 'marie')),
  name   text not null,
  color  text
);

create table if not exists restaurants (
  id               uuid primary key default gen_random_uuid(),
  city_id          text not null references cities on delete restrict,
  name             text not null,
  cuisine_note     text,                     -- 'Thais', 'ribbetjes', ...
  address          text,
  lat              double precision,
  lng              double precision,
  google_place_id  text unique,
  google_maps_url  text,
  price_level      smallint check (price_level between 1 and 3),
  website          text,
  phone            text,
  opening_hours    jsonb,                    -- weekdagen uit Google Places
  hours_updated_at timestamptz,
  needs_review     boolean default false,    -- twijfelgeval bij import
  created_at       timestamptz default now()
);

create table if not exists restaurant_categories (
  restaurant_id uuid references restaurants on delete cascade,
  category_id   int  references categories  on delete cascade,
  primary key (restaurant_id, category_id)
);

-- Eén rij per persoon per restaurant. Rij bestaat = geweest. Score is optioneel.
create table if not exists visits (
  restaurant_id uuid references restaurants on delete cascade,
  person_id     text references people on delete cascade,
  score         smallint check (score between 1 and 10),
  comment       text,
  visited_on    date,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  primary key (restaurant_id, person_id)
);

create table if not exists photos (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants on delete cascade,
  person_id     text references people,
  storage_path  text not null,               -- pad in bucket 'photos'
  created_at    timestamptz default now()
);

create index if not exists restaurants_city_idx on restaurants (city_id);
create index if not exists photos_restaurant_idx on photos (restaurant_id);

-- ---------- Overzichtsview voor de app ----------

create or replace view restaurant_overview
with (security_invoker = true) as
select
  r.*,
  (vn.restaurant_id is not null) as noah_visited,
  vn.score                       as noah_score,
  vn.comment                     as noah_comment,
  vn.visited_on                  as noah_visited_on,
  (vm.restaurant_id is not null) as marie_visited,
  vm.score                       as marie_score,
  vm.comment                     as marie_comment,
  vm.visited_on                  as marie_visited_on,
  case
    when vn.restaurant_id is not null and vm.restaurant_id is not null then 'samen'
    when vn.restaurant_id is not null then 'noah'
    when vm.restaurant_id is not null then 'marie'
    else 'nog_niet'
  end as status,
  round(
    (coalesce(vn.score, 0) + coalesce(vm.score, 0))::numeric
    / nullif((vn.score is not null)::int + (vm.score is not null)::int, 0)
  , 1) as avg_score,
  coalesce(array(
    select c.name
    from restaurant_categories rc
    join categories c on c.id = rc.category_id
    where rc.restaurant_id = r.id
    order by c.sort_order
  ), '{}') as categories
from restaurants r
left join visits vn on vn.restaurant_id = r.id and vn.person_id = 'noah'
left join visits vm on vm.restaurant_id = r.id and vm.person_id = 'marie';

-- ---------- Toegang (geen login: publishable/anon key mag alles) ----------

alter table cities                enable row level security;
alter table categories            enable row level security;
alter table people                enable row level security;
alter table restaurants           enable row level security;
alter table restaurant_categories enable row level security;
alter table visits                enable row level security;
alter table photos                enable row level security;

do $$
declare t text;
begin
  foreach t in array array['cities','categories','people','restaurants',
                           'restaurant_categories','visits','photos'] loop
    execute format('drop policy if exists "open_all" on %I', t);
    execute format(
      'create policy "open_all" on %I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

grant select on restaurant_overview to anon, authenticated;

-- ---------- Foto's (Storage) ----------

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

drop policy if exists "photos_read"   on storage.objects;
drop policy if exists "photos_write"  on storage.objects;
drop policy if exists "photos_delete" on storage.objects;

create policy "photos_read"   on storage.objects for select to anon, authenticated using (bucket_id = 'photos');
create policy "photos_write"  on storage.objects for insert to anon, authenticated with check (bucket_id = 'photos');
create policy "photos_delete" on storage.objects for delete to anon, authenticated using (bucket_id = 'photos');

-- ---------- Realtime ----------

alter publication supabase_realtime add table restaurants, restaurant_categories, visits, photos;

-- ---------- Vaste data ----------

insert into people (id, name, color) values
  ('noah',  'Noah',  '#2563eb'),
  ('marie', 'Marie', '#db2777')
on conflict (id) do nothing;

insert into cities (id, name, center_lat, center_lng, sort_order) values
  ('gent',     'Gent',     51.0543, 3.7174, 1),
  ('kortrijk', 'Kortrijk', 50.8280, 3.2649, 2)
on conflict (id) do nothing;
