import express from "express";
import { supabase } from "../lib/supabase.js";
import {
  mapCandidateToResultsRow,
  mapJobToDashboardRecord,
} from "../lib/frontendMappers.js";
import {
  buildJobRankings,
  scoreCandidateAgainstJob,
} from "../services/scoringService.js";

const router = express.Router();

const normalizeCategoryValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const getJobCategoryKey = (job) =>
  normalizeCategoryValue(job?.job_profile || job?.title || "");

const groupJobsByCategory = (jobs = []) => {
  const groups = new Map();

  for (const job of jobs) {
    const key = getJobCategoryKey(job) || normalizeCategoryValue(job?.id);
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        key,
        primaryJob: job,
        jobs: [job],
      });
      continue;
    }

    existing.jobs.push(job);

    const currentPrimaryDate = new Date(existing.primaryJob?.updated_at || existing.primaryJob?.created_at || 0).getTime();
    const nextDate = new Date(job?.updated_at || job?.created_at || 0).getTime();

    if (nextDate >= currentPrimaryDate) {
      existing.primaryJob = job;
    }
  }

  return Array.from(groups.values());
};

const getLatestActivityTimestamp = (job, uploads = [], candidates = []) => {
  const values = [
    job?.updated_at,
    job?.created_at,
    ...uploads.map((upload) => upload?.updated_at || upload?.created_at),
    ...candidates.map((candidate) => candidate?.updated_at || candidate?.created_at),
  ]
    .filter(Boolean)
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value) && value > 0);

  return values.length ? Math.max(...values) : 0;
};

router.get("/", async (req, res) => {
  try {
    const { data: jobs, error } = await supabase
      .from("resume_jobs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch jobs error:", error);
      return res.status(500).json({
        status: "error",
        message: error.message,
      });
    }

    const jobIds = (jobs || []).map((job) => job.id);

    const [{ data: uploads, error: uploadsError }, { data: candidates, error: candidatesError }] =
      await Promise.all([
        jobIds.length
          ? supabase
              .from("resume_uploads")
              .select("id, job_id, parse_status, created_at, updated_at")
              .in("job_id", jobIds)
          : Promise.resolve({ data: [], error: null }),
        jobIds.length
          ? supabase
              .from("resume_candidates")
              .select("id, job_id, ats_score, is_knocked_out, created_at, updated_at")
              .in("job_id", jobIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

    if (uploadsError || candidatesError) {
      console.error("Fetch job aggregates error:", uploadsError || candidatesError);
      return res.status(500).json({
        status: "error",
        message: uploadsError?.message || candidatesError?.message,
      });
    }

    const uploadsByJobId = new Map();
    for (const upload of uploads || []) {
      const current = uploadsByJobId.get(upload.job_id) || [];
      current.push(upload);
      uploadsByJobId.set(upload.job_id, current);
    }

    const candidatesByJobId = new Map();
    for (const candidate of candidates || []) {
      const current = candidatesByJobId.get(candidate.job_id) || [];
      current.push(candidate);
      candidatesByJobId.set(candidate.job_id, current);
    }

    const groupedJobs = groupJobsByCategory(jobs || []);

    const records = groupedJobs
      .map(({ primaryJob, jobs: groupedJobRows }) => {
        const groupedUploads = groupedJobRows.flatMap((job) => uploadsByJobId.get(job.id) || []);
        const groupedCandidates = groupedJobRows.flatMap((job) => candidatesByJobId.get(job.id) || []);
        const latestActivityAt = getLatestActivityTimestamp(
          primaryJob,
          groupedUploads,
          groupedCandidates
        );

        return {
          ...mapJobToDashboardRecord({
            job: primaryJob,
            uploads: groupedUploads,
            candidates: groupedCandidates,
          }),
          latestActivityAt,
        };
      })
      .sort((a, b) => (b.latestActivityAt || 0) - (a.latestActivityAt || 0))
      .map(({ latestActivityAt, ...record }) => record);

    return res.json({
      status: "ok",
      jobs: jobs || [],
      records,
    });
  } catch (error) {
    console.error("Unexpected fetch jobs error:", error);
    return res.status(500).json({
      status: "error",
      message: error?.message || "Failed to fetch jobs.",
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("resume_jobs")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Fetch job by id error:", error);
      return res.status(500).json({
        status: "error",
        message: error.message,
      });
    }

    if (!data) {
      return res.status(404).json({
        status: "error",
        message: "Job not found.",
      });
    }

    return res.json({
      status: "ok",
      job: data,
    });
  } catch (error) {
    console.error("Unexpected fetch job by id error:", error);
    return res.status(500).json({
      status: "error",
      message: error?.message || "Failed to fetch job.",
    });
  }
});

router.get("/:id/candidates", async (req, res) => {
  try {
    const { id } = req.params;

    const { data: job, error: jobError } = await supabase
      .from("resume_jobs")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (jobError) {
      console.error("Fetch job candidates error:", jobError);
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

    const categoryKey = getJobCategoryKey(job);

    const { data: relatedJobs, error: relatedJobsError } = await supabase
      .from("resume_jobs")
      .select("*");

    if (relatedJobsError) {
      console.error("Fetch related jobs error:", relatedJobsError);
      return res.status(500).json({
        status: "error",
        message: relatedJobsError.message,
      });
    }

    const relatedJobRows = (relatedJobs || []).filter(
      (jobRow) => getJobCategoryKey(jobRow) === categoryKey
    );
    const relatedJobIds = relatedJobRows.map((jobRow) => jobRow.id);

    if (!relatedJobIds.length) {
      return res.json({
        status: "ok",
        candidates: [],
        rawCandidates: [],
        relatedJobIds: [],
      });
    }

    const { data: rows, error: rowsError } = await supabase
      .from("resume_candidates")
      .select(`
        *,
        resume_scorecards (*),
        resume_parsed_data (*)
      `)
      .in("job_id", relatedJobIds)
      .order("is_knocked_out", { ascending: true })
      .order("rank_position", { ascending: true, nullsFirst: false })
      .order("ats_score", { ascending: false });

    if (rowsError) {
      console.error("Fetch job candidates error:", rowsError);
      return res.status(500).json({
        status: "error",
        message: rowsError.message,
      });
    }

    const primaryJob =
      [...relatedJobRows].sort(
        (a, b) =>
          new Date(b?.updated_at || b?.created_at || 0).getTime() -
          new Date(a?.updated_at || a?.created_at || 0).getTime()
      )[0] || job;

    const candidates = (rows || []).map((row) =>
      mapCandidateToResultsRow({
        candidate: row,
        scorecard: Array.isArray(row.resume_scorecards) ? row.resume_scorecards[0] || null : null,
        parsedData: Array.isArray(row.resume_parsed_data) ? row.resume_parsed_data[0] || null : null,
        job: primaryJob,
      })
    );

    return res.json({
      status: "ok",
      candidates,
      rawCandidates: rows || [],
      relatedJobIds,
    });
  } catch (error) {
    console.error("Unexpected fetch job candidates error:", error);
    return res.status(500).json({
      status: "error",
      message: error?.message || "Failed to fetch job candidates.",
    });
  }
});

router.post("/:id/score-all", async (req, res) => {
  try {
    const { id } = req.params;

    const { data: jobRow, error: jobError } = await supabase
      .from("resume_jobs")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (jobError) {
      console.error("Fetch job for bulk scoring error:", jobError);
      return res.status(500).json({
        status: "error",
        message: jobError.message,
      });
    }

    if (!jobRow) {
      return res.status(404).json({
        status: "error",
        message: "Job not found.",
      });
    }

    const [{ data: candidates, error: candidatesError }, { data: parsedRows, error: parsedRowsError }] =
      await Promise.all([
        supabase.from("resume_candidates").select("*").eq("job_id", id),
        supabase.from("resume_parsed_data").select("*").in(
          "upload_id",
          (await supabase.from("resume_uploads").select("id").eq("job_id", id)).data?.map((row) => row.id) || []
        ),
      ]);

    if (candidatesError || parsedRowsError) {
      return res.status(500).json({
        status: "error",
        message: candidatesError?.message || parsedRowsError?.message,
      });
    }

    if (!candidates?.length) {
      return res.status(400).json({
        status: "error",
        message: "No parsed candidates found for this job.",
      });
    }

    const parsedByUploadId = Object.fromEntries(
      (parsedRows || []).map((row) => [row.upload_id, row])
    );

    let scoredCount = 0;

    for (const candidate of candidates) {
      const parsedData = parsedByUploadId[candidate.upload_id];
      if (!parsedData) {
        continue;
      }

      const scoringResult = scoreCandidateAgainstJob({
        job: jobRow,
        candidate,
        parsedData,
      });

      const { error: scorecardError } = await supabase
        .from("resume_scorecards")
        .upsert(
          [
            {
              candidate_id: candidate.id,
              job_id: jobRow.id,
              ...scoringResult.scorecard,
            },
          ],
          { onConflict: "candidate_id" }
        );

      if (scorecardError) {
        throw new Error(`Failed to save scorecard for candidate ${candidate.id}: ${scorecardError.message}`);
      }

      const { error: candidateUpdateError } = await supabase
        .from("resume_candidates")
        .update({
          ats_score: scoringResult.totalScore,
          score_color: scoringResult.scoreColor,
          is_knocked_out: scoringResult.isKnockedOut,
          knockout_status: scoringResult.isKnockedOut ? "knocked_out" : "eligible",
          is_recommended: !scoringResult.isKnockedOut && scoringResult.totalScore >= 75,
        })
        .eq("id", candidate.id);

      if (candidateUpdateError) {
        throw new Error(`Failed to update candidate ${candidate.id}: ${candidateUpdateError.message}`);
      }

      scoredCount += 1;
    }

    const { data: refreshedCandidates, error: refreshedCandidatesError } = await supabase
      .from("resume_candidates")
      .select("id, ats_score, is_knocked_out")
      .eq("job_id", jobRow.id);

    if (refreshedCandidatesError) {
      throw new Error(`Failed to fetch candidates for ranking: ${refreshedCandidatesError.message}`);
    }

    const rankingUpdates = buildJobRankings(refreshedCandidates || []);

    for (const row of rankingUpdates) {
      const { error } = await supabase
        .from("resume_candidates")
        .update({ rank_position: row.rank_position })
        .eq("id", row.id);

      if (error) {
        throw new Error(`Failed to update rank positions: ${error.message}`);
      }
    }

    const { error: knockoutResetError } = await supabase
      .from("resume_candidates")
      .update({ rank_position: null })
      .eq("job_id", jobRow.id)
      .eq("is_knocked_out", true);

    if (knockoutResetError) {
      throw new Error(`Failed to clear knocked out rank positions: ${knockoutResetError.message}`);
    }

    return res.json({
      status: "ok",
      message: "All parsed resumes scored successfully.",
      jobId: jobRow.id,
      scoredCount,
      rankedEligibleCount: rankingUpdates.length,
    });
  } catch (error) {
    console.error("Unexpected bulk scoring error:", error);
    return res.status(500).json({
      status: "error",
      message: error?.message || "Failed to score resumes for this job.",
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const {
      created_by = null,
      title,
      job_profile,
      min_experience = 0,
      max_experience = null,
      location = null,
      required_skills = [],
      optional_skills = [],
      description = null,
    } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({
        status: "error",
        message: "Title is required.",
      });
    }

    if (!job_profile?.trim()) {
      return res.status(400).json({
        status: "error",
        message: "Job profile is required.",
      });
    }

    if (!Array.isArray(required_skills)) {
      return res.status(400).json({
        status: "error",
        message: "required_skills must be an array.",
      });
    }

    if (!Array.isArray(optional_skills)) {
      return res.status(400).json({
        status: "error",
        message: "optional_skills must be an array.",
      });
    }

    const payload = {
      created_by,
      title: title.trim(),
      job_profile: job_profile.trim(),
      min_experience: Number(min_experience) || 0,
      max_experience:
        max_experience === null || max_experience === ""
          ? null
          : Number(max_experience),
      location: location?.trim() || null,
      required_skills: required_skills.map((skill) => String(skill).trim()).filter(Boolean),
      optional_skills: optional_skills.map((skill) => String(skill).trim()).filter(Boolean),
      description: description?.trim() || null,
    };

    const { data, error } = await supabase
      .from("resume_jobs")
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error("Create job error:", error);
      return res.status(500).json({
        status: "error",
        message: error.message,
      });
    }

    return res.status(201).json({
      status: "ok",
      message: "Job created successfully.",
      job: data,
    });
  } catch (error) {
    console.error("Unexpected create job error:", error);
    return res.status(500).json({
      status: "error",
      message: error?.message || "Failed to create job.",
    });
  }
});

export default router;
