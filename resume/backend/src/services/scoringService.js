import { normalizeRChilliResumeData } from "./rchilliService.js";
 
const slugify = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
 
const unique = (values) => Array.from(new Set((values || []).filter(Boolean)));
 
const normalizeArray = (values) => unique((values || []).map(slugify).filter(Boolean));
 
const titleMatchRatio = (jobProfile, jobTitles) => {
  const target = slugify(jobProfile);
  if (!target) return 0;
 
  const targetTokens = new Set(target.split(/\s+/).filter(Boolean));
  let bestRatio = 0;
 
  for (const title of jobTitles || []) {
    const normalizedTitle = slugify(title);
    if (!normalizedTitle) continue;
 
    // Exact match
    if (normalizedTitle === target) return 1;
 
    // Substring match either way
    if (normalizedTitle.includes(target) || target.includes(normalizedTitle)) {
      bestRatio = Math.max(bestRatio, 0.9);
      continue;
    }
 
    // Token overlap (bidirectional — a single key word match counts)
    const titleTokens = new Set(normalizedTitle.split(/\s+/).filter(Boolean));
    const overlap = [...targetTokens].filter((token) => titleTokens.has(token)).length;
    const forwardRatio = targetTokens.size ? overlap / targetTokens.size : 0;
    // Also check reverse (candidate title tokens matching job profile tokens)
    const reverseOverlap = [...titleTokens].filter((token) => targetTokens.has(token)).length;
    const reverseRatio = titleTokens.size ? reverseOverlap / titleTokens.size : 0;
    bestRatio = Math.max(bestRatio, forwardRatio, reverseRatio);
  }
 
  return bestRatio;
};
 
// ---------------------------------------------------------------------------
// Location proximity map
// Each key is a canonical city/area name (slugified). The value is an array
// of nearby locations that should earn a partial score (0.6) instead of 0.
// Add or extend entries here as needed.
// ---------------------------------------------------------------------------
const LOCATION_PROXIMITY_MAP = {
  // NCR cluster
  "noida":        ["greater noida", "ghaziabad", "faridabad", "gurugram", "gurgaon", "delhi", "new delhi", "ncr", "delhi ncr", "noida extension", "sector 62 noida"],
  "greater noida":["noida", "ghaziabad", "faridabad", "delhi", "new delhi", "ncr", "delhi ncr"],
  "gurgaon":      ["gurugram", "faridabad", "delhi", "new delhi", "ncr", "delhi ncr", "noida"],
  "gurugram":     ["gurgaon", "faridabad", "delhi", "new delhi", "ncr", "delhi ncr", "noida"],
  "faridabad":    ["gurugram", "gurgaon", "noida", "greater noida", "delhi", "new delhi", "ncr"],
  "ghaziabad":    ["noida", "greater noida", "delhi", "new delhi", "ncr", "delhi ncr"],
  "delhi":        ["new delhi", "ncr", "delhi ncr", "noida", "greater noida", "gurgaon", "gurugram", "faridabad", "ghaziabad"],
  "new delhi":    ["delhi", "ncr", "delhi ncr", "noida", "greater noida", "gurgaon", "gurugram", "faridabad", "ghaziabad"],
 
  // Mumbai cluster
  "mumbai":       ["navi mumbai", "thane", "pune", "kalyan", "vasai", "virar", "mira road"],
  "navi mumbai":  ["mumbai", "thane", "pune"],
  "thane":        ["mumbai", "navi mumbai"],
  "pune":         ["mumbai", "navi mumbai", "pimpri", "chinchwad", "pimpri chinchwad"],
 
  // Bangalore cluster
  "bangalore":    ["bengaluru", "electronic city", "whitefield", "hosur", "mysore"],
  "bengaluru":    ["bangalore", "electronic city", "whitefield", "hosur", "mysore"],
 
  // Hyderabad cluster
  "hyderabad":    ["secunderabad", "cyberabad", "hitec city", "gachibowli", "kondapur"],
  "secunderabad": ["hyderabad", "cyberabad"],
 
  // Chennai cluster
  "chennai":      ["tambaram", "velachery", "siruseri", "sholinganallur"],
 
  // Kolkata cluster
  "kolkata":      ["howrah", "salt lake", "new town", "rajarhat"],
 
  // Ahmedabad cluster
  "ahmedabad":    ["gandhinagar", "surat"],
 
  // Jaipur cluster
  "jaipur":       ["ajmer", "alwar"],
};
 
/**
 * Given a slugified location string, return all known nearby locations.
 * Looks up the map both by exact key and by checking if the location
 * contains any of the map keys (handles "noida sector 62" → finds "noida").
 */
const getNearbyLocations = (locationSlug) => {
  if (!locationSlug) return [];
 
  // Direct lookup
  if (LOCATION_PROXIMITY_MAP[locationSlug]) {
    return LOCATION_PROXIMITY_MAP[locationSlug];
  }
 
  // Partial key match: the slug contains a known key (e.g. "noida extension" → "noida")
  for (const [key, neighbors] of Object.entries(LOCATION_PROXIMITY_MAP)) {
    if (locationSlug.includes(key) || key.includes(locationSlug)) {
      return neighbors;
    }
  }
 
  return [];
};
 
const locationMatchRatio = (jobLocation, candidateLocations) => {
  const target = slugify(jobLocation);
  if (!target) return 1; // No location filter set → full score
 
  const nearbyTargets = getNearbyLocations(target); // cities considered "near" the job location
 
  let bestRatio = 0;
 
  for (const location of candidateLocations || []) {
    const normalizedLocation = slugify(location);
    if (!normalizedLocation) continue;
 
    // 1. Exact match
    if (normalizedLocation === target) return 1;
 
    // 2. Substring match (e.g. "noida sector 18" contains "noida")
    if (normalizedLocation.includes(target) || target.includes(normalizedLocation)) {
      bestRatio = Math.max(bestRatio, 0.9);
      continue;
    }
 
    // 3. Token overlap (e.g. "delhi ncr" and "ncr delhi")
    const targetTokens = new Set(target.split(/\s+/).filter(Boolean));
    const locationTokens = new Set(normalizedLocation.split(/\s+/).filter(Boolean));
    const overlap = [...targetTokens].filter((token) => locationTokens.has(token)).length;
    const tokenRatio = targetTokens.size ? overlap / targetTokens.size : 0;
    if (tokenRatio > 0) {
      bestRatio = Math.max(bestRatio, tokenRatio * 0.9); // slight discount vs. exact substring
      continue;
    }
 
    // 4. Proximity match — check if the candidate's location is near the job location
    //    OR if the candidate's location has the job location as a neighbor
    const isNearJobLocation = nearbyTargets.some(
      (nearby) => normalizedLocation === nearby || normalizedLocation.includes(nearby) || nearby.includes(normalizedLocation)
    );
 
    if (isNearJobLocation) {
      bestRatio = Math.max(bestRatio, 0.6); // Nearby but not exact → 60 % credit
      continue;
    }
 
    // 5. Reverse proximity: job location is near the candidate's location
    const nearbyCandidateLocations = getNearbyLocations(normalizedLocation);
    const isJobLocationNearCandidate = nearbyCandidateLocations.some(
      (nearby) => target === nearby || target.includes(nearby) || nearby.includes(target)
    );
 
    if (isJobLocationNearCandidate) {
      bestRatio = Math.max(bestRatio, 0.6);
    }
  }
 
  return bestRatio;
};
 
const experienceRatio = (candidateExperience, minExperience, maxExperience) => {
  const candidate = Number(candidateExperience) || 0;
  const min = Number(minExperience) || 0;
  const max = maxExperience === null || maxExperience === undefined || maxExperience === ""
    ? null
    : Number(maxExperience);
 
  // If we couldn't extract experience from resume and no minimum is required, don't penalise
  if ((candidateExperience === null || candidateExperience === undefined) && min === 0) {
    return { ratio: 1, penalty: 0, gap: 0 };
  }
 
  if (candidate <= 0 && min > 0) {
    return { ratio: 0, penalty: 0, gap: min };
  }
 
  if (candidate < min) {
    return {
      ratio: min > 0 ? Math.max(0, candidate / min) : 0,
      penalty: 0,
      gap: Number((min - candidate).toFixed(1)),
    };
  }
 
  if (max !== null && candidate > max) {
    const overYears = candidate - max;
    const penalty = Math.min(overYears * 5, 30);
    return {
      ratio: Math.max(0.7, 1 - penalty / 100),
      penalty: Number(penalty.toFixed(2)),
      gap: Number((candidate - max).toFixed(1)),
    };
  }
 
  return { ratio: 1, penalty: 0, gap: 0 };
};
 
const getColor = (score) => {
  if (score >= 75) return "green";
  if (score >= 50) return "orange";
  return "red";
};
 
const withParsedFallbacks = (parsedData) => {
  if (!parsedData?.raw_parser_response) {
    return parsedData || {};
  }
 
  const normalized = normalizeRChilliResumeData(parsedData.raw_parser_response);
 
  return {
    ...parsedData,
    ...normalized.parsedData,
    parsed_job_titles:
      parsedData?.parsed_job_titles?.length ? parsedData.parsed_job_titles : normalized.parsedData.parsed_job_titles,
    parsed_skills:
      parsedData?.parsed_skills?.length ? parsedData.parsed_skills : normalized.parsedData.parsed_skills,
    parsed_locations:
      parsedData?.parsed_locations?.length ? parsedData.parsed_locations : normalized.parsedData.parsed_locations,
    normalized_job_titles:
      parsedData?.normalized_job_titles?.length
        ? parsedData.normalized_job_titles
        : normalized.parsedData.normalized_job_titles,
    normalized_skills:
      parsedData?.normalized_skills?.length
        ? parsedData.normalized_skills
        : normalized.parsedData.normalized_skills,
    normalized_locations:
      parsedData?.normalized_locations?.length
        ? parsedData.normalized_locations
        : normalized.parsedData.normalized_locations,
  };
};
 
// Skill aliases: maps a slugified skill to its equivalent slugified aliases
// So "react" matches "react js", "reactjs", "react.js" etc.
const SKILL_ALIASES = {
  "react":        ["react js", "reactjs", "react native"],
  "react js":     ["react", "reactjs"],
  "node js":      ["node", "nodejs", "node.js", "express", "express js"],
  "node":         ["node js", "nodejs"],
  "vue js":       ["vue", "vuejs"],
  "vue":          ["vue js", "vuejs"],
  "angular":      ["angularjs", "angular js"],
  "next js":      ["nextjs", "next"],
  "typescript":   ["ts"],
  "javascript":   ["js"],
  "python":       ["python3", "python 3"],
  "machine learning": ["ml"],
  "artificial intelligence": ["ai"],
  "rest api":     ["rest", "restful", "api"],
  "ci cd":        ["ci/cd", "cicd", "continuous integration"],
  "aws":          ["amazon web services"],
  "gcp":          ["google cloud", "google cloud platform"],
  "azure":        ["microsoft azure"],
  "postgresql":   ["postgres"],
  "mongodb":      ["mongo"],
  "git":          ["github", "gitlab", "version control"],
};
 
const skillMatches = (requiredSkill, candidateSkillsSet) => {
  if (candidateSkillsSet.has(requiredSkill)) return true;
  // Check aliases
  const aliases = SKILL_ALIASES[requiredSkill] || [];
  if (aliases.some((a) => candidateSkillsSet.has(a))) return true;
  // Substring match: "react" matches "react native", "react js" matches "react"
  for (const candidateSkill of candidateSkillsSet) {
    if (
      candidateSkill.includes(requiredSkill) ||
      requiredSkill.includes(candidateSkill)
    ) {
      // Guard: avoid "java" matching "javascript" — require word boundary effect
      const reqWords = requiredSkill.split(/\s+/);
      const canWords = candidateSkill.split(/\s+/);
      const overlap = reqWords.filter((w) => canWords.includes(w)).length;
      if (overlap >= Math.min(reqWords.length, canWords.length)) return true;
    }
  }
  return false;
};
 
export const scoreCandidateAgainstJob = ({ job, candidate, parsedData }) => {
  const effectiveParsedData = withParsedFallbacks(parsedData);
  const requiredSkills = normalizeArray(job?.required_skills);
  const candidateSkillsRaw = normalizeArray(
    effectiveParsedData?.normalized_skills || effectiveParsedData?.parsed_skills
  );
  const candidateSkillsSet = new Set(candidateSkillsRaw);
 
  const matchedSkills = requiredSkills.filter((skill) => skillMatches(skill, candidateSkillsSet));
  const missingSkills = requiredSkills.filter((skill) => !skillMatches(skill, candidateSkillsSet));
 
  const skillsRatio =
    requiredSkills.length > 0 ? matchedSkills.length / requiredSkills.length : 1;
  const titleRatio = titleMatchRatio(
    job?.job_profile,
    effectiveParsedData?.parsed_job_titles || [candidate?.current_job_title]
  );
  const locationRatio = locationMatchRatio(
    job?.location,
    effectiveParsedData?.parsed_locations || [candidate?.location]
  );
  const experienceInfo = experienceRatio(
    candidate?.total_experience,
    job?.min_experience,
    job?.max_experience
  );
 
  const skillWeight = Number(job?.weight_skills) || 40;
  const titleWeight = Number(job?.weight_job_profile) || 25;
  const experienceWeight = Number(job?.weight_experience) || 20;
  const locationWeight = Number(job?.weight_location) || 15;
 
  const skillsScore = Number((skillsRatio * skillWeight).toFixed(2));
  const jobProfileScore = Number((titleRatio * titleWeight).toFixed(2));
  const experienceScore = Number((experienceInfo.ratio * experienceWeight).toFixed(2));
  const locationScore = Number((locationRatio * locationWeight).toFixed(2));
 
  const knockoutReasons = [];
 
  if (job?.enable_knockout_must_have_skill && missingSkills.length > 0) {
    knockoutReasons.push("Missing required skills");
  }
 
  if (job?.enable_knockout_work_authorization) {
    const requiredAuth = slugify(job?.required_work_authorization);
    const candidateAuth = slugify(candidate?.work_authorization);
    if (!requiredAuth || !candidateAuth || requiredAuth !== candidateAuth) {
      knockoutReasons.push("Work authorization mismatch");
    }
  }
 
  if (job?.enable_knockout_min_degree) {
    const requiredDegree = slugify(job?.minimum_degree);
    const candidateDegree = slugify(candidate?.highest_education);
    if (!requiredDegree || !candidateDegree || !candidateDegree.includes(requiredDegree)) {
      knockoutReasons.push("Minimum degree not matched");
    }
  }
 
  if (job?.enable_knockout_salary_range) {
    const expectedCtc = Number(candidate?.expected_ctc);
    const salaryMin = Number(job?.salary_min);
    const salaryMax = Number(job?.salary_max);
    if (
      expectedCtc &&
      ((salaryMin && expectedCtc < salaryMin) || (salaryMax && expectedCtc > salaryMax))
    ) {
      knockoutReasons.push("Expected salary out of range");
    }
  }
 
  const totalScore = Number(
    Math.max(0, Math.min(100, skillsScore + jobProfileScore + experienceScore + locationScore)).toFixed(2)
  );
 
  const matchedLocation = (effectiveParsedData?.parsed_locations || [candidate?.location]).find((entry) => {
    const normalizedEntry = slugify(entry);
    const normalizedTarget = slugify(job?.location);
    return normalizedEntry && normalizedTarget
      ? normalizedEntry.includes(normalizedTarget) || normalizedTarget.includes(normalizedEntry)
      : false;
  }) || null;
 
  return {
    totalScore,
    scoreColor: getColor(totalScore),
    isKnockedOut: knockoutReasons.length > 0,
    scorecard: {
      total_score: totalScore,
      job_profile_score: jobProfileScore,
      experience_score: experienceScore,
      location_score: locationScore,
      skills_score: skillsScore,
      normalized_required_skills: requiredSkills,
      normalized_matched_skills: matchedSkills,
      matched_skills: matchedSkills,
      missing_skills: missingSkills,
      matched_location: matchedLocation,
      experience_gap: experienceInfo.gap,
      overqualification_penalty: experienceInfo.penalty,
      title_match_reason:
        titleRatio >= 0.9
          ? "Strong title match"
          : titleRatio >= 0.5
          ? "Partial title alignment"
          : "Weak title alignment",
      is_knocked_out: knockoutReasons.length > 0,
      knockout_reasons: knockoutReasons,
      score_explanation: `Matched ${matchedSkills.length}/${requiredSkills.length || 0} required skills, title match ${(titleRatio * 100).toFixed(0)}%, experience ${(experienceInfo.ratio * 100).toFixed(0)}%, location ${(locationRatio * 100).toFixed(0)}%.`,
    },
  };
};
 
export const buildJobRankings = (candidates) => {
  const eligible = [...(candidates || [])]
    .filter((candidate) => !candidate.is_knocked_out)
    .sort((a, b) => (Number(b.ats_score) || 0) - (Number(a.ats_score) || 0));
 
  return eligible.map((candidate, index) => ({
    id: candidate.id,
    rank_position: index + 1,
  }));
};

// import { normalizeRChilliResumeData } from "./rchilliService.js";

// const slugify = (value) =>
//   String(value || "")
//     .trim()
//     .toLowerCase()
//     .replace(/[^a-z0-9]+/g, " ")
//     .trim();

// const unique = (values) => Array.from(new Set((values || []).filter(Boolean)));

// const normalizeArray = (values) => unique((values || []).map(slugify).filter(Boolean));

// const titleMatchRatio = (jobProfile, jobTitles) => {
//   const target = slugify(jobProfile);
//   if (!target) return 0;

//   const targetTokens = new Set(target.split(/\s+/).filter(Boolean));
//   let bestRatio = 0;

//   for (const title of jobTitles || []) {
//     const normalizedTitle = slugify(title);
//     if (!normalizedTitle) continue;

//     // Exact match
//     if (normalizedTitle === target) return 1;

//     // Substring match either way
//     if (normalizedTitle.includes(target) || target.includes(normalizedTitle)) {
//       bestRatio = Math.max(bestRatio, 0.9);
//       continue;
//     }

//     // Token overlap (bidirectional — a single key word match counts)
//     const titleTokens = new Set(normalizedTitle.split(/\s+/).filter(Boolean));
//     const overlap = [...targetTokens].filter((token) => titleTokens.has(token)).length;
//     const forwardRatio = targetTokens.size ? overlap / targetTokens.size : 0;
//     // Also check reverse (candidate title tokens matching job profile tokens)
//     const reverseOverlap = [...titleTokens].filter((token) => targetTokens.has(token)).length;
//     const reverseRatio = titleTokens.size ? reverseOverlap / titleTokens.size : 0;
//     bestRatio = Math.max(bestRatio, forwardRatio, reverseRatio);
//   }

//   return bestRatio;
// };

// const locationMatchRatio = (jobLocation, candidateLocations) => {
//   const target = slugify(jobLocation);
//   if (!target) return 1;

//   let bestRatio = 0;

//   for (const location of candidateLocations || []) {
//     const normalizedLocation = slugify(location);
//     if (!normalizedLocation) continue;
//     if (normalizedLocation === target) return 1;
//     if (normalizedLocation.includes(target) || target.includes(normalizedLocation)) {
//       bestRatio = Math.max(bestRatio, 0.8);
//     }

//     const targetTokens = new Set(target.split(/\s+/).filter(Boolean));
//     const locationTokens = new Set(normalizedLocation.split(/\s+/).filter(Boolean));
//     const overlap = [...targetTokens].filter((token) => locationTokens.has(token)).length;
//     const ratio = targetTokens.size ? overlap / targetTokens.size : 0;
//     bestRatio = Math.max(bestRatio, ratio);
//   }

//   return bestRatio;
// };

// const experienceRatio = (candidateExperience, minExperience, maxExperience) => {
//   const candidate = Number(candidateExperience) || 0;
//   const min = Number(minExperience) || 0;
//   const max = maxExperience === null || maxExperience === undefined || maxExperience === ""
//     ? null
//     : Number(maxExperience);

//   // If we couldn't extract experience from resume and no minimum is required, don't penalise
//   if ((candidateExperience === null || candidateExperience === undefined) && min === 0) {
//     return { ratio: 1, penalty: 0, gap: 0 };
//   }

//   if (candidate <= 0 && min > 0) {
//     return { ratio: 0, penalty: 0, gap: min };
//   }

//   if (candidate < min) {
//     return {
//       ratio: min > 0 ? Math.max(0, candidate / min) : 0,
//       penalty: 0,
//       gap: Number((min - candidate).toFixed(1)),
//     };
//   }

//   if (max !== null && candidate > max) {
//     const overYears = candidate - max;
//     const penalty = Math.min(overYears * 5, 30);
//     return {
//       ratio: Math.max(0.7, 1 - penalty / 100),
//       penalty: Number(penalty.toFixed(2)),
//       gap: Number((candidate - max).toFixed(1)),
//     };
//   }

//   return { ratio: 1, penalty: 0, gap: 0 };
// };

// const getColor = (score) => {
//   if (score >= 75) return "green";
//   if (score >= 50) return "orange";
//   return "red";
// };

// const withParsedFallbacks = (parsedData) => {
//   if (!parsedData?.raw_parser_response) {
//     return parsedData || {};
//   }

//   const normalized = normalizeRChilliResumeData(parsedData.raw_parser_response);

//   return {
//     ...parsedData,
//     ...normalized.parsedData,
//     parsed_job_titles:
//       parsedData?.parsed_job_titles?.length ? parsedData.parsed_job_titles : normalized.parsedData.parsed_job_titles,
//     parsed_skills:
//       parsedData?.parsed_skills?.length ? parsedData.parsed_skills : normalized.parsedData.parsed_skills,
//     parsed_locations:
//       parsedData?.parsed_locations?.length ? parsedData.parsed_locations : normalized.parsedData.parsed_locations,
//     normalized_job_titles:
//       parsedData?.normalized_job_titles?.length
//         ? parsedData.normalized_job_titles
//         : normalized.parsedData.normalized_job_titles,
//     normalized_skills:
//       parsedData?.normalized_skills?.length
//         ? parsedData.normalized_skills
//         : normalized.parsedData.normalized_skills,
//     normalized_locations:
//       parsedData?.normalized_locations?.length
//         ? parsedData.normalized_locations
//         : normalized.parsedData.normalized_locations,
//   };
// };

// export const scoreCandidateAgainstJob = ({ job, candidate, parsedData }) => {
//   const effectiveParsedData = withParsedFallbacks(parsedData);
//   const requiredSkills = normalizeArray(job?.required_skills);
//   const candidateSkills = normalizeArray(
//     effectiveParsedData?.normalized_skills || effectiveParsedData?.parsed_skills
//   );
//   const matchedSkills = requiredSkills.filter((skill) => candidateSkills.includes(skill));
//   const missingSkills = requiredSkills.filter((skill) => !candidateSkills.includes(skill));

//   const skillsRatio =
//     requiredSkills.length > 0 ? matchedSkills.length / requiredSkills.length : 1;
//   const titleRatio = titleMatchRatio(
//     job?.job_profile,
//     effectiveParsedData?.parsed_job_titles || [candidate?.current_job_title]
//   );
//   const locationRatio = locationMatchRatio(
//     job?.location,
//     effectiveParsedData?.parsed_locations || [candidate?.location]
//   );
//   const experienceInfo = experienceRatio(
//     candidate?.total_experience,
//     job?.min_experience,
//     job?.max_experience
//   );

//   const skillWeight = Number(job?.weight_skills) || 40;
//   const titleWeight = Number(job?.weight_job_profile) || 25;
//   const experienceWeight = Number(job?.weight_experience) || 20;
//   const locationWeight = Number(job?.weight_location) || 15;

//   const skillsScore = Number((skillsRatio * skillWeight).toFixed(2));
//   const jobProfileScore = Number((titleRatio * titleWeight).toFixed(2));
//   const experienceScore = Number((experienceInfo.ratio * experienceWeight).toFixed(2));
//   const locationScore = Number((locationRatio * locationWeight).toFixed(2));

//   const knockoutReasons = [];

//   if (job?.enable_knockout_must_have_skill && missingSkills.length > 0) {
//     knockoutReasons.push("Missing required skills");
//   }

//   if (job?.enable_knockout_work_authorization) {
//     const requiredAuth = slugify(job?.required_work_authorization);
//     const candidateAuth = slugify(candidate?.work_authorization);
//     if (!requiredAuth || !candidateAuth || requiredAuth !== candidateAuth) {
//       knockoutReasons.push("Work authorization mismatch");
//     }
//   }

//   if (job?.enable_knockout_min_degree) {
//     const requiredDegree = slugify(job?.minimum_degree);
//     const candidateDegree = slugify(candidate?.highest_education);
//     if (!requiredDegree || !candidateDegree || !candidateDegree.includes(requiredDegree)) {
//       knockoutReasons.push("Minimum degree not matched");
//     }
//   }

//   if (job?.enable_knockout_salary_range) {
//     const expectedCtc = Number(candidate?.expected_ctc);
//     const salaryMin = Number(job?.salary_min);
//     const salaryMax = Number(job?.salary_max);
//     if (
//       expectedCtc &&
//       ((salaryMin && expectedCtc < salaryMin) || (salaryMax && expectedCtc > salaryMax))
//     ) {
//       knockoutReasons.push("Expected salary out of range");
//     }
//   }

//   const totalScore = Number(
//     Math.max(0, Math.min(100, skillsScore + jobProfileScore + experienceScore + locationScore)).toFixed(2)
//   );

//   const matchedLocation = (effectiveParsedData?.parsed_locations || [candidate?.location]).find((entry) => {
//     const normalizedEntry = slugify(entry);
//     const normalizedTarget = slugify(job?.location);
//     return normalizedEntry && normalizedTarget
//       ? normalizedEntry.includes(normalizedTarget) || normalizedTarget.includes(normalizedEntry)
//       : false;
//   }) || null;

//   return {
//     totalScore,
//     scoreColor: getColor(totalScore),
//     isKnockedOut: knockoutReasons.length > 0,
//     scorecard: {
//       total_score: totalScore,
//       job_profile_score: jobProfileScore,
//       experience_score: experienceScore,
//       location_score: locationScore,
//       skills_score: skillsScore,
//       normalized_required_skills: requiredSkills,
//       normalized_matched_skills: matchedSkills,
//       matched_skills: matchedSkills,
//       missing_skills: missingSkills,
//       matched_location: matchedLocation,
//       experience_gap: experienceInfo.gap,
//       overqualification_penalty: experienceInfo.penalty,
//       title_match_reason:
//         titleRatio >= 0.9
//           ? "Strong title match"
//           : titleRatio >= 0.5
//           ? "Partial title alignment"
//           : "Weak title alignment",
//       is_knocked_out: knockoutReasons.length > 0,
//       knockout_reasons: knockoutReasons,
//       score_explanation: `Matched ${matchedSkills.length}/${requiredSkills.length || 0} required skills, title match ${(titleRatio * 100).toFixed(0)}%, experience ${(experienceInfo.ratio * 100).toFixed(0)}%, location ${(locationRatio * 100).toFixed(0)}%.`,
//     },
//   };
// };

// export const buildJobRankings = (candidates) => {
//   const eligible = [...(candidates || [])]
//     .filter((candidate) => !candidate.is_knocked_out)
//     .sort((a, b) => (Number(b.ats_score) || 0) - (Number(a.ats_score) || 0));

//   return eligible.map((candidate, index) => ({
//     id: candidate.id,
//     rank_position: index + 1,
//   }));
// };