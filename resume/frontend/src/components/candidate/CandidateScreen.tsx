import { Fragment, useState } from 'react';
import { useATS } from '../../context/ATSContext';
import ScoreDonut from './ScoreDonut';
import PipelineTracker from './PipelineTracker';
import { getScoreBg, getScoreBarColor, getInitials, isTop10 } from '../../lib/utils';

type Tab = 'score' | 'resume' | 'notes';

export default function CandidateScreen() {
  const {
    currentCandidate,
    currentRecord,
    navigate,
    candidates,
    getScore,
    weights,
    setShowInterviewModal,
    rejectCurrentCandidate,
    addNote,
    prevCandidate,
    nextCandidate,
  } = useATS();

  const [tab, setTab] = useState<Tab>('score');
  const [noteText, setNoteText] = useState('');

  if (!currentCandidate || !currentRecord) {
    return null;
  }

  const candidate = currentCandidate;
  const score = getScore(candidate);
  const scoredCandidates = candidates.map((candidateItem) => ({ ...candidateItem, score: getScore(candidateItem) }));
  const top10 = isTop10(candidate, scoredCandidates, getScore);
  const initials = getInitials(candidate.name);

  const scoreBreakdown = [
    { label: 'Skill match', value: candidate.skill, weight: weights.skill },
    { label: 'Experience', value: candidate.experience, weight: weights.experience },
    { label: 'Title relevance', value: candidate.titleR, weight: weights.title },
    { label: 'Location match', value: candidate.location_score, weight: weights.location },
  ];

  const canEmbedResume = Boolean(candidate.resumeUrl);

  function handleAddNote() {
    if (!noteText.trim()) {
      return;
    }

    void addNote(candidate.id, noteText.trim());
    setNoteText('');
  }

  function handleReject() {
    void rejectCurrentCandidate();
  }

  const tabStyle = (targetTab: Tab) =>
    `mr-4 cursor-pointer border-b-2 px-1 py-2 text-[13px] transition-colors ${
      tab === targetTab
        ? 'border-purple-600 text-purple-700 font-medium'
        : 'border-transparent text-stone-400 hover:text-stone-600'
    }`;

  return (
    <div>
      <div className="sticky top-0 z-50 flex h-[52px] items-center gap-2 border-b border-stone-200 bg-white px-6">
        <span className="cursor-pointer text-[13px] text-stone-400 transition-colors hover:text-stone-700" onClick={() => navigate('dashboard')}>
          Recruitment
        </span>
        <span className="text-stone-300">/</span>
        <span className="cursor-pointer text-[13px] text-stone-400 transition-colors hover:text-stone-700" onClick={() => navigate('results')}>
          {currentRecord.role}
        </span>
        <span className="text-stone-300">/</span>
        <span className="text-[13px] font-medium text-stone-800">{currentCandidate.name}</span>
        <div className="ml-auto flex gap-1.5">
          <button onClick={prevCandidate} className="flex h-8 w-8 items-center justify-center rounded-md border border-stone-300 text-sm text-stone-600 transition-colors hover:bg-stone-50">
            ←
          </button>
          <button onClick={nextCandidate} className="flex h-8 w-8 items-center justify-center rounded-md border border-stone-300 text-sm text-stone-600 transition-colors hover:bg-stone-50">
            →
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="mb-4 rounded-xl border border-stone-200 bg-white p-[18px]">
          <div className="flex items-center gap-4">
            <div className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-full bg-purple-100 text-base font-semibold text-purple-700">
              {initials}
            </div>
            <div className="flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-[18px] font-semibold text-stone-900">{currentCandidate.name}</span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${getScoreBg(score)}`}>
                  {score}% ATS
                </span>
                {top10 && (
                  <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-[11px] font-medium text-purple-700">
                    Top 10
                  </span>
                )}
              </div>
              <div className="text-[13px] text-stone-400">
                {currentCandidate.title} · {currentCandidate.exp} yrs · {currentCandidate.location}
              </div>
            </div>
            <div className="flex gap-2">
              {currentCandidate.resumeUrl ? (
                <a
                  href={currentCandidate.resumeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50"
                >
                  Download CV
                </a>
              ) : (
                <button className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-400">
                  Download CV
                </button>
              )}
              <button onClick={handleReject} className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50">
                Reject
              </button>
              <button onClick={() => setShowInterviewModal(true)} className="inline-flex items-center gap-1.5 rounded-md bg-[#534AB7] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#453da0]">
                Schedule interview
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="rounded-xl border border-stone-200 bg-white p-[18px]">
              <div className="mb-0 flex border-b border-stone-200">
                <button className={tabStyle('score')} onClick={() => setTab('score')}>Score breakdown</button>
                <button className={tabStyle('resume')} onClick={() => setTab('resume')}>Resume preview</button>
                <button className={tabStyle('notes')} onClick={() => setTab('notes')}>
                  Notes
                  {currentCandidate.notes.length > 0 && (
                    <span className="ml-1 rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] text-purple-700">
                      {currentCandidate.notes.length}
                    </span>
                  )}
                </button>
              </div>

              {tab === 'score' && (
                <div className="mt-4">
                  <div className="mb-5 flex justify-center">
                    <ScoreDonut score={score} />
                  </div>
                  <div className="mb-4 grid grid-cols-2 gap-3">
                    {scoreBreakdown.map((item) => (
                      <div key={item.label} className="rounded-lg bg-stone-50 p-3">
                        <div className="mb-1 text-[11px] text-stone-500">
                          {item.label} <span className="text-stone-300">({item.weight}%)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-200">
                            <div className={`h-1.5 rounded-full ${getScoreBarColor(item.value)}`} style={{ width: `${item.value}%` }} />
                          </div>
                          <span className="text-[12px] font-medium text-stone-700">{item.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg bg-stone-50 p-3">
                    <div className="mb-2 text-[12px] font-medium text-stone-700">Matched skills</div>
                    <div className="flex flex-wrap gap-1">
                      {currentCandidate.skills_match.map((skill) => (
                        <span key={skill} className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-1 text-[11px] text-green-800">
                          {skill}
                        </span>
                      ))}
                      {currentCandidate.skills_miss.map((skill) => (
                        <span key={skill} className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-[11px] text-red-800">
                          {skill} ×
                        </span>
                      ))}
                    </div>
                    {currentCandidate.scoreExplanation && (
                      <div className="mt-3 text-[12px] leading-relaxed text-stone-500">
                        {currentCandidate.scoreExplanation}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tab === 'resume' && (
                <div className="mt-4 space-y-4">
                  {canEmbedResume && candidate.resumeUrl && (
                    <div className="overflow-hidden rounded-lg border border-stone-200 bg-stone-50">
                      <div className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-2.5">
                        <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-stone-500">
                          Resume Preview
                        </div>
                        <a
                          href={candidate.resumeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[12px] font-medium text-purple-600 hover:text-purple-800"
                        >
                          Open full resume
                        </a>
                      </div>
                      <iframe
                        src={candidate.resumeUrl}
                        title={`${candidate.name} resume preview`}
                        className="h-[560px] w-full bg-white"
                      />
                    </div>
                  )}

                  {!canEmbedResume && (
                    <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 px-4 py-10 text-center text-[13px] text-stone-500">
                      Resume preview is not available for this candidate yet.
                    </div>
                  )}
                </div>
              )}

              {tab === 'notes' && (
                <div className="mt-4">
                  <div className="mb-3 space-y-2">
                    {currentCandidate.notes.length === 0 && (
                      <div className="py-4 text-center text-[13px] text-stone-400">No notes yet</div>
                    )}
                    {currentCandidate.notes.map((note, index) => (
                      <div key={note.id || index} className="rounded-lg bg-stone-50 p-3">
                        <div className="mb-1 text-[11px] text-stone-400">
                          {note.by} · {note.date}
                        </div>
                        <div className="text-[13px] text-stone-700">{note.text}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-[13px] outline-none focus:border-purple-500"
                      placeholder="Add a note..."
                      value={noteText}
                      onChange={(event) => setNoteText(event.target.value)}
                      onKeyDown={(event) => event.key === 'Enter' && handleAddNote()}
                    />
                    <button onClick={handleAddNote} className="rounded-md bg-[#534AB7] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[#453da0]">
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-stone-200 bg-white p-[18px]">
              <div className="mb-4 text-[14px] font-semibold text-stone-800">Pipeline</div>
              <PipelineTracker currentStage={currentCandidate.stage} />
            </div>

            <div className="rounded-xl border border-stone-200 bg-white p-[18px]">
              <div className="mb-3 text-[14px] font-semibold text-stone-800">Details</div>
              <div className="grid grid-cols-[110px_1fr] gap-1.5 text-[13px]">
                {[
                  ['Current title', currentCandidate.title],
                  ['Experience', `${currentCandidate.exp} years`],
                  ['Location', currentCandidate.location],
                  ['Current company', currentCandidate.currentCompany || 'Not available'],
                  ['Education', currentCandidate.highestEducation || 'Not available'],
                  ['Stage', currentCandidate.stage],
                ].map(([label, value]) => (
                  <Fragment key={label}>
                    <span className="text-stone-400">{label}</span>
                    <span className="font-medium text-stone-800">{value}</span>
                  </Fragment>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button onClick={() => setShowInterviewModal(true)} className="w-full rounded-lg bg-[#534AB7] py-2 text-sm font-medium text-white transition-colors hover:bg-[#453da0]">
                Schedule interview
              </button>
              <button onClick={() => navigate('offer')} className="w-full rounded-lg border border-stone-300 bg-white py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50">
                Extend offer
              </button>
              <button onClick={handleReject} className="w-full rounded-lg border border-red-200 bg-white py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50">
                Reject candidate
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
