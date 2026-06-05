import { Fragment, useState } from 'react';
import { useATS } from '../../../context/ATSContext';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const TIME_SLOTS = ['9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '2:00 PM', '3:00 PM', '4:00 PM'];
const BUSY_DAYS: Record<number, string[]> = { 8: ['10:00 AM', '2:00 PM'], 12: ['11:00 AM'] };

type IntStep = 1 | 2 | 3;

function TypeBtn({ id, icon, label, selected, onClick }: { id: string; icon: string; label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      id={id}
      onClick={onClick}
      className={`flex-1 py-2.5 px-2 rounded-md border text-xs cursor-pointer text-center transition-colors ${
        selected ? 'bg-purple-50 border-purple-300 text-purple-700 font-medium' : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
      }`}
    >
      <div className="text-lg mb-1">{icon}</div>
      {label}
    </button>
  );
}

export default function InterviewModal() {
  const { showInterviewModal, setShowInterviewModal, interviewForm, setInterviewForm, confirmInterview, currentCandidate, currentRecord } = useATS();

  const [step, setStep] = useState<IntStep>(1);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [selDay, setSelDay] = useState<number | null>(null);
  const [addInterviewer, setAddInterviewer] = useState('');

  if (!showInterviewModal || !currentCandidate) return null;

  function handleClose() {
    setShowInterviewModal(false);
    setStep(1);
    setSelDay(null);
  }

  function handleNext() {
    if (step < 3) setStep(prev => (prev + 1) as IntStep);
    else {
      if (selDay) {
        setInterviewForm({
          date: `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(selDay).padStart(2, '0')}`,
        });
      }
      void confirmInterview();
      setStep(1);
      setSelDay(null);
    }
  }

  function handleBack() {
    if (step > 1) setStep(prev => (prev - 1) as IntStep);
  }

  function addInterviewerPill() {
    if (!addInterviewer.trim()) return;
    setInterviewForm({ interviewers: [...interviewForm.interviewers, addInterviewer.trim()] });
    setAddInterviewer('');
  }

  function removeInterviewer(name: string) {
    setInterviewForm({ interviewers: interviewForm.interviewers.filter(i => i !== name) });
  }

  // Calendar render
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today = new Date();
  const busySlots = selDay ? (BUSY_DAYS[selDay] ?? []) : [];

  const typeMap: Record<string, string> = { video: 'Video call', phone: 'Phone', f2f: 'In person' };
  const roundMap: Record<string, string> = { '1': 'Round 1', '2': 'Round 2', hr: 'HR round' };
  const durMap: Record<string, string> = { '30': '30 min', '45': '45 min', '60': '60 min' };

  return (
    <div className="fixed inset-0 bg-black/45 z-[200] flex items-center justify-center p-5" onClick={handleClose}>
      <div className="bg-white rounded-xl border border-stone-200 w-full max-w-[580px] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <div className="text-[15px] font-semibold text-stone-900">Schedule interview</div>
            <div className="text-[12px] text-stone-400 mt-0.5">{currentCandidate.name} · {currentRecord?.role}</div>
          </div>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map(s => (
              <div key={s} className={`w-[22px] h-1 rounded-full transition-colors ${s <= step ? 'bg-purple-600' : 'bg-stone-200'}`} />
            ))}
            <button onClick={handleClose} className="ml-2 w-7 h-7 flex items-center justify-center border border-stone-200 rounded-md text-stone-400 hover:bg-stone-50 text-sm">✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5">
          {/* Step 1: Interview type, round, interviewers */}
          {step === 1 && (
            <div>
              <div className="mb-3.5">
                <label className="block text-[12px] font-medium text-stone-500 mb-2">Interview type</label>
                <div className="flex gap-2">
                  <TypeBtn id="video" icon="📹" label="Video call" selected={interviewForm.type === 'video'} onClick={() => setInterviewForm({ type: 'video' })} />
                  <TypeBtn id="phone" icon="📞" label="Phone" selected={interviewForm.type === 'phone'} onClick={() => setInterviewForm({ type: 'phone' })} />
                  <TypeBtn id="f2f" icon="🏢" label="In person" selected={interviewForm.type === 'f2f'} onClick={() => setInterviewForm({ type: 'f2f' })} />
                </div>
              </div>
              <div className="mb-3.5">
                <label className="block text-[12px] font-medium text-stone-500 mb-2">Round</label>
                <div className="flex gap-2">
                  {(['1', '2', 'hr'] as const).map(r => (
                    <button
                      key={r}
                      onClick={() => setInterviewForm({ round: r })}
                      className={`px-4 py-2 rounded-md border text-[12px] transition-colors ${interviewForm.round === r ? 'bg-purple-50 border-purple-300 text-purple-700 font-medium' : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'}`}
                    >
                      {roundMap[r]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-3.5">
                <label className="block text-[12px] font-medium text-stone-500 mb-2">Interviewers</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {interviewForm.interviewers.map(name => (
                    <span key={name} className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 text-purple-700 text-[12px] rounded-full">
                      {name}
                      <button onClick={() => removeInterviewer(name)} className="opacity-60 hover:opacity-100 text-sm leading-none">×</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    className="flex-1 px-3 py-2 border border-stone-300 rounded-md text-[13px] outline-none focus:border-purple-500"
                    placeholder="Add interviewer..."
                    value={addInterviewer}
                    onChange={e => setAddInterviewer(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addInterviewerPill()}
                  />
                  <button onClick={addInterviewerPill} className="px-3 py-2 border border-stone-300 bg-white text-stone-700 text-xs font-medium rounded-md hover:bg-stone-50 transition-colors">Add</button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Calendar + time slots */}
          {step === 2 && (
            <div className="grid grid-cols-2 gap-5">
              {/* Calendar */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <button onClick={() => { if (calMonth > 0) setCalMonth(m => m - 1); else { setCalMonth(11); setCalYear(y => y - 1); } }} className="w-8 h-8 border border-stone-200 rounded-md flex items-center justify-center text-stone-600 hover:bg-stone-50 transition-colors">←</button>
                  <span className="text-[13px] font-medium text-stone-800">{MONTHS[calMonth]} {calYear}</span>
                  <button onClick={() => { if (calMonth < 11) setCalMonth(m => m + 1); else { setCalMonth(0); setCalYear(y => y + 1); } }} className="w-8 h-8 border border-stone-200 rounded-md flex items-center justify-center text-stone-600 hover:bg-stone-50 transition-colors">→</button>
                </div>
                <div className="grid grid-cols-7 gap-0.5 mb-1">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                    <div key={i} className="text-center text-[10px] font-semibold text-stone-400 uppercase py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                  {Array.from({ length: firstDay }, (_, i) => <div key={`e-${i}`} />)}
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const d = i + 1;
                    const isPast = new Date(calYear, calMonth, d) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                    const isSel = selDay === d;
                    const isToday = d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
                    return (
                      <button
                        key={d}
                        disabled={isPast}
                        onClick={() => setSelDay(d)}
                        className={`w-[34px] h-[34px] rounded-full text-[13px] border-none mx-auto flex items-center justify-center transition-colors ${
                          isSel ? 'bg-purple-600 text-white' :
                          isToday ? 'border border-stone-300 text-stone-800 hover:bg-stone-50' :
                          isPast ? 'text-stone-300 cursor-default' :
                          'text-stone-700 hover:bg-stone-100 cursor-pointer'
                        }`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time slots + duration */}
              <div>
                <div className="text-[13px] font-medium text-stone-800 mb-2.5">
                  {selDay ? `${MONTHS[calMonth]} ${selDay}` : 'Pick a date first'}
                </div>
                {selDay && (
                  <div className="flex flex-col gap-1.5 mb-4">
                    {TIME_SLOTS.map(slot => {
                      const isBusy = busySlots.includes(slot);
                      const isSel = interviewForm.slot === slot;
                      return (
                        <button
                          key={slot}
                          disabled={isBusy}
                          onClick={() => !isBusy && setInterviewForm({ slot })}
                          className={`px-3 py-2 rounded-md border text-[12px] text-left transition-colors ${
                            isBusy ? 'bg-stone-50 text-stone-300 border-stone-100 line-through cursor-default' :
                            isSel ? 'bg-purple-50 border-purple-300 text-purple-700 font-medium' :
                            'border-stone-200 bg-white text-stone-700 hover:bg-stone-50 cursor-pointer'
                          }`}
                        >
                          {slot}{isBusy ? ' (busy)' : ''}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div>
                  <label className="block text-[12px] font-medium text-stone-500 mb-2">Duration</label>
                  <div className="flex gap-1.5">
                    {(['30', '45', '60'] as const).map(d => (
                      <button
                        key={d}
                        onClick={() => setInterviewForm({ duration: d })}
                        className={`px-3.5 py-1.5 rounded-md border text-[12px] transition-colors ${interviewForm.duration === d ? 'bg-purple-50 border-purple-300 text-purple-700 font-medium' : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'}`}
                      >
                        {durMap[d]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 3 && (
            <div>
              <div className="bg-stone-50 rounded-lg p-3.5 mb-4">
                <div className="grid grid-cols-[110px_1fr] gap-1.5 text-[13px]">
                  {[
                    ['Candidate', currentCandidate.name],
                    ['Role', currentRecord?.role],
                    ['Type', typeMap[interviewForm.type]],
                    ['Round', roundMap[interviewForm.round]],
                    ['Date & time', selDay ? `${MONTHS[calMonth]} ${selDay}, ${calYear}${interviewForm.slot ? ' · ' + interviewForm.slot : ''}` : '—'],
                    ['Duration', durMap[interviewForm.duration]],
                  ].map(([label, val]) => (
                    <Fragment key={label}>
                      <span className="text-stone-400">{label}</span>
                      <span className="font-medium text-stone-800">{val}</span>
                    </Fragment>
                  ))}
                </div>
              </div>
              <div className="mb-3.5">
                <label className="block text-[12px] font-medium text-stone-500 mb-2">Notify candidate via</label>
                <div className="flex gap-2">
                  {(['email', 'whatsapp', 'both'] as const).map(n => (
                    <button
                      key={n}
                      onClick={() => setInterviewForm({ notifyVia: n })}
                      className={`px-4 py-1.5 rounded-md border text-[12px] capitalize transition-colors ${interviewForm.notifyVia === n ? 'bg-purple-50 border-purple-300 text-purple-700 font-medium' : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-stone-500 mb-1.5">Message to candidate (optional)</label>
                <textarea
                  className="w-full px-3 py-2 border border-stone-300 rounded-md text-[13px] outline-none focus:border-purple-500 resize-y min-h-[80px]"
                  placeholder="e.g. Please keep your ID proof handy..."
                  value={interviewForm.message}
                  onChange={e => setInterviewForm({ message: e.target.value })}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-stone-200 flex items-center justify-between sticky bottom-0 bg-white">
          <button
            onClick={handleBack}
            className={`px-3 py-1.5 border border-stone-300 bg-white text-stone-700 text-xs font-medium rounded-md hover:bg-stone-50 transition-colors ${step === 1 ? 'invisible' : ''}`}
          >
            ← Back
          </button>
          <button
            onClick={handleNext}
            className="px-4 py-1.5 bg-[#534AB7] text-white text-xs font-medium rounded-md hover:bg-[#453da0] transition-colors"
          >
            {step === 3 ? 'Confirm interview ✓' : step === 2 ? 'Next: review →' : 'Next: pick date →'}
          </button>
        </div>
      </div>
    </div>
  );
}
