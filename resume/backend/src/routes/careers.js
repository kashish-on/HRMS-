/**
 * careers.js  —  Public careers portal API
 *
 * Mounts at:  /api/careers
 *
 * GET  /api/careers/jobs              – list all active job openings (public, no auth)
 * GET  /api/careers/jobs/:id          – single job detail (public)
 * POST /api/careers/jobs/:id/apply    – candidate submits resume via career portal
 *                                       saves to resume_uploads with source="portal"
 */

import express from "express";
import multer from "multer";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

// ── File upload (memory storage, same limits as main resumes route) ───────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
    files: 1,
  },
});

const allowedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Strip internal-only fields before sending to the public portal */
const toPublicJob = (job) => ({
  id: job.id,
  title: job.title,
  job_profile: job.job_profile,
  description: job.description || null,
  location: job.location || null,
  min_experience: job.min_experience ?? 0,
  max_experience: job.max_experience ?? null,
  required_skills: Array.isArray(job.required_skills) ? job.required_skills : [],
  optional_skills: Array.isArray(job.optional_skills) ? job.optional_skills : [],
  created_at: job.created_at,
});

// ── GET /api/careers/jobs  ────────────────────────────────────────────────────
router.get("/jobs", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("resume_jobs")
      .select("*")
      .or("is_open.is.null,is_open.eq.true")  // show jobs where is_open is true OR not set yet
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[careers] fetch jobs error:", error);
      return res.status(500).json({ status: "error", message: error.message });
    }

    return res.json({
      status: "ok",
      jobs: (data || []).map(toPublicJob),
    });
  } catch (err) {
    console.error("[careers] unexpected fetch jobs error:", err);
    return res.status(500).json({ status: "error", message: err?.message || "Failed to fetch jobs." });
  }
});

// ── GET /api/careers/jobs/:id  ────────────────────────────────────────────────
router.get("/jobs/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("resume_jobs")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("[careers] fetch job detail error:", error);
      return res.status(500).json({ status: "error", message: error.message });
    }

    if (!data) {
      return res.status(404).json({ status: "error", message: "Job not found." });
    }

    return res.json({ status: "ok", job: toPublicJob(data) });
  } catch (err) {
    console.error("[careers] unexpected fetch job detail error:", err);
    return res.status(500).json({ status: "error", message: err?.message || "Failed to fetch job." });
  }
});

// ── POST /api/careers/jobs/:id/apply  ─────────────────────────────────────────
//
// Accepts multipart/form-data with:
//   file          — resume file (PDF / DOC / DOCX, required)
//   applicant_name  — candidate name (optional)
//   applicant_email — candidate email (optional)
//
// Saves the file to Supabase Storage under "resume-files/<jobId>/portal-<ts>-<name>"
// Creates a row in `resume_uploads` with:
//   source = "portal"
//   parse_status = "pending"   (HR can batch-parse later from the dashboard)
//
router.post("/jobs/:id/apply", upload.single("file"), async (req, res) => {
  try {
    const { id: jobId } = req.params;
    const { applicant_name = null, applicant_email = null } = req.body;
    const file = req.file;

    // ── Validate ──────────────────────────────────────────────────────────────
    if (!file) {
      return res.status(400).json({ status: "error", message: "A resume file is required." });
    }

    if (!allowedMimeTypes.has(file.mimetype)) {
      return res.status(400).json({
        status: "error",
        message: "Only PDF and Word (DOC/DOCX) files are accepted.",
      });
    }

    // ── Confirm job exists ────────────────────────────────────────────────────
    const { data: job, error: jobError } = await supabase
      .from("resume_jobs")
      .select("id")
      .eq("id", jobId)
      .maybeSingle();

    if (jobError) {
      console.error("[careers] validate job error:", jobError);
      return res.status(500).json({ status: "error", message: jobError.message });
    }

    if (!job) {
      return res.status(404).json({ status: "error", message: "Job not found." });
    }

    // ── Upload file to Supabase Storage ───────────────────────────────────────
    const sanitizedName = file.originalname.replace(/\s+/g, "_");
    const storagePath = `${jobId}/portal-${Date.now()}-${sanitizedName}`;

    const { error: storageError } = await supabase.storage
      .from("resume-files")
      .upload(storagePath, file.buffer, {
        upsert: false,
        contentType: file.mimetype,
      });

    if (storageError) {
      console.error("[careers] storage upload error:", storageError);
      return res.status(500).json({ status: "error", message: storageError.message });
    }

    const { data: publicUrlData } = supabase.storage
      .from("resume-files")
      .getPublicUrl(storagePath);

    // ── Create batch row for this portal application ──────────────────────────
    const { data: batch, error: batchError } = await supabase
      .from("resume_upload_batches")
      .insert([
        {
          job_id: jobId,
          uploaded_by: null, // portal submissions have no internal user UUID
          batch_name: `Portal application — ${applicant_name || file.originalname}`,
          total_files: 1,
          status: "uploaded",
        },
      ])
      .select()
      .single();

    if (batchError) {
      console.error("[careers] create batch error:", batchError);
      return res.status(500).json({ status: "error", message: batchError.message });
    }

    // ── Create resume_uploads row ─────────────────────────────────────────────
    // Base payload — columns that always exist in resume_uploads
    const uploadPayload = {
      batch_id: batch.id,
      job_id: jobId,
      uploaded_by: null,           // portal applicants have no internal user UUID
      original_file_name: file.originalname,
      storage_bucket: "resume-files",
      storage_path: storagePath,
      file_url: publicUrlData?.publicUrl || null,
      file_size_bytes: file.size,
      mime_type: file.mimetype,
      parse_status: "pending",
    };

    // Try first with the extra portal columns (requires the SQL migration to have been run).
    // If that fails with "column does not exist", retry without them so the upload still works.
    let uploadRow = null;
    let uploadError = null;

    const withExtra = { ...uploadPayload, source: "portal", applicant_name: applicant_name?.trim() || null, applicant_email: applicant_email?.trim() || null };
    const r1 = await supabase.from("resume_uploads").insert([withExtra]).select().single();

    if (r1.error) {
      const missingColumn = r1.error.message?.includes("column") || r1.error.code === "42703";
      if (missingColumn) {
        // Migration not run yet — fall back to base payload
        console.warn("[careers] extra columns not found, falling back to base insert. Run the SQL migration.");
        const r2 = await supabase.from("resume_uploads").insert([uploadPayload]).select().single();
        uploadRow = r2.data;
        uploadError = r2.error;
      } else {
        uploadError = r1.error;
      }
    } else {
      uploadRow = r1.data;
    }

    if (uploadError) {
      console.error("[careers] create upload row error:", uploadError);
      return res.status(500).json({ status: "error", message: uploadError.message });
    }

    return res.status(201).json({
      status: "ok",
      message: "Application submitted successfully. We will review your resume and get back to you.",
      uploadId: uploadRow.id,
    });
  } catch (err) {
    console.error("[careers] unexpected apply error:", err);
    return res.status(500).json({ status: "error", message: err?.message || "Failed to submit application." });
  }
});

export default router;

/*
 * ── Required DB migration (run once in Supabase SQL editor) ──────────────────
 *
 * -- Add source column to resume_uploads (if not present)
 * ALTER TABLE resume_uploads
 *   ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'internal',
 *   ADD COLUMN IF NOT EXISTS applicant_name text,
 *   ADD COLUMN IF NOT EXISTS applicant_email text;
 *
 * -- Optional: index to filter portal uploads quickly
 * CREATE INDEX IF NOT EXISTS idx_resume_uploads_source ON resume_uploads(source);
 *
 */

// /**
//  * careers.js  —  Public careers portal API
//  *
//  * Mounts at:  /api/careers
//  *
//  * GET  /api/careers/jobs              – list all active job openings (public, no auth)
//  * GET  /api/careers/jobs/:id          – single job detail (public)
//  * POST /api/careers/jobs/:id/apply    – candidate submits resume via career portal
//  *                                       saves to resume_uploads with source="portal"
//  */

// import express from "express";
// import multer from "multer";
// import { supabase } from "../lib/supabase.js";

// const router = express.Router();

// // ── File upload (memory storage, same limits as main resumes route) ───────────
// const upload = multer({
//   storage: multer.memoryStorage(),
//   limits: {
//     fileSize: 10 * 1024 * 1024, // 10 MB
//     files: 1,
//   },
// });

// const allowedMimeTypes = new Set([
//   "application/pdf",
//   "application/msword",
//   "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
// ]);

// // ── Helpers ───────────────────────────────────────────────────────────────────

// /** Strip internal-only fields before sending to the public portal */
// const toPublicJob = (job) => ({
//   id: job.id,
//   title: job.title,
//   job_profile: job.job_profile,
//   description: job.description || null,
//   location: job.location || null,
//   min_experience: job.min_experience ?? 0,
//   max_experience: job.max_experience ?? null,
//   required_skills: Array.isArray(job.required_skills) ? job.required_skills : [],
//   optional_skills: Array.isArray(job.optional_skills) ? job.optional_skills : [],
//   created_at: job.created_at,
// });

// // ── GET /api/careers/jobs  ────────────────────────────────────────────────────
// router.get("/jobs", async (req, res) => {
//   try {
//     const { data, error } = await supabase
//       .from("resume_jobs")
//       .select("*")
//       // Only expose jobs that are "active" — if your schema has no status column,
//       // all jobs are shown (safe default). Add `.eq("status", "active")` if needed.
//       .order("created_at", { ascending: false });

//     if (error) {
//       console.error("[careers] fetch jobs error:", error);
//       return res.status(500).json({ status: "error", message: error.message });
//     }

//     return res.json({
//       status: "ok",
//       jobs: (data || []).map(toPublicJob),
//     });
//   } catch (err) {
//     console.error("[careers] unexpected fetch jobs error:", err);
//     return res.status(500).json({ status: "error", message: err?.message || "Failed to fetch jobs." });
//   }
// });

// // ── GET /api/careers/jobs/:id  ────────────────────────────────────────────────
// router.get("/jobs/:id", async (req, res) => {
//   try {
//     const { id } = req.params;

//     const { data, error } = await supabase
//       .from("resume_jobs")
//       .select("*")
//       .eq("id", id)
//       .maybeSingle();

//     if (error) {
//       console.error("[careers] fetch job detail error:", error);
//       return res.status(500).json({ status: "error", message: error.message });
//     }

//     if (!data) {
//       return res.status(404).json({ status: "error", message: "Job not found." });
//     }

//     return res.json({ status: "ok", job: toPublicJob(data) });
//   } catch (err) {
//     console.error("[careers] unexpected fetch job detail error:", err);
//     return res.status(500).json({ status: "error", message: err?.message || "Failed to fetch job." });
//   }
// });

// // ── POST /api/careers/jobs/:id/apply  ─────────────────────────────────────────
// //
// // Accepts multipart/form-data with:
// //   file          — resume file (PDF / DOC / DOCX, required)
// //   applicant_name  — candidate name (optional)
// //   applicant_email — candidate email (optional)
// //
// // Saves the file to Supabase Storage under "resume-files/<jobId>/portal-<ts>-<name>"
// // Creates a row in `resume_uploads` with:
// //   source = "portal"
// //   parse_status = "pending"   (HR can batch-parse later from the dashboard)
// //
// router.post("/jobs/:id/apply", upload.single("file"), async (req, res) => {
//   try {
//     const { id: jobId } = req.params;
//     const { applicant_name = null, applicant_email = null } = req.body;
//     const file = req.file;

//     // ── Validate ──────────────────────────────────────────────────────────────
//     if (!file) {
//       return res.status(400).json({ status: "error", message: "A resume file is required." });
//     }

//     if (!allowedMimeTypes.has(file.mimetype)) {
//       return res.status(400).json({
//         status: "error",
//         message: "Only PDF and Word (DOC/DOCX) files are accepted.",
//       });
//     }

//     // ── Confirm job exists ────────────────────────────────────────────────────
//     const { data: job, error: jobError } = await supabase
//       .from("resume_jobs")
//       .select("id")
//       .eq("id", jobId)
//       .maybeSingle();

//     if (jobError) {
//       console.error("[careers] validate job error:", jobError);
//       return res.status(500).json({ status: "error", message: jobError.message });
//     }

//     if (!job) {
//       return res.status(404).json({ status: "error", message: "Job not found." });
//     }

//     // ── Upload file to Supabase Storage ───────────────────────────────────────
//     const sanitizedName = file.originalname.replace(/\s+/g, "_");
//     const storagePath = `${jobId}/portal-${Date.now()}-${sanitizedName}`;

//     const { error: storageError } = await supabase.storage
//       .from("resume-files")
//       .upload(storagePath, file.buffer, {
//         upsert: false,
//         contentType: file.mimetype,
//       });

//     if (storageError) {
//       console.error("[careers] storage upload error:", storageError);
//       return res.status(500).json({ status: "error", message: storageError.message });
//     }

//     const { data: publicUrlData } = supabase.storage
//       .from("resume-files")
//       .getPublicUrl(storagePath);

//     // ── Create batch row for this portal application ──────────────────────────
//     const { data: batch, error: batchError } = await supabase
//       .from("resume_upload_batches")
//       .insert([
//         {
//           job_id: jobId,
//           uploaded_by: null, // portal submissions have no internal user UUID
//           batch_name: `Portal application — ${applicant_name || file.originalname}`,
//           total_files: 1,
//           status: "uploaded",
//         },
//       ])
//       .select()
//       .single();

//     if (batchError) {
//       console.error("[careers] create batch error:", batchError);
//       return res.status(500).json({ status: "error", message: batchError.message });
//     }

//     // ── Create resume_uploads row ─────────────────────────────────────────────
//     // Base payload — columns that always exist in resume_uploads
//     const uploadPayload = {
//       batch_id: batch.id,
//       job_id: jobId,
//       uploaded_by: null,           // portal applicants have no internal user UUID
//       original_file_name: file.originalname,
//       storage_bucket: "resume-files",
//       storage_path: storagePath,
//       file_url: publicUrlData?.publicUrl || null,
//       file_size_bytes: file.size,
//       mime_type: file.mimetype,
//       parse_status: "pending",
//     };

//     // Try first with the extra portal columns (requires the SQL migration to have been run).
//     // If that fails with "column does not exist", retry without them so the upload still works.
//     let uploadRow = null;
//     let uploadError = null;

//     const withExtra = { ...uploadPayload, source: "portal", applicant_name: applicant_name?.trim() || null, applicant_email: applicant_email?.trim() || null };
//     const r1 = await supabase.from("resume_uploads").insert([withExtra]).select().single();

//     if (r1.error) {
//       const missingColumn = r1.error.message?.includes("column") || r1.error.code === "42703";
//       if (missingColumn) {
//         // Migration not run yet — fall back to base payload
//         console.warn("[careers] extra columns not found, falling back to base insert. Run the SQL migration.");
//         const r2 = await supabase.from("resume_uploads").insert([uploadPayload]).select().single();
//         uploadRow = r2.data;
//         uploadError = r2.error;
//       } else {
//         uploadError = r1.error;
//       }
//     } else {
//       uploadRow = r1.data;
//     }

//     if (uploadError) {
//       console.error("[careers] create upload row error:", uploadError);
//       return res.status(500).json({ status: "error", message: uploadError.message });
//     }

//     return res.status(201).json({
//       status: "ok",
//       message: "Application submitted successfully. We will review your resume and get back to you.",
//       uploadId: uploadRow.id,
//     });
//   } catch (err) {
//     console.error("[careers] unexpected apply error:", err);
//     return res.status(500).json({ status: "error", message: err?.message || "Failed to submit application." });
//   }
// });

// export default router;

// /*
//  * ── Required DB migration (run once in Supabase SQL editor) ──────────────────
//  *
//  * -- Add source column to resume_uploads (if not present)
//  * ALTER TABLE resume_uploads
//  *   ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'internal',
//  *   ADD COLUMN IF NOT EXISTS applicant_name text,
//  *   ADD COLUMN IF NOT EXISTS applicant_email text;
//  *
//  * -- Optional: index to filter portal uploads quickly
//  * CREATE INDEX IF NOT EXISTS idx_resume_uploads_source ON resume_uploads(source);
//  *
//  */