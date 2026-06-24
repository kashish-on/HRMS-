import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { request, toggleJobStatus } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { useATS } from '../../context/ATSContext';
import type { ParseRecord } from '../../types';
import { getScoreBg } from '../../lib/utils';

// ── Portal upload helpers ─────────────────────────────────────────────────────

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api').replace(/\/$/, '');

interface PortalUpload {
  id: string;
  original_file_name: string;
  applicant_name: string | null;
  applicant_email: string | null;
  file_url: string | null;
  parse_status: 'pending' | 'processing' | 'parsed' | 'failed';
  created_at: string;
  job_id: string;
}

interface JobOption {
  id: string;
  title: string;
  job_profile: string;
}

const statStyles = [
  {
    label: 'Total Resumes',
    keyLabel: 'TOTAL RESUMES',
    iconBg: 'bg-[#fff1f1]',
    iconColor: 'text-[#ff7a7a]',
    icon: (
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <rect x="3" y="2.5" width="10" height="11" rx="1.8" />
        <path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3.2" />
      </svg>
    ),
  },
  {
    label: 'High Match Resumes',
    keyLabel: 'HIGH MATCH RESUMES',
    iconBg: 'bg-[#fff5e6]',
    iconColor: 'text-[#f4b340]',
    icon: (
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M4.2 11.8L11.8 4.2" />
        <path d="M6 4.4H11.6V10" />
        <path d="M4 8.5V12h3.5" />
      </svg>
    ),
  },
  {
    label: 'Average Match Score',
    keyLabel: 'AVERAGE MATCH SCORE',
    iconBg: 'bg-[#edfdf0]',
    iconColor: 'text-[#63d78a]',
    icon: (
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M4 12.5V6.5" />
        <path d="M8 12.5V3.5" />
        <path d="M12 12.5V8.5" />
      </svg>
    ),
  },
  {
    label: 'Shortlisted Candidate',
    keyLabel: 'SHORTLISTED CANDIDATE',
    iconBg: 'bg-[#fff0f5]',
    iconColor: 'text-[#ff8699]',
    icon: (
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M4 5h8" />
        <path d="M4 8h8" />
        <path d="M4 11h5" />
      </svg>
    ),
  },
  {
    label: 'In Interview Stage',
    keyLabel: 'IN INTERVIEW STAGE',
    iconBg: 'bg-[#fff6e8]',
    iconColor: 'text-[#f1b347]',
    icon: (
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <rect x="3" y="3" width="10" height="10" rx="2" />
        <path d="M5.5 6h5" />
        <path d="M5.5 8.5h5" />
        <path d="M5.5 11h3.2" />
      </svg>
    ),
  },
  {
    label: 'Rejected Candidates',
    keyLabel: 'REJECTED CANDIDATES',
    iconBg: 'bg-[#effff1]',
    iconColor: 'text-[#67d978]',
    icon: (
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <circle cx="6" cy="6" r="2.3" />
        <path d="M2.8 12a3.7 3.7 0 016.4 0" />
        <path d="M10.7 5.3l2.5 2.5" />
        <path d="M13.2 5.3l-2.5 2.5" />
      </svg>
    ),
  },
];

export default function DashboardScreen() {
  const {
    records,
    recordsLoading,
    setCurrentRecord,
    navigate,
    startParsing,
    isParsing,
    updateRecordLocally,
  } = useATS();

  // ── Parse-resumes tab state ───────────────────────────────────────────────
  const [role, setRole] = useState('');
  const [exp, setExp] = useState('');
  const [location, setLocation] = useState('');
  const [skills, setSkills] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ── Upload-from-portal tab state ─────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'parse' | 'portal'>('parse');
  const [togglingJobId, setTogglingJobId] = useState<string | null>(null);

  const handleToggleJobStatus = async (e: React.MouseEvent, record: ParseRecord) => {
    e.stopPropagation();
    const newIsOpen = !(record.isOpen !== false);
    setTogglingJobId(record.id);
    try {
      await toggleJobStatus(record.id, newIsOpen);
      // Optimistically update just this record in context — no reload needed
      updateRecordLocally(record.id, { isOpen: newIsOpen });
    } catch (err) {
      console.error('Toggle job status failed:', err);
    } finally {
      setTogglingJobId(null);
    }
  };
  const [portalJobs, setPortalJobs] = useState<JobOption[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [portalUploads, setPortalUploads] = useState<PortalUpload[]>([]);
  const [portalLoading, setPortalLoading] = useState(false);
  const [parsingIds, setParsingIds] = useState<Set<string>>(new Set());
  const [portalError, setPortalError] = useState<string | null>(null);
  const [portalSuccess, setPortalSuccess] = useState<string | null>(null);

  // ── Create Job modal state ────────────────────────────────────────────────
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [newJobTitle, setNewJobTitle] = useState('');
  const [newJobProfile, setNewJobProfile] = useState('');
  const [newJobLocation, setNewJobLocation] = useState('');
  const [newJobMinExp, setNewJobMinExp] = useState('');
  const [newJobMaxExp, setNewJobMaxExp] = useState('');
  const [newJobDescription, setNewJobDescription] = useState('');
  const [newJobReqSkills, setNewJobReqSkills] = useState('');
  const [newJobOptSkills, setNewJobOptSkills] = useState('');
  const [creatingJob, setCreatingJob] = useState(false);
  const [createJobError, setCreateJobError] = useState<string | null>(null);

  const resetCreateJobForm = () => {
    setNewJobTitle(''); setNewJobProfile(''); setNewJobLocation('');
    setNewJobMinExp(''); setNewJobMaxExp(''); setNewJobDescription('');
    setNewJobReqSkills(''); setNewJobOptSkills(''); setCreateJobError(null);
  };

  const handleCreateJob = async () => {
    if (!newJobTitle.trim()) { setCreateJobError('Job title is required.'); return; }
    if (!newJobProfile.trim()) { setCreateJobError('Job profile is required.'); return; }
    setCreatingJob(true);
    setCreateJobError(null);
    try {
      const data = await request<{ status: string; message: string; job: { id: string; title: string; job_profile: string } }>(
        '/jobs',
        {
          method: 'POST',
          body: JSON.stringify({
            title: newJobTitle.trim(),
            job_profile: newJobProfile.trim(),
            location: newJobLocation.trim() || null,
            min_experience: Number(newJobMinExp) || 0,
            max_experience: newJobMaxExp ? Number(newJobMaxExp) : null,
            description: newJobDescription.trim() || null,
            required_skills: newJobReqSkills.split(',').map((s) => s.trim()).filter(Boolean),
            optional_skills: newJobOptSkills.split(',').map((s) => s.trim()).filter(Boolean),
          }),
        }
      );

      const created = { id: data.job.id, title: data.job.title, job_profile: data.job.job_profile };
      setPortalJobs((prev) => [created, ...prev]);
      setSelectedJobId(data.job.id);
      setPortalSuccess(`Job "${data.job.title}" created and selected.`);
      setShowCreateJob(false);
      resetCreateJobForm();
    } catch (err: unknown) {
      setCreateJobError(err instanceof Error ? err.message : 'Failed to create job.');
    } finally {
      setCreatingJob(false);
    }
  };

  // Fetch jobs once for the job selector
  useEffect(() => {
    let mounted = true;

    const loadJobs = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          return;
        }

        const data = await request<{ jobs?: JobOption[] }>('/jobs');
        if (!mounted) return;
        setPortalJobs((data.jobs || []).map((j) => ({ id: j.id, title: j.title, job_profile: j.job_profile })));
      } catch (error) {
        console.error('Failed to load portal jobs', error);
      }
    };

    loadJobs();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        loadJobs();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Fetch portal uploads whenever selected job changes
  const fetchPortalUploads = useCallback(async (jobId: string) => {
    if (!jobId) { setPortalUploads([]); return; }
    setPortalLoading(true);
    setPortalError(null);
    try {
      const data = await request<{ resumes?: PortalUpload[] }>(`/resumes?job_id=${jobId}&source=portal`);
      // Filter to portal-sourced uploads only (backend may return all for the job)
      const filtered = (data.resumes || []).filter(
        (u: PortalUpload & { source?: string }) => u.source === 'portal' || !u.source
      );
      setPortalUploads(filtered);
    } catch (err: unknown) {
      setPortalError(err instanceof Error ? err.message : 'Could not load portal uploads.');
    } finally {
      setPortalLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'portal' && selectedJobId) {
      fetchPortalUploads(selectedJobId);
    }
  }, [activeTab, selectedJobId, fetchPortalUploads]);

  // Parse a single portal upload through the existing parse pipeline
  const handleParsePortalUpload = async (uploadId: string) => {
    setParsingIds((prev) => new Set(prev).add(uploadId));
    setPortalError(null);
    setPortalSuccess(null);
    try {
      const data = await request<{ parsedPreview?: { fullName?: string } }>(`/resumes/parse/${uploadId}`, { method: 'POST' });
      setPortalSuccess(`Parsed successfully: ${data.parsedPreview?.fullName || 'Resume'}`);
      // Refresh the list
      await fetchPortalUploads(selectedJobId);
    } catch (err: unknown) {
      setPortalError(err instanceof Error ? err.message : 'Parse failed.');
    } finally {
      setParsingIds((prev) => {
        const next = new Set(prev);
        next.delete(uploadId);
        return next;
      });
    }
  };

  // Parse ALL pending portal uploads for the selected job
  const handleParseAllPortalUploads = async () => {
    const pending = portalUploads.filter((u) => u.parse_status === 'pending');
    if (!pending.length) return;
    setPortalError(null);
    setPortalSuccess(null);
    for (const upload of pending) {
      await handleParsePortalUpload(upload.id);
    }
    setPortalSuccess(`Parsed ${pending.length} resume${pending.length > 1 ? 's' : ''} from portal.`);
  };

  const totalResumes = records.reduce((sum, record) => sum + record.totalResumes, 0);
  const totalHigh = records.reduce((sum, record) => sum + record.highMatch, 0);
  const avgScore = records.length
    ? Math.round(records.reduce((sum, record) => sum + record.avgScore, 0) / records.length)
    : 0;
  const shortlistedCount = Math.max(totalHigh, records.reduce((sum, record) => sum + Math.round(record.highMatch * 0.6), 0));
  const interviewCount = records.reduce((sum, record) => sum + (record.status === 'Processing' ? 1 : 0), 0) + Math.max(0, Math.round(totalHigh * 0.15));
  const rejectedCount = Math.max(0, totalResumes - totalHigh - shortlistedCount + interviewCount);

  const stats = [
    { value: totalResumes, suffix: '', ...statStyles[0] },
    { value: totalHigh, suffix: '', ...statStyles[1] },
    { value: avgScore, suffix: '', ...statStyles[2] },
    { value: shortlistedCount, suffix: '', ...statStyles[3] },
    { value: interviewCount, suffix: '', ...statStyles[4] },
    { value: rejectedCount, suffix: '', ...statStyles[5] },
  ];

  function handleOpenRecord(record: ParseRecord) {
    setCurrentRecord(record);
    navigate('results');
  }

  async function handleStartParsing() {
    await startParsing({
      role,
      exp,
      location,
      skills,
      files,
    });
  }

  function handleFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    setFiles(Array.from(event.target.files || []));
  }

  return (
    <div className="px-4 py-4">
      <div className="rounded-[20px] border border-[#ede7f4] bg-white shadow-[0_10px_28px_rgba(91,59,132,0.05)]">
        <div className="border-b border-[#f0ebf6] px-8 py-5">
          <h1 className="text-[30px] font-semibold tracking-[-0.03em] text-[#1f1830]">Overview Dashboard</h1>
        </div>

        <div className="space-y-5 p-6">
          <div className="grid grid-cols-6 gap-4">
            {stats.map((stat) => (
              <div
                key={stat.keyLabel}
                className="rounded-[14px] border border-[#ece6f4] bg-white px-4 py-4 shadow-[0_3px_12px_rgba(111,81,154,0.06)]"
              >
                <div className={`flex h-8 w-8 items-center justify-center rounded-md ${stat.iconBg} ${stat.iconColor}`}>
                  {stat.icon}
                </div>
                <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b0a2c2]">
                  {stat.keyLabel}
                </div>
                <div className="mt-2 text-[42px] font-semibold leading-none text-[#6f2dbd]">
                  {stat.value}
                  {stat.suffix || ''}
                </div>
              </div>
            ))}
          </div>

          <section className="rounded-[16px] border border-[#ece6f4] bg-white px-6 py-5 shadow-[0_4px_18px_rgba(111,81,154,0.05)]">
            {/* ── Tab bar ──────────────────────────────────────────────────── */}
            <div className="mb-5 flex items-center gap-1 border-b border-[#f0ebf6] pb-0">
              <button
                type="button"
                onClick={() => setActiveTab('parse')}
                className={`flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-[13px] font-semibold transition-colors ${ activeTab === 'parse' ? 'border-[#6f2dbd] text-[#6f2dbd]' : 'border-transparent text-[#9c90af] hover:text-[#5c22a4]' }`}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 13V7l5-5 5 5v6M6 13v-4h4v4" />
                </svg>
                Parse Resumes
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('portal')}
                className={`flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-[13px] font-semibold transition-colors ${ activeTab === 'portal' ? 'border-[#6f2dbd] text-[#6f2dbd]' : 'border-transparent text-[#9c90af] hover:text-[#5c22a4]' }`}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="8" cy="6" r="3" />
                  <path d="M2 14c0-3 2.7-4.5 6-4.5s6 1.5 6 4.5" />
                </svg>
                Portal Applications
                {portalUploads.filter(u => u.parse_status === 'pending').length > 0 && (
                  <span className="ml-1 rounded-full bg-[#f0e6ff] px-1.5 py-0.5 text-[10px] font-bold text-[#6f2dbd]">
                    {portalUploads.filter(u => u.parse_status === 'pending').length}
                  </span>
                )}
              </button>
            </div>

            {/* ══ Tab: Parse Resumes ══════════════════════════════════════════ */}
            {activeTab === 'parse' && (
            <>
              <div className="mb-4 flex items-center gap-2.5 text-[18px] font-semibold text-[#2f124f]">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#f4eefe] text-[#6f2dbd]">
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                    <path d="M3 13V7l5-5 5 5v6M6 13v-4h4v4" />
                  </svg>
                </span>
                Parse Resumes
              </div>

            <div className="mb-5 flex flex-wrap gap-3">
              <input
                className="h-11 w-[180px] rounded-md border border-[#e5deef] bg-[#fbfafe] px-3.5 text-[13px] text-[#4a3c60] outline-none placeholder:text-[#b4a8c3] focus:border-[#b48de2]"
                placeholder="Enter Job Role"
                value={role}
                onChange={(event) => setRole(event.target.value)}
              />
              <div className="relative">
                <select
                  className="h-11 w-[170px] rounded-md border border-[#e5deef] bg-[#fbfafe] px-3.5 pr-8 appearance-none text-[13px] text-[#6f627f] outline-none focus:border-[#b48de2]"
                  value={exp}
                  onChange={(event) => setExp(event.target.value)}
                >
                <option value="">Select Experience</option>
                <option>1+ years</option>
                <option>3+ years</option>
                <option>5+ years</option>
                <option>7+ years</option>
                </select>
                <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#6f627f]" width="10" height="6" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <input
                className="h-11 w-[155px] rounded-md border border-[#e5deef] bg-[#fbfafe] px-3.5 text-[13px] text-[#4a3c60] outline-none placeholder:text-[#b4a8c3] focus:border-[#b48de2]"
                placeholder="Enter Location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
              <input
                className="h-11 w-[150px] rounded-md border border-[#e5deef] bg-[#fbfafe] px-3.5 text-[13px] text-[#4a3c60] outline-none placeholder:text-[#b4a8c3] focus:border-[#b48de2]"
                placeholder="Enter Skills"
                value={skills}
                onChange={(event) => setSkills(event.target.value)}
              />
            </div>

            <div className="mb-3 text-[14px] font-medium text-[#84798f]">Upload Resume</div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={handleFilesSelected}
            />

            <div className="rounded-[16px] border border-dashed border-[#e8e2f1] bg-white px-6 py-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-[#8f869d]">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M7 18a4 4 0 01-.4-7.98A5.5 5.5 0 0117 8.5c0 .17-.01.34-.03.5A3.5 3.5 0 0117.5 16H15" />
                  <path d="M12 12v7" />
                  <path d="M9.5 14.5L12 12l2.5 2.5" />
                </svg>
              </div>
              <div className="mt-3 text-[16px] text-[#7c708c]">
                Drag or drop Resumes here, or{' '}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="font-semibold text-[#6f2dbd] hover:underline"
                >
                  browse files
                </button>
              </div>
              <div className="mt-2 text-[11px] uppercase tracking-[0.08em] text-[#c1b6cf]">PDF, max 2MB</div>
              {files.length > 0 && (
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {files.map((file) => (
                    <span
                      key={`${file.name}-${file.size}`}
                      className="inline-flex items-center rounded-full bg-[#f0e4ff] px-3.5 py-1.5 text-[13px] font-medium text-[#6f2dbd]"
                    >
                      {file.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-center">
              <button
                onClick={() => void handleStartParsing()}
                disabled={isParsing}
                className={`rounded-[6px] px-6 py-2.5 text-[11px] font-semibold text-white ${
                  isParsing ? 'bg-[#bba5d8]' : 'bg-[#5f179f] hover:bg-[#511089]'
                }`}
              >
                {isParsing ? 'Parsing...' : 'Start Parsing'}
              </button>
            </div>
            </>
            )}

            {/* ══ Tab: Portal Applications ════════════════════════════════════ */}
            {activeTab === 'portal' && (
              <div className="space-y-4">
                {/* Header row */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-[15px] font-semibold text-[#2f124f]">Portal Applications</h3>
                    <p className="text-[12px] text-[#9c90af]">
                      Resumes submitted by candidates via the public careers portal. Select a job to view and parse them.
                    </p>
                  </div>
                  {portalUploads.filter(u => u.parse_status === 'pending').length > 0 && (
                    <button
                      type="button"
                      onClick={() => void handleParseAllPortalUploads()}
                      className="rounded-lg bg-[#6f2dbd] px-4 py-2 text-[12px] font-semibold text-white shadow-[0_2px_10px_rgba(111,45,189,0.25)] hover:bg-[#5c22a4]"
                    >
                      Parse all pending ({portalUploads.filter(u => u.parse_status === 'pending').length})
                    </button>
                  )}
                </div>

                {/* Job selector + Create Job */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 max-w-sm">
                    <select
                      value={selectedJobId}
                      onChange={(e) => setSelectedJobId(e.target.value)}
                      className="h-10 w-full rounded-lg border border-[#e5deef] bg-[#fbfafe] px-3.5 pr-8 appearance-none text-[13px] text-[#4a3c60] outline-none focus:border-[#b48de2]"
                    >
                    <option value=""> Select a job to view applications </option>
                    {portalJobs.map((j) => (
                      <option key={j.id} value={j.id}>{j.title} ({j.job_profile})</option>
                    ))}
                    </select>
                    <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#6f627f]" width="10" height="6" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setShowCreateJob(true); setCreateJobError(null); }}
                    className="flex h-10 items-center gap-1.5 rounded-lg border border-[#dcd2ec] bg-white px-3.5 text-[12px] font-semibold text-[#6f2dbd] hover:bg-[#f8f3ff] whitespace-nowrap"
                  >
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M8 3v10M3 8h10"/>
                    </svg>
                    New Job
                  </button>
                </div>

                {/* ── Create Job modal ─────────────────────────────────────── */}
                {showCreateJob && (
                  <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 px-4">
                    <div className="w-full max-w-lg rounded-[20px] border border-[#ede7f4] bg-white shadow-[0_20px_60px_rgba(111,45,189,0.18)]">
                      {/* Modal header */}
                      <div className="flex items-center justify-between border-b border-[#f0ebf6] px-6 py-4">
                        <div>
                          <h2 className="text-[16px] font-semibold text-[#1f1830]">Create new job</h2>
                          <p className="text-[12px] text-[#9c90af]">Will appear on the careers portal immediately</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setShowCreateJob(false); resetCreateJobForm(); }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#9c90af] hover:bg-[#f6f1fc] hover:text-[#6f2dbd]"
                        >
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 3l10 10M13 3L3 13"/>
                          </svg>
                        </button>
                      </div>

                      {/* Modal body */}
                      <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-4">
                        {/* Title + Profile */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1.5 block text-[12px] font-medium text-[#4a3c60]">
                              Job Title <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. UI/UX Designer"
                              value={newJobTitle}
                              onChange={e => setNewJobTitle(e.target.value)}
                              className="h-9 w-full rounded-lg border border-[#e5deef] bg-[#fbfafe] px-3 text-[13px] text-[#1f1830] outline-none placeholder:text-[#c1b6cf] focus:border-[#b48de2]"
                            />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-[12px] font-medium text-[#4a3c60]">
                              Job Profile <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Product Design"
                              value={newJobProfile}
                              onChange={e => setNewJobProfile(e.target.value)}
                              className="h-9 w-full rounded-lg border border-[#e5deef] bg-[#fbfafe] px-3 text-[13px] text-[#1f1830] outline-none placeholder:text-[#c1b6cf] focus:border-[#b48de2]"
                            />
                          </div>
                        </div>

                        {/* Location + Experience */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="col-span-1">
                            <label className="mb-1.5 block text-[12px] font-medium text-[#4a3c60]">Location</label>
                            <input
                              type="text"
                              placeholder="e.g. Noida, India"
                              value={newJobLocation}
                              onChange={e => setNewJobLocation(e.target.value)}
                              className="h-9 w-full rounded-lg border border-[#e5deef] bg-[#fbfafe] px-3 text-[13px] text-[#1f1830] outline-none placeholder:text-[#c1b6cf] focus:border-[#b48de2]"
                            />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-[12px] font-medium text-[#4a3c60]">Min Exp (yrs)</label>
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={newJobMinExp}
                              onChange={e => setNewJobMinExp(e.target.value)}
                              className="h-9 w-full rounded-lg border border-[#e5deef] bg-[#fbfafe] px-3 text-[13px] text-[#1f1830] outline-none focus:border-[#b48de2]"
                            />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-[12px] font-medium text-[#4a3c60]">Max Exp (yrs)</label>
                            <input
                              type="number"
                              min="0"
                              placeholder="No limit"
                              value={newJobMaxExp}
                              onChange={e => setNewJobMaxExp(e.target.value)}
                              className="h-9 w-full rounded-lg border border-[#e5deef] bg-[#fbfafe] px-3 text-[13px] text-[#1f1830] outline-none focus:border-[#b48de2]"
                            />
                          </div>
                        </div>

                        {/* Description */}
                        <div>
                          <label className="mb-1.5 block text-[12px] font-medium text-[#4a3c60]">Description</label>
                          <textarea
                            rows={3}
                            placeholder="Describe the role, responsibilities, and what you're looking for..."
                            value={newJobDescription}
                            onChange={e => setNewJobDescription(e.target.value)}
                            className="w-full rounded-lg border border-[#e5deef] bg-[#fbfafe] px-3 py-2.5 text-[13px] text-[#1f1830] outline-none placeholder:text-[#c1b6cf] focus:border-[#b48de2] resize-none"
                          />
                        </div>

                        {/* Required skills */}
                        <div>
                          <label className="mb-1.5 block text-[12px] font-medium text-[#4a3c60]">
                            Required Skills
                            <span className="ml-1.5 font-normal text-[#a89ec0]">comma-separated</span>
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. React, TypeScript, Figma"
                            value={newJobReqSkills}
                            onChange={e => setNewJobReqSkills(e.target.value)}
                            className="h-9 w-full rounded-lg border border-[#e5deef] bg-[#fbfafe] px-3 text-[13px] text-[#1f1830] outline-none placeholder:text-[#c1b6cf] focus:border-[#b48de2]"
                          />
                          {/* Live skill chips preview */}
                          {newJobReqSkills.trim() && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {newJobReqSkills.split(',').map(s => s.trim()).filter(Boolean).map((s, i) => (
                                <span key={i} className="rounded-full bg-[#f0e6ff] px-2.5 py-0.5 text-[11px] font-medium text-[#6f2dbd]">{s}</span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Optional skills */}
                        <div>
                          <label className="mb-1.5 block text-[12px] font-medium text-[#4a3c60]">
                            Good to Have
                            <span className="ml-1.5 font-normal text-[#a89ec0]">comma-separated</span>
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Framer, Motion Design"
                            value={newJobOptSkills}
                            onChange={e => setNewJobOptSkills(e.target.value)}
                            className="h-9 w-full rounded-lg border border-[#e5deef] bg-[#fbfafe] px-3 text-[13px] text-[#1f1830] outline-none placeholder:text-[#c1b6cf] focus:border-[#b48de2]"
                          />
                          {newJobOptSkills.trim() && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {newJobOptSkills.split(',').map(s => s.trim()).filter(Boolean).map((s, i) => (
                                <span key={i} className="rounded-full bg-[#f0f4ff] px-2.5 py-0.5 text-[11px] font-medium text-[#4060c8]">{s}</span>
                              ))}
                            </div>
                          )}
                        </div>

                        {createJobError && (
                          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700">
                            {createJobError}
                          </div>
                        )}
                      </div>

                      {/* Modal footer */}
                      <div className="flex items-center justify-end gap-2.5 border-t border-[#f0ebf6] px-6 py-4">
                        <button
                          type="button"
                          onClick={() => { setShowCreateJob(false); resetCreateJobForm(); }}
                          className="h-9 rounded-lg border border-[#e5deef] px-4 text-[12px] font-medium text-[#7d6f93] hover:bg-[#f8f3ff]"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleCreateJob()}
                          disabled={creatingJob}
                          className="h-9 rounded-lg bg-[#6f2dbd] px-5 text-[12px] font-semibold text-white hover:bg-[#5c22a4] disabled:opacity-60"
                        >
                          {creatingJob ? 'Creating…' : 'Create Job'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Feedback banners */}
                {portalError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
                    {portalError}
                  </div>
                )}
                {portalSuccess && (
                  <div className="rounded-lg border border-[#c0f0cf] bg-[#edfaf3] px-4 py-3 text-[13px] text-[#2d7a4f]">
                    {portalSuccess}
                  </div>
                )}

                {/* Table */}
                {selectedJobId && (
                  portalLoading ? (
                    <div className="rounded-[10px] border border-[#f0ebf6] py-10 text-center text-[12px] text-[#9c90af]">
                      Loading portal applications…
                    </div>
                  ) : portalUploads.length === 0 ? (
                    <div className="rounded-[14px] border border-dashed border-[#e8e2f1] bg-[#fbfafe] px-6 py-12 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#f6f1fc] text-[#9c90af]">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <circle cx="8" cy="6" r="3" />
                          <path d="M2 20c0-4 2.7-6 6-6s6 2 6 6" />
                          <path d="M20 8v8M16 12h8" />
                        </svg>
                      </div>
                      <p className="text-[14px] font-medium text-[#4a3c60]">No portal applications yet</p>
                      <p className="mt-1 text-[12px] text-[#a89ec0]">
                        Share the careers portal link so candidates can apply.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-[10px] border border-[#f0ebf6]">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-[#fbfafe]">
                            {['APPLICANT', 'EMAIL', 'FILE', 'RECEIVED', 'STATUS', 'ACTION'].map((h) => (
                              <th key={h} className="whitespace-nowrap border-b border-[#f0ebf6] px-4 py-3 text-left text-[11px] font-semibold tracking-[0.08em] text-[#8e819f]">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {portalUploads.map((u) => (
                            <tr key={u.id} className="border-b border-[#f4eff8] text-[13px] text-[#34284a]">
                              <td className="px-4 py-3 font-medium">{u.applicant_name || '—'}</td>
                              <td className="px-4 py-3 text-[#7d6f93]">{u.applicant_email || '—'}</td>
                              <td className="max-w-[180px] truncate px-4 py-3 text-[#7d6f93]">
                                {u.file_url ? (
                                  <a href={u.file_url} target="_blank" rel="noopener noreferrer" className="text-[#6f2dbd] hover:underline">
                                    {u.original_file_name}
                                  </a>
                                ) : (
                                  u.original_file_name
                                )}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-[#9c90af]">
                                {new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                  u.parse_status === 'parsed'      ? 'bg-[#ddffe6] text-[#3bbd67]'  :
                                  u.parse_status === 'processing'  ? 'bg-[#fff4d9] text-[#d68d0f]'  :
                                  u.parse_status === 'failed'      ? 'bg-red-100 text-red-700'       :
                                                                     'bg-[#f4f0f9] text-[#9c90af]'
                                }`}>
                                  {u.parse_status.charAt(0).toUpperCase() + u.parse_status.slice(1)}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {u.parse_status === 'pending' || u.parse_status === 'failed' ? (
                                  <button
                                    type="button"
                                    disabled={parsingIds.has(u.id)}
                                    onClick={() => void handleParsePortalUpload(u.id)}
                                    className="rounded-md bg-[#f0e6ff] px-3 py-1.5 text-[11px] font-semibold text-[#6f2dbd] hover:bg-[#e6d9f7] disabled:opacity-50"
                                  >
                                    {parsingIds.has(u.id) ? 'Parsing…' : 'Parse'}
                                  </button>
                                ) : u.parse_status === 'parsed' ? (
                                  <span className="text-[11px] text-[#9c90af]">Done</span>
                                ) : (
                                  <span className="text-[11px] text-[#f4b340]">In progress</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                )}
              </div>
            )}
          </section>

          <section className="rounded-[16px] border border-[#ece6f4] bg-white px-6 py-5 shadow-[0_4px_18px_rgba(111,81,154,0.05)]">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-[18px] font-semibold text-[#2f124f]">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#f4eefe] text-[#6f2dbd]">
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                    <path d="M4 3.5h8" />
                    <path d="M4 6.5h8" />
                    <path d="M4 9.5h5.5" />
                    <path d="M3 2.5h10v11H3z" />
                  </svg>
                </span>
                Recent Records
              </div>

              <div className="flex items-center gap-2">
                <button className="rounded-[6px] bg-[#5f179f] px-4 py-2 text-[11px] font-semibold text-white hover:bg-[#511089]">
                  Export CSV
                </button>
              </div>
            </div>

            {recordsLoading ? (
              <div className="rounded-[10px] border border-[#f0ebf6] bg-[#fcfbfe] px-4 py-10 text-center text-[12px] text-[#8f829f]">
                Loading records from backend...
              </div>
            ) : (
              <div className="overflow-hidden rounded-[10px] border border-[#f0ebf6]">
                <table className="w-full border-collapse">
                  <thead>
                  <tr className="bg-[#fbfafe]">
                    {['UPLOAD DATE', 'JOB ROLE', 'TOTAL RESUMES', 'HIGH MATCH', 'AVG MATCH SCORE', 'STATUS', 'HIRING', 'ACTIONS'].map((heading) => (
                      <th
                        key={heading}
                        className="whitespace-nowrap border-b border-[#f0ebf6] px-4 py-3 text-left text-[11px] font-semibold tracking-[0.08em] text-[#8e819f]"
                      >
                        {heading}
                      </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => (
                    <tr
                      key={record.id}
                      onClick={() => handleOpenRecord(record)}
                      className="cursor-pointer border-b border-[#f4eff8] text-[13px] text-[#34284a] transition-colors hover:bg-[#fcfbff]"
                    >
                      <td className="px-4 py-2.5">{record.uploadDate}</td>
                      <td className="px-4 py-2.5 font-semibold uppercase tracking-[0.04em]">{record.role}</td>
                      <td className="px-4 py-2.5">{record.totalResumes}</td>
                      <td className="px-4 py-2.5">{record.highMatch}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex min-w-[42px] items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${getScoreBg(record.avgScore)}`}>
                          {record.avgScore}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${
                            record.status === 'Failed'
                              ? 'bg-red-100 text-red-700'
                              : record.status === 'Processing'
                                ? 'bg-[#fff4d9] text-[#d68d0f]'
                                : 'bg-[#ddffe6] text-[#3bbd67]'
                            }`}
                          >
                            {record.status}
                          </span>
                      </td>
                      {/* Hiring open/closed status + toggle */}
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          disabled={togglingJobId === record.id}
                          onClick={(e) => void handleToggleJobStatus(e, record)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                            record.isOpen !== false
                              ? 'bg-[#edfaf1] text-[#3aac5d] hover:bg-[#d6f5e2]'
                              : 'bg-[#fff1f1] text-[#de556c] hover:bg-[#ffedf1]'
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${record.isOpen !== false ? 'bg-[#3aac5d]' : 'bg-[#de556c]'}`} />
                          {togglingJobId === record.id
                            ? 'Updating…'
                            : record.isOpen !== false ? 'Open' : 'Closed'}
                        </button>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-4 text-[#1f132d]">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              handleOpenRecord(record);
                            }}
                            className="hover:text-[#6f2dbd]"
                          >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M1.5 8s2.4-4 6.5-4 6.5 4 6.5 4-2.4 4-6.5 4-6.5-4-6.5-4z" />
                              <circle cx="8" cy="8" r="1.8" />
                            </svg>
                          </button>
                          <button className="hover:text-[#6f2dbd]">
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M3 11.8l.4-2.4L10.9 2l2.1 2.1-7.4 7.4-2.6.3z" />
                              <path d="M9.8 3.1l2.1 2.1" />
                            </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {records.length === 0 && (
                  <div className="px-4 py-10 text-center text-[14px] text-[#8f829f]">
                    No parse runs yet. Start with a role and a few resumes.
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}


// import { useCallback, useEffect, useRef, useState } from 'react';
// import type { ChangeEvent } from 'react';
// import { toggleJobStatus } from '../../lib/api';
// import { useATS } from '../../context/ATSContext';
// import type { ParseRecord } from '../../types';
// import { getScoreBg } from '../../lib/utils';

// // ── Portal upload helpers ─────────────────────────────────────────────────────

// const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api').replace(/\/$/, '');

// interface PortalUpload {
//   id: string;
//   original_file_name: string;
//   applicant_name: string | null;
//   applicant_email: string | null;
//   file_url: string | null;
//   parse_status: 'pending' | 'processing' | 'parsed' | 'failed';
//   created_at: string;
//   job_id: string;
// }

// interface JobOption {
//   id: string;
//   title: string;
//   job_profile: string;
// }

// const statStyles = [
//   {
//     label: 'Total Resumes',
//     keyLabel: 'TOTAL RESUMES',
//     iconBg: 'bg-[#fff1f1]',
//     iconColor: 'text-[#ff7a7a]',
//     icon: (
//       <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
//         <rect x="3" y="2.5" width="10" height="11" rx="1.8" />
//         <path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3.2" />
//       </svg>
//     ),
//   },
//   {
//     label: 'High Match Resumes',
//     keyLabel: 'HIGH MATCH RESUMES',
//     iconBg: 'bg-[#fff5e6]',
//     iconColor: 'text-[#f4b340]',
//     icon: (
//       <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
//         <path d="M4.2 11.8L11.8 4.2" />
//         <path d="M6 4.4H11.6V10" />
//         <path d="M4 8.5V12h3.5" />
//       </svg>
//     ),
//   },
//   {
//     label: 'Average Match Score',
//     keyLabel: 'AVERAGE MATCH SCORE',
//     iconBg: 'bg-[#edfdf0]',
//     iconColor: 'text-[#63d78a]',
//     icon: (
//       <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
//         <path d="M4 12.5V6.5" />
//         <path d="M8 12.5V3.5" />
//         <path d="M12 12.5V8.5" />
//       </svg>
//     ),
//   },
//   {
//     label: 'Shortlisted Candidate',
//     keyLabel: 'SHORTLISTED CANDIDATE',
//     iconBg: 'bg-[#fff0f5]',
//     iconColor: 'text-[#ff8699]',
//     icon: (
//       <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
//         <path d="M4 5h8" />
//         <path d="M4 8h8" />
//         <path d="M4 11h5" />
//       </svg>
//     ),
//   },
//   {
//     label: 'In Interview Stage',
//     keyLabel: 'IN INTERVIEW STAGE',
//     iconBg: 'bg-[#fff6e8]',
//     iconColor: 'text-[#f1b347]',
//     icon: (
//       <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
//         <rect x="3" y="3" width="10" height="10" rx="2" />
//         <path d="M5.5 6h5" />
//         <path d="M5.5 8.5h5" />
//         <path d="M5.5 11h3.2" />
//       </svg>
//     ),
//   },
//   {
//     label: 'Rejected Candidates',
//     keyLabel: 'REJECTED CANDIDATES',
//     iconBg: 'bg-[#effff1]',
//     iconColor: 'text-[#67d978]',
//     icon: (
//       <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
//         <circle cx="6" cy="6" r="2.3" />
//         <path d="M2.8 12a3.7 3.7 0 016.4 0" />
//         <path d="M10.7 5.3l2.5 2.5" />
//         <path d="M13.2 5.3l-2.5 2.5" />
//       </svg>
//     ),
//   },
// ];

// export default function DashboardScreen() {
//   const {
//     records,
//     recordsLoading,
//     setCurrentRecord,
//     navigate,
//     startParsing,
//     isParsing,
//   } = useATS();

//   // ── Parse-resumes tab state ───────────────────────────────────────────────
//   const [role, setRole] = useState('');
//   const [exp, setExp] = useState('');
//   const [location, setLocation] = useState('');
//   const [skills, setSkills] = useState('');
//   const [files, setFiles] = useState<File[]>([]);
//   const fileInputRef = useRef<HTMLInputElement | null>(null);

//   // ── Upload-from-portal tab state ─────────────────────────────────────────
//   const [activeTab, setActiveTab] = useState<'parse' | 'portal'>('parse');
//   const [togglingJobId, setTogglingJobId] = useState<string | null>(null);

//   const handleToggleJobStatus = async (e: React.MouseEvent, record: ParseRecord) => {
//     e.stopPropagation();
//     const newIsOpen = !(record.isOpen !== false);
//     setTogglingJobId(record.id);
//     try {
//       await toggleJobStatus(record.id, newIsOpen);
//       // Optimistically update records in context via page refresh
//       window.location.reload();
//     } catch (_) { /* silent */ }
//     finally { setTogglingJobId(null); }
//   };
//   const [portalJobs, setPortalJobs] = useState<JobOption[]>([]);
//   const [selectedJobId, setSelectedJobId] = useState<string>('');
//   const [portalUploads, setPortalUploads] = useState<PortalUpload[]>([]);
//   const [portalLoading, setPortalLoading] = useState(false);
//   const [parsingIds, setParsingIds] = useState<Set<string>>(new Set());
//   const [portalError, setPortalError] = useState<string | null>(null);
//   const [portalSuccess, setPortalSuccess] = useState<string | null>(null);

//   // ── Create Job modal state ────────────────────────────────────────────────
//   const [showCreateJob, setShowCreateJob] = useState(false);
//   const [newJobTitle, setNewJobTitle] = useState('');
//   const [newJobProfile, setNewJobProfile] = useState('');
//   const [newJobLocation, setNewJobLocation] = useState('');
//   const [newJobMinExp, setNewJobMinExp] = useState('');
//   const [newJobMaxExp, setNewJobMaxExp] = useState('');
//   const [newJobDescription, setNewJobDescription] = useState('');
//   const [newJobReqSkills, setNewJobReqSkills] = useState('');
//   const [newJobOptSkills, setNewJobOptSkills] = useState('');
//   const [creatingJob, setCreatingJob] = useState(false);
//   const [createJobError, setCreateJobError] = useState<string | null>(null);

//   const resetCreateJobForm = () => {
//     setNewJobTitle(''); setNewJobProfile(''); setNewJobLocation('');
//     setNewJobMinExp(''); setNewJobMaxExp(''); setNewJobDescription('');
//     setNewJobReqSkills(''); setNewJobOptSkills(''); setCreateJobError(null);
//   };

//   const handleCreateJob = async () => {
//     if (!newJobTitle.trim()) { setCreateJobError('Job title is required.'); return; }
//     if (!newJobProfile.trim()) { setCreateJobError('Job profile is required.'); return; }
//     setCreatingJob(true);
//     setCreateJobError(null);
//     try {
//       const res = await fetch(`${API_BASE}/jobs`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           title: newJobTitle.trim(),
//           job_profile: newJobProfile.trim(),
//           location: newJobLocation.trim() || null,
//           min_experience: Number(newJobMinExp) || 0,
//           max_experience: newJobMaxExp ? Number(newJobMaxExp) : null,
//           description: newJobDescription.trim() || null,
//           required_skills: newJobReqSkills.split(',').map(s => s.trim()).filter(Boolean),
//           optional_skills: newJobOptSkills.split(',').map(s => s.trim()).filter(Boolean),
//         }),
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.message || 'Failed to create job.');
//       // Add to local list and auto-select it
//       const created = { id: data.job.id, title: data.job.title, job_profile: data.job.job_profile };
//       setPortalJobs(prev => [created, ...prev]);
//       setSelectedJobId(data.job.id);
//       setPortalSuccess(`Job "${data.job.title}" created and selected.`);
//       setShowCreateJob(false);
//       resetCreateJobForm();
//     } catch (err: unknown) {
//       setCreateJobError(err instanceof Error ? err.message : 'Failed to create job.');
//     } finally {
//       setCreatingJob(false);
//     }
//   };

//   // Fetch jobs once for the job selector
//   useEffect(() => {
//     (async () => {
//       try {
//         const res = await fetch(`${API_BASE}/jobs`);
//         const data = await res.json();
//         setPortalJobs((data.jobs || []).map((j: JobOption) => ({ id: j.id, title: j.title, job_profile: j.job_profile })));
//       } catch (_) { /* silent */ }
//     })();
//   }, []);

//   // Fetch portal uploads whenever selected job changes
//   const fetchPortalUploads = useCallback(async (jobId: string) => {
//     if (!jobId) { setPortalUploads([]); return; }
//     setPortalLoading(true);
//     setPortalError(null);
//     try {
//       const res = await fetch(`${API_BASE}/resumes?job_id=${jobId}&source=portal`);
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.message || 'Failed to load portal uploads.');
//       // Filter to portal-sourced uploads only (backend may return all for the job)
//       const filtered = (data.resumes || []).filter(
//         (u: PortalUpload & { source?: string }) => u.source === 'portal' || !u.source
//       );
//       setPortalUploads(filtered);
//     } catch (err: unknown) {
//       setPortalError(err instanceof Error ? err.message : 'Could not load portal uploads.');
//     } finally {
//       setPortalLoading(false);
//     }
//   }, []);

//   useEffect(() => {
//     if (activeTab === 'portal' && selectedJobId) {
//       fetchPortalUploads(selectedJobId);
//     }
//   }, [activeTab, selectedJobId, fetchPortalUploads]);

//   // Parse a single portal upload through the existing parse pipeline
//   const handleParsePortalUpload = async (uploadId: string) => {
//     setParsingIds((prev) => new Set(prev).add(uploadId));
//     setPortalError(null);
//     setPortalSuccess(null);
//     try {
//       const res = await fetch(`${API_BASE}/resumes/parse/${uploadId}`, { method: 'POST' });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.message || 'Parse failed.');
//       setPortalSuccess(`Parsed successfully: ${data.parsedPreview?.fullName || 'Resume'}`);
//       // Refresh the list
//       await fetchPortalUploads(selectedJobId);
//     } catch (err: unknown) {
//       setPortalError(err instanceof Error ? err.message : 'Parse failed.');
//     } finally {
//       setParsingIds((prev) => {
//         const next = new Set(prev);
//         next.delete(uploadId);
//         return next;
//       });
//     }
//   };

//   // Parse ALL pending portal uploads for the selected job
//   const handleParseAllPortalUploads = async () => {
//     const pending = portalUploads.filter((u) => u.parse_status === 'pending');
//     if (!pending.length) return;
//     setPortalError(null);
//     setPortalSuccess(null);
//     for (const upload of pending) {
//       await handleParsePortalUpload(upload.id);
//     }
//     setPortalSuccess(`Parsed ${pending.length} resume${pending.length > 1 ? 's' : ''} from portal.`);
//   };

//   const totalResumes = records.reduce((sum, record) => sum + record.totalResumes, 0);
//   const totalHigh = records.reduce((sum, record) => sum + record.highMatch, 0);
//   const avgScore = records.length
//     ? Math.round(records.reduce((sum, record) => sum + record.avgScore, 0) / records.length)
//     : 0;
//   const shortlistedCount = Math.max(totalHigh, records.reduce((sum, record) => sum + Math.round(record.highMatch * 0.6), 0));
//   const interviewCount = records.reduce((sum, record) => sum + (record.status === 'Processing' ? 1 : 0), 0) + Math.max(0, Math.round(totalHigh * 0.15));
//   const rejectedCount = Math.max(0, totalResumes - totalHigh - shortlistedCount + interviewCount);

//   const stats = [
//     { value: totalResumes, suffix: '', ...statStyles[0] },
//     { value: totalHigh, suffix: '', ...statStyles[1] },
//     { value: avgScore, suffix: '', ...statStyles[2] },
//     { value: shortlistedCount, suffix: '', ...statStyles[3] },
//     { value: interviewCount, suffix: '', ...statStyles[4] },
//     { value: rejectedCount, suffix: '', ...statStyles[5] },
//   ];

//   function handleOpenRecord(record: ParseRecord) {
//     setCurrentRecord(record);
//     navigate('results');
//   }

//   async function handleStartParsing() {
//     await startParsing({
//       role,
//       exp,
//       location,
//       skills,
//       files,
//     });
//   }

//   function handleFilesSelected(event: ChangeEvent<HTMLInputElement>) {
//     setFiles(Array.from(event.target.files || []));
//   }

//   return (
//     <div className="px-4 py-4">
//       <div className="rounded-[20px] border border-[#ede7f4] bg-white shadow-[0_10px_28px_rgba(91,59,132,0.05)]">
//         <div className="border-b border-[#f0ebf6] px-8 py-5">
//           <h1 className="text-[30px] font-semibold tracking-[-0.03em] text-[#1f1830]">Overview Dashboard</h1>
//         </div>

//         <div className="space-y-5 p-6">
//           <div className="grid grid-cols-6 gap-4">
//             {stats.map((stat) => (
//               <div
//                 key={stat.keyLabel}
//                 className="rounded-[14px] border border-[#ece6f4] bg-white px-4 py-4 shadow-[0_3px_12px_rgba(111,81,154,0.06)]"
//               >
//                 <div className={`flex h-8 w-8 items-center justify-center rounded-md ${stat.iconBg} ${stat.iconColor}`}>
//                   {stat.icon}
//                 </div>
//                 <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b0a2c2]">
//                   {stat.keyLabel}
//                 </div>
//                 <div className="mt-2 text-[42px] font-semibold leading-none text-[#6f2dbd]">
//                   {stat.value}
//                   {stat.suffix || ''}
//                 </div>
//               </div>
//             ))}
//           </div>

//           <section className="rounded-[16px] border border-[#ece6f4] bg-white px-6 py-5 shadow-[0_4px_18px_rgba(111,81,154,0.05)]">
//             {/* ── Tab bar ──────────────────────────────────────────────────── */}
//             <div className="mb-5 flex items-center gap-1 border-b border-[#f0ebf6] pb-0">
//               <button
//                 type="button"
//                 onClick={() => setActiveTab('parse')}
//                 className={`flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-[13px] font-semibold transition-colors ${ activeTab === 'parse' ? 'border-[#6f2dbd] text-[#6f2dbd]' : 'border-transparent text-[#9c90af] hover:text-[#5c22a4]' }`}
//               >
//                 <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
//                   <path d="M3 13V7l5-5 5 5v6M6 13v-4h4v4" />
//                 </svg>
//                 Parse Resumes
//               </button>
//               <button
//                 type="button"
//                 onClick={() => setActiveTab('portal')}
//                 className={`flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-[13px] font-semibold transition-colors ${ activeTab === 'portal' ? 'border-[#6f2dbd] text-[#6f2dbd]' : 'border-transparent text-[#9c90af] hover:text-[#5c22a4]' }`}
//               >
//                 <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
//                   <circle cx="8" cy="6" r="3" />
//                   <path d="M2 14c0-3 2.7-4.5 6-4.5s6 1.5 6 4.5" />
//                 </svg>
//                 Portal Applications
//                 {portalUploads.filter(u => u.parse_status === 'pending').length > 0 && (
//                   <span className="ml-1 rounded-full bg-[#f0e6ff] px-1.5 py-0.5 text-[10px] font-bold text-[#6f2dbd]">
//                     {portalUploads.filter(u => u.parse_status === 'pending').length}
//                   </span>
//                 )}
//               </button>
//             </div>

//             {/* ══ Tab: Parse Resumes ══════════════════════════════════════════ */}
//             {activeTab === 'parse' && (
//             <>
//               <div className="mb-4 flex items-center gap-2.5 text-[18px] font-semibold text-[#2f124f]">
//                 <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#f4eefe] text-[#6f2dbd]">
//                   <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
//                     <path d="M3 13V7l5-5 5 5v6M6 13v-4h4v4" />
//                   </svg>
//                 </span>
//                 Parse Resumes
//               </div>

//             <div className="mb-5 flex flex-wrap gap-3">
//               <input
//                 className="h-11 w-[180px] rounded-md border border-[#e5deef] bg-[#fbfafe] px-3.5 text-[13px] text-[#4a3c60] outline-none placeholder:text-[#b4a8c3] focus:border-[#b48de2]"
//                 placeholder="Select Job Role"
//                 value={role}
//                 onChange={(event) => setRole(event.target.value)}
//               />
//               <select
//                 className="h-11 w-[170px] rounded-md border border-[#e5deef] bg-[#fbfafe] px-3.5 text-[13px] text-[#6f627f] outline-none focus:border-[#b48de2]"
//                 value={exp}
//                 onChange={(event) => setExp(event.target.value)}
//               >
//                 <option value="">Select Experience</option>
//                 <option>1+ years</option>
//                 <option>3+ years</option>
//                 <option>5+ years</option>
//                 <option>7+ years</option>
//               </select>
//               <input
//                 className="h-11 w-[155px] rounded-md border border-[#e5deef] bg-[#fbfafe] px-3.5 text-[13px] text-[#4a3c60] outline-none placeholder:text-[#b4a8c3] focus:border-[#b48de2]"
//                 placeholder="Select Location"
//                 value={location}
//                 onChange={(event) => setLocation(event.target.value)}
//               />
//               <input
//                 className="h-11 w-[150px] rounded-md border border-[#e5deef] bg-[#fbfafe] px-3.5 text-[13px] text-[#4a3c60] outline-none placeholder:text-[#b4a8c3] focus:border-[#b48de2]"
//                 placeholder="Select Skills"
//                 value={skills}
//                 onChange={(event) => setSkills(event.target.value)}
//               />
//             </div>

//             <div className="mb-3 text-[14px] font-medium text-[#84798f]">Upload Resume</div>

//             <input
//               ref={fileInputRef}
//               type="file"
//               multiple
//               accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
//               className="hidden"
//               onChange={handleFilesSelected}
//             />

//             <div className="rounded-[16px] border border-dashed border-[#e8e2f1] bg-white px-6 py-12 text-center">
//               <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-[#8f869d]">
//                 <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
//                   <path d="M7 18a4 4 0 01-.4-7.98A5.5 5.5 0 0117 8.5c0 .17-.01.34-.03.5A3.5 3.5 0 0117.5 16H15" />
//                   <path d="M12 12v7" />
//                   <path d="M9.5 14.5L12 12l2.5 2.5" />
//                 </svg>
//               </div>
//               <div className="mt-3 text-[16px] text-[#7c708c]">
//                 Drag or drop Resumes here, or{' '}
//                 <button
//                   type="button"
//                   onClick={() => fileInputRef.current?.click()}
//                   className="font-semibold text-[#6f2dbd] hover:underline"
//                 >
//                   browse files
//                 </button>
//               </div>
//               <div className="mt-2 text-[11px] uppercase tracking-[0.08em] text-[#c1b6cf]">PDF, max 2MB</div>
//               {files.length > 0 && (
//                 <div className="mt-4 flex flex-wrap justify-center gap-2">
//                   {files.map((file) => (
//                     <span
//                       key={`${file.name}-${file.size}`}
//                       className="inline-flex items-center rounded-full bg-[#f0e4ff] px-3.5 py-1.5 text-[13px] font-medium text-[#6f2dbd]"
//                     >
//                       {file.name}
//                     </span>
//                   ))}
//                 </div>
//               )}
//             </div>

//             <div className="mt-4 flex justify-center">
//               <button
//                 onClick={() => void handleStartParsing()}
//                 disabled={isParsing}
//                 className={`rounded-[6px] px-6 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white ${
//                   isParsing ? 'bg-[#bba5d8]' : 'bg-[#5f179f] hover:bg-[#511089]'
//                 }`}
//               >
//                 {isParsing ? 'Parsing...' : 'Start Parsing'}
//               </button>
//             </div>
//             </>
//             )}

//             {/* ══ Tab: Portal Applications ════════════════════════════════════ */}
//             {activeTab === 'portal' && (
//               <div className="space-y-4">
//                 {/* Header row */}
//                 <div className="flex flex-wrap items-center justify-between gap-3">
//                   <div>
//                     <h3 className="text-[15px] font-semibold text-[#2f124f]">Portal Applications</h3>
//                     <p className="text-[12px] text-[#9c90af]">
//                       Resumes submitted by candidates via the public careers portal. Select a job to view and parse them.
//                     </p>
//                   </div>
//                   {portalUploads.filter(u => u.parse_status === 'pending').length > 0 && (
//                     <button
//                       type="button"
//                       onClick={() => void handleParseAllPortalUploads()}
//                       className="rounded-lg bg-[#6f2dbd] px-4 py-2 text-[12px] font-semibold text-white shadow-[0_2px_10px_rgba(111,45,189,0.25)] hover:bg-[#5c22a4]"
//                     >
//                       Parse all pending ({portalUploads.filter(u => u.parse_status === 'pending').length})
//                     </button>
//                   )}
//                 </div>

//                 {/* Job selector + Create Job */}
//                 <div className="flex items-center gap-2">
//                   <select
//                     value={selectedJobId}
//                     onChange={(e) => setSelectedJobId(e.target.value)}
//                     className="h-10 flex-1 max-w-sm rounded-lg border border-[#e5deef] bg-[#fbfafe] px-3.5 text-[13px] text-[#4a3c60] outline-none focus:border-[#b48de2]"
//                   >
//                     <option value="">— Select a job to view applications —</option>
//                     {portalJobs.map((j) => (
//                       <option key={j.id} value={j.id}>{j.title} ({j.job_profile})</option>
//                     ))}
//                   </select>
//                   <button
//                     type="button"
//                     onClick={() => { setShowCreateJob(true); setCreateJobError(null); }}
//                     className="flex h-10 items-center gap-1.5 rounded-lg border border-[#dcd2ec] bg-white px-3.5 text-[12px] font-semibold text-[#6f2dbd] hover:bg-[#f8f3ff] whitespace-nowrap"
//                   >
//                     <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
//                       <path d="M8 3v10M3 8h10"/>
//                     </svg>
//                     New Job
//                   </button>
//                 </div>

//                 {/* ── Create Job modal ─────────────────────────────────────── */}
//                 {showCreateJob && (
//                   <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 px-4">
//                     <div className="w-full max-w-lg rounded-[20px] border border-[#ede7f4] bg-white shadow-[0_20px_60px_rgba(111,45,189,0.18)]">
//                       {/* Modal header */}
//                       <div className="flex items-center justify-between border-b border-[#f0ebf6] px-6 py-4">
//                         <div>
//                           <h2 className="text-[16px] font-semibold text-[#1f1830]">Create new job</h2>
//                           <p className="text-[12px] text-[#9c90af]">Will appear on the careers portal immediately</p>
//                         </div>
//                         <button
//                           type="button"
//                           onClick={() => { setShowCreateJob(false); resetCreateJobForm(); }}
//                           className="flex h-8 w-8 items-center justify-center rounded-lg text-[#9c90af] hover:bg-[#f6f1fc] hover:text-[#6f2dbd]"
//                         >
//                           <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
//                             <path d="M3 3l10 10M13 3L3 13"/>
//                           </svg>
//                         </button>
//                       </div>

//                       {/* Modal body */}
//                       <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-4">
//                         {/* Title + Profile */}
//                         <div className="grid grid-cols-2 gap-3">
//                           <div>
//                             <label className="mb-1.5 block text-[12px] font-medium text-[#4a3c60]">
//                               Job Title <span className="text-red-500">*</span>
//                             </label>
//                             <input
//                               type="text"
//                               placeholder="e.g. UI/UX Designer"
//                               value={newJobTitle}
//                               onChange={e => setNewJobTitle(e.target.value)}
//                               className="h-9 w-full rounded-lg border border-[#e5deef] bg-[#fbfafe] px-3 text-[13px] text-[#1f1830] outline-none placeholder:text-[#c1b6cf] focus:border-[#b48de2]"
//                             />
//                           </div>
//                           <div>
//                             <label className="mb-1.5 block text-[12px] font-medium text-[#4a3c60]">
//                               Job Profile <span className="text-red-500">*</span>
//                             </label>
//                             <input
//                               type="text"
//                               placeholder="e.g. Product Design"
//                               value={newJobProfile}
//                               onChange={e => setNewJobProfile(e.target.value)}
//                               className="h-9 w-full rounded-lg border border-[#e5deef] bg-[#fbfafe] px-3 text-[13px] text-[#1f1830] outline-none placeholder:text-[#c1b6cf] focus:border-[#b48de2]"
//                             />
//                           </div>
//                         </div>

//                         {/* Location + Experience */}
//                         <div className="grid grid-cols-3 gap-3">
//                           <div className="col-span-1">
//                             <label className="mb-1.5 block text-[12px] font-medium text-[#4a3c60]">Location</label>
//                             <input
//                               type="text"
//                               placeholder="e.g. Noida, India"
//                               value={newJobLocation}
//                               onChange={e => setNewJobLocation(e.target.value)}
//                               className="h-9 w-full rounded-lg border border-[#e5deef] bg-[#fbfafe] px-3 text-[13px] text-[#1f1830] outline-none placeholder:text-[#c1b6cf] focus:border-[#b48de2]"
//                             />
//                           </div>
//                           <div>
//                             <label className="mb-1.5 block text-[12px] font-medium text-[#4a3c60]">Min Exp (yrs)</label>
//                             <input
//                               type="number"
//                               min="0"
//                               placeholder="0"
//                               value={newJobMinExp}
//                               onChange={e => setNewJobMinExp(e.target.value)}
//                               className="h-9 w-full rounded-lg border border-[#e5deef] bg-[#fbfafe] px-3 text-[13px] text-[#1f1830] outline-none focus:border-[#b48de2]"
//                             />
//                           </div>
//                           <div>
//                             <label className="mb-1.5 block text-[12px] font-medium text-[#4a3c60]">Max Exp (yrs)</label>
//                             <input
//                               type="number"
//                               min="0"
//                               placeholder="No limit"
//                               value={newJobMaxExp}
//                               onChange={e => setNewJobMaxExp(e.target.value)}
//                               className="h-9 w-full rounded-lg border border-[#e5deef] bg-[#fbfafe] px-3 text-[13px] text-[#1f1830] outline-none focus:border-[#b48de2]"
//                             />
//                           </div>
//                         </div>

//                         {/* Description */}
//                         <div>
//                           <label className="mb-1.5 block text-[12px] font-medium text-[#4a3c60]">Description</label>
//                           <textarea
//                             rows={3}
//                             placeholder="Describe the role, responsibilities, and what you're looking for..."
//                             value={newJobDescription}
//                             onChange={e => setNewJobDescription(e.target.value)}
//                             className="w-full rounded-lg border border-[#e5deef] bg-[#fbfafe] px-3 py-2.5 text-[13px] text-[#1f1830] outline-none placeholder:text-[#c1b6cf] focus:border-[#b48de2] resize-none"
//                           />
//                         </div>

//                         {/* Required skills */}
//                         <div>
//                           <label className="mb-1.5 block text-[12px] font-medium text-[#4a3c60]">
//                             Required Skills
//                             <span className="ml-1.5 font-normal text-[#a89ec0]">comma-separated</span>
//                           </label>
//                           <input
//                             type="text"
//                             placeholder="e.g. React, TypeScript, Figma"
//                             value={newJobReqSkills}
//                             onChange={e => setNewJobReqSkills(e.target.value)}
//                             className="h-9 w-full rounded-lg border border-[#e5deef] bg-[#fbfafe] px-3 text-[13px] text-[#1f1830] outline-none placeholder:text-[#c1b6cf] focus:border-[#b48de2]"
//                           />
//                           {/* Live skill chips preview */}
//                           {newJobReqSkills.trim() && (
//                             <div className="mt-2 flex flex-wrap gap-1.5">
//                               {newJobReqSkills.split(',').map(s => s.trim()).filter(Boolean).map((s, i) => (
//                                 <span key={i} className="rounded-full bg-[#f0e6ff] px-2.5 py-0.5 text-[11px] font-medium text-[#6f2dbd]">{s}</span>
//                               ))}
//                             </div>
//                           )}
//                         </div>

//                         {/* Optional skills */}
//                         <div>
//                           <label className="mb-1.5 block text-[12px] font-medium text-[#4a3c60]">
//                             Good to Have
//                             <span className="ml-1.5 font-normal text-[#a89ec0]">comma-separated</span>
//                           </label>
//                           <input
//                             type="text"
//                             placeholder="e.g. Framer, Motion Design"
//                             value={newJobOptSkills}
//                             onChange={e => setNewJobOptSkills(e.target.value)}
//                             className="h-9 w-full rounded-lg border border-[#e5deef] bg-[#fbfafe] px-3 text-[13px] text-[#1f1830] outline-none placeholder:text-[#c1b6cf] focus:border-[#b48de2]"
//                           />
//                           {newJobOptSkills.trim() && (
//                             <div className="mt-2 flex flex-wrap gap-1.5">
//                               {newJobOptSkills.split(',').map(s => s.trim()).filter(Boolean).map((s, i) => (
//                                 <span key={i} className="rounded-full bg-[#f0f4ff] px-2.5 py-0.5 text-[11px] font-medium text-[#4060c8]">{s}</span>
//                               ))}
//                             </div>
//                           )}
//                         </div>

//                         {createJobError && (
//                           <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700">
//                             {createJobError}
//                           </div>
//                         )}
//                       </div>

//                       {/* Modal footer */}
//                       <div className="flex items-center justify-end gap-2.5 border-t border-[#f0ebf6] px-6 py-4">
//                         <button
//                           type="button"
//                           onClick={() => { setShowCreateJob(false); resetCreateJobForm(); }}
//                           className="h-9 rounded-lg border border-[#e5deef] px-4 text-[12px] font-medium text-[#7d6f93] hover:bg-[#f8f3ff]"
//                         >
//                           Cancel
//                         </button>
//                         <button
//                           type="button"
//                           onClick={() => void handleCreateJob()}
//                           disabled={creatingJob}
//                           className="h-9 rounded-lg bg-[#6f2dbd] px-5 text-[12px] font-semibold text-white hover:bg-[#5c22a4] disabled:opacity-60"
//                         >
//                           {creatingJob ? 'Creating…' : 'Create Job'}
//                         </button>
//                       </div>
//                     </div>
//                   </div>
//                 )}

//                 {/* Feedback banners */}
//                 {portalError && (
//                   <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
//                     {portalError}
//                   </div>
//                 )}
//                 {portalSuccess && (
//                   <div className="rounded-lg border border-[#c0f0cf] bg-[#edfaf3] px-4 py-3 text-[13px] text-[#2d7a4f]">
//                     {portalSuccess}
//                   </div>
//                 )}

//                 {/* Table */}
//                 {selectedJobId && (
//                   portalLoading ? (
//                     <div className="rounded-[10px] border border-[#f0ebf6] py-10 text-center text-[12px] text-[#9c90af]">
//                       Loading portal applications…
//                     </div>
//                   ) : portalUploads.length === 0 ? (
//                     <div className="rounded-[14px] border border-dashed border-[#e8e2f1] bg-[#fbfafe] px-6 py-12 text-center">
//                       <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#f6f1fc] text-[#9c90af]">
//                         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
//                           <circle cx="8" cy="6" r="3" />
//                           <path d="M2 20c0-4 2.7-6 6-6s6 2 6 6" />
//                           <path d="M20 8v8M16 12h8" />
//                         </svg>
//                       </div>
//                       <p className="text-[14px] font-medium text-[#4a3c60]">No portal applications yet</p>
//                       <p className="mt-1 text-[12px] text-[#a89ec0]">
//                         Share the careers portal link so candidates can apply.
//                       </p>
//                     </div>
//                   ) : (
//                     <div className="overflow-hidden rounded-[10px] border border-[#f0ebf6]">
//                       <table className="w-full border-collapse">
//                         <thead>
//                           <tr className="bg-[#fbfafe]">
//                             {['APPLICANT', 'EMAIL', 'FILE', 'RECEIVED', 'STATUS', 'ACTION'].map((h) => (
//                               <th key={h} className="whitespace-nowrap border-b border-[#f0ebf6] px-4 py-3 text-left text-[11px] font-semibold tracking-[0.08em] text-[#8e819f]">
//                                 {h}
//                               </th>
//                             ))}
//                           </tr>
//                         </thead>
//                         <tbody>
//                           {portalUploads.map((u) => (
//                             <tr key={u.id} className="border-b border-[#f4eff8] text-[13px] text-[#34284a]">
//                               <td className="px-4 py-3 font-medium">{u.applicant_name || '—'}</td>
//                               <td className="px-4 py-3 text-[#7d6f93]">{u.applicant_email || '—'}</td>
//                               <td className="max-w-[180px] truncate px-4 py-3 text-[#7d6f93]">
//                                 {u.file_url ? (
//                                   <a href={u.file_url} target="_blank" rel="noopener noreferrer" className="text-[#6f2dbd] hover:underline">
//                                     {u.original_file_name}
//                                   </a>
//                                 ) : (
//                                   u.original_file_name
//                                 )}
//                               </td>
//                               <td className="whitespace-nowrap px-4 py-3 text-[#9c90af]">
//                                 {new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
//                               </td>
//                               <td className="px-4 py-3">
//                                 <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
//                                   u.parse_status === 'parsed'      ? 'bg-[#ddffe6] text-[#3bbd67]'  :
//                                   u.parse_status === 'processing'  ? 'bg-[#fff4d9] text-[#d68d0f]'  :
//                                   u.parse_status === 'failed'      ? 'bg-red-100 text-red-700'       :
//                                                                      'bg-[#f4f0f9] text-[#9c90af]'
//                                 }`}>
//                                   {u.parse_status.charAt(0).toUpperCase() + u.parse_status.slice(1)}
//                                 </span>
//                               </td>
//                               <td className="px-4 py-3">
//                                 {u.parse_status === 'pending' || u.parse_status === 'failed' ? (
//                                   <button
//                                     type="button"
//                                     disabled={parsingIds.has(u.id)}
//                                     onClick={() => void handleParsePortalUpload(u.id)}
//                                     className="rounded-md bg-[#f0e6ff] px-3 py-1.5 text-[11px] font-semibold text-[#6f2dbd] hover:bg-[#e6d9f7] disabled:opacity-50"
//                                   >
//                                     {parsingIds.has(u.id) ? 'Parsing…' : 'Parse'}
//                                   </button>
//                                 ) : u.parse_status === 'parsed' ? (
//                                   <span className="text-[11px] text-[#9c90af]">Done</span>
//                                 ) : (
//                                   <span className="text-[11px] text-[#f4b340]">In progress</span>
//                                 )}
//                               </td>
//                             </tr>
//                           ))}
//                         </tbody>
//                       </table>
//                     </div>
//                   )
//                 )}
//               </div>
//             )}
//           </section>

//           <section className="rounded-[16px] border border-[#ece6f4] bg-white px-6 py-5 shadow-[0_4px_18px_rgba(111,81,154,0.05)]">
//             <div className="mb-4 flex items-center justify-between">
//               <div className="flex items-center gap-2.5 text-[18px] font-semibold text-[#2f124f]">
//                 <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#f4eefe] text-[#6f2dbd]">
//                   <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
//                     <path d="M4 3.5h8" />
//                     <path d="M4 6.5h8" />
//                     <path d="M4 9.5h5.5" />
//                     <path d="M3 2.5h10v11H3z" />
//                   </svg>
//                 </span>
//                 Previous Records
//               </div>

//               <div className="flex items-center gap-2">
//                 <button className="rounded-[6px] bg-[#5f179f] px-4 py-2 text-[11px] font-semibold text-white hover:bg-[#511089]">
//                   Export CSV
//                 </button>
//               </div>
//             </div>

//             {recordsLoading ? (
//               <div className="rounded-[10px] border border-[#f0ebf6] bg-[#fcfbfe] px-4 py-10 text-center text-[12px] text-[#8f829f]">
//                 Loading records from backend...
//               </div>
//             ) : (
//               <div className="overflow-hidden rounded-[10px] border border-[#f0ebf6]">
//                 <table className="w-full border-collapse">
//                   <thead>
//                   <tr className="bg-[#fbfafe]">
//                     {['UPLOAD DATE', 'JOB ROLE', 'TOTAL RESUMES', 'HIGH MATCH', 'AVG MATCH SCORE', 'STATUS', 'HIRING', 'ACTIONS'].map((heading) => (
//                       <th
//                         key={heading}
//                         className="whitespace-nowrap border-b border-[#f0ebf6] px-4 py-3 text-left text-[11px] font-semibold tracking-[0.08em] text-[#8e819f]"
//                       >
//                         {heading}
//                       </th>
//                       ))}
//                     </tr>
//                   </thead>
//                   <tbody>
//                     {records.map((record) => (
//                     <tr
//                       key={record.id}
//                       onClick={() => handleOpenRecord(record)}
//                       className="cursor-pointer border-b border-[#f4eff8] text-[13px] text-[#34284a] transition-colors hover:bg-[#fcfbff]"
//                     >
//                       <td className="px-4 py-2.5">{record.uploadDate}</td>
//                       <td className="px-4 py-2.5 font-semibold uppercase tracking-[0.04em]">{record.role}</td>
//                       <td className="px-4 py-2.5">{record.totalResumes}</td>
//                       <td className="px-4 py-2.5">{record.highMatch}</td>
//                       <td className="px-4 py-2.5">
//                         <span className={`inline-flex min-w-[42px] items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${getScoreBg(record.avgScore)}`}>
//                           {record.avgScore}
//                         </span>
//                       </td>
//                       <td className="px-4 py-2.5">
//                         <span
//                           className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${
//                             record.status === 'Failed'
//                               ? 'bg-red-100 text-red-700'
//                               : record.status === 'Processing'
//                                 ? 'bg-[#fff4d9] text-[#d68d0f]'
//                                 : 'bg-[#ddffe6] text-[#3bbd67]'
//                             }`}
//                           >
//                             {record.status}
//                           </span>
//                       </td>
//                       {/* Hiring open/closed status + toggle */}
//                       <td className="px-4 py-2.5">
//                         <button
//                           type="button"
//                           disabled={togglingJobId === record.id}
//                           onClick={(e) => void handleToggleJobStatus(e, record)}
//                           className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
//                             record.isOpen !== false
//                               ? 'bg-[#edfaf1] text-[#3aac5d] hover:bg-[#d6f5e2]'
//                               : 'bg-[#f5f0fa] text-[#9c90af] hover:bg-[#ede7f4]'
//                           }`}
//                         >
//                           <span className={`h-1.5 w-1.5 rounded-full ${record.isOpen !== false ? 'bg-[#3aac5d]' : 'bg-[#c1b4d1]'}`} />
//                           {togglingJobId === record.id
//                             ? 'Updating…'
//                             : record.isOpen !== false ? 'Open' : 'Closed'}
//                         </button>
//                       </td>
//                       <td className="px-4 py-2.5">
//                         <div className="flex items-center gap-4 text-[#1f132d]">
//                           <button
//                             onClick={(event) => {
//                               event.stopPropagation();
//                               handleOpenRecord(record);
//                             }}
//                             className="hover:text-[#6f2dbd]"
//                           >
//                             <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
//                               <path d="M1.5 8s2.4-4 6.5-4 6.5 4 6.5 4-2.4 4-6.5 4-6.5-4-6.5-4z" />
//                               <circle cx="8" cy="8" r="1.8" />
//                             </svg>
//                           </button>
//                           <button className="hover:text-[#6f2dbd]">
//                             <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
//                               <path d="M3 11.8l.4-2.4L10.9 2l2.1 2.1-7.4 7.4-2.6.3z" />
//                               <path d="M9.8 3.1l2.1 2.1" />
//                             </svg>
//                             </button>
//                           </div>
//                         </td>
//                       </tr>
//                     ))}
//                   </tbody>
//                 </table>

//                 {records.length === 0 && (
//                   <div className="px-4 py-10 text-center text-[14px] text-[#8f829f]">
//                     No parse runs yet. Start with a role and a few resumes.
//                   </div>
//                 )}
//               </div>
//             )}
//           </section>
//         </div>
//       </div>
//     </div>
//   );
// }


