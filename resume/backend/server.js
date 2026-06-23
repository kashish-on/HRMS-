// import express from "express";
// import cors from "cors";
// import dotenv from "dotenv";
// import path from "path";
// import { fileURLToPath } from "url";
// import { supabase } from "./src/lib/supabase.js";
// import atsRouter from "./src/routes/ats.js";
// import jobsRouter from "./src/routes/jobs.js";
// import resumesRouter from "./src/routes/resumes.js";
// import candidatesRouter from "./src/routes/candidates.js";
// import careersRouter from "./src/routes/careers.js";

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// dotenv.config({ path: path.join(__dirname, ".env") });

// const app = express();
// const PORT = process.env.PORT || 5001;

// app.use(cors());
// app.use(express.json());
// app.use("/api/ats", atsRouter);
// app.use("/api/jobs", jobsRouter);
// app.use("/api/resumes", resumesRouter);
// app.use("/api/candidates", candidatesRouter);
// app.use("/api/careers", careersRouter);

// app.get("/", (req, res) => {
//   res.json({
//     status: "ok",
//     message: "Resume ATS backend running",
//   });
// });

// app.get("/api", (req, res) => {
//   res.json({
//     status: "ok",
//     message: "Resume ATS API running",
//   });
// });

// app.get("/api/health", (req, res) => {
//   res.json({
//     status: "healthy",
//     service: "resume-backend",
//     timestamp: new Date().toISOString(),
//   });
// });

// app.get("/api/db-check", async (req, res) => {
//   try {
//     const { data, error } = await supabase
//       .from("resume_jobs")
//       .select("id")
//       .limit(1);

//     if (error) {
//       console.error("Supabase db-check error:", error);
//       return res.status(500).json({
//         status: "error",
//         message: error.message,
//       });
//     }

//     return res.json({
//       status: "ok",
//       message: "Supabase connection successful",
//       sampleCount: data?.length || 0,
//     });
//   } catch (error) {
//     console.error("Unexpected db-check error:", error);
//     return res.status(500).json({
//       status: "error",
//       message: error?.message || "Database check failed",
//     });
//   }
// });

// app.use((err, req, res, next) => {
//   console.error("Unhandled backend error:", err);

//   if (res.headersSent) {
//     return next(err);
//   }

//   res.status(500).json({
//     error: err?.message || "Internal server error.",
//   });
// });

// app.listen(PORT, () => {
//   console.log(`Resume backend running on http://localhost:${PORT}`);
// });

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "./src/lib/supabase.js";
import atsRouter from "./src/routes/ats.js";
import jobsRouter from "./src/routes/jobs.js";
import resumesRouter from "./src/routes/resumes.js";
import candidatesRouter from "./src/routes/candidates.js";
import careersRouter from "./src/routes/careers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = process.env.PORT || 5001;

// ── Auth middleware ───────────────────────────────────────────────────────────
// Creates a second Supabase client using the ANON key so we can verify
// user-supplied JWTs without the service-role key's bypass privileges.
// The service-role client (supabase) is kept for database operations only.

const supabaseAuthUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseAuthUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_ANON_KEY in resume/backend/.env — both are required for token verification."
  );
}

const supabaseAuthClient = createClient(supabaseAuthUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

/**
 * requireAuth
 *
 * Checks for a valid Supabase JWT in the Authorization header.
 * Attaches the verified user object to req.user for downstream handlers.
 * Returns 401 if the token is missing, malformed, or expired.
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: missing token." });
  }

  const token = authHeader.split(" ")[1];

  const {
    data: { user },
    error,
  } = await supabaseAuthClient.auth.getUser(token);

  if (error || !user) {
    return res
      .status(401)
      .json({ error: "Unauthorized: invalid or expired session." });
  }

  // Make the verified user available to route handlers if needed
  req.user = user;
  next();
}

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────

// 🔒 Protected — HR only (requireAuth runs before every request)
app.use("/api/ats", requireAuth, atsRouter);
app.use("/api/jobs", requireAuth, jobsRouter);
app.use("/api/resumes", requireAuth, resumesRouter);
app.use("/api/candidates", requireAuth, candidatesRouter);

// ✅ Public — no auth (careers portal for job applicants)
app.use("/api/careers", careersRouter);

// ── Utility endpoints ─────────────────────────────────────────────────────────

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Resume ATS backend running",
  });
});

app.get("/api", (req, res) => {
  res.json({
    status: "ok",
    message: "Resume ATS API running",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "resume-backend",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/db-check", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("resume_jobs")
      .select("id")
      .limit(1);

    if (error) {
      console.error("Supabase db-check error:", error);
      return res.status(500).json({
        status: "error",
        message: error.message,
      });
    }

    return res.json({
      status: "ok",
      message: "Supabase connection successful",
      sampleCount: data?.length || 0,
    });
  } catch (error) {
    console.error("Unexpected db-check error:", error);
    return res.status(500).json({
      status: "error",
      message: error?.message || "Database check failed",
    });
  }
});

// ── Global error handler ──────────────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error("Unhandled backend error:", err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    error: err?.message || "Internal server error.",
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Resume backend running on http://localhost:${PORT}`);
});