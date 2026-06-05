# Backend Service

This folder now contains a minimal Express backend scaffold for future Render deployment.

Current backend behavior:

- `GET /api` returns a simple API health response
- `GET /api/health` returns a JSON health payload
- `POST /api/data` accepts JSON and echoes it back
- `POST /api/upload` accepts a file upload and stores it in Supabase Storage using a service role key
- In production, the backend can serve the built frontend from `../frontend/dist`

Environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Local development:

1. Build or run the frontend separately in `frontend/`
2. Start the backend from `backend/` with `npm install` and `npm start`
3. The frontend dev server proxies `/api/*` requests to the backend on `http://localhost:5000`

Future work:

- add Supabase server-side APIs and secret management
- add authentication and authorization routes
- bake Render-specific deployment files such as `render.yaml`

