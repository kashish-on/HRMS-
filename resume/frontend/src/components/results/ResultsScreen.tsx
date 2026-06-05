import { useMemo, useState } from 'react';
import { useATS } from '../../context/ATSContext';
import type { Candidate } from '../../types';
import { getInitials, getScoreBg, getStageColor, isTop10 } from '../../lib/utils';

const statStyles = [
  {
    keyLabel: 'TOTAL RESUMES',
    iconBg: 'bg-[#fff1f1]',
    iconColor: 'text-[#ff7a7a]',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <rect x="3" y="2.5" width="10" height="11" rx="1.8" />
        <path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3.2" />
      </svg>
    ),
  },
  {
    keyLabel: 'HIGH MATCH RESUMES',
    iconBg: 'bg-[#fff5e6]',
    iconColor: 'text-[#f4b340]',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M4.2 11.8L11.8 4.2" />
        <path d="M6 4.4H11.6V10" />
        <path d="M4 8.5V12h3.5" />
      </svg>
    ),
  },
  {
    keyLabel: 'AVERAGE MATCH SCORE',
    iconBg: 'bg-[#edfdf0]',
    iconColor: 'text-[#63d78a]',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M4 12.5V6.5" />
        <path d="M8 12.5V3.5" />
        <path d="M12 12.5V8.5" />
      </svg>
    ),
  },
  {
    keyLabel: 'SHORTLISTED CANDIDATE',
    iconBg: 'bg-[#fff0f5]',
    iconColor: 'text-[#ff8699]',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M4 5h8" />
        <path d="M4 8h8" />
        <path d="M4 11h5" />
      </svg>
    ),
  },
  {
    keyLabel: 'IN INTERVIEW STAGE',
    iconBg: 'bg-[#fff6e8]',
    iconColor: 'text-[#f1b347]',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <rect x="3" y="3" width="10" height="10" rx="2" />
        <path d="M5.5 6h5" />
        <path d="M5.5 8.5h5" />
        <path d="M5.5 11h3.2" />
      </svg>
    ),
  },
  {
    keyLabel: 'REJECTED CANDIDATES',
    iconBg: 'bg-[#effff1]',
    iconColor: 'text-[#67d978]',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <circle cx="6" cy="6" r="2.3" />
        <path d="M2.8 12a3.7 3.7 0 016.4 0" />
        <path d="M10.7 5.3l2.5 2.5" />
        <path d="M13.2 5.3l-2.5 2.5" />
      </svg>
    ),
  },
];

export default function ResultsScreen() {
  const {
    currentRecord,
    candidates,
    navigate,
    setCurrentCandidate,
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    bulkAction,
    deleteCandidate,
    getScore,
    candidatesLoading,
  } = useATS();

  const [scoreFilter, setScoreFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [sortBy, setSortBy] = useState('score');

  const scoredCandidates = useMemo(
    () => candidates.map((candidate) => ({ ...candidate, score: getScore(candidate) })),
    [candidates, getScore]
  );

  const filtered = useMemo(() => {
    let list = [...scoredCandidates];

    if (scoreFilter === 'green') {
      list = list.filter((candidate) => (candidate.score ?? 0) >= 75);
    } else if (scoreFilter === 'orange') {
      list = list.filter((candidate) => (candidate.score ?? 0) >= 50 && (candidate.score ?? 0) < 75);
    } else if (scoreFilter === 'red') {
      list = list.filter((candidate) => (candidate.score ?? 0) < 50);
    }

    if (stageFilter) {
      list = list.filter((candidate) => candidate.stage === stageFilter);
    }

    if (sortBy === 'score') {
      list.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    } else if (sortBy === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'exp') {
      list.sort((a, b) => b.exp - a.exp);
    }

    return list;
  }, [scoredCandidates, scoreFilter, stageFilter, sortBy]);

  const highMatch = scoredCandidates.filter((candidate) => (candidate.score ?? 0) >= 75).length;
  const avgScore = scoredCandidates.length
    ? Math.round(scoredCandidates.reduce((sum, candidate) => sum + (candidate.score ?? 0), 0) / scoredCandidates.length)
    : 0;
  const shortlistedCount = scoredCandidates.filter((candidate) => candidate.stage === 'Shortlisted').length;
  const interviewCount = scoredCandidates.filter((candidate) => candidate.stage === 'Interview Scheduled' || candidate.stage === 'Interviewed').length;
  const rejectedCount = scoredCandidates.filter((candidate) => candidate.stage === 'Rejected').length;

  const stats = [
    { value: candidates.length, ...statStyles[0] },
    { value: highMatch, ...statStyles[1] },
    { value: avgScore, ...statStyles[2] },
    { value: shortlistedCount, ...statStyles[3] },
    { value: interviewCount, ...statStyles[4] },
    { value: rejectedCount, ...statStyles[5] },
  ];

  function openCandidate(candidate: Candidate) {
    setCurrentCandidate(candidate);
    navigate('candidate');
  }

  if (!currentRecord) {
    return null;
  }

  const allSelected = selectedIds.length === candidates.length && candidates.length > 0;

  return (
    <div className="px-4 py-4">
      <div className="rounded-[20px] border border-[#ede7f4] bg-white shadow-[0_10px_28px_rgba(91,59,132,0.05)]">
        <div className="border-b border-[#f0ebf6] px-8 py-5">
          <div className="text-[34px] font-semibold tracking-[-0.03em] text-[#1f1830]">Parsed Resume</div>
        </div>

        <div className="space-y-5 p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-wrap gap-3">
              <select
                value={scoreFilter}
                onChange={(event) => setScoreFilter(event.target.value)}
                className="h-11 min-w-[130px] rounded-md border border-[#e5deef] bg-[#fbfafe] px-3.5 text-[13px] text-[#6f627f] outline-none focus:border-[#b48de2]"
              >
                <option value="">All Scores</option>
                <option value="green">Green (75+)</option>
                <option value="orange">Orange (50-74)</option>
                <option value="red">Red (0-49)</option>
              </select>
              <select
                value={stageFilter}
                onChange={(event) => setStageFilter(event.target.value)}
                className="h-11 min-w-[120px] rounded-md border border-[#e5deef] bg-[#fbfafe] px-3.5 text-[13px] text-[#6f627f] outline-none focus:border-[#b48de2]"
              >
                <option value="">All Stages</option>
                <option value="Applied">Applied</option>
                <option value="Shortlisted">Shortlisted</option>
                <option value="Interview Scheduled">Interview Scheduled</option>
                <option value="Interviewed">Interviewed</option>
                <option value="Offer Extended">Offer Extended</option>
                <option value="Rejected">Rejected</option>
              </select>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="h-11 min-w-[210px] rounded-md border border-[#e5deef] bg-[#fbfafe] px-3.5 text-[13px] text-[#6f627f] outline-none focus:border-[#b48de2]"
              >
                <option value="score">ATS Score (High To Low)</option>
                <option value="name">Candidate Name A-Z</option>
                <option value="exp">Experience</option>
              </select>
            </div>

          </div>

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
                <div className="mt-2 text-[42px] font-semibold leading-none text-[#6f2dbd]">{stat.value}</div>
              </div>
            ))}
          </div>

          {selectedIds.length > 0 && (
            <div className="flex items-center gap-3 rounded-[14px] border border-[#eadbfb] bg-[#f8f1ff] px-4 py-3">
              <div className="text-[13px] font-semibold text-[#6f2dbd]">{selectedIds.length} selected</div>
              <button
                onClick={() => void bulkAction('shortlist')}
                className="rounded-md bg-[#5f179f] px-4 py-2 text-[11px] font-semibold text-white hover:bg-[#511089]"
              >
                Shortlist
              </button>
              <button
                onClick={() => void bulkAction('interview')}
                className="rounded-md border border-[#d8d2e4] bg-white px-4 py-2 text-[11px] font-semibold text-[#5a4e6d] hover:bg-[#faf8fd]"
              >
                Move to interview
              </button>
              <button
                onClick={() => void bulkAction('reject')}
                className="rounded-md border border-[#f2c9cf] bg-white px-4 py-2 text-[11px] font-semibold text-[#d15366] hover:bg-[#fff4f6]"
              >
                Reject
              </button>
              <button
                onClick={clearSelection}
                className="ml-auto rounded-md border border-[#d8d2e4] bg-white px-4 py-2 text-[11px] font-semibold text-[#5a4e6d] hover:bg-[#faf8fd]"
              >
                Clear
              </button>
            </div>
          )}

          <section className="rounded-[16px] border border-[#ece6f4] bg-white shadow-[0_4px_18px_rgba(111,81,154,0.05)]">
            <div className="flex items-center justify-between border-b border-[#f0ebf6] px-6 py-4">
              <div className="flex items-center gap-2.5 text-[20px] font-semibold text-[#2f124f]">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#f4eefe] text-[#6f2dbd]">
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                    <path d="M4 3.5h8" />
                    <path d="M4 6.5h8" />
                    <path d="M4 9.5h5.5" />
                    <path d="M3 2.5h10v11H3z" />
                  </svg>
                </span>
                {currentRecord.role}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => void bulkAction('shortlist')}
                  className="rounded-[6px] border border-[#7edb99] bg-[#ecfff2] px-4 py-2 text-[12px] font-semibold text-[#39b861] hover:bg-[#e3ffeb]"
                >
                  Shortlist All
                </button>
                <button
                  onClick={() => void bulkAction('reject')}
                  className="rounded-[6px] border border-[#f7aab5] bg-[#fff4f6] px-4 py-2 text-[12px] font-semibold text-[#de556c] hover:bg-[#ffedf1]"
                >
                  Reject All
                </button>
                <button className="rounded-[6px] bg-[#5f179f] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#511089]">
                  Export CSV
                </button>
              </div>
            </div>

            {candidatesLoading ? (
              <div className="px-6 py-16 text-center text-[14px] text-[#8f829f]">
                Loading candidates from backend...
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-[#f7f1fb]">
                        <th className="w-12 px-4 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={toggleSelectAll}
                            className="rounded accent-[#6f2dbd]"
                          />
                        </th>
                        <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5d516d]">
                          Candidate Name
                        </th>
                        <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5d516d]">
                          Job Role Match
                        </th>
                        <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5d516d]">
                          Experience Match
                        </th>
                        <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5d516d]">
                          Skills Match
                        </th>
                        <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5d516d]">
                          ATS Score
                        </th>
                        <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5d516d]">
                          Status
                        </th>
                        <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5d516d]">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((candidate) => {
                        const score = candidate.score ?? 0;
                        const isSelected = selectedIds.includes(candidate.id);
                        const top10 = isTop10(candidate, scoredCandidates, getScore);

                        return (
                          <tr
                            key={candidate.id}
                            onClick={() => openCandidate(candidate)}
                            className={`cursor-pointer border-b border-[#f3eef8] text-[13px] text-[#34284a] transition-colors ${
                              isSelected ? 'bg-[#faf4ff]' : 'hover:bg-[#fcfbff]'
                            }`}
                          >
                            <td
                              className="px-4 py-4"
                              onClick={(event) => {
                                event.stopPropagation();
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelect(candidate.id)}
                                className="rounded accent-[#6f2dbd]"
                              />
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#efe2ff] text-[12px] font-semibold text-[#6e33b4]">
                                  {getInitials(candidate.name)}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 text-[14px] font-semibold text-[#2d1f42]">
                                    {candidate.name}
                                    {top10 && (
                                      <span className="rounded-full bg-[#efe2ff] px-2 py-0.5 text-[10px] font-semibold text-[#6e33b4]">
                                        Top 10
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-1 text-[12px] text-[#8e819f]">
                                    {candidate.title} · {candidate.exp}y · {candidate.location}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <ScorePill value={candidate.titleR} />
                            </td>
                            <td className="px-4 py-4">
                              <ScorePill value={candidate.experience} />
                            </td>
                            <td className="px-4 py-4">
                              <ScorePill value={candidate.skill} />
                            </td>
                            <td className="px-4 py-4">
                              <span className={`inline-flex min-w-[48px] items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${getScoreBg(score)}`}>
                                {score}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${getStageColor(candidate.stage)}`}>
                                {candidate.stage}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-4 text-[#1f132d]">
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openCandidate(candidate);
                                  }}
                                  className="hover:text-[#6f2dbd]"
                                >
                                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M1.5 8s2.4-4 6.5-4 6.5 4 6.5 4-2.4 4-6.5 4-6.5-4-6.5-4z" />
                                    <circle cx="8" cy="8" r="1.8" />
                                  </svg>
                                </button>
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    if (window.confirm(`Delete resume for ${candidate.name}? This cannot be undone.`)) {
                                      void deleteCandidate(candidate.id);
                                    }
                                  }}
                                  className="hover:text-[#d15366]"
                                >
                                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M4.5 4.5h7" />
                                    <path d="M6 4.5V3.3h4v1.2" />
                                    <path d="M5.2 5.5l.55 6.1h4.5l.55-6.1" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between px-6 py-4">
                  <div className="text-[12px] text-[#9a8ea9]">
                    Showing {filtered.length} of {candidates.length} results
                  </div>
                  <div className="flex items-center gap-2 text-[12px] text-[#7e7191]">
                    <button className="h-7 w-7 rounded-full border border-[#ede5f6]">‹</button>
                    <button className="flex h-7 w-7 items-center justify-center rounded-full bg-[#5f179f] text-white">1</button>
                    <button className="h-7 w-7 rounded-full border border-[#ede5f6]">2</button>
                    <button className="h-7 w-7 rounded-full border border-[#ede5f6]">3</button>
                    <button className="h-7 w-7 rounded-full border border-[#ede5f6]">›</button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function ScorePill({ value }: { value: number }) {
  return (
    <span className={`inline-flex min-w-[48px] items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${getScoreBg(value)}`}>
      {value}
    </span>
  );
}
