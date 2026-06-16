/**
 * CareerPortal.tsx
 *
 * Standalone public-facing careers page.
 * Deploy separately (e.g. on the same domain at /careers) or embed in the HRMS frontend.
 *
 * Uses the same purple design system as the ATS dashboard.
 * No auth required — completely public.
 *
 * Routing (internal state machine):
 *   "list"   – grid of all open positions
 *   "detail" – single job detail + apply form
 *   "done"   – application success screen
 */

import { useEffect, useRef, useState } from "react";

// ── Config ────────────────────────────────────────────────────────────────────
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5001/api").replace(/\/$/, "");

// ── Types ─────────────────────────────────────────────────────────────────────
interface Job {
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

type Screen = "list" | "detail" | "done";

// ── Helpers ───────────────────────────────────────────────────────────────────
function expLabel(min: number, max: number | null): string {
  if (!min && !max) return "Any experience";
  if (!max) return `${min}+ years`;
  return `${min}–${max} years`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Posted today";
  if (days === 1) return "Posted yesterday";
  if (days < 30) return `Posted ${days} days ago`;
  const months = Math.floor(days / 30);
  return `Posted ${months} month${months > 1 ? "s" : ""} ago`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Chip({ label, variant = "skill" }: { label: string; variant?: "skill" | "optional" | "meta" }) {
  const cls =
    variant === "skill"
      ? "bg-[#f0e6ff] text-[#6f2dbd]"
      : variant === "optional"
        ? "bg-[#f0f4ff] text-[#4060c8]"
        : "bg-[#f6f3fa] text-[#7d6f93]";
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-[12px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

function JobCard({ job, onOpen }: { job: Job; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full rounded-[18px] border border-[#ede7f4] bg-white p-6 text-left shadow-[0_4px_18px_rgba(111,81,154,0.05)] transition-all duration-150 hover:border-[#c4a8e8] hover:shadow-[0_8px_28px_rgba(111,81,154,0.13)] focus:outline-none focus:ring-2 focus:ring-[#c4a8e8]"
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[17px] font-semibold text-[#1f1830] group-hover:text-[#6f2dbd] transition-colors">
            {job.title}
          </div>
          <div className="mt-0.5 text-[13px] text-[#9c90af]">{job.job_profile}</div>
        </div>
        <span className="mt-0.5 shrink-0 rounded-full bg-[#f0faf0] px-2.5 py-1 text-[11px] font-semibold text-[#3aac5d]">
          Hiring
        </span>
      </div>

      {/* Meta */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {job.location && <Chip label={`📍 ${job.location}`} variant="meta" />}
        <Chip label={`⏱ ${expLabel(job.min_experience, job.max_experience)}`} variant="meta" />
      </div>

      {/* Skills preview */}
      {job.required_skills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {job.required_skills.slice(0, 4).map((s) => (
            <Chip key={s} label={s} />
          ))}
          {job.required_skills.length > 4 && (
            <Chip label={`+${job.required_skills.length - 4} more`} variant="meta" />
          )}
        </div>
      )}

      <div className="mt-4 text-[11px] text-[#c1b4d1]">{timeAgo(job.created_at)}</div>
    </button>
  );
}

function ApplyForm({ job, onSuccess }: { job: Job; onSuccess: () => void }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [contactNo, setContactNo] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!file) { setError("Please attach your resume."); return; }
    if (!email.includes("@")) { setError("Enter a valid email address."); return; }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("file", file);
      if (name.trim()) form.append("applicant_name", name.trim());
      form.append("applicant_email", email.trim());
      if (contactNo.trim()) form.append("applicant_contact_no", contactNo.trim());

      const res = await fetch(`${API_BASE}/careers/jobs/${job.id}/apply`, {
        method: "POST",
        body: form,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Submission failed.");
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-[#4a3c60]">Full Name</label>
          <input
            type="text"
            placeholder="Rahul Sharma"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-11 w-full rounded-lg border border-[#e5deef] bg-[#fbfafe] px-3.5 text-[13px] text-[#1f1830] outline-none placeholder:text-[#c1b6cf] focus:border-[#b48de2] focus:ring-2 focus:ring-[#ede6f8]"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-[#4a3c60]">
            Email <span className="text-[#d94f4f]">*</span>
          </label>
          <input
            type="email"
            placeholder="you@email.com"
            value={email}
            required
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 w-full rounded-lg border border-[#e5deef] bg-[#fbfafe] px-3.5 text-[13px] text-[#1f1830] outline-none placeholder:text-[#c1b6cf] focus:border-[#b48de2] focus:ring-2 focus:ring-[#ede6f8]"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-[#4a3c60]">Contact No</label>
          <input
            type="tel"
            placeholder="+91 98765 43210"
            value={contactNo}
            onChange={(e) => setContactNo(e.target.value)}
            className="h-11 w-full rounded-lg border border-[#e5deef] bg-[#fbfafe] px-3.5 text-[13px] text-[#1f1830] outline-none placeholder:text-[#c1b6cf] focus:border-[#b48de2] focus:ring-2 focus:ring-[#ede6f8]"
          />
        </div>
      </div>

      {/* File picker */}
      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-[#4a3c60]">
          Resume <span className="text-[#d94f4f]">*</span>
        </label>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <div
          onClick={() => fileRef.current?.click()}
          className="flex cursor-pointer items-center gap-4 rounded-[14px] border border-dashed border-[#dcd2ec] bg-[#faf6ff] px-5 py-5 transition hover:border-[#c4a8e8]"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f0e6ff] text-[#6f2dbd]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <path d="M14 2v6h6" />
              <path d="M12 18v-6" />
              <path d="M9.5 15.5L12 13l2.5 2.5" />
            </svg>
          </div>
          <div>
            {file ? (
              <>
                <div className="text-[13px] font-semibold text-[#6f2dbd]">{file.name}</div>
                <div className="text-[11px] text-[#a89ec0]">
                  {(file.size / 1024).toFixed(0)} KB — click to change
                </div>
              </>
            ) : (
              <>
                <div className="text-[13px] font-medium text-[#5a4875]">
                  Click to upload resume
                </div>
                <div className="text-[11px] text-[#a89ec0]">PDF or Word, max 10 MB</div>
              </>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="h-12 w-full rounded-xl bg-[#6f2dbd] text-[14px] font-semibold text-white shadow-[0_4px_14px_rgba(111,45,189,0.3)] transition hover:bg-[#5c22a4] disabled:opacity-60"
      >
        {submitting ? "Submitting…" : "Submit Application"}
      </button>
    </form>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CareerPortal() {
  const [screen, setScreen] = useState<Screen>("list");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  useEffect(() => {
    document.title = "ObserveNow Careers";
  }, []);

  // ── Fetch all jobs ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/careers/jobs`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to load openings.");
        setJobs(data.jobs || []);
      } catch (err: unknown) {
        setFetchError(err instanceof Error ? err.message : "Could not load job openings.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Scroll to top on screen change ─────────────────────────────────────────
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [screen]);

  // ── Screens ─────────────────────────────────────────────────────────────────

  if (screen === "done") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f6fb] px-4">
        <div className="max-w-md rounded-[24px] border border-[#ede7f4] bg-white px-8 py-12 text-center shadow-[0_10px_40px_rgba(111,81,154,0.1)]">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#edfaf1] text-[#3aac5d]">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h2 className="text-[22px] font-semibold text-[#1f1830]">Application received!</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-[#7d6f93]">
            Thanks for applying to <strong>{selectedJob?.title}</strong>. Our team will review your resume
            and reach out if your profile matches what we're looking for.
          </p>
          <button
            type="button"
            onClick={() => { setScreen("list"); setSelectedJob(null); }}
            className="mt-8 h-11 w-full rounded-xl bg-[#6f2dbd] text-[13px] font-semibold text-white transition hover:bg-[#5c22a4]"
          >
            View all openings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f6fb]">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-[#ede7f4] bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <button
            type="button"
            onClick={() => setScreen("list")}
            className="text-[17px] font-semibold text-[#1f1830] hover:text-[#6f2dbd] transition-colors"
          >
            ObserveNow — Careers
          </button>
          <span className="rounded-full bg-[#f0e6ff] px-3 py-1 text-[12px] font-semibold text-[#6f2dbd]">
            {jobs.length} open {jobs.length === 1 ? "role" : "roles"}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        {/* ── Job list ─────────────────────────────────────────────────────── */}
        {screen === "list" && (
          <>
            <div className="mb-8">
              <h1 className="text-[32px] font-semibold tracking-[-0.03em] text-[#1f1830]">
                Join the team
              </h1>
              <p className="mt-2 text-[15px] text-[#7d6f93]">
                We're building the future of HR. Find a role that fits your skills and ambitions.
              </p>
            </div>

            {loading && (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-40 animate-pulse rounded-[18px] border border-[#ede7f4] bg-white"
                  />
                ))}
              </div>
            )}

            {!loading && fetchError && (
              <div className="rounded-[16px] border border-red-200 bg-red-50 px-6 py-8 text-center">
                <p className="text-[14px] text-red-700">{fetchError}</p>
              </div>
            )}

            {!loading && !fetchError && jobs.length === 0 && (
              <div className="rounded-[16px] border border-[#ede7f4] bg-white px-6 py-16 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#f6f1fc] text-[#9c90af]">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="2" y="7" width="20" height="14" rx="2" />
                    <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
                  </svg>
                </div>
                <p className="text-[15px] font-medium text-[#4a3c60]">No open roles right now</p>
                <p className="mt-1 text-[13px] text-[#9c90af]">Check back soon — we're growing fast.</p>
              </div>
            )}

            {!loading && !fetchError && jobs.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                {jobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onOpen={() => { setSelectedJob(job); setScreen("detail"); }}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Job detail + apply form ───────────────────────────────────────── */}
        {screen === "detail" && selectedJob && (
          <>
            {/* Back */}
            <button
              type="button"
              onClick={() => setScreen("list")}
              className="mb-6 flex items-center gap-2 text-[13px] font-medium text-[#7d6f93] hover:text-[#6f2dbd] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M10 12L6 8l4-4" />
              </svg>
              All openings
            </button>

            <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
              {/* Left — Job details */}
              <div className="space-y-6">
                <div className="rounded-[20px] border border-[#ede7f4] bg-white p-7 shadow-[0_4px_18px_rgba(111,81,154,0.05)]">
                  {/* Job header */}
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h1 className="text-[26px] font-semibold tracking-[-0.025em] text-[#1f1830]">
                        {selectedJob.title}
                      </h1>
                      <p className="mt-1 text-[14px] text-[#9c90af]">{selectedJob.job_profile}</p>
                    </div>
                    <span className="mt-1 shrink-0 rounded-full bg-[#edfaf1] px-3 py-1 text-[12px] font-semibold text-[#3aac5d]">
                      Hiring
                    </span>
                  </div>

                  {/* Meta chips */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedJob.location && (
                      <Chip label={`📍 ${selectedJob.location}`} variant="meta" />
                    )}
                    <Chip
                      label={`⏱ ${expLabel(selectedJob.min_experience, selectedJob.max_experience)}`}
                      variant="meta"
                    />
                    <Chip label={timeAgo(selectedJob.created_at)} variant="meta" />
                  </div>

                  {/* Description */}
                  {selectedJob.description && (
                    <div className="mt-6">
                      <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-[#b0a2c2]">
                        About this role
                      </h2>
                      <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[#4a3c60]">
                        {selectedJob.description}
                      </p>
                    </div>
                  )}

                  {/* Required skills */}
                  {selectedJob.required_skills.length > 0 && (
                    <div className="mt-6">
                      <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-[#b0a2c2]">
                        Required skills
                      </h2>
                      <div className="flex flex-wrap gap-2">
                        {selectedJob.required_skills.map((s) => (
                          <Chip key={s} label={s} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Optional skills */}
                  {selectedJob.optional_skills.length > 0 && (
                    <div className="mt-5">
                      <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-[#b0a2c2]">
                        Good to have
                      </h2>
                      <div className="flex flex-wrap gap-2">
                        {selectedJob.optional_skills.map((s) => (
                          <Chip key={s} label={s} variant="optional" />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right — Apply form */}
              <div className="lg:sticky lg:top-[72px] lg:h-fit">
                <div className="rounded-[20px] border border-[#ede7f4] bg-white p-6 shadow-[0_4px_18px_rgba(111,81,154,0.05)]">
                  <h2 className="mb-1 text-[17px] font-semibold text-[#1f1830]">Apply now</h2>
                  <p className="mb-5 text-[13px] text-[#9c90af]">
                    Upload your resume and we'll be in touch.
                  </p>
                  <ApplyForm job={selectedJob} onSuccess={() => setScreen("done")} />
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}