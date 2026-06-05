-- HRMS database schema for Supabase/PostgreSQL.
-- This snapshot includes the tables used by the frontend and backend.

create table if not exists departments (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key,
  email text not null unique,
  role text not null check (role in ('hr', 'candidate', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists candidates (
  id uuid primary key,
  name text not null,
  email text not null unique,
  phone text,
  address text,
  date_of_birth date,
  designation text,
  reporting_manager text,
  department_id text references departments(id),
  type text,
  photo_url text,
  offer_letter_url text,
  joining_date date,
  salary numeric,
  status text not null default 'draft',
  onboarding_status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists employees (
  id uuid primary key,
  name text not null,
  email text not null unique,
  phone text,
  address text,
  date_of_birth date,
  designation text,
  reporting_manager text,
  employment_type text,
  department_id text references departments(id),
  joining_date date,
  salary numeric,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists onboarding_tasks (
  id bigserial primary key,
  employee_id uuid not null,
  document_submitted boolean not null default false,
  hr_verification boolean not null default false,
  asset_assigned boolean not null default false,
  offer_accepted boolean not null default false,
  induction boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_onboarding_tasks_employee_id on onboarding_tasks(employee_id);

create table if not exists documents (
  id bigserial primary key,
  employee_id uuid not null,
  document_type text not null,
  file_url text not null,
  uploaded_at timestamptz not null default now(),
  status text not null default 'pending',
  reason text,
  verified_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_documents_employee_document_type on documents(employee_id, document_type);
create index if not exists idx_documents_employee_id on documents(employee_id);

create table if not exists bg_verification (
  id bigserial primary key,
  employee_id uuid not null,
  company_name text,
  reference_person_name text,
  reference_person_email text,
  reference_person_phone text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_bg_verification_employee_id on bg_verification(employee_id);

create table if not exists it_asset_details (
  id bigserial primary key,
  employee_id uuid not null,
  device_name text,
  serial_number text,
  device_photo_url text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_it_asset_details_employee_id on it_asset_details(employee_id);

create table if not exists induction_details (
  id bigserial primary key,
  employee_id uuid not null,
  hr_orientation boolean not null default false,
  team_introduction boolean not null default false,
  system_setup boolean not null default false,
  policy_training boolean not null default false,
  security_briefing boolean not null default false,
  manager_connect boolean not null default false,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_induction_details_employee_id on induction_details(employee_id);

create table if not exists probation_details (
  id bigserial primary key,
  employee_id uuid not null,
  status text,
  start_date date,
  end_date date,
  duration_days integer,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_probation_details_employee_id on probation_details(employee_id);
