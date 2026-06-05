import { useState } from 'react';
import { useATS } from '../../context/ATSContext';
import type { ScoreWeights } from '../../types';

export default function WeightSettingsModal() {
  const { showWeightModal, setShowWeightModal, weights, setWeights } = useATS();
  const [local, setLocal] = useState<ScoreWeights>({ ...weights });

  if (!showWeightModal) return null;

  const total = local.skill + local.experience + local.title + local.location;
  const isValid = total === 100;

  const dims: { key: keyof ScoreWeights; label: string }[] = [
    { key: 'skill', label: 'Skill match' },
    { key: 'experience', label: 'Experience match' },
    { key: 'title', label: 'Title relevance' },
    { key: 'location', label: 'Location match' },
  ];

  function handleSave() {
    if (!isValid) return;
    setWeights(local);
    setShowWeightModal(false);
  }

  function handleClose() {
    setLocal({ ...weights });
    setShowWeightModal(false);
  }

  return (
    <div className="fixed inset-0 bg-black/45 z-[200] flex items-center justify-center p-5" onClick={handleClose}>
      <div className="bg-white rounded-xl border border-stone-200 w-full max-w-[440px]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <div className="text-[15px] font-semibold text-stone-900">Score weight settings</div>
          <button onClick={handleClose} className="w-7 h-7 flex items-center justify-center border border-stone-200 rounded-md text-stone-400 hover:bg-stone-50 text-sm">✕</button>
        </div>

        {/* Body */}
        <div className="p-5">
          {/* AI notice */}
          <div className="flex items-start gap-2.5 px-4 py-3 bg-purple-50 rounded-lg mb-4">
            <div className="flex gap-1 mt-0.5 flex-shrink-0">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-purple-500"
                  style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
                />
              ))}
            </div>
            <div className="text-[12px] text-purple-700">
              AI scoring uses Claude to evaluate each resume. Adjust weights to prioritise what matters most for your role.
            </div>
          </div>

          {/* Sliders */}
          <div className="space-y-3">
            {dims.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-3">
                <span className="text-[12px] text-stone-600 w-[130px] flex-shrink-0">{label}</span>
                <input
                  type="range"
                  min={0}
                  max={60}
                  step={5}
                  value={local[key]}
                  onChange={e => setLocal(prev => ({ ...prev, [key]: parseInt(e.target.value) }))}
                  className="flex-1 accent-purple-600"
                />
                <span className="text-[12px] font-medium text-purple-700 w-9 text-right flex-shrink-0">{local[key]}%</span>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="bg-stone-50 rounded-lg px-3.5 py-2.5 mt-4 text-[13px] text-stone-600">
            Weights must add up to 100%. Current total:{' '}
            <span className={`font-semibold ${isValid ? 'text-green-600' : 'text-red-500'}`}>{total}%</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-stone-200 flex justify-between">
          <button onClick={handleClose} className="px-3 py-1.5 border border-stone-300 bg-white text-stone-700 text-xs font-medium rounded-md hover:bg-stone-50 transition-colors">Cancel</button>
          <button
            onClick={handleSave}
            disabled={!isValid}
            className={`px-4 py-1.5 text-white text-xs font-medium rounded-md transition-colors ${isValid ? 'bg-[#534AB7] hover:bg-[#453da0]' : 'bg-stone-300 cursor-not-allowed'}`}
          >
            Save weights
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
