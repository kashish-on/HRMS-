import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { supabase } from "./src/lib/supabase.js";
import atsRouter from "./src/routes/ats.js";
import jobsRouter from "./src/routes/jobs.js";
import resumesRouter from "./src/routes/resumes.js";
import candidatesRouter from "./src/routes/candidates.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());
app.use("/api/ats", atsRouter);
app.use("/api/jobs", jobsRouter);
app.use("/api/resumes", resumesRouter);
app.use("/api/candidates", candidatesRouter);

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

app.use((err, req, res, next) => {
  console.error("Unhandled backend error:", err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    error: err?.message || "Internal server error.",
  });
});

app.listen(PORT, () => {
  console.log(`Resume backend running on http://localhost:${PORT}`);
});

