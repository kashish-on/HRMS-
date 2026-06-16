
const DEFAULT_WEIGHTS = {
  skill: 40,
  title: 25,
  experience: 20,
  location: 15,
};
 
const formatDate = (value) => {
  if (!value) return null;
 
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
 
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};
 
const getLatestTimestamp = (...collections) => {
  const timestamps = collections
    .flat()
    .map((item) => item?.updated_at || item?.created_at || null)
    .filter(Boolean)
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value) && value > 0);
 
  return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;
};
 
const normalizeWeight = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
 
export const getJobWeights = (job) => ({
  skill: normalizeWeight(job?.weight_skills, DEFAULT_WEIGHTS.skill),
  title: normalizeWeight(job?.weight_job_profile, DEFAULT_WEIGHTS.title),
  experience: normalizeWeight(job?.weight_experience, DEFAULT_WEIGHTS.experience),
  location: normalizeWeight(job?.weight_location, DEFAULT_WEIGHTS.location),
});
 
const toPercent = (score, weight) => {
  if (!weight) return 0;
  const ratio = (Number(score) || 0) / weight;
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
};
 
const toStage = (candidate) => candidate?.stage || "Applied";
 
const readParsedPayload = (parsedData) => {
  const raw = parsedData?.raw_parser_response;
  if (!raw) return {};
  try {
    const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
    return obj?.ResumeParserData || {};
  } catch {
    return {};
  }
};
 
const fallbackText = (...values) =>
  values.find((value) => typeof value === "string" && value.trim()) || null;
 
const fallbackNumber = (...values) => {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
 
  return 0;
};
 
const fallbackArray = (...values) => {
  for (const value of values) {
    if (Array.isArray(value) && value.length) {
      return value;
    }
  }
 
  return [];
};
 
const uniqueStrings = (values) => {
  const seen = new Set();
  const output = [];
 
  for (const value of values || []) {
    if (typeof value !== "string") {
      continue;
    }
 
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }
 
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
 
    seen.add(key);
    output.push(trimmed);
  }
 
  return output;
};
 
const deriveLocation = (candidate, parsedData) => {
  const parsed = readParsedPayload(parsedData);
  const experienceLocation = parsed?.SegregatedExperience?.[0]?.Location || {};
  const addressLocation = parsed?.Address?.[0] || {};
 
  return (
    candidate?.location ||
    parsedData?.parsed_locations?.[0] ||
    fallbackText(
      [experienceLocation.City, experienceLocation.State, experienceLocation.Country].filter(Boolean).join(", "),
      [addressLocation.City, addressLocation.State, addressLocation.Country].filter(Boolean).join(", "),
      parsed?.ResumeCountry?.Country
    ) ||
    "Unknown"
  );
};
 
const deriveTitle = (candidate, parsedData) => {
  const parsed = readParsedPayload(parsedData);
 
  return (
    candidate?.current_job_title ||
    parsedData?.parsed_job_titles?.[0] ||
    fallbackText(
      parsed?.SegregatedExperience?.[0]?.JobProfile?.FormattedName,
      parsed?.SegregatedExperience?.[0]?.JobProfile?.Title,
      parsed?.JobProfile
    ) ||
    "Untitled Profile"
  );
};
 
const deriveCompany = (candidate, parsedData) => {
  const parsed = readParsedPayload(parsedData);
 
  // Our own parser stores company in parsed_companies[0]
  if (parsedData?.parsed_companies?.[0]) return parsedData.parsed_companies[0];
 
  // Direct field on candidate
  if (candidate?.current_company) return candidate.current_company;
 
  // RChilli CurrentEmployer field
  if (parsed?.CurrentEmployer) return parsed.CurrentEmployer;
 
  // Scan experience entries for the current/present employer
  const experiences = Array.isArray(parsed?.SegregatedExperience)
    ? parsed.SegregatedExperience
    : [];
 
  // Look for an experience entry with no end date or end date marked as "present"/"current"
  for (const exp of experiences) {
    const endDate = String(exp?.EndDate || exp?.ToDate || "").toLowerCase();
    const isPresent =
      !endDate ||
      endDate === "" ||
      endDate.includes("present") ||
      endDate.includes("current") ||
      endDate.includes("till date") ||
      endDate.includes("ongoing");
 
    if (isPresent) {
      const name =
        exp?.Employer?.EmployerName ||
        exp?.CompanyName ||
        exp?.Organization ||
        exp?.Employer?.Name ||
        null;
      if (name && typeof name === "string" && name.trim()) return name.trim();
    }
  }
 
  // Fallback: first experience entry
  const firstExp = experiences[0];
  return (
    firstExp?.Employer?.EmployerName ||
    firstExp?.CompanyName ||
    firstExp?.Organization ||
    null
  );
};
 
const deriveEducation = (candidate, parsedData) => {
  const parsed = readParsedPayload(parsedData);
 
  // Our own parser stores education in parsed_education[0]
  if (parsedData?.parsed_education?.[0]) return parsedData.parsed_education[0];
 
  // Direct field on candidate
  if (candidate?.highest_education) return candidate.highest_education;
 
  // RChilli qualification paths — try multiple field names
  const quals = Array.isArray(parsed?.SegregatedQualification)
    ? parsed.SegregatedQualification
    : [];
 
  for (const qual of quals) {
    const degree =
      qual?.Degree?.DegreeName ||
      qual?.Degree?.NormalizeDegree ||
      qual?.DegreeType ||
      qual?.CourseName ||
      null;
    if (degree && typeof degree === "string" && degree.trim()) return degree.trim();
  }
 
  // Top-level fallbacks
  return (
    fallbackText(
      parsed?.Qualification,
      parsed?.HighestQualification,
      parsed?.Education,
      parsed?.EducationSummary
    ) || null
  );
};
 
const deriveExperience = (candidate, parsedData) => {
  const parsed = readParsedPayload(parsedData);
 
  // Supabase may return numeric columns as strings — coerce all candidates
  return fallbackNumber(
    candidate?.total_experience,
    parsedData?.total_experience,
    parsed?.WorkedPeriod?.TotalExperienceInYear,
    parsed?.WorkedPeriod?.TotalExperienceInYears,
    parsed?.WorkedPeriod?.TotalExperienceInMonths
      ? Number(parsed.WorkedPeriod.TotalExperienceInMonths) / 12
      : null,
    parsed?.YearOfExperience?.Years,
    parsed?.TotalExperienceInYears
  );
};
 
// Maximum word count for a valid skill tag — anything longer is a sentence fragment
const MAX_SKILL_WORDS = 5;
// Minimum character length
const MIN_SKILL_CHARS = 2;
 
// Patterns that indicate a value is NOT a skill
const SKILL_JUNK_PATTERN = /^[\d\s\-\/\.]+$|@|\bpresent\b|\bjuly\b|\bjune\b|\bjanurary\b|\bjanuary\b|\bfebruary\b|\bmarch\b|\bapril\b|\bmay\b|\bjune\b|\baugust\b|\bseptember\b|\boctober\b|\bnovember\b|\bdecember\b|\b20\d{2}\b/i;
 
const isCleanSkill = (value) => {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length < MIN_SKILL_CHARS) return false;
  if (trimmed.split(/\s+/).length > MAX_SKILL_WORDS) return false;   // too long → sentence fragment
  if (SKILL_JUNK_PATTERN.test(trimmed)) return false;               // date, email, number etc.
  if (/^\d/.test(trimmed)) return false;                            // starts with digit
  return true;
};
 
const deriveSkillsMatch = (scorecard, parsedData) => {
  const parsed = readParsedPayload(parsedData);
 
  // Priority 1: skills that actually matched the job requirements (always show these)
  const matchedRequiredSkills = fallbackArray(
    scorecard?.matched_skills,
    scorecard?.normalized_matched_skills
  );
 
  // Priority 2: clean skills extracted from the resume's Skills section only.
  // We prefer parsed_skills (set by our own parser from the SKILLS section header).
  // Fall back to RChilli SkillKeywords only if nothing else exists.
  let extractedResumeSkills = [];
 
  if (Array.isArray(parsedData?.parsed_skills) && parsedData.parsed_skills.length > 0) {
    extractedResumeSkills = parsedData.parsed_skills.filter(isCleanSkill);
  } else if (typeof parsed?.SkillKeywords === "string" && parsed.SkillKeywords.trim()) {
    extractedResumeSkills = parsed.SkillKeywords
      .split(/[,;|]/)
      .map((entry) => entry.trim())
      .filter(isCleanSkill);
  }
 
  // Merge: required matches first, then remaining resume skills not already shown
  const matchedSet = new Set(matchedRequiredSkills.map((s) => s.toLowerCase()));
  const additionalSkills = extractedResumeSkills.filter(
    (s) => !matchedSet.has(s.toLowerCase())
  );
 
  return uniqueStrings([...matchedRequiredSkills, ...additionalSkills]);
};
 
const deriveSkillsMiss = (scorecard) => uniqueStrings(scorecard?.missing_skills || []);
 
const deriveResumeText = (parsedData) => {
  const parsed = readParsedPayload(parsedData);
 
  return (
    parsedData?.extracted_text ||
    fallbackText(parsed?.DetailResume, parsed?.ResumeText, parsed?.HtmlResume, parsed?.Experience)
  );
};
 
export const mapJobToDashboardRecord = ({ job, uploads = [], candidates = [] }) => {
  const scoredCandidates = candidates.filter((candidate) => Number.isFinite(Number(candidate.ats_score)));
  const parsedUploads = uploads.filter((upload) => upload?.parse_status === "parsed");
  const highMatch = scoredCandidates.filter(
    (candidate) => !candidate.is_knocked_out && Number(candidate.ats_score) >= 75
  ).length;
  const avgScore = scoredCandidates.length
    ? Math.round(
        scoredCandidates.reduce((sum, candidate) => sum + Number(candidate.ats_score || 0), 0) /
          scoredCandidates.length
      )
    : 0;
 
  const uploadStatuses = new Set((uploads || []).map((upload) => upload.parse_status));
  let status = "Completed";
 
  if (uploadStatuses.has("pending") || uploadStatuses.has("processing")) {
    status = "Processing";
  } else if (uploads.length > 0 && uploadStatuses.size === 1 && uploadStatuses.has("failed")) {
    status = "Failed";
  }
 
  const latestActivityAt =
    getLatestTimestamp(parsedUploads, uploads, candidates) ||
    job?.updated_at ||
    job?.created_at;
  const totalResumes =
    status === "Processing"
      ? Math.max(parsedUploads.length, candidates.length, uploads.length)
      : Math.max(parsedUploads.length, candidates.length);
 
  return {
    id: job.id,
    uploadDate: formatDate(latestActivityAt),
    role: job.title || job.job_profile || "Untitled Role",
    totalResumes,
    highMatch,
    avgScore,
    status,
    isOpen: job.is_open !== false, // default true if column doesn't exist yet
  };
};
 
export const mapCandidateToResultsRow = ({
  candidate,
  scorecard = null,
  job = null,
  parsedData = null,
}) => {
  const weights = getJobWeights(job);
  const totalScore = Math.round(Number(candidate?.ats_score ?? scorecard?.total_score ?? 0));
 
  return {
    id: candidate.id,
    name: candidate.full_name || "Unknown Candidate",
    title: deriveTitle(candidate, parsedData),
    exp: deriveExperience(candidate, parsedData),
    location: deriveLocation(candidate, parsedData),
    skill: toPercent(scorecard?.skills_score, weights.skill),
    experience: toPercent(scorecard?.experience_score, weights.experience),
    titleR: toPercent(scorecard?.job_profile_score, weights.title),
    location_score: toPercent(scorecard?.location_score, weights.location),
    notes: [],
    stage: toStage(candidate),
    skills_match: deriveSkillsMatch(scorecard, parsedData),
    skills_miss: deriveSkillsMiss(scorecard),
    score: totalScore,
  };
};
 
export const mapNote = (note) => ({
  id: note.id,
  by: note.created_by,
  date: formatDate(note.created_at),
  text: note.note_text,
});
 
export const mapCandidateToDetail = ({
  candidate,
  scorecard = null,
  parsedData = null,
  notes = [],
  upload = null,
  job = null,
}) => {
  const base = mapCandidateToResultsRow({ candidate, scorecard, job, parsedData });
 
  return {
    ...base,
    currentCompany: deriveCompany(candidate, parsedData),
    highestEducation: deriveEducation(candidate, parsedData),
    resumeUrl: upload?.file_url || null,
    resumeText: deriveResumeText(parsedData),
    scoreExplanation: scorecard?.score_explanation || null,
    notes: notes.map(mapNote),
  };
};


// const DEFAULT_WEIGHTS = {
//   skill: 40,
//   title: 25,
//   experience: 20,
//   location: 15,
// };
 
// const formatDate = (value) => {
//   if (!value) return null;
 
//   const date = new Date(value);
//   if (Number.isNaN(date.getTime())) {
//     return value;
//   }
 
//   return date.toLocaleDateString("en-IN", {
//     day: "numeric",
//     month: "short",
//     year: "numeric",
//   });
// };
 
// const getLatestTimestamp = (...collections) => {
//   const timestamps = collections
//     .flat()
//     .map((item) => item?.updated_at || item?.created_at || null)
//     .filter(Boolean)
//     .map((value) => new Date(value).getTime())
//     .filter((value) => Number.isFinite(value) && value > 0);
 
//   return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;
// };
 
// const normalizeWeight = (value, fallback) => {
//   const parsed = Number(value);
//   return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
// };
 
// export const getJobWeights = (job) => ({
//   skill: normalizeWeight(job?.weight_skills, DEFAULT_WEIGHTS.skill),
//   title: normalizeWeight(job?.weight_job_profile, DEFAULT_WEIGHTS.title),
//   experience: normalizeWeight(job?.weight_experience, DEFAULT_WEIGHTS.experience),
//   location: normalizeWeight(job?.weight_location, DEFAULT_WEIGHTS.location),
// });
 
// const toPercent = (score, weight) => {
//   if (!weight) return 0;
//   const ratio = (Number(score) || 0) / weight;
//   return Math.max(0, Math.min(100, Math.round(ratio * 100)));
// };
 
// const toStage = (candidate) => candidate?.stage || "Applied";
 
// const readParsedPayload = (parsedData) => {
//   const raw = parsedData?.raw_parser_response;
//   if (!raw) return {};
//   try {
//     const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
//     return obj?.ResumeParserData || {};
//   } catch {
//     return {};
//   }
// };
 
// const fallbackText = (...values) =>
//   values.find((value) => typeof value === "string" && value.trim()) || null;
 
// const fallbackNumber = (...values) => {
//   for (const value of values) {
//     const parsed = Number(value);
//     if (Number.isFinite(parsed) && parsed > 0) {
//       return parsed;
//     }
//   }
 
//   return 0;
// };
 
// const fallbackArray = (...values) => {
//   for (const value of values) {
//     if (Array.isArray(value) && value.length) {
//       return value;
//     }
//   }
 
//   return [];
// };
 
// const uniqueStrings = (values) => {
//   const seen = new Set();
//   const output = [];
 
//   for (const value of values || []) {
//     if (typeof value !== "string") {
//       continue;
//     }
 
//     const trimmed = value.trim();
//     if (!trimmed) {
//       continue;
//     }
 
//     const key = trimmed.toLowerCase();
//     if (seen.has(key)) {
//       continue;
//     }
 
//     seen.add(key);
//     output.push(trimmed);
//   }
 
//   return output;
// };
 
// const deriveLocation = (candidate, parsedData) => {
//   const parsed = readParsedPayload(parsedData);
//   const experienceLocation = parsed?.SegregatedExperience?.[0]?.Location || {};
//   const addressLocation = parsed?.Address?.[0] || {};
 
//   return (
//     candidate?.location ||
//     parsedData?.parsed_locations?.[0] ||
//     fallbackText(
//       [experienceLocation.City, experienceLocation.State, experienceLocation.Country].filter(Boolean).join(", "),
//       [addressLocation.City, addressLocation.State, addressLocation.Country].filter(Boolean).join(", "),
//       parsed?.ResumeCountry?.Country
//     ) ||
//     "Unknown"
//   );
// };
 
// const deriveTitle = (candidate, parsedData) => {
//   const parsed = readParsedPayload(parsedData);
 
//   return (
//     candidate?.current_job_title ||
//     parsedData?.parsed_job_titles?.[0] ||
//     fallbackText(
//       parsed?.SegregatedExperience?.[0]?.JobProfile?.FormattedName,
//       parsed?.SegregatedExperience?.[0]?.JobProfile?.Title,
//       parsed?.JobProfile
//     ) ||
//     "Untitled Profile"
//   );
// };
 
// const deriveCompany = (candidate, parsedData) => {
//   const parsed = readParsedPayload(parsedData);
 
//   // Our own parser stores company in parsed_companies[0]
//   if (parsedData?.parsed_companies?.[0]) return parsedData.parsed_companies[0];
 
//   // Direct field on candidate
//   if (candidate?.current_company) return candidate.current_company;
 
//   // RChilli CurrentEmployer field
//   if (parsed?.CurrentEmployer) return parsed.CurrentEmployer;
 
//   // Scan experience entries for the current/present employer
//   const experiences = Array.isArray(parsed?.SegregatedExperience)
//     ? parsed.SegregatedExperience
//     : [];
 
//   // Look for an experience entry with no end date or end date marked as "present"/"current"
//   for (const exp of experiences) {
//     const endDate = String(exp?.EndDate || exp?.ToDate || "").toLowerCase();
//     const isPresent =
//       !endDate ||
//       endDate === "" ||
//       endDate.includes("present") ||
//       endDate.includes("current") ||
//       endDate.includes("till date") ||
//       endDate.includes("ongoing");
 
//     if (isPresent) {
//       const name =
//         exp?.Employer?.EmployerName ||
//         exp?.CompanyName ||
//         exp?.Organization ||
//         exp?.Employer?.Name ||
//         null;
//       if (name && typeof name === "string" && name.trim()) return name.trim();
//     }
//   }
 
//   // Fallback: first experience entry
//   const firstExp = experiences[0];
//   return (
//     firstExp?.Employer?.EmployerName ||
//     firstExp?.CompanyName ||
//     firstExp?.Organization ||
//     null
//   );
// };
 
// const deriveEducation = (candidate, parsedData) => {
//   const parsed = readParsedPayload(parsedData);
 
//   // Our own parser stores education in parsed_education[0]
//   if (parsedData?.parsed_education?.[0]) return parsedData.parsed_education[0];
 
//   // Direct field on candidate
//   if (candidate?.highest_education) return candidate.highest_education;
 
//   // RChilli qualification paths — try multiple field names
//   const quals = Array.isArray(parsed?.SegregatedQualification)
//     ? parsed.SegregatedQualification
//     : [];
 
//   for (const qual of quals) {
//     const degree =
//       qual?.Degree?.DegreeName ||
//       qual?.Degree?.NormalizeDegree ||
//       qual?.DegreeType ||
//       qual?.CourseName ||
//       null;
//     if (degree && typeof degree === "string" && degree.trim()) return degree.trim();
//   }
 
//   // Top-level fallbacks
//   return (
//     fallbackText(
//       parsed?.Qualification,
//       parsed?.HighestQualification,
//       parsed?.Education,
//       parsed?.EducationSummary
//     ) || null
//   );
// };
 
// const deriveExperience = (candidate, parsedData) => {
//   const parsed = readParsedPayload(parsedData);
 
//   // Supabase may return numeric columns as strings — coerce all candidates
//   return fallbackNumber(
//     candidate?.total_experience,
//     parsedData?.total_experience,
//     parsed?.WorkedPeriod?.TotalExperienceInYear,
//     parsed?.WorkedPeriod?.TotalExperienceInYears,
//     parsed?.WorkedPeriod?.TotalExperienceInMonths
//       ? Number(parsed.WorkedPeriod.TotalExperienceInMonths) / 12
//       : null,
//     parsed?.YearOfExperience?.Years,
//     parsed?.TotalExperienceInYears
//   );
// };
 
// // Maximum word count for a valid skill tag — anything longer is a sentence fragment
// const MAX_SKILL_WORDS = 5;
// // Minimum character length
// const MIN_SKILL_CHARS = 2;
 
// // Patterns that indicate a value is NOT a skill
// const SKILL_JUNK_PATTERN = /^[\d\s\-\/\.]+$|@|\bpresent\b|\bjuly\b|\bjune\b|\bjanurary\b|\bjanuary\b|\bfebruary\b|\bmarch\b|\bapril\b|\bmay\b|\bjune\b|\baugust\b|\bseptember\b|\boctober\b|\bnovember\b|\bdecember\b|\b20\d{2}\b/i;
 
// const isCleanSkill = (value) => {
//   if (!value || typeof value !== "string") return false;
//   const trimmed = value.trim();
//   if (trimmed.length < MIN_SKILL_CHARS) return false;
//   if (trimmed.split(/\s+/).length > MAX_SKILL_WORDS) return false;   // too long → sentence fragment
//   if (SKILL_JUNK_PATTERN.test(trimmed)) return false;               // date, email, number etc.
//   if (/^\d/.test(trimmed)) return false;                            // starts with digit
//   return true;
// };
 
// const deriveSkillsMatch = (scorecard, parsedData) => {
//   const parsed = readParsedPayload(parsedData);
 
//   // Priority 1: skills that actually matched the job requirements (always show these)
//   const matchedRequiredSkills = fallbackArray(
//     scorecard?.matched_skills,
//     scorecard?.normalized_matched_skills
//   );
 
//   // Priority 2: clean skills extracted from the resume's Skills section only.
//   // We prefer parsed_skills (set by our own parser from the SKILLS section header).
//   // Fall back to RChilli SkillKeywords only if nothing else exists.
//   let extractedResumeSkills = [];
 
//   if (Array.isArray(parsedData?.parsed_skills) && parsedData.parsed_skills.length > 0) {
//     extractedResumeSkills = parsedData.parsed_skills.filter(isCleanSkill);
//   } else if (typeof parsed?.SkillKeywords === "string" && parsed.SkillKeywords.trim()) {
//     extractedResumeSkills = parsed.SkillKeywords
//       .split(/[,;|]/)
//       .map((entry) => entry.trim())
//       .filter(isCleanSkill);
//   }
 
//   // Merge: required matches first, then remaining resume skills not already shown
//   const matchedSet = new Set(matchedRequiredSkills.map((s) => s.toLowerCase()));
//   const additionalSkills = extractedResumeSkills.filter(
//     (s) => !matchedSet.has(s.toLowerCase())
//   );
 
//   return uniqueStrings([...matchedRequiredSkills, ...additionalSkills]);
// };
 
// const deriveSkillsMiss = (scorecard) => uniqueStrings(scorecard?.missing_skills || []);
 
// const deriveResumeText = (parsedData) => {
//   const parsed = readParsedPayload(parsedData);
 
//   return (
//     parsedData?.extracted_text ||
//     fallbackText(parsed?.DetailResume, parsed?.ResumeText, parsed?.HtmlResume, parsed?.Experience)
//   );
// };
 
// export const mapJobToDashboardRecord = ({ job, uploads = [], candidates = [] }) => {
//   const scoredCandidates = candidates.filter((candidate) => Number.isFinite(Number(candidate.ats_score)));
//   const parsedUploads = uploads.filter((upload) => upload?.parse_status === "parsed");
//   const highMatch = scoredCandidates.filter(
//     (candidate) => !candidate.is_knocked_out && Number(candidate.ats_score) >= 75
//   ).length;
//   const avgScore = scoredCandidates.length
//     ? Math.round(
//         scoredCandidates.reduce((sum, candidate) => sum + Number(candidate.ats_score || 0), 0) /
//           scoredCandidates.length
//       )
//     : 0;
 
//   const uploadStatuses = new Set((uploads || []).map((upload) => upload.parse_status));
//   let status = "Completed";
 
//   if (uploadStatuses.has("pending") || uploadStatuses.has("processing")) {
//     status = "Processing";
//   } else if (uploads.length > 0 && uploadStatuses.size === 1 && uploadStatuses.has("failed")) {
//     status = "Failed";
//   }
 
//   const latestActivityAt =
//     getLatestTimestamp(parsedUploads, uploads, candidates) ||
//     job?.updated_at ||
//     job?.created_at;
//   const totalResumes =
//     status === "Processing"
//       ? Math.max(parsedUploads.length, candidates.length, uploads.length)
//       : Math.max(parsedUploads.length, candidates.length);
 
//   return {
//     id: job.id,
//     uploadDate: formatDate(latestActivityAt),
//     role: job.title || job.job_profile || "Untitled Role",
//     totalResumes,
//     highMatch,
//     avgScore,
//     status,
//   };
// };
 
// export const mapCandidateToResultsRow = ({
//   candidate,
//   scorecard = null,
//   job = null,
//   parsedData = null,
// }) => {
//   const weights = getJobWeights(job);
//   const totalScore = Math.round(Number(candidate?.ats_score ?? scorecard?.total_score ?? 0));
 
//   return {
//     id: candidate.id,
//     name: candidate.full_name || "Unknown Candidate",
//     title: deriveTitle(candidate, parsedData),
//     exp: deriveExperience(candidate, parsedData),
//     location: deriveLocation(candidate, parsedData),
//     skill: toPercent(scorecard?.skills_score, weights.skill),
//     experience: toPercent(scorecard?.experience_score, weights.experience),
//     titleR: toPercent(scorecard?.job_profile_score, weights.title),
//     location_score: toPercent(scorecard?.location_score, weights.location),
//     notes: [],
//     stage: toStage(candidate),
//     skills_match: deriveSkillsMatch(scorecard, parsedData),
//     skills_miss: deriveSkillsMiss(scorecard),
//     score: totalScore,
//   };
// };
 
// export const mapNote = (note) => ({
//   id: note.id,
//   by: note.created_by,
//   date: formatDate(note.created_at),
//   text: note.note_text,
// });
 
// export const mapCandidateToDetail = ({
//   candidate,
//   scorecard = null,
//   parsedData = null,
//   notes = [],
//   upload = null,
//   job = null,
// }) => {
//   const base = mapCandidateToResultsRow({ candidate, scorecard, job, parsedData });
 
//   return {
//     ...base,
//     currentCompany: deriveCompany(candidate, parsedData),
//     highestEducation: deriveEducation(candidate, parsedData),
//     resumeUrl: upload?.file_url || null,
//     resumeText: deriveResumeText(parsedData),
//     scoreExplanation: scorecard?.score_explanation || null,
//     notes: notes.map(mapNote),
//   };
// };

// // const DEFAULT_WEIGHTS = {
// //   skill: 40,
// //   title: 25,
// //   experience: 20,
// //   location: 15,
// // };

// // const formatDate = (value) => {
// //   if (!value) return null;

// //   const date = new Date(value);
// //   if (Number.isNaN(date.getTime())) {
// //     return value;
// //   }

// //   return date.toLocaleDateString("en-IN", {
// //     day: "numeric",
// //     month: "short",
// //     year: "numeric",
// //   });
// // };

// // const getLatestTimestamp = (...collections) => {
// //   const timestamps = collections
// //     .flat()
// //     .map((item) => item?.updated_at || item?.created_at || null)
// //     .filter(Boolean)
// //     .map((value) => new Date(value).getTime())
// //     .filter((value) => Number.isFinite(value) && value > 0);

// //   return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;
// // };

// // const normalizeWeight = (value, fallback) => {
// //   const parsed = Number(value);
// //   return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
// // };

// // export const getJobWeights = (job) => ({
// //   skill: normalizeWeight(job?.weight_skills, DEFAULT_WEIGHTS.skill),
// //   title: normalizeWeight(job?.weight_job_profile, DEFAULT_WEIGHTS.title),
// //   experience: normalizeWeight(job?.weight_experience, DEFAULT_WEIGHTS.experience),
// //   location: normalizeWeight(job?.weight_location, DEFAULT_WEIGHTS.location),
// // });

// // const toPercent = (score, weight) => {
// //   if (!weight) return 0;
// //   const ratio = (Number(score) || 0) / weight;
// //   return Math.max(0, Math.min(100, Math.round(ratio * 100)));
// // };

// // const toStage = (candidate) => candidate?.stage || "Applied";

// // const readParsedPayload = (parsedData) => {
// //   const raw = parsedData?.raw_parser_response;
// //   if (!raw) return {};
// //   try {
// //     const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
// //     return obj?.ResumeParserData || {};
// //   } catch {
// //     return {};
// //   }
// // };

// // const fallbackText = (...values) =>
// //   values.find((value) => typeof value === "string" && value.trim()) || null;

// // const fallbackNumber = (...values) => {
// //   for (const value of values) {
// //     const parsed = Number(value);
// //     if (Number.isFinite(parsed) && parsed > 0) {
// //       return parsed;
// //     }
// //   }

// //   return 0;
// // };

// // const fallbackArray = (...values) => {
// //   for (const value of values) {
// //     if (Array.isArray(value) && value.length) {
// //       return value;
// //     }
// //   }

// //   return [];
// // };

// // const uniqueStrings = (values) => {
// //   const seen = new Set();
// //   const output = [];

// //   for (const value of values || []) {
// //     if (typeof value !== "string") {
// //       continue;
// //     }

// //     const trimmed = value.trim();
// //     if (!trimmed) {
// //       continue;
// //     }

// //     const key = trimmed.toLowerCase();
// //     if (seen.has(key)) {
// //       continue;
// //     }

// //     seen.add(key);
// //     output.push(trimmed);
// //   }

// //   return output;
// // };

// // const deriveLocation = (candidate, parsedData) => {
// //   const parsed = readParsedPayload(parsedData);
// //   const experienceLocation = parsed?.SegregatedExperience?.[0]?.Location || {};
// //   const addressLocation = parsed?.Address?.[0] || {};

// //   return (
// //     candidate?.location ||
// //     parsedData?.parsed_locations?.[0] ||
// //     fallbackText(
// //       [experienceLocation.City, experienceLocation.State, experienceLocation.Country].filter(Boolean).join(", "),
// //       [addressLocation.City, addressLocation.State, addressLocation.Country].filter(Boolean).join(", "),
// //       parsed?.ResumeCountry?.Country
// //     ) ||
// //     "Unknown"
// //   );
// // };

// // const deriveTitle = (candidate, parsedData) => {
// //   const parsed = readParsedPayload(parsedData);

// //   return (
// //     candidate?.current_job_title ||
// //     parsedData?.parsed_job_titles?.[0] ||
// //     fallbackText(
// //       parsed?.SegregatedExperience?.[0]?.JobProfile?.FormattedName,
// //       parsed?.SegregatedExperience?.[0]?.JobProfile?.Title,
// //       parsed?.JobProfile
// //     ) ||
// //     "Untitled Profile"
// //   );
// // };

// // const deriveCompany = (candidate, parsedData) => {
// //   const parsed = readParsedPayload(parsedData);

// //   return (
// //     candidate?.current_company ||
// //     parsedData?.parsed_companies?.[0] ||
// //     fallbackText(
// //       parsed?.CurrentEmployer,
// //       parsed?.SegregatedExperience?.[0]?.Employer?.EmployerName
// //     )
// //   );
// // };

// // const deriveEducation = (candidate, parsedData) => {
// //   const parsed = readParsedPayload(parsedData);

// //   return (
// //     candidate?.highest_education ||
// //     parsedData?.parsed_education?.[0] ||
// //     fallbackText(
// //       parsed?.SegregatedQualification?.[0]?.Degree?.DegreeName,
// //       parsed?.SegregatedQualification?.[0]?.Degree?.NormalizeDegree,
// //       parsed?.Qualification
// //     )
// //   );
// // };

// // const deriveExperience = (candidate, parsedData) => {
// //   const parsed = readParsedPayload(parsedData);

// //   // Supabase may return numeric columns as strings — coerce all candidates
// //   return fallbackNumber(
// //     candidate?.total_experience,
// //     parsedData?.total_experience,
// //     parsed?.WorkedPeriod?.TotalExperienceInYear,
// //     parsed?.WorkedPeriod?.TotalExperienceInYears,
// //     parsed?.WorkedPeriod?.TotalExperienceInMonths
// //       ? Number(parsed.WorkedPeriod.TotalExperienceInMonths) / 12
// //       : null,
// //     parsed?.YearOfExperience?.Years,
// //     parsed?.TotalExperienceInYears
// //   );
// // };

// // const deriveSkillsMatch = (scorecard, parsedData) => {
// //   const parsed = readParsedPayload(parsedData);
// //   const matchedRequiredSkills = fallbackArray(
// //     scorecard?.matched_skills,
// //     scorecard?.normalized_matched_skills
// //   );
// //   const extractedResumeSkills = fallbackArray(
// //     parsedData?.parsed_skills,
// //     typeof parsed?.SkillKeywords === "string"
// //       ? parsed.SkillKeywords.split(",").map((entry) => entry.trim()).filter(Boolean)
// //       : [],
// //     typeof parsed?.SkillBlock === "string"
// //       ? parsed.SkillBlock.split(/[,|\n]/).map((entry) => entry.trim()).filter(Boolean)
// //       : []
// //   );

// //   return uniqueStrings([
// //     ...matchedRequiredSkills,
// //     ...extractedResumeSkills,
// //   ]);
// // };

// // const deriveSkillsMiss = (scorecard) => uniqueStrings(scorecard?.missing_skills || []);

// // const deriveResumeText = (parsedData) => {
// //   const parsed = readParsedPayload(parsedData);

// //   return (
// //     parsedData?.extracted_text ||
// //     fallbackText(parsed?.DetailResume, parsed?.ResumeText, parsed?.HtmlResume, parsed?.Experience)
// //   );
// // };

// // export const mapJobToDashboardRecord = ({ job, uploads = [], candidates = [] }) => {
// //   const scoredCandidates = candidates.filter((candidate) => Number.isFinite(Number(candidate.ats_score)));
// //   const parsedUploads = uploads.filter((upload) => upload?.parse_status === "parsed");
// //   const highMatch = scoredCandidates.filter(
// //     (candidate) => !candidate.is_knocked_out && Number(candidate.ats_score) >= 75
// //   ).length;
// //   const avgScore = scoredCandidates.length
// //     ? Math.round(
// //         scoredCandidates.reduce((sum, candidate) => sum + Number(candidate.ats_score || 0), 0) /
// //           scoredCandidates.length
// //       )
// //     : 0;

// //   const uploadStatuses = new Set((uploads || []).map((upload) => upload.parse_status));
// //   let status = "Completed";

// //   if (uploadStatuses.has("pending") || uploadStatuses.has("processing")) {
// //     status = "Processing";
// //   } else if (uploads.length > 0 && uploadStatuses.size === 1 && uploadStatuses.has("failed")) {
// //     status = "Failed";
// //   }

// //   const latestActivityAt =
// //     getLatestTimestamp(parsedUploads, uploads, candidates) ||
// //     job?.updated_at ||
// //     job?.created_at;
// //   const totalResumes =
// //     status === "Processing"
// //       ? Math.max(parsedUploads.length, candidates.length, uploads.length)
// //       : Math.max(parsedUploads.length, candidates.length);

// //   return {
// //     id: job.id,
// //     uploadDate: formatDate(latestActivityAt),
// //     role: job.title || job.job_profile || "Untitled Role",
// //     totalResumes,
// //     highMatch,
// //     avgScore,
// //     status,
// //   };
// // };

// // export const mapCandidateToResultsRow = ({
// //   candidate,
// //   scorecard = null,
// //   job = null,
// //   parsedData = null,
// // }) => {
// //   const weights = getJobWeights(job);
// //   const totalScore = Math.round(Number(candidate?.ats_score ?? scorecard?.total_score ?? 0));

// //   return {
// //     id: candidate.id,
// //     name: candidate.full_name || "Unknown Candidate",
// //     title: deriveTitle(candidate, parsedData),
// //     exp: deriveExperience(candidate, parsedData),
// //     location: deriveLocation(candidate, parsedData),
// //     skill: toPercent(scorecard?.skills_score, weights.skill),
// //     experience: toPercent(scorecard?.experience_score, weights.experience),
// //     titleR: toPercent(scorecard?.job_profile_score, weights.title),
// //     location_score: toPercent(scorecard?.location_score, weights.location),
// //     notes: [],
// //     stage: toStage(candidate),
// //     skills_match: deriveSkillsMatch(scorecard, parsedData),
// //     skills_miss: deriveSkillsMiss(scorecard),
// //     score: totalScore,
// //   };
// // };

// // export const mapNote = (note) => ({
// //   id: note.id,
// //   by: note.created_by,
// //   date: formatDate(note.created_at),
// //   text: note.note_text,
// // });

// // export const mapCandidateToDetail = ({
// //   candidate,
// //   scorecard = null,
// //   parsedData = null,
// //   notes = [],
// //   upload = null,
// //   job = null,
// // }) => {
// //   const base = mapCandidateToResultsRow({ candidate, scorecard, job, parsedData });

// //   return {
// //     ...base,
// //     currentCompany: deriveCompany(candidate, parsedData),
// //     highestEducation: deriveEducation(candidate, parsedData),
// //     resumeUrl: upload?.file_url || null,
// //     resumeText: deriveResumeText(parsedData),
// //     scoreExplanation: scorecard?.score_explanation || null,
// //     notes: notes.map(mapNote),
// //   };
// // };