# HRMS Repository Structure

This repository is now organized into separate areas so the frontend, backend, and database-related work can grow independently without changing the current frontend behavior.

## Folders

- `frontend/` - Existing Vite + React application and all current working code
- `backend/` - Placeholder for future API/server code for Render deployment
- `database/` - Supabase SQL, schema notes, and migration-related files

## Current Status

The project currently works as a frontend app that connects directly to Supabase.
There is no standalone backend service in this repository yet, which is why deploying only the frontend on Vercel does not give you a separate backend runtime.

## Run Frontend

```bash
cd frontend
npm install
npm run dev
```

## Next Backend Step

A minimal Express backend scaffold now exists in `backend/`.

- `backend/server.js` exposes `/api`, `/api/health`, `/api/data`, and `/api/upload`
- `frontend/vite.config.ts` proxies `/api/*` to `http://localhost:5000` during development
- In production, the backend can serve the built frontend from `frontend/dist`
- The backend upload route requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

When you want, the next step is to add more server-side Supabase APIs and secret management so the app becomes a full frontend + backend deployment.
