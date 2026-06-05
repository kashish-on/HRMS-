import { useATS } from '../../context/ATSContext';

export default function ParseProgressModal() {
  const { showParseModal, parseProgress } = useATS();

  if (!showParseModal) return null;

  const statusMessages = [
    { threshold: 0, text: 'Uploading files to Supabase storage...' },
    { threshold: 30, text: 'Parsing resumes with RChilli...' },
    { threshold: 60, text: 'Scoring candidates against the role...' },
    { threshold: 85, text: 'Ranking candidates and preparing results...' },
  ];

  const status = [...statusMessages].reverse().find(m => parseProgress >= m.threshold)?.text ?? statusMessages[0].text;

  return (
    <div className="fixed inset-0 bg-black/45 z-[200] flex items-center justify-center p-5">
      <div className="bg-white rounded-xl border border-stone-200 w-full max-w-[420px]">
        <div className="p-9 text-center">
          <div className="text-[32px] mb-3">ðŸ¤–</div>
          <div className="text-[15px] font-semibold text-stone-900 mb-2">ATS parsing in progress</div>
          <div className="text-[13px] text-stone-400 mb-5">{status}</div>
          <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden mb-2">
            <div
              className="h-1.5 bg-purple-600 rounded-full transition-all duration-300"
              style={{ width: `${parseProgress}%` }}
            />
          </div>
          <div className="text-[11px] text-stone-400">{Math.round(parseProgress)}%</div>
        </div>
      </div>
    </div>
  );
}
