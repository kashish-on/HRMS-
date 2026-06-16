// import express from "express";
// import { supabase } from "../lib/supabase.js";
// import {
//   mapCandidateToDetail,
//   mapCandidateToResultsRow,
//   mapNote,
// } from "../lib/frontendMappers.js";
// import { sendInterviewNotifications } from "../services/notificationService.js";

// const router = express.Router();

// const ALLOWED_STAGES = new Set([
//   "Applied",
//   "Shortlisted",
//   "Interview Scheduled",
//   "Interviewed",
//   "Offer Extended",
//   "Rejected",
// ]);

// function normalizeStage(stage) {
//   if (typeof stage !== "string") {
//     return null;
//   }

//   const value = stage.trim();
//   return ALLOWED_STAGES.has(value) ? value : null;
// }

// router.get("/:id", async (req, res) => {
//   const { id } = req.params;

//   try {
//     const { data: candidateRow, error: candidateError } = await supabase
//       .from("resume_candidates")
//       .select("*")
//       .eq("id", id)
//       .maybeSingle();

//     if (candidateError) {
//       console.error("Fetch candidate detail error:", candidateError);
//       return res.status(500).json({
//         status: "error",
//         message: candidateError.message,
//       });
//     }

//     if (!candidateRow) {
//       return res.status(404).json({
//         status: "error",
//         message: "Candidate not found.",
//       });
//     }

//     const [
//       { data: jobRow, error: jobError },
//       { data: uploadRow, error: uploadError },
//       { data: parsedDataRow, error: parsedDataError },
//       { data: scorecardRow, error: scorecardError },
//       { data: noteRows, error: notesError },
//     ] = await Promise.all([
//       supabase
//         .from("resume_jobs")
//         .select("*")
//         .eq("id", candidateRow.job_id)
//         .maybeSingle(),
//       supabase
//         .from("resume_uploads")
//         .select("*")
//         .eq("id", candidateRow.upload_id)
//         .maybeSingle(),
//       supabase
//         .from("resume_parsed_data")
//         .select("*")
//         .eq("candidate_id", candidateRow.id)
//         .maybeSingle(),
//       supabase
//         .from("resume_scorecards")
//         .select("*")
//         .eq("candidate_id", candidateRow.id)
//         .maybeSingle(),
//       supabase
//         .from("resume_candidate_notes")
//         .select("*")
//         .eq("candidate_id", candidateRow.id)
//         .order("created_at", { ascending: false }),
//     ]);

//     const firstError =
//       jobError || uploadError || parsedDataError || scorecardError || notesError;

//     if (firstError) {
//       console.error("Fetch candidate related data error:", firstError);
//       return res.status(500).json({
//         status: "error",
//         message: firstError.message,
//       });
//     }

//     return res.json({
//       status: "ok",
//       candidate: mapCandidateToDetail({
//         candidate: candidateRow,
//         scorecard: scorecardRow,
//         parsedData: parsedDataRow,
//         notes: noteRows || [],
//         upload: uploadRow,
//         job: jobRow,
//       }),
//       resultRow: mapCandidateToResultsRow({
//         candidate: candidateRow,
//         scorecard: scorecardRow,
//         job: jobRow,
//       }),
//       raw: {
//         candidate: candidateRow,
//         job: jobRow,
//         upload: uploadRow,
//         parsedData: parsedDataRow,
//         scorecard: scorecardRow,
//         notes: noteRows || [],
//       },
//     });
//   } catch (error) {
//     console.error("Unexpected candidate detail error:", error);
//     return res.status(500).json({
//       status: "error",
//       message: error?.message || "Failed to fetch candidate detail.",
//     });
//   }
// });

// router.delete("/:id", async (req, res) => {
//   const { id } = req.params;

//   try {
//     const { data: candidateRow, error: candidateError } = await supabase
//       .from("resume_candidates")
//       .select("*")
//       .eq("id", id)
//       .maybeSingle();

//     if (candidateError) {
//       console.error("Fetch candidate for delete error:", candidateError);
//       return res.status(500).json({
//         status: "error",
//         message: candidateError.message,
//       });
//     }

//     if (!candidateRow) {
//       return res.status(404).json({
//         status: "error",
//         message: "Candidate not found.",
//       });
//     }

//     const { data: uploadRow, error: uploadError } = await supabase
//       .from("resume_uploads")
//       .select("*")
//       .eq("id", candidateRow.upload_id)
//       .maybeSingle();

//     if (uploadError) {
//       console.error("Fetch upload for delete error:", uploadError);
//       return res.status(500).json({
//         status: "error",
//         message: uploadError.message,
//       });
//     }

//     const deleteOperations = [
//       supabase.from("resume_candidate_notes").delete().eq("candidate_id", id),
//       supabase.from("resume_candidate_interviews").delete().eq("candidate_id", id),
//       supabase.from("resume_candidate_offers").delete().eq("candidate_id", id),
//       supabase.from("resume_scorecards").delete().eq("candidate_id", id),
//       supabase.from("resume_parsed_data").delete().eq("candidate_id", id),
//     ];

//     const deleteResults = await Promise.all(deleteOperations);
//     const firstDeleteError = deleteResults.find((result) => result.error)?.error;

//     if (firstDeleteError) {
//       console.error("Delete candidate related rows error:", firstDeleteError);
//       return res.status(500).json({
//         status: "error",
//         message: firstDeleteError.message,
//       });
//     }

//     const { error: candidateDeleteError } = await supabase
//       .from("resume_candidates")
//       .delete()
//       .eq("id", id);

//     if (candidateDeleteError) {
//       console.error("Delete candidate row error:", candidateDeleteError);
//       return res.status(500).json({
//         status: "error",
//         message: candidateDeleteError.message,
//       });
//     }

//     if (uploadRow?.id) {
//       const { error: parsedDataByUploadError } = await supabase
//         .from("resume_parsed_data")
//         .delete()
//         .eq("upload_id", uploadRow.id);

//       if (parsedDataByUploadError) {
//         console.error("Delete parsed data by upload error:", parsedDataByUploadError);
//         return res.status(500).json({
//           status: "error",
//           message: parsedDataByUploadError.message,
//         });
//       }

//       const { error: uploadDeleteError } = await supabase
//         .from("resume_uploads")
//         .delete()
//         .eq("id", uploadRow.id);

//       if (uploadDeleteError) {
//         console.error("Delete upload row error:", uploadDeleteError);
//         return res.status(500).json({
//           status: "error",
//           message: uploadDeleteError.message,
//         });
//       }

//       if (uploadRow.storage_bucket && uploadRow.storage_path) {
//         const { error: storageDeleteError } = await supabase.storage
//           .from(uploadRow.storage_bucket)
//           .remove([uploadRow.storage_path]);

//         if (storageDeleteError) {
//           console.error("Delete uploaded resume file error:", storageDeleteError);
//         }
//       }
//     }

//     return res.json({
//       status: "ok",
//       message: "Resume deleted successfully.",
//       deletedCandidateId: id,
//       deletedUploadId: uploadRow?.id || null,
//       jobId: candidateRow.job_id,
//     });
//   } catch (error) {
//     console.error("Unexpected candidate delete error:", error);
//     return res.status(500).json({
//       status: "error",
//       message: error?.message || "Failed to delete resume.",
//     });
//   }
// });

// router.patch("/bulk-stage", async (req, res) => {
//   const { candidateIds, stage } = req.body || {};
//   const normalizedStage = normalizeStage(stage);
//   const ids = Array.isArray(candidateIds)
//     ? candidateIds.filter((value) => typeof value === "string" && value.trim())
//     : [];

//   if (!ids.length) {
//     return res.status(400).json({
//       status: "error",
//       message: "candidateIds is required.",
//     });
//   }

//   if (!normalizedStage) {
//     return res.status(400).json({
//       status: "error",
//       message: "A valid stage is required.",
//     });
//   }

//   try {
//     const { data, error } = await supabase
//       .from("resume_candidates")
//       .update({
//         stage: normalizedStage,
//         status_updated_at: new Date().toISOString(),
//       })
//       .in("id", ids)
//       .select("*");

//     if (error) {
//       console.error("Bulk update candidate stage error:", error);
//       return res.status(500).json({
//         status: "error",
//         message: error.message,
//       });
//     }

//     return res.json({
//       status: "ok",
//       message: "Candidate stages updated successfully.",
//       candidates: data || [],
//       updatedCount: data?.length || 0,
//     });
//   } catch (error) {
//     console.error("Unexpected bulk stage update error:", error);
//     return res.status(500).json({
//       status: "error",
//       message: error?.message || "Failed to update candidate stages.",
//     });
//   }
// });

// router.patch("/:id/stage", async (req, res) => {
//   const { id } = req.params;
//   const normalizedStage = normalizeStage(req.body?.stage);

//   if (!normalizedStage) {
//     return res.status(400).json({
//       status: "error",
//       message: "A valid stage is required.",
//     });
//   }

//   try {
//     const { data, error } = await supabase
//       .from("resume_candidates")
//       .update({
//         stage: normalizedStage,
//         status_updated_at: new Date().toISOString(),
//       })
//       .eq("id", id)
//       .select("*")
//       .maybeSingle();

//     if (error) {
//       console.error("Update candidate stage error:", error);
//       return res.status(500).json({
//         status: "error",
//         message: error.message,
//       });
//     }

//     if (!data) {
//       return res.status(404).json({
//         status: "error",
//         message: "Candidate not found.",
//       });
//     }

//     return res.json({
//       status: "ok",
//       message: "Candidate stage updated successfully.",
//       candidate: data,
//     });
//   } catch (error) {
//     console.error("Unexpected stage update error:", error);
//     return res.status(500).json({
//       status: "error",
//       message: error?.message || "Failed to update candidate stage.",
//     });
//   }
// });

// router.get("/:id/notes", async (req, res) => {
//   const { id } = req.params;

//   try {
//     const { data, error } = await supabase
//       .from("resume_candidate_notes")
//       .select("*")
//       .eq("candidate_id", id)
//       .order("created_at", { ascending: false });

//     if (error) {
//       console.error("Fetch candidate notes error:", error);
//       return res.status(500).json({
//         status: "error",
//         message: error.message,
//       });
//     }

//     return res.json({
//       status: "ok",
//       notes: (data || []).map(mapNote),
//       rawNotes: data || [],
//     });
//   } catch (error) {
//     console.error("Unexpected notes fetch error:", error);
//     return res.status(500).json({
//       status: "error",
//       message: error?.message || "Failed to fetch candidate notes.",
//     });
//   }
// });

// router.post("/:id/notes", async (req, res) => {
//   const { id } = req.params;
//   const noteText = req.body?.note_text?.trim();
//   const createdBy = req.body?.created_by?.trim() || "HR Team";

//   if (!noteText) {
//     return res.status(400).json({
//       status: "error",
//       message: "note_text is required.",
//     });
//   }

//   try {
//     const { data, error } = await supabase
//       .from("resume_candidate_notes")
//       .insert([
//         {
//           candidate_id: id,
//           created_by: createdBy,
//           note_text: noteText,
//         },
//       ])
//       .select("*")
//       .single();

//     if (error) {
//       console.error("Create candidate note error:", error);
//       return res.status(500).json({
//         status: "error",
//         message: error.message,
//       });
//     }

//     return res.status(201).json({
//       status: "ok",
//       message: "Candidate note added successfully.",
//       note: mapNote(data),
//       rawNote: data,
//     });
//   } catch (error) {
//     console.error("Unexpected create note error:", error);
//     return res.status(500).json({
//       status: "error",
//       message: error?.message || "Failed to add candidate note.",
//     });
//   }
// });

// router.get("/:id/interviews", async (req, res) => {
//   const { id } = req.params;

//   try {
//     const { data, error } = await supabase
//       .from("resume_candidate_interviews")
//       .select("*")
//       .eq("candidate_id", id)
//       .order("created_at", { ascending: false });

//     if (error) {
//       console.error("Fetch candidate interviews error:", error);
//       return res.status(500).json({
//         status: "error",
//         message: error.message,
//       });
//     }

//     return res.json({
//       status: "ok",
//       interviews: data || [],
//     });
//   } catch (error) {
//     console.error("Unexpected interviews fetch error:", error);
//     return res.status(500).json({
//       status: "error",
//       message: error?.message || "Failed to fetch interviews.",
//     });
//   }
// });

// router.post("/:id/interviews", async (req, res) => {
//   const { id } = req.params;
//   const {
//     job_id,
//     interview_type,
//     round,
//     interviewers = [],
//     scheduled_date = null,
//     scheduled_slot = null,
//     duration_minutes = null,
//     notify_via = null,
//     message = null,
//   } = req.body || {};

//   if (!job_id?.trim() || !interview_type?.trim() || !round?.trim()) {
//     return res.status(400).json({
//       status: "error",
//       message: "job_id, interview_type, and round are required.",
//     });
//   }

//   try {
//     const { data, error } = await supabase
//       .from("resume_candidate_interviews")
//       .insert([
//         {
//           candidate_id: id,
//           job_id: job_id.trim(),
//           interview_type: interview_type.trim(),
//           round: round.trim(),
//           interviewers: Array.isArray(interviewers) ? interviewers : [],
//           scheduled_date,
//           scheduled_slot,
//           duration_minutes,
//           notify_via,
//           message,
//           status: "scheduled",
//         },
//       ])
//       .select("*")
//       .single();

//     if (error) {
//       console.error("Create candidate interview error:", error);
//       return res.status(500).json({
//         status: "error",
//         message: error.message,
//       });
//     }

//     await supabase
//       .from("resume_candidates")
//       .update({
//         stage: "Interview Scheduled",
//         status_updated_at: new Date().toISOString(),
//       })
//       .eq("id", id);

//     // Send notifications (email / WhatsApp) — fire-and-forget, don't block response
//     try {
//       // Fetch candidate and job details for notification
//       const [{ data: candidateRow }, { data: jobRow }] = await Promise.all([
//         supabase.from("resume_candidates").select("full_name, email, phone").eq("id", id).single(),
//         supabase.from("resume_jobs").select("title").eq("id", job_id.trim()).single(),
//       ]);

//       const notifResults = await sendInterviewNotifications(data, candidateRow, jobRow);

//       if (notifResults.errors.length > 0) {
//         console.warn("Interview notification partial errors:", notifResults.errors);
//       } else {
//         console.log("Interview notifications sent:", {
//           candidateEmail: notifResults.candidateEmail?.status,
//           interviewerEmails: notifResults.interviewerEmails.length,
//           whatsapp: notifResults.candidateWhatsApp?.status,
//         });
//       }
//     } catch (notifErr) {
//       // Never block the main response due to notification failure
//       console.error("Interview notification error (non-blocking):", notifErr.message);
//     }

//     return res.status(201).json({
//       status: "ok",
//       message: "Interview scheduled successfully.",
//       interview: data,
//     });
//   } catch (error) {
//     console.error("Unexpected create interview error:", error);
//     return res.status(500).json({
//       status: "error",
//       message: error?.message || "Failed to schedule interview.",
//     });
//   }
// });

// router.post("/:id/offers", async (req, res) => {
//   const { id } = req.params;
//   const {
//     job_id,
//     designation,
//     ctc = null,
//     joining_date = null,
//     reporting_to = null,
//     additional_note = null,
//     status = "generated",
//   } = req.body || {};

//   if (!job_id?.trim() || !designation?.trim()) {
//     return res.status(400).json({
//       status: "error",
//       message: "job_id and designation are required.",
//     });
//   }

//   try {
//     const { data, error } = await supabase
//       .from("resume_candidate_offers")
//       .insert([
//         {
//           candidate_id: id,
//           job_id: job_id.trim(),
//           designation: designation.trim(),
//           ctc,
//           joining_date,
//           reporting_to,
//           additional_note,
//           status,
//         },
//       ])
//       .select("*")
//       .single();

//     if (error) {
//       console.error("Create candidate offer error:", error);
//       return res.status(500).json({
//         status: "error",
//         message: error.message,
//       });
//     }

//     await supabase
//       .from("resume_candidates")
//       .update({
//         stage: "Offer Extended",
//         status_updated_at: new Date().toISOString(),
//       })
//       .eq("id", id);

//     return res.status(201).json({
//       status: "ok",
//       message: "Offer saved successfully.",
//       offer: data,
//     });
//   } catch (error) {
//     console.error("Unexpected create offer error:", error);
//     return res.status(500).json({
//       status: "error",
//       message: error?.message || "Failed to save offer.",
//     });
//   }
// });

// router.post("/:id/reject", async (req, res) => {
//   const { id } = req.params;
//   const { job_id = null, designation = "Rejected Candidate", additional_note = null } =
//     req.body || {};

//   try {
//     if (job_id?.trim()) {
//       await supabase.from("resume_candidate_offers").insert([
//         {
//           candidate_id: id,
//           job_id: job_id.trim(),
//           designation,
//           additional_note,
//           status: "rejected",
//         },
//       ]);
//     }

//     const { data, error } = await supabase
//       .from("resume_candidates")
//       .update({
//         stage: "Rejected",
//         status_updated_at: new Date().toISOString(),
//       })
//       .eq("id", id)
//       .select("*")
//       .maybeSingle();

//     if (error) {
//       console.error("Reject candidate error:", error);
//       return res.status(500).json({
//         status: "error",
//         message: error.message,
//       });
//     }

//     if (!data) {
//       return res.status(404).json({
//         status: "error",
//         message: "Candidate not found.",
//       });
//     }

//     return res.json({
//       status: "ok",
//       message: "Candidate rejected successfully.",
//       candidate: data,
//     });
//   } catch (error) {
//     console.error("Unexpected candidate rejection error:", error);
//     return res.status(500).json({
//       status: "error",
//       message: error?.message || "Failed to reject candidate.",
//     });
//   }
// });

// export default router;

// import express from "express";
// import { supabase } from "../lib/supabase.js";
// import {
//   mapCandidateToDetail,
//   mapCandidateToResultsRow,
//   mapNote,
// } from "../lib/frontendMappers.js";

// const router = express.Router();

// const ALLOWED_STAGES = new Set([
//   "Applied",
//   "Shortlisted",
//   "Interview Scheduled",
//   "Interviewed",
//   "Offer Extended",
//   "Rejected",
// ]);

// function normalizeStage(stage) {
//   if (typeof stage !== "string") {
//     return null;
//   }

//   const value = stage.trim();
//   return ALLOWED_STAGES.has(value) ? value : null;
// }

// router.get("/:id", async (req, res) => {
//   const { id } = req.params;

//   try {
//     const { data: candidateRow, error: candidateError } = await supabase
//       .from("resume_candidates")
//       .select("*")
//       .eq("id", id)
//       .maybeSingle();

//     if (candidateError) {
//       console.error("Fetch candidate detail error:", candidateError);
//       return res.status(500).json({
//         status: "error",
//         message: candidateError.message,
//       });
//     }

//     if (!candidateRow) {
//       return res.status(404).json({
//         status: "error",
//         message: "Candidate not found.",
//       });
//     }

//     const [
//       { data: jobRow, error: jobError },
//       { data: uploadRow, error: uploadError },
//       { data: parsedDataRow, error: parsedDataError },
//       { data: scorecardRow, error: scorecardError },
//       { data: noteRows, error: notesError },
//     ] = await Promise.all([
//       supabase
//         .from("resume_jobs")
//         .select("*")
//         .eq("id", candidateRow.job_id)
//         .maybeSingle(),
//       supabase
//         .from("resume_uploads")
//         .select("*")
//         .eq("id", candidateRow.upload_id)
//         .maybeSingle(),
//       supabase
//         .from("resume_parsed_data")
//         .select("*")
//         .eq("candidate_id", candidateRow.id)
//         .maybeSingle(),
//       supabase
//         .from("resume_scorecards")
//         .select("*")
//         .eq("candidate_id", candidateRow.id)
//         .maybeSingle(),
//       supabase
//         .from("resume_candidate_notes")
//         .select("*")
//         .eq("candidate_id", candidateRow.id)
//         .order("created_at", { ascending: false }),
//     ]);

//     const firstError =
//       jobError || uploadError || parsedDataError || scorecardError || notesError;

//     if (firstError) {
//       console.error("Fetch candidate related data error:", firstError);
//       return res.status(500).json({
//         status: "error",
//         message: firstError.message,
//       });
//     }

//     return res.json({
//       status: "ok",
//       candidate: mapCandidateToDetail({
//         candidate: candidateRow,
//         scorecard: scorecardRow,
//         parsedData: parsedDataRow,
//         notes: noteRows || [],
//         upload: uploadRow,
//         job: jobRow,
//       }),
//       resultRow: mapCandidateToResultsRow({
//         candidate: candidateRow,
//         scorecard: scorecardRow,
//         job: jobRow,
//       }),
//       raw: {
//         candidate: candidateRow,
//         job: jobRow,
//         upload: uploadRow,
//         parsedData: parsedDataRow,
//         scorecard: scorecardRow,
//         notes: noteRows || [],
//       },
//     });
//   } catch (error) {
//     console.error("Unexpected candidate detail error:", error);
//     return res.status(500).json({
//       status: "error",
//       message: error?.message || "Failed to fetch candidate detail.",
//     });
//   }
// });

// router.delete("/:id", async (req, res) => {
//   const { id } = req.params;

//   try {
//     const { data: candidateRow, error: candidateError } = await supabase
//       .from("resume_candidates")
//       .select("*")
//       .eq("id", id)
//       .maybeSingle();

//     if (candidateError) {
//       console.error("Fetch candidate for delete error:", candidateError);
//       return res.status(500).json({
//         status: "error",
//         message: candidateError.message,
//       });
//     }

//     if (!candidateRow) {
//       return res.status(404).json({
//         status: "error",
//         message: "Candidate not found.",
//       });
//     }

//     const { data: uploadRow, error: uploadError } = await supabase
//       .from("resume_uploads")
//       .select("*")
//       .eq("id", candidateRow.upload_id)
//       .maybeSingle();

//     if (uploadError) {
//       console.error("Fetch upload for delete error:", uploadError);
//       return res.status(500).json({
//         status: "error",
//         message: uploadError.message,
//       });
//     }

//     const deleteOperations = [
//       supabase.from("resume_candidate_notes").delete().eq("candidate_id", id),
//       supabase.from("resume_candidate_interviews").delete().eq("candidate_id", id),
//       supabase.from("resume_candidate_offers").delete().eq("candidate_id", id),
//       supabase.from("resume_scorecards").delete().eq("candidate_id", id),
//       supabase.from("resume_parsed_data").delete().eq("candidate_id", id),
//     ];

//     const deleteResults = await Promise.all(deleteOperations);
//     const firstDeleteError = deleteResults.find((result) => result.error)?.error;

//     if (firstDeleteError) {
//       console.error("Delete candidate related rows error:", firstDeleteError);
//       return res.status(500).json({
//         status: "error",
//         message: firstDeleteError.message,
//       });
//     }

//     const { error: candidateDeleteError } = await supabase
//       .from("resume_candidates")
//       .delete()
//       .eq("id", id);

//     if (candidateDeleteError) {
//       console.error("Delete candidate row error:", candidateDeleteError);
//       return res.status(500).json({
//         status: "error",
//         message: candidateDeleteError.message,
//       });
//     }

//     if (uploadRow?.id) {
//       const { error: parsedDataByUploadError } = await supabase
//         .from("resume_parsed_data")
//         .delete()
//         .eq("upload_id", uploadRow.id);

//       if (parsedDataByUploadError) {
//         console.error("Delete parsed data by upload error:", parsedDataByUploadError);
//         return res.status(500).json({
//           status: "error",
//           message: parsedDataByUploadError.message,
//         });
//       }

//       const { error: uploadDeleteError } = await supabase
//         .from("resume_uploads")
//         .delete()
//         .eq("id", uploadRow.id);

//       if (uploadDeleteError) {
//         console.error("Delete upload row error:", uploadDeleteError);
//         return res.status(500).json({
//           status: "error",
//           message: uploadDeleteError.message,
//         });
//       }

//       if (uploadRow.storage_bucket && uploadRow.storage_path) {
//         const { error: storageDeleteError } = await supabase.storage
//           .from(uploadRow.storage_bucket)
//           .remove([uploadRow.storage_path]);

//         if (storageDeleteError) {
//           console.error("Delete uploaded resume file error:", storageDeleteError);
//         }
//       }
//     }

//     return res.json({
//       status: "ok",
//       message: "Resume deleted successfully.",
//       deletedCandidateId: id,
//       deletedUploadId: uploadRow?.id || null,
//       jobId: candidateRow.job_id,
//     });
//   } catch (error) {
//     console.error("Unexpected candidate delete error:", error);
//     return res.status(500).json({
//       status: "error",
//       message: error?.message || "Failed to delete resume.",
//     });
//   }
// });

// router.patch("/bulk-stage", async (req, res) => {
//   const { candidateIds, stage } = req.body || {};
//   const normalizedStage = normalizeStage(stage);
//   const ids = Array.isArray(candidateIds)
//     ? candidateIds.filter((value) => typeof value === "string" && value.trim())
//     : [];

//   if (!ids.length) {
//     return res.status(400).json({
//       status: "error",
//       message: "candidateIds is required.",
//     });
//   }

//   if (!normalizedStage) {
//     return res.status(400).json({
//       status: "error",
//       message: "A valid stage is required.",
//     });
//   }

//   try {
//     const { data, error } = await supabase
//       .from("resume_candidates")
//       .update({
//         stage: normalizedStage,
//         status_updated_at: new Date().toISOString(),
//       })
//       .in("id", ids)
//       .select("*");

//     if (error) {
//       console.error("Bulk update candidate stage error:", error);
//       return res.status(500).json({
//         status: "error",
//         message: error.message,
//       });
//     }

//     return res.json({
//       status: "ok",
//       message: "Candidate stages updated successfully.",
//       candidates: data || [],
//       updatedCount: data?.length || 0,
//     });
//   } catch (error) {
//     console.error("Unexpected bulk stage update error:", error);
//     return res.status(500).json({
//       status: "error",
//       message: error?.message || "Failed to update candidate stages.",
//     });
//   }
// });

// router.patch("/:id/stage", async (req, res) => {
//   const { id } = req.params;
//   const normalizedStage = normalizeStage(req.body?.stage);

//   if (!normalizedStage) {
//     return res.status(400).json({
//       status: "error",
//       message: "A valid stage is required.",
//     });
//   }

//   try {
//     const { data, error } = await supabase
//       .from("resume_candidates")
//       .update({
//         stage: normalizedStage,
//         status_updated_at: new Date().toISOString(),
//       })
//       .eq("id", id)
//       .select("*")
//       .maybeSingle();

//     if (error) {
//       console.error("Update candidate stage error:", error);
//       return res.status(500).json({
//         status: "error",
//         message: error.message,
//       });
//     }

//     if (!data) {
//       return res.status(404).json({
//         status: "error",
//         message: "Candidate not found.",
//       });
//     }

//     return res.json({
//       status: "ok",
//       message: "Candidate stage updated successfully.",
//       candidate: data,
//     });
//   } catch (error) {
//     console.error("Unexpected stage update error:", error);
//     return res.status(500).json({
//       status: "error",
//       message: error?.message || "Failed to update candidate stage.",
//     });
//   }
// });

// router.get("/:id/notes", async (req, res) => {
//   const { id } = req.params;

//   try {
//     const { data, error } = await supabase
//       .from("resume_candidate_notes")
//       .select("*")
//       .eq("candidate_id", id)
//       .order("created_at", { ascending: false });

//     if (error) {
//       console.error("Fetch candidate notes error:", error);
//       return res.status(500).json({
//         status: "error",
//         message: error.message,
//       });
//     }

//     return res.json({
//       status: "ok",
//       notes: (data || []).map(mapNote),
//       rawNotes: data || [],
//     });
//   } catch (error) {
//     console.error("Unexpected notes fetch error:", error);
//     return res.status(500).json({
//       status: "error",
//       message: error?.message || "Failed to fetch candidate notes.",
//     });
//   }
// });

// router.post("/:id/notes", async (req, res) => {
//   const { id } = req.params;
//   const noteText = req.body?.note_text?.trim();
//   const createdBy = req.body?.created_by?.trim() || "HR Team";

//   if (!noteText) {
//     return res.status(400).json({
//       status: "error",
//       message: "note_text is required.",
//     });
//   }

//   try {
//     const { data, error } = await supabase
//       .from("resume_candidate_notes")
//       .insert([
//         {
//           candidate_id: id,
//           created_by: createdBy,
//           note_text: noteText,
//         },
//       ])
//       .select("*")
//       .single();

//     if (error) {
//       console.error("Create candidate note error:", error);
//       return res.status(500).json({
//         status: "error",
//         message: error.message,
//       });
//     }

//     return res.status(201).json({
//       status: "ok",
//       message: "Candidate note added successfully.",
//       note: mapNote(data),
//       rawNote: data,
//     });
//   } catch (error) {
//     console.error("Unexpected create note error:", error);
//     return res.status(500).json({
//       status: "error",
//       message: error?.message || "Failed to add candidate note.",
//     });
//   }
// });

// router.get("/:id/interviews", async (req, res) => {
//   const { id } = req.params;

//   try {
//     const { data, error } = await supabase
//       .from("resume_candidate_interviews")
//       .select("*")
//       .eq("candidate_id", id)
//       .order("created_at", { ascending: false });

//     if (error) {
//       console.error("Fetch candidate interviews error:", error);
//       return res.status(500).json({
//         status: "error",
//         message: error.message,
//       });
//     }

//     return res.json({
//       status: "ok",
//       interviews: data || [],
//     });
//   } catch (error) {
//     console.error("Unexpected interviews fetch error:", error);
//     return res.status(500).json({
//       status: "error",
//       message: error?.message || "Failed to fetch interviews.",
//     });
//   }
// });

// router.post("/:id/interviews", async (req, res) => {
//   const { id } = req.params;
//   const {
//     job_id,
//     interview_type,
//     round,
//     interviewers = [],
//     scheduled_date = null,
//     scheduled_slot = null,
//     duration_minutes = null,
//     notify_via = null,
//     message = null,
//   } = req.body || {};

//   if (!job_id?.trim() || !interview_type?.trim() || !round?.trim()) {
//     return res.status(400).json({
//       status: "error",
//       message: "job_id, interview_type, and round are required.",
//     });
//   }

//   try {
//     const { data, error } = await supabase
//       .from("resume_candidate_interviews")
//       .insert([
//         {
//           candidate_id: id,
//           job_id: job_id.trim(),
//           interview_type: interview_type.trim(),
//           round: round.trim(),
//           interviewers: Array.isArray(interviewers) ? interviewers : [],
//           scheduled_date,
//           scheduled_slot,
//           duration_minutes,
//           notify_via,
//           message,
//           status: "scheduled",
//         },
//       ])
//       .select("*")
//       .single();

//     if (error) {
//       console.error("Create candidate interview error:", error);
//       return res.status(500).json({
//         status: "error",
//         message: error.message,
//       });
//     }

//     await supabase
//       .from("resume_candidates")
//       .update({
//         stage: "Interview Scheduled",
//         status_updated_at: new Date().toISOString(),
//       })
//       .eq("id", id);

//     return res.status(201).json({
//       status: "ok",
//       message: "Interview scheduled successfully.",
//       interview: data,
//     });
//   } catch (error) {
//     console.error("Unexpected create interview error:", error);
//     return res.status(500).json({
//       status: "error",
//       message: error?.message || "Failed to schedule interview.",
//     });
//   }
// });

// router.post("/:id/offers", async (req, res) => {
//   const { id } = req.params;
//   const {
//     job_id,
//     designation,
//     ctc = null,
//     joining_date = null,
//     reporting_to = null,
//     additional_note = null,
//     status = "generated",
//   } = req.body || {};

//   if (!job_id?.trim() || !designation?.trim()) {
//     return res.status(400).json({
//       status: "error",
//       message: "job_id and designation are required.",
//     });
//   }

//   try {
//     const { data, error } = await supabase
//       .from("resume_candidate_offers")
//       .insert([
//         {
//           candidate_id: id,
//           job_id: job_id.trim(),
//           designation: designation.trim(),
//           ctc,
//           joining_date,
//           reporting_to,
//           additional_note,
//           status,
//         },
//       ])
//       .select("*")
//       .single();

//     if (error) {
//       console.error("Create candidate offer error:", error);
//       return res.status(500).json({
//         status: "error",
//         message: error.message,
//       });
//     }

//     await supabase
//       .from("resume_candidates")
//       .update({
//         stage: "Offer Extended",
//         status_updated_at: new Date().toISOString(),
//       })
//       .eq("id", id);

//     return res.status(201).json({
//       status: "ok",
//       message: "Offer saved successfully.",
//       offer: data,
//     });
//   } catch (error) {
//     console.error("Unexpected create offer error:", error);
//     return res.status(500).json({
//       status: "error",
//       message: error?.message || "Failed to save offer.",
//     });
//   }
// });

// router.post("/:id/reject", async (req, res) => {
//   const { id } = req.params;
//   const { job_id = null, designation = "Rejected Candidate", additional_note = null } =
//     req.body || {};

//   try {
//     if (job_id?.trim()) {
//       await supabase.from("resume_candidate_offers").insert([
//         {
//           candidate_id: id,
//           job_id: job_id.trim(),
//           designation,
//           additional_note,
//           status: "rejected",
//         },
//       ]);
//     }

//     const { data, error } = await supabase
//       .from("resume_candidates")
//       .update({
//         stage: "Rejected",
//         status_updated_at: new Date().toISOString(),
//       })
//       .eq("id", id)
//       .select("*")
//       .maybeSingle();

//     if (error) {
//       console.error("Reject candidate error:", error);
//       return res.status(500).json({
//         status: "error",
//         message: error.message,
//       });
//     }

//     if (!data) {
//       return res.status(404).json({
//         status: "error",
//         message: "Candidate not found.",
//       });
//     }

//     return res.json({
//       status: "ok",
//       message: "Candidate rejected successfully.",
//       candidate: data,
//     });
//   } catch (error) {
//     console.error("Unexpected candidate rejection error:", error);
//     return res.status(500).json({
//       status: "error",
//       message: error?.message || "Failed to reject candidate.",
//     });
//   }
// });

// export default router;

import express from "express";
import multer from "multer";
import { supabase } from "../lib/supabase.js";
import {
  mapCandidateToDetail,
  mapCandidateToResultsRow,
  mapNote,
} from "../lib/frontendMappers.js";
import {
  sendInterviewNotifications,
  sendRejectionEmail,
  sendOfferEmail,
} from "../services/notificationService.js";
 
const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const allowedOfferMimeTypes = new Set(["application/pdf"]);
 
const ALLOWED_STAGES = new Set([
  "Applied",
  "Shortlisted",
  "Interview Scheduled",
  "Interviewed",
  "Offer Extended",
  "Rejected",
]);
 
function normalizeStage(stage) {
  if (typeof stage !== "string") {
    return null;
  }
 
  const value = stage.trim();
  return ALLOWED_STAGES.has(value) ? value : null;
}
 
router.get("/:id", async (req, res) => {
  const { id } = req.params;
 
  try {
    const { data: candidateRow, error: candidateError } = await supabase
      .from("resume_candidates")
      .select("*")
      .eq("id", id)
      .maybeSingle();
 
    if (candidateError) {
      console.error("Fetch candidate detail error:", candidateError);
      return res.status(500).json({
        status: "error",
        message: candidateError.message,
      });
    }
 
    if (!candidateRow) {
      return res.status(404).json({
        status: "error",
        message: "Candidate not found.",
      });
    }
 
    const [
      { data: jobRow, error: jobError },
      { data: uploadRow, error: uploadError },
      { data: parsedDataRow, error: parsedDataError },
      { data: scorecardRow, error: scorecardError },
      { data: noteRows, error: notesError },
    ] = await Promise.all([
      supabase
        .from("resume_jobs")
        .select("*")
        .eq("id", candidateRow.job_id)
        .maybeSingle(),
      supabase
        .from("resume_uploads")
        .select("*")
        .eq("id", candidateRow.upload_id)
        .maybeSingle(),
      supabase
        .from("resume_parsed_data")
        .select("*")
        .eq("candidate_id", candidateRow.id)
        .maybeSingle(),
      supabase
        .from("resume_scorecards")
        .select("*")
        .eq("candidate_id", candidateRow.id)
        .maybeSingle(),
      supabase
        .from("resume_candidate_notes")
        .select("*")
        .eq("candidate_id", candidateRow.id)
        .order("created_at", { ascending: false }),
    ]);
 
    const firstError =
      jobError || uploadError || parsedDataError || scorecardError || notesError;
 
    if (firstError) {
      console.error("Fetch candidate related data error:", firstError);
      return res.status(500).json({
        status: "error",
        message: firstError.message,
      });
    }
 
    return res.json({
      status: "ok",
      candidate: mapCandidateToDetail({
        candidate: candidateRow,
        scorecard: scorecardRow,
        parsedData: parsedDataRow,
        notes: noteRows || [],
        upload: uploadRow,
        job: jobRow,
      }),
      resultRow: mapCandidateToResultsRow({
        candidate: candidateRow,
        scorecard: scorecardRow,
        job: jobRow,
      }),
      raw: {
        candidate: candidateRow,
        job: jobRow,
        upload: uploadRow,
        parsedData: parsedDataRow,
        scorecard: scorecardRow,
        notes: noteRows || [],
      },
    });
  } catch (error) {
    console.error("Unexpected candidate detail error:", error);
    return res.status(500).json({
      status: "error",
      message: error?.message || "Failed to fetch candidate detail.",
    });
  }
});
 
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
 
  try {
    const { data: candidateRow, error: candidateError } = await supabase
      .from("resume_candidates")
      .select("*")
      .eq("id", id)
      .maybeSingle();
 
    if (candidateError) {
      console.error("Fetch candidate for delete error:", candidateError);
      return res.status(500).json({
        status: "error",
        message: candidateError.message,
      });
    }
 
    if (!candidateRow) {
      return res.status(404).json({
        status: "error",
        message: "Candidate not found.",
      });
    }
 
    const { data: uploadRow, error: uploadError } = await supabase
      .from("resume_uploads")
      .select("*")
      .eq("id", candidateRow.upload_id)
      .maybeSingle();
 
    if (uploadError) {
      console.error("Fetch upload for delete error:", uploadError);
      return res.status(500).json({
        status: "error",
        message: uploadError.message,
      });
    }
 
    const deleteOperations = [
      supabase.from("resume_candidate_notes").delete().eq("candidate_id", id),
      supabase.from("resume_candidate_interviews").delete().eq("candidate_id", id),
      supabase.from("resume_candidate_offers").delete().eq("candidate_id", id),
      supabase.from("resume_scorecards").delete().eq("candidate_id", id),
      supabase.from("resume_parsed_data").delete().eq("candidate_id", id),
    ];
 
    const deleteResults = await Promise.all(deleteOperations);
    const firstDeleteError = deleteResults.find((result) => result.error)?.error;
 
    if (firstDeleteError) {
      console.error("Delete candidate related rows error:", firstDeleteError);
      return res.status(500).json({
        status: "error",
        message: firstDeleteError.message,
      });
    }
 
    const { error: candidateDeleteError } = await supabase
      .from("resume_candidates")
      .delete()
      .eq("id", id);
 
    if (candidateDeleteError) {
      console.error("Delete candidate row error:", candidateDeleteError);
      return res.status(500).json({
        status: "error",
        message: candidateDeleteError.message,
      });
    }
 
    if (uploadRow?.id) {
      const { error: parsedDataByUploadError } = await supabase
        .from("resume_parsed_data")
        .delete()
        .eq("upload_id", uploadRow.id);
 
      if (parsedDataByUploadError) {
        console.error("Delete parsed data by upload error:", parsedDataByUploadError);
        return res.status(500).json({
          status: "error",
          message: parsedDataByUploadError.message,
        });
      }
 
      const { error: uploadDeleteError } = await supabase
        .from("resume_uploads")
        .delete()
        .eq("id", uploadRow.id);
 
      if (uploadDeleteError) {
        console.error("Delete upload row error:", uploadDeleteError);
        return res.status(500).json({
          status: "error",
          message: uploadDeleteError.message,
        });
      }
 
      if (uploadRow.storage_bucket && uploadRow.storage_path) {
        const { error: storageDeleteError } = await supabase.storage
          .from(uploadRow.storage_bucket)
          .remove([uploadRow.storage_path]);
 
        if (storageDeleteError) {
          console.error("Delete uploaded resume file error:", storageDeleteError);
        }
      }
    }
 
    return res.json({
      status: "ok",
      message: "Resume deleted successfully.",
      deletedCandidateId: id,
      deletedUploadId: uploadRow?.id || null,
      jobId: candidateRow.job_id,
    });
  } catch (error) {
    console.error("Unexpected candidate delete error:", error);
    return res.status(500).json({
      status: "error",
      message: error?.message || "Failed to delete resume.",
    });
  }
});
 
router.patch("/bulk-stage", async (req, res) => {
  const { candidateIds, stage } = req.body || {};
  const normalizedStage = normalizeStage(stage);
  const ids = Array.isArray(candidateIds)
    ? candidateIds.filter((value) => typeof value === "string" && value.trim())
    : [];
 
  if (!ids.length) {
    return res.status(400).json({
      status: "error",
      message: "candidateIds is required.",
    });
  }
 
  if (!normalizedStage) {
    return res.status(400).json({
      status: "error",
      message: "A valid stage is required.",
    });
  }
 
  try {
    const { data, error } = await supabase
      .from("resume_candidates")
      .update({
        stage: normalizedStage,
        status_updated_at: new Date().toISOString(),
      })
      .in("id", ids)
      .select("*");
 
    if (error) {
      console.error("Bulk update candidate stage error:", error);
      return res.status(500).json({
        status: "error",
        message: error.message,
      });
    }
 
    // Send rejection emails if stage is Rejected
    if (normalizedStage === "Rejected" && data?.length) {
      for (const candidate of data) {
        try {
          const { data: jobRow } = candidate.job_id
            ? await supabase.from("resume_jobs").select("title").eq("id", candidate.job_id).single()
            : { data: null };
          await sendRejectionEmail(candidate, jobRow);
        } catch (notifErr) {
          console.error(`Rejection email error for ${candidate.id}:`, notifErr.message);
        }
      }
    }
 
    return res.json({
      status: "ok",
      message: "Candidate stages updated successfully.",
      candidates: data || [],
      updatedCount: data?.length || 0,
    });
 
    // Send rejection emails if stage is Rejected — after response is sent
    if (normalizedStage === "Rejected" && data?.length) {
      for (const candidate of data) {
        try {
          const { data: jobRow } = candidate.job_id
            ? await supabase.from("resume_jobs").select("title").eq("id", candidate.job_id).single()
            : { data: null };
          await sendRejectionEmail(candidate, jobRow);
        } catch (notifErr) {
          console.error(`Rejection email error for ${candidate.id}:`, notifErr.message);
        }
      }
    }
  } catch (error) {
    console.error("Unexpected bulk stage update error:", error);
    return res.status(500).json({
      status: "error",
      message: error?.message || "Failed to update candidate stages.",
    });
  }
});
 
router.patch("/:id/stage", async (req, res) => {
  const { id } = req.params;
  const normalizedStage = normalizeStage(req.body?.stage);
 
  if (!normalizedStage) {
    return res.status(400).json({
      status: "error",
      message: "A valid stage is required.",
    });
  }
 
  try {
    const { data, error } = await supabase
      .from("resume_candidates")
      .update({
        stage: normalizedStage,
        status_updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();
 
    if (error) {
      console.error("Update candidate stage error:", error);
      return res.status(500).json({
        status: "error",
        message: error.message,
      });
    }
 
    if (!data) {
      return res.status(404).json({
        status: "error",
        message: "Candidate not found.",
      });
    }
 
    // Send rejection email if stage changed to Rejected
    let notification = null;
    if (normalizedStage === "Rejected") {
      try {
        const { data: jobRow } = data.job_id
          ? await supabase.from("resume_jobs").select("title").eq("id", data.job_id).single()
          : { data: null };
        notification = await sendRejectionEmail(data, jobRow);
        if (notification?.status !== "sent") {
          console.warn("Rejection email was not sent:", notification);
        }
      } catch (notifErr) {
        console.error("Rejection email error (non-blocking):", notifErr.message);
        notification = { status: "error", error: notifErr.message };
      }
    }
 
    return res.json({
      status: "ok",
      message: "Candidate stage updated successfully.",
      candidate: data,
      notification,
    });
  } catch (error) {
    console.error("Unexpected stage update error:", error);
    return res.status(500).json({
      status: "error",
      message: error?.message || "Failed to update candidate stage.",
    });
  }
});
 
router.get("/:id/notes", async (req, res) => {
  const { id } = req.params;
 
  try {
    const { data, error } = await supabase
      .from("resume_candidate_notes")
      .select("*")
      .eq("candidate_id", id)
      .order("created_at", { ascending: false });
 
    if (error) {
      console.error("Fetch candidate notes error:", error);
      return res.status(500).json({
        status: "error",
        message: error.message,
      });
    }
 
    return res.json({
      status: "ok",
      notes: (data || []).map(mapNote),
      rawNotes: data || [],
    });
  } catch (error) {
    console.error("Unexpected notes fetch error:", error);
    return res.status(500).json({
      status: "error",
      message: error?.message || "Failed to fetch candidate notes.",
    });
  }
});
 
router.post("/:id/notes", async (req, res) => {
  const { id } = req.params;
  const noteText = req.body?.note_text?.trim();
  const createdBy = req.body?.created_by?.trim() || "HR Team";
 
  if (!noteText) {
    return res.status(400).json({
      status: "error",
      message: "note_text is required.",
    });
  }
 
  try {
    const { data, error } = await supabase
      .from("resume_candidate_notes")
      .insert([
        {
          candidate_id: id,
          created_by: createdBy,
          note_text: noteText,
        },
      ])
      .select("*")
      .single();
 
    if (error) {
      console.error("Create candidate note error:", error);
      return res.status(500).json({
        status: "error",
        message: error.message,
      });
    }
 
    return res.status(201).json({
      status: "ok",
      message: "Candidate note added successfully.",
      note: mapNote(data),
      rawNote: data,
    });
  } catch (error) {
    console.error("Unexpected create note error:", error);
    return res.status(500).json({
      status: "error",
      message: error?.message || "Failed to add candidate note.",
    });
  }
});
 
router.get("/:id/interviews", async (req, res) => {
  const { id } = req.params;
 
  try {
    const { data, error } = await supabase
      .from("resume_candidate_interviews")
      .select("*")
      .eq("candidate_id", id)
      .order("created_at", { ascending: false });
 
    if (error) {
      console.error("Fetch candidate interviews error:", error);
      return res.status(500).json({
        status: "error",
        message: error.message,
      });
    }
 
    return res.json({
      status: "ok",
      interviews: data || [],
    });
  } catch (error) {
    console.error("Unexpected interviews fetch error:", error);
    return res.status(500).json({
      status: "error",
      message: error?.message || "Failed to fetch interviews.",
    });
  }
});
 
router.post("/:id/interviews", async (req, res) => {
  const { id } = req.params;
  const {
    job_id,
    interview_type,
    round,
    interviewers = [],
    scheduled_date = null,
    scheduled_slot = null,
    duration_minutes = null,
    notify_via = null,
    message = null,
  } = req.body || {};
 
  if (!job_id?.trim() || !interview_type?.trim() || !round?.trim()) {
    return res.status(400).json({
      status: "error",
      message: "job_id, interview_type, and round are required.",
    });
  }
 
  try {
    const { data, error } = await supabase
      .from("resume_candidate_interviews")
      .insert([
        {
          candidate_id: id,
          job_id: job_id.trim(),
          interview_type: interview_type.trim(),
          round: round.trim(),
          interviewers: Array.isArray(interviewers) ? interviewers : [],
          scheduled_date,
          scheduled_slot,
          duration_minutes,
          notify_via,
          message,
          status: "scheduled",
        },
      ])
      .select("*")
      .single();
 
    if (error) {
      console.error("Create candidate interview error:", error);
      return res.status(500).json({
        status: "error",
        message: error.message,
      });
    }
 
    await supabase
      .from("resume_candidates")
      .update({
        stage: "Interview Scheduled",
        status_updated_at: new Date().toISOString(),
      })
      .eq("id", id);
 
    // Send notifications (email / WhatsApp) — fire-and-forget, don't block response
    let notification = null;
    try {
      // Fetch candidate and job details for notification
      const [{ data: candidateRow }, { data: jobRow }] = await Promise.all([
        supabase.from("resume_candidates").select("full_name, email, phone").eq("id", id).single(),
        supabase.from("resume_jobs").select("title").eq("id", job_id.trim()).single(),
      ]);
 
      const notifResults = await sendInterviewNotifications(data, candidateRow, jobRow);
 
      if (notifResults.errors.length > 0) {
        console.warn("Interview notification partial errors:", notifResults.errors);
      } else {
        console.log("Interview notifications sent:", {
          candidateEmail: notifResults.candidateEmail?.status,
          interviewerEmails: notifResults.interviewerEmails.length,
          whatsapp: notifResults.candidateWhatsApp?.status,
        });
      }
    } catch (notifErr) {
      // Never block the main response due to notification failure
      console.error("Interview notification error (non-blocking):", notifErr.message);
    }
 
    return res.status(201).json({
      status: "ok",
      message: "Interview scheduled successfully.",
      interview: data,
    });
  } catch (error) {
    console.error("Unexpected create interview error:", error);
    return res.status(500).json({
      status: "error",
      message: error?.message || "Failed to schedule interview.",
    });
  }
});
 
router.post("/:id/offers", upload.single("offerFile"), async (req, res) => {
  const { id } = req.params;
  const file = req.file;
  const {
    job_id,
    designation,
    ctc = null,
    joining_date = null,
    reporting_to = null,
    additional_note = null,
    status = "generated",
  } = req.body || {};

  if (!job_id?.trim() || !designation?.trim()) {
    return res.status(400).json({
      status: "error",
      message: "job_id and designation are required.",
    });
  }

  if (!file) {
    return res.status(400).json({
      status: "error",
      message: "Offer letter PDF is required.",
    });
  }

  if (!allowedOfferMimeTypes.has(file.mimetype)) {
    return res.status(400).json({
      status: "error",
      message: "Only PDF files are accepted for offer letters.",
    });
  }

  try {
    const sanitizedName = file.originalname.replace(/\s+/g, "_");
    const storagePath = `${job_id}/offer-${id}-${Date.now()}-${sanitizedName}`;

    const { error: storageError } = await supabase.storage
      .from("resume-files")
      .upload(storagePath, file.buffer, {
        upsert: false,
        contentType: file.mimetype,
      });

    if (storageError) {
      console.error("Offer file storage error:", storageError);
      return res.status(500).json({
        status: "error",
        message: storageError.message,
      });
    }

    const { data: publicUrlData } = supabase.storage
      .from("resume-files")
      .getPublicUrl(storagePath);

    const offerPayload = {
      candidate_id: id,
      job_id: job_id.trim(),
      designation: designation.trim(),
      ctc,
      joining_date,
      reporting_to,
      additional_note,
      status,
      offer_letter_url: publicUrlData?.publicUrl || null,
      storage_bucket: "resume-files",
      storage_path: storagePath,
    };

    let insertResponse = await supabase
      .from("resume_candidate_offers")
      .insert([offerPayload])
      .select("*")
      .single();

    if (insertResponse.error) {
      const missingColumn =
        insertResponse.error.message?.includes("column") ||
        insertResponse.error.code === "42703";

      if (missingColumn) {
        console.warn(
          "Offer insert missing file metadata columns, retrying without offer_letter_url/storage fields."
        );

        const fallbackPayload = {
          candidate_id: id,
          job_id: job_id.trim(),
          designation: designation.trim(),
          ctc,
          joining_date,
          reporting_to,
          additional_note,
          status,
        };

        insertResponse = await supabase
          .from("resume_candidate_offers")
          .insert([fallbackPayload])
          .select("*")
          .single();
      }
    }

    if (insertResponse.error) {
      console.error("Create candidate offer error:", insertResponse.error);
      return res.status(500).json({
        status: "error",
        message: insertResponse.error.message,
      });
    }

    const [{ data: candidateRow, error: candidateError }, { data: jobRow, error: jobError }] =
      await Promise.all([
        supabase.from("resume_candidates").select("*").eq("id", id).maybeSingle(),
        supabase.from("resume_jobs").select("*").eq("id", job_id.trim()).maybeSingle(),
      ]);

    if (candidateError || !candidateRow) {
      console.warn("Offer created but candidate lookup failed.", candidateError?.message);
    }

    if (jobError || !jobRow) {
      console.warn("Offer created but job lookup failed.", jobError?.message);
    }

    let notification = null;
    if (candidateRow?.email) {
      try {
        notification = await sendOfferEmail({
          candidate: candidateRow,
          job: jobRow,
          offer: insertResponse.data,
          attachment: {
            filename: file.originalname,
            buffer: file.buffer,
          },
        });
      } catch (notifErr) {
        console.error("Offer email error (non-blocking):", notifErr.message || notifErr);
        notification = { status: "error", error: notifErr.message || String(notifErr) };
      }
    }

    await supabase
      .from("resume_candidates")
      .update({
        stage: "Offer Extended",
        status_updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    return res.status(201).json({
      status: "ok",
      message: "Offer saved successfully.",
      offer: insertResponse.data,
      notification,
    });
  } catch (error) {
    console.error("Unexpected create offer error:", error);
    return res.status(500).json({
      status: "error",
      message: error?.message || "Failed to save offer.",
    });
  }
});
 
router.post("/:id/reject", async (req, res) => {
  const { id } = req.params;
  const { job_id = null, designation = "Rejected Candidate", additional_note = null } =
    req.body || {};
 
  try {
    if (job_id?.trim()) {
      await supabase.from("resume_candidate_offers").insert([
        {
          candidate_id: id,
          job_id: job_id.trim(),
          designation,
          additional_note,
          status: "rejected",
        },
      ]);
    }
 
    const { data, error } = await supabase
      .from("resume_candidates")
      .update({
        stage: "Rejected",
        status_updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();
 
    if (error) {
      console.error("Reject candidate error:", error);
      return res.status(500).json({
        status: "error",
        message: error.message,
      });
    }
 
    if (!data) {
      return res.status(404).json({
        status: "error",
        message: "Candidate not found.",
      });
    }
 
    // Send rejection email — fire and forget, don't block response
    let notification = null;
    try {
      const resolvedJobId = job_id?.trim() || data.job_id;
      const { data: jobRow } = resolvedJobId
        ? await supabase.from("resume_jobs").select("title").eq("id", resolvedJobId).single()
        : { data: null };
 
      notification = await sendRejectionEmail(data, jobRow, additional_note);
      if (notification?.status !== "sent") {
        console.warn("Rejection email was not sent:", notification);
      }
    } catch (notifErr) {
      console.error("Rejection email error (non-blocking):", notifErr.message);
      notification = { status: "error", error: notifErr.message };
    }
 
    return res.json({
      status: "ok",
      message: "Candidate rejected successfully.",
      candidate: data,
      notification,
    });
  } catch (error) {
    console.error("Unexpected candidate rejection error:", error);
    return res.status(500).json({
      status: "error",
      message: error?.message || "Failed to reject candidate.",
    });
  }
});
 
export default router;
