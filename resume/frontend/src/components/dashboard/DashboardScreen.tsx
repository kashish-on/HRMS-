import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useATS } from '../../context/ATSContext';
import type { ParseRecord } from '../../types';
import { getScoreBg } from '../../lib/utils';

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
  } = useATS();
  const [role, setRole] = useState('');
  const [exp, setExp] = useState('');
  const [location, setLocation] = useState('');
  const [skills, setSkills] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
                placeholder="Select Job Role"
                value={role}
                onChange={(event) => setRole(event.target.value)}
              />
              <select
                className="h-11 w-[170px] rounded-md border border-[#e5deef] bg-[#fbfafe] px-3.5 text-[13px] text-[#6f627f] outline-none focus:border-[#b48de2]"
                value={exp}
                onChange={(event) => setExp(event.target.value)}
              >
                <option value="">Select Experience</option>
                <option>1+ years</option>
                <option>3+ years</option>
                <option>5+ years</option>
                <option>7+ years</option>
              </select>
              <input
                className="h-11 w-[155px] rounded-md border border-[#e5deef] bg-[#fbfafe] px-3.5 text-[13px] text-[#4a3c60] outline-none placeholder:text-[#b4a8c3] focus:border-[#b48de2]"
                placeholder="Select Location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
              <input
                className="h-11 w-[150px] rounded-md border border-[#e5deef] bg-[#fbfafe] px-3.5 text-[13px] text-[#4a3c60] outline-none placeholder:text-[#b4a8c3] focus:border-[#b48de2]"
                placeholder="Select Skills"
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
                className={`rounded-[6px] px-6 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white ${
                  isParsing ? 'bg-[#bba5d8]' : 'bg-[#5f179f] hover:bg-[#511089]'
                }`}
              >
                {isParsing ? 'Parsing...' : 'Start Parsing'}
              </button>
            </div>
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
                Previous Records
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
                    {['UPLOAD DATE', 'JOB ROLE', 'TOTAL RESUMES', 'HIGH MATCH', 'AVG MATCH SCORE', 'STATUS', 'ACTIONS'].map((heading) => (
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
