import type { Stage } from '../../types';

const STAGES: Stage[] = [
  'Applied',
  'Shortlisted',
  'Interview Scheduled',
  'Interviewed',
  'Offer Extended',
];

const STAGE_META: Record<string, string> = {
  Applied: 'Resume received',
  Shortlisted: 'Moved to shortlist',
  'Interview Scheduled': 'Interview booked',
  Interviewed: 'Interview completed',
  'Offer Extended': 'Offer sent',
};

interface PipelineTrackerProps {
  currentStage: Stage;
}

export default function PipelineTracker({ currentStage }: PipelineTrackerProps) {
  const currentIdx = STAGES.indexOf(currentStage as Stage);
  const isRejected = currentStage === 'Rejected';

  return (
    <div className="flex flex-col gap-0">
      {STAGES.map((stage, i) => {
        const isDone = !isRejected && i < currentIdx;
        const isActive = !isRejected && i === currentIdx;
        const isFuture = isRejected || i > currentIdx;
        const isLast = i === STAGES.length - 1;

        return (
          <div key={stage} className="flex gap-3 items-start">
            {/* Track */}
            <div className="flex flex-col items-center w-3 flex-shrink-0">
              <div
                className={`w-3 h-3 rounded-full flex-shrink-0 mt-0.5 ${
                  isDone
                    ? 'bg-green-500'
                    : isActive
                    ? 'bg-purple-600 ring-[3px] ring-purple-100'
                    : 'bg-stone-300'
                }`}
              />
              {!isLast && (
                <div className={`w-0.5 flex-1 min-h-[22px] my-0.5 ${isDone ? 'bg-green-500' : 'bg-stone-200'}`} />
              )}
            </div>
            {/* Content */}
            <div className="pb-[18px]">
              <div
                className={`text-[13px] font-medium ${
                  isActive ? 'text-purple-700' : isFuture ? 'text-stone-400' : 'text-stone-800'
                }`}
              >
                {stage}
              </div>
              <div className="text-[11px] text-stone-400 mt-0.5">{STAGE_META[stage]}</div>
            </div>
          </div>
        );
      })}

      {isRejected && (
        <div className="flex gap-3 items-start">
          <div className="flex flex-col items-center w-3 flex-shrink-0">
            <div className="w-3 h-3 rounded-full bg-red-400 flex-shrink-0 mt-0.5" />
          </div>
          <div>
            <div className="text-[13px] font-medium text-red-700">Rejected</div>
            <div className="text-[11px] text-stone-400 mt-0.5">Not moving forward</div>
          </div>
        </div>
      )}
    </div>
  );
}
