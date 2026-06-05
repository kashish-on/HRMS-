-- Seed data for HRMS lookup tables.

insert into departments (id, name)
values
  ('hr', 'Human Resources'),
  ('it', 'Information Technology'),
  ('finance', 'Finance'),
  ('marketing', 'Marketing'),
  ('sales', 'Sales'),
  ('operations', 'Operations')
on conflict (id) do nothing;
