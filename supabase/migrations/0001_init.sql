-- Tricycle Booking App — initial schema draft (spec section 6)
-- NOT yet connected to a live Supabase project. Phase 1 runs on in-app mock
-- data; this migration exists so the Ride / RideLocationLog / safety tables
-- are designed up front, since retrofitting tracking later is harder than
-- planning for it now.

create extension if not exists "pgcrypto";

create type user_role as enum ('passenger', 'driver', 'parent', 'admin');
create type ride_status as enum (
  'requested', 'accepted', 'driver_arriving', 'ongoing',
  'completed', 'declined', 'cancelled'
);
create type payment_method as enum ('cash', 'gcash', 'maya', 'card');
create type payment_status as enum ('pending', 'paid', 'failed', 'refunded');
create type verification_status as enum ('pending', 'approved', 'rejected');
create type sos_status as enum ('open', 'acknowledged', 'resolved');

create table app_user (
  id uuid primary key default gen_random_uuid(),
  role user_role not null,
  name text not null,
  phone text unique not null,
  email text,
  photo_url text,
  created_at timestamptz not null default now()
);

create table driver_profile (
  user_id uuid primary key references app_user(id) on delete cascade,
  tricycle_plate text not null,
  license_no text not null,
  verification_status verification_status not null default 'pending',
  documents jsonb not null default '[]',
  rating_avg numeric(3,2) not null default 0,
  online boolean not null default false
);

create table parent_link (
  id uuid primary key default gen_random_uuid(),
  parent_user_id uuid not null references app_user(id) on delete cascade,
  student_user_id uuid not null references app_user(id) on delete cascade,
  relationship text not null,
  trusted_routes jsonb not null default '[]',
  created_at timestamptz not null default now(),
  unique (parent_user_id, student_user_id)
);

create table ride (
  id uuid primary key default gen_random_uuid(),
  passenger_id uuid not null references app_user(id),
  driver_id uuid references app_user(id),
  pickup_label text not null,
  pickup_lat double precision,
  pickup_lng double precision,
  dropoff_label text not null,
  dropoff_lat double precision,
  dropoff_lng double precision,
  status ride_status not null default 'requested',
  fare numeric(10,2) not null,
  payment_method payment_method,
  is_student_ride boolean not null default false,
  requested_at timestamptz not null default now(),
  accepted_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz
);

create index ride_passenger_idx on ride(passenger_id);
create index ride_driver_idx on ride(driver_id);
create index ride_status_idx on ride(status);

create table ride_location_log (
  id bigint generated always as identity primary key,
  ride_id uuid not null references ride(id) on delete cascade,
  ts timestamptz not null default now(),
  lat double precision not null,
  lng double precision not null
);

create index ride_location_log_ride_idx on ride_location_log(ride_id, ts);

create table payment (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references ride(id) on delete cascade,
  amount numeric(10,2) not null,
  method payment_method not null,
  status payment_status not null default 'pending',
  reference_no text,
  created_at timestamptz not null default now()
);

create table rating (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references ride(id) on delete cascade,
  from_user_id uuid not null references app_user(id),
  to_user_id uuid not null references app_user(id),
  score smallint not null check (score between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create table sos_alert (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references ride(id) on delete cascade,
  triggered_by uuid not null references app_user(id),
  status sos_status not null default 'open',
  notes text,
  created_at timestamptz not null default now()
);
