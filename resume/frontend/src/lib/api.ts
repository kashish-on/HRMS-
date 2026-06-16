import type {
  Candidate,
  InterviewForm,
  Note,
  OfferForm,
  ParseRecord,
  Stage,
} from '../types';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api').replace(/\/$/, '');

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init?.headers || {}),
    },
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || 'Request failed');
  }

  return payload as T;
}

export interface ParseRunInput {
  role: string;
  exp: string;
  location: string;
  skills: string;
  files: File[];
}

export interface ParseRunResponse {
  status: string;
  message: string;
  job: { id: string };
  record: ParseRecord;
  candidates: Candidate[];
  summary: {
    totalFiles: number;
    parsedCount: number;
    failedCount: number;
    rankedEligibleCount: number;
  };
  failedUploads: Array<{
    uploadId: string;
    fileName: string;
    message: string;
  }>;
}

export async function fetchRecords(): Promise<ParseRecord[]> {
  const payload = await request<{ records?: ParseRecord[] }>('/jobs');
  return payload.records || [];
}

export async function fetchCandidatesForJob(jobId: string): Promise<Candidate[]> {
  const payload = await request<{ candidates?: Candidate[] }>(`/jobs/${jobId}/candidates`);
  return payload.candidates || [];
}

export async function fetchCandidateDetail(candidateId: string): Promise<Candidate> {
  const payload = await request<{ candidate: Candidate }>(`/candidates/${candidateId}`);
  return payload.candidate;
}

export async function runParseFlow(input: ParseRunInput): Promise<ParseRunResponse> {
  const formData = new FormData();
  formData.append('role', input.role);
  formData.append('title', input.role);
  formData.append('job_profile', input.role);
  formData.append('location', input.location);
  formData.append('skills', input.skills);

  const expValue = input.exp.replace(/[^\d]/g, '');
  if (expValue) {
    formData.append('experience', expValue);
    formData.append('min_experience', expValue);
  }

  for (const file of input.files) {
    formData.append('files', file);
  }

  return request<ParseRunResponse>('/ats/parse-run', {
    method: 'POST',
    body: formData,
  });
}

export async function saveCandidateStage(candidateId: string, stage: Stage) {
  return request<{ candidate: Candidate }>(`/candidates/${candidateId}/stage`, {
    method: 'PATCH',
    body: JSON.stringify({ stage }),
  });
}

export async function bulkSaveCandidateStage(candidateIds: string[], stage: Stage) {
  return request<{ candidates: Candidate[]; updatedCount: number }>('/candidates/bulk-stage', {
    method: 'PATCH',
    body: JSON.stringify({ candidateIds, stage }),
  });
}

export async function createCandidateNote(candidateId: string, noteText: string, createdBy?: string) {
  return request<{ note: Note }>(`/candidates/${candidateId}/notes`, {
    method: 'POST',
    body: JSON.stringify({
      created_by: createdBy?.trim() || 'HR Team',
      note_text: noteText,
    }),
  });
}

export async function createInterview(
  candidateId: string,
  jobId: string,
  form: InterviewForm
) {
  return request<{ interview: unknown }>(`/candidates/${candidateId}/interviews`, {
    method: 'POST',
    body: JSON.stringify({
      job_id: jobId,
      interview_type: form.type,
      round: form.round,
      interviewers: form.interviewers,
      scheduled_date: form.date,
      scheduled_slot: form.slot,
      duration_minutes: Number(form.duration),
      notify_via: form.notifyVia,
      message: form.message,
    }),
  });
}

export async function createOffer(
  candidateId: string,
  jobId: string,
  form: OfferForm,
  offerFile?: File | null
) {
  if (offerFile) {
    const formData = new FormData();
    formData.append('job_id', jobId);
    formData.append('designation', form.designation);
    if (form.ctc?.trim()) formData.append('ctc', form.ctc.trim());
    if (form.joiningDate?.trim()) formData.append('joining_date', form.joiningDate.trim());
    if (form.reportingTo?.trim()) formData.append('reporting_to', form.reportingTo.trim());
    if (form.additionalNote?.trim()) formData.append('additional_note', form.additionalNote.trim());
    formData.append('status', 'generated');
    formData.append('offerFile', offerFile);

    return request<{ offer: unknown }>(`/candidates/${candidateId}/offers`, {
      method: 'POST',
      body: formData,
    });
  }

  return request<{ offer: unknown }>(`/candidates/${candidateId}/offers`, {
    method: 'POST',
    body: JSON.stringify({
      job_id: jobId,
      designation: form.designation,
      ctc: form.ctc,
      joining_date: form.joiningDate,
      reporting_to: form.reportingTo,
      additional_note: form.additionalNote,
      status: 'generated',
    }),
  });
}

export async function rejectCandidate(candidateId: string, jobId: string, additionalNote = '') {
  return request<{ candidate: Candidate }>(`/candidates/${candidateId}/reject`, {
    method: 'POST',
    body: JSON.stringify({
      job_id: jobId,
      additional_note: additionalNote || null,
    }),
  });
}

export async function deleteCandidate(candidateId: string) {
  return request<{ deletedCandidateId: string; deletedUploadId: string | null; jobId: string }>(
    `/candidates/${candidateId}`,
    {
      method: 'DELETE',
    }
  );
}

// ── Public Careers Portal API ─────────────────────────────────────────────────

export interface PublicJob {
  id: string;
  title: string;
  job_profile: string;
  description: string | null;
  location: string | null;
  min_experience: number;
  max_experience: number | null;
  required_skills: string[];
  optional_skills: string[];
  created_at: string;
}

export async function fetchPublicJobs(): Promise<PublicJob[]> {
  const payload = await request<{ jobs?: PublicJob[] }>('/careers/jobs');
  return payload.jobs || [];
}

export async function fetchPublicJob(jobId: string): Promise<PublicJob> {
  const payload = await request<{ job: PublicJob }>(`/careers/jobs/${jobId}`);
  return payload.job;
}

export async function submitPortalApplication(
  jobId: string,
  file: File,
  applicantName?: string,
  applicantEmail?: string
): Promise<{ uploadId: string }> {
  const form = new FormData();
  form.append('file', file);
  if (applicantName?.trim()) form.append('applicant_name', applicantName.trim());
  if (applicantEmail?.trim()) form.append('applicant_email', applicantEmail.trim());

  return request<{ uploadId: string }>(`/careers/jobs/${jobId}/apply`, {
    method: 'POST',
    body: form,
  });
}

// ── Job status toggle ─────────────────────────────────────────────────────────

export async function toggleJobStatus(jobId: string, isOpen: boolean): Promise<void> {
  await request<{ status: string }>(`/jobs/${jobId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_open: isOpen }),
  });
}

// import type {
//   Candidate,
//   InterviewForm,
//   Note,
//   OfferForm,
//   ParseRecord,
//   Stage,
// } from '../types';

// const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api').replace(/\/$/, '');

// async function request<T>(path: string, init?: RequestInit): Promise<T> {
//   const response = await fetch(`${API_BASE}${path}`, {
//     ...init,
//     headers: {
//       ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
//       ...(init?.headers || {}),
//     },
//   });

//   const text = await response.text();
//   const payload = text ? JSON.parse(text) : null;

//   if (!response.ok) {
//     throw new Error(payload?.message || payload?.error || 'Request failed');
//   }

//   return payload as T;
// }

// export interface ParseRunInput {
//   role: string;
//   exp: string;
//   location: string;
//   skills: string;
//   files: File[];
// }

// export interface ParseRunResponse {
//   status: string;
//   message: string;
//   job: { id: string };
//   record: ParseRecord;
//   candidates: Candidate[];
//   summary: {
//     totalFiles: number;
//     parsedCount: number;
//     failedCount: number;
//     rankedEligibleCount: number;
//   };
//   failedUploads: Array<{
//     uploadId: string;
//     fileName: string;
//     message: string;
//   }>;
// }

// export async function fetchRecords(): Promise<ParseRecord[]> {
//   const payload = await request<{ records?: ParseRecord[] }>('/jobs');
//   return payload.records || [];
// }

// export async function fetchCandidatesForJob(jobId: string): Promise<Candidate[]> {
//   const payload = await request<{ candidates?: Candidate[] }>(`/jobs/${jobId}/candidates`);
//   return payload.candidates || [];
// }

// export async function fetchCandidateDetail(candidateId: string): Promise<Candidate> {
//   const payload = await request<{ candidate: Candidate }>(`/candidates/${candidateId}`);
//   return payload.candidate;
// }

// export async function runParseFlow(input: ParseRunInput): Promise<ParseRunResponse> {
//   const formData = new FormData();
//   formData.append('role', input.role);
//   formData.append('title', input.role);
//   formData.append('job_profile', input.role);
//   formData.append('location', input.location);
//   formData.append('skills', input.skills);

//   const expValue = input.exp.replace(/[^\d]/g, '');
//   if (expValue) {
//     formData.append('experience', expValue);
//     formData.append('min_experience', expValue);
//   }

//   for (const file of input.files) {
//     formData.append('files', file);
//   }

//   return request<ParseRunResponse>('/ats/parse-run', {
//     method: 'POST',
//     body: formData,
//   });
// }

// export async function saveCandidateStage(candidateId: string, stage: Stage) {
//   return request<{ candidate: Candidate }>(`/candidates/${candidateId}/stage`, {
//     method: 'PATCH',
//     body: JSON.stringify({ stage }),
//   });
// }

// export async function bulkSaveCandidateStage(candidateIds: string[], stage: Stage) {
//   return request<{ candidates: Candidate[]; updatedCount: number }>('/candidates/bulk-stage', {
//     method: 'PATCH',
//     body: JSON.stringify({ candidateIds, stage }),
//   });
// }

// export async function createCandidateNote(candidateId: string, noteText: string) {
//   return request<{ note: Note }>(`/candidates/${candidateId}/notes`, {
//     method: 'POST',
//     body: JSON.stringify({
//       created_by: 'Anchal',
//       note_text: noteText,
//     }),
//   });
// }

// export async function createInterview(
//   candidateId: string,
//   jobId: string,
//   form: InterviewForm
// ) {
//   return request<{ interview: unknown }>(`/candidates/${candidateId}/interviews`, {
//     method: 'POST',
//     body: JSON.stringify({
//       job_id: jobId,
//       interview_type: form.type,
//       round: form.round,
//       interviewers: form.interviewers,
//       scheduled_date: form.date,
//       scheduled_slot: form.slot,
//       duration_minutes: Number(form.duration),
//       notify_via: form.notifyVia,
//       message: form.message,
//     }),
//   });
// }

// export async function createOffer(
//   candidateId: string,
//   jobId: string,
//   form: OfferForm
// ) {
//   return request<{ offer: unknown }>(`/candidates/${candidateId}/offers`, {
//     method: 'POST',
//     body: JSON.stringify({
//       job_id: jobId,
//       designation: form.designation,
//       ctc: form.ctc,
//       joining_date: form.joiningDate,
//       reporting_to: form.reportingTo,
//       additional_note: form.additionalNote,
//       status: 'generated',
//     }),
//   });
// }

// export async function rejectCandidate(candidateId: string, jobId: string, additionalNote = '') {
//   return request<{ candidate: Candidate }>(`/candidates/${candidateId}/reject`, {
//     method: 'POST',
//     body: JSON.stringify({
//       job_id: jobId,
//       additional_note: additionalNote || null,
//     }),
//   });
// }

// export async function deleteCandidate(candidateId: string) {
//   return request<{ deletedCandidateId: string; deletedUploadId: string | null; jobId: string }>(
//     `/candidates/${candidateId}`,
//     {
//       method: 'DELETE',
//     }
//   );
// }

// // ── Public Careers Portal API ─────────────────────────────────────────────────

// export interface PublicJob {
//   id: string;
//   title: string;
//   job_profile: string;
//   description: string | null;
//   location: string | null;
//   min_experience: number;
//   max_experience: number | null;
//   required_skills: string[];
//   optional_skills: string[];
//   created_at: string;
// }

// export async function fetchPublicJobs(): Promise<PublicJob[]> {
//   const payload = await request<{ jobs?: PublicJob[] }>('/careers/jobs');
//   return payload.jobs || [];
// }

// export async function fetchPublicJob(jobId: string): Promise<PublicJob> {
//   const payload = await request<{ job: PublicJob }>(`/careers/jobs/${jobId}`);
//   return payload.job;
// }

// export async function submitPortalApplication(
//   jobId: string,
//   file: File,
//   applicantName?: string,
//   applicantEmail?: string
// ): Promise<{ uploadId: string }> {
//   const form = new FormData();
//   form.append('file', file);
//   if (applicantName?.trim()) form.append('applicant_name', applicantName.trim());
//   if (applicantEmail?.trim()) form.append('applicant_email', applicantEmail.trim());

//   return request<{ uploadId: string }>(`/careers/jobs/${jobId}/apply`, {
//     method: 'POST',
//     body: form,
//   });
// }

