import express from "express";
import multer from "multer";
import { supabase } from "../lib/supabase.js";
import {
  normalizeRChilliResumeData,
  parseResumeWithRChilli,
} from "../services/rchilliService.js";
import {
  buildJobRankings,
  scoreCandidateAgainstJob,
} from "../services/scoringService.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 25,
  },
});

const allowedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

router.get("/", async (req, res) => {
  try {
    const { job_id } = req.query;

    let query = supabase
      .from("resume_uploads")
      .select("*")
      .order("created_at", { ascending: false });

    if (typeof job_id === "string" && job_id.trim()) {
      query = query.eq("job_id", job_id.trim());
    }

    const { data, error } = await query;

    if (error) {
      console.error("Fetch resumes error:", error);
      return res.status(500).json({
        status: "error",
        message: error.message,
      });
    }

    return res.json({
      status: "ok",
      resumes: data || [],
    });
  } catch (error) {
    console.error("Unexpected fetch resumes error:", error);
    return res.status(500).json({
      status: "error",
      message: error?.message || "Failed to fetch resumes.",
    });
  }
});

router.get("/parsed/:uploadId", async (req, res) => {
  const { uploadId } = req.params;

  try {
    const { data: uploadRow, error: uploadError } = await supabase
      .from("resume_uploads")
      .select("*")
      .eq("id", uploadId)
      .maybeSingle();

    if (uploadError) {
      console.error("Fetch parsed upload error:", uploadError);
      return res.status(500).json({
        status: "error",
        message: uploadError.message,
      });
    }

    if (!uploadRow) {
      return res.status(404).json({
        status: "error",
        message: "Resume upload not found.",
      });
    }

    const { data: candidateRow, error: candidateError } = await supabase
      .from("resume_candidates")
      .select("*")
      .eq("upload_id", uploadId)
      .maybeSingle();

    if (candidateError) {
      console.error("Fetch parsed candidate error:", candidateError);
      return res.status(500).json({
        status: "error",
        message: candidateError.message,
      });
    }

    const { data: parsedDataRow, error: parsedDataError } = await supabase
      .from("resume_parsed_data")
      .select("*")
      .eq("upload_id", uploadId)
      .maybeSingle();

    if (parsedDataError) {
      console.error("Fetch parsed resume data error:", parsedDataError);
      return res.status(500).json({
        status: "error",
        message: parsedDataError.message,
      });
    }

    const { data: scorecardRow, error: scorecardError } = await supabase
      .from("resume_scorecards")
      .select("*")
      .eq("candidate_id", candidateRow?.id || "")
      .maybeSingle();

    if (scorecardError) {
      console.error("Fetch scorecard error:", scorecardError);
      return res.status(500).json({
        status: "error",
        message: scorecardError.message,
      });
    }

    return res.json({
      status: "ok",
      upload: uploadRow,
      candidate: candidateRow,
      parsedData: parsedDataRow,
      scorecard: scorecardRow,
    });
  } catch (error) {
    console.error("Unexpected fetch parsed result error:", error);
    return res.status(500).json({
      status: "error",
      message: error?.message || "Failed to fetch parsed resume result.",
    });
  }
});

router.post("/score/:uploadId", async (req, res) => {
  const { uploadId } = req.params;

  try {
    const { data: uploadRow, error: uploadError } = await supabase
      .from("resume_uploads")
      .select("*")
      .eq("id", uploadId)
      .maybeSingle();

    if (uploadError) {
      return res.status(500).json({
        status: "error",
        message: uploadError.message,
      });
    }

    if (!uploadRow) {
      return res.status(404).json({
        status: "error",
        message: "Resume upload not found.",
      });
    }

    const [{ data: jobRow, error: jobError }, { data: candidateRow, error: candidateError }, { data: parsedDataRow, error: parsedDataError }] =
      await Promise.all([
        supabase.from("resume_jobs").select("*").eq("id", uploadRow.job_id).maybeSingle(),
        supabase.from("resume_candidates").select("*").eq("upload_id", uploadId).maybeSingle(),
        supabase.from("resume_parsed_data").select("*").eq("upload_id", uploadId).maybeSingle(),
      ]);

    if (jobError || candidateError || parsedDataError) {
      return res.status(500).json({
        status: "error",
        message: jobError?.message || candidateError?.message || parsedDataError?.message,
      });
    }

    if (!jobRow) {
      return res.status(404).json({
        status: "error",
        message: "Related job not found.",
      });
    }

    if (!candidateRow || !parsedDataRow) {
      return res.status(400).json({
        status: "error",
        message: "Resume must be parsed before scoring.",
      });
    }

    const scoringResult = scoreCandidateAgainstJob({
      job: jobRow,
      candidate: candidateRow,
      parsedData: parsedDataRow,
    });

    const { data: scorecardRow, error: scorecardError } = await supabase
      .from("resume_scorecards")
      .upsert(
        [
          {
            candidate_id: candidateRow.id,
            job_id: jobRow.id,
            ...scoringResult.scorecard,
          },
        ],
        { onConflict: "candidate_id" }
      )
      .select()
      .single();

    if (scorecardError) {
      throw new Error(`Failed to save scorecard: ${scorecardError.message}`);
    }

    const { data: updatedCandidate, error: candidateUpdateError } = await supabase
      .from("resume_candidates")
      .update({
        ats_score: scoringResult.totalScore,
        score_color: scoringResult.scoreColor,
        is_knocked_out: scoringResult.isKnockedOut,
        knockout_status: scoringResult.isKnockedOut ? "knocked_out" : "eligible",
        is_recommended: !scoringResult.isKnockedOut && scoringResult.totalScore >= 75,
      })
      .eq("id", candidateRow.id)
      .select()
      .single();

    if (candidateUpdateError) {
      throw new Error(`Failed to update candidate score fields: ${candidateUpdateError.message}`);
    }

    const { data: allCandidates, error: rankingFetchError } = await supabase
      .from("resume_candidates")
      .select("id, ats_score, is_knocked_out")
      .eq("job_id", jobRow.id);

    if (rankingFetchError) {
      throw new Error(`Failed to fetch candidates for ranking: ${rankingFetchError.message}`);
    }

    const rankingUpdates = buildJobRankings(allCandidates || []);

    if (rankingUpdates.length > 0) {
      for (const row of rankingUpdates) {
        const { error } = await supabase
          .from("resume_candidates")
          .update({ rank_position: row.rank_position })
          .eq("id", row.id);

        if (error) {
          throw new Error(`Failed to update rank positions: ${error.message}`);
        }
      }
    }

    await supabase
      .from("resume_candidates")
      .update({ rank_position: null })
      .eq("job_id", jobRow.id)
      .eq("is_knocked_out", true);

    return res.json({
      status: "ok",
      message: "Resume scored successfully.",
      candidate: updatedCandidate,
      scorecard: scorecardRow,
    });
  } catch (error) {
    console.error("Unexpected resume scoring error:", error);
    return res.status(500).json({
      status: "error",
      message: error?.message || "Failed to score resume.",
    });
  }
});

router.post("/parse/:uploadId", async (req, res) => {
  const { uploadId } = req.params;

  try {
    const { data: uploadRow, error: uploadError } = await supabase
      .from("resume_uploads")
      .select("*")
      .eq("id", uploadId)
      .maybeSingle();

    if (uploadError) {
      console.error("Fetch upload row error:", uploadError);
      return res.status(500).json({
        status: "error",
        message: uploadError.message,
      });
    }

    if (!uploadRow) {
      return res.status(404).json({
        status: "error",
        message: "Resume upload not found.",
      });
    }

    if (!uploadRow.file_url) {
      return res.status(400).json({
        status: "error",
        message: "Uploaded resume does not have a public file URL.",
      });
    }

    await supabase
      .from("resume_uploads")
      .update({ parse_status: "processing", parse_error: null })
      .eq("id", uploadId);

    const rchilliPayload = await parseResumeWithRChilli(uploadRow.file_url);
    const normalized = normalizeRChilliResumeData(rchilliPayload);

    const candidatePayload = {
      job_id: uploadRow.job_id,
      upload_id: uploadRow.id,
      ...normalized.candidate,
    };

    const { data: candidateRow, error: candidateError } = await supabase
      .from("resume_candidates")
      .upsert([candidatePayload], { onConflict: "upload_id" })
      .select()
      .single();

    if (candidateError) {
      throw new Error(`Failed to save candidate profile: ${candidateError.message}`);
    }

    const parsedDataPayload = {
      candidate_id: candidateRow.id,
      upload_id: uploadRow.id,
      ...normalized.parsedData,
    };

    const { error: parsedDataError } = await supabase
      .from("resume_parsed_data")
      .upsert([parsedDataPayload], { onConflict: "upload_id" });

    if (parsedDataError) {
      throw new Error(`Failed to save parsed resume data: ${parsedDataError.message}`);
    }

    const { error: finalizeError } = await supabase
      .from("resume_uploads")
      .update({ parse_status: "parsed", parse_error: null })
      .eq("id", uploadId);

    if (finalizeError) {
      throw new Error(`Failed to finalize parse status: ${finalizeError.message}`);
    }

    return res.json({
      status: "ok",
      message: "Resume parsed successfully.",
      uploadId: uploadRow.id,
      candidate: candidateRow,
      parsedPreview: {
        fullName: candidateRow.full_name,
        email: candidateRow.email,
        phone: candidateRow.phone,
        currentJobTitle: candidateRow.current_job_title,
        totalExperience: candidateRow.total_experience,
        skills: normalized.parsedData.parsed_skills,
      },
    });
  } catch (error) {
    console.error("Unexpected resume parse error:", error);

    await supabase
      .from("resume_uploads")
      .update({
        parse_status: "failed",
        parse_error: error?.message || "Failed to parse resume.",
      })
      .eq("id", uploadId);

    return res.status(500).json({
      status: "error",
      message: error?.message || "Failed to parse resume.",
    });
  }
});

router.post("/upload", upload.array("files", 25), async (req, res) => {
  try {
    const { job_id, batch_name = null, uploaded_by = null } = req.body;
    const files = req.files || [];

    if (!job_id?.trim()) {
      return res.status(400).json({
        status: "error",
        message: "job_id is required.",
      });
    }

    if (!files.length) {
      return res.status(400).json({
        status: "error",
        message: "At least one resume file is required.",
      });
    }

    const { data: job, error: jobError } = await supabase
      .from("resume_jobs")
      .select("id")
      .eq("id", job_id)
      .maybeSingle();

    if (jobError) {
      console.error("Validate job error:", jobError);
      return res.status(500).json({
        status: "error",
        message: jobError.message,
      });
    }

    if (!job) {
      return res.status(404).json({
        status: "error",
        message: "Job not found.",
      });
    }

    for (const file of files) {
      if (!allowedMimeTypes.has(file.mimetype)) {
        return res.status(400).json({
          status: "error",
          message: `Unsupported file type for ${file.originalname}. Only PDF and DOC/DOCX files are allowed.`,
        });
      }
    }

    const normalizedJobId = job_id.trim();
    const normalizedUploadedBy = uploaded_by?.trim() || null;

    const { data: batch, error: batchError } = await supabase
      .from("resume_upload_batches")
      .insert([
        {
          job_id: normalizedJobId,
          uploaded_by: normalizedUploadedBy,
          batch_name: batch_name?.trim() || null,
          total_files: files.length,
          status: "uploaded",
        },
      ])
      .select()
      .single();

    if (batchError) {
      console.error("Create upload batch error:", batchError);
      return res.status(500).json({
        status: "error",
        message: batchError.message,
      });
    }

    const uploadedRows = [];

    for (const file of files) {
      const sanitizedName = file.originalname.replace(/\s+/g, "_");
      const storagePath = `${normalizedJobId}/${Date.now()}-${sanitizedName}`;

      const { error: storageError } = await supabase.storage
        .from("resume-files")
        .upload(storagePath, file.buffer, {
          upsert: false,
          contentType: file.mimetype,
        });

      if (storageError) {
        console.error("Resume storage upload error:", storageError);
        return res.status(500).json({
          status: "error",
          message: storageError.message,
        });
      }

      const { data: publicUrlData } = supabase.storage
        .from("resume-files")
        .getPublicUrl(storagePath);

      const { data: uploadRow, error: uploadError } = await supabase
        .from("resume_uploads")
        .insert([
          {
            batch_id: batch.id,
            job_id: normalizedJobId,
            uploaded_by: normalizedUploadedBy,
            original_file_name: file.originalname,
            storage_bucket: "resume-files",
            storage_path: storagePath,
            file_url: publicUrlData?.publicUrl || null,
            file_size_bytes: file.size,
            mime_type: file.mimetype,
            parse_status: "pending",
          },
        ])
        .select()
        .single();

      if (uploadError) {
        console.error("Create resume upload row error:", uploadError);
        return res.status(500).json({
          status: "error",
          message: uploadError.message,
        });
      }

      uploadedRows.push(uploadRow);
    }

    return res.status(201).json({
      status: "ok",
      message: "Resume files uploaded successfully.",
      batch,
      files: uploadedRows,
    });
  } catch (error) {
    console.error("Unexpected resume upload error:", error);
    return res.status(500).json({
      status: "error",
      message: error?.message || "Failed to upload resumes.",
    });
  }
});

export default router;
