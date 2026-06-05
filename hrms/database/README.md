# Database Files

This folder stores database artifacts for the HRMS project.

Files included here:

- `schema.sql` — table definitions matching the frontend/backend app model
- `seed.sql` — default lookup data for initial setup

## Applying the schema

If you are using Supabase, you can apply this schema using:

```bash
supabase db push
```

Or directly via `psql`:

```bash
psql <database_url> -f database/schema.sql
psql <database_url> -f database/seed.sql
```

## Notes

- `profiles` is the app-level user role table linked to Supabase auth users
- `candidates`, `onboarding_tasks`, `documents`, `bg_verification`, `it_asset_details`, `induction_details`, and `probation_details` reflect the current HR onboarding workflow
- `departments` contains department lookup values used by the onboarding form
