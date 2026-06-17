

import express from "express";
import multer from "multer";
import { supabase } from "../lib/supabase.js";
import {
  mapCandidateToResultsRow,
  mapJobToDashboardRecord,
} from "../lib/frontendMappers.js";
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

const normalizeCategoryValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const toNullableNumber = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const toSkillArray = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const findExistingJobForCategory = async ({ title, jobProfile }) => {
  const normalizedTitle = normalizeCategoryValue(title);
  const normalizedProfile = normalizeCategoryValue(jobProfile);

  const titleQuery = await supabase
    .from("resume_jobs")
    .select("*")
    .or(`title.ilike.${title.replace(/,/g, "\\,")},job_profile.ilike.${jobProfile.replace(/,/g, "\\,")}`)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (titleQuery.error) {
    throw new Error(`Failed to search existing jobs: ${titleQuery.error.message}`);
  }

  const candidates = titleQuery.data || [];

  const matchedJob = candidates.find((job) => {
    const jobTitle = normalizeCategoryValue(job.title);
    const jobStoredProfile = normalizeCategoryValue(job.job_profile);

    return (
      jobTitle === normalizedTitle ||
      jobStoredProfile === normalizedTitle ||
      jobTitle === normalizedProfile ||
      jobStoredProfile === normalizedProfile
    );
  });

  return matchedJob || null;
};

const getJobCategoryKey = (job) =>
  normalizeCategoryValue(job?.job_profile || job?.title || "");

router.post("/parse-run", upload.array("files", 25), async (req, res) => {
  const files = req.files || [];

  try {
    const {
      created_by = null,
      uploaded_by = null,
      batch_name = null,
      role = null,
      title = null,
      job_profile = null,
      description = null,
      location = null,
      min_experience = null,
      max_experience = null,
      experience = null,
      required_skills = [],
      optional_skills = [],
      skills = [],
    } = req.body || {};

    const resolvedTitle = String(title || role || job_profile || "").trim();
    const resolvedProfile = String(job_profile || role || title || "").trim();
    const resolvedSkills = toSkillArray(required_skills).length
      ? toSkillArray(required_skills)
      : toSkillArray(skills);
    const resolvedOptionalSkills = toSkillArray(optional_skills);
    const resolvedMinExperience =
      toNullableNumber(min_experience) ?? toNullableNumber(experience) ?? 0;
    const resolvedMaxExperience = toNullableNumber(max_experience);

    if (!resolvedTitle) {
      return res.status(400).json({
        status: "error",
        message: "role or title is required.",
      });
    }

    if (!resolvedProfile) {
      return res.status(400).json({
        status: "error",
        message: "job_profile is required.",
      });
    }

    if (!files.length) {
      return res.status(400).json({
        status: "error",
        message: "At least one resume file is required.",
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

    const existingJob = await findExistingJobForCategory({
      title: resolvedTitle,
      jobProfile: resolvedProfile,
    });

    let jobRow = existingJob;

    if (!jobRow) {
      const jobPayload = {
        created_by: created_by?.trim?.() || null,
        title: resolvedTitle,
        job_profile: resolvedProfile,
        description: description?.trim?.() || null,
        location: location?.trim?.() || null,
        min_experience: resolvedMinExperience,
        max_experience: resolvedMaxExperience,
        required_skills: resolvedSkills,
        optional_skills: resolvedOptionalSkills,
      };

      const { data: createdJob, error: jobError } = await supabase
        .from("resume_jobs")
        .insert([jobPayload])
        .select("*")
        .single();

      if (jobError) {
        console.error("Parse run create job error:", jobError);
        return res.status(500).json({
          status: "error",
          message: jobError.message,
        });
      }

      jobRow = createdJob;
    }

    const { data: batchRow, error: batchError } = await supabase
      .from("resume_upload_batches")
      .insert([
        {
          job_id: jobRow.id,
          uploaded_by: uploaded_by?.trim?.() || null,
          batch_name: batch_name?.trim?.() || null,
          total_files: files.length,
          status: "uploaded",
        },
      ])
      .select("*")
      .single();

    if (batchError) {
      console.error("Parse run create batch error:", batchError);
      return res.status(500).json({
        status: "error",
        message: batchError.message,
      });
    }

    const uploadRows = [];

    for (const file of files) {
      const sanitizedName = file.originalname.replace(/\s+/g, "_");
      const storagePath = `${jobRow.id}/${Date.now()}-${sanitizedName}`;

      const { error: storageError } = await supabase.storage
        .from("resume-files")
        .upload(storagePath, file.buffer, {
          upsert: false,
          contentType: file.mimetype,
        });

      if (storageError) {
        throw new Error(`Failed to upload ${file.originalname}: ${storageError.message}`);
      }

      const { data: publicUrlData } = supabase.storage
        .from("resume-files")
        .getPublicUrl(storagePath);

      const { data: uploadRow, error: uploadError } = await supabase
        .from("resume_uploads")
        .insert([
          {
            batch_id: batchRow.id,
            job_id: jobRow.id,
            uploaded_by: uploaded_by?.trim?.() || null,
            original_file_name: file.originalname,
            storage_bucket: "resume-files",
            storage_path: storagePath,
            file_url: publicUrlData?.publicUrl || null,
            file_size_bytes: file.size,
            mime_type: file.mimetype,
            parse_status: "pending",
          },
        ])
        .select("*")
        .single();

      if (uploadError) {
        throw new Error(`Failed to create upload row for ${file.originalname}: ${uploadError.message}`);
      }

      uploadRows.push(uploadRow);
    }

    const parsedUploads = [];
    const failedUploads = [];

    for (const uploadRow of uploadRows) {
      try {
        await supabase
          .from("resume_uploads")
          .update({ parse_status: "processing", parse_error: null })
          .eq("id", uploadRow.id);

        const rchilliPayload = await parseResumeWithRChilli(uploadRow.file_url);
        const normalized = normalizeRChilliResumeData(rchilliPayload);

        // Ensure total_experience is stored as a proper number (not null/string)
        const candidatePayload = {
          ...normalized.candidate,
          total_experience: normalized.candidate.total_experience != null
            ? Number(normalized.candidate.total_experience)
            : null,
        };

        const { data: candidateRow, error: candidateError } = await supabase
          .from("resume_candidates")
          .upsert(
            [
              {
                job_id: jobRow.id,
                upload_id: uploadRow.id,
                ...candidatePayload,
              },
            ],
            { onConflict: "upload_id" }
          )
          .select("*")
          .single();

        if (candidateError) {
          throw new Error(`Failed to save candidate profile: ${candidateError.message}`);
        }

        // Ensure raw_parser_response is stored as a proper JSON object (Supabase jsonb column)
        const parsedDataPayload = {
          ...normalized.parsedData,
          raw_parser_response: normalized.parsedData.raw_parser_response ?? null,
        };

        const { error: parsedDataError } = await supabase
          .from("resume_parsed_data")
          .upsert(
            [
              {
                candidate_id: candidateRow.id,
                upload_id: uploadRow.id,
                ...parsedDataPayload,
              },
            ],
            { onConflict: "upload_id" }
          );

        if (parsedDataError) {
          throw new Error(`Failed to save parsed data: ${parsedDataError.message}`);
        }

        const scoringResult = scoreCandidateAgainstJob({
          job: jobRow,
          candidate: candidateRow,
          parsedData: normalized.parsedData,
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
          .select("*")
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
          .select("*")
          .single();

        if (candidateUpdateError) {
          throw new Error(`Failed to update candidate score fields: ${candidateUpdateError.message}`);
        }

        const { error: finalizeError } = await supabase
          .from("resume_uploads")
          .update({ parse_status: "parsed", parse_error: null })
          .eq("id", uploadRow.id);

        if (finalizeError) {
          throw new Error(`Failed to finalize parse status: ${finalizeError.message}`);
        }

        parsedUploads.push({
          upload: { ...uploadRow, parse_status: "parsed", parse_error: null },
          candidate: updatedCandidate,
          scorecard: scorecardRow,
        });
      } catch (error) {
        failedUploads.push({
          uploadId: uploadRow.id,
          fileName: uploadRow.original_file_name,
          message: error?.message || "Failed to parse resume.",
        });

        await supabase
          .from("resume_uploads")
          .update({
            parse_status: "failed",
            parse_error: error?.message || "Failed to parse resume.",
          })
          .eq("id", uploadRow.id);
      }
    }

    const { data: rankingCandidates, error: rankingFetchError } = await supabase
      .from("resume_candidates")
      .select("id, ats_score, is_knocked_out")
      .eq("job_id", jobRow.id);

    if (rankingFetchError) {
      throw new Error(`Failed to fetch candidates for ranking: ${rankingFetchError.message}`);
    }

    const rankingUpdates = buildJobRankings(rankingCandidates || []);

    for (const row of rankingUpdates) {
      const { error } = await supabase
        .from("resume_candidates")
        .update({ rank_position: row.rank_position })
        .eq("id", row.id);

      if (error) {
        throw new Error(`Failed to update rank positions: ${error.message}`);
      }
    }

    await supabase
      .from("resume_candidates")
      .update({ rank_position: null })
      .eq("job_id", jobRow.id)
      .eq("is_knocked_out", true);

    const { data: allJobs, error: allJobsError } = await supabase
      .from("resume_jobs")
      .select("*");

    if (allJobsError) {
      throw new Error(allJobsError.message);
    }

    const relatedJobRows = (allJobs || []).filter(
      (row) => getJobCategoryKey(row) === getJobCategoryKey(jobRow)
    );
    const relatedJobIds = relatedJobRows.map((row) => row.id);

    const [{ data: finalUploads, error: finalUploadsError }, { data: finalCandidates, error: finalCandidatesError }] =
      await Promise.all([
        supabase.from("resume_uploads").select("*").in("job_id", relatedJobIds),
        supabase
          .from("resume_candidates")
          .select(`
            *,
            resume_scorecards (*),
            resume_parsed_data (*)
          `)
          .in("job_id", relatedJobIds)
          .order("is_knocked_out", { ascending: true })
          .order("rank_position", { ascending: true, nullsFirst: false })
          .order("ats_score", { ascending: false }),
      ]);

    if (finalUploadsError || finalCandidatesError) {
      throw new Error(finalUploadsError?.message || finalCandidatesError?.message);
    }

    const primaryJob =
      [...relatedJobRows].sort(
        (a, b) =>
          new Date(b?.updated_at || b?.created_at || 0).getTime() -
          new Date(a?.updated_at || a?.created_at || 0).getTime()
      )[0] || jobRow;

    const record = mapJobToDashboardRecord({
      job: primaryJob,
      uploads: finalUploads || [],
      candidates: finalCandidates || [],
    });

    const candidates = (finalCandidates || []).map((row) =>
      mapCandidateToResultsRow({
        candidate: row,
        scorecard: Array.isArray(row.resume_scorecards) ? row.resume_scorecards[0] || null : null,
        parsedData: Array.isArray(row.resume_parsed_data) ? row.resume_parsed_data[0] || null : null,
        job: primaryJob,
      })
    );

    return res.status(201).json({
      status: "ok",
      message:
        failedUploads.length > 0
          ? "Parse run completed with some failed resumes."
          : "Parse run completed successfully.",
      reusedExistingJob: Boolean(existingJob),
      job: primaryJob,
      batch: batchRow,
      record,
      candidates,
      summary: {
        totalFiles: files.length,
        parsedCount: parsedUploads.length,
        failedCount: failedUploads.length,
        rankedEligibleCount: rankingUpdates.length,
      },
      failedUploads,
      relatedJobIds,
    });
  } catch (error) {
    console.error("Unexpected parse run error:", error);
    return res.status(500).json({
      status: "error",
      message: error?.message || "Failed to complete parse run.",
    });
  }
});

export default router;
